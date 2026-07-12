import { expect, test } from "@playwright/test";
import { buildPayload, buildTitles, generate, mockGeneration, openApp, topics, waitForApp } from "./fixtures";

const testOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000").origin;

test("copies all titles from one ChatGPT-style response action", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: testOrigin });
  await mockGeneration(page);
  await openApp(page);
  await generate(page);

  await page.getByRole("button", { name: "Copy all titles" }).click();
  await expect(page.getByRole("status")).toHaveText("Titles copied");
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard.split("\n")).toHaveLength(12);
  expect(clipboard).toContain(`1. ${buildTitles()[0].title}`);
});

test("renders the submitted idea and Stanley's response as a conversation", async ({ page }) => {
  await mockGeneration(page);
  await openApp(page);
  await generate(page);

  await expect(page.locator(".user-message")).toHaveText(topics.primary);
  await expect(page.getByRole("heading", { name: "Here are 12 directions." })).toBeVisible();
  await expect(page.locator(".assistant-message")).toContainText("I reviewed 14 comparable videos");
  await expect(page.getByRole("button", { name: "Copy all titles" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Copy:/ })).toHaveCount(0);
});

test("locks the composer after one prompt until a new chat is started", async ({ page }) => {
  await mockGeneration(page);
  await openApp(page);
  await generate(page);

  await expect(page.getByLabel(/What is the video about/)).toHaveCount(0);
  await expect(page.getByLabel("Start a new chat to create another title set")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Chat complete" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Generate 12 titles" })).toHaveCount(0);
});

test("stores title history and restores it after a full reload", async ({ page }) => {
  await mockGeneration(page);
  await openApp(page);
  await generate(page);

  await expect(page.locator(".title-history button").filter({ hasText: topics.primary })).toBeVisible();
  await page.reload();
  await waitForApp(page);
  await expect(page.locator(".title-history button").filter({ hasText: topics.primary })).toBeVisible();
});

test("uses title-specific history without saved or conversation controls", async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole("heading", { name: "Title history" })).toBeVisible();
  await expect(page.getByText("Saved titles")).toHaveCount(0);
  await expect(page.getByText("Recent conversations")).toHaveCount(0);
  await expect(page.getByText("Conversations", { exact: true })).toHaveCount(0);
});

test("starts a new title chat without deleting history", async ({ page }) => {
  await mockGeneration(page);
  await openApp(page);
  await generate(page);
  await expect(page.locator(".title-history button").filter({ hasText: topics.primary })).toBeVisible();

  await page.locator(".nav-item.active").hover();
  await page.getByRole("button", { name: "Start new title chat" }).click();
  await expect(page.getByLabel(/What is the video about/)).toHaveValue("");
  await expect(page.getByLabel(/What is the video about/)).toBeFocused();
  await expect(page.locator("article.title-card")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "What's your video about?" })).toBeVisible();
  await expect(page.locator(".title-history button").filter({ hasText: topics.primary })).toBeVisible();
});

test("reopens an earlier result set from title history", async ({ page }) => {
  await mockGeneration(page, {
    handler: async (route) => {
      const body = route.request().postDataJSON() as { topic: string };
      const prefix = body.topic === topics.primary ? "5am" : "phone-free";
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildPayload(prefix)) });
    },
  });
  await openApp(page);
  await generate(page, topics.primary);
  await page.locator(".nav-item.active").hover();
  await page.getByRole("button", { name: "Start new title chat" }).click();
  await page.getByLabel(/What is the video about/).fill(topics.secondary);
  await page.getByRole("button", { name: "Generate 12 titles" }).click();
  await expect(page.getByRole("heading", { name: buildTitles("phone-free")[0].title })).toBeVisible();

  await page.locator(".title-history button").filter({ hasText: topics.primary }).click();
  await expect(page.getByRole("heading", { name: buildTitles()[0].title })).toBeVisible();
  await expect(page.locator(".user-message")).toHaveText(topics.primary);
});

test("caps stored title history at eight sessions and shows the latest six", async ({ page }) => {
  await mockGeneration(page, { delayMs: 60 });
  await openApp(page);

  for (let index = 1; index <= 9; index += 1) {
    if (index > 1) {
      await page.locator(".nav-item.active").hover();
      await page.getByRole("button", { name: "Start new title chat" }).click();
    }
    await page.getByLabel(/What is the video about/).fill(`A sufficiently detailed creator test topic number ${index}`);
    await page.getByRole("button", { name: "Generate 12 titles" }).click();
    await expect(page.locator("article.title-card")).toHaveCount(12);
  }

  const historyLength = await page.evaluate(() => JSON.parse(window.localStorage.getItem("stanley-title-drafts") || "[]").length);
  expect(historyLength).toBe(8);
  await expect(page.locator(".title-history button")).toHaveCount(6);
});
