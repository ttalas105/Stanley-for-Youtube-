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

  await expect(page.getByRole("heading", { name: "Hey, meet Stanley." })).toBeVisible();
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
  await page.getByRole("button", { name: /Show me how/ }).click();

  await expect(page.getByRole("heading", { name: "One chat. Your whole video." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Find an idea worth making" })).toBeVisible();
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await page.getByRole("button", { name: /Connect my channel/ }).click();

  await expect(page.getByRole("heading", { name: "Connect your YouTube account." })).toBeVisible();
  await expect(page.getByText(/Topics your viewers come back for/)).toBeVisible();
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
});

test("lets a creator skip and keeps YouTube connection available in the header", async ({ page }) => {
  await mockStatus(page);
  await page.goto("/");
  await waitForApp(page);
  await page.getByRole("button", { name: /Show me how/ }).click();
  await page.getByRole("button", { name: /Connect my channel/ }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();

  await expect(page.getByRole("heading", { name: "Where should we start?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect YouTube" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("stanley-onboarding-v1"))).toBe("skipped");

  await page.reload();
  await waitForApp(page);
  await expect(page.getByRole("heading", { name: "Where should we start?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hey, meet Stanley." })).toHaveCount(0);
});

test("turns a successful OAuth callback into a personalized first chat", async ({ page }) => {
  await mockStatus(page, connectedStatus);
  await page.goto("/?youtube=connected");
  await waitForApp(page);

  await expect(page.getByRole("heading", { name: "Getting to know Thomas Creates." })).toBeVisible();
  await expect(page.getByText("Channel and recent videos found")).toBeVisible();
  await expect(page.getByText(/Comparing video performance/)).toBeVisible();

  await expect(page.getByText(/You’re connected to Thomas Creates/)).toBeVisible({ timeout: 4_000 });
  await expect(page.getByText(/I Let AI Plan My Week/)).toBeVisible();
  await expect(page.locator("header").getByText("Thomas Creates", { exact: true })).toBeVisible();
  await expect(page.getByText("YouTube connected", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Disconnect Thomas Creates" })).toBeVisible();
  await expect(page.locator(".channel-disconnect svg")).toHaveCount(1);
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

test("returns a cancelled connection to the optional connect step", async ({ page }) => {
  await mockStatus(page);
  await page.goto("/?youtube=cancelled");
  await waitForApp(page);

  await expect(page.getByRole("heading", { name: "Connect your YouTube account." })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveText("YouTube connection was cancelled. Nothing was changed.");
  await expect(page.getByRole("button", { name: "Skip for now" })).toBeVisible();
});

test("keeps the onboarding tile inside a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockStatus(page);
  await page.goto("/");
  await waitForApp(page);

  await expect(page.getByRole("heading", { name: "Hey, meet Stanley." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.getByRole("button", { name: /Show me how/ }).click();
  await expect(page.getByRole("heading", { name: "Find an idea worth making" })).toBeVisible();
});
