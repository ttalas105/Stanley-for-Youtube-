import { parseStructuredText } from "./provider";
import { ToolRegistry } from "./tool-registry";
import type {
  AgentResult,
  AgentTrace,
  JsonObject,
  ModelContent,
  ModelPart,
  ProviderAdapter,
  ToolResult,
} from "./types";

type RunAgentInput = {
  provider: ProviderAdapter;
  registry: ToolRegistry;
  systemInstruction: string;
  contents: ModelContent[];
  responseSchema: JsonObject;
  maxOutputTokens: number;
  signal: AbortSignal;
  maxRounds?: number;
  maxToolCallsPerRound?: number;
  maxToolCallsPerTurn?: number;
  deadlineMs?: number;
  toolTimeoutMs?: number;
  toolsEnabled?: boolean;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as JsonObject).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function limitedResult(tool: string, code: string, message: string): ToolResult {
  return {
    ok: false,
    tool,
    status: "error",
    summary: message,
    data: null,
    coverage: { returned: 0, complete: false },
    sources: [],
    warnings: [],
    error: { code, message, retryable: false, correction: "Continue with the evidence already available and state the limitation." },
  };
}

function childSignal(parent: AbortSignal, timeoutMs: number) {
  const controller = new AbortController();
  const abort = () => controller.abort(parent.reason || new DOMException("Aborted", "AbortError"));
  parent.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException("Tool timeout", "TimeoutError")), timeoutMs);
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      parent.removeEventListener("abort", abort);
    },
  };
}

export async function runAgent(input: RunAgentInput): Promise<AgentResult> {
  const maxRounds = Math.min(8, Math.max(1, input.maxRounds || 6));
  const maxToolCalls = Math.min(5, Math.max(1, input.maxToolCallsPerRound || 3));
  const maxToolCallsPerTurn = Math.min(20, Math.max(1, input.maxToolCallsPerTurn || 8));
  const deadlineAt = Date.now() + Math.min(120_000, Math.max(5_000, input.deadlineMs || 75_000));
  const toolTimeoutMs = Math.min(30_000, Math.max(1_000, input.toolTimeoutMs || 12_000));
  const contents = [...input.contents];
  const memo = new Map<string, ToolResult>();
  const repeatCounts = new Map<string, number>();
  const toolResults: ToolResult[] = [];
  const started = Date.now();
  let toolsEnabled = input.toolsEnabled !== false;
  let attemptedToolCalls = 0;

  const trace: AgentTrace = {
    runId: crypto.randomUUID(),
    provider: input.provider.provider,
    model: input.provider.model,
    startedAt: new Date(started).toISOString(),
    durationMs: 0,
    modelRounds: 0,
    promptTokens: 0,
    completionTokens: 0,
    cachedTokens: 0,
    toolCalls: [],
  };

  for (let round = 1; round <= maxRounds; round += 1) {
    if (input.signal.aborted) throw input.signal.reason || new DOMException("Aborted", "AbortError");
    if (Date.now() >= deadlineAt) {
      trace.breaker = "deadline";
      toolsEnabled = false;
    }

    const response = await input.provider.complete({
      systemInstruction: input.systemInstruction,
      contents,
      tools: toolsEnabled ? input.registry.declarations() : [],
      responseSchema: input.responseSchema,
      maxOutputTokens: input.maxOutputTokens,
      signal: input.signal,
      deadlineAt,
    });
    trace.modelRounds += 1;
    trace.promptTokens += response.usage.promptTokens;
    trace.completionTokens += response.usage.completionTokens;
    trace.cachedTokens += response.usage.cachedTokens || 0;

    if (!response.toolCalls.length) {
      trace.durationMs = Date.now() - started;
      return { output: parseStructuredText(response.text), text: response.text, toolResults, trace };
    }

    contents.push(response.rawContent);
    const remainingToolCalls = Math.max(0, maxToolCallsPerTurn - attemptedToolCalls);
    const permittedThisRound = Math.min(maxToolCalls, remainingToolCalls);
    const calls = response.toolCalls.slice(0, permittedThisRound);
    const overflow = response.toolCalls.slice(permittedThisRound);
    attemptedToolCalls += calls.length;
    const roundResults = await Promise.all(calls.map(async (call) => {
      const signature = `${call.name}:${stable(call.args)}`;
      const repeats = (repeatCounts.get(signature) || 0) + 1;
      repeatCounts.set(signature, repeats);
      const startedTool = Date.now();
      let result: ToolResult;
      let memoHit = false;

      if (repeats >= 3) {
        result = limitedResult(call.name, "REPEATED_NO_PROGRESS", "The same tool request repeated without new information.");
        trace.breaker = "repeat";
        toolsEnabled = false;
      } else if (input.registry.effect(call.name) === "read" && memo.has(signature)) {
        result = memo.get(signature)!;
        memoHit = true;
      } else {
        const bounded = childSignal(input.signal, Math.min(toolTimeoutMs, Math.max(1, deadlineAt - Date.now())));
        try {
          result = await input.registry.execute(call.name, call.args, bounded.signal);
        } finally {
          bounded.cleanup();
        }
        if (input.registry.effect(call.name) === "read") memo.set(signature, result);
      }

      toolResults.push(result);
      trace.toolCalls.push({
        round,
        name: call.name,
        durationMs: Date.now() - startedTool,
        status: result.status,
        memoHit,
        errorCode: result.error?.code,
      });
      return { call, result };
    }));

    for (const call of overflow) {
      const turnLimitReached = attemptedToolCalls >= maxToolCallsPerTurn;
      const result = limitedResult(
        call.name,
        turnLimitReached ? "TURN_CALL_LIMIT" : "ROUND_CALL_LIMIT",
        turnLimitReached ? `Only ${maxToolCallsPerTurn} tool calls are allowed in one user turn.` : `Only ${maxToolCalls} tool calls are allowed in one model round.`,
      );
      toolResults.push(result);
      roundResults.push({ call, result });
      trace.toolCalls.push({
        round,
        name: call.name,
        durationMs: 0,
        status: result.status,
        memoHit: false,
        errorCode: result.error?.code,
      });
    }

    if (attemptedToolCalls >= maxToolCallsPerTurn) {
      toolsEnabled = false;
      trace.breaker ||= "tool_limit";
    }

    const responseParts: ModelPart[] = roundResults.map(({ call, result }) => ({
      functionResponse: { id: call.id, name: call.name, response: result },
    }));
    contents.push({ role: "user", parts: responseParts });

    if (round === maxRounds - 1) {
      toolsEnabled = false;
      trace.breaker ||= "round_limit";
    }
  }

  trace.durationMs = Date.now() - started;
  throw new Error("Stanley reached the model-round limit without a final response.");
}
