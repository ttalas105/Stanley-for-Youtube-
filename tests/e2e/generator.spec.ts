import { expect, test } from "@playwright/test";
import {
  buildFilmingPayload,
  buildIdeaPayload,
  buildIdeas,
  buildPayload,
  buildResearch,
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

  await expect(page).toHaveTitle("Stanley");
  await expect(page.getByRole("heading", { name: "What should we make next?" })).toBeVisible();
  await expect(page.getByText("Stanley can research the idea, write it, plan the shoot, and package the thumbnail with you.")).toBeVisible();
  await expect(page.getByLabel("Message Stanley")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
  await expect(page.locator(".generate-button .send-arrow")).toBeVisible();
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
  await expect(navigation.getByText("Dashboard", { exact: true })).toBeVisible();
  await expect(navigation.getByText("Creator Twin", { exact: true })).toBeVisible();
  await expect(navigation.getByText("Chrome extension")).toBeVisible();
  await expect(page.getByRole("link", { name: "New video", exact: true })).toBeVisible();
  await expect(navigation.locator(".nav-item.active")).toHaveCount(0);
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

test("opens the Chrome extension surface and returns to a new video", async ({ page }) => {
  await openApp(page);
  await page.getByRole("link", { name: "Chrome extension" }).click();
  await expect(page.getByRole("heading", { name: "Stanley, right inside YouTube." })).toBeVisible();
  await page.getByRole("link", { name: "New video", exact: true }).click();
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
  await expect(page.locator(".assistant-option")).toHaveCount(12);
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

  await expect(page.locator(".assistant-option")).toHaveCount(12);
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
  await expect(page.locator(".assistant-option")).toHaveCount(12);
  await expect(thinking).toHaveCount(0);
});

test("shows real streamed activity for creative requests", async ({ page }) => {
  await mockGeneration(page, { handler: async (route) => {
    const events = [
      { type: "activity", activity: { id: "intent", label: "Understanding your request", detail: "This needs idea help", status: "complete", kind: "thinking" } },
      { type: "activity", activity: { id: "search", label: "Searching comparable videos", detail: "Found useful current examples", status: "complete", kind: "tool" } },
      { type: "activity", activity: { id: "answer", label: "Writing the answer", detail: "Ready", status: "complete", kind: "answer" } },
      { type: "result", status: 200, payload: buildIdeaPayload() },
    ];
    await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: events.map((event) => JSON.stringify(event)).join("\n") });
  } });
  await openApp(page);
  await page.getByLabel("Message Stanley").fill("Give me a video idea about my dog Rudy");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByText("Worked through 3 steps")).toBeVisible();
  await page.locator(".agent-activity.complete summary").click();
  await expect(page.locator(".agent-activity.complete")).toContainText("Searching comparable videos");
  await expect(page.locator(".research-progress")).toHaveCount(0);
  await expect(page.locator(".assistant-option")).toHaveCount(3);
});

test("renders researched title directions", async ({ page }) => {
  await mockGeneration(page);
  await openApp(page);
  await generate(page);

  const expected = buildTitles();
  await expect(page.locator(".assistant-option")).toHaveCount(12);
  await expect(page.locator(".assistant-option").first()).toContainText(expected[0].title);
  await expect(page.getByText("Want me to create the finished thumbnail next?", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("status")).toHaveText("12 results ready");
});

test("reveals a new Stanley reply progressively before showing its artifacts", async ({ page }) => {
  const reply = "I found a focused set of title directions that make the video's promise clear while keeping the strongest curiosity gap honest and easy to understand.";
  await mockGeneration(page, { payload: { ...buildPayload(), reply } });
  await openApp(page);

  await page.getByLabel("Message Stanley").fill(topics.primary);
  await page.getByLabel("Message Stanley").press("Enter");

  await expect(page.locator(".assistant-typing-cursor")).toHaveCount(1);
  const partialReply = await page.locator(".assistant-answer").innerText();
  expect(partialReply.length).toBeLessThan(reply.length);

  await expect(page.locator(".assistant-typing-cursor")).toHaveCount(0);
  await expect(page.locator(".assistant-answer")).toContainText(reply);
  await expect(page.locator(".assistant-option")).toHaveCount(12);
});

test("collects feedback under Stanley replies", async ({ page }) => {
  await mockGeneration(page);
  await openApp(page);
  await generate(page);
  const helpful = page.getByRole("button", { name: "Mark response as helpful" });
  const actionButtons = page.locator(".assistant-actions > button");
  const actionIcons = page.locator(".assistant-actions svg");

  await expect(actionButtons).toHaveCount(3);
  await expect(actionIcons).toHaveCount(3);
  const metrics = await actionButtons.evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { height: box.height, centerY: box.top + box.height / 2 };
  }));
  expect(metrics.every(({ height }) => height === 32)).toBe(true);
  expect(Math.max(...metrics.map(({ centerY }) => centerY)) - Math.min(...metrics.map(({ centerY }) => centerY))).toBeLessThan(0.5);
  expect(await actionIcons.evaluateAll((icons) => icons.every((icon) => {
    const box = icon.getBoundingClientRect();
    return box.width === 16 && box.height === 16;
  }))).toBe(true);

  await helpful.click();
  await expect(helpful).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toHaveText("Marked as helpful");
});

test("keeps research sources below generated work", async ({ page }) => {
  await mockGeneration(page);
  await openApp(page);
  await generate(page);

  expect(await page.evaluate(() => {
    const artifacts = document.querySelector(".assistant-answer");
    const sources = document.querySelector(".research-card");
    return Boolean(artifacts && sources && (artifacts.compareDocumentPosition(sources) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
  await page.locator(".research-card summary").click();
  await expect(page.locator(".research-sources a")).toHaveCount(6);
});

test("turns creator research into a typed idea follow-up with evidence preserved", async ({ page }) => {
  let requestCount = 0;
  let followUpBody: { messages?: Array<{ role: string; content: string }> } | undefined;
  const research = buildResearch("Jynxzi");
  await mockGeneration(page, {
    handler: async (route) => {
      requestCount += 1;
      if (requestCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: "Jynxzi's strongest repeatable pattern is a serialized challenge with a visible finish line.",
            research,
            blocked: false,
            mode: "auto",
          }),
        });
        return;
      }
      followUpBody = route.request().postDataJSON() as typeof followUpBody;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildIdeaPayload()) });
    },
  });
  await openApp(page);
  await page.getByLabel("Message Stanley").fill("Research Jynxi and tell me why he performs well.");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByLabel("Stanley follow-up")).toHaveText("Want to make an idea like this?");
  await page.getByLabel("Message Stanley").fill("yes");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".assistant-option")).toHaveCount(3);

  const assistantContext = followUpBody?.messages?.findLast((message) => message.role === "assistant")?.content || "";
  expect(followUpBody?.messages?.at(-1)?.content).toBe("yes");
  expect(assistantContext).toContain("Verified YouTube research (Jynxzi)");
  expect(assistantContext).toContain(research.examples[0].title);
  expect(assistantContext).toContain("Want to make an idea like this?");
});

test("leads a completed connected-channel audit into the idea tool", async ({ page }) => {
  await mockGeneration(page, { payload: {
    reply: "Your clearest opportunity is a more specific video promise.",
    blocked: false,
    mode: "auto",
    agent: {
      runId: "channel-audit",
      modelRounds: 1,
      durationMs: 1200,
      toolCalls: [{ name: "youtube_channel_snapshot", status: "complete", memoHit: false }],
    },
  } });
  await openApp(page);
  await page.getByLabel("Message Stanley").fill("Look at my channel and tell me what I should do better.");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByLabel("Stanley follow-up")).toHaveText("Want to make an idea like this?");
});

test("generates video ideas from the Ideas mode", async ({ page }) => {
  await mockGeneration(page, { payload: buildIdeaPayload() });
  await openApp(page);
  await page.getByRole("button", { name: "Video ideas" }).click();
  await page.getByLabel("Message Stanley").fill("Productivity experiments for remote workers");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.locator(".assistant-option")).toHaveCount(3);
  await expect(page.locator(".assistant-option").first()).toContainText("Top pick");
  await expect(page.locator(".assistant-option").first()).toContainText(buildIdeas()[0].suggestedTitle);
  await expect(page.getByLabel("Stanley follow-up")).toHaveText("Want me to turn the top idea into a complete script?");
  expect(await page.evaluate(() => {
    const artifact = document.querySelector(".idea-workspace");
    const followUp = document.querySelector(".assistant-follow-up");
    return Boolean(artifact && followUp && (artifact.compareDocumentPosition(followUp) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
  await page.locator(".response-details summary").click();
  await expect(page.locator(".response-details")).toContainText(buildIdeas()[0].scriptOutline.opening);
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
  await expect(page.getByLabel("Stanley follow-up")).toHaveText("Want me to turn the top idea into a complete script?");
  await page.getByLabel("Message Stanley").fill("yes");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.locator(".assistant-answer").last()).toContainText(buildScript().coldOpen);
  await expect(page.locator(".assistant-answer").last()).toContainText(buildScript().ending);
  await expect(page.getByRole("button", { name: "Copy full script" })).toBeVisible();
  await expect(page.getByLabel("Stanley follow-up")).toHaveText("Want practical advice and a shot-by-shot plan for filming it?");
});

test("guides one typed conversation from idea through script, filming, and thumbnail", async ({ page }, testInfo) => {
  const prompts: string[] = [];
  const assistantContext: string[] = [];
  let requestCount = 0;
  await mockGeneration(page, {
    handler: async (route) => {
      const body = route.request().postDataJSON() as { messages?: Array<{ role: string; content: string }>; topic?: string };
      prompts.push(body.messages?.at(-1)?.content || body.topic || "");
      assistantContext.push(body.messages?.filter((message) => message.role === "assistant").at(-1)?.content || "");
      requestCount += 1;
      const payload = requestCount === 1
        ? buildIdeaPayload()
        : requestCount === 2
          ? buildScriptPayload()
          : requestCount === 3
            ? buildFilmingPayload()
            : buildThumbnailPayload();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
    },
  });
  await openApp(page);
  await page.getByLabel("Message Stanley").fill("Give me ideas for a measurable morning experiment.");
  await page.getByRole("button", { name: "Send message" }).click();
  const followUp = page.getByLabel("Stanley follow-up");
  await expect(followUp).toHaveText("Want me to turn the top idea into a complete script?");
  await followUp.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("idea-next-step.png") });

  for (const expectedQuestion of [
    "Want practical advice and a shot-by-shot plan for filming it?",
    "Want me to create the finished thumbnail next?",
    "Want me to review the full package and make its highest-leverage improvement?",
  ]) {
    await page.getByLabel("Message Stanley").fill("yes");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(followUp).toHaveText(expectedQuestion, { timeout: 15_000 });
  }

  await followUp.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("full-workflow.png") });
  expect(prompts.slice(1)).toEqual(["yes", "yes", "yes"]);
  expect(assistantContext[1]).toContain("Want me to turn the top idea into a complete script?");
  expect(assistantContext[2]).toContain("Want practical advice and a shot-by-shot plan for filming it?");
  expect(assistantContext[3]).toContain("Want me to create the finished thumbnail next?");
});

test("renders longer Stanley chat as concise point form", async ({ page }) => {
  await mockGeneration(page, { payload: {
    reply: "The evidence is limited, so I would not call this a proven pattern. The useful signal is the repeated visual contrast. Test that before changing the whole concept.",
    blocked: false,
  } });
  await openApp(page);
  await page.getByLabel("Message Stanley").fill("What do you think of this direction?");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.locator(".assistant-points li")).toHaveCount(3);
  await expect(page.locator(".assistant-paragraph")).toHaveCount(0);
});

test("renders every numbered conversational point with consistent emphasis", async ({ page }) => {
  const reply = `YouTube matches content based on viewer signals, so focus on these three areas.

1. Clarity: Can someone tell exactly what they get in 3 seconds?
2. Relevance: Stop trying to reach everyone and make the video for one specific viewer.

3. Satisfaction: Does the opening deliver on the title?`;
  await mockGeneration(page, { payload: { reply, titles: [], mode: "idea", blocked: false, model: "test" } });
  await openApp(page);
  await page.getByLabel("Message Stanley").fill("What is his message?");
  await page.getByRole("button", { name: "Send message" }).click();

  const answer = page.locator(".assistant-answer").last();
  await expect(answer.locator(".assistant-option")).toHaveCount(3);
  await expect(answer.locator(".assistant-option-title strong")).toHaveText([
    "Clarity:",
    "Relevance:",
    "Satisfaction:",
  ]);
  await expect.poll(() => answer.locator(".assistant-option-title").evaluateAll((items) => new Set(items.map((item) => getComputedStyle(item).fontWeight)).size)).toBe(1);
  await expect.poll(() => answer.locator(".assistant-option-title").evaluateAll((items) => Array.from(new Set(items.map((item) => getComputedStyle(item).fontSize))))).toEqual(["16px"]);
});

test("does not bold review advice or split quoted thumbnail copy at a colon", async ({ page }) => {
  const reply = `The highest-leverage move for this package is to clarify the viewer's 'Why' in the thumbnail.

1. Increase the visual weight of the '7-Day' text to frame it as a race.
2. Position the subject's expression to reflect concern about the high-stakes demo, not just technical stress.

3. Swap 'Warning: Hard' for a specific, clear outcome like 'The Final Demo' to better signal why the viewer should care about the result.`;
  await mockGeneration(page, { payload: { reply, titles: [], mode: "idea", blocked: false, model: "test" } });
  await openApp(page);
  await page.getByLabel("Message Stanley").fill("Yes please!");
  await page.getByRole("button", { name: "Send message" }).click();

  const answer = page.locator(".assistant-answer").last();
  await expect(answer.locator(".assistant-option")).toHaveCount(3);
  await expect(answer.locator(".assistant-option-title strong")).toHaveCount(0);
  await expect(answer.locator(".assistant-option-title").nth(2)).toContainText("Swap 'Warning: Hard'");
  await expect.poll(() => answer.locator(".assistant-option-title").evaluateAll((items) =>
    Array.from(new Set(items.map((item) => getComputedStyle(item).fontWeight)))
  )).toEqual(["400"]);
});

test("keeps a submitted follow-up and its live work in view", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 650 });
  let requestCount = 0;
  await mockGeneration(page, {
    handler: async (route) => {
      requestCount += 1;
      if (requestCount === 2) await new Promise((resolve) => setTimeout(resolve, 800));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildPayload()) });
    },
  });
  await openApp(page);
  await generate(page);

  await page.getByLabel("Message Stanley").fill("Make the third title less dramatic.");
  await page.getByLabel("Message Stanley").press("Enter");
  await expect(page.locator(".user-message")).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>(".content.conversation-mode");
    const end = document.querySelector<HTMLElement>('[data-testid="conversation-end"]');
    if (!scroller || !end) return 999;
    return Math.round(end.getBoundingClientRect().bottom - scroller.getBoundingClientRect().bottom);
  })).toBeLessThanOrEqual(2);
});

test("positions a completed follow-up at the beginning of its answer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 650 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  let requestCount = 0;
  await mockGeneration(page, {
    handler: async (route) => {
      requestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(requestCount === 1 ? buildIdeaPayload() : buildPayload()),
      });
    },
  });
  await openApp(page);
  await page.getByLabel("Message Stanley").fill("Give me three chaotic gaming video ideas.");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.getByLabel("Message Stanley").fill("I like the third one. Make it about CS:GO.");
  await page.getByLabel("Message Stanley").press("Enter");
  await expect(page.locator('.assistant-message[data-latest-response="true"]')).toContainText(buildPayload().reply);

  await expect.poll(() => page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>(".content.conversation-mode");
    const response = document.querySelector<HTMLElement>('.assistant-message[data-latest-response="true"]');
    if (!scroller || !response) return 999;
    return Math.round(response.getBoundingClientRect().top - scroller.getBoundingClientRect().top);
  })).toBeGreaterThanOrEqual(20);
  await expect.poll(() => page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>(".content.conversation-mode");
    const response = document.querySelector<HTMLElement>('.assistant-message[data-latest-response="true"]');
    if (!scroller || !response) return 999;
    return Math.round(response.getBoundingClientRect().top - scroller.getBoundingClientRect().top);
  })).toBeLessThanOrEqual(36);
});

test("positions a completed script at its beginning", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 650 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockGeneration(page, { payload: buildScriptPayload() });
  await openApp(page);
  await page.getByLabel("Message Stanley").fill("Write the complete script for my 30 day experiment.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".script-workspace")).toBeVisible();

  await expect.poll(() => page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>(".content.conversation-mode");
    const script = document.querySelector<HTMLElement>(".script-workspace");
    if (!scroller || !script) return 999;
    return Math.round(script.getBoundingClientRect().top - scroller.getBoundingClientRect().top);
  })).toBeGreaterThanOrEqual(20);
  await expect.poll(() => page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>(".content.conversation-mode");
    const script = document.querySelector<HTMLElement>(".script-workspace");
    if (!scroller || !script) return 999;
    return Math.round(script.getBoundingClientRect().top - scroller.getBoundingClientRect().top);
  })).toBeLessThanOrEqual(36);
  expect(await page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>(".content.conversation-mode");
    const ending = document.querySelector<HTMLElement>(".script-ending");
    return Boolean(scroller && ending && ending.getBoundingClientRect().bottom > scroller.getBoundingClientRect().bottom);
  })).toBe(true);
});

test("generates visual thumbnail concepts from the Thumbnails mode", async ({ page }) => {
  await mockGeneration(page, { payload: buildThumbnailPayload() });
  await openApp(page);
  await page.getByRole("button", { name: "New thumbnail" }).click();
  await page.getByLabel("Message Stanley").fill("I tested waking up at 5am for 30 days");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.locator(".assistant-option")).toHaveCount(6);
  await expect(page.locator(".assistant-option").first()).toContainText(buildThumbnails()[0].visual);
  await expect(page.getByRole("button", { name: "Copy all thumbnail concepts" })).toBeVisible();
});

test("keeps a prominent new-video control in the sidebar", async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole("link", { name: "New video", exact: true })).toBeVisible();
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
