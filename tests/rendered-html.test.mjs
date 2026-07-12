import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Stanley title lab", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Stanley — YouTube Title Lab<\/title>/i);
  assert.match(html, /Find the title/);
  assert.match(html, /Generate 12 titles/);
  assert.match(html, /Gemini 3\.1 Flash-Lite/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("keeps AI keys server-side and removes the disposable starter", async () => {
  const [page, route, gitignore] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/api/generate-titles/route.ts", root), "utf8"),
    readFile(new URL(".gitignore", root), "utf8"),
  ]);

  assert.match(page, /fetch\("\/api\/generate-titles"/);
  assert.doesNotMatch(page, /GEMINI_API_KEY|YOUTUBE_API_KEY/);
  assert.match(route, /process\.env\.GEMINI_API_KEY/);
  assert.match(route, /process\.env\.YOUTUBE_API_KEY/);
  assert.match(route, /youtube\/v3\/search/);
  assert.match(gitignore, /\.env\*/);
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
});
