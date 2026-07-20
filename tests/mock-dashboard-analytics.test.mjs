import assert from "node:assert/strict";
import test from "node:test";
import {
  MOCK_AVERAGE_VIEW_MINUTES,
  MOCK_COMPARISON_CHANGES,
  MOCK_SUBSCRIBERS_PER_THOUSAND,
  mockAnalyticsTotals,
  normalizedMockTimeline,
} from "../.temporary-youtube-channel/mock-analytics.mjs";

const ranges = [7, 30, 90, 180, 365];

function sum(timeline, metric) {
  return timeline.reduce((total, point) => total + point[metric], 0);
}

function shape(timeline, metric) {
  const total = sum(timeline, metric);
  return timeline.map((point) => Math.round(point[metric] / Math.max(1, total) * 10_000));
}

test("mock dashboard analytics honors each range target and exact timeline totals", () => {
  for (const range of ranges) {
    const totals = mockAnalyticsTotals(2_750_000 + range * 19_000, range);
    const current = normalizedMockTimeline(totals.current, range, false, new Date("2026-07-20T12:00:00Z"));
    const comparison = normalizedMockTimeline(totals.comparison, range, true, new Date("2026-07-20T12:00:00Z"));

    for (const metric of ["views", "watchMinutes", "netSubscribers"]) {
      assert.equal(sum(current, metric), totals.current[metric], `${range}D current ${metric}`);
      assert.equal(sum(comparison, metric), totals.comparison[metric], `${range}D comparison ${metric}`);
    }

    assert.equal(totals.current.watchMinutes, Math.round(totals.current.views * MOCK_AVERAGE_VIEW_MINUTES[range]));
    assert.equal(totals.current.netSubscribers, Math.round(totals.current.views * MOCK_SUBSCRIBERS_PER_THOUSAND[range] / 1_000));

    const changes = MOCK_COMPARISON_CHANGES[range];
    for (const metric of ["views", "watchMinutes", "netSubscribers"]) {
      const actualChange = totals.current[metric] / totals.comparison[metric] - 1;
      assert.ok(Math.abs(actualChange - changes[metric]) < .001, `${range}D ${metric} comparison change`);
    }

    assert.notDeepEqual(shape(current, "views"), shape(current, "watchMinutes"), `${range}D views and watch time curves differ`);
    assert.notDeepEqual(shape(current, "views"), shape(current, "netSubscribers"), `${range}D views and subscriber curves differ`);
    assert.notDeepEqual(shape(current, "watchMinutes"), shape(current, "netSubscribers"), `${range}D watch time and subscriber curves differ`);
  }
});

test("mock dashboard timelines are deterministic", () => {
  const now = new Date("2026-07-20T12:00:00Z");
  const totals = mockAnalyticsTotals(4_200_000, 30);
  assert.deepEqual(
    normalizedMockTimeline(totals.current, 30, false, now),
    normalizedMockTimeline(totals.current, 30, false, now),
  );
});
