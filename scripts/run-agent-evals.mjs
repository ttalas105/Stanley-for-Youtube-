import { agentEvalCases } from "./agent-eval-cases.mjs";

if (process.env.RUN_LIVE_AGENT_EVALS !== "1") {
  console.error("Live agent evals make paid Gemini and YouTube API calls. Set RUN_LIVE_AGENT_EVALS=1 after confirming that cost is acceptable.");
  process.exit(1);
}

const baseUrl = (process.env.STANLEY_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const results = [];

for (const scenario of agentEvalCases) {
  const started = Date.now();
  try {
    const response = await fetch(`${baseUrl}/api/generate-titles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: scenario.topic,
        mode: scenario.mode,
        sessionId: `eval_${scenario.id.replace(/[^a-z0-9]/gi, "_")}`,
        ...(scenario.messages ? { messages: scenario.messages } : {}),
      }),
    });
    const payload = await response.json();
    const toolCalls = Array.isArray(payload.agent?.toolCalls) ? payload.agent.toolCalls.map((call) => call.name) : [];
    const requiredTools = scenario.requiredTools || [];
    const forbiddenTools = scenario.forbiddenTools || [];
    const failures = [
      ...requiredTools.filter((tool) => !toolCalls.includes(tool)).map((tool) => `missing ${tool}`),
      ...forbiddenTools.filter((tool) => toolCalls.includes(tool)).map((tool) => `unnecessary ${tool}`),
      ...(scenario.maxToolCalls !== undefined && toolCalls.length > scenario.maxToolCalls ? [`used ${toolCalls.length} tools; maximum ${scenario.maxToolCalls}`] : []),
      ...(!response.ok || !payload.reply ? [`HTTP ${response.status} or missing reply`] : []),
      ...(scenario.expects === "blocked" && payload.blocked !== true ? ["expected blocked response"] : []),
      ...(scenario.expects === "titles" && !Array.isArray(payload.titles) ? ["expected titles"] : []),
      ...(scenario.expects === "ideas" && !Array.isArray(payload.ideas) ? ["expected ideas"] : []),
    ];
    results.push({ id: scenario.id, passed: failures.length === 0, failures, toolCalls, durationMs: Date.now() - started, runId: payload.agent?.runId });
  } catch (error) {
    results.push({ id: scenario.id, passed: false, failures: [error instanceof Error ? error.message : "request failed"], toolCalls: [], durationMs: Date.now() - started });
  }
}

for (const result of results) {
  console.log(`${result.passed ? "PASS" : "FAIL"} ${result.id} (${result.durationMs}ms)${result.toolCalls.length ? ` tools=${result.toolCalls.join(",")}` : ""}${result.failures.length ? ` ${result.failures.join("; ")}` : ""}`);
}

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} live agent evals passed.`);
if (failed.length) process.exitCode = 1;
