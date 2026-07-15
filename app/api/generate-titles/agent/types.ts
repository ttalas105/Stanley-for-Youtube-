export type JsonObject = Record<string, unknown>;

export type ToolEffect = "read" | "generate" | "draft" | "commit";
export type ToolStatus = "complete" | "partial" | "empty" | "error";

export type ToolSource = {
  id: string;
  label: string;
  url: string;
  capturedAt: string;
};

export type ToolCoverage = {
  returned: number;
  totalKnown?: number;
  complete: boolean;
  nextCursor?: string;
};

export type ToolError = {
  code: string;
  message: string;
  retryable: boolean;
  correction?: string;
};

export type ToolResult<T = unknown> = {
  ok: boolean;
  tool: string;
  status: ToolStatus;
  summary: string;
  data: T;
  handle?: string;
  coverage: ToolCoverage;
  sources: ToolSource[];
  warnings: string[];
  error?: ToolError;
};

export type ToolCall = {
  id?: string;
  name: string;
  args: JsonObject;
};

export type GeminiFunctionCallPart = {
  functionCall: {
    id?: string;
    name: string;
    args?: JsonObject;
  };
  thoughtSignature?: string;
};

export type GeminiFunctionResponsePart = {
  functionResponse: {
    id?: string;
    name: string;
    response: ToolResult;
  };
};

export type ModelPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { fileUri: string } }
  | GeminiFunctionCallPart
  | GeminiFunctionResponsePart;

export type ModelContent = {
  role: "user" | "model";
  parts: ModelPart[];
};

export type ToolDeclaration = {
  name: string;
  description: string;
  parameters: JsonObject;
};

export type ModelUsage = {
  promptTokens: number;
  completionTokens: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  cost?: number;
};

export type ModelResponse = {
  text: string;
  toolCalls: ToolCall[];
  rawContent: ModelContent;
  finishReason: string;
  usage: ModelUsage;
};

export type ModelRequest = {
  systemInstruction: string;
  contents: ModelContent[];
  tools: ToolDeclaration[];
  responseSchema?: JsonObject;
  maxOutputTokens: number;
  signal: AbortSignal;
  deadlineAt: number;
};

export interface ProviderAdapter {
  readonly model: string;
  readonly provider: string;
  complete(request: ModelRequest): Promise<ModelResponse>;
}

export type ToolExecutionContext = {
  signal: AbortSignal;
};

export type ToolDefinition<TArgs extends JsonObject = JsonObject> = {
  name: string;
  description: string;
  effect: ToolEffect;
  parameters: JsonObject;
  validate: (value: unknown) => TArgs;
  execute: (args: TArgs, context: ToolExecutionContext) => Promise<ToolResult>;
};

export type AgentToolTrace = {
  round: number;
  name: string;
  durationMs: number;
  status: ToolStatus;
  memoHit: boolean;
  errorCode?: string;
};

export type AgentTrace = {
  runId: string;
  provider: string;
  model: string;
  startedAt: string;
  durationMs: number;
  modelRounds: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  toolCalls: AgentToolTrace[];
  breaker?: "repeat" | "round_limit" | "tool_limit" | "deadline";
};

export type AgentResult = {
  output: unknown;
  text: string;
  toolResults: ToolResult[];
  trace: AgentTrace;
};
