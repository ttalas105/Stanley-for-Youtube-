import assert from "node:assert/strict";
import test from "node:test";
import {
  buildThumbnailPrompt,
  generateThumbnailImage,
  selectThumbnailReferenceInputs,
} from "../app/api/generate-titles/thumbnail-image.mjs";

test("thumbnail prompt asks for one honest, legible 16:9 image", () => {
  const prompt = buildThumbnailPrompt({ brief: "A golf challenge with my dad" });
  assert.match(prompt, /one instantly legible focal idea/i);
  assert.match(prompt, /Exactly 16:9/i);
  assert.match(prompt, /Keep the visual claim honest/i);
  assert.match(prompt, /return only the completed thumbnail image/i);
  assert.doesNotMatch(prompt, /six.*concept/i);
});

test("thumbnail references include images but exclude video and file URI parts", () => {
  const result = selectThumbnailReferenceInputs([
    { inlineData: { mimeType: "image/jpeg", data: "image-data" } },
    { inlineData: { mimeType: "video/mp4", data: "video-data" } },
    { fileData: { fileUri: "https://youtube.com/watch?v=abc" } },
  ]);
  assert.deepEqual(result, [{ type: "image", mime_type: "image/jpeg", data: "image-data" }]);
});

test("thumbnail layer calls the image interaction with a 16:9 1K response", async () => {
  let requestBody;
  const imageData = "a".repeat(64);
  const result = await generateThumbnailImage({
    apiKey: "test-key",
    brief: "Make a bold thumbnail about restoring an old bike",
    mediaParts: [{ inlineData: { mimeType: "image/png", data: "source-image" } }],
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return new Response(JSON.stringify({ outputs: [{ type: "image", mime_type: "image/png", data: imageData }] }), { status: 200 });
    },
  });

  assert.equal(requestBody.model, "gemini-3.1-flash-image");
  assert.deepEqual(requestBody.response_format, { type: "image", mime_type: "image/jpeg", aspect_ratio: "16:9", image_size: "1K" });
  assert.equal(requestBody.input[1].type, "image");
  assert.equal(result.data, imageData);
  assert.equal(result.sourceUsed, true);
  assert.equal(result.width, 1376);
  assert.equal(result.height, 768);
});

test("thumbnail layer retries temporary image-model capacity errors", async () => {
  let attempts = 0;
  const imageData = "b".repeat(64);
  const result = await generateThumbnailImage({
    apiKey: "test-key",
    brief: "A thumbnail about a soccer superstition",
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) return new Response(JSON.stringify({ error: { message: "This model is currently experiencing high demand." } }), { status: 503 });
      return new Response(JSON.stringify({ outputs: [{ type: "image", mime_type: "image/jpeg", data: imageData }] }), { status: 200 });
    },
  });
  assert.equal(attempts, 2);
  assert.equal(result.data, imageData);
});

test("thumbnail layer does not retry a zero-quota billing error", async () => {
  let attempts = 0;
  await assert.rejects(
    generateThumbnailImage({
      apiKey: "test-key",
      brief: "A thumbnail about a soccer superstition",
      fetchImpl: async () => {
        attempts += 1;
        return new Response(JSON.stringify({ error: { message: "Free tier quota exceeded, limit: 0. Enable billing." } }), { status: 429 });
      },
    }),
    /Gemini image 429/,
  );
  assert.equal(attempts, 1);
});
