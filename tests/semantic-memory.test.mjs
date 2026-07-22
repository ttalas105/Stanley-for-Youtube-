import assert from "node:assert/strict";
import test from "node:test";

import {
  emptySemanticMemory,
  explicitConsentMemoryUpdate,
  formatSemanticMemory,
  hasExplicitMemoryConsent,
  mergeMemoryFacts,
  normalizeMemoryFact,
  selectRelevantSemanticMemory,
  trustedSemanticMemory,
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

test("does not inject a selected preference into an unrelated request", () => {
  const memory = {
    creator: {
      summary: "The creator likes cats and dry humor.",
      facts: [
        { key: "likes_cats", value: "The creator likes cats.", category: "preference" },
        { key: "preferred_tone", value: "The creator prefers dry humor.", category: "preference" },
      ],
    },
    project: { summary: "", facts: [] },
  };

  const selected = selectRelevantSemanticMemory(memory, ["likes_cats"], [], "Write a YouTube script about morning productivity.");
  assert.deepEqual(selected.creator.facts, []);
  assert.equal(selected.creator.summary, "");
});

test("retrieves a saved preference when the prompt depends on that semantic slot", () => {
  const memory = {
    creator: {
      summary: "The creator likes cats.",
      facts: [{ key: "likes_cats", value: "The creator likes cats.", category: "preference" }],
    },
    project: { summary: "", facts: [] },
  };

  const selected = selectRelevantSemanticMemory(memory, ["likes_cats"], [], "Make a YouTube script about my favorite animal.");
  assert.deepEqual(selected.creator.facts, [{ key: "likes_cats", value: "The creator likes cats.", category: "preference" }]);
});

test("does not turn a broad niche match into a named-pet assumption", () => {
  const memory = {
    creator: {
      summary: "Rudy is the creator's dog.",
      facts: [{ key: "pet_rudy", value: "Rudy is the creator's pet dog.", category: "relationship" }],
    },
    project: { summary: "", facts: [] },
  };

  assert.deepEqual(selectRelevantSemanticMemory(memory, ["pet_rudy"], [], "Give me dog-training video ideas.").creator.facts, []);
  assert.equal(selectRelevantSemanticMemory(memory, ["pet_rudy"], [], "Write a video about my dog.").creator.facts[0]?.key, "pet_rudy");
});

test("ignores legacy auto-captured memory until the creator explicitly opts in", () => {
  const legacy = {
    creator: { summary: "Assumed profile", facts: [{ key: "favorite_pet", value: "cats", category: "preference" }] },
    project: { summary: "Stale video", facts: [{ key: "subject", value: "old idea", category: "subject" }] },
  };
  assert.equal(hasExplicitMemoryConsent(legacy), false);
  assert.deepEqual(trustedSemanticMemory(legacy), emptySemanticMemory());

  const update = explicitConsentMemoryUpdate({
    creatorFacts: [{ key: "favorite_food", value: "tacos", category: "preference" }],
  }, legacy);
  assert.deepEqual(update.removeCreatorKeys, ["favorite_pet"]);
  assert.equal(update.creatorFacts.some((fact) => fact.key === "stanley_memory_consent_v2"), true);
});

test("trusted memory exposes only opted-in creator facts and never project cache", () => {
  const trusted = trustedSemanticMemory({
    creator: {
      summary: "Do not inject summaries",
      facts: [
        { key: "stanley_memory_consent_v2", value: "enabled", category: "identity" },
        { key: "usual_tone", value: "dry and concise", category: "preference" },
      ],
    },
    project: { summary: "Random old brief", facts: [{ key: "subject", value: "old launch", category: "subject" }] },
  });
  assert.deepEqual(trusted, {
    creator: { summary: "", facts: [{ key: "usual_tone", value: "dry and concise", category: "preference" }] },
    project: { summary: "", facts: [] },
  });
});
