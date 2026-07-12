import { expect, test } from "@playwright/test";
import { buildPayload, buildTitles, generate, mockGeneration, openApp, topics, waitForApp } from "./fixtures";

const testOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000").origin;

test("copies one generated title to the clipboard", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: testOrigin,
  });
  await mockGeneration(page);
  await openApp(page);
  await generate(page);

  const title = buildTitles()[0].title;
  await page.getByRole("button", { name: `Copy: ${title}` }).click();
  await expect(page.getByRole("status")).toHaveText("Copied to clipboard");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(title);
});

test("copies the numbered title list in one action", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: testOrigin,
  });
  await mockGeneration(page);
  await openApp(page);
  await generate(page);
  await page.getByRole("button", { name: "Copy all" }).click();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard.split("\n")).toHaveLength(12);
  expect(clipboard).toContain(`1. ${buildTitles()[0].title}`);
  expect(clipboard).toContain(`12. ${buildTitles()[11].title}`);
});

test("saves a title and restores it after a full reload", async ({ page }) => {
  await mockGeneration(page);
  await openApp(page);
  await generate(page);
  const title = buildTitles()[0].title;

  await page.getByRole("button", { name: `Save: ${title}` }).click();
  await expect(page.locator(".saved-shortcut strong")).toHaveText("1");
  await page.reload();
  await waitForApp(page);
  await expect(page.locator(".saved-shortcut strong")).toHaveText("1");
  await page.getByRole("tab", { name: /Saved 1/ }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

test("removes a saved title and returns to the saved empty state", async ({ page }) => {
  await mockGeneration(page);
  await openApp(page);
  await generate(page);
  const title = buildTitles()[0].title;
  await page.getByRole("button", { name: `Save: ${title}` }).click();
  await page.getByRole("tab", { name: /Saved 1/ }).click();
  await page.getByRole("button", { name: `Unsave: ${title}` }).click();

  await expect(page.locator(".saved-shortcut strong")).toHaveText("0");
  await expect(page.getByRole("heading", { name: "No saved titles yet." })).toBeVisible();
});

test("stores recent drafts and reopens an earlier result set", async ({ page }) => {
  await mockGeneration(page, {
    handler: async (route) => {
      const body = route.request().postDataJSON() as { topic: string };
      const prefix = body.topic === topics.primary ? "5am" : "phone-free";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildPayload(prefix)),
      });
    },
  });
  await openApp(page);
  await generate(page, topics.primary);
  await page.getByLabel(/What is the video about/).fill(topics.secondary);
  await page.getByRole("button", { name: "Generate 12 titles" }).click();
  await expect(page.getByRole("heading", { name: buildTitles("phone-free")[0].title })).toBeVisible();

  await page.locator(".recent-drafts button").filter({ hasText: topics.primary }).click();
  await expect(page.getByRole("heading", { name: buildTitles()[0].title })).toBeVisible();
  await expect(page.getByLabel(/What is the video about/)).toHaveValue(topics.primary);
});

test("caps local draft history at six sessions", async ({ page }) => {
  await mockGeneration(page, { delayMs: 80 });
  await openApp(page);

  for (let index = 1; index <= 7; index += 1) {
    await page.getByLabel(/What is the video about/).fill(`A sufficiently detailed creator test topic number ${index}`);
    const generateButton = page.locator(".generate-button");
    await generateButton.click();
    await expect(generateButton).toBeDisabled();
    await expect(generateButton).toBeEnabled();
    await expect(page.locator("article.title-card")).toHaveCount(12);
  }

  const historyLength = await page.evaluate(() => {
    const stored = window.localStorage.getItem("stanley-title-drafts");
    return stored ? JSON.parse(stored).length : 0;
  });
  expect(historyLength).toBe(6);
  await expect(page.locator(".recent-drafts button")).toHaveCount(4);
});
