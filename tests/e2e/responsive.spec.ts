import { expect, test } from "@playwright/test";
import { generate, mockGeneration, openApp } from "./fixtures";

test("keeps the mobile notebook layout inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockGeneration(page);
  await openApp(page);

  await expect(page.getByText("Gemini 3.1 Flash-Lite")).toBeHidden();
  await expect(page.getByRole("heading", { name: /Find the title/ })).toBeVisible();
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
  await expect(page.locator(".saved-shortcut")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel(/What is the video about/)).toBeFocused();
});

test("provides descriptive labels for every creator input", async ({ page }) => {
  await openApp(page);
  await expect(page.getByLabel(/What is the video about/)).toBeVisible();
  await expect(page.getByLabel(/Who is it for/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Curious" })).toHaveAttribute("aria-pressed", "true");
  await page.locator("summary").filter({ hasText: "Add title references" }).click();
  await expect(page.getByLabel("Title references")).toBeVisible();
});
