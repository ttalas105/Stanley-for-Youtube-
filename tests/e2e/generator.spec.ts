import { expect, test } from "@playwright/test";
import {
  buildIdeaPayload,
  buildIdeas,
  buildPayload,
  buildThumbnailPayload,
  buildThumbnails,
  buildTitles,
  fillRequiredBrief,
  generate,
  mockGeneration,
  openApp,
  topics,
} from "./fixtures";

test("renders the unified ChatGPT-style Stanley composer", async ({ page }) => {
  await openApp(page);

  await expect(page).toHaveTitle("Stanley — YouTube Creative AI");
  await expect(page.getByRole("heading", { name: "What's on your mind today?" })).toBeVisible();
  await expect(page.getByText(/Talk naturally and Stanley will detect/)).toBeVisible();
  await expect(page.getByLabel("Message Stanley")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
  await expect(page.locator(".generate-button .send-arrow")).toBeVisible();
  await expect(page.getByText(/ideas, titles, and thumbnail concepts/)).toBeVisible();
});

test("shows one creation chat in the sidebar", async ({ page }) => {
  await openApp(page);
  const navigation = page.getByRole("navigation", { name: "Stanley tools" });
  await expect(navigation.locator(".nav-item")).toHaveCount(3);
  await expect(navigation.getByText("Create", { exact: true })).toBeVisible();
  await expect(navigation.getByText("Outliers")).toBeVisible();
  await expect(navigation.getByText("Chrome extension")).toBeVisible();
  await expect(navigation.locator(".nav-item.active")).toContainText("Create");
  await expect(page.getByText("Idea generator")).toHaveCount(0);
  await expect(page.getByText("Title generator")).toHaveCount(0);
  await expect(page.getByText("Thumbnail generator")).toHaveCount(0);
});

test("offers Auto, Ideas, Titles, and Thumbnails inside the composer", async ({ page }) => {
  await openApp(page);
  const picker = page.getByLabel("Creation mode");
  await expect(picker.getByRole("button")).toHaveCount(4);
  await expect(picker.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");

  await picker.getByRole("button", { name: "Ideas" }).click();
  await expect(picker.getByRole("button", { name: "Ideas" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Message Stanley")).toHaveAttribute("placeholder", "What kind of videos do you want to make?");
});

test("unfinished sidebar tools respond without pretending they exist", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Outliers" }).click();
  await expect(page.getByRole("status")).toHaveText("Outliers is coming soon");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByLabel("Message Stanley")).toBeFocused();
});

test("keeps blank submission quiet and accepts a short message", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/generate-titles", async (route) => {
    requests += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildPayload()) });
  });
  await openApp(page);
  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeDisabled();
  await page.getByLabel("Message Stanley").press("Enter");
  expect(requests).toBe(0);

  await page.getByLabel("Message Stanley").fill("Short");
  await expect(sendButton).toBeEnabled();
  await sendButton.click();
  await expect(page.locator("article.title-card")).toHaveCount(12);
  expect(requests).toBe(1);
});

test("submits with Enter and sends the selected mode", async ({ page }) => {
  let submitted: { topic: string; mode: string } | undefined;
  await mockGeneration(page, {
    handler: async (route) => {
      submitted = route.request().postDataJSON() as { topic: string; mode: string };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildPayload()) });
    },
  });
  await openApp(page);
  await page.getByLabel("Message Stanley").fill(topics.primary);
  await page.getByLabel("Message Stanley").press("Enter");

  await expect(page.locator("article.title-card")).toHaveCount(12);
  expect(submitted).toEqual({ topic: topics.primary, mode: "auto" });
});

test("uses Shift+Enter for a new line and grows automatically", async ({ page }) => {
  await openApp(page);
  const composer = page.getByLabel("Message Stanley");
  const initialHeight = await composer.evaluate((element) => element.getBoundingClientRect().height);
  await composer.fill("A detailed first line for the video");
  await composer.press("Shift+Enter");
  await composer.type("A useful second line with more context");
  await composer.press("Shift+Enter");
  await composer.type("A third line that expands the large composer");
  const expandedHeight = await composer.evaluate((element) => element.getBoundingClientRect().height);

  await expect(composer).toHaveValue("A detailed first line for the video\nA useful second line with more context\nA third line that expands the large composer");
  expect(expandedHeight).toBeGreaterThan(initialHeight);
  expect(await composer.evaluate((element) => getComputedStyle(element).resize)).toBe("none");
});

test("shows the spinning loader in the thread instead of the send arrow", async ({ page }) => {
  await mockGeneration(page, { delayMs: 500 });
  await openApp(page);
  await fillRequiredBrief(page);
  await page.getByRole("button", { name: "Send message" }).click();

  const thinking = page.getByRole("status", { name: "Stanley is thinking" });
  await expect(thinking).toBeVisible();
  await expect.poll(() => thinking.locator(".thinking-spinner").evaluate((element) => getComputedStyle(element).animationName)).toBe("thread-spin");
  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeDisabled();
  await expect(sendButton.locator(".send-arrow")).toBeVisible();
  await expect(sendButton).not.toHaveClass(/loading/);
  await expect(page.locator("article.title-card")).toHaveCount(12);
  await expect(thinking).toHaveCount(0);
});

test("renders researched title directions", async ({ page }) => {
  await mockGeneration(page);
  await openApp(page);
  await generate(page);

  const expected = buildTitles();
  await expect(page.locator("article.title-card")).toHaveCount(12);
  await expect(page.locator("article.title-card").first()).toContainText(expected[0].title);
  await expect(page.locator("article.title-card").first()).toContainText(expected[0].whyItWorks);
  await expect(page.getByRole("heading", { name: "Title directions" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("12 options ready");
});

test("keeps research sources below generated work", async ({ page }) => {
  await mockGeneration(page);
  await openApp(page);
  await generate(page);

  expect(await page.evaluate(() => {
    const artifacts = document.querySelector(".creation-list");
    const sources = document.querySelector(".research-card");
    return Boolean(artifacts && sources && (artifacts.compareDocumentPosition(sources) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
  await page.locator(".research-card summary").click();
  await expect(page.locator(".research-sources a")).toHaveCount(6);
});

test("generates video ideas from the Ideas mode", async ({ page }) => {
  await mockGeneration(page, { payload: buildIdeaPayload() });
  await openApp(page);
  await page.getByRole("button", { name: "Ideas" }).click();
  await page.getByLabel("Message Stanley").fill("Productivity experiments for remote workers");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByRole("heading", { name: "Video ideas" })).toBeVisible();
  await expect(page.locator(".idea-list .creation-item")).toHaveCount(8);
  await expect(page.locator(".idea-list .creation-item").first()).toContainText(buildIdeas()[0].hook);
  await expect(page.getByRole("button", { name: "Copy all ideas" })).toBeVisible();
});

test("generates visual thumbnail concepts from the Thumbnails mode", async ({ page }) => {
  await mockGeneration(page, { payload: buildThumbnailPayload() });
  await openApp(page);
  await page.getByRole("button", { name: "Thumbnails" }).click();
  await page.getByLabel("Message Stanley").fill("I tested waking up at 5am for 30 days");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByRole("heading", { name: "Thumbnail concepts" })).toBeVisible();
  await expect(page.locator(".thumbnail-item")).toHaveCount(6);
  await expect(page.locator(".thumbnail-item").first()).toContainText(buildThumbnails()[0].visual);
  await expect(page.getByRole("button", { name: "Copy all thumbnail concepts" })).toBeVisible();
});

test("places the New chat icon inside the unified Create row", async ({ page }) => {
  await openApp(page);
  const activeItem = page.getByRole("navigation", { name: "Stanley tools" }).locator(".nav-item.active");
  const newChat = activeItem.getByRole("button", { name: "Start new chat" });
  await expect(activeItem).toContainText("Create");
  expect(await newChat.evaluate((element) => getComputedStyle(element).opacity)).toBe("0");
  await activeItem.hover();
  await expect.poll(() => newChat.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
});

test("surfaces an API error and keeps the message intact", async ({ page }) => {
  await mockGeneration(page, { status: 502, payload: { error: "Stanley could not finish that response." } });
  await openApp(page);
  await fillRequiredBrief(page);
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByRole("alert")).toHaveText("Stanley could not finish that response.");
  await expect(page.getByLabel("Message Stanley")).toHaveValue(topics.primary);
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
});

test("handles a dropped network request without leaving the UI stuck", async ({ page }) => {
  await page.route("**/api/generate-titles", (route) => route.abort("failed"));
  await openApp(page);
  await fillRequiredBrief(page);
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
  await expect(page.getByRole("status", { name: "Stanley is thinking" })).toHaveCount(0);
});
