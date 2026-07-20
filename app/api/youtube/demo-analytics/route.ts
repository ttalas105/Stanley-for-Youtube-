import { WILL_TENNYSON_DEMO } from "../../../creator-profiles";
import { loadDemoVideos } from "../demo-videos/route";
import { PUBLIC_DEMO_CACHE, cached } from "../server-cache";

type DemoVideo = {
  id: string;
  title: string;
  publishedAt: string;
  views: number;
};

type Period = { startDate: string; endDate: string; days: number };

const SUPPORTED_RANGES = new Set([7, 30, 90, 180, 365]);
const DAY_MS = 86_400_000;

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function periodEnding(endDate: Date, days: number): Period {
  return { startDate: dateOnly(shiftDate(endDate, -(days - 1))), endDate: dateOnly(endDate), days };
}

function seeded(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4_294_967_295;
}

function videoPeriodViews(video: DemoVideo, period: Period) {
  const publishedAt = new Date(video.publishedAt).getTime();
  const start = new Date(`${period.startDate}T00:00:00Z`).getTime();
  const end = new Date(`${period.endDate}T23:59:59Z`).getTime();
  const ageAtEnd = Math.max(1, Math.ceil((end - publishedAt) / DAY_MS));
  if (publishedAt > end) return 0;
  if (publishedAt >= start) return Math.round(video.views * Math.min(.92, .48 + seeded(video.id) * .34));
  const catalogShare = Math.min(.12, Math.max(.008, period.days / Math.max(60, ageAtEnd) * .08));
  return Math.round(video.views * catalogShare * (.72 + seeded(`${video.id}:catalog`) * .56));
}

function buildVideoAnalytics(videos: DemoVideo[], period: Period) {
  return videos.map((video) => {
    const views = videoPeriodViews(video, period);
    const averageViewDuration = Math.round(430 + seeded(`${video.id}:duration`) * 220);
    const averageViewPercentage = Math.round((42 + seeded(`${video.id}:retention`) * 16) * 10) / 10;
    const likes = Math.round(views * (.035 + seeded(`${video.id}:likes`) * .018));
    const comments = Math.round(views * (.0012 + seeded(`${video.id}:comments`) * .0014));
    const shares = Math.round(views * (.0018 + seeded(`${video.id}:shares`) * .0022));
    return {
      id: video.id,
      views,
      watchMinutes: Math.round(views * averageViewDuration / 60),
      averageViewDuration,
      averageViewPercentage,
      netSubscribers: Math.round(views * (.0017 + seeded(`${video.id}:subs`) * .0014)),
      likes,
      comments,
      shares,
      commentRate: views ? Math.round((comments / views) * 100_000) / 1_000 : 0,
      interactionRate: views ? Math.round(((likes + comments + shares) / views) * 10_000) / 100 : 0,
    };
  }).sort((left, right) => right.views - left.views);
}

function aggregate(videos: ReturnType<typeof buildVideoAnalytics>, multiplier = 1) {
  const views = Math.round(videos.reduce((total, video) => total + video.views, 0) * multiplier);
  const watchMinutes = Math.round(videos.reduce((total, video) => total + video.watchMinutes, 0) * multiplier);
  const weightedDuration = views ? videos.reduce((total, video) => total + video.averageViewDuration * video.views, 0) / Math.max(1, videos.reduce((total, video) => total + video.views, 0)) : 0;
  const weightedPercentage = views ? videos.reduce((total, video) => total + video.averageViewPercentage * video.views, 0) / Math.max(1, videos.reduce((total, video) => total + video.views, 0)) : 0;
  return {
    views,
    watchMinutes,
    subscribersGained: Math.round(videos.reduce((total, video) => total + Math.max(0, video.netSubscribers), 0) * multiplier * 1.14),
    subscribersLost: Math.round(videos.reduce((total, video) => total + Math.max(0, video.netSubscribers), 0) * multiplier * .14),
    averageViewDuration: Math.round(weightedDuration),
    averageViewPercentage: Math.round(weightedPercentage * 10) / 10,
  };
}

function timeline(period: Period, totalViews: number, totalWatchMinutes: number, totalSubscribers: number, seedKey: string) {
  const raw = Array.from({ length: period.days }, (_, index) => {
    const wave = 1 + Math.sin(index * .53 + seeded(seedKey) * 4) * .18;
    const weekend = [0, 6].includes(new Date(`${dateOnly(shiftDate(new Date(`${period.startDate}T00:00:00Z`), index))}T00:00:00Z`).getUTCDay()) ? 1.12 : 1;
    const uploadSpike = index % 8 === 1 ? 1.55 : index % 8 === 2 ? 1.28 : 1;
    return Math.max(.2, wave * weekend * uploadSpike * (.9 + seeded(`${seedKey}:${index}`) * .2));
  });
  const rawTotal = raw.reduce((total, value) => total + value, 0);
  return raw.map((weight, index) => {
    const share = weight / rawTotal;
    return {
      date: dateOnly(shiftDate(new Date(`${period.startDate}T00:00:00Z`), index)),
      views: Math.round(totalViews * share),
      watchMinutes: Math.round(totalWatchMinutes * share),
      netSubscribers: Math.round(totalSubscribers * share),
    };
  });
}

function traffic(views: number, watchMinutes: number, comparison = false) {
  const distribution = comparison
    ? [["RELATED_VIDEO", .36], ["SUBSCRIBER", .24], ["YT_SEARCH", .16], ["SHORTS", .1], ["EXT_URL", .08], ["YT_CHANNEL", .06]] as const
    : [["RELATED_VIDEO", .39], ["SUBSCRIBER", .22], ["YT_SEARCH", .15], ["SHORTS", .11], ["EXT_URL", .07], ["YT_CHANNEL", .06]] as const;
  return distribution.map(([source, share]) => ({ source, views: Math.round(views * share), watchMinutes: Math.round(watchMinutes * share) }));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const days = Number(url.searchParams.get("range") || 30);
  if (!SUPPORTED_RANGES.has(days)) return Response.json({ error: "That demo range is not supported." }, { status: 400 });
  const force = url.searchParams.get("refresh") === "true";

  try {
    const videoResult = await loadDemoVideos(WILL_TENNYSON_DEMO.id, force);
    const end = shiftDate(new Date(), -1);
    const cacheKey = `demo-analytics:${dateOnly(end)}:${days}`;
    const result = await cached(cacheKey, 15 * 60 * 1000, async () => {
      const videoPayload = videoResult.value as { videos?: DemoVideo[] };
      const period = periodEnding(end, days);
      const comparisonPeriod = periodEnding(shiftDate(new Date(`${period.startDate}T00:00:00Z`), -1), days);
      const videos = buildVideoAnalytics(videoPayload.videos || [], period);
      const current = aggregate(videos);
      const comparison = aggregate(videos, .89);
      const currentNet = current.subscribersGained - current.subscribersLost;
      const comparisonNet = comparison.subscribersGained - comparison.subscribersLost;

      return {
        channel: { handle: WILL_TENNYSON_DEMO.handle },
        period,
        comparisonPeriod,
        current,
        comparison,
        timeline: timeline(period, current.views, current.watchMinutes, currentNet, `current:${days}`),
        comparisonTimeline: timeline(comparisonPeriod, comparison.views, comparison.watchMinutes, comparisonNet, `comparison:${days}`),
        videos,
        traffic: traffic(current.views, current.watchMinutes),
        comparisonTraffic: traffic(comparison.views, comparison.watchMinutes, true),
        updatedAt: new Date().toISOString(),
        demo: true,
      };
    }, { force });

    return Response.json(result.value, { headers: { "Cache-Control": force ? "no-store" : PUBLIC_DEMO_CACHE, "X-Stanley-Cache": result.hit && videoResult.hit ? "hit" : "miss" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Demo analytics could not be prepared." }, { status: 502 });
  }
}
