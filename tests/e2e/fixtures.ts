import type { Page, Route } from "@playwright/test";

export type MockTitle = {
  id: string;
  title: string;
  angle: string;
  whyItWorks: string;
  characterCount: number;
};

export const topics = {
  primary: "I tested waking up at 5am for 30 days and tracked my energy and focus",
  secondary: "I stopped using my phone after 8pm for one month and tracked my sleep",
};

export function buildTitles(prefix = "5am"): MockTitle[] {
  const options = [
    [`I tried the ${prefix} challenge for 30 days`, "Personal test"],
    [`What waking up at ${prefix} actually changed`, "Open loop"],
    [`30 days of ${prefix}: the honest results`, "Specific proof"],
    [`The hidden cost of a ${prefix} morning`, "Unexpected cost"],
    [`Why my ${prefix} routine almost failed`, "Story tension"],
    [`I tracked every ${prefix} morning for a month`, "Documented proof"],
    [`The ${prefix} habit nobody warns you about`, "Contrarian"],
    [`My energy after 30 mornings at ${prefix}`, "Transformation"],
    [`Does waking up at ${prefix} really make you productive?`, "Question"],
    [`Before you try the ${prefix} routine, watch this`, "Useful warning"],
    [`The first week at ${prefix} was not what I expected`, "Surprise"],
    [`I rebuilt my mornings around ${prefix}`, "Identity shift"],
  ];

  return options.map(([title, angle], index) => ({
    id: `${prefix.replace(/\W/g, "-")}-${index + 1}`,
    title,
    angle,
    whyItWorks: `Uses ${angle.toLowerCase()} to make the outcome concrete without overpromising.`,
    characterCount: title.length,
  }));
}

export function buildResearch(query = "5am morning routine experiment") {
  return {
    query,
    analyzed: 14,
    examples: Array.from({ length: 6 }, (_, index) => ({
      id: `video-${index + 1}`,
      title: `A proven morning routine title ${index + 1}`,
      channel: `Creator ${index + 1}`,
      views: 1_250_000 - index * 80_000,
      viewsPerDay: 9_500 - index * 620,
      publishedAt: "2026-05-01T12:00:00Z",
      url: `https://www.youtube.com/watch?v=video-${index + 1}`,
    })),
  };
}

export function buildPayload(prefix = "5am") {
  return {
    reply: "I reviewed the strongest comparable videos and built a varied set around the clearest promise in your experiment.",
    titles: buildTitles(prefix),
    research: buildResearch(`${prefix} morning routine experiment`),
    mode: "title",
    blocked: false,
    model: "gemini-3.1-flash-lite",
  };
}

export function buildIdeas() {
  return Array.from({ length: 3 }, (_, index) => ({
    id: `idea-${index + 1}`,
    idea: `A filmable creator experiment number ${index + 1}`,
    suggestedTitle: `I Tried Creator Experiment ${index + 1} for 30 Days`,
    format: index === 0 ? "Experiment" : index === 1 ? "Challenge" : "Story",
    difficulty: index === 0 ? "Easy" : index === 1 ? "Moderate" : "Ambitious",
    recommended: index === 0,
    hook: `Open with the surprising constraint behind experiment ${index + 1}.`,
    whyItCouldWork: "It gives the viewer a clear question and a concrete outcome to anticipate.",
    channelFit: "It extends the creator's existing experiment format with a clearer visible payoff.",
    researchBasis: "Fast-moving experiment videos in the comparison set pair a visible constraint with a measurable payoff.",
    sourceNumbers: [index % 6 + 1],
    scriptOutline: {
      opening: `I gave myself one rule for experiment ${index + 1}, and the result was not what I expected.`,
      beats: [
        "Establish the rule, personal stakes, and what will be measured.",
        "Show the first attempt and the earliest point of friction.",
        "Reveal the adjustment that changes the experiment.",
        "Compare the final outcome with the starting expectation.",
      ],
      payoff: "The constraint mattered less than the system it forced me to build.",
    },
  }));
}

export function buildIdeaPayload() {
  return {
    reply: "I found three distinct directions and ranked the strongest fit first.",
    ideas: buildIdeas(),
    research: buildResearch("creator productivity experiments"),
    agent: {
      runId: "idea-run-1",
      modelRounds: 3,
      durationMs: 4820,
      toolCalls: [
        { name: "youtube_channel_snapshot", status: "complete", memoHit: false },
        { name: "youtube_search_reference_videos", status: "complete", memoHit: false },
      ],
    },
    mode: "idea",
    blocked: false,
  };
}

export function buildScript() {
  return {
    title: "I tried one rule for 30 days",
    targetLength: "7-9 minutes",
    coldOpen: "For the next 30 days, I followed one rule every morning. I expected better focus. What changed was much stranger.",
    sections: [
      { heading: "The rule", narration: "Here is the constraint I chose, why it felt difficult, and the baseline I recorded before starting." },
      { heading: "The first week", narration: "The first few days exposed the gap between what I thought would happen and what actually happened." },
      { heading: "The adjustment", narration: "Halfway through, I changed one part of the system without changing the rule itself." },
      { heading: "The result", narration: "At the end, I compared the final measurements with the baseline and found the clearest difference." },
    ],
    ending: "The rule was useful, but not for the reason I expected. If you try it, measure the part that matters to you before you begin.",
  };
}

export function buildScriptPayload() {
  return {
    reply: "I turned that direction into a complete, speakable script.",
    script: buildScript(),
    research: buildResearch("creator experiment script"),
    mode: "idea",
    blocked: false,
  };
}

export function buildThumbnails() {
  return Array.from({ length: 6 }, (_, index) => ({
    id: `thumbnail-${index + 1}`,
    concept: `Visual direction ${index + 1}`,
    visual: `Tight subject crop with one clear prop and a high-contrast background for concept ${index + 1}.`,
    textOverlay: index % 2 ? "THE RESULT" : "NO WAY",
    whyItWorks: "The single focal point creates immediate tension without repeating the title.",
  }));
}

export function buildThumbnailPayload() {
  return {
    reply: "I built six clear visual directions that complement the video promise.",
    thumbnails: buildThumbnails(),
    mode: "thumbnail",
    blocked: false,
  };
}

type MockOptions = {
  delayMs?: number;
  handler?: (route: Route) => Promise<void>;
  payload?: Record<string, unknown>;
  status?: number;
};

export async function mockGeneration(page: Page, options: MockOptions = {}) {
  await page.route("**/api/generate-titles", async (route) => {
    if (options.handler) {
      await options.handler(route);
      return;
    }
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    await route.fulfill({
      status: options.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(options.payload ?? buildPayload()),
    });
  });
}

export async function fillRequiredBrief(page: Page, topic = topics.primary) {
  await page.getByLabel("Message Stanley").fill(topic);
}

export async function waitForApp(page: Page) {
  await page.locator('html[data-stanley-ready="true"]').waitFor({ state: "attached" });
}

export async function openApp(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem("stanley-onboarding-v1", "skipped"));
  await page.goto("/");
  await waitForApp(page);
  if (!await page.getByLabel("Message Stanley").isVisible()) {
    const create = page.getByRole("button", { name: "Create", exact: true });
    if (await create.isVisible()) await create.click();
  }
}

export async function generate(page: Page, topic = topics.primary) {
  await fillRequiredBrief(page, topic);
  await page.getByRole("button", { name: "Send message" }).click();
  await page.getByRole("button", { name: "Copy all titles" }).waitFor({ state: "visible" });
}
