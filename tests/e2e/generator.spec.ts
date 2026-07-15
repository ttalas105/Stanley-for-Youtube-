import { expect, test } from "@playwright/test";
import {
  buildIdeaPayload,
  buildIdeas,
  buildPayload,
  buildScript,
  buildScriptPayload,
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
  await expect(page.getByRole("heading", { name: "Where should we start?" })).toBeVisible();
  await expect(page.getByText("Ideas, titles, scripts, and thumbnails in one conversation.")).toBeVisible();
  await expect(page.getByLabel("Message Stanley")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
  await expect(page.locator(".generate-button .send-arrow")).toBeVisible();
  await expect(page.getByText(/Ask for ideas, scripts, titles, or thumbnails/)).toBeVisible();
  await expect(page.locator(".main-header .mode-indicator")).toHaveCount(0);
  await expect(page.locator(".sidebar-brand")).toContainText("for YouTube");
  await expect(page.locator(".sidebar-brand svg")).toHaveCount(1);
});

test("offers Stanley-style quick starts that prepare the composer", async ({ page }) => {
  await openApp(page);
  await expect(page.getByLabel("Start with a YouTube task").getByRole("button")).toHaveCount(6);
  await page.getByRole("button", { name: "Video ideas" }).click();
  await expect(page.getByLabel("Message Stanley")).toHaveValue(/Help me find a data-backed idea/);
  await expect(page.getByLabel("Message Stanley")).toBeFocused();
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

test("keeps creation-mode controls out of the composer", async ({ page }) => {
  await openApp(page);
  await expect(page.getByLabel("Creation mode")).toHaveCount(0);
  await expect(page.locator(".mode-picker, .mode-option")).toHaveCount(0);
  await expect(page.getByLabel("Start with a YouTube task")).toBeVisible();
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

test("submits with Enter and sends the selected mode and stable memory session", async ({ page }) => {
  let submitted: { topic: string; mode: string; sessionId: string } | undefined;
  await mockGeneration(page, {
    handler: async (route) => {
      submitted = route.request().postDataJSON() as { topic: string; mode: string; sessionId: string };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildPayload()) });
    },
  });
  await openApp(page);
  await page.getByLabel("Message Stanley").fill(topics.primary);
  await page.getByLabel("Message Stanley").press("Enter");

  await expect(page.locator("article.title-card")).toHaveCount(12);
  expect(submitted?.topic).toBe(topics.primary);
  expect(submitted?.mode).toBe("auto");
  expect(submitted?.sessionId).toMatch(/^[0-9a-f-]{36}$/i);
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
  await mockGeneration(page, { delayMs: 1200 });
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

test("reveals a new Stanley reply progressively before showing its artifacts", async ({ page }) => {
  const reply = "I found a focused set of title directions that make the video's promise clear while keeping the strongest curiosity gap honest and easy to understand.";
  await mockGeneration(page, { payload: { ...buildPayload(), reply } });
  await openApp(page);

  await page.getByLabel("Message Stanley").fill(topics.primary);
  await page.getByLabel("Message Stanley").press("Enter");

  await expect(page.locator(".assistant-typing-cursor")).toHaveCount(1);
  await expect(page.locator("article.title-card")).toHaveCount(0);
  const partialReply = await page.locator(".assistant-lead p").innerText();
  expect(partialReply.length).toBeLessThan(reply.length);

  await expect(page.locator(".assistant-lead p")).toHaveText(reply);
  await expect(page.locator(".assistant-typing-cursor")).toHaveCount(0);
  await expect(page.locator("article.title-card")).toHaveCount(12);
});

test("collects feedback under Stanley replies", async ({ page }) => {
  await mockGeneration(page);
  await openApp(page);
  await generate(page);
  const helpful = page.getByRole("button", { name: "Mark response as helpful" });
  await helpful.click();
  await expect(helpful).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toHaveText("Marked as helpful");
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
  await page.getByRole("button", { name: "Video ideas" }).click();
  await page.getByLabel("Message Stanley").fill("Productivity experiments for remote workers");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByRole("heading", { name: "Video ideas" })).toBeVisible();
  await expect(page.locator(".idea-list .creation-item")).toHaveCount(8);
  await expect(page.locator(".idea-list .creation-item").first()).toContainText(buildIdeas()[0].hook);
  await expect(page.locator(".idea-evidence")).toHaveCount(8);
  await expect(page.locator(".idea-evidence a")).toHaveCount(8);
  await page.locator(".idea-script summary").first().click();
  await expect(page.locator(".script-outline-body").first()).toContainText(buildIdeas()[0].scriptOutline.opening);
  await expect(page.getByRole("button", { name: "Copy all ideas and script blueprints" })).toBeVisible();
});

test("expands a researched idea into a complete YouTube script", async ({ page }) => {
  let requestCount = 0;
  await mockGeneration(page, {
    handler: async (route) => {
      requestCount += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(requestCount === 1 ? buildIdeaPayload() : buildScriptPayload()) });
    },
  });
  await openApp(page);
  await page.getByRole("button", { name: "Video ideas" }).click();
  await page.getByLabel("Message Stanley").fill("Productivity experiments for remote workers");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.locator(".idea-script summary").first().click();
  await page.getByRole("button", { name: "Write full script for idea 1" }).click();

  await expect(page.getByRole("heading", { name: "Full video script" })).toBeVisible();
  await expect(page.locator(".full-script")).toContainText(buildScript().coldOpen);
  await expect(page.locator(".full-script > section")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Copy full script" })).toBeVisible();
});

test("generates visual thumbnail concepts from the Thumbnails mode", async ({ page }) => {
  await mockGeneration(page, { payload: buildThumbnailPayload() });
  await openApp(page);
  await page.getByRole("button", { name: "New thumbnail" }).click();
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
