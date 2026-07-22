import { expect, test } from "@playwright/test";
import { waitForApp } from "./fixtures";

const profile = {
  id: "UCstanley-test",
  title: "Thomas Creates",
  thumbnailUrl: "https://i.ytimg.com/vi/own-1/mqdefault.jpg",
  subscriberCount: 12400,
  videoCount: 86,
  totalViews: 2200000,
  analyzedAt: "2026-07-12T12:00:00.000Z",
};

const video = {
  id: "own-1",
  title: "I Tested One Habit for 30 Days",
  thumbnailUrl: "https://i.ytimg.com/vi/own-1/mqdefault.jpg",
  publishedAt: "2026-07-10T12:00:00.000Z",
  views: 84000,
  duration: "PT12M",
  privacyStatus: "public",
  url: "https://www.youtube.com/watch?v=own-1",
};

const twin = {
  generatedAt: "2026-07-16T12:00:00.000Z",
  cached: false,
  creator: {
    id: "UCfuture",
    name: "Future Creator",
    avatarUrl: "https://i.ytimg.com/vi/twin-1/mqdefault.jpg",
    similarity: 87,
    primaryNiche: "Habits · Experiments",
    averageViews: 214000,
    recentMomentum: "2.4× your view pace",
    outlierFrequency: "33% of sampled uploads",
    channelUrl: "https://www.youtube.com/@futurecreator",
  },
  whyMatched: ["42% overlap across recurring title topics", "88% similar title structure", "Upload cadence is within 2 days"],
  differences: [
    { category: "Performance", detail: "Average views per sampled upload", twin: "2.4× your average", you: "84K views" },
    { category: "Uploads", detail: "Publishes more often", twin: "Every 7 days", you: "Every 11 days" },
  ],
  insights: [
    { what: "Future Creator averages 214K views per sampled upload.", why: "That is 2.4× your recent public-video average.", adapt: "Test one original idea in the shared habits topic cluster." },
    { what: "Their clearest pattern is number-led titles.", why: "It appears in 60% of the measured sample.", adapt: "Apply that structure without reusing their subject or wording." },
    { what: "Their sample cadence is every 7 days.", why: "That is 4 days faster than yours.", adapt: "Test that rhythm for three uploads, then compare views per day." },
  ],
  topVideos: [{
    id: "twin-1",
    title: "I Tried the 5AM Habit for 30 Days",
    thumbnailUrl: "https://i.ytimg.com/vi/twin-1/mqdefault.jpg",
    views: 620000,
    outlierScore: 2.9,
    publishedAt: "2026-06-20T12:00:00.000Z",
    duration: "PT14M",
    url: "https://www.youtube.com/watch?v=twin-1",
  }],
  links: [
    { platform: "instagram", label: "@futurecreator", url: "https://instagram.com/futurecreator" },
    { platform: "x", label: "@futurecreator", url: "https://x.com/futurecreator" },
    { platform: "youtube", label: "@futurecreator", url: "https://www.youtube.com/@futurecreator" },
  ],
  inspirationContext: {
    titlePattern: "number-led titles (60% of the sample)",
    thumbnailPattern: "Use top thumbnails only as visual references",
    storyStructure: "60% transformation-led titles in the sample",
    publishingRhythm: "Approximately every 7 days",
    contentFramework: "Original videos around habits and experiments",
  },
};

test("expands Creator Twin, restores the dashboard, and reuses Create", async ({ page }) => {
  const analyticsRanges: string[] = [];
  await page.addInitScript(() => localStorage.setItem("stanley-onboarding-v1", "complete"));
  await page.route("**/api/youtube/status", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: true, connected: true, profile }) }));
  await page.route("**/api/youtube/videos", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ videos: [video] }) }));
  await page.route("**/api/youtube/analytics?**", async (route) => {
    const requestedRange = new URL(route.request().url()).searchParams.get("range") || "";
    analyticsRanges.push(requestedRange);
    if (analyticsRanges.length > 1) await new Promise((resolve) => setTimeout(resolve, 250));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      channel: { handle: "@thomascreates" },
      period: { startDate: "2026-06-19", endDate: "2026-07-16", days: 28 },
      comparisonPeriod: null,
      current: { views: requestedRange === "180" ? 168000 : 84000, watchMinutes: 180000, subscribersGained: 420, subscribersLost: 60, averageViewDuration: 360, averageViewPercentage: 48 },
      comparison: null,
      timeline: [], comparisonTimeline: [], videos: [], traffic: [], updatedAt: "2026-07-16T12:00:00.000Z",
    }) });
  });
  await page.route("**/api/youtube/creator-twin", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(twin) }));

  await page.goto("/");
  await waitForApp(page);
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();

  await expect(page.getByRole("button", { name: "30D" })).toHaveAttribute("aria-pressed", "true");
  const viewsMetric = page.locator('[data-dashboard-signal-metric="views"] > strong');
  await expect(viewsMetric).toHaveText("84K");
  await page.getByRole("button", { name: "6M" }).click();
  await expect(page.getByRole("button", { name: "6M" })).toHaveAttribute("aria-pressed", "true");
  await expect(viewsMetric).toHaveText("84K");
  await expect.poll(() => analyticsRanges.at(-1)).toBe("180");
  await expect(viewsMetric).toHaveText("168K");
  await expect(page.getByRole("heading", { name: "Top videos" })).toBeVisible();
  const analyticsRequestsBeforeTwin = analyticsRanges.length;
  await page.getByRole("link", { name: "Creator Twin", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Find your creative twin." })).toBeVisible();
  await page.getByRole("button", { name: "Find my Creator Twin" }).click();
  await expect(page.getByRole("heading", { name: "Future Creator", exact: true })).toBeVisible({ timeout: 7_000 });
  await expect(page.getByLabel("87% pattern match")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why Stanley chose Future Creator" })).toBeVisible();
  await expect(page.locator('a[href="https://instagram.com/futurecreator"]')).toHaveAttribute("target", "_blank");
  await expect(page.locator('a[href="https://x.com/futurecreator"]')).toHaveAttribute("target", "_blank");
  await page.getByRole("tab", { name: "Key differences" }).click();
  await expect(page.getByRole("table", { name: "Differences between Future Creator and your channel" })).toBeVisible();
  await page.getByRole("tab", { name: "Top videos (1)" }).click();
  await expect(page.getByRole("button", { name: "Study video" })).toBeVisible();
  await page.getByRole("button", { name: "Build from this pattern" }).click();

  await expect(page.getByLabel("Message Stanley")).toHaveValue(/Title pattern: number-led titles/);
  await expect(page.getByText("I Tried the 5AM Habit for 30 Days")).toBeVisible();

  await page.getByRole("link", { name: "Creator Twin", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Future Creator", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Find a fresh match" })).toBeVisible();
  await expect.poll(() => analyticsRanges.length).toBe(analyticsRequestsBeforeTwin);
});
