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
  const twinRequestUrls: string[] = [];
  let rejectNextTwin = false;
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
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
    traffic: [{ source: "YT_SEARCH", views: 2_900_000, watchMinutes: 800_000 }, { source: "RELATED_VIDEO", views: 2_400_000, watchMinutes: 710_000 }, { source: "BROWSE", views: 1_900_000, watchMinutes: 590_000 }],
    comparisonTraffic: [{ source: "YT_SEARCH", views: 3_600_000, watchMinutes: 940_000 }, { source: "RELATED_VIDEO", views: 1_500_000, watchMinutes: 430_000 }, { source: "BROWSE", views: 2_100_000, watchMinutes: 620_000 }],
    updatedAt: "2026-07-19T12:00:00.000Z",
  }) }));
  await page.route("**/api/youtube/creator-twin**", (route) => {
    twinRequestUrls.push(route.request().url());
    if (rejectNextTwin) {
      rejectNextTwin = false;
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Twin service is temporarily unavailable." }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(twin) });
  });

  await page.goto("/");
  await waitForApp(page);
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Will Tennyson" })).toBeVisible();
  await expect(page.getByText(/API Preview/i)).toHaveCount(0);
  await expect(page.getByText("Live API")).toHaveCount(0);
  await expect(page.getByText("Channel dashboard")).toHaveCount(0);
  const channelHeader = page.getByRole("heading", { name: "Will Tennyson" }).locator("xpath=ancestor::header");
  const dashboardToolbar = page.getByRole("group", { name: "Dashboard period" }).locator("..");
  await expect(channelHeader.getByRole("img").first()).toHaveCSS("width", "120px");
  await expect(channelHeader.getByText("Subscribers", { exact: true })).toBeVisible();
  await expect(channelHeader.getByText("Videos", { exact: true })).toBeVisible();
  await expect(channelHeader.getByRole("group", { name: "Dashboard period" })).toHaveCount(0);
  await expect(dashboardToolbar.getByRole("group", { name: "Dashboard period" })).toBeVisible();
  await expect(dashboardToolbar.getByText("Updated Jul 19, 2026", { exact: true })).toBeVisible();
  await expect(dashboardToolbar.getByRole("button", { name: "Refresh dashboard" })).toBeVisible();
  await expect(page.getByText("Topics", { exact: true })).toBeVisible();
  await expect(page.getByText("Format", { exact: true })).toBeVisible();
  await expect(page.getByText("Momentum", { exact: true })).toBeVisible();
  await expect(page.getByText("View match", { exact: true })).toHaveCount(0);
  const twinScanAction = page.getByRole("button", { name: "Scan for my Creator Twin" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(twinScanAction.locator("img")).toHaveCSS("animation-name", "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const actionSignals = page.getByRole("complementary", { name: "Signals worth acting on" });
  await expect(actionSignals.locator(":scope > div > button")).toHaveCount(3);
  await expect(actionSignals.getByText("Suggested videos is gaining ground", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Make a video" }).first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "Performance", exact: true })).toHaveAttribute("aria-selected", "true");
  const topVideos = page.getByRole("region", { name: "Top videos" });
  const performanceTimeline = page.getByRole("region", { name: "Performance over time" });
  await expect(performanceTimeline.locator("svg text")).toHaveCount(0);
  await expect(performanceTimeline.locator("[data-chart-y-label]")).toHaveCount(3);
  await expect(performanceTimeline.locator("[data-chart-date-label]")).toHaveCount(3);
  const chartLabelStretch = await performanceTimeline.locator("[data-chart-y-label]").first().evaluate((element) => getComputedStyle(element).fontStretch);
  expect(["normal", "100%"].includes(chartLabelStretch)).toBe(true);
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
  const headingSizes = await page.locator("#performance-timeline-heading, #video-ledger-heading").evaluateAll((headings) => headings.map((heading) => Number.parseFloat(getComputedStyle(heading).fontSize)));
  expect(headingSizes[1]).toBeGreaterThan(headingSizes[0]);
  const firstTopVideoMetric = topVideos.locator("dd").first();
  await expect(firstTopVideoMetric).toHaveCSS("font-size", "11.84px");
  await expect(firstTopVideoMetric).toHaveCSS("font-weight", "600");
  await page.screenshot({ path: testInfo.outputPath("dashboard-report.png"), fullPage: true });
  await page.getByRole("heading", { name: "Top videos" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("top-videos-actions.png") });

  const overviewBriefHeight = await page.getByRole("region", { name: "What moved this period" }).evaluate((element) => element.getBoundingClientRect().height);
  await twinScanAction.click();
  await page.waitForTimeout(260);
  await expect(page.getByRole("status", { name: "Finding your Creator Twin" })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "What moved this period" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Where views came from" })).toBeVisible();
  const scanProgress = page.getByRole("progressbar", { name: "Creator Twin scan progress" });
  await expect(scanProgress).toBeVisible();
  await expect(scanProgress.locator("output")).toHaveCount(0);
  await expect(page.locator("[data-rail-pattern]")).toHaveCount(3);
  await expect(page.locator("[data-rail-signal]")).toHaveCount(3);
  const topicsSignal = page.locator('[data-rail-pattern="topics"]');
  const formatSignal = page.locator('[data-rail-pattern="format"]');
  const momentumSignal = page.locator('[data-rail-pattern="momentum"]');
  await expect(topicsSignal).toHaveAttribute("data-active", "");
  await expect(formatSignal).not.toHaveAttribute("data-active", "");
  const initialScanProgress = Number(await scanProgress.getAttribute("aria-valuenow"));
  await expect.poll(async () => Number(await scanProgress.getAttribute("aria-valuenow"))).toBeGreaterThan(initialScanProgress);
  await expect(formatSignal).toHaveAttribute("data-active", "");
  await expect(momentumSignal).toHaveAttribute("data-active", "");
  await expect(page.locator("[data-complete]")).toHaveCount(1);
  await expect(page.getByText("Exploring your creator universe", { exact: true })).toHaveCount(0);
  await expect(page.getByText("6 in range", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("scan-inline-rail.png") });
  const foundRail = page.locator('button[data-state="found"]');
  await expect(foundRail).toBeVisible({ timeout: 7_000 });
  await expect(foundRail.getByText("Creator found", { exact: true })).toBeVisible();
  await expect(foundRail.getByText("Jesse James West", { exact: true })).toHaveCount(0);
  await expect(foundRail.locator("img")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Jesse James West" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("twin-found-inline-rail.png") });
  await expect(page.getByRole("heading", { name: "Jesse James West" })).toBeVisible({ timeout: 7_000 });
  await expect(page.locator("[class*=creatorTwinRevealing]")).toBeVisible();
  await expect(page.getByText("Jesse James West", { exact: true })).toHaveCount(1);
  await expect(page.getByText("89%")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What is working for them" })).toBeVisible();
  await expect(page.getByText("Title", { exact: true })).toBeVisible();
  await expect(page.getByText("Story", { exact: true })).toBeVisible();
  await expect(page.getByText("Rhythm", { exact: true })).toBeVisible();
  await expect(page.getByAltText("Jesse James West channel avatar")).toHaveCSS("width", "62px");
  await expect(page.locator("[data-twin-reference-thumbnail]")).toHaveCount(4);
  const loadedTwinHeight = await page.getByRole("region", { name: "Jesse James West" }).evaluate((element) => element.getBoundingClientRect().height);
  expect(loadedTwinHeight).toBeGreaterThanOrEqual(overviewBriefHeight - 2);
  await page.waitForTimeout(950);
  const standoutWidths = await page.locator("[class*=twinGraphRow] > i > b").evaluateAll((bars) => bars.map((bar) => bar.getBoundingClientRect().width));
  expect(new Set(standoutWidths.map((width) => Math.round(width))).size).toBeGreaterThan(1);
  await page.screenshot({ path: testInfo.outputPath("creator-twin-report.png"), fullPage: true });

  await page.getByRole("button", { name: "Back to period overview" }).click();
  await expect(page.getByRole("heading", { name: "What moved this period" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jesse James West" })).toHaveCount(0);
  await expect(page.getByText("View match", { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(channelHeader.getByRole("img").first()).toHaveCSS("width", "86px");
  await expect(channelHeader.getByText("Subscribers", { exact: true })).toBeVisible();
  await expect(channelHeader.getByText("Videos", { exact: true })).toBeVisible();
  await expect(dashboardToolbar.getByRole("group", { name: "Dashboard period" })).toBeVisible();
  await expect(dashboardToolbar.getByRole("button", { name: "Refresh dashboard" })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Scan for my Creator Twin" }).click();
  await expect(page.getByRole("status", { name: "Finding your Creator Twin" })).toHaveCount(1);
  await expect(page.locator("[data-rail-signal]").first()).toHaveCSS("animation-name", "none");
  await expect(page.getByRole("heading", { name: "Where views came from" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("scan-inline-rail-mobile.png") });
  await expect(page.getByRole("heading", { name: "Jesse James West" })).toBeVisible({ timeout: 7_000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(twinRequestUrls).toHaveLength(2);
  expect(twinRequestUrls[1]).not.toContain("refresh=true");

  await page.getByRole("button", { name: "Scan again" }).click();
  await expect(page.getByRole("status", { name: "Finding your Creator Twin" })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Where views came from" })).toBeVisible();
  await expect.poll(() => twinRequestUrls.length).toBe(3);
  expect(twinRequestUrls[2]).toContain("refresh=true");
  await expect(page.getByRole("heading", { name: "Jesse James West" })).toBeVisible({ timeout: 7_000 });

  await page.locator("[data-dashboard-ledger-row]").last().getByRole("button", { name: "Make a video" }).click();
  await expect(page.getByLabel("Message Stanley")).toHaveValue(/World's Most Intense Gym/);
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Jesse James West" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("heading", { name: "Jesse James West" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("creator-twin-mobile.png") });

  await page.getByRole("button", { name: "Back to period overview" }).click();
  rejectNextTwin = true;
  await page.getByRole("button", { name: "Scan for my Creator Twin" }).click();
  await expect(page.getByRole("alert")).toContainText("Twin service is temporarily unavailable.");
  await expect(page.getByRole("button", { name: "Retry Creator Twin scan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Where views came from" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("creator-twin-inline-error.png") });
  await page.getByRole("button", { name: "Retry Creator Twin scan" }).click();
  await expect(page.getByRole("heading", { name: "Jesse James West" })).toBeVisible({ timeout: 7_000 });
  expect(consoleErrors).toEqual([]);
});
