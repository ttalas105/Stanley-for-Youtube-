import { expect, test } from "@playwright/test";
import {
  buildPayload,
  buildTitles,
  fillRequiredBrief,
  generate,
  mockGeneration,
  openApp,
  topics,
} from "./fixtures";

test("renders the Stanley title composer and its empty state", async ({ page }) => {
  await openApp(page);

  await expect(page).toHaveTitle("Stanley — YouTube Title Lab");
  await expect(page.getByRole("heading", { name: "Ask Stanley" })).toBeVisible();
  await expect(page.getByAltText("Stanley, your AI YouTube strategist")).toBeVisible();
  await expect(page.getByText("Gemini 3.1 Flash-Lite")).toBeVisible();
  await expect(page.getByText("Your AI YouTube title strategist")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate 12 titles" })).toBeEnabled();
  await expect(page.locator("article.title-card")).toHaveCount(0);
});

test("validates a brief before making any API request", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/generate-titles", async (route) => {
    requests += 1;
    await route.abort();
  });
  await openApp(page);
  await page.getByLabel(/What is the video about/).fill("Short");
  await page.getByRole("button", { name: "Generate 12 titles" }).click();

  await expect(page.getByRole("alert")).toHaveText("Give Stanley a little more detail about the video.");
  expect(requests).toBe(0);
});

test("sends the complete creator brief and shows a loading state", async ({ page }) => {
  let submitted: Record<string, string> | undefined;
  await mockGeneration(page, {
    handler: async (route) => {
      submitted = route.request().postDataJSON() as Record<string, string>;
      await new Promise((resolve) => setTimeout(resolve, 450));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildPayload()),
      });
    },
  });
  await openApp(page);
  await fillRequiredBrief(page);
  await page.locator(".brief-options summary").click();
  await page.getByLabel(/Who is it for/).fill("Busy creators in their twenties");
  await page.getByRole("button", { name: "Bold" }).click();
  await page.getByLabel("Title references").fill("I tried this for 30 days");
  await page.getByRole("button", { name: "Generate 12 titles" }).click();

  await expect(page.getByRole("heading", { name: "Working the angles" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Drafting hooks…" })).toBeDisabled();
  await expect(page.locator("article.title-card")).toHaveCount(12);
  expect(submitted).toEqual({
    topic: topics.primary,
    audience: "Busy creators in their twenties",
    tone: "Bold",
    references: "I tried this for 30 days",
  });
});

test("renders twelve distinct titles with metadata and explanations", async ({ page }) => {
  await mockGeneration(page);
  await openApp(page);
  await generate(page);

  const expected = buildTitles();
  await expect(page.locator("article.title-card")).toHaveCount(12);
  await expect(page.locator("article.title-card").first()).toContainText(expected[0].title);
  await expect(page.locator("article.title-card").first()).toContainText(expected[0].angle);
  await expect(page.locator("article.title-card").first()).toContainText(expected[0].whyItWorks);
  await expect(page.getByRole("tab", { name: /Fresh ideas 12/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("status")).toHaveText("12 fresh titles drafted");
});

test("shows the real research evidence and safe YouTube source links", async ({ page }) => {
  await mockGeneration(page);
  await openApp(page);
  await generate(page);

  await expect(page.getByText(/14 comparable videos analyzed/)).toBeVisible();
  await page.locator(".research-card summary").click();
  const links = page.locator(".research-sources a");
  await expect(links).toHaveCount(6);
  await expect(links.first()).toContainText("A proven morning routine title 1");
  await expect(links.first()).toHaveAttribute("href", "https://www.youtube.com/watch?v=video-1");
  await expect(links.first()).toHaveAttribute("target", "_blank");
  await expect(links.first()).toHaveAttribute("rel", "noreferrer");
});

test("lets the creator change tone without submitting the form", async ({ page }) => {
  await openApp(page);
  await page.locator(".brief-options summary").click();
  const curious = page.getByRole("button", { name: "Curious" });
  const story = page.getByRole("button", { name: "Story-led" });

  await expect(curious).toHaveAttribute("aria-pressed", "true");
  await expect(story).toHaveAttribute("aria-pressed", "false");
  await story.click();
  await expect(curious).toHaveAttribute("aria-pressed", "false");
  await expect(story).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("article.title-card")).toHaveCount(0);
});

test("opens optional references from the keyboard", async ({ page }) => {
  await openApp(page);
  const summary = page.locator(".brief-options summary");
  await summary.focus();
  await expect(summary).toBeFocused();
  await summary.press("Enter");
  await expect(page.getByLabel("Title references")).toBeVisible();
});

test("surfaces a useful API error and keeps the brief intact", async ({ page }) => {
  await mockGeneration(page, {
    status: 502,
    payload: { error: "The research draft failed. Try again shortly." },
  });
  await openApp(page);
  await fillRequiredBrief(page);
  await page.getByRole("button", { name: "Generate 12 titles" }).click();

  await expect(page.getByRole("alert")).toHaveText("The research draft failed. Try again shortly.");
  await expect(page.getByLabel(/What is the video about/)).toHaveValue(topics.primary);
  await expect(page.getByRole("button", { name: "Generate 12 titles" })).toBeEnabled();
  await expect(page.locator("article.title-card")).toHaveCount(0);
});

test("handles a dropped network request without leaving the UI stuck", async ({ page }) => {
  await page.route("**/api/generate-titles", (route) => route.abort("failed"));
  await openApp(page);
  await fillRequiredBrief(page);
  await page.getByRole("button", { name: "Generate 12 titles" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate 12 titles" })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Working the angles" })).toHaveCount(0);
});
