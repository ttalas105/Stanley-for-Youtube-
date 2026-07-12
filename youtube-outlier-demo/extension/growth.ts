import type { ChannelSnapshot, VideoSnapshot } from "../shared/types";

const HOUR_MS = 3_600_000;
type Snapshot = Pick<VideoSnapshot, "capturedAt" | "viewCount" | "likeCount" | "commentCount"> & Partial<VideoSnapshot>;

export interface GrowthInterval {
  previous: Snapshot;
  current: Snapshot;
  elapsedHours: number;
  viewGain: number | null;
  likeGain: number | null;
  commentGain: number | null;
  viewsPerHour: number | null;
  likesPerHour: number | null;
  commentsPerHour: number | null;
  corrected: boolean;
}

export function sortSnapshots<T extends { capturedAt: string }>(items: readonly T[] = []): T[] {
  return [...items].filter((item) => Number.isFinite(Date.parse(item.capturedAt)))
    .sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
}

export function dedupeSnapshots<T extends { capturedAt: string; videoId?: string; channelId?: string }>(items: readonly T[] = []): T[] {
  const seen = new Set<string>();
  return sortSnapshots(items).filter((item) => {
    const key = `${item.videoId || item.channelId || ""}:${new Date(item.capturedAt).toISOString()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function gain(previous: number | null | undefined, current: number | null | undefined): number | null {
  return Number.isFinite(previous) && Number.isFinite(current) ? (current as number) - (previous as number) : null;
}

export function interval(previous: Snapshot, current: Snapshot): GrowthInterval | null {
  const elapsedHours = (Date.parse(current.capturedAt) - Date.parse(previous.capturedAt)) / HOUR_MS;
  if (!Number.isFinite(elapsedHours) || elapsedHours <= 0) return null;
  const viewGain = gain(previous.viewCount, current.viewCount);
  const likeGain = gain(previous.likeCount, current.likeCount);
  const commentGain = gain(previous.commentCount, current.commentCount);
  return {
    previous, current, elapsedHours, viewGain, likeGain, commentGain,
    viewsPerHour: viewGain === null ? null : viewGain / elapsedHours,
    likesPerHour: likeGain === null ? null : likeGain / elapsedHours,
    commentsPerHour: commentGain === null ? null : commentGain / elapsedHours,
    corrected: [viewGain, likeGain, commentGain].some((value) => value !== null && value < 0),
  };
}

export function intervals(items: readonly Snapshot[] = []): GrowthInterval[] {
  const sorted = dedupeSnapshots(items);
  return sorted.slice(1).map((item, index) => {
    const previous = sorted[index];
    return previous ? interval(previous, item) : null;
  }).filter((item): item is GrowthInterval => item !== null);
}

export function median(values: readonly (number | null)[] = []): number | null {
  const valid = values.filter((value): value is number => Number.isFinite(value)).sort((a, b) => a - b);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  const current = valid[middle];
  if (current === undefined) return null;
  const previous = valid[middle - 1];
  return valid.length % 2 ? current : previous === undefined ? null : (previous + current) / 2;
}

export function acceleration(items: readonly Snapshot[] = [], config: { relative?: number; absoluteViewsPerHour?: number } = {}) {
  const valid = intervals(items).filter((item): item is GrowthInterval & { viewGain: number; viewsPerHour: number } => item.viewsPerHour !== null && item.viewGain !== null && item.viewGain >= 0);
  if (valid.length < 2) return null;
  const first = valid.at(-2);
  const second = valid.at(-1);
  if (!first || !second) return null;
  const change = second.viewsPerHour - first.viewsPerHour;
  const tolerance = Math.max(config.absoluteViewsPerHour ?? 1, Math.abs(first.viewsPerHour) * (config.relative ?? 0.1));
  return { change, velocity1: first.viewsPerHour, velocity2: second.viewsPerHour, classification: Math.abs(change) <= tolerance ? "Stable" : change > 0 ? "Accelerating" : "Decelerating" } as const;
}

export function matchChannelIntervals(channelSnapshots: readonly ChannelSnapshot[] = [], videoSnapshots: readonly VideoSnapshot[] = []) {
  const scans = sortSnapshots(channelSnapshots);
  const byScan = new Map<string, Map<string, VideoSnapshot>>();
  for (const snapshot of videoSnapshots) {
    const key = new Date(snapshot.capturedAt).toISOString();
    if (!byScan.has(key)) byScan.set(key, new Map());
    byScan.get(key)?.set(snapshot.videoId, snapshot);
  }
  return scans.slice(1).map((scan, index) => {
    const previousScan = scans[index];
    if (!previousScan) return null;
    const previous = byScan.get(new Date(previousScan.capturedAt).toISOString()) || new Map<string, VideoSnapshot>();
    const current = byScan.get(new Date(scan.capturedAt).toISOString()) || new Map<string, VideoSnapshot>();
    const matched: Array<GrowthInterval & { videoId: string }> = [];
    for (const [videoId, currentSnapshot] of current) {
      const prior = previous.get(videoId);
      if (!prior) continue;
      const value = interval(prior, currentSnapshot);
      if (value) matched.push({ videoId, ...value });
    }
    const positive = matched.filter((item): item is typeof item & { viewGain: number } => item.viewGain !== null && item.viewGain >= 0);
    return { previousCapturedAt: previousScan.capturedAt, capturedAt: scan.capturedAt,
      totalViewGain: positive.reduce((sum, item) => sum + item.viewGain, 0),
      medianViewsPerHour: median(positive.map((item) => item.viewsPerHour)), videosIncluded: matched.length };
  }).filter((item): item is NonNullable<typeof item> => item !== null);
}

interface ObservedChange<T> { value: T; firstObservedAt: string; changedAt: string | null }
function observedHistory<T>(items: readonly VideoSnapshot[], getter: (item: VideoSnapshot) => T, identity: (value: T, item: VideoSnapshot) => string | null): ObservedChange<T>[] {
  const output: ObservedChange<T>[] = [];
  let prior: string | symbol | null = Symbol("first");
  for (const item of dedupeSnapshots(items)) {
    const value = getter(item);
    const key = identity(value, item);
    if (key === prior) continue;
    output.push({ value, firstObservedAt: item.capturedAt, changedAt: output.length ? item.capturedAt : null });
    prior = key;
  }
  return output;
}

export function titleHistory(items: readonly VideoSnapshot[] = []) { return observedHistory(items, (item) => item.title || "Untitled video", (value) => value); }
export function thumbnailIdentity(value: string | null, videoId = ""): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/(?:vi|vi_webp)\/([^/]+)\/([^/]+)/i);
    return match ? `youtube:${match[1] || videoId}:${(match[2] || "").toLowerCase()}` : `${url.origin}${url.pathname}`;
  } catch { return String(value).split(/[?#]/)[0] || ""; }
}
export function thumbnailHistory(items: readonly VideoSnapshot[] = []) { return observedHistory(items, (item) => item.thumbnailUrl, (value, item) => thumbnailIdentity(value, item.videoId)); }
export function formatElapsed(hours: number | null): string {
  if (!Number.isFinite(hours) || (hours as number) < 0) return "Unavailable";
  if ((hours as number) < 1) return `${Math.round((hours as number) * 60)}m`;
  if ((hours as number) < 48) return `${(hours as number).toFixed((hours as number) < 10 ? 1 : 0)}h`;
  return `${((hours as number) / 24).toFixed(1)}d`;
}

export const growth = { sortSnapshots, dedupeSnapshots, gain, interval, intervals, median, acceleration, matchChannelIntervals, titleHistory, thumbnailHistory, thumbnailIdentity, formatElapsed };
