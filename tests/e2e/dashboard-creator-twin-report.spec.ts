import { expect, test } from "@playwright/test";
import { waitForApp } from "./fixtures";

const profile = {
  id: "UCwill-test",
  title: "Will Tennyson (API Preview)",
  thumbnailUrl: "/stanley-mascot-transparent.png",
  subscriberCount: 3_420_000,
  videoCount: 487,
  totalViews: 812_000_000,
  analyzedAt: "2026-07-19T12:00:00.000Z",
};

const videos = Array.from({ length: 5 }, (_, index) => ({
  id: `will-${index + 1}`,
  title: ["I Trained Like an Olympian for 30 Days", "The Hardest Fitness Test I Have Ever Tried", "I Ate Like a Bodybuilder for a Week", "Can Science Build the Perfect Workout?", "I Tried the World's Most Intense Gym"][index],
  thumbnailUrl: "/stanley-mascot-transparent.png",
  publishedAt: `2026-07-${String(16 - index * 3).padStart(2, "0")}T12:00:00.000Z`,
  views: 2_800_000 - index * 310_000,
  duration: "PT18M",
  privacyStatus: "public",
  url: `https://www.youtube.com/watch?v=will-${index + 1}`,
}));

const twin = {
  generatedAt: "2026-07-19T12:00:00.000Z",
  cached: false,
  creator: { id: "UCtwin", name: "Jesse James West", avatarUrl: "/stanley-mascot-transparent.png", similarity: 89, primaryNiche: "Fitness · Challenges", averageViews: 1_940_000, recentMomentum: "1.3× view pace", outlierFrequency: "2 in 5 uploads", channelUrl: "https://www.youtube.com/@JesseJamesWest" },
  whyMatched: ["Both channels use high-stakes fitness challenges", "Similar transformation-led title structure"],
  differences: [],
  insights: [{ what: "Raise the visible stakes earlier", why: "The strongest videos make the constraint instantly clear.", adapt: "Open on the hardest moment, then reveal the rules." }],
  topVideos: videos.slice(0, 4).map((video, index) => ({ ...video, id: `twin-${index}`, views: 4_600_000 - index * 720_000, outlierScore: 2.4 - index * .2 })),
  links: [{ platform: "youtube", label: "Jesse James West", url: "https://www.youtube.com/@JesseJamesWest" }],
  inspirationContext: { titlePattern: "Visible challenge plus a measurable constraint", thumbnailPattern: "One subject and one physical stake", storyStructure: "Cold open, rules, escalating attempts, payoff", publishingRhythm: "Weekly", contentFramework: "Original fitness challenge" },
};

test("keeps the Creator Twin report visible and exposes video creation actions", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("stanley-onboarding-v1", "skipped"));
  await page.route("**/api/youtube/status", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: true, connected: true, profile }) }));
  await page.route("**/api/youtube/videos", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ videos }) }));
  await page.route("**/api/youtube/analytics?**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    channel: { handle: "@WillTennyson" }, period: { startDate: "2026-06-20", endDate: "2026-07-19", days: 30 }, comparisonPeriod: { startDate: "2026-05-21", endDate: "2026-06-19", days: 30 },
    current: { views: 8_200_000, watchMinutes: 2_460_000, subscribersGained: 42_000, subscribersLost: 3_200, averageViewDuration: 760, averageViewPercentage: 54 }, comparison: { views: 7_100_000, watchMinutes: 2_100_000, subscribersGained: 35_000, subscribersLost: 3_000, averageViewDuration: 720, averageViewPercentage: 51 },
    timeline: Array.from({ length: 8 }, (_, index) => ({ date: `2026-07-${String(5 + index * 2).padStart(2, "0")}`, views: 760_000 + index * 51_000, watchMinutes: 220_000 + index * 13_000, netSubscribers: 3_100 + index * 160 })),
    comparisonTimeline: Array.from({ length: 8 }, (_, index) => ({ date: `2026-06-${String(5 + index * 2).padStart(2, "0")}`, views: 650_000 + index * 33_000, watchMinutes: 188_000 + index * 9_000, netSubscribers: 2_450 + index * 110 })),
    videos: videos.map((video, index) => ({
      id: video.id,
      views: video.views,
      watchMinutes: 410_000 - index * 30_000,
      averageViewDuration: 760 - index * 25,
      averageViewPercentage: 57 - index * 2,
      netSubscribers: 8_400 - index * 900,
      likes: 164_000 - index * 19_000,
      comments: 7_800 - index * 720,
      shares: 4_100 - index * 430,
      commentRate: .28 - index * .02,
      interactionRate: 6.3 - index * .45,
    })),
    traffic: [{ source: "YT_SEARCH", views: 2_900_000, watchMinutes: 800_000 }, { source: "RELATED_VIDEO", views: 2_400_000, watchMinutes: 710_000 }, { source: "BROWSE", views: 1_900_000, watchMinutes: 590_000 }], updatedAt: "2026-07-19T12:00:00.000Z",
  }) }));
  await page.route("**/api/youtube/creator-twin**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(twin) }));

  await page.goto("/");
  await waitForApp(page);
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Will Tennyson" })).toBeVisible();
  await expect(page.getByText(/API Preview/i)).toHaveCount(0);
  await expect(page.getByText("Live API")).toHaveCount(0);
  await expect(page.getByText("Channel dashboard")).toHaveCount(0);
  await expect(page.getByText("6 creators")).toBeVisible();
  await expect(page.getByRole("button", { name: "Make a video" }).first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "Performance", exact: true })).toHaveAttribute("aria-selected", "true");
  const topVideos = page.getByRole("region", { name: "Top videos" });
  await expect(topVideos.getByText(/× outlier/).first()).toBeVisible();
  await expect(topVideos.getByText("Total views", { exact: true }).first()).toBeVisible();
  await expect(topVideos.getByText("Subscribers", { exact: true }).first()).toBeVisible();
  await expect(topVideos.getByText("Likes", { exact: true }).first()).toBeVisible();
  await expect(topVideos.getByText("Comment rate", { exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Period analytics", exact: true }).click();
  await expect(page.getByRole("region", { name: "Views, current 30 days compared with previous 30 days" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Net subscribers, current 30 days compared with previous 30 days" })).toBeVisible();
  await page.getByRole("tab", { name: "Performance", exact: true }).click();
  const dashboardFont = await page.locator("body").evaluate((element) => getComputedStyle(element).fontFamily);
  await expect(page.getByRole("heading", { name: "Top videos" })).toHaveCSS("font-family", dashboardFont);
  await page.screenshot({ path: testInfo.outputPath("dashboard-report.png"), fullPage: true });
  await page.getByRole("heading", { name: "Top videos" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("top-videos-actions.png") });

  await page.getByRole("button", { name: "Start Creator Twin scan" }).click();
  await page.waitForTimeout(260);
  await expect(page.getByRole("status", { name: "Finding your Creator Twin" })).toBeVisible();
  const scanProgress = page.getByRole("progressbar", { name: "Creator Twin scan progress" });
  await expect(scanProgress).toBeVisible();
  const initialScanProgress = Number(await scanProgress.getAttribute("aria-valuenow"));
  await expect.poll(async () => Number(await scanProgress.getAttribute("aria-valuenow"))).toBeGreaterThan(initialScanProgress);
  await expect(page.getByText("Exploring your creator universe", { exact: true })).toHaveCount(0);
  await expect(page.getByText("6 in range", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("scan-radar-entrance.png") });
  await expect(page.getByRole("heading", { name: "Jesse James West" })).toBeVisible({ timeout: 7_000 });
  await expect(page.getByText("Jesse James West", { exact: true })).toHaveCount(1);
  await expect(page.getByText("89%")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Videos carrying the pattern" })).toBeVisible();
  await expect(page.getByText("Title", { exact: true })).toBeVisible();
  await expect(page.getByText("Story", { exact: true })).toBeVisible();
  await expect(page.getByText("Rhythm", { exact: true })).toBeVisible();
  await expect(page.getByAltText("Jesse James West channel avatar")).toHaveCSS("width", "84px");
  await page.waitForTimeout(950);
  const standoutWidths = await page.locator("[class*=twinGraphRow] > i > b").evaluateAll((bars) => bars.map((bar) => bar.getBoundingClientRect().width));
  expect(new Set(standoutWidths.map((width) => Math.round(width))).size).toBeGreaterThan(1);
  await page.screenshot({ path: testInfo.outputPath("creator-twin-report.png"), fullPage: true });

  await page.locator("[data-dashboard-ledger-row]").last().getByRole("button", { name: "Make a video" }).click();
  await expect(page.getByLabel("Message Stanley")).toHaveValue(/World's Most Intense Gym/);
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Jesse James West" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("heading", { name: "Jesse James West" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("creator-twin-mobile.png") });
});
