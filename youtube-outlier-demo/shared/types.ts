export type ChannelIdentifier =
  | { type: "handle"; value: string }
  | { type: "channelId"; value: string }
  | { type: "username"; value: string }
  | { type: "customName"; value: string };

export type SupportedChannelIdentifier = Extract<
  ChannelIdentifier,
  { type: "handle" | "channelId" }
>;

export interface ChannelSummary {
  id: string;
  title: string;
  handle: string | null;
  avatarUrl: string | null;
  subscriberCount: number | null;
  totalChannelViews: number | null;
}

export interface ApiVideo {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  youtubeUrl: string;
}

export interface ChannelAnalysisResponse {
  channel: ChannelSummary;
  videos: ApiVideo[];
  scannedAt: string;
}

export interface ChannelSnapshot {
  channelId: string;
  capturedAt: string;
  subscriberCount: number | null;
  totalChannelViews: number | null;
  analyzedVideoCount: number;
}

export interface VideoSnapshot {
  videoId: string;
  channelId: string;
  capturedAt: string;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  title: string;
  thumbnailUrl: string | null;
}

export interface SnapshotPayload {
  channelSnapshot: ChannelSnapshot;
  videoSnapshots: VideoSnapshot[];
}

export interface SnapshotStoreData {
  version: 1;
  channels: Record<string, ChannelSnapshot[]>;
  videos: Record<string, VideoSnapshot[]>;
}

export type BackgroundMessage =
  | { type: "ANALYZE_CHANNEL"; channel: SupportedChannelIdentifier }
  | { type: "GET_CHANNEL_SNAPSHOTS"; channelId: string }
  | { type: "GET_VIDEO_SNAPSHOTS"; videoId: string };

export type ContentMessage =
  | { type: "PING_CONTENT_SCRIPT" }
  | { type: "START_SCAN" };

export type ExtensionResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface ErrorResponse {
  error: string;
}

export interface YouTubeThumbnail { url?: string }
export type YouTubeThumbnails = Partial<Record<"default" | "medium" | "high" | "standard" | "maxres", YouTubeThumbnail>>;
export interface YouTubeChannelItem {
  id?: string;
  snippet?: { title?: string; customUrl?: string; thumbnails?: YouTubeThumbnails };
  statistics?: { hiddenSubscriberCount?: boolean; subscriberCount?: string; viewCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
}
export interface YouTubePlaylistItem { contentDetails?: { videoId?: string } }
export interface YouTubeVideoItem {
  id?: string;
  snippet?: { title?: string; publishedAt?: string; thumbnails?: YouTubeThumbnails };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
}
export interface YouTubeListResponse<T> { items?: T[] }

export interface HttpError extends Error { status: number }
