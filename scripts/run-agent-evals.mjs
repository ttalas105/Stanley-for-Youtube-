import { agentEvalCases } from "./agent-eval-cases.mjs";

if (process.env.RUN_LIVE_AGENT_EVALS !== "1") {
  console.error("Live agent evals make paid Gemini and YouTube API calls. Set RUN_LIVE_AGENT_EVALS=1 after confirming that cost is acceptable.");
  process.exit(1);
}

const baseUrl = (process.env.STANLEY_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const delayMs = Math.max(0, Number(process.env.STANLEY_EVAL_DELAY_MS || 5500));
const evalCookie = (process.env.STANLEY_EVAL_COOKIE || "").trim();
const results = [];

for (const [scenarioIndex, scenario] of agentEvalCases.entries()) {
  if (scenarioIndex > 0 && delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
  const started = Date.now();
  try {
    const response = await fetch(`${baseUrl}/api/generate-titles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(evalCookie ? { Cookie: evalCookie } : {}),
      },
      body: JSON.stringify({
        topic: scenario.topic,
        mode: scenario.mode,
        sessionId: `eval_${scenario.id.replace(/[^a-z0-9]/gi, "_")}`,
        ...(scenario.creatorProfile ? { creatorProfile: scenario.creatorProfile } : {}),
        ...(scenario.messages ? { messages: scenario.messages } : {}),
      }),
    });
    const payload = await response.json();
    const qualityText = JSON.stringify({
      reply: payload.reply,
      titles: payload.titles,
      ideas: payload.ideas,
      script: payload.script,
      filmingPlan: payload.filmingPlan,
    });
    const toolCallRecords = Array.isArray(payload.agent?.toolCalls) ? payload.agent.toolCalls : [];
    const toolCalls = toolCallRecords.map((call) => call.name);
    const requiredTools = scenario.requiredTools || [];
    const requiredSuccessfulTools = scenario.requiredSuccessfulTools || [];
    const forbiddenTools = scenario.forbiddenTools || [];
    const failures = [
      ...requiredTools.filter((tool) => !toolCalls.includes(tool)).map((tool) => `missing ${tool}`),
      ...requiredSuccessfulTools.filter((tool) => !toolCallRecords.some((call) => call.name === tool && ["complete", "partial"].includes(call.status)))
        .map((tool) => `${tool} did not return connected evidence`),
      ...forbiddenTools.filter((tool) => toolCalls.includes(tool)).map((tool) => `unnecessary ${tool}`),
      ...(scenario.maxToolCalls !== undefined && toolCalls.length > scenario.maxToolCalls ? [`used ${toolCalls.length} tools; maximum ${scenario.maxToolCalls}`] : []),
      ...(!response.ok || !payload.reply ? [`HTTP ${response.status} or missing reply`] : []),
      ...(scenario.expects === "blocked" && payload.blocked !== true ? ["expected blocked response"] : []),
      ...(scenario.expects === "titles" && !Array.isArray(payload.titles) ? ["expected titles"] : []),
      ...(scenario.expects === "ideas" && !Array.isArray(payload.ideas) ? ["expected ideas"] : []),
      ...(scenario.expectedCount !== undefined && Array.isArray(payload.titles) && payload.titles.length !== scenario.expectedCount
        ? [`expected ${scenario.expectedCount} titles; received ${payload.titles.length}`]
        : []),
      ...(scenario.maxTitleLength !== undefined && Array.isArray(payload.titles)
        ? payload.titles.filter((title) => Array.from(String(title?.title || "")).length > scenario.maxTitleLength)
          .map((title) => `title too long: ${title.title}`)
        : []),
      ...(scenario.requiredPatterns || []).filter((pattern) => !new RegExp(pattern, "i").test(qualityText)).map((pattern) => `missing quality pattern /${pattern}/i`),
      ...(scenario.forbiddenPatterns || []).filter((pattern) => new RegExp(pattern, "i").test(qualityText)).map((pattern) => `matched forbidden pattern /${pattern}/i`),
    ];
    results.push({ id: scenario.id, passed: failures.length === 0, failures, toolCalls, durationMs: Date.now() - started, runId: payload.agent?.runId, reply: String(payload.reply || "").slice(0, 240) });
  } catch (error) {
    results.push({ id: scenario.id, passed: false, failures: [error instanceof Error ? error.message : "request failed"], toolCalls: [], durationMs: Date.now() - started });
  }
}

for (const result of results) {
  console.log(`${result.passed ? "PASS" : "FAIL"} ${result.id} (${result.durationMs}ms)${result.toolCalls.length ? ` tools=${result.toolCalls.join(",")}` : ""}${result.failures.length ? ` ${result.failures.join("; ")} reply=${JSON.stringify(result.reply)}` : ""}`);
}

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} live agent evals passed.`);
if (failed.length) process.exitCode = 1;
