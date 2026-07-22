import { fetchChannelVideos, fetchVideoTranscript } from "../../youtube/oauth";
import type { YouTubeSession } from "../../youtube/oauth";
import { objectWithOnly, ToolRegistry } from "./tool-registry";
import type { ToolDefinition, ToolResult, ToolSource } from "./types";

type ResearchVideo = {
  id: string;
  title: string;
  channel: string;
  views: number;
  viewsPerDay: number;
  publishedAt: string;
  durationSeconds: number;
  thumbnailUrl: string;
  url: string;
};

type SearchData = {
  query: string;
  videos: ResearchVideo[];
  resolvedChannel?: {
    requestedName: string;
    title: string;
    corrected: boolean;
  };
};

type YouTubeToolOptions = {
  apiKey?: string;
  session: YouTubeSession | null;
  researchTopic?: string;
  researchContext?: string;
  requestedPublishedWithinHours?: number;
  forceMostPopularChart?: boolean;
  allowPublicSearch?: boolean;
  allowChannelSnapshot?: boolean;
  allowVideoEvidence?: boolean;
  fixedPublicChannelName?: string;
};

type SearchResponse = {
  items?: Array<{ id?: { videoId?: string; channelId?: string }; snippet?: { channelId?: string; channelTitle?: string; title?: string } }>;
  nextPageToken?: string;
  pageInfo?: { totalResults?: number };
  error?: { message?: string };
};

type ChannelListResponse = {
  items?: Array<{ id?: string; snippet?: { title?: string } }>;
  error?: { message?: string };
};

type VideoListResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      description?: string;
      channelTitle?: string;
      publishedAt?: string;
      tags?: string[];
      categoryId?: string;
      thumbnails?: { default?: { url?: string }; medium?: { url?: string }; high?: { url?: string }; maxres?: { url?: string } };
    };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
    contentDetails?: { duration?: string; definition?: string; caption?: string };
    status?: { privacyStatus?: string };
  }>;
  nextPageToken?: string;
  pageInfo?: { totalResults?: number };
  error?: { message?: string };
};

function numberValue(value: unknown) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

const RESEARCH_STOP_WORDS = new Set([
  "about", "based", "best", "can", "channel", "content", "create", "creator", "day", "days", "film", "from", "generate", "help", "her", "his", "hour", "hours", "how", "idea", "last", "like", "local", "long", "look", "make", "minute", "minutes", "most", "need", "one", "our", "past", "performing", "please", "popular", "recent", "review", "reviews", "say", "saying", "script", "similar", "style", "tell", "the", "their", "this", "top", "trending", "use", "video", "videos", "viral", "want", "week", "weeks", "with", "you", "your", "youtube", "youtuber",
]);

function researchWords(value: string) {
  return new Set((value.toLowerCase().match(/[a-z0-9]+/g) || [])
    .map((word) => word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word)
    .filter((word) => word.length >= 3 && !RESEARCH_STOP_WORDS.has(word)));
}

function normalizedChannelName(value: string) {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactChannelName(value: string) {
  return normalizedChannelName(value).replace(/\s+/g, "");
}

const LOOKALIKE_CHANNEL_WORDS = /\b(?:archive|clips?|compilation|fan|highlights?|moments?|podcast|reuploads?|unofficial)\b/i;

function channelCandidates(response: SearchResponse) {
  return (response.items || []).flatMap((item) => {
    const id = item.id?.channelId || item.snippet?.channelId || "";
    const title = item.snippet?.title?.trim() || "";
    return id && title ? [{ id, title }] : [];
  });
}

function videoChannelCandidates(response: SearchResponse) {
  return (response.items || []).flatMap((item) => {
    const id = item.snippet?.channelId || "";
    const title = item.snippet?.channelTitle?.trim() || "";
    return id && title ? [{ id, title }] : [];
  });
}

function relatedChannelName(requestedName: string, candidateTitle: string) {
  const requested = compactChannelName(requestedName);
  const candidate = compactChannelName(candidateTitle);
  return requested.length >= 4 && candidate.length >= 4 && (candidate.includes(requested) || requested.includes(candidate));
}

function contextualChannelQuery(channelName: string, context: string) {
  const channelWords = researchWords(channelName);
  const contextWords = Array.from(researchWords(context))
    .filter((word) => !channelWords.has(word) && !compactChannelName(channelName).includes(word))
    .slice(0, 4);
  return contextWords.length ? `${channelName} ${contextWords.join(" ")}`.slice(0, 100) : "";
}

export function sharedContextualChannelMatch(
  requestedName: string,
  baseCandidates: Array<{ id: string; title: string }>,
  contextualCandidates: Array<{ id: string; title: string }>,
) {
  const baseTop = baseCandidates[0];
  const contextualTop = contextualCandidates[0];
  if (!baseTop || !contextualTop || baseTop.id !== contextualTop.id) return null;
  if (!relatedChannelName(requestedName, baseTop.title) || LOOKALIKE_CHANNEL_WORDS.test(normalizedChannelName(baseTop.title))) return null;
  return baseTop;
}

function leadingChannelMatchFromMixedQuery(requestedName: string, candidates: Array<{ id: string; title: string }>) {
  const requestedWords = Array.from(researchWords(requestedName));
  if (requestedWords.length < 2) return null;
  const top = candidates[0];
  if (!top || LOOKALIKE_CHANNEL_WORDS.test(normalizedChannelName(top.title))) return null;
  const candidate = compactChannelName(top.title);
  return requestedWords.some((word) => word.length >= 4 && candidate.includes(word)) ? top : null;
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

export function uniqueNearChannelMatch(requestedName: string, candidates: Array<{ id: string; title: string }>) {
  const requested = compactChannelName(requestedName);
  if (requested.length < 5) return null;
  const near = candidates.filter((candidate) => {
    const title = compactChannelName(candidate.title);
    return title.length >= 5 && Math.abs(title.length - requested.length) <= 1 && editDistance(requested, title) <= 1;
  });
  const unique = Array.from(new Map(near.map((candidate) => [candidate.id, candidate])).values());
  return unique.length === 1 ? unique[0] : null;
}

export function focusResearchQuery(requestedQuery: string, researchTopic = "") {
  const requested = requestedQuery.replace(/\s+/g, " ").trim().slice(0, 100);
  const anchor = researchTopic.replace(/\s+/g, " ").trim().slice(0, 100);
  if (!anchor) return requested;
  const anchorWords = researchWords(anchor);
  if (!anchorWords.size) return requested || anchor;
  const requestedWords = researchWords(requested);
  return Array.from(anchorWords).some((word) => requestedWords.has(word)) ? requested : anchor;
}

function parseDurationSeconds(duration: string) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function youtubeSource(video: ResearchVideo, capturedAt: string): ToolSource {
  return { id: `youtube:${video.id}`, label: `${video.title} · ${video.channel}`, url: video.url, capturedAt };
}

async function youtubeRequest<T>(url: URL, options: YouTubeToolOptions, signal: AbortSignal) {
  const headers: HeadersInit = {};
  if (options.session?.accessToken) headers.Authorization = `Bearer ${options.session.accessToken}`;
  else if (options.apiKey) url.searchParams.set("key", options.apiKey);
  else throw new Error("YouTube research is not configured. Connect a channel or add a server API key.");

  const response = await fetch(url, { headers, signal });
  const payload = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(`YouTube ${response.status}: ${payload.error?.message || "request failed"}`);
  return payload;
}

function channelSnapshotTool(options: YouTubeToolOptions): ToolDefinition {
  return {
    name: "youtube_channel_snapshot",
    description: "Read the explicitly connected creator channel and a bounded set of its recent uploads. Use only for channel-specific personalization or when the creator asks about their own performance. This is private read-only evidence, not proof of YouTube algorithm causation.",
    effect: "read",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        scope: { type: "string", enum: ["connected_channel"], description: "The explicit connected-channel scope." },
        maxVideos: { type: "integer", minimum: 1, maximum: 24, description: "Recent uploads to return. Defaults to 12 when omitted." },
      },
      required: ["scope"],
    },
    validate(value) {
      const object = objectWithOnly(value, ["scope", "maxVideos"], "youtube_channel_snapshot");
      if (object.scope !== "connected_channel") throw new Error("scope must be connected_channel.");
      if (object.maxVideos !== undefined && (!Number.isInteger(object.maxVideos) || Number(object.maxVideos) < 1 || Number(object.maxVideos) > 24)) {
        throw new Error("maxVideos must be an integer from 1 to 24.");
      }
      return object;
    },
    async execute(args, context) {
      if (!options.session) {
        return {
          ok: false,
          tool: "youtube_channel_snapshot",
          status: "empty",
          summary: "No YouTube channel is connected for this conversation.",
          data: { connected: false },
          coverage: { returned: 0, complete: true },
          sources: [],
          warnings: ["Continue from creator-supplied context or ask them to connect a channel only if channel-specific evidence is essential."],
          error: { code: "CHANNEL_NOT_CONNECTED", message: "No connected channel is available.", retryable: false },
        };
      }

      const capturedAt = new Date().toISOString();
      const maxVideos = Number(args.maxVideos || 12);
      const videos = await fetchChannelVideos(options.session.accessToken, maxVideos, context.signal);
      const profile = options.session.profile;
      const sources: ToolSource[] = [
        { id: `youtube-channel:${profile.id}`, label: profile.title, url: `https://www.youtube.com/channel/${profile.id}`, capturedAt },
        ...videos.map((video) => ({ id: `youtube:${video.id}`, label: video.title, url: video.url, capturedAt })),
      ];
      return {
        ok: true,
        tool: "youtube_channel_snapshot",
        status: videos.length ? "complete" : "empty",
        summary: videos.length ? `Read ${videos.length} recent uploads from ${profile.title}.` : `The connected channel ${profile.title} has no recent uploads available.`,
        data: { connected: true, profile, videos },
        handle: `youtube-channel:${profile.id}:${capturedAt.slice(0, 10)}`,
        coverage: { returned: videos.length, totalKnown: profile.videoCount, complete: videos.length >= Math.min(maxVideos, profile.videoCount) },
        sources,
        warnings: ["Authenticated analytics are a current snapshot. Compare similar formats and small samples cautiously."],
      };
    },
  };
}

async function recentPopularVideos(
  options: YouTubeToolOptions,
  signal: AbortSignal,
  publishedWithinHours: number,
  maxResults: number,
): Promise<ToolResult> {
  const chartUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  chartUrl.search = new URLSearchParams({ part: "snippet,statistics,contentDetails", chart: "mostPopular", maxResults: "50" }).toString();
  const details = await youtubeRequest<VideoListResponse>(chartUrl, options, signal);
  const capturedAt = new Date().toISOString();
  const now = Date.now();
  const cutoff = now - publishedWithinHours * 3_600_000;
  const videos = (details.items || []).flatMap((item): ResearchVideo[] => {
    const id = item.id || "";
    const title = item.snippet?.title?.trim() || "";
    const channel = item.snippet?.channelTitle?.trim() || "Unknown channel";
    const publishedAt = item.snippet?.publishedAt || "";
    const publishedTimestamp = Date.parse(publishedAt);
    if (!id || !title || !publishedAt || !Number.isFinite(publishedTimestamp) || publishedTimestamp < cutoff) return [];
    const views = numberValue(item.statistics?.viewCount);
    const ageDays = Math.max(1 / 24, (now - publishedTimestamp) / 86_400_000);
    const durationSeconds = parseDurationSeconds(item.contentDetails?.duration || "");
    const thumbnails = item.snippet?.thumbnails;
    return [{
      id,
      title,
      channel,
      views,
      viewsPerDay: Math.round(views / ageDays),
      publishedAt,
      durationSeconds,
      thumbnailUrl: thumbnails?.maxres?.url || thumbnails?.high?.url || thumbnails?.medium?.url || thumbnails?.default?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${id}`,
    }];
  }).sort((left, right) => right.views - left.views).slice(0, maxResults);
  const label = `YouTube's most-popular chart from the last ${publishedWithinHours} hours`;
  return {
    ok: true,
    tool: "youtube_search_reference_videos",
    status: videos.length >= Math.min(4, maxResults) ? "complete" : videos.length ? "partial" : "empty",
    summary: videos.length ? `Found ${videos.length} videos on ${label}.` : `No videos on the current most-popular chart were published in the last ${publishedWithinHours} hours.`,
    data: { query: label, videos } satisfies SearchData,
    handle: `youtube-popular:${publishedWithinHours}:${capturedAt.slice(0, 13)}`,
    coverage: { returned: videos.length, totalKnown: details.pageInfo?.totalResults, complete: true },
    sources: videos.map((video) => youtubeSource(video, capturedAt)),
    warnings: [
      "Public view counts are current observations, not historical CTR, retention, or causal algorithm signals.",
      "YouTube's current most-popular chart is a bounded chart, not a complete global ranking of every upload.",
    ],
  };
}

function searchReferenceVideosTool(options: YouTubeToolOptions): ToolDefinition {
  return {
    name: "youtube_search_reference_videos",
    description: "Search current public YouTube videos for explicit comparable evidence, a named public channel, or a requested recent trend window. Use channelName for one named creator and publishedWithinHours for requests such as the last 24 hours. Results show association, not causation.",
    effect: "read",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", minLength: 2, maxLength: 100, description: "An optional plain 2-10 word topic query. Omit it only for an explicitly broad trending search or a channel-wide search." },
        channelName: { type: "string", minLength: 2, maxLength: 100, description: "Exact public creator or channel display name when the creator asks to analyze a named channel." },
        publishedWithinHours: { type: "integer", minimum: 1, maximum: 720, description: "Only return videos published within this many hours. Use 24 for 'the last 24 hours'." },
        maxResults: { type: "integer", minimum: 4, maximum: 25, description: "Maximum comparable videos to return. Defaults to 12." },
        duration: { type: "string", enum: ["long_form", "any"], description: "long_form prefers videos at least 90 seconds. Defaults to long_form; if none are found, shorter uploads are returned as partial style evidence." },
        order: { type: "string", enum: ["view_count", "relevance", "date"], description: "YouTube search order. Defaults to view_count for evidence discovery." },
        pageToken: { type: "string", maxLength: 100, description: "Opaque next-page cursor returned by a previous call." },
      },
      required: [],
    },
    validate(value) {
      const object = objectWithOnly(value, ["query", "channelName", "publishedWithinHours", "maxResults", "duration", "order", "pageToken"], "youtube_search_reference_videos");
      if (object.query !== undefined && (typeof object.query !== "string" || object.query.trim().length < 2 || object.query.trim().length > 100)) throw new Error("query must be 2 to 100 characters when supplied.");
      if (object.channelName !== undefined && (typeof object.channelName !== "string" || object.channelName.trim().length < 2 || object.channelName.trim().length > 100)) throw new Error("channelName must be 2 to 100 characters when supplied.");
      if (object.publishedWithinHours !== undefined && (!Number.isInteger(object.publishedWithinHours) || Number(object.publishedWithinHours) < 1 || Number(object.publishedWithinHours) > 720)) throw new Error("publishedWithinHours must be an integer from 1 to 720.");
      if (object.query === undefined && object.channelName === undefined && object.publishedWithinHours === undefined) throw new Error("supply query, channelName, or publishedWithinHours.");
      if (object.maxResults !== undefined && (!Number.isInteger(object.maxResults) || Number(object.maxResults) < 4 || Number(object.maxResults) > 25)) throw new Error("maxResults must be an integer from 4 to 25.");
      if (object.duration !== undefined && object.duration !== "long_form" && object.duration !== "any") throw new Error("duration must be long_form or any.");
      if (object.order !== undefined && !["view_count", "relevance", "date"].includes(String(object.order))) throw new Error("order must be view_count, relevance, or date.");
      if (object.pageToken !== undefined && (typeof object.pageToken !== "string" || object.pageToken.length > 100)) throw new Error("pageToken is invalid.");
      return {
        ...object,
        ...(typeof object.query === "string" ? { query: object.query.trim() } : {}),
        ...(typeof object.channelName === "string" ? { channelName: object.channelName.trim() } : {}),
      };
    },
    async execute(args, context) {
      const channelName = options.fixedPublicChannelName?.trim()
        || (typeof args.channelName === "string" ? args.channelName.trim() : "");
      const requestedQuery = typeof args.query === "string" ? args.query : "";
      const query = channelName ? requestedQuery.trim().slice(0, 100) : focusResearchQuery(requestedQuery, options.researchTopic);
      const maxResults = Number(args.maxResults || 12);
      const duration = args.duration === "any" || args.publishedWithinHours ? "any" : "long_form";
      const order = String(args.order || "view_count").replace("view_count", "viewCount");
      let channelId = "";
      let resolvedChannelTitle = "";
      let correctedChannelName = false;
      let channelResolution: "exact" | "typo" | "context" = "exact";
      if (channelName) {
        let exactMatches: Array<{ id: string; title: string }> = [];
        if (/^UC[A-Za-z0-9_-]{20,30}$/.test(channelName)) {
          const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
          channelUrl.search = new URLSearchParams({ part: "snippet", id: channelName }).toString();
          const channelLookup = await youtubeRequest<ChannelListResponse>(channelUrl, options, context.signal);
          exactMatches = (channelLookup.items || []).flatMap((item) => item.id
            ? [{ id: item.id, title: item.snippet?.title?.trim() || item.id }]
            : []);
        } else if (/^@[A-Za-z0-9._-]{3,30}$/.test(channelName)) {
          const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
          channelUrl.search = new URLSearchParams({ part: "snippet", forHandle: channelName.slice(1) }).toString();
          const channelLookup = await youtubeRequest<ChannelListResponse>(channelUrl, options, context.signal);
          exactMatches = (channelLookup.items || []).flatMap((item) => item.id
            ? [{ id: item.id, title: item.snippet?.title?.trim() || channelName }]
            : []);
        } else {
          const channelUrl = new URL("https://www.googleapis.com/youtube/v3/search");
          channelUrl.search = new URLSearchParams({ part: "snippet", type: "channel", maxResults: "10", q: channelName }).toString();
          const channelSearch = await youtubeRequest<SearchResponse>(channelUrl, options, context.signal);
          const requestedName = normalizedChannelName(channelName);
          const candidates = channelCandidates(channelSearch);
          exactMatches = candidates.filter((candidate) => normalizedChannelName(candidate.title) === requestedName);
          const topCandidate = candidates[0];
          const topRelatedCandidateChallengesExact = exactMatches.length === 1
            && topCandidate
            && topCandidate.id !== exactMatches[0].id
            && relatedChannelName(channelName, topCandidate.title)
            && !LOOKALIKE_CHANNEL_WORDS.test(normalizedChannelName(topCandidate.title));
          if (topRelatedCandidateChallengesExact) exactMatches = [];
          if (!exactMatches.length) {
            const nearMatch = uniqueNearChannelMatch(channelName, candidates);
            if (nearMatch && nearMatch.id === topCandidate?.id) {
              exactMatches = [nearMatch];
              correctedChannelName = true;
              channelResolution = "typo";
            }
          }
          if (exactMatches.length !== 1) {
            const contextualQuery = contextualChannelQuery(
              channelName,
              [requestedQuery, options.researchContext, options.researchTopic].filter(Boolean).join(" "),
            );
            if (contextualQuery) {
              const contextualUrl = new URL("https://www.googleapis.com/youtube/v3/search");
              contextualUrl.search = new URLSearchParams({ part: "snippet", type: "channel", maxResults: "10", q: contextualQuery }).toString();
              const contextualSearch = await youtubeRequest<SearchResponse>(contextualUrl, options, context.signal);
              const contextualMatch = sharedContextualChannelMatch(channelName, candidates, channelCandidates(contextualSearch));
              if (contextualMatch) {
                exactMatches = [contextualMatch];
                correctedChannelName = true;
                channelResolution = "context";
              }
            }
          }
          if (!exactMatches.length) {
            const mixedQueryMatch = leadingChannelMatchFromMixedQuery(channelName, candidates);
            if (mixedQueryMatch) {
              exactMatches = [mixedQueryMatch];
              correctedChannelName = true;
              channelResolution = "context";
            }
          }
          if (!exactMatches.length) {
            const videoLookupUrl = new URL("https://www.googleapis.com/youtube/v3/search");
            videoLookupUrl.search = new URLSearchParams({
              part: "snippet",
              type: "video",
              maxResults: "10",
              order: "relevance",
              q: channelName,
            }).toString();
            const videoLookup = await youtubeRequest<SearchResponse>(videoLookupUrl, options, context.signal);
            const uploadChannels = videoChannelCandidates(videoLookup);
            const exactUploadChannels = Array.from(new Map(uploadChannels
              .filter((candidate) => normalizedChannelName(candidate.title) === requestedName)
              .map((candidate) => [candidate.id, candidate])).values());
            const uploadMatch = exactUploadChannels.length === 1
              ? exactUploadChannels[0]
              : uniqueNearChannelMatch(channelName, uploadChannels);
            if (uploadMatch && !LOOKALIKE_CHANNEL_WORDS.test(normalizedChannelName(uploadMatch.title))) {
              exactMatches = [uploadMatch];
              correctedChannelName = normalizedChannelName(uploadMatch.title) !== requestedName;
              channelResolution = correctedChannelName ? "typo" : "exact";
            }
          }
        }
        const uniqueMatches = Array.from(new Map(exactMatches.map((item) => [item.id, item])).values());
        if (uniqueMatches.length !== 1) {
          const ambiguous = uniqueMatches.length > 1;
          return {
            ok: true,
            tool: "youtube_search_reference_videos",
            status: "empty",
            summary: ambiguous
              ? `Multiple public YouTube channels use the exact name “${channelName}”, so ownership could not be verified.`
              : `No exact public YouTube channel matched “${channelName}”.`,
            data: { query: channelName, videos: [], candidates: uniqueMatches },
            coverage: { returned: 0, complete: true },
            sources: [],
            warnings: [ambiguous
              ? "Ask for the exact channel URL instead of selecting a lookalike or fan channel."
              : "Ask for the channel URL or exact display name instead of silently substituting another creator."],
          };
        }
        channelId = uniqueMatches[0].id;
        resolvedChannelTitle = uniqueMatches[0].title;
      }
      const publishedWithinHours = Number(args.publishedWithinHours || options.requestedPublishedWithinHours || 0);
      if (publishedWithinHours && !channelId && (options.forceMostPopularChart || researchWords(query).size === 0)) {
        return recentPopularVideos(options, context.signal, publishedWithinHours, maxResults);
      }
      const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      searchUrl.search = new URLSearchParams({
        part: "snippet",
        type: "video",
        maxResults: String(Math.min(50, Math.max(maxResults * 2, 12))),
        order,
        relevanceLanguage: "en",
        safeSearch: "moderate",
        ...(query ? { q: query } : {}),
        ...(channelId ? { channelId } : {}),
        ...(publishedWithinHours ? { publishedAfter: new Date(Date.now() - publishedWithinHours * 3_600_000).toISOString() } : {}),
        ...(args.pageToken ? { pageToken: String(args.pageToken) } : {}),
      }).toString();
      const search = await youtubeRequest<SearchResponse>(searchUrl, options, context.signal);
      const ids = (search.items || []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id));
      if (!ids.length) {
        return {
          ok: true,
          tool: "youtube_search_reference_videos",
          status: "empty",
          summary: `No public videos were returned for “${channelName || query || `the last ${publishedWithinHours} hours`}”.`,
          data: { query: channelName || query || `last ${publishedWithinHours} hours`, videos: [] },
          coverage: { returned: 0, totalKnown: search.pageInfo?.totalResults, complete: !search.nextPageToken, ...(search.nextPageToken ? { nextCursor: search.nextPageToken } : {}) },
          sources: [],
          warnings: ["Broaden the search once while preserving the creator's central subject, then continue without claiming evidence if it remains empty."],
        };
      }

      const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      videosUrl.search = new URLSearchParams({ part: "snippet,statistics,contentDetails", id: ids.join(",") }).toString();
      const details = await youtubeRequest<VideoListResponse>(videosUrl, options, context.signal);
      const capturedAt = new Date().toISOString();
      const now = Date.now();
      const allVideos = (details.items || []).flatMap((item): ResearchVideo[] => {
        const id = item.id || "";
        const title = item.snippet?.title?.trim() || "";
        const channel = item.snippet?.channelTitle?.trim() || "Unknown channel";
        const publishedAt = item.snippet?.publishedAt || "";
        const durationSeconds = parseDurationSeconds(item.contentDetails?.duration || "");
        if (!id || !title || !publishedAt) return [];
        const views = numberValue(item.statistics?.viewCount);
        const ageDays = Math.max(1, (now - Date.parse(publishedAt)) / 86_400_000);
        const thumbnails = item.snippet?.thumbnails;
        return [{
          id,
          title,
          channel,
          views,
          viewsPerDay: Math.round(views / ageDays),
          publishedAt,
          durationSeconds,
          thumbnailUrl: thumbnails?.maxres?.url || thumbnails?.high?.url || thumbnails?.medium?.url || thumbnails?.default?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${id}`,
        }];
      });
      const durationMatches = duration === "long_form"
        ? allVideos.filter((video) => video.durationSeconds >= 90)
        : allVideos;
      const usedShorterFallback = duration === "long_form" && durationMatches.length === 0 && allVideos.length > 0;
      const videos = (usedShorterFallback ? allVideos : durationMatches)
        .sort((left, right) => right.viewsPerDay - left.viewsPerDay || right.views - left.views)
        .slice(0, maxResults);
      const sources = videos.map((video) => youtubeSource(video, capturedAt));
      const searchLabel = resolvedChannelTitle || channelName || query || `the last ${publishedWithinHours} hours`;
      const status = usedShorterFallback ? "partial" : videos.length >= Math.min(4, maxResults) ? "complete" : videos.length ? "partial" : "empty";
      return {
        ok: true,
        tool: "youtube_search_reference_videos",
        status,
        summary: usedShorterFallback
          ? `No long-form uploads appeared in this result set, so ${videos.length} shorter public uploads were kept as partial style evidence for “${searchLabel}”.`
          : videos.length
            ? `Found ${videos.length} public videos for “${searchLabel}”.`
            : `The search returned videos, but none matched the requested duration for “${searchLabel}”.`,
        data: {
          query: searchLabel,
          videos,
          ...(resolvedChannelTitle ? {
            resolvedChannel: { requestedName: channelName, title: resolvedChannelTitle, corrected: correctedChannelName },
          } : {}),
        } satisfies SearchData,
        handle: `youtube-search:${encodeURIComponent(searchLabel.toLowerCase()).slice(0, 80)}:${capturedAt.slice(0, 10)}`,
        coverage: { returned: videos.length, totalKnown: search.pageInfo?.totalResults, complete: !search.nextPageToken, ...(search.nextPageToken ? { nextCursor: search.nextPageToken } : {}) },
        sources,
        warnings: [
          ...(channelResolution === "typo" ? [`Resolved the likely misspelling “${channelName}” to the unique near-match channel “${resolvedChannelTitle}”.`] : []),
          ...(channelResolution === "context" ? [`Resolved “${channelName}” to “${resolvedChannelTitle}” because it was the leading name match for both the creator search and the current video topic.`] : []),
          ...(usedShorterFallback ? ["No long-form upload matched the first result set; use the shorter uploads only for observable channel style, not long-form structure."] : []),
          "Public view counts and views per day are current observations, not historical CTR, retention, or causal algorithm signals.",
        ],
      };
    },
  };
}

function videoEvidenceTool(options: YouTubeToolOptions): ToolDefinition {
  return {
    name: "youtube_get_video_evidence",
    description: "Read exact current metadata and public statistics for one explicit YouTube video ID. Use after the creator references a specific video or when a search result needs closer inspection. Transcript availability is reported honestly; never infer a transcript from metadata.",
    effect: "read",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        videoId: { type: "string", minLength: 6, maxLength: 20, pattern: "^[A-Za-z0-9_-]+$", description: "The exact YouTube video ID chosen from creator input or tool evidence." },
        includeTranscript: { type: "boolean", description: "Request an exact transcript when authorized and available. Defaults to false; the current YouTube integration may report it unavailable." },
      },
      required: ["videoId"],
    },
    validate(value) {
      const object = objectWithOnly(value, ["videoId", "includeTranscript"], "youtube_get_video_evidence");
      if (typeof object.videoId !== "string" || !/^[A-Za-z0-9_-]{6,20}$/.test(object.videoId)) throw new Error("videoId must be an exact YouTube video ID.");
      if (object.includeTranscript !== undefined && typeof object.includeTranscript !== "boolean") throw new Error("includeTranscript must be true or false.");
      return object;
    },
    async execute(args, context) {
      const videoId = String(args.videoId);
      const url = new URL("https://www.googleapis.com/youtube/v3/videos");
      url.search = new URLSearchParams({ part: "snippet,statistics,contentDetails,status", id: videoId }).toString();
      const response = await youtubeRequest<VideoListResponse>(url, options, context.signal);
      const video = response.items?.[0];
      if (!video?.id) {
        return {
          ok: true,
          tool: "youtube_get_video_evidence",
          status: "empty",
          summary: `No accessible video matched ${videoId}.`,
          data: { videoId },
          coverage: { returned: 0, totalKnown: 0, complete: true },
          sources: [],
          warnings: ["Do not silently substitute a similar video."],
        };
      }

      const capturedAt = new Date().toISOString();
      const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
      const transcriptRequested = args.includeTranscript === true;
      const transcript = transcriptRequested && options.session
        ? await fetchVideoTranscript(options.session, video.id, context.signal)
        : { status: "unavailable" as const, text: null, reason: transcriptRequested ? "Connect the owner channel to read this video's captions." : "Transcript was not requested." };
      const transcriptAvailable = transcript.status === "available";
      return {
        ok: true,
        tool: "youtube_get_video_evidence",
        status: transcriptRequested && !transcriptAvailable ? "partial" : "complete",
        summary: `Read current metadata and statistics for “${video.snippet?.title || video.id}”.${transcriptAvailable ? " Owner-authorized captions were included." : transcriptRequested ? " An exact transcript was not available." : ""}`,
        data: {
          id: video.id,
          title: video.snippet?.title || "Untitled video",
          description: video.snippet?.description || "",
          channel: video.snippet?.channelTitle || "Unknown channel",
          publishedAt: video.snippet?.publishedAt || "",
          tags: (video.snippet?.tags || []).slice(0, 30),
          categoryId: video.snippet?.categoryId || "",
          views: numberValue(video.statistics?.viewCount),
          likes: numberValue(video.statistics?.likeCount),
          comments: numberValue(video.statistics?.commentCount),
          durationSeconds: parseDurationSeconds(video.contentDetails?.duration || ""),
          definition: video.contentDetails?.definition || "",
          captionsDeclared: video.contentDetails?.caption === "true",
          privacyStatus: video.status?.privacyStatus || "unknown",
          thumbnailUrl: video.snippet?.thumbnails?.maxres?.url || video.snippet?.thumbnails?.high?.url || video.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
          transcript,
          url: videoUrl,
        },
        handle: `youtube-video:${video.id}:${capturedAt}`,
        coverage: { returned: 1, totalKnown: 1, complete: !transcriptRequested || transcriptAvailable },
        sources: [{ id: `youtube:${video.id}`, label: video.snippet?.title || video.id, url: videoUrl, capturedAt }],
        warnings: transcriptRequested && !transcriptAvailable ? ["Do not invent spoken content when an exact caption track is unavailable."] : [],
      };
    },
  };
}

export function createYouTubeToolRegistry(options: YouTubeToolOptions) {
  const tools: ToolDefinition[] = [];
  if (options.allowChannelSnapshot !== false) tools.push(channelSnapshotTool(options));
  if (options.allowPublicSearch !== false) tools.push(searchReferenceVideosTool(options));
  if (options.allowVideoEvidence !== false) tools.push(videoEvidenceTool(options));
  return new ToolRegistry(tools);
}

export function researchFromToolResults(results: ToolResult[]) {
  const searches = results.filter((result) => result.tool === "youtube_search_reference_videos" && result.ok);
  const latest = searches.at(-1);
  if (!latest || !latest.data || typeof latest.data !== "object") return undefined;
  const data = latest.data as Partial<SearchData>;
  const videos = Array.isArray(data.videos) ? data.videos : [];
  if (!videos.length) return undefined;
  return {
    query: typeof data.query === "string" ? data.query : "YouTube reference research",
    analyzed: videos.length,
    examples: videos.slice(0, 6).map((video) => ({
      id: video.id,
      title: video.title,
      channel: video.channel,
      views: video.views,
      viewsPerDay: video.viewsPerDay,
      publishedAt: video.publishedAt,
      url: video.url,
    })),
    coverage: latest.status === "complete" ? "strong" : "limited",
  };
}
