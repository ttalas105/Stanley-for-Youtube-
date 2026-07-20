import { expect, test } from "@playwright/test";
import { buildPayload, waitForApp } from "./fixtures";

const connectedProfile = {
  id: "UCstanley-test",
  title: "Thomas Creates",
  thumbnailUrl: "",
  subscriberCount: 12400,
  videoCount: 86,
  totalViews: 2200000,
  analyzedAt: "2026-07-20T12:00:00.000Z",
};

const willProfile = {
  id: "UCB2wtYpfbCpYDc5TeTwuqFA",
  title: "Will Tennyson",
  thumbnailUrl: "",
  subscriberCount: 5140000,
  videoCount: 660,
  totalViews: 1410238386,
  analyzedAt: "2026-07-20T12:00:00.000Z",
};

const willVideos = [
  { id: "will-1", title: "I Tried The World's Hardest Fitness Test", thumbnailUrl: "", publishedAt: "2026-07-18T12:00:00.000Z", views: 2800000, duration: "PT18M", privacyStatus: "public", url: "https://youtube.com/watch?v=will-1" },
  { id: "will-2", title: "Eating Like A Pro Bodybuilder For 24 Hours", thumbnailUrl: "", publishedAt: "2026-07-11T12:00:00.000Z", views: 1900000, duration: "PT22M", privacyStatus: "public", url: "https://youtube.com/watch?v=will-2" },
  { id: "will-3", title: "I Trained With The Strongest Man", thumbnailUrl: "", publishedAt: "2026-07-04T12:00:00.000Z", views: 1200000, duration: "PT16M", privacyStatus: "public", url: "https://youtube.com/watch?v=will-3" },
];

const demoAnalytics = {
  channel: { handle: "@WillTennyson" },
  period: { startDate: "2026-06-20", endDate: "2026-07-19", days: 30 },
  comparisonPeriod: { startDate: "2026-05-21", endDate: "2026-06-19", days: 30 },
  current: { views: 9200000, watchMinutes: 82000000, subscribersGained: 22000, subscribersLost: 2200, averageViewDuration: 535, averageViewPercentage: 49.4 },
  comparison: { views: 8200000, watchMinutes: 71000000, subscribersGained: 19000, subscribersLost: 2100, averageViewDuration: 520, averageViewPercentage: 47.8 },
  timeline: [
    { date: "2026-07-17", views: 290000, watchMinutes: 2600000, netSubscribers: 620 },
    { date: "2026-07-18", views: 340000, watchMinutes: 3100000, netSubscribers: 740 },
    { date: "2026-07-19", views: 410000, watchMinutes: 3700000, netSubscribers: 860 },
  ],
  comparisonTimeline: [
    { date: "2026-06-17", views: 260000, watchMinutes: 2200000, netSubscribers: 560 },
    { date: "2026-06-18", views: 300000, watchMinutes: 2600000, netSubscribers: 620 },
    { date: "2026-06-19", views: 350000, watchMinutes: 2900000, netSubscribers: 700 },
  ],
  videos: willVideos.map((video, index) => ({
    id: video.id,
    views: [2400000, 1600000, 900000][index],
    watchMinutes: [21000000, 14000000, 7800000][index],
    averageViewDuration: [540, 525, 510][index],
    averageViewPercentage: [52, 49, 47][index],
    netSubscribers: [6100, 3900, 2100][index],
    likes: [120000, 76000, 41000][index],
    comments: [6200, 4100, 2200][index],
    shares: [9000, 5700, 3100][index],
    commentRate: [.26, .26, .24][index],
    interactionRate: [5.6, 5.4, 5.1][index],
  })),
  traffic: [
    { source: "RELATED_VIDEO", views: 3600000, watchMinutes: 32000000 },
    { source: "SUBSCRIBER", views: 2100000, watchMinutes: 19000000 },
    { source: "YT_SEARCH", views: 1400000, watchMinutes: 12000000 },
  ],
  comparisonTraffic: [
    { source: "RELATED_VIDEO", views: 3000000, watchMinutes: 27000000 },
    { source: "SUBSCRIBER", views: 2000000, watchMinutes: 17000000 },
    { source: "YT_SEARCH", views: 1300000, watchMinutes: 11000000 },
  ],
  updatedAt: "2026-07-20T12:00:00.000Z",
  demo: true,
};

test("switches into the Will Tennyson demo workspace and sends that creator context", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("stanley-onboarding-v1", "skipped"));
  await page.route("**/api/youtube/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ configured: true, connected: true, profile: connectedProfile }),
  }));
  await page.route("**/api/youtube/demo-profile?**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ profile: willProfile }),
  }));
  await page.route("**/api/youtube/demo-videos?**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ videos: willVideos }),
  }));
  await page.route("**/api/youtube/demo-analytics?**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(demoAnalytics),
  }));
  await page.route("**/api/youtube/videos", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ videos: [] }),
  }));
  await page.route("**/api/youtube/analytics?**", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "Private analytics are unavailable in this test." }),
  }));

  let submitted: { creatorProfile?: string } | undefined;
  await page.route("**/api/generate-titles", async (route) => {
    submitted = route.request().postDataJSON() as { creatorProfile?: string };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildPayload()) });
  });

  await page.goto("/chat");
  await waitForApp(page);

  const switcher = page.getByRole("button", { name: /Switch creator profile/ });
  await expect(switcher).toContainText("Thomas Creates");
  await switcher.click();
  await expect(page.getByRole("menu", { name: "Switch creator profile" })).toBeVisible();
  await page.getByRole("menuitemradio", { name: /Will Tennyson/ }).click();

  await expect(switcher).toContainText("Will Tennyson");
  await expect(switcher).toContainText("Public demo");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("stanley-creator-profile"))).toBe("will-tennyson");

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(switcher).toContainText("Will Tennyson");
  await expect(page.getByRole("heading", { name: "Will Tennyson" })).toBeVisible();
  await expect(page.locator("[data-dashboard-channel-header]")).toContainText("5.1M");
  await expect(page.locator("[data-dashboard-channel-header]")).toContainText("1.4B");
  await expect(page.getByText("Demo analytics", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Performance over time" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top videos" })).toBeVisible();

  await page.reload();
  await waitForApp(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("button", { name: /Switch creator profile/ })).toContainText("Will Tennyson");

  await page.getByRole("link", { name: "New chat" }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole("button", { name: /Switch creator profile/ })).toContainText("Will Tennyson");

  await page.getByLabel("Message Stanley").fill("Give me one strong idea for my next upload");
  await page.getByLabel("Message Stanley").press("Enter");
  await expect.poll(() => submitted?.creatorProfile).toBe("will-tennyson");
});
