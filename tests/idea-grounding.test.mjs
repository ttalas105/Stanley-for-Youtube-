import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeChannelFit } from "../app/api/generate-titles/idea-grounding.mjs";

test("removes unsupported channel-history claims when no snapshot succeeded", () => {
  assert.equal(
    sanitizeChannelFit("Rudy is already the main subject of this channel."),
    "Brief fit: This stays centered on the subject and format the creator asked for in this chat.",
  );
  assert.equal(
    sanitizeChannelFit("This builds on the creator's previous videos about Rudy."),
    "Brief fit: This stays centered on the subject and format the creator asked for in this chat.",
  );
});

test("keeps brief-only fit and authenticated channel claims in their valid contexts", () => {
  assert.equal(sanitizeChannelFit("Brief fit: Rudy is the named subject in this request."), "Brief fit: Rudy is the named subject in this request.");
  assert.equal(sanitizeChannelFit("Rudy appears in three recent uploads.", true), "Rudy appears in three recent uploads.");
});
