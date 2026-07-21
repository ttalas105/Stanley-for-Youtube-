import { expect, test } from "@playwright/test";
import { buildPayload, waitForApp } from "./fixtures";

const disconnectedStatus = { configured: true, connected: false, profile: null };
const connectedStatus = {
  configured: true,
  connected: true,
  profile: {
    id: "UCstanley-test",
    title: "Thomas Creates",
    thumbnailUrl: "",
    subscriberCount: 12400,
    videoCount: 86,
    totalViews: 2200000,
    strongestVideo: {
      id: "video-1",
      title: "I Let AI Plan My Week",
      views: 184000,
      viewsPerDay: 4300,
    },
    analyzedAt: "2026-07-12T12:00:00.000Z",
  },
};

async function mockStatus(page: import("@playwright/test").Page, payload = disconnectedStatus) {
  await page.route("**/api/youtube/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(payload),
  }));
}

test("guides a new creator through three large onboarding tiles", async ({ page }) => {
  await mockStatus(page);
  await page.goto("/");
  await waitForApp(page);

  await expect(page.getByRole("heading", { name: "Plan your next YouTube video." })).toBeVisible();
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
  const productReel = page.locator(".onboarding-product-reel");
  await expect(productReel).toBeVisible();
  await expect(productReel.locator(".product-reel-frame")).toHaveCount(3);
  await expect(productReel.locator(".product-reel-frame").first().locator("img")).toHaveAttribute("src", "/product-reel/stanley-home.png");
  await expect(productReel.locator(".product-reel-stage")).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip setup" })).toHaveCount(0);
  await page.getByRole("button", { name: /Continue/ }).click();

  await expect(page.getByRole("heading", { name: "Start with whatever you have." })).toBeVisible();
  await expect(page.getByText(/I spent 30 days learning to cook/)).toBeVisible();
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await expect(page.locator(".product-reel-frame").first().locator("img")).toHaveAttribute("src", "/product-reel/stanley-ideas.png");
  await page.getByRole("button", { name: /Continue/ }).click();

  await expect(page.getByRole("heading", { name: "Connect your YouTube channel." })).toBeVisible();
  await expect(page.getByText(/Use recent channel performance/)).toBeVisible();
  await expect(page.getByText(/Stanley cannot upload, edit, or delete videos/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue without YouTube" })).toHaveCount(0);
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
  await expect(page.locator(".product-reel-frame").first().locator("img")).toHaveAttribute("src", "/product-reel/stanley-dashboard.png");
});

test("shows a real product still when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockStatus(page);
  await page.goto("/");
  await waitForApp(page);

  const frames = page.locator(".product-reel-frame");
  await expect(frames).toHaveCount(3);
  await expect(frames.first()).toHaveCSS("opacity", "1");
  await expect(frames.nth(1)).toHaveCSS("opacity", "0");
  await expect(frames.first().locator("img")).toHaveAttribute("src", "/product-reel/stanley-home.png");
});

test("restarts onboarding when a legacy skipped state is saved without YouTube", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("stanley-onboarding-v1", "skipped"));
  await mockStatus(page);
  await page.goto("/");
  await waitForApp(page);

  await expect(page.getByRole("heading", { name: "Plan your next YouTube video." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip setup" })).toHaveCount(0);

  await page.reload();
  await waitForApp(page);
  await expect(page.getByRole("heading", { name: "Plan your next YouTube video." })).toBeVisible();
});

test("turns a successful OAuth callback into a personalized first chat", async ({ page }) => {
  await mockStatus(page, connectedStatus);
  await page.goto("/?youtube=connected");
  await waitForApp(page);

  await expect(page.getByRole("heading", { name: "Loading Thomas Creates." })).toBeVisible();
  await expect(page.getByText("YouTube connected")).toBeVisible();
  await expect(page.getByText(/Loading recent videos/)).toBeVisible();

  await expect(page.getByText(/You’re connected to Thomas Creates/)).toBeVisible({ timeout: 4_000 });
  await expect(page.getByText(/I Let AI Plan My Week/)).toBeVisible();
  await expect(page.locator(".channel-connection").getByText("Thomas Creates", { exact: true })).toBeVisible();
  await expect(page.getByText("YouTube connected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Switch creator profile/ }).click();
  await expect(page.getByRole("menuitemradio")).toHaveCount(2);
  await expect(page.getByRole("menuitem", { name: "Disconnect YouTube" })).toHaveCount(0);
});

test("loads connected channel avatars through the local image proxy", async ({ page }) => {
  await mockStatus(page, {
    ...connectedStatus,
    profile: { ...connectedStatus.profile, thumbnailUrl: "https://yt3.ggpht.com/test-channel-avatar" },
  });
  let avatarRequests = 0;
  await page.route("**/api/youtube/avatar*", (route) => {
    avatarRequests += 1;
    return route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    });
  });

  await page.goto("/?youtube=connected");
  await waitForApp(page);
  await expect(page.getByText("YouTube connected", { exact: true })).toBeVisible({ timeout: 4_000 });
  expect(await page.locator('img[src^="/api/youtube/avatar"]').count()).toBeGreaterThanOrEqual(2);
  expect(avatarRequests).toBeGreaterThan(0);
  await expect(page.locator(".youtube-avatar-fallback")).toHaveCount(0);
});

test("sends the first creator message after the personalized channel greeting", async ({ page }) => {
  await mockStatus(page, connectedStatus);
  let submitted: { topic: string; mode: string; sessionId: string; messages?: unknown[] } | undefined;
  await page.route("**/api/generate-titles", async (route) => {
    submitted = route.request().postDataJSON() as typeof submitted;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildPayload()),
    });
  });

  await page.goto("/?youtube=connected");
  await waitForApp(page);
  await expect(page.getByText(/connected to Thomas Creates/)).toBeVisible({ timeout: 4_000 });

  const prompt = "Find my next video idea based on what has worked on my channel.";
  await page.getByLabel("Message Stanley").fill(prompt);
  await page.getByLabel("Message Stanley").press("Enter");

  await expect(page.locator(".assistant-option")).toHaveCount(12);
  expect(submitted?.topic).toBe(prompt);
  expect(submitted?.mode).toBe("auto");
  expect(submitted?.sessionId).toMatch(/^[0-9a-f-]{36}$/i);
});

test("returns a cancelled connection to the required connect step", async ({ page }) => {
  await mockStatus(page);
  await page.goto("/?youtube=cancelled");
  await waitForApp(page);

  await expect(page.getByRole("heading", { name: "Connect your YouTube channel." })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveText("YouTube connection was cancelled. Nothing was changed.");
  await expect(page.getByRole("button", { name: "Continue without YouTube" })).toHaveCount(0);
});

test("keeps the onboarding tile inside a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockStatus(page);
  await page.goto("/");
  await waitForApp(page);

  await expect(page.getByRole("heading", { name: "Plan your next YouTube video." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByRole("heading", { name: "Start with whatever you have." })).toBeVisible();
});
