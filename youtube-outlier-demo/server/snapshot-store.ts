import fs from "node:fs/promises";
import path from "node:path";
import { growth as G, type GrowthInterval } from "../extension/growth";
import type { ChannelSnapshot, SnapshotStoreData, VideoSnapshot } from "../shared/types";

const DEFAULT_RETENTION = 100;
const DEDUPE_MS = 30 * 60 * 1000;

class SnapshotStore {
  readonly filePath: string;
  readonly retention: number;
  private writeQueue: Promise<unknown>;

  constructor(filePath = path.join(__dirname, __dirname.endsWith(`${path.sep}dist`) ? ".." : ".", "data", "snapshots.json"), options: { retention?: number } = {}) {
    this.filePath = filePath;
    this.retention = options.retention || DEFAULT_RETENTION;
    this.writeQueue = Promise.resolve();
  }

  async read(): Promise<SnapshotStoreData> {
    try {
      const value = JSON.parse(await fs.readFile(this.filePath, "utf8"));
      return normalizeStore(value);
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === "ENOENT") return emptyStore();
      if (error instanceof SyntaxError) throw new Error("Snapshot storage is corrupted.");
      throw error;
    }
  }

  record(channelSnapshot: ChannelSnapshot, videoSnapshots: readonly VideoSnapshot[]) {
    const task = this.writeQueue.then(async () => {
      const store = await this.read();
      const channelItems = store.channels[channelSnapshot.channelId] || [];
      const channelAdded = !hasRecent(channelItems, channelSnapshot.capturedAt);
      if (channelAdded) {
        store.channels[channelSnapshot.channelId] = [...channelItems, channelSnapshot]
          .sort(byCapturedAt).slice(-this.retention);
      }
      let videosAdded = 0;
      for (const snapshot of videoSnapshots) {
        const items = store.videos[snapshot.videoId] || [];
        if (hasRecent(items, snapshot.capturedAt)) continue;
        store.videos[snapshot.videoId] = [...items, snapshot].sort(byCapturedAt).slice(-this.retention);
        videosAdded += 1;
      }
      if (channelAdded || videosAdded) await this.write(store);
      return { channelAdded, videosAdded };
    });
    this.writeQueue = task.catch(() => {});
    return task;
  }

  async write(store: SnapshotStoreData): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      await fs.writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      await fs.rename(temporary, this.filePath);
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => {});
    }
  }

  async video(videoId: string): Promise<VideoSnapshot[]> {
    const store = await this.read();
    return G.dedupeSnapshots(store.videos[videoId] || []);
  }

  async channel(channelId: string) {
    const store = await this.read();
    const channelSnapshots = G.sortSnapshots(store.channels[channelId] || []);
    const allVideos = Object.values(store.videos).flat().filter((item) => item.channelId === channelId);
    const grouped = new Map();
    for (const snapshot of allVideos) {
      if (!grouped.has(snapshot.videoId)) grouped.set(snapshot.videoId, []);
      grouped.get(snapshot.videoId).push(snapshot);
    }
    const videos = [...grouped.entries()].map(([videoId, items]) => summarizeVideo(videoId, items));
    const momentum = G.matchChannelIntervals(channelSnapshots, allVideos);
    const validLatest = videos.map((video) => video.latestInterval).filter((item): item is NonNullable<typeof item> => item !== null);
    const positive = validLatest.filter((item): item is typeof item & { viewGain: number } => item.viewGain !== null && item.viewGain >= 0);
    const fastest = [...positive].filter((item): item is typeof item & { viewsPerHour: number } => item.viewsPerHour !== null).sort((a, b) => b.viewsPerHour - a.viewsPerHour)[0] || null;
    const largest = [...positive].sort((a, b) => b.viewGain - a.viewGain)[0] || null;
    return {
      channelId, channelSnapshots, momentum, videos,
      summary: {
        recordedScans: channelSnapshots.length,
        firstCapturedAt: channelSnapshots[0]?.capturedAt || null,
        lastCapturedAt: channelSnapshots.at(-1)?.capturedAt || null,
        totalViewGain: momentum.reduce((sum, item) => sum + item.totalViewGain, 0),
        medianViewsPerHour: G.median(positive.map((item) => item.viewsPerHour)),
        fastestGrowingVideo: fastest, largestAbsoluteGain: largest,
        videosWithComparisons: videos.filter((video) => video.snapshotCount >= 2).length
      },
      titleChanges: videos.flatMap((video) => video.titleHistory.map((change) => ({ videoId: video.videoId, title: video.title, thumbnailUrl: video.thumbnailUrl, ...change }))),
      thumbnailChanges: videos.flatMap((video) => video.thumbnailHistory.map((change) => ({ videoId: video.videoId, title: video.title, ...change })))
    };
  }
}

function summarizeVideo(videoId: string, items: readonly VideoSnapshot[]) {
  const snapshots = G.dedupeSnapshots(items); const latest = snapshots.at(-1);
  const latestInterval = G.intervals(snapshots).at(-1) || null;
  const base = { videoId, title: latest?.title || "Untitled video", thumbnailUrl: latest?.thumbnailUrl || null };
  return { ...base, snapshotCount: snapshots.length,
    latestInterval: latestInterval && latest ? { ...base, capturedAt: latest.capturedAt, ...latestInterval, previous: undefined, current: undefined } : null,
    acceleration: G.acceleration(snapshots, { relative: 0.1, absoluteViewsPerHour: 1 }),
    titleHistory: G.titleHistory(snapshots), thumbnailHistory: G.thumbnailHistory(snapshots) };
}

function hasRecent(items: readonly { capturedAt: string }[], capturedAt: string): boolean {
  const time = Date.parse(capturedAt);
  return items.some((item) => Math.abs(Date.parse(item.capturedAt) - time) < DEDUPE_MS);
}
function byCapturedAt(a: { capturedAt: string }, b: { capturedAt: string }): number { return Date.parse(a.capturedAt) - Date.parse(b.capturedAt); }
function emptyStore(): SnapshotStoreData { return { version: 1, channels: {}, videos: {} }; }
function normalizeStore(value: unknown): SnapshotStoreData {
  if (typeof value !== "object" || value === null) return emptyStore();
  const candidate = value as Partial<SnapshotStoreData>;
  return candidate.version === 1 && candidate.channels && candidate.videos ? candidate as SnapshotStoreData : emptyStore();
}
function isNodeError(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error; }

export { SnapshotStore, DEDUPE_MS };
