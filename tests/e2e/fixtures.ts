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
  return Array.from({ length: 8 }, (_, index) => ({
    id: `idea-${index + 1}`,
    idea: `A filmable creator experiment number ${index + 1}`,
    hook: `Open with the surprising constraint behind experiment ${index + 1}.`,
    whyItCouldWork: "It gives the viewer a clear question and a concrete outcome to anticipate.",
  }));
}

export function buildIdeaPayload() {
  return {
    reply: "I found eight distinct directions grounded in what viewers already respond to.",
    ideas: buildIdeas(),
    research: buildResearch("creator productivity experiments"),
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
  await page.goto("/");
  await waitForApp(page);
}

export async function generate(page: Page, topic = topics.primary) {
  await fillRequiredBrief(page, topic);
  await page.getByRole("button", { name: "Send message" }).click();
  await page.locator("article.title-card").first().waitFor({ state: "visible" });
}
