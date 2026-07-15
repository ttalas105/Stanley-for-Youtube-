import { expect, test } from "@playwright/test";
import { generate, mockGeneration, openApp } from "./fixtures";

test("keeps the mobile unified chat inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockGeneration(page);
  await openApp(page);

  await expect(page.getByRole("heading", { name: "Where should we start?" })).toBeVisible();
  await expect(page.getByLabel("Creation mode")).toHaveCount(0);
  await generate(page);
  await expect(page.locator(".assistant-option")).toHaveCount(12);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("keeps primary controls keyboard reachable with visible focus", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Stanley home" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "New chat", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Dashboard" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Create" })).toBeFocused();

  await page.getByLabel("Message Stanley").focus();
  await expect(page.getByLabel("Message Stanley")).toBeFocused();
  await page.getByLabel("Message Stanley").fill("Short");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Add attachment" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Start voice message" })).toBeFocused();
});

test("keeps one clearly labelled auto-growing text input", async ({ page }) => {
  await openApp(page);
  await expect(page.getByLabel("Message Stanley")).toBeVisible();
  await expect(page.getByText("Add context", { exact: true })).toHaveCount(0);
  await expect(page.locator(".composer textarea")).toHaveCount(1);
  expect(await page.getByLabel("Message Stanley").evaluate((element) => getComputedStyle(element).resize)).toBe("none");
});
