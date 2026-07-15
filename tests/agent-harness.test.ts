import assert from "node:assert/strict";
import test from "node:test";

import { runAgent } from "../app/api/generate-titles/agent/kernel";
import { toGeminiFunctionParameters } from "../app/api/generate-titles/agent/provider";
import { ToolRegistry, objectWithOnly } from "../app/api/generate-titles/agent/tool-registry";
import { createYouTubeToolRegistry, focusResearchQuery } from "../app/api/generate-titles/agent/youtube-tools";
import type {
  JsonObject,
  ModelRequest,
  ModelResponse,
  ProviderAdapter,
  ToolDefinition,
  ToolResult,
} from "../app/api/generate-titles/agent/types";

const outputSchema = {
  type: "object",
  additionalProperties: false,
  properties: { reply: { type: "string" } },
  required: ["reply"],
};

function completeResult(tool = "youtube_search_reference_videos"): ToolResult {
  return {
    ok: true,
    tool,
    status: "complete",
    summary: "Evidence returned.",
    data: { value: 42 },
    coverage: { returned: 1, totalKnown: 1, complete: true },
    sources: [{ id: "source:1", label: "Evidence", url: "https://www.youtube.com/watch?v=source1", capturedAt: "2026-07-15T12:00:00.000Z" }],
    warnings: [],
  };
}

function functionCall(name: string, args: JsonObject, id = crypto.randomUUID()): ModelResponse {
  return {
    text: "",
    toolCalls: [{ id, name, args }],
    rawContent: { role: "model", parts: [{ functionCall: { id, name, args } }] },
    finishReason: "STOP",
    usage: { promptTokens: 10, completionTokens: 2 },
  };
}

function finalReply(reply = "Done."): ModelResponse {
  const text = JSON.stringify({ reply });
  return {
    text,
    toolCalls: [],
    rawContent: { role: "model", parts: [{ text }] },
    finishReason: "STOP",
    usage: { promptTokens: 12, completionTokens: 4 },
  };
}

class MockProvider implements ProviderAdapter {
  readonly provider = "mock";
  readonly model = "mock-agent";
  readonly requests: ModelRequest[] = [];

  constructor(private readonly responses: Array<ModelResponse | ((request: ModelRequest) => ModelResponse)>) {}

  async complete(request: ModelRequest) {
    this.requests.push(request);
    const next = this.responses.shift();
    if (!next) throw new Error("No mock response remains.");
    return typeof next === "function" ? next(request) : next;
  }
}

function readTool(options: { name?: string; effect?: "read" | "generate"; delayUntilAbort?: boolean; execute?: () => void } = {}): ToolDefinition {
  const name = options.name || "youtube_search_reference_videos";
  return {
    name,
    description: "A deterministic test tool.",
    effect: options.effect || "read",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { query: { type: "string" } },
      required: ["query"],
    },
    validate(value) {
      const object = objectWithOnly(value, ["query"], name);
      if (typeof object.query !== "string" || !object.query.trim()) throw new Error("query is required.");
      return object;
    },
    async execute(_args, context) {
      options.execute?.();
      if (options.delayUntilAbort) {
        await new Promise((_, reject) => context.signal.addEventListener("abort", () => reject(context.signal.reason), { once: true }));
      }
      return completeResult(name);
    },
  };
}

async function run(provider: ProviderAdapter, registry: ToolRegistry, overrides: Partial<Parameters<typeof runAgent>[0]> = {}) {
  return runAgent({
    provider,
    registry,
    systemInstruction: "Use tools only when evidence is needed.",
    contents: [{ role: "user", parts: [{ text: "Help with my YouTube video." }] }],
    responseSchema: outputSchema,
    maxOutputTokens: 500,
    signal: new AbortController().signal,
    deadlineMs: 5_000,
    ...overrides,
  });
}

test("runs a model-selected tool and returns the final structured response", async () => {
  const provider = new MockProvider([functionCall("youtube_search_reference_videos", { query: "cat challenge" }), finalReply("Here are the evidence-backed directions.")]);
  const result = await run(provider, new ToolRegistry([readTool()]));

  assert.deepEqual(result.output, { reply: "Here are the evidence-backed directions." });
  assert.equal(result.toolResults.length, 1);
  assert.equal(result.trace.modelRounds, 2);
  assert.equal(result.trace.toolCalls[0]?.status, "complete");
  assert.equal(provider.requests[0]?.tools[0]?.name, "youtube_search_reference_videos");
  assert.equal(provider.requests[1]?.contents.at(-1)?.role, "user");
  assert.equal("functionResponse" in provider.requests[1]!.contents.at(-1)!.parts[0]!, true);
});

test("emits live activity from the actual model and tool lifecycle", async () => {
  const provider = new MockProvider([functionCall("youtube_search_reference_videos", { query: "dog challenge" }), finalReply()]);
  const events: Array<{ id: string; label: string; detail?: string; status: string }> = [];
  await run(provider, new ToolRegistry([readTool()]), { onEvent: (event) => { events.push(event); } });

  const toolEvents = events.filter((event) => event.id.includes("youtube_search_reference_videos"));
  assert.deepEqual(toolEvents.map((event) => event.status), ["active", "complete"]);
  assert.match(toolEvents[1]?.detail || "", /Evidence returned/);
  assert.equal(events.some((event) => event.id === "model"), false);
  assert.ok(events.some((event) => event.id === "answer" && event.status === "active"));
});

test("shows only work that actually ran", async () => {
  const events: Array<{ id: string; label: string; status: string }> = [];
  await run(new MockProvider([finalReply("Direct answer.")]), new ToolRegistry([readTool()]), {
    onEvent: (event) => { events.push(event); },
  });
  assert.deepEqual(events.map(({ id, label, status }) => ({ id, label, status })), [
    { id: "answer", label: "Writing the answer", status: "active" },
  ]);
});

test("anchors an off-topic YouTube query to the current video subject", () => {
  assert.equal(
    focusResearchQuery("motivational videos that get views", "local golf course reviews"),
    "local golf course reviews",
  );
  assert.equal(
    focusResearchQuery("golf course strategy breakdown", "local golf course reviews"),
    "golf course strategy breakdown",
  );
});

test("answers directly without forcing a research call", async () => {
  const provider = new MockProvider([finalReply("Howdy. What are you making?")]);
  const result = await run(provider, new ToolRegistry([readTool()]));

  assert.equal(result.toolResults.length, 0);
  assert.equal(result.trace.modelRounds, 1);
  assert.deepEqual(result.output, { reply: "Howdy. What are you making?" });
});

test("can deterministically remove tools for social and security-only turns", async () => {
  const provider = new MockProvider([(request) => {
    assert.equal(request.tools.length, 0);
    return finalReply("Hello back.");
  }]);
  const result = await run(provider, new ToolRegistry([readTool()]), { toolsEnabled: false });
  assert.equal(result.toolResults.length, 0);
  assert.deepEqual(result.output, { reply: "Hello back." });
});

test("memoizes identical safe reads within one user turn", async () => {
  let executions = 0;
  const call = () => functionCall("youtube_search_reference_videos", { query: "morning routine" });
  const provider = new MockProvider([call(), call(), finalReply()]);
  const result = await run(provider, new ToolRegistry([readTool({ execute: () => { executions += 1; } })]));

  assert.equal(executions, 1);
  assert.equal(result.trace.toolCalls.length, 2);
  assert.equal(result.trace.toolCalls[1]?.memoHit, true);
});

test("never memoizes paid or generative operations", async () => {
  let executions = 0;
  const call = () => functionCall("thumbnail_generate", { query: "blue cat" });
  const provider = new MockProvider([call(), call(), finalReply()]);
  const registry = new ToolRegistry([readTool({ name: "thumbnail_generate", effect: "generate", execute: () => { executions += 1; } })]);
  await run(provider, registry);
  assert.equal(executions, 2);
});

test("stops a third identical no-progress call and disables tools", async () => {
  const call = () => functionCall("youtube_search_reference_videos", { query: "same query" });
  const provider = new MockProvider([call(), call(), call(), (request) => {
    assert.equal(request.tools.length, 0);
    return finalReply("I continued with the available evidence.");
  }]);
  const result = await run(provider, new ToolRegistry([readTool()]));

  assert.equal(result.trace.breaker, "repeat");
  assert.equal(result.toolResults.at(-1)?.error?.code, "REPEATED_NO_PROGRESS");
});

test("enforces the maximum tool calls in one model round", async () => {
  const calls = ["one", "two", "three", "four"].map((query) => ({ name: "youtube_search_reference_videos", args: { query }, id: query }));
  const provider = new MockProvider([{
    text: "",
    toolCalls: calls,
    rawContent: { role: "model", parts: calls.map((call) => ({ functionCall: call })) },
    finishReason: "STOP",
    usage: { promptTokens: 10, completionTokens: 5 },
  }, finalReply()]);
  const result = await run(provider, new ToolRegistry([readTool()]), { maxToolCallsPerRound: 2 });

  assert.equal(result.toolResults.length, 4);
  assert.deepEqual(result.toolResults.slice(2).map((item) => item.error?.code), ["ROUND_CALL_LIMIT", "ROUND_CALL_LIMIT"]);
  assert.equal(result.trace.toolCalls.length, 4);
});

test("caps total tool calls across the complete user turn", async () => {
  let executions = 0;
  const batch = (prefix: string): ModelResponse => {
    const calls = [1, 2, 3].map((number) => ({ name: "youtube_search_reference_videos", args: { query: `${prefix}-${number}` }, id: `${prefix}-${number}` }));
    return {
      text: "",
      toolCalls: calls,
      rawContent: { role: "model", parts: calls.map((call) => ({ functionCall: call })) },
      finishReason: "STOP",
      usage: { promptTokens: 10, completionTokens: 5 },
    };
  };
  const provider = new MockProvider([batch("one"), batch("two"), (request) => {
    assert.equal(request.tools.length, 0);
    return finalReply("Finished within the tool budget.");
  }]);
  const result = await run(provider, new ToolRegistry([readTool({ execute: () => { executions += 1; } })]), { maxToolCallsPerTurn: 4 });

  assert.equal(executions, 4);
  assert.equal(result.trace.breaker, "tool_limit");
  assert.deepEqual(result.toolResults.slice(-2).map((item) => item.error?.code), ["TURN_CALL_LIMIT", "TURN_CALL_LIMIT"]);
});

test("returns a corrective structured error for invalid tool arguments", async () => {
  const registry = new ToolRegistry([readTool()]);
  const result = await registry.execute("youtube_search_reference_videos", { query: "cats", invented: true }, new AbortController().signal);

  assert.equal(result.status, "error");
  assert.equal(result.error?.code, "INVALID_ARGUMENTS");
  assert.match(result.error?.correction || "", /declared schema/i);
});

test("contains tool timeouts and still allows a final model answer", async () => {
  const provider = new MockProvider([functionCall("youtube_search_reference_videos", { query: "slow query" }), finalReply("Research timed out, so I used the supplied brief.")]);
  const result = await run(provider, new ToolRegistry([readTool({ delayUntilAbort: true })]), { toolTimeoutMs: 15 });

  assert.equal(result.toolResults[0]?.error?.code, "TOOL_TIMEOUT");
  assert.deepEqual(result.output, { reply: "Research timed out, so I used the supplied brief." });
});

test("declares only the three minimal YouTube read tools", async () => {
  const registry = createYouTubeToolRegistry({ session: null });
  assert.deepEqual(registry.declarations().map((tool) => tool.name), [
    "youtube_channel_snapshot",
    "youtube_search_reference_videos",
    "youtube_get_video_evidence",
  ]);
  const result = await registry.execute("youtube_channel_snapshot", { scope: "connected_channel" }, new AbortController().signal);
  assert.equal(result.status, "empty");
  assert.equal(result.error?.code, "CHANNEL_NOT_CONNECTED");
});

test("exposes only the research layers approved for the current message", () => {
  const creativeOnly = createYouTubeToolRegistry({
    session: null,
    allowPublicSearch: false,
    allowChannelSnapshot: false,
    allowVideoEvidence: false,
  });
  assert.deepEqual(creativeOnly.declarations(), []);

  const publicResearch = createYouTubeToolRegistry({
    session: null,
    allowPublicSearch: true,
    allowChannelSnapshot: false,
    allowVideoEvidence: true,
  });
  assert.deepEqual(publicResearch.declarations().map((tool) => tool.name), [
    "youtube_search_reference_videos",
    "youtube_get_video_evidence",
  ]);
});

test("converts strict internal schemas to Gemini's supported function subset", () => {
  const converted = toGeminiFunctionParameters({
    type: "object",
    additionalProperties: false,
    properties: {
      videoId: { type: "string", pattern: "^[A-Za-z0-9_-]+$", minLength: 6, description: "Exact ID" },
    },
    required: ["videoId"],
  });
  assert.deepEqual(converted, {
    type: "object",
    properties: { videoId: { type: "string", description: "Exact ID" } },
    required: ["videoId"],
  });
});

test("rejects malformed final structured output instead of treating prose as success", async () => {
  const provider = new MockProvider([{
    ...finalReply(),
    text: "I finished it, trust me.",
    rawContent: { role: "model", parts: [{ text: "I finished it, trust me." }] },
  }]);
  await assert.rejects(run(provider, new ToolRegistry([readTool()])), /malformed structured output/i);
});
