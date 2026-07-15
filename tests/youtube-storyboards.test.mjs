import assert from "node:assert/strict";
import test from "node:test";

import { storyboardSheetUrls } from "../app/api/generate-titles/youtube-storyboards.mjs";

const SPEC = "https://i.ytimg.com/sb/video123/storyboard3_L$L/$N.jpg?sqp=token|48#27#100#10#10#0#default#rs$small|80#45#115#10#10#1000#M$M#rs$medium|160#90#115#5#5#1000#M$M#rs$large|320#180#115#3#3#1000#M$M#rs$largest";

test("builds evenly distributed storyboard sheets at a model-readable resolution", () => {
  const urls = storyboardSheetUrls(SPEC);
  assert.equal(urls.length, 6);
  assert.match(urls[0], /storyboard3_L3\/M0\.jpg/);
  assert.match(urls.at(-1), /storyboard3_L3\/M12\.jpg/);
  assert.match(urls[0], /sigh=rs%24largest/);
});

test("rejects storyboard templates outside YouTube's image host", () => {
  assert.deepEqual(storyboardSheetUrls(SPEC.replace("https://i.ytimg.com", "https://example.com")), []);
});
