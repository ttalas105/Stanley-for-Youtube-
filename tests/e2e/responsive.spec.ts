import { expect, test } from "@playwright/test";
import { generate, mockGeneration, openApp } from "./fixtures";

test("keeps the mobile Stanley layout inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockGeneration(page);
  await openApp(page);

  await expect(page.getByRole("heading", { name: "What's your video about?" })).toBeVisible();
  await generate(page);
  await expect(page.locator("article.title-card")).toHaveCount(12);
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("keeps primary controls keyboard reachable with visible focus", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Stanley title lab home" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Idea generator" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Title generator" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Start new title chat" })).toBeFocused();
  await page.getByLabel(/What is the video about/).focus();
  await expect(page.getByLabel(/What is the video about/)).toBeFocused();
  await page.getByLabel(/What is the video about/).fill("Short");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Generate 12 titles" })).toBeFocused();
});

test("keeps the composer focused on one clearly labelled input", async ({ page }) => {
  await openApp(page);
  await expect(page.getByLabel(/What is the video about/)).toBeVisible();
  await expect(page.getByText("Add context", { exact: true })).toHaveCount(0);
  await expect(page.locator(".composer textarea")).toHaveCount(1);
});
