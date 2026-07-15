import { fetchChannelVideos } from "../../youtube/oauth";
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
};

type YouTubeToolOptions = {
  apiKey?: string;
  session: YouTubeSession | null;
};

type SearchResponse = {
  items?: Array<{ id?: { videoId?: string } }>;
  nextPageToken?: string;
  pageInfo?: { totalResults?: number };
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
  error?: { message?: string };
};

function numberValue(value: unknown) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
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

function searchReferenceVideosTool(options: YouTubeToolOptions): ToolDefinition {
  return {
    name: "youtube_search_reference_videos",
    description: "Search current public YouTube videos for explicit comparable evidence. Use when fresh examples materially improve an idea, packaging decision, or comparison. Search one clear premise at a time; if results are empty, broaden the query once. Results show association, not causation.",
    effect: "read",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", minLength: 2, maxLength: 100, description: "A plain 2-10 word YouTube search query preserving the central subject." },
        maxResults: { type: "integer", minimum: 4, maximum: 25, description: "Maximum comparable videos to return. Defaults to 12." },
        duration: { type: "string", enum: ["long_form", "any"], description: "long_form keeps videos at least 90 seconds. Defaults to long_form." },
        order: { type: "string", enum: ["view_count", "relevance", "date"], description: "YouTube search order. Defaults to view_count for evidence discovery." },
        pageToken: { type: "string", maxLength: 100, description: "Opaque next-page cursor returned by a previous call." },
      },
      required: ["query"],
    },
    validate(value) {
      const object = objectWithOnly(value, ["query", "maxResults", "duration", "order", "pageToken"], "youtube_search_reference_videos");
      if (typeof object.query !== "string" || object.query.trim().length < 2 || object.query.trim().length > 100) throw new Error("query must be 2 to 100 characters.");
      if (object.maxResults !== undefined && (!Number.isInteger(object.maxResults) || Number(object.maxResults) < 4 || Number(object.maxResults) > 25)) throw new Error("maxResults must be an integer from 4 to 25.");
      if (object.duration !== undefined && object.duration !== "long_form" && object.duration !== "any") throw new Error("duration must be long_form or any.");
      if (object.order !== undefined && !["view_count", "relevance", "date"].includes(String(object.order))) throw new Error("order must be view_count, relevance, or date.");
      if (object.pageToken !== undefined && (typeof object.pageToken !== "string" || object.pageToken.length > 100)) throw new Error("pageToken is invalid.");
      return { ...object, query: object.query.trim() };
    },
    async execute(args, context) {
      const query = String(args.query);
      const maxResults = Number(args.maxResults || 12);
      const duration = args.duration === "any" ? "any" : "long_form";
      const order = String(args.order || "view_count").replace("view_count", "viewCount");
      const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      searchUrl.search = new URLSearchParams({
        part: "snippet",
        type: "video",
        maxResults: String(Math.min(50, Math.max(maxResults * 2, 12))),
        order,
        q: query,
        relevanceLanguage: "en",
        safeSearch: "moderate",
        ...(args.pageToken ? { pageToken: String(args.pageToken) } : {}),
      }).toString();
      const search = await youtubeRequest<SearchResponse>(searchUrl, options, context.signal);
      const ids = (search.items || []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id));
      if (!ids.length) {
        return {
          ok: true,
          tool: "youtube_search_reference_videos",
          status: "empty",
          summary: `No comparable videos were returned for “${query}”.`,
          data: { query, videos: [] },
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
      const videos = (details.items || []).flatMap((item): ResearchVideo[] => {
        const id = item.id || "";
        const title = item.snippet?.title?.trim() || "";
        const channel = item.snippet?.channelTitle?.trim() || "Unknown channel";
        const publishedAt = item.snippet?.publishedAt || "";
        const durationSeconds = parseDurationSeconds(item.contentDetails?.duration || "");
        if (!id || !title || !publishedAt || (duration === "long_form" && durationSeconds < 90)) return [];
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
      }).sort((left, right) => right.viewsPerDay - left.viewsPerDay || right.views - left.views).slice(0, maxResults);
      const sources = videos.map((video) => youtubeSource(video, capturedAt));
      const status = videos.length >= Math.min(4, maxResults) ? "complete" : videos.length ? "partial" : "empty";
      return {
        ok: true,
        tool: "youtube_search_reference_videos",
        status,
        summary: videos.length ? `Found ${videos.length} current comparable videos for “${query}”.` : `The search returned videos, but none matched the explicit duration filter for “${query}”.`,
        data: { query, videos } satisfies SearchData,
        handle: `youtube-search:${encodeURIComponent(query.toLowerCase()).slice(0, 80)}:${capturedAt.slice(0, 10)}`,
        coverage: { returned: videos.length, totalKnown: search.pageInfo?.totalResults, complete: !search.nextPageToken, ...(search.nextPageToken ? { nextCursor: search.nextPageToken } : {}) },
        sources,
        warnings: ["Public view counts and views per day are current observations, not historical CTR, retention, or causal algorithm signals."],
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
      const transcript = { status: "unavailable" as const, text: null, reason: transcriptRequested ? "The current read-only YouTube integration does not expose an exact transcript for this video." : "Transcript was not requested." };
      return {
        ok: true,
        tool: "youtube_get_video_evidence",
        status: transcriptRequested ? "partial" : "complete",
        summary: `Read current metadata and public statistics for “${video.snippet?.title || video.id}”.${transcriptRequested ? " An exact transcript was not available." : ""}`,
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
        coverage: { returned: 1, totalKnown: 1, complete: !transcriptRequested },
        sources: [{ id: `youtube:${video.id}`, label: video.snippet?.title || video.id, url: videoUrl, capturedAt }],
        warnings: transcriptRequested ? ["Reasoning about the video's spoken content must be limited to creator-supplied media or an exact transcript supplied elsewhere."] : [],
      };
    },
  };
}

export function createYouTubeToolRegistry(options: YouTubeToolOptions) {
  return new ToolRegistry([
    channelSnapshotTool(options),
    searchReferenceVideosTool(options),
    videoEvidenceTool(options),
  ]);
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
