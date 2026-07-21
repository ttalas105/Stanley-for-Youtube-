import assert from "node:assert/strict";
import test from "node:test";

import { runAgent } from "../app/api/generate-titles/agent/kernel";
import { GeminiProviderAdapter, isRetryableTransportError, toGeminiFunctionParameters } from "../app/api/generate-titles/agent/provider";
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

test("recognizes Cloudflare remote model failures as retryable transport errors", () => {
  assert.equal(isRetryableTransportError(new TypeError("connection reset")), true);
  assert.equal(isRetryableTransportError(Object.assign(new Error("Network connection lost."), { retryable: true })), true);
  assert.equal(isRetryableTransportError(Object.assign(new Error("internal error"), { remote: true })), true);
  assert.equal(isRetryableTransportError(new DOMException("deadline", "TimeoutError")), false);
});

test("can fail over after one premium-provider attempt", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    return new Response(JSON.stringify({ error: { message: "This model is currently experiencing high demand." } }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const provider = new GeminiProviderAdapter("test-key", "gemini-premium-test", 1);
    await assert.rejects(provider.complete({
      systemInstruction: "Return JSON.",
      contents: [{ role: "user", parts: [{ text: "Write a script." }] }],
      tools: [],
      responseSchema: outputSchema,
      maxOutputTokens: 100,
      signal: new AbortController().signal,
      deadlineAt: Date.now() + 5_000,
    }), /Gemini 503/);
    assert.equal(attempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("resolves the latest connected upload before reading exact video evidence", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requestedUrls.push(url.toString());
    if (url.pathname.endsWith("/channels")) {
      return Response.json({ items: [{ contentDetails: { relatedPlaylists: { uploads: "UU_TEST" } } }] });
    }
    if (url.pathname.endsWith("/playlistItems")) {
      return Response.json({ items: [{ contentDetails: { videoId: "latest123" }, snippet: { title: "My latest upload", publishedAt: "2026-07-20T12:00:00Z", thumbnails: {} } }] });
    }
    if (url.pathname.endsWith("/videos")) {
      return Response.json({ items: [{
        id: "latest123",
        snippet: { title: "My latest upload", description: "I rebuilt a broken camera and tested it.", publishedAt: "2026-07-20T12:00:00Z", channelTitle: "Test creator", thumbnails: {} },
        statistics: { viewCount: "1200", likeCount: "90", commentCount: "12" },
        contentDetails: { duration: "PT8M12S", caption: "false" },
        status: { privacyStatus: "public" },
      }] });
    }
    return new Response("not found", { status: 404 });
  };

  try {
    const registry = createYouTubeToolRegistry({
      session: {
        accessToken: "test-access-token",
        expiresAt: Date.now() + 60_000,
        scope: "https://www.googleapis.com/auth/youtube.readonly",
        profile: { id: "channel1", title: "Test creator", thumbnailUrl: "", subscriberCount: 10, videoCount: 1, totalViews: 1200, analyzedAt: new Date().toISOString() },
      },
      allowPublicSearch: false,
      allowChannelSnapshot: true,
      allowVideoEvidence: true,
    });
    const snapshot = await registry.execute("youtube_channel_snapshot", { scope: "connected_channel", maxVideos: 1 }, new AbortController().signal);
    const videos = (snapshot.data as { videos?: Array<{ id?: string }> })?.videos || [];
    assert.equal(snapshot.status, "complete");
    assert.equal(videos[0]?.id, "latest123");

    const evidence = await registry.execute("youtube_get_video_evidence", { videoId: videos[0]?.id, includeTranscript: true }, new AbortController().signal);
    assert.equal(evidence.status, "partial");
    assert.equal((evidence.data as { title?: string })?.title, "My latest upload");
    assert.match(String((evidence.data as { description?: string })?.description), /rebuilt a broken camera/);
    assert.equal(requestedUrls.filter((url) => url.includes("/playlistItems")).length, 1);
    assert.equal(requestedUrls.filter((url) => url.includes("/videos")).length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
  const publicSearch = publicResearch.declarations().find((tool) => tool.name === "youtube_search_reference_videos");
  assert.ok(publicSearch);
  assert.ok("channelName" in publicSearch.parameters.properties);
  assert.ok("publishedWithinHours" in publicSearch.parameters.properties);
});

test("requires a topic, channel, or recent window for public video search", async () => {
  const registry = createYouTubeToolRegistry({ session: null, allowPublicSearch: true, allowChannelSnapshot: false, allowVideoEvidence: false });
  const result = await registry.execute("youtube_search_reference_videos", {}, new AbortController().signal);
  assert.equal(result.status, "error");
  assert.equal(result.error?.code, "INVALID_ARGUMENTS");
});

test("refuses to substitute among multiple exact-name public channels", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    return Response.json({ items: [
      { id: { channelId: "fan-one" }, snippet: { channelId: "fan-one", title: "David Goggins" } },
      { id: { channelId: "fan-two" }, snippet: { channelId: "fan-two", title: "David Goggins" } },
      { id: { channelId: "other" }, snippet: { channelId: "other", title: "Goggins Motivation" } },
    ] });
  };
  try {
    const registry = createYouTubeToolRegistry({ apiKey: "test-key", session: null, allowPublicSearch: true, allowChannelSnapshot: false, allowVideoEvidence: false });
    const result = await registry.execute("youtube_search_reference_videos", { channelName: "David Goggins", maxResults: 8 }, new AbortController().signal);
    assert.equal(result.status, "empty");
    assert.match(result.summary, /multiple public youtube channels/i);
    assert.match(result.warnings[0] || "", /exact channel url/i);
    assert.equal(requestedUrls.length, 1);
    assert.match(requestedUrls[0] || "", /type=channel/);
    assert.match(requestedUrls[0] || "", /maxResults=10/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("searches videos only after resolving one exact channel display name", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requestedUrls.push(url.toString());
    if (url.searchParams.get("type") === "channel") {
      return Response.json({ items: [
        { id: { channelId: "exact-channel" }, snippet: { channelId: "exact-channel", title: "Example Creator" } },
        { id: { channelId: "near-channel" }, snippet: { channelId: "near-channel", title: "Example Creator Clips" } },
      ] });
    }
    if (url.pathname.endsWith("/search")) {
      return Response.json({ items: [{ id: { videoId: "video123" } }] });
    }
    return Response.json({ items: [{
      id: "video123",
      snippet: { title: "A real upload", channelTitle: "Example Creator", publishedAt: new Date(Date.now() - 86_400_000).toISOString(), thumbnails: {} },
      statistics: { viewCount: "12000" },
      contentDetails: { duration: "PT8M" },
    }] });
  };
  try {
    const registry = createYouTubeToolRegistry({ apiKey: "test-key", session: null, allowPublicSearch: true, allowChannelSnapshot: false, allowVideoEvidence: false });
    const result = await registry.execute("youtube_search_reference_videos", { channelName: "Example Creator", maxResults: 4 }, new AbortController().signal);
    assert.equal(result.status, "partial");
    assert.equal((result.data as { videos?: unknown[] }).videos?.length, 1);
    assert.equal(new URL(requestedUrls[1] || "http://invalid").searchParams.get("channelId"), "exact-channel");
    assert.equal(new URL(requestedUrls[1] || "http://invalid").searchParams.has("q"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("recovers one-character creator misspellings without selecting clip channels", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requestedUrls.push(url.toString());
    if (url.searchParams.get("type") === "channel") {
      return Response.json({ items: [
        { id: { channelId: "jynxzi-main" }, snippet: { channelId: "jynxzi-main", title: "Jynxzi" } },
        { id: { channelId: "jynxzi-podcast" }, snippet: { channelId: "jynxzi-podcast", title: "Jynxzi Podcast" } },
        { id: { channelId: "jynxi-clips" }, snippet: { channelId: "jynxi-clips", title: "Jynxi Clips" } },
      ] });
    }
    if (url.pathname.endsWith("/search")) return Response.json({ items: [{ id: { videoId: "video123" } }] });
    return Response.json({ items: [{
      id: "video123",
      snippet: { title: "A real upload", channelTitle: "Jynxzi", publishedAt: new Date(Date.now() - 86_400_000).toISOString(), thumbnails: {} },
      statistics: { viewCount: "12000" },
      contentDetails: { duration: "PT8M" },
    }] });
  };
  try {
    const registry = createYouTubeToolRegistry({ apiKey: "test-key", session: null, allowPublicSearch: true, allowChannelSnapshot: false, allowVideoEvidence: false });
    const result = await registry.execute("youtube_search_reference_videos", { channelName: "Jynxi", maxResults: 4 }, new AbortController().signal);
    assert.equal(result.status, "partial");
    assert.equal(new URL(requestedUrls[1] || "http://invalid").searchParams.get("channelId"), "jynxzi-main");
    assert.match(result.warnings.join(" "), /resolved.+Jynxi.+Jynxzi/i);
    assert.deepEqual((result.data as { resolvedChannel?: unknown }).resolvedChannel, {
      requestedName: "Jynxi",
      title: "Jynxzi",
      corrected: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses the current video topic to resolve a creator whose public channel has a decorated name", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requestedUrls.push(url.toString());
    if (url.searchParams.get("type") === "channel") {
      const contextual = url.searchParams.get("q")?.toLowerCase().includes("csgo");
      return Response.json({ items: contextual ? [
        { id: { channelId: "warowl-main" }, snippet: { channelId: "warowl-main", title: "TheWarOwl" } },
        { id: { channelId: "warowl-junior" }, snippet: { channelId: "warowl-junior", title: "Jr. Warowl" } },
      ] : [
        { id: { channelId: "warowl-main" }, snippet: { channelId: "warowl-main", title: "TheWarOwl" } },
        { id: { channelId: "empty-lookalike" }, snippet: { channelId: "empty-lookalike", title: "🦉warowl" } },
        { id: { channelId: "clips" }, snippet: { channelId: "clips", title: "Unofficial WarOwl Clips" } },
      ] });
    }
    if (url.pathname.endsWith("/search")) return Response.json({ items: [{ id: { videoId: "video123" } }] });
    return Response.json({ items: [{
      id: "video123",
      snippet: { title: "Counter-Strike upload", channelTitle: "TheWarOwl", publishedAt: new Date(Date.now() - 86_400_000).toISOString(), thumbnails: {} },
      statistics: { viewCount: "12000" },
      contentDetails: { duration: "PT8M" },
    }] });
  };
  try {
    const registry = createYouTubeToolRegistry({
      apiKey: "test-key",
      session: null,
      researchContext: "He makes CSGO content. How can I film this video like his?",
      allowPublicSearch: true,
      allowChannelSnapshot: false,
      allowVideoEvidence: false,
    });
    const result = await registry.execute("youtube_search_reference_videos", { channelName: "WarOwl", maxResults: 4 }, new AbortController().signal);
    assert.equal(result.status, "partial");
    assert.equal(new URL(requestedUrls[1] || "http://invalid").searchParams.get("q"), "WarOwl csgo");
    assert.equal(new URL(requestedUrls[2] || "http://invalid").searchParams.get("channelId"), "warowl-main");
    assert.match(result.warnings.join(" "), /current video topic/i);
    assert.deepEqual((result.data as { resolvedChannel?: unknown }).resolvedChannel, {
      requestedName: "WarOwl",
      title: "TheWarOwl",
      corrected: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("recovers when the model mixes the creator name and topic into channelName", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requestedUrls.push(url.toString());
    if (url.searchParams.get("type") === "channel") {
      return Response.json({ items: [
        { id: { channelId: "warowl-main" }, snippet: { channelId: "warowl-main", title: "TheWarOwl" } },
        { id: { channelId: "warowl-junior" }, snippet: { channelId: "warowl-junior", title: "Jr. Warowl" } },
      ] });
    }
    if (url.pathname.endsWith("/search")) return Response.json({ items: [{ id: { videoId: "video123" } }] });
    return Response.json({ items: [{
      id: "video123",
      snippet: { title: "Counter-Strike upload", channelTitle: "TheWarOwl", publishedAt: new Date(Date.now() - 86_400_000).toISOString(), thumbnails: {} },
      statistics: { viewCount: "12000" },
      contentDetails: { duration: "PT8M" },
    }] });
  };
  try {
    const registry = createYouTubeToolRegistry({ apiKey: "test-key", session: null, allowPublicSearch: true, allowChannelSnapshot: false, allowVideoEvidence: false });
    const result = await registry.execute("youtube_search_reference_videos", { channelName: "WarOwl CSGO", maxResults: 4 }, new AbortController().signal);
    assert.equal(result.status, "partial");
    assert.equal(new URL(requestedUrls[1] || "http://invalid").searchParams.get("channelId"), "warowl-main");
    assert.deepEqual((result.data as { resolvedChannel?: unknown }).resolvedChannel, {
      requestedName: "WarOwl CSGO",
      title: "TheWarOwl",
      corrected: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses topic context to disambiguate duplicate exact channel display names", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requestedUrls.push(url.toString());
    if (url.searchParams.get("type") === "channel") {
      const contextual = url.searchParams.get("q")?.toLowerCase().includes("csgo");
      return Response.json({ items: contextual ? [
        { id: { channelId: "warowl-main" }, snippet: { channelId: "warowl-main", title: "TheWarOwl" } },
        { id: { channelId: "warowl-junior" }, snippet: { channelId: "warowl-junior", title: "Jr. Warowl" } },
      ] : [
        { id: { channelId: "warowl-main" }, snippet: { channelId: "warowl-main", title: "TheWarOwl" } },
        { id: { channelId: "empty-copy" }, snippet: { channelId: "empty-copy", title: "TheWarOwl" } },
      ] });
    }
    if (url.pathname.endsWith("/search")) return Response.json({ items: [{ id: { videoId: "video123" } }] });
    return Response.json({ items: [{
      id: "video123",
      snippet: { title: "Counter-Strike upload", channelTitle: "TheWarOwl", publishedAt: new Date(Date.now() - 86_400_000).toISOString(), thumbnails: {} },
      statistics: { viewCount: "12000" },
      contentDetails: { duration: "PT8M" },
    }] });
  };
  try {
    const registry = createYouTubeToolRegistry({
      apiKey: "test-key",
      session: null,
      researchContext: "The creator makes CSGO videos.",
      allowPublicSearch: true,
      allowChannelSnapshot: false,
      allowVideoEvidence: false,
    });
    const result = await registry.execute("youtube_search_reference_videos", { channelName: "TheWarOwl", maxResults: 4 }, new AbortController().signal);
    assert.equal(result.status, "partial");
    assert.equal(new URL(requestedUrls[2] || "http://invalid").searchParams.get("channelId"), "warowl-main");
    assert.match(result.warnings.join(" "), /current video topic/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("keeps shorter named-channel uploads when the long-form result set is empty", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.searchParams.get("type") === "channel") {
      return Response.json({ items: [
        { id: { channelId: "goggins-channel" }, snippet: { channelId: "goggins-channel", title: "David Goggins" } },
      ] });
    }
    if (url.pathname.endsWith("/search")) {
      return Response.json({ items: [
        { id: { videoId: "short-one" } },
        { id: { videoId: "short-two" } },
      ] });
    }
    return Response.json({ items: [
      {
        id: "short-one",
        snippet: { title: "Stay hard", channelTitle: "David Goggins", publishedAt: new Date(Date.now() - 86_400_000).toISOString(), thumbnails: {} },
        statistics: { viewCount: "90000" },
        contentDetails: { duration: "PT48S" },
      },
      {
        id: "short-two",
        snippet: { title: "No excuses", channelTitle: "David Goggins", publishedAt: new Date(Date.now() - 172_800_000).toISOString(), thumbnails: {} },
        statistics: { viewCount: "60000" },
        contentDetails: { duration: "PT39S" },
      },
    ] });
  };
  try {
    const registry = createYouTubeToolRegistry({ apiKey: "test-key", session: null, allowPublicSearch: true, allowChannelSnapshot: false, allowVideoEvidence: false });
    const result = await registry.execute("youtube_search_reference_videos", { channelName: "David Goggins", maxResults: 4, duration: "long_form" }, new AbortController().signal);
    assert.equal(result.status, "partial");
    assert.equal((result.data as { videos?: unknown[] }).videos?.length, 2);
    assert.match(result.summary, /shorter public uploads/i);
    assert.match(result.warnings[0] || "", /style/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses the most-popular chart for a broad recent-video window", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    const publishedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    return new Response(JSON.stringify({
      pageInfo: { totalResults: 4 },
      items: Array.from({ length: 4 }, (_, index) => ({
        id: `video${index}`,
        snippet: { title: `Popular video ${index}`, channelTitle: `Channel ${index}`, publishedAt, thumbnails: {} },
        statistics: { viewCount: String(10_000 - index) },
        contentDetails: { duration: "PT45S" },
      })),
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const registry = createYouTubeToolRegistry({ apiKey: "test-key", session: null, researchTopic: "", requestedPublishedWithinHours: 24, forceMostPopularChart: true, allowPublicSearch: true, allowChannelSnapshot: false, allowVideoEvidence: false });
    const result = await registry.execute("youtube_search_reference_videos", { query: "an invented topic the model should not use", maxResults: 4 }, new AbortController().signal);
    assert.equal(result.status, "complete");
    assert.equal(result.coverage.returned, 4);
    assert.match(requestedUrls[0] || "", /\/youtube\/v3\/videos\?/);
    assert.match(requestedUrls[0] || "", /chart=mostPopular/);
    assert.doesNotMatch(requestedUrls[0] || "", /\/youtube\/v3\/search\?/);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
