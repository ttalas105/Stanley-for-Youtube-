import assert from "node:assert/strict";
import test from "node:test";

import { requestedResearchWindowHours, requestsBroadPopularVideos, resolveResearchAccess } from "../app/api/generate-titles/research-policy.mjs";

test("does not treat a viral creative premise as permission to research", () => {
  assert.deepEqual(
    resolveResearchAccess("Give me a YouTube Short idea testing a viral productivity hack for 24 hours."),
    { publicSearch: false, channelSnapshot: false, videoEvidence: false },
  );
});

test("opens public search only for an explicit research request", () => {
  assert.deepEqual(
    resolveResearchAccess("Research comparable productivity videos on YouTube and give me a data-backed idea."),
    { publicSearch: true, channelSnapshot: false, videoEvidence: true },
  );
});

test("opens public search for explicit trend windows and named channel analysis", () => {
  for (const prompt of [
    "Find me the most popular videos in the last 24 hours, analyze them and create me a script.",
    "Can you access Casey Neistat's channel and analyze it?",
  ]) {
    assert.deepEqual(resolveResearchAccess(prompt), { publicSearch: true, channelSnapshot: false, videoEvidence: true }, prompt);
  }
});

test("keeps connected-channel analysis behind its own explicit request", () => {
  assert.deepEqual(
    resolveResearchAccess("Based on my channel, suggest my next video."),
    { publicSearch: false, channelSnapshot: true, videoEvidence: true },
  );
});

test("allows exact evidence for an explicitly attached YouTube video without opening search", () => {
  assert.deepEqual(
    resolveResearchAccess("Help me improve this video.", true),
    { publicSearch: false, channelSnapshot: false, videoEvidence: true },
  );
});

test("extracts explicit public research time windows without model interpretation", () => {
  assert.equal(requestedResearchWindowHours("Find the most popular videos in the last 24 hours."), 24);
  assert.equal(requestedResearchWindowHours("Analyze trending uploads from the past 3 days."), 72);
  assert.equal(requestedResearchWindowHours("Show me Casey Neistat's channel."), 0);
});

test("distinguishes a broad popular-video request from a topic search", () => {
  assert.equal(requestsBroadPopularVideos("Find the most popular videos in the last 24 hours."), true);
  assert.equal(requestsBroadPopularVideos("Find the most popular golf videos in the last 24 hours."), false);
});
