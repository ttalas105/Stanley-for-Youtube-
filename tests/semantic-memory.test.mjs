import assert from "node:assert/strict";
import test from "node:test";

import {
  emptySemanticMemory,
  formatSemanticMemory,
  mergeMemoryFacts,
  normalizeMemoryFact,
} from "../app/api/generate-titles/semantic-memory.mjs";

test("preserves named creator relationships as reusable memory", () => {
  const facts = mergeMemoryFacts([], [
    { key: "pet_rudy", value: "Rudy is the creator's pet dog.", category: "relationship" },
  ], [], "creator", 24);

  assert.deepEqual(facts, [
    { key: "pet_rudy", value: "Rudy is the creator's pet dog.", category: "relationship" },
  ]);
  const memory = emptySemanticMemory();
  memory.creator.facts = facts;
  assert.match(formatSemanticMemory(memory), /Rudy is the creator's pet dog/);
});

test("later corrections overwrite a fact without duplicating it", () => {
  const facts = mergeMemoryFacts(
    [{ key: "preferred_tone", value: "The creator prefers playful videos.", category: "preference" }],
    [{ key: "preferred tone", value: "The creator prefers dry, understated humor.", category: "preference" }],
    [],
    "creator",
    24,
  );

  assert.equal(facts.length, 1);
  assert.equal(facts[0].key, "preferred_tone");
  assert.match(facts[0].value, /understated/);
});

test("explicit removals forget stale project decisions", () => {
  const facts = mergeMemoryFacts(
    [
      { key: "video_format", value: "The video is a challenge.", category: "format" },
      { key: "video_subject", value: "The video is about Rudy.", category: "subject" },
    ],
    [],
    ["video_format"],
    "project",
    32,
  );

  assert.deepEqual(facts, [
    { key: "video_subject", value: "The video is about Rudy.", category: "subject" },
  ]);
});

test("rejects credentials and contact details before persistence", () => {
  assert.equal(normalizeMemoryFact({ key: "api_key", value: "not-a-real-google-key", category: "identity" }, "creator"), null);
  assert.equal(normalizeMemoryFact({ key: "manager", value: "Email me at creator@example.com", category: "relationship" }, "creator"), null);
  assert.equal(normalizeMemoryFact({ key: "pet", value: "Rudy is my dog", category: "relationship" }, "creator")?.value, "Rudy is my dog");
});

test("keeps creator and project memory in separate prompt sections", () => {
  const context = formatSemanticMemory({
    creator: { summary: "The creator makes practical experiments.", facts: [{ key: "pet_rudy", value: "Rudy is their dog.", category: "relationship" }] },
    project: { summary: "A prank-style video about Rudy.", facts: [{ key: "tone", value: "Playful, not mean.", category: "tone" }] },
  });
  const parsed = JSON.parse(context);

  assert.equal(parsed.creator.facts[0].key, "pet_rudy");
  assert.equal(parsed.currentVideoProject.summary, "A prank-style video about Rudy.");
});
