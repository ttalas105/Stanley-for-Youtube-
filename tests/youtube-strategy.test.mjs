import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  YOUTUBE_STRATEGY_SOURCES,
  YOUTUBE_STRATEGY_VERSION,
  algorithmStrategyForIntent,
} from "../app/api/generate-titles/youtube-strategy.mjs";

test("grounds Stanley in YouTube's appeal, engagement, and satisfaction framework", () => {
  const strategy = algorithmStrategyForIntent("idea_work");
  assert.match(strategy, /Appeal:/);
  assert.match(strategy, /Engagement:/);
  assert.match(strategy, /Satisfaction:/);
  assert.match(strategy, /target viewer/i);
  assert.match(strategy, /long term/i);
  assert.match(YOUTUBE_STRATEGY_VERSION, /^youtube-official-/);
});

test("rejects common algorithm myths and fake performance guarantees", () => {
  const strategy = algorithmStrategyForIntent("script_work");
  assert.match(strategy, /no universal ideal video length, CTR, retention percentage, upload frequency, or publish time/i);
  assert.match(strategy, /Do not promise views, virality, ranking, or algorithmic preference/i);
  assert.match(strategy, /remove throat-clearing, repetition, and filler/i);
});

test("uses job-specific strategy for scripts and packaging", () => {
  assert.match(algorithmStrategyForIntent("script_work"), /first moments validate the title and thumbnail promise/i);
  assert.match(algorithmStrategyForIntent("title_work"), /Optimize honest appeal/i);
  assert.match(algorithmStrategyForIntent("thumbnail_work"), /one instantly legible focal idea/i);
});

test("records only first-party YouTube and Google research sources", () => {
  assert.ok(YOUTUBE_STRATEGY_SOURCES.length >= 6);
  assert.ok(YOUTUBE_STRATEGY_SOURCES.every((source) => /^https:\/\/(support\.google\.com\/youtube|developers\.google\.com\/youtube|research\.google)\//.test(source)));
});

test("wires the official strategy into the production creative system", async () => {
  const route = await readFile(new URL("../app/api/generate-titles/route.ts", import.meta.url), "utf8");
  assert.match(route, /algorithmStrategyForIntent\(scope\.intent\)/);
  assert.match(route, /appeal, engagement, and satisfaction framework/i);
  assert.match(route, /Every later section must add proof, progress, contrast, complication, or payoff/i);
});
