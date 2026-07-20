import { NextResponse } from "next/server";
import {
  YOUTUBE_SESSION_COOKIE,
  cookieOptions,
  readYouTubeSession,
  seal,
  youtubeDataApiUrl,
} from "../oauth";
import { PRIVATE_CHANNEL_CACHE, cached } from "../server-cache";

type AnalyticsResponse = {
  columnHeaders?: Array<{ name?: string; columnType?: string; dataType?: string }>;
  rows?: Array<Array<string | number>>;
};

type Period = {
  startDate: string;
  endDate: string;
  days: number;
};

const SUPPORTED_RANGES = new Set([7, 28, 30, 90, 180, 365]);
const DAY_MS = 86_400_000;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || isoDate(date) !== value ? null : date;
}

function shiftDate(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS);
}

function resolvePeriod(url: URL): Period {
  const endFallback = shiftDate(new Date(), -1);
  const range = url.searchParams.get("range") || "28";

  if (range === "custom") {
    const start = parseDate(url.searchParams.get("start"));
    const end = parseDate(url.searchParams.get("end"));
    if (!start || !end || start > end) throw new Error("Choose a valid custom date range.");
    const days = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
    if (days > 730) throw new Error("Custom ranges can include up to 730 days.");
    return { startDate: isoDate(start), endDate: isoDate(end), days };
  }

  const days = Number(range);
  if (!SUPPORTED_RANGES.has(days)) throw new Error("That date range is not supported.");
  const end = endFallback;
  return { startDate: isoDate(shiftDate(end, -(days - 1))), endDate: isoDate(end), days };
}

function previousPeriod(period: Period): Period {
  const start = new Date(`${period.startDate}T00:00:00.000Z`);
  const previousEnd = shiftDate(start, -1);
  return {
    startDate: isoDate(shiftDate(previousEnd, -(period.days - 1))),
    endDate: isoDate(previousEnd),
    days: period.days,
  };
}

async function authenticatedJson<T>(url: URL, accessToken: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`YouTube analytics request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

function analyticsUrl(period: Period, options: Record<string, string>) {
  const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  url.search = new URLSearchParams({
    ids: "channel==MINE",
    startDate: period.startDate,
    endDate: period.endDate,
    ...options,
  }).toString();
  return url;
}

function numberAt(row: Array<string | number> | undefined, index: number) {
  if (!row || row[index] === undefined || row[index] === null || row[index] === "") return null;
  const value = Number(row[index]);
  return Number.isFinite(value) ? value : null;
}

async function aggregateReport(period: Period, accessToken: string) {
  const result = await authenticatedJson<AnalyticsResponse>(analyticsUrl(period, {
    metrics: "views,estimatedMinutesWatched,subscribersGained,subscribersLost,averageViewDuration,averageViewPercentage",
  }), accessToken);
  const row = result.rows?.[0];
  return {
    views: numberAt(row, 0),
    watchMinutes: numberAt(row, 1),
    subscribersGained: numberAt(row, 2),
    subscribersLost: numberAt(row, 3),
    averageViewDuration: numberAt(row, 4),
    averageViewPercentage: numberAt(row, 5),
  };
}

async function timelineReport(period: Period, accessToken: string) {
  const result = await authenticatedJson<AnalyticsResponse>(analyticsUrl(period, {
    dimensions: "day",
    metrics: "views,estimatedMinutesWatched,subscribersGained,subscribersLost",
    sort: "day",
  }), accessToken);
  return (result.rows || []).map((row) => ({
    date: String(row[0] || ""),
    views: numberAt(row, 1) ?? 0,
    watchMinutes: numberAt(row, 2) ?? 0,
    netSubscribers: (numberAt(row, 3) ?? 0) - (numberAt(row, 4) ?? 0),
  }));
}

async function videoReport(period: Period, accessToken: string) {
  const result = await authenticatedJson<AnalyticsResponse>(analyticsUrl(period, {
    dimensions: "video",
    metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares",
    sort: "-views",
    maxResults: "24",
  }), accessToken);
  return (result.rows || []).map((row) => {
    const views = numberAt(row, 1);
    const likes = numberAt(row, 7);
    const comments = numberAt(row, 8);
    const shares = numberAt(row, 9);
    return {
      id: String(row[0] || ""),
      views,
      watchMinutes: numberAt(row, 2),
      averageViewDuration: numberAt(row, 3),
      averageViewPercentage: numberAt(row, 4),
      netSubscribers: (numberAt(row, 5) ?? 0) - (numberAt(row, 6) ?? 0),
      likes,
      comments,
      shares,
      commentRate: views && comments !== null ? Math.round((comments / views) * 100_000) / 1_000 : null,
      interactionRate: views && likes !== null && comments !== null && shares !== null
        ? Math.round(((likes + comments + shares) / views) * 10_000) / 100
        : null,
    };
  }).filter((video) => video.id);
}

async function trafficReport(period: Period, accessToken: string) {
  const result = await authenticatedJson<AnalyticsResponse>(analyticsUrl(period, {
    dimensions: "insightTrafficSourceType",
    metrics: "views,estimatedMinutesWatched",
    sort: "-views",
    maxResults: "25",
  }), accessToken);
  return (result.rows || []).map((row) => ({
    source: String(row[0] || "UNKNOWN"),
    views: numberAt(row, 1) ?? 0,
    watchMinutes: numberAt(row, 2) ?? 0,
  }));
}

async function channelHandle(accessToken: string) {
  const url = youtubeDataApiUrl("channels", { part: "snippet", mine: "true" });
  const result = await authenticatedJson<{
    items?: Array<{ snippet?: { customUrl?: string } }>;
  }>(url, accessToken);
  return result.items?.[0]?.snippet?.customUrl || null;
}

export async function GET(request: Request) {
  const session = await readYouTubeSession();
  if (!session) return NextResponse.json({ error: "Connect YouTube to view channel analytics." }, { status: 401 });

  try {
    const url = new URL(request.url);
    const period = resolvePeriod(url);
    const compare = url.searchParams.get("compare") !== "false";
    const force = url.searchParams.get("refresh") === "true";
    const comparisonPeriod = previousPeriod(period);
    const result = await cached(`channel-analytics:${session.profile.id}:${period.startDate}:${period.endDate}:${compare}`, 2 * 60 * 1000, async () => {
      const [current, comparison, timeline, comparisonTimeline, videos, traffic, comparisonTraffic, handle] = await Promise.all([
        aggregateReport(period, session.accessToken),
        compare ? aggregateReport(comparisonPeriod, session.accessToken) : Promise.resolve(null),
        timelineReport(period, session.accessToken),
        compare ? timelineReport(comparisonPeriod, session.accessToken) : Promise.resolve([]),
        videoReport(period, session.accessToken),
        trafficReport(period, session.accessToken),
        compare ? trafficReport(comparisonPeriod, session.accessToken) : Promise.resolve([]),
        channelHandle(session.accessToken).catch(() => null),
      ]);

      return {
        channel: { handle },
        period,
        comparisonPeriod: compare ? comparisonPeriod : null,
        current,
        comparison,
        timeline,
        comparisonTimeline,
        videos,
        traffic,
        comparisonTraffic,
        updatedAt: new Date().toISOString(),
      };
    }, { force });

    const response = NextResponse.json(result.value);
    response.headers.set("Cache-Control", force ? "no-store" : PRIVATE_CHANNEL_CACHE);
    response.headers.set("Vary", "Cookie");
    response.headers.set("X-Stanley-Cache", result.hit ? "hit" : "miss");
    response.cookies.set(YOUTUBE_SESSION_COOKIE, await seal(session), cookieOptions(request.url));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "YouTube analytics could not be loaded.";
    const status = message.startsWith("Choose") || message.startsWith("Custom") || message.startsWith("That date") ? 400 : 502;
    console.error("Dashboard analytics could not be loaded:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
