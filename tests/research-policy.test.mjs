import assert from "node:assert/strict";
import test from "node:test";

import { resolveResearchAccess } from "../app/api/generate-titles/research-policy.mjs";

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
