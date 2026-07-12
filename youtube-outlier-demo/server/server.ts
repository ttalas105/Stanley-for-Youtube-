import dotenv from "dotenv";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import { SnapshotStore } from "./snapshot-store";
import type {
  ApiVideo, ChannelAnalysisResponse, ChannelSnapshot, HttpError, SnapshotPayload,
  SupportedChannelIdentifier, VideoSnapshot, YouTubeChannelItem, YouTubeListResponse,
  YouTubePlaylistItem, YouTubeThumbnails, YouTubeVideoItem,
} from "../shared/types";
import { getErrorMessage, isRecord } from "../shared/guards";

dotenv.config({ path: path.join(__dirname, __dirname.endsWith(`${path.sep}dist`) ? ".." : ".", ".env") });

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.YOUTUBE_API_KEY;
const EXTENSION_ID = process.env.EXTENSION_ID?.trim() || null;
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const MAX_UPLOADS = 50;
const REQUEST_TIMEOUT_MS = 15000;
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX = 30;
const requestCounts = new Map<string, { startedAt: number; count: number }>();
const snapshotStore = new SnapshotStore(process.env.SNAPSHOT_FILE || undefined);

app.disable("x-powered-by");
app.use(express.json({ limit: "128kb", strict: true }));
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.get("Origin");
  if (origin && !isAllowedOrigin(origin)) {
    res.status(403).json({ error: "Origin not allowed." });
    return;
  }

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});
app.use((req: Request, res: Response, next: NextFunction) => {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "local";
  const current = requestCounts.get(key);
  const entry = !current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS ? { startedAt: now, count: 0 } : current;
  entry.count += 1;
  requestCounts.set(key, entry);
  if (entry.count > RATE_LIMIT_MAX) {
    res.setHeader("Retry-After", String(Math.ceil((RATE_LIMIT_WINDOW_MS - (now - entry.startedAt)) / 1000)));
    res.status(429).json({ error: "Too many requests. Try again shortly." });
    return;
  }
  next();
});

app.post("/analyze-channel", async (req: Request, res: Response) => {
  try {
    if (!API_KEY || API_KEY === "PASTE_KEY_HERE") {
      res.status(500).json({ error: "Missing YouTube API key. Add it to server/.env as YOUTUBE_API_KEY." });
      return;
    }

    const channelRequest = validateChannelRequest(req.body);
    const channel = await resolveChannel(channelRequest);
    const playlistItems = await getUploads(channel.uploadsPlaylistId);

    if (playlistItems.length === 0) {
      res.status(404).json({ error: "No recent uploads found for this channel." });
      return;
    }

    const videoIds = playlistItems.map((item) => item.contentDetails?.videoId).filter((id): id is string => Boolean(id));
    const videos = await getVideos(videoIds);
    const normalizedVideos = videos.map(normalizeVideo);

    const capturedAt = new Date().toISOString();
    const payload = {
      channel: {
        id: channel.id,
        title: channel.title,
        handle: channel.handle,
        avatarUrl: channel.avatarUrl,
        subscriberCount: channel.subscriberCount,
        totalChannelViews: channel.totalChannelViews
      },
      scannedAt: capturedAt,
      videos: normalizedVideos
    };
    await snapshotStore.record(toChannelSnapshot(payload), normalizedVideos.map((video) => toVideoSnapshot(payload, video)));
    res.json(payload);
  } catch (error: unknown) {
    const status = isHttpError(error) ? error.status : 500;
    res.status(status).json({ error: getErrorMessage(error) });
  }
});

app.post("/api/snapshots/channel", async (req: Request, res: Response) => {
  try {
    const { channelSnapshot, videoSnapshots } = validateSnapshotPayload(req.body);
    const result = await snapshotStore.record(channelSnapshot, videoSnapshots);
    res.status(result.channelAdded || result.videosAdded ? 201 : 200).json(result);
  } catch (error: unknown) {
    res.status(isHttpError(error) ? error.status : 500).json({ error: getErrorMessage(error) });
  }
});

app.get("/api/snapshots/channel/:channelId", async (req: Request<{ channelId: string }>, res: Response) => {
  try {
    const channelId = validateChannelId(req.params.channelId);
    res.json(await snapshotStore.channel(channelId));
  } catch (error: unknown) { res.status(isHttpError(error) ? error.status : 500).json({ error: getErrorMessage(error) }); }
});

app.get("/api/snapshots/video/:videoId", async (req: Request<{ videoId: string }>, res: Response) => {
  try {
    const videoId = validateVideoId(req.params.videoId);
    res.json({ videoId, snapshots: await snapshotStore.video(videoId) });
  } catch (error: unknown) { res.status(isHttpError(error) ? error.status : 500).json({ error: getErrorMessage(error) }); }
});

if (require.main === module) app.listen(PORT, "127.0.0.1", () => {
  console.log(`YouTube outlier demo backend running on http://localhost:${PORT}`);
});

function isAllowedOrigin(origin: string): boolean {
  if (!origin.startsWith("chrome-extension://")) return false;
  if (!EXTENSION_ID) return /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
  return origin === `chrome-extension://${EXTENSION_ID}`;
}

function validateChannelRequest(body: unknown): SupportedChannelIdentifier {
  const type = isRecord(body) ? body.type : undefined;
  const value = isRecord(body) && typeof body.value === "string" ? body.value.trim() : "";

  if (type === "handle") {
    if (!/^@[A-Za-z0-9._-]{3,30}$/.test(value)) {
      throw httpError(400, "Invalid channel handle.");
    }

    return { type, value };
  }

  if (type === "channelId") {
    if (!/^UC[a-zA-Z0-9_-]{20,}$/.test(value)) {
      throw httpError(400, "Invalid channel ID.");
    }

    return { type, value };
  }

  throw httpError(400, "Invalid channel request.");
}

async function resolveChannel(channelRequest: SupportedChannelIdentifier) {
  const params: Record<string, string> = {
    part: "snippet,statistics,contentDetails"
  };

  if (channelRequest.type === "handle") {
    params.forHandle = channelRequest.value;
  } else {
    params.id = channelRequest.value;
  }

  const data = await youtubeGet<YouTubeChannelItem>("/channels", params);
  const item = data.items?.[0];

  if (!item) {
    throw httpError(404, "Channel not found.");
  }

  const uploadsPlaylistId = item.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    throw httpError(404, "Uploads playlist not found for this channel.");
  }

  return {
    id: item.id || "",
    title: item.snippet?.title || "Unknown channel",
    handle: item.snippet?.customUrl || (channelRequest.type === "handle" ? channelRequest.value : null),
    avatarUrl: pickThumbnail(item.snippet?.thumbnails) || null,
    subscriberCount: item.statistics?.hiddenSubscriberCount
      ? null
      : optionalStatistic(item.statistics?.subscriberCount),
    totalChannelViews: optionalStatistic(item.statistics?.viewCount),
    uploadsPlaylistId
  };
}

async function getUploads(playlistId: string): Promise<YouTubePlaylistItem[]> {
  const data = await youtubeGet<YouTubePlaylistItem>("/playlistItems", {
    part: "contentDetails",
    playlistId,
    maxResults: String(MAX_UPLOADS)
  });

  return data.items || [];
}

async function getVideos(videoIds: string[]): Promise<YouTubeVideoItem[]> {
  if (videoIds.length === 0) {
    return [];
  }

  const data = await youtubeGet<YouTubeVideoItem>("/videos", {
    part: "snippet,statistics,contentDetails",
    id: videoIds.join(","),
    maxResults: String(videoIds.length)
  });

  return data.items || [];
}

async function youtubeGet<T>(path: string, params: Record<string, string>): Promise<YouTubeListResponse<T>> {
  const url = new URL(`${YOUTUBE_API_BASE}${path}`);
  url.searchParams.set("key", API_KEY || "");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw mapYouTubeError(response.status, data);
  }

  if (!isRecord(data) || (data.items !== undefined && !Array.isArray(data.items))) throw httpError(502, "Invalid YouTube API response.");
  return data as unknown as YouTubeListResponse<T>;
}

function mapYouTubeError(status: number, data: unknown): HttpError {
  const apiError = isRecord(data) && isRecord(data.error) ? data.error : null;
  const first = apiError && Array.isArray(apiError.errors) && isRecord(apiError.errors[0]) ? apiError.errors[0] : null;
  const reason = first && typeof first.reason === "string" ? first.reason : undefined;
  const message = apiError && typeof apiError.message === "string" ? apiError.message : undefined;

  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
    return httpError(429, "YouTube API quota exceeded.");
  }

  if (status === 403 && reason) {
    return httpError(403, `YouTube API error: ${reason}.`);
  }

  return httpError(status, message || "YouTube API request failed.");
}

function normalizeVideo(item: YouTubeVideoItem): ApiVideo {
  return {
    id: item.id || "",
    title: item.snippet?.title || "Untitled video",
    thumbnailUrl: pickThumbnail(item.snippet?.thumbnails) || null,
    publishedAt: item.snippet?.publishedAt || new Date(0).toISOString(),
    durationSeconds: parseDurationSeconds(item.contentDetails?.duration || "PT0S"),
    viewCount: Number(item.statistics?.viewCount || 0),
    likeCount: optionalStatistic(item.statistics?.likeCount),
    commentCount: optionalStatistic(item.statistics?.commentCount),
    youtubeUrl: `https://www.youtube.com/watch?v=${item.id}`
  };
}

function pickThumbnail(thumbnails: YouTubeThumbnails = {}): string {
  return (
    thumbnails.maxres?.url ||
    thumbnails.standard?.url ||
    thumbnails.high?.url ||
    thumbnails.medium?.url ||
    thumbnails.default?.url ||
    ""
  );
}

function parseDurationSeconds(duration: string): number {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(duration);
  if (!match) {
    return 0;
  }

  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);

  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

function optionalStatistic(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toChannelSnapshot(payload: ChannelAnalysisResponse): ChannelSnapshot {
  return { channelId: payload.channel.id, capturedAt: payload.scannedAt,
    subscriberCount: payload.channel.subscriberCount, totalChannelViews: payload.channel.totalChannelViews,
    analyzedVideoCount: payload.videos.length };
}

function toVideoSnapshot(payload: ChannelAnalysisResponse, video: ApiVideo): VideoSnapshot {
  return { videoId: video.id, channelId: payload.channel.id, capturedAt: payload.scannedAt,
    viewCount: video.viewCount, likeCount: video.likeCount, commentCount: video.commentCount,
    title: video.title, thumbnailUrl: video.thumbnailUrl };
}

function validateSnapshotPayload(body: unknown): SnapshotPayload {
  const channel = isRecord(body) ? body.channelSnapshot : undefined;
  const videos = isRecord(body) ? body.videoSnapshots : undefined;
  if (!channel || !Array.isArray(videos) || videos.length > MAX_UPLOADS) throw httpError(400, "Invalid snapshot payload.");
  if (!isRecord(channel)) throw httpError(400, "Invalid snapshot payload.");
  const channelId = validateChannelId(channel.channelId);
  const capturedAt = validateTimestamp(channel.capturedAt);
  const channelSnapshot = { channelId, capturedAt,
    subscriberCount: nullableCount(channel.subscriberCount), totalChannelViews: nullableCount(channel.totalChannelViews),
    analyzedVideoCount: requiredCount(channel.analyzedVideoCount) };
  const videoSnapshots = videos.map((video: unknown): VideoSnapshot => {
    if (!isRecord(video)) throw httpError(400, "Invalid snapshot payload.");
    if (video.channelId !== channelId || validateTimestamp(video.capturedAt) !== capturedAt) throw httpError(400, "Snapshot scan identifiers do not match.");
    return { videoId: validateVideoId(video.videoId), channelId, capturedAt,
      viewCount: requiredCount(video.viewCount), likeCount: nullableCount(video.likeCount), commentCount: nullableCount(video.commentCount),
      title: typeof video.title === "string" ? video.title.slice(0, 500) : "Untitled video",
      thumbnailUrl: video.thumbnailUrl === null ? null : validateUrl(video.thumbnailUrl) };
  });
  return { channelSnapshot, videoSnapshots };
}

function validateChannelId(value: unknown): string { if (typeof value !== "string" || !/^UC[a-zA-Z0-9_-]{20,}$/.test(value)) throw httpError(400, "Invalid channel ID."); return value; }
function validateVideoId(value: unknown): string { if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{6,20}$/.test(value)) throw httpError(400, "Invalid video ID."); return value; }
function validateTimestamp(value: unknown): string { if (typeof value !== "string") throw httpError(400, "Invalid snapshot timestamp."); const time = Date.parse(value); if (!Number.isFinite(time)) throw httpError(400, "Invalid snapshot timestamp."); return new Date(time).toISOString(); }
function requiredCount(value: unknown): number { const number = Number(value); if (!Number.isSafeInteger(number) || number < 0) throw httpError(400, "Invalid public count."); return number; }
function nullableCount(value: unknown): number | null { return value === null || value === undefined ? null : requiredCount(value); }
function validateUrl(value: unknown): string { if (typeof value !== "string") throw httpError(400, "Invalid thumbnail URL."); try { const url = new URL(value); if (url.protocol !== "https:") throw new Error(); return url.toString(); } catch (_error) { throw httpError(400, "Invalid thumbnail URL."); } }

function httpError(status: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
}

function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error && "status" in error && typeof error.status === "number";
}

export { app, validateSnapshotPayload, toChannelSnapshot, toVideoSnapshot };
