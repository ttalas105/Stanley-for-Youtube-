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

test("renders the simplified Stanley title composer", async ({ page }) => {
  await openApp(page);

  await expect(page).toHaveTitle("Stanley — YouTube Title Lab");
  await expect(page.getByRole("heading", { name: "What's your video about?" })).toBeVisible();
  await expect(page.getByAltText("Stanley, your AI YouTube strategist")).toBeVisible();
  await expect(page.getByText(/Stanley will study what works/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate 12 titles" })).toBeDisabled();
  await expect(page.locator(".generate-button .send-arrow")).toBeVisible();
  await expect(page.locator("article.title-card")).toHaveCount(0);
});

test("shows the five-product navigation with title generator selected", async ({ page }) => {
  await openApp(page);
  const navigation = page.getByRole("navigation", { name: "Stanley tools" });
  await expect(navigation.locator(".nav-item")).toHaveCount(5);
  await expect(navigation.getByText("Idea generator")).toBeVisible();
  await expect(navigation.getByText("Title generator")).toBeVisible();
  await expect(navigation.getByText("Thumbnail generator")).toBeVisible();
  await expect(navigation.getByText("Outliers")).toBeVisible();
  await expect(navigation.getByText("Chrome extension")).toBeVisible();
  await expect(navigation.locator(".nav-item.active")).toContainText("Title generator");
});

test("sidebar rows respond to clicks without pretending unfinished tools exist", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Idea generator" }).click();
  await expect(page.getByRole("status")).toHaveText("Idea generator is coming soon");

  await page.getByRole("button", { name: "Title generator" }).click();
  await expect(page.getByLabel(/What is the video about/)).toBeFocused();
});

test("keeps blank submission quiet and accepts a brief idea", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/generate-titles", async (route) => {
    requests += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildPayload()) });
  });
  await openApp(page);
  const generateButton = page.getByRole("button", { name: "Generate 12 titles" });
  await expect(generateButton).toBeDisabled();
  await page.getByLabel(/What is the video about/).press("Enter");
  expect(requests).toBe(0);

  await page.getByLabel(/What is the video about/).fill("Short");
  await expect(generateButton).toBeEnabled();
  await generateButton.click();
  await expect(page.locator("article.title-card")).toHaveCount(12);
  expect(requests).toBe(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("submits the prompt with Enter", async ({ page }) => {
  let requests = 0;
  await mockGeneration(page, {
    handler: async (route) => {
      requests += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildPayload()) });
    },
  });
  await openApp(page);
  await page.getByLabel(/What is the video about/).fill(topics.primary);
  await page.getByLabel(/What is the video about/).press("Enter");

  await expect(page.locator("article.title-card")).toHaveCount(12);
  expect(requests).toBe(1);
});

test("uses Shift+Enter for a new line and grows the composer automatically", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/generate-titles", async (route) => {
    requests += 1;
    await route.abort();
  });
  await openApp(page);
  const composer = page.getByLabel(/What is the video about/);
  const initialHeight = await composer.evaluate((element) => element.getBoundingClientRect().height);
  await composer.fill("A detailed first line for the video");
  await composer.press("Shift+Enter");
  await composer.type("A useful second line with more context");
  const expandedHeight = await composer.evaluate((element) => element.getBoundingClientRect().height);

  await expect(composer).toHaveValue("A detailed first line for the video\nA useful second line with more context");
  expect(expandedHeight).toBeGreaterThan(initialHeight);
  expect(await composer.evaluate((element) => getComputedStyle(element).resize)).toBe("none");
  expect(requests).toBe(0);
});

test("sends the video idea and shows a loading state", async ({ page }) => {
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
  await page.getByRole("button", { name: "Generate 12 titles" }).click();

  await expect(page.getByRole("heading", { name: "Researching similar videos…" })).toHaveCount(0);
  const loadingButton = page.getByRole("button", { name: "Generating titles" });
  await expect(loadingButton).toBeDisabled();
  await expect(loadingButton).toHaveClass(/loading/);
  await expect.poll(() => loadingButton.evaluate((element) => getComputedStyle(element).animationName)).toBe("send-spin");
  await expect(page.locator("article.title-card")).toHaveCount(12);
  expect(submitted).toEqual({ topic: topics.primary });
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
  await expect(page.getByRole("heading", { name: "Here are 12 directions." })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("12 titles ready");
});

test("shows the real research evidence and safe YouTube source links", async ({ page }) => {
  await mockGeneration(page);
  await openApp(page);
  await generate(page);

  await expect(page.getByText(/14 videos analyzed/)).toBeVisible();
  expect(await page.evaluate(() => {
    const titles = document.querySelector(".title-list");
    const sources = document.querySelector(".research-card");
    return Boolean(titles && sources && (titles.compareDocumentPosition(sources) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
  await page.locator(".research-card summary").click();
  const links = page.locator(".research-sources a");
  await expect(links).toHaveCount(6);
  await expect(links.first()).toContainText("A proven morning routine title 1");
  await expect(links.first()).toHaveAttribute("href", "https://www.youtube.com/watch?v=video-1");
  await expect(links.first()).toHaveAttribute("target", "_blank");
  await expect(links.first()).toHaveAttribute("rel", "noreferrer");
});

test("removes optional context controls from the focused composer", async ({ page }) => {
  await openApp(page);
  await expect(page.getByText("Add context", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel(/Audience/)).toHaveCount(0);
  await expect(page.getByLabel("Title examples")).toHaveCount(0);
});

test("places the New chat compose icon inside the active sidebar item", async ({ page }) => {
  await openApp(page);
  const activeItem = page.getByRole("navigation", { name: "Stanley tools" }).locator(".nav-item.active");
  const newChat = activeItem.getByRole("button", { name: "Start new title chat" });
  await expect(activeItem).toContainText("Title generator");
  expect(await newChat.evaluate((element) => getComputedStyle(element).opacity)).toBe("0");
  await activeItem.hover();
  await expect.poll(() => newChat.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
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
  await expect(page.getByRole("heading", { name: "Researching similar videos…" })).toHaveCount(0);
});
