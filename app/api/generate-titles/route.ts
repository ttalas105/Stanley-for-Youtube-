type GenerateRequest = {
  topic?: unknown;
  audience?: unknown;
  tone?: unknown;
  references?: unknown;
};

type ModelTitle = {
  title: string;
  angle: string;
  whyItWorks: string;
};

type ResearchVideo = {
  id: string;
  title: string;
  channel: string;
  views: number;
  viewsPerDay: number;
  publishedAt: string;
  url: string;
};

type VideoCandidate = ResearchVideo & {
  durationSeconds: number;
};

type ResearchCoverage = "strong" | "limited" | "none";

type CachedResearch = {
  expiresAt: number;
  query: string;
  videos: ResearchVideo[];
  coverage: ResearchCoverage;
};

const MODEL = "gemini-3.1-flash-lite";
const requestLog = new Map<string, number[]>();
const researchCache = new Map<string, CachedResearch>();

const querySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    queries: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" },
      description: "Three concise YouTube search queries from specific to broad, each 2 to 7 words with no punctuation.",
    },
  },
  required: ["queries"],
} as const;

const titleSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    titles: {
      type: "array",
      minItems: 12,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: {
            type: "string",
            description: "A natural, specific YouTube title between 35 and 85 characters.",
          },
          angle: {
            type: "string",
            description: "A compact 1-3 word label for the click psychology used.",
          },
          whyItWorks: {
            type: "string",
            description: "One plain-English sentence explaining the title's appeal without hype.",
          },
        },
        required: ["title", "angle", "whyItWorks"],
      },
    },
  },
  required: ["titles"],
} as const;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isRateLimited(request: Request) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local";
  const now = Date.now();
  const recent = (requestLog.get(ip) || []).filter((timestamp) => now - timestamp < 60_000);
  recent.push(now);
  requestLog.set(ip, recent);

  if (requestLog.size > 500) {
    for (const [key, timestamps] of requestLog) {
      if (!timestamps.some((timestamp) => now - timestamp < 60_000)) requestLog.delete(key);
    }
  }
  return recent.length > 10;
}

function parseDurationSeconds(duration: string) {
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function normalizeTitles(value: unknown): ModelTitle[] {
  if (!value || typeof value !== "object" || !("titles" in value)) return [];
  const rawTitles = (value as { titles?: unknown }).titles;
  if (!Array.isArray(rawTitles)) return [];

  const unique = new Map<string, ModelTitle>();
  for (const item of rawTitles) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    const title = cleanText(candidate.title, 100);
    const angle = cleanText(candidate.angle, 32);
    const whyItWorks = cleanText(candidate.whyItWorks, 240);
    if (title.length < 15 || !angle || !whyItWorks) continue;
    const key = title.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
    if (!unique.has(key)) unique.set(key, { title, angle, whyItWorks });
  }
  return Array.from(unique.values()).slice(0, 12);
}

async function generateJson(
  apiKey: string,
  systemInstruction: string,
  prompt: string,
  schema: object,
  maxOutputTokens: number,
) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          maxOutputTokens,
          thinkingConfig: { thinkingLevel: "minimal" },
        },
      }),
    },
  );

  const result = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };

  if (!response.ok) throw new Error(`Gemini ${response.status}: ${result.error?.message || "unknown error"}`);
  const output = result.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  if (!output) throw new Error("Gemini returned an empty response");
  return JSON.parse(output) as unknown;
}

async function fetchYouTubeCandidates(query: string, youtubeKey: string) {
  const searchParams = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "50",
    order: "viewCount",
    q: query,
    relevanceLanguage: "en",
    safeSearch: "moderate",
    key: youtubeKey,
  });
  const searchResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams}`);
  const searchData = (await searchResponse.json()) as {
    items?: Array<{ id?: { videoId?: string } }>;
    error?: { message?: string };
  };
  if (!searchResponse.ok) throw new Error(`YouTube search ${searchResponse.status}: ${searchData.error?.message || "unknown error"}`);

  const ids = (searchData.items || []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id));
  if (!ids.length) return [];

  const videoParams = new URLSearchParams({
    part: "snippet,statistics,contentDetails",
    id: ids.join(","),
    key: youtubeKey,
  });
  const videoResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${videoParams}`);
  const videoData = (await videoResponse.json()) as {
    items?: Array<{
      id?: string;
      snippet?: { title?: string; channelTitle?: string; publishedAt?: string };
      statistics?: { viewCount?: string };
      contentDetails?: { duration?: string };
    }>;
    error?: { message?: string };
  };
  if (!videoResponse.ok) throw new Error(`YouTube videos ${videoResponse.status}: ${videoData.error?.message || "unknown error"}`);

  const now = Date.now();
  return (videoData.items || []).map((item): VideoCandidate | null => {
    const id = item.id || "";
    const title = cleanText(item.snippet?.title, 180);
    const channel = cleanText(item.snippet?.channelTitle, 120);
    const publishedAt = item.snippet?.publishedAt || "";
    const views = Number(item.statistics?.viewCount || 0);
    const durationSeconds = parseDurationSeconds(item.contentDetails?.duration || "");
    const ageDays = Math.max(1, (now - Date.parse(publishedAt)) / 86_400_000);
    if (!id || !title || !publishedAt || !durationSeconds) return null;
    return { id, title, channel, views, viewsPerDay: Math.round(views / ageDays), publishedAt, durationSeconds, url: `https://www.youtube.com/watch?v=${id}` };
  }).filter((item): item is VideoCandidate => item !== null);
}

function selectResearchVideos(candidates: VideoCandidate[]) {
  const strict = candidates.filter((video) => video.views >= 1_000 && video.durationSeconds >= 120);
  const relaxed = candidates.filter((video) => video.views >= 250 && video.durationSeconds >= 90);
  const broad = candidates.filter((video) => video.durationSeconds >= 60);
  const pool = strict.length >= 4 ? strict : relaxed.length >= 4 ? relaxed : broad;
  const coverage: ResearchCoverage = strict.length >= 4 ? "strong" : pool.length > 0 ? "limited" : "none";
  const videos = pool
    .sort((a, b) => b.viewsPerDay - a.viewsPerDay || b.views - a.views)
    .slice(0, 14)
    .map((video) => ({
      id: video.id,
      title: video.title,
      channel: video.channel,
      views: video.views,
      viewsPerDay: video.viewsPerDay,
      publishedAt: video.publishedAt,
      url: video.url,
    }));
  return { videos, coverage };
}

async function researchYouTube(topic: string, geminiKey: string, youtubeKey: string) {
  let queryCandidates: string[] = [];
  try {
    const queryResult = await generateJson(
      geminiKey,
      "Create three YouTube research queries for a creator's video brief. Start with the closest comparable-video query, then broaden the wording and category while preserving the central subject. Return only the requested JSON.",
      topic,
      querySchema,
      160,
    ) as { queries?: unknown };
    if (Array.isArray(queryResult.queries)) {
      queryCandidates = queryResult.queries.map((value) => cleanText(value, 100)).filter(Boolean);
    }
  } catch (error) {
    console.warn("YouTube query planning failed; using the creator brief.", error);
  }

  const fallbackQuery = topic.split(/\s+/).slice(0, 7).join(" ");
  const queries = Array.from(new Set([...queryCandidates, fallbackQuery].map((query) => query.toLocaleLowerCase()))).slice(0, 3);
  const primaryQuery = queries[0] || fallbackQuery;
  const cacheKey = primaryQuery.toLocaleLowerCase();
  const cached = researchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const collected = new Map<string, VideoCandidate>();
  let selection = selectResearchVideos([]);
  for (const query of queries.slice(0, 2)) {
    try {
      const candidates = await fetchYouTubeCandidates(query, youtubeKey);
      for (const video of candidates) collected.set(video.id, video);
      selection = selectResearchVideos(Array.from(collected.values()));
      if (selection.videos.length >= 4) break;
    } catch (error) {
      console.warn(`YouTube research failed for query "${query}"; continuing without blocking generation.`, error);
      break;
    }
  }

  const cacheDuration = selection.coverage === "strong" ? 6 * 60 * 60 * 1000 : selection.coverage === "limited" ? 30 * 60 * 1000 : 10 * 60 * 1000;
  const research: CachedResearch = { query: primaryQuery, videos: selection.videos, coverage: selection.coverage, expiresAt: Date.now() + cacheDuration };
  researchCache.set(cacheKey, research);
  return research;
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return Response.json({ error: "Too many drafts at once. Wait a minute and try again." }, { status: 429 });
  }

  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return Response.json({ error: "The video brief could not be read." }, { status: 400 });
  }

  const topic = cleanText(body.topic, 900);
  const audience = cleanText(body.audience, 180);
  const references = cleanText(body.references, 700);
  const tone = cleanText(body.tone, 30) || "Curious";
  if (!topic) return Response.json({ error: "A video idea is required." }, { status: 400 });

  const geminiKey = process.env.GEMINI_API_KEY;
  const youtubeKey = process.env.YOUTUBE_API_KEY;
  if (!geminiKey || !youtubeKey) {
    return Response.json(
      { error: "Research is not connected yet. Add the Gemini and YouTube server keys to enable evidence-based titles." },
      { status: 503 },
    );
  }

  try {
    const research = await researchYouTube(topic, geminiKey, youtubeKey);
    const researchLines = research.videos.map((video, index) =>
      `${index + 1}. “${video.title}” — ${video.views.toLocaleString("en-US")} views, ~${video.viewsPerDay.toLocaleString("en-US")} views/day`,
    ).join("\n");
    const evidenceSection = researchLines
      ? `REAL COMPARABLE VIDEOS RANKED BY CURRENT VIEW VELOCITY:\n${researchLines}`
      : "RESEARCH COVERAGE:\nNo close YouTube comparisons were available. Use established title-packaging principles and the creator's brief without inventing evidence or facts.";
    const evidenceInstruction = research.coverage === "strong"
      ? "Infer the useful patterns in the successful examples: framing, specificity, tension, promise, and syntax."
      : research.coverage === "limited"
        ? "Use the available comparisons as directional evidence only; rely primarily on the creator's actual idea and do not overstate what the examples prove."
        : "Use sound YouTube packaging principles without claiming that a pattern was supported by comparison videos.";
    const referenceSection = references
      ? `\n\nCREATOR'S STYLE REFERENCES (borrow only rhythm—not facts or wording):\n${references}`
      : "";
    const prompt = `VIDEO IDEA:\n${topic}\n\nTARGET VIEWER:\n${audience || "Infer the most likely viewer from the idea."}\n\nVOICE:\n${tone}\n\n${evidenceSection}${referenceSection}\n\n${evidenceInstruction} Then draft exactly 12 genuinely different titles for the creator's actual idea. Do not copy phrases or make every title resemble the same example. Cover a deliberate mix of curiosity, stakes, transformation, specificity, contrarian framing, personal story, useful promise, and surprising tension.`;

    const titleResult = await generateJson(
      geminiKey,
      `You are Stanley, a senior YouTube packaging strategist. When real comparison titles are provided, learn their underlying packaging patterns but never copy distinctive wording. When evidence is limited or absent, rely on established packaging principles and never pretend the research proved something it did not. Write credible titles a real creator would publish. Prioritize clarity, specificity, natural spoken language, and an honest curiosity gap. Avoid generic AI phrasing, ALL CAPS, fake quotes, fabricated numbers, repeated formulas, and words like “unleash”, “ultimate”, “game-changer”, or “you won't believe”. Never introduce facts not present in the creator's brief. Keep most titles under 70 characters and every title under 86 characters. Use sentence case unless a proper noun requires otherwise. Each explanation must name the psychological angle and explain its relevance to the creator's idea.`,
      prompt,
      titleSchema,
      2200,
    );
    const generated = normalizeTitles(titleResult);
    if (generated.length !== 12) throw new Error(`Gemini returned ${generated.length} usable titles`);

    return Response.json({
      titles: generated.map((item) => ({ ...item, id: crypto.randomUUID(), characterCount: Array.from(item.title).length })),
      research: {
        query: research.query,
        analyzed: research.videos.length,
        examples: research.videos.slice(0, 6),
        coverage: research.coverage,
      },
      model: MODEL,
    });
  } catch (error) {
    console.error("Title generation failed:", error);
    return Response.json({ error: "The research draft failed to generate. Check the API keys or try again." }, { status: 502 });
  }
}
