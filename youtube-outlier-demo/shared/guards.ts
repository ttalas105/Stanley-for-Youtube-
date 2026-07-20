import type {
  ApiVideo,
  BackgroundMessage,
  ChannelAnalysisResponse,
  ChannelSummary,
  ContentMessage,
  ExtensionResponse,
  SupportedChannelIdentifier,
} from "./types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unknown error occurred.";
}

export function isSupportedChannelIdentifier(value: unknown): value is SupportedChannelIdentifier {
  if (!isRecord(value) || typeof value.value !== "string" || value.value.trim().length === 0) return false;
  return value.type === "handle" || value.type === "channelId";
}

export function isBackgroundMessage(value: unknown): value is BackgroundMessage {
  if (!isRecord(value)) return false;
  if (value.type === "ANALYZE_CHANNEL") return isSupportedChannelIdentifier(value.channel);
  if (value.type === "GET_CHANNEL_SNAPSHOTS") return typeof value.channelId === "string" && value.channelId.length > 0;
  return value.type === "GET_VIDEO_SNAPSHOTS" && typeof value.videoId === "string" && value.videoId.length > 0;
}

export function isContentMessage(value: unknown): value is ContentMessage {
  return isRecord(value) && value.type === "PING_CONTENT_SCRIPT";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isChannelSummary(value: unknown): value is ChannelSummary {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.title === "string"
    && (value.handle === null || typeof value.handle === "string")
    && (value.avatarUrl === null || typeof value.avatarUrl === "string")
    && isNullableNumber(value.subscriberCount)
    && isNullableNumber(value.totalChannelViews);
}

function isApiVideo(value: unknown): value is ApiVideo {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.title === "string"
    && (value.thumbnailUrl === null || typeof value.thumbnailUrl === "string")
    && typeof value.publishedAt === "string"
    && typeof value.durationSeconds === "number"
    && typeof value.viewCount === "number"
    && isNullableNumber(value.likeCount)
    && isNullableNumber(value.commentCount)
    && typeof value.youtubeUrl === "string";
}

export function isChannelAnalysisResponse(value: unknown): value is ChannelAnalysisResponse {
  return isRecord(value)
    && isChannelSummary(value.channel)
    && typeof value.scannedAt === "string"
    && Array.isArray(value.videos)
    && value.videos.every(isApiVideo);
}

export function isExtensionResponse<T>(value: unknown, isData: (data: unknown) => data is T): value is ExtensionResponse<T> {
  if (!isRecord(value) || typeof value.ok !== "boolean") return false;
  return value.ok ? isData(value.data) : typeof value.error === "string";
}
