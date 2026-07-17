import type {
  JsonObject,
  ModelContent,
  ModelRequest,
  ModelResponse,
  ModelUsage,
  ProviderAdapter,
  ToolCall,
} from "./types";

const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);
const MAX_PROVIDER_ATTEMPTS = 3;
const GEMINI_FUNCTION_SCHEMA_FIELDS = new Set([
  "type",
  "format",
  "title",
  "description",
  "nullable",
  "enum",
  "items",
  "properties",
  "required",
  "minimum",
  "maximum",
  "minItems",
  "maxItems",
  "minProperties",
  "maxProperties",
  "propertyOrdering",
  "anyOf",
]);

type GeminiResponsePayload = {
  candidates?: Array<{
    content?: ModelContent;
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    cachedContentTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  error?: { message?: string };
};

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason || new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

function shouldRetryStatus(status: number, message: string) {
  if (!RETRYABLE_STATUS.has(status)) return false;
  if (status === 429 && /(?:free[_ -]?tier|billing|payment|required|limit:\s*0|limit\s*is\s*0)/i.test(message)) return false;
  return true;
}

export function isRetryableTransportError(error: unknown) {
  if (error instanceof TypeError) return true;
  if (!error || typeof error !== "object") return false;
  const transportError = error as { remote?: unknown; retryable?: unknown };
  return transportError.retryable === true || transportError.remote === true;
}

function signalUntil(parent: AbortSignal, deadlineAt: number) {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parent.reason || new DOMException("Aborted", "AbortError"));
  parent.addEventListener("abort", abortFromParent, { once: true });
  const timer = setTimeout(
    () => controller.abort(new DOMException("The model deadline was reached.", "TimeoutError")),
    Math.max(1, deadlineAt - Date.now()),
  );
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      parent.removeEventListener("abort", abortFromParent);
    },
  };
}

function usageFrom(payload: GeminiResponsePayload): ModelUsage {
  return {
    promptTokens: payload.usageMetadata?.promptTokenCount || 0,
    completionTokens: payload.usageMetadata?.candidatesTokenCount || 0,
    cachedTokens: payload.usageMetadata?.cachedContentTokenCount || 0,
    reasoningTokens: payload.usageMetadata?.thoughtsTokenCount || 0,
  };
}

function modelText(content: ModelContent) {
  return content.parts.flatMap((part) => "text" in part ? [part.text] : []).join("");
}

function modelToolCalls(content: ModelContent): ToolCall[] {
  return content.parts.flatMap((part) => {
    if (!("functionCall" in part)) return [];
    return [{
      id: part.functionCall.id,
      name: part.functionCall.name,
      args: part.functionCall.args && typeof part.functionCall.args === "object" ? part.functionCall.args : {},
    }];
  });
}

export function toGeminiFunctionParameters(schema: JsonObject): JsonObject {
  const converted: JsonObject = {};
  for (const [key, value] of Object.entries(schema)) {
    if (!GEMINI_FUNCTION_SCHEMA_FIELDS.has(key)) continue;
    if (key === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
      converted.properties = Object.fromEntries(Object.entries(value as JsonObject).map(([name, child]) => [
        name,
        child && typeof child === "object" && !Array.isArray(child) ? toGeminiFunctionParameters(child as JsonObject) : child,
      ]));
      continue;
    }
    if (key === "items" && value && typeof value === "object" && !Array.isArray(value)) {
      converted.items = toGeminiFunctionParameters(value as JsonObject);
      continue;
    }
    if (key === "anyOf" && Array.isArray(value)) {
      converted.anyOf = value.map((child) => child && typeof child === "object" && !Array.isArray(child) ? toGeminiFunctionParameters(child as JsonObject) : child);
      continue;
    }
    converted[key] = value;
  }
  return converted;
}

export function parseStructuredText(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  if (!trimmed) throw new Error("The model returned an empty response.");
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error("The model returned malformed structured output.");
  }
}

export class GeminiProviderAdapter implements ProviderAdapter {
  readonly provider = "google";
  readonly model: string;
  private readonly maxAttempts: number;

  constructor(private readonly apiKey: string, model = "gemini-3.1-flash-lite", maxAttempts = MAX_PROVIDER_ATTEMPTS) {
    this.model = model;
    this.maxAttempts = Math.min(MAX_PROVIDER_ATTEMPTS, Math.max(1, Math.floor(maxAttempts)));
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      if (request.signal.aborted) throw request.signal.reason || new DOMException("Aborted", "AbortError");
      if (Date.now() >= request.deadlineAt) throw new DOMException("The model deadline was reached.", "TimeoutError");

      let cleanup = () => {};
      try {
        const bounded = signalUntil(request.signal, request.deadlineAt);
        cleanup = bounded.cleanup;
        const generationConfig: JsonObject = {
          maxOutputTokens: request.maxOutputTokens,
          thinkingConfig: { thinkingLevel: "minimal" },
        };
        if (request.responseSchema) {
          generationConfig.responseMimeType = "application/json";
          generationConfig.responseJsonSchema = request.responseSchema;
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: request.systemInstruction }] },
              contents: request.contents,
              ...(request.tools.length ? {
                tools: [{ functionDeclarations: request.tools.map((tool) => ({
                  ...tool,
                  parameters: toGeminiFunctionParameters(tool.parameters),
                })) }],
                toolConfig: { functionCallingConfig: { mode: "AUTO" } },
              } : {}),
              generationConfig,
              safetySettings: [
                "HARM_CATEGORY_HARASSMENT",
                "HARM_CATEGORY_HATE_SPEECH",
                "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "HARM_CATEGORY_DANGEROUS_CONTENT",
              ].map((category) => ({ category, threshold: "BLOCK_MEDIUM_AND_ABOVE" })),
            }),
            signal: bounded.signal,
          },
        );
        const payload = await response.json() as GeminiResponsePayload;
        if (!response.ok) {
          const message = payload.error?.message || "request failed";
          const error = new Error(`Gemini ${response.status}: ${message}`);
          const retryDelay = 400 * (2 ** attempt);
          if (attempt < this.maxAttempts - 1 && shouldRetryStatus(response.status, message) && Date.now() + retryDelay < request.deadlineAt) {
            lastError = error;
            await delay(retryDelay, request.signal);
            continue;
          }
          throw error;
        }

        const content = payload.candidates?.[0]?.content || { role: "model" as const, parts: [] };
        return {
          text: modelText(content),
          toolCalls: modelToolCalls(content),
          rawContent: content,
          finishReason: payload.candidates?.[0]?.finishReason || "UNKNOWN",
          usage: usageFrom(payload),
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Gemini request failed");
        const retryableTransport = isRetryableTransportError(error);
        const retryDelay = 400 * (2 ** attempt);
        if (request.signal.aborted || attempt >= this.maxAttempts - 1 || !retryableTransport || Date.now() + retryDelay >= request.deadlineAt) throw lastError;
        await delay(retryDelay, request.signal);
      } finally {
        cleanup();
      }
    }
    throw lastError || new Error("Gemini request failed");
  }
}

export async function generateStructured(
  provider: ProviderAdapter,
  input: {
    systemInstruction: string;
    contents: ModelContent[];
    responseSchema: JsonObject;
    maxOutputTokens: number;
    signal: AbortSignal;
    timeoutMs?: number;
  },
) {
  const response = await provider.complete({
    ...input,
    tools: [],
    deadlineAt: Date.now() + (input.timeoutMs || 60_000),
  });
  return parseStructuredText(response.text);
}
