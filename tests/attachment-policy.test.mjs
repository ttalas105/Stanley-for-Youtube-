import assert from "node:assert/strict";
import test from "node:test";

import { hasPriorAssistantAnalysisForVideo, selectedYouTubeVideoId } from "../app/api/generate-titles/attachment-policy.mjs";

test("uses the exact ID from a selected YouTube attachment", () => {
  assert.equal(selectedYouTubeVideoId([
    { kind: "youtube", videoId: "91Oy3we7Gv0", title: "This is why 99% fail" },
  ]), "91Oy3we7Gv0");
  assert.equal(selectedYouTubeVideoId([{ kind: "image", videoId: "91Oy3we7Gv0" }]), "");
  assert.equal(selectedYouTubeVideoId([{ kind: "youtube", videoId: "not a valid id" }]), "");
  assert.equal(
    selectedYouTubeVideoId([{ kind: "youtube", videoId: "91Oy3we7Gv0" }], "What about this video? Selected YouTube reference: https://youtube.com/watch?v=91Oy3we7Gv0", true),
    "91Oy3we7Gv0",
  );
  assert.equal(
    selectedYouTubeVideoId([{ kind: "youtube", videoId: "91Oy3we7Gv0" }], "What else stands out about that same video?", true),
    "91Oy3we7Gv0",
  );
  assert.equal(
    selectedYouTubeVideoId([{ kind: "youtube", videoId: "91Oy3we7Gv0" }], "Okay perfect, let's build the idea", true),
    "",
  );
});

test("reuses a completed analysis when the same selected video remains attached", () => {
  const messages = [
    { role: "user", content: "Tell me about https://www.youtube.com/watch?v=91Oy3we7Gv0" },
    { role: "assistant", content: "This is a seven-second motivational Short." },
    { role: "user", content: "Is this a good or bad video?" },
  ];
  assert.equal(hasPriorAssistantAnalysisForVideo(messages, { videoId: "91Oy3we7Gv0", title: "This is why 99% fail. #shorts #motivation" }), true);
});

test("keeps media available for the first analysis and for a newly selected video", () => {
  assert.equal(hasPriorAssistantAnalysisForVideo([
    { role: "user", content: "Tell me about this video" },
  ], { videoId: "91Oy3we7Gv0", title: "This is why 99% fail. #shorts #motivation" }), false);
  assert.equal(hasPriorAssistantAnalysisForVideo([
    { role: "user", content: "Tell me about https://www.youtube.com/watch?v=oldVideo123" },
    { role: "assistant", content: "Here is the analysis." },
    { role: "user", content: "Now tell me about the new selection" },
  ], { videoId: "newVideo456", title: "A completely different video" }), false);
});

test("recognizes the selected video from the earlier assistant analysis title", () => {
  const messages = [
    { role: "user", content: "Tell me about this video" },
    { role: "assistant", content: "This is why 99% fail. #shorts #motivation is a seven-second motivational Short." },
    { role: "user", content: "is this a good or bad video?" },
  ];

  assert.equal(hasPriorAssistantAnalysisForVideo(messages, { videoId: "91Oy3we7Gv0", title: "This is why 99% fail. #shorts #motivation" }), true);
});
