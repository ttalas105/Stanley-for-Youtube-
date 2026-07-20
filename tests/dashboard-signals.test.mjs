import assert from "node:assert/strict";
import test from "node:test";

import { findDiscoveryGrowth } from "../app/dashboard-signals.mjs";

test("finds the meaningful traffic source with the largest share gain", () => {
  const result = findDiscoveryGrowth(
    [{ source: "SEARCH", views: 40 }, { source: "SUGGESTED", views: 35 }, { source: "OTHER", views: 25 }],
    [{ source: "SEARCH", views: 55 }, { source: "SUGGESTED", views: 20 }, { source: "OTHER", views: 25 }],
  );

  assert.equal(result?.source.source, "SUGGESTED");
  assert.equal(Math.round(result?.shareChange || 0), 15);
});

test("ignores tiny current sources and handles missing comparison traffic", () => {
  const filtered = findDiscoveryGrowth(
    [{ source: "SEARCH", views: 96 }, { source: "TINY", views: 4 }],
    [{ source: "SEARCH", views: 100 }],
  );

  assert.equal(filtered?.source.source, "SEARCH");
  assert.equal(findDiscoveryGrowth([{ source: "SEARCH", views: 100 }], []), null);
});
