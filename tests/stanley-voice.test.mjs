import assert from "node:assert/strict";
import test from "node:test";

import { STANLEY_VOICE, STANLEY_VOICE_VERSION } from "../app/api/generate-titles/stanley-voice.mjs";
import { algorithmStrategyForIntent } from "../app/api/generate-titles/youtube-strategy.mjs";

test("Stanley has an explicit conversational voice with examples and anti-slop rules", () => {
  assert.match(STANLEY_VOICE_VERSION, /^stanley-voice-/);
  assert.match(STANLEY_VOICE, /experienced YouTube creative director/i);
  assert.match(STANLEY_VOICE, /REFERENCE EXAMPLES/);
  assert.match(STANLEY_VOICE, /The weak spot is/);
  assert.match(STANLEY_VOICE, /Never open with canned approval/i);
  assert.match(STANLEY_VOICE, /I've structured this/i);
  assert.match(STANLEY_VOICE, /I've designed this/i);
  assert.match(STANLEY_VOICE, /Do not use em dashes/i);
  assert.match(STANLEY_VOICE, /Scripts should sound like the creator/i);
});

test("script strategy turns first-party YouTube guidance into an executable writing plan", () => {
  const strategy = algorithmStrategyForIntent("script_work");
  assert.match(strategy, /intended viewer/i);
  assert.match(strategy, /one-sentence promise/i);
  assert.match(strategy, /proof available on camera/i);
  assert.match(strategy, /first 30 seconds/i);
  assert.match(strategy, /causal progression/i);
  assert.match(strategy, /Every beat must change/i);
  assert.match(strategy, /abstract claims/i);
  assert.match(strategy, /motivation, mood, baseline/i);
  assert.match(strategy, /creator-script cliches/i);
  assert.match(strategy, /Shorts/i);
  assert.match(strategy, /thanks for watching/i);
  assert.match(strategy, /satisfies the viewer/i);
});
