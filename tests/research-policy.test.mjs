import assert from "node:assert/strict";
import test from "node:test";

import { explicitPublicYouTubeChannelName, looksLikePublicYouTubeResearchRequest } from "../app/api/generate-titles/guards.mjs";
import { requestedConnectedVideoCount, requestedResearchWindowHours, requestsBroadPopularVideos, requestsLatestConnectedVideo, resolveConversationPublicYouTubeChannel, resolveResearchAccess } from "../app/api/generate-titles/research-policy.mjs";

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

test("opens public search for explicitly requested current successful videos", () => {
  assert.deepEqual(
    resolveResearchAccess("Find current successful videos about first-time marathon training and give me ideas."),
    { publicSearch: true, channelSnapshot: false, videoEvidence: true },
  );
});

test("opens exact-video evidence for a supplied YouTube video ID", () => {
  assert.deepEqual(
    resolveResearchAccess("Analyze the packaging of YouTube video dQw4w9WgXcQ."),
    { publicSearch: false, channelSnapshot: false, videoEvidence: true },
  );
});

test("opens public search for explicit trend windows and named channel analysis", () => {
  for (const prompt of [
    "Find me the most popular videos in the last 24 hours, analyze them and create me a script.",
    "Can you access Casey Neistat's channel and analyze it?",
    "Can you go to David Goggins' YouTube channel and make this idea similar to his?",
    "Use https://www.youtube.com/@example.creator as the reference channel.",
  ]) {
    assert.deepEqual(resolveResearchAccess(prompt), { publicSearch: true, channelSnapshot: false, videoEvidence: true }, prompt);
  }
});

test("keeps connected-channel analysis behind its own explicit request", () => {
  assert.deepEqual(
    resolveResearchAccess("Based on my channel, suggest my next video."),
    { publicSearch: false, channelSnapshot: true, videoEvidence: true },
  );
  assert.deepEqual(
    resolveResearchAccess("howdey. How are my latest stats doing ?"),
    { publicSearch: false, channelSnapshot: true, videoEvidence: true },
  );
  assert.deepEqual(
    resolveResearchAccess("Review my recent metrics."),
    { publicSearch: false, channelSnapshot: true, videoEvidence: true },
  );
});

test("recognizes a natural named-creator lookup without requiring the word channel", () => {
  assert.equal(explicitPublicYouTubeChannelName("Look up Will Tennyson"), "Will Tennyson");
  assert.equal(explicitPublicYouTubeChannelName("Research the YouTuber Colin and Samir."), "Colin and Samir");
  assert.equal(explicitPublicYouTubeChannelName("Do some research on a YouTuber named Jynxi and tell me why he does so well."), "Jynxi");
  assert.equal(explicitPublicYouTubeChannelName("Research a creator called Jynxzi."), "Jynxzi");
  assert.equal(
    explicitPublicYouTubeChannelName("I love the youtuber Jynxi. Can you tell me how I can make my channel more like his?"),
    "Jynxi",
  );
  assert.equal(looksLikePublicYouTubeResearchRequest("Look up Will Tennyson"), true);
  assert.deepEqual(
    resolveResearchAccess("Look up Will Tennyson"),
    { publicSearch: true, channelSnapshot: false, videoEvidence: true },
  );
  assert.deepEqual(
    resolveResearchAccess("I love the youtuber Jynxi. Can you tell me how I can make my channel more like his?"),
    { publicSearch: true, channelSnapshot: true, videoEvidence: true },
  );
});

test("keeps a named public creator across a relational follow-up", () => {
  const messages = [
    { role: "user", content: "Look up Will Tennyson" },
    { role: "assistant", content: "I verified the channel." },
    { role: "user", content: "What should I make based on him?" },
  ];
  assert.equal(resolveConversationPublicYouTubeChannel(messages, messages.at(-1).content), "Will Tennyson");
  assert.equal(resolveConversationPublicYouTubeChannel(messages, "Give me an unrelated title about gardening."), "");
});

test("recognizes bounded recent videos on the connected channel", () => {
  assert.deepEqual(
    resolveResearchAccess("Look at my last 3 videos and tell me what I should improve."),
    { publicSearch: false, channelSnapshot: true, videoEvidence: true },
  );
  assert.equal(requestedConnectedVideoCount("Look at my last 3 videos and tell me what I should improve."), 3);
  assert.equal(requestedConnectedVideoCount("Review my recent videos."), 0);
});

test("recognizes a request for the latest connected upload", () => {
  const prompt = "Hey Stanley, please look at my last YouTube video and tell me what it was about.";
  assert.equal(requestsLatestConnectedVideo(prompt), true);
  assert.deepEqual(
    resolveResearchAccess(prompt),
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
