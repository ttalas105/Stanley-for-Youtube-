import assert from "node:assert/strict";
import test from "node:test";

import { addWorkflowGuidance, appendWorkflowQuestion, formatStanleyReply, workflowContinuationForReply, workflowNextActions } from "../app/workflow-next-actions.mjs";

test("moves the creator through idea, script, filming, thumbnail, and review", () => {
  assert.equal(workflowNextActions({ hasResearch: true })[0].id, "idea");
  assert.equal(workflowNextActions({ hasIdeas: true })[0].id, "script");
  assert.equal(workflowNextActions({ hasScript: true })[0].id, "filming");
  assert.equal(workflowNextActions({ hasFilmingPlan: true })[0].id, "thumbnail");
  assert.equal(workflowNextActions({ hasThumbnailImage: true })[0].id, "review");
});

test("uses the furthest completed artifact when a response contains a package", () => {
  assert.equal(workflowNextActions({ hasIdeas: true, hasScript: true, hasFilmingPlan: true })[0].id, "thumbnail");
  assert.equal(workflowNextActions({ hasScript: true, hasThumbnailImage: true })[0].id, "review");
});

test("does not suggest workflow actions for blocked or artifact-free replies", () => {
  assert.deepEqual(workflowNextActions({ blocked: true, hasIdeas: true }), []);
  assert.deepEqual(workflowNextActions({}), []);
});

test("replaces a model's trailing question with the deterministic workflow question", () => {
  const actions = workflowNextActions({ hasIdeas: true });
  assert.equal(
    appendWorkflowQuestion("I ranked the strongest direction first. Which one do you like?", actions),
    "I ranked the strongest direction first.\n\nWant me to turn the top idea into a complete script?",
  );
});

test("adds a question and structured action to artifact payloads", () => {
  const payload = addWorkflowGuidance({ reply: "The script is ready.", script: { title: "Test" } });
  assert.match(payload.reply, /shot-by-shot plan for filming it\?$/);
  assert.equal(payload.nextActions[0].id, "filming");
  assert.equal(addWorkflowGuidance({ error: "nope" }).nextActions, undefined);
  const researched = addWorkflowGuidance({
    reply: "The strongest repeatable pattern is a serialized challenge.",
    research: { examples: [{ title: "Day 1" }] },
  });
  assert.match(researched.reply, /Want to make an idea like this\?$/);
  assert.equal(researched.nextActions[0].id, "idea");
  const channelReview = addWorkflowGuidance({
    reply: "Your channel needs a more specific video promise.",
    agent: { toolCalls: [{ name: "youtube_channel_snapshot", status: "complete" }] },
  });
  assert.match(channelReview.reply, /Want to make an idea like this\?$/);
  assert.equal(channelReview.nextActions[0].id, "idea");
});

test("turns longer chat into short point form while leaving short replies natural", () => {
  assert.equal(formatStanleyReply("The title is the strongest option."), "The title is the strongest option.");
  assert.equal(formatStanleyReply("Hey! What are we creating today?"), "Hey! What are we creating today?");
  assert.equal(formatStanleyReply("Hey! Good to see you. What are we making?"), "Hey! Good to see you. What are we making?");
  assert.equal(
    formatStanleyReply("The evidence is limited, so I would not call this a proven pattern. The useful signal is the repeated visual contrast. Test that before changing the whole concept."),
    "- The evidence is limited, so I would not call this a proven pattern.\n- The useful signal is the repeated visual contrast.\n- Test that before changing the whole concept.",
  );
});

test("a typed yes advances only the step Stanley just offered", () => {
  const idea = workflowContinuationForReply("yes", [
    { role: "assistant", content: "The pattern is verified.\n\nWant to make an idea like this?" },
    { role: "user", content: "yes" },
  ]);
  assert.equal(idea.id, "idea");
  assert.match(idea.prompt, /verified research/i);

  const script = workflowContinuationForReply("yeah", [
    { role: "user", content: "Give me three ideas." },
    { role: "assistant", content: "Three directions are ready.\n\nWant me to turn the top idea into a complete script?" },
    { role: "user", content: "yeah" },
  ]);
  assert.equal(script.id, "script");

  const thumbnail = workflowContinuationForReply("yes", [
    { role: "assistant", content: "The filming plan is ready.\n\nWant me to create the finished thumbnail next?" },
    { role: "user", content: "yes" },
  ]);
  assert.equal(thumbnail.id, "thumbnail");
  assert.equal(thumbnail.prompt, "Create the finished YouTube thumbnail for the current video.");
  assert.equal(workflowContinuationForReply("yes", [{ role: "assistant", content: "Does that title feel right?" }, { role: "user", content: "yes" }]), null);
});
