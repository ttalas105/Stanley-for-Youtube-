import type { JsonObject, ToolDefinition, ToolDeclaration, ToolResult } from "./types";

function errorResult(tool: string, code: string, message: string, retryable: boolean, correction?: string): ToolResult {
  return {
    ok: false,
    tool,
    status: "error",
    summary: message,
    data: null,
    coverage: { returned: 0, complete: false },
    sources: [],
    warnings: [],
    error: { code, message, retryable, ...(correction ? { correction } : {}) },
  };
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  constructor(definitions: ToolDefinition[]) {
    for (const definition of definitions) {
      if (this.tools.has(definition.name)) throw new Error(`Duplicate tool: ${definition.name}`);
      this.tools.set(definition.name, definition);
    }
  }

  declarations(): ToolDeclaration[] {
    return Array.from(this.tools.values()).map(({ name, description, parameters }) => ({ name, description, parameters }));
  }

  effect(name: string) {
    return this.tools.get(name)?.effect;
  }

  async execute(name: string, args: JsonObject, signal: AbortSignal): Promise<ToolResult> {
    const definition = this.tools.get(name);
    if (!definition) {
      return errorResult(name, "UNKNOWN_TOOL", `The tool ${name} is not available.`, false, "Choose one of the declared tools.");
    }

    let validated: JsonObject;
    try {
      validated = definition.validate(args);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The tool arguments are invalid.";
      return errorResult(name, "INVALID_ARGUMENTS", message, true, "Correct the arguments using the declared schema.");
    }

    try {
      return await definition.execute(validated, { signal });
    } catch (error) {
      if (signal.aborted) return errorResult(name, "TOOL_TIMEOUT", `${name} did not finish before its deadline.`, true, "Retry once with a narrower request or continue without it.");
      const message = error instanceof Error ? error.message : `${name} failed.`;
      return errorResult(name, "UPSTREAM_FAILURE", message, true, "Retry once with corrected or narrower arguments, then continue honestly.");
    }
  }
}

export function objectWithOnly(value: unknown, allowed: string[], toolName: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${toolName} expects an object.`);
  const object = value as JsonObject;
  const unknown = Object.keys(object).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new Error(`${toolName} does not accept: ${unknown.join(", ")}.`);
  return object;
}
