/**
 * Disposable YouTube channel preview for local dashboard UI work.
 *
 * Run:    node .temporary-youtube-channel/mock-proxy.mjs
 * Open:   http://localhost:3002
 * Remove: delete .temporary-youtube-channel when OAuth testing is ready.
 *
 * The channel profile, uploads, thumbnails, durations, and public view counts
 * come from YouTube Data API v3. YouTube Analytics is private OAuth data, so
 * the analytics timeline, traffic mix, and period comparisons are simulated
 * from those public channel signals solely to keep every UI state populated.
 */
import http from "node:http";
import net from "node:net";
import { readFile } from "node:fs/promises";
import {
  MOCK_AVERAGE_VIEW_MINUTES,
  mockAnalyticsTotals,
  normalizedMockTimeline,
} from "./mock-analytics.mjs";

const MOCK_PORT = Number(process.env.MOCK_YOUTUBE_PORT || 3002);
const APP_ORIGIN = process.env.STANLEY_ORIGIN || "http://localhost:3000";
const CHANNEL_HANDLE = process.env.MOCK_YOUTUBE_HANDLE || "@WillTennyson";
const TWIN_HANDLE = process.env.MOCK_YOUTUBE_TWIN_HANDLE || "@JesseJamesWest";
const CACHE_MS = 30 * 60 * 1000;
const DAY_MS = 86_400_000;
const VALID_RANGES = new Set([7, 30, 90, 180, 365]);
const STOP_WORDS = new Set([
  "about", "after", "again", "before", "being", "every", "first", "from", "have", "into", "just",
  "more", "most", "only", "other", "over", "that", "their", "them", "then", "there", "these",
  "they", "this", "through", "video", "what", "when", "where", "which", "while", "with", "would",
  "your", "youtube",
]);

let cachedData = null;
let cacheExpiresAt = 0;
let pendingLoad = null;

function numeric(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function compact(value) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(value) {
  return Math.max(1, (Date.now() - new Date(value).getTime()) / DAY_MS);
}

function durationSeconds(value) {
  const match = String(value || "").match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return numeric(match[1]) * 86_400 + numeric(match[2]) * 3_600 + numeric(match[3]) * 60 + numeric(match[4]);
}

function titleWords(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word));
}

async function localApiKey() {
  if (process.env.YOUTUBE_OAUTH_API_KEY?.trim()) return process.env.YOUTUBE_OAUTH_API_KEY.trim();
  if (process.env.YOUTUBE_API_KEY?.trim()) return process.env.YOUTUBE_API_KEY.trim();

  const source = await readFile(new URL("../.env.local", import.meta.url), "utf8").catch(() => "");
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(YOUTUBE_OAUTH_API_KEY|YOUTUBE_API_KEY)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2").trim();
    if (value) return value;
  }
  throw new Error("Add YOUTUBE_OAUTH_API_KEY to .env.local before starting the mock channel.");
}

async function youtube(resource, parameters) {
  const url = new URL(resource.replace(/^\/+/, ""), "https://www.googleapis.com/youtube/v3/");
  url.search = new URLSearchParams({ ...parameters, key: await localApiKey() }).toString();
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `YouTube Data API returned ${response.status}.`);
  return payload;
}

async function fetchChannel(handle) {
  const payload = await youtube("channels", {
    part: "snippet,statistics,contentDetails",
    forHandle: handle.replace(/^@/, ""),
  });
  const channel = payload.items?.[0];
  if (!channel?.id) throw new Error(`No YouTube channel matched ${handle}.`);
  return {
    id: channel.id,
    title: channel.snippet?.title || handle,
    description: channel.snippet?.description || "",
    customUrl: channel.snippet?.customUrl || handle,
    thumbnailUrl: channel.snippet?.thumbnails?.high?.url
      || channel.snippet?.thumbnails?.medium?.url
      || channel.snippet?.thumbnails?.default?.url
      || "",
    subscriberCount: numeric(channel.statistics?.subscriberCount),
    videoCount: numeric(channel.statistics?.videoCount),
    totalViews: numeric(channel.statistics?.viewCount),
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads || "",
  };
}

async function fetchChannelVideos(channel, maxResults = 50) {
  if (!channel.uploadsPlaylistId) return [];
  const playlist = await youtube("playlistItems", {
    part: "contentDetails",
    playlistId: channel.uploadsPlaylistId,
    maxResults: String(Math.min(50, maxResults)),
  });
  const ids = (playlist.items || []).map((item) => item.contentDetails?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const details = await youtube("videos", {
    part: "snippet,statistics,contentDetails,status",
    id: ids.join(","),
  });
  const byId = new Map((details.items || []).map((video) => [video.id, video]));
  return ids.flatMap((id) => {
    const video = byId.get(id);
    if (!video || video.status?.privacyStatus !== "public") return [];
    return [{
      id,
      title: video.snippet?.title || "Untitled video",
      thumbnailUrl: video.snippet?.thumbnails?.maxres?.url
        || video.snippet?.thumbnails?.standard?.url
        || video.snippet?.thumbnails?.high?.url
        || video.snippet?.thumbnails?.medium?.url
        || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      publishedAt: video.snippet?.publishedAt || "",
      views: numeric(video.statistics?.viewCount),
      duration: video.contentDetails?.duration || "",
      privacyStatus: "public",
      url: `https://www.youtube.com/watch?v=${id}`,
    }];
  });
}

function summarize(videos) {
  const dates = videos.map((video) => new Date(video.publishedAt).getTime()).filter(Number.isFinite).sort((a, b) => b - a);
  const cadence = dates.slice(0, -1).map((date, index) => Math.min(120, Math.max(1, (date - dates[index + 1]) / DAY_MS)));
  const topicCounts = new Map();
  for (const video of videos) {
    for (const word of new Set(titleWords(video.title))) topicCounts.set(word, (topicCounts.get(word) || 0) + 1);
  }
  const topics = [...topicCounts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 10).map(([word]) => word);
  const averageViews = average(videos.map((video) => video.views));
  return {
    averageViews,
    averageDuration: average(videos.map((video) => durationSeconds(video.duration)).filter(Boolean)),
    cadenceDays: average(cadence),
    viewsPerDay: average(videos.map((video) => video.views / daysAgo(video.publishedAt))),
    outlierFrequency: videos.length ? videos.filter((video) => video.views >= averageViews * 1.5).length / videos.length : 0,
    topics,
    numbers: average(videos.map((video) => /\d/.test(video.title) ? 1 : 0)),
    firstPerson: average(videos.map((video) => /\b(i|i'm|i’ve|i've|my|we|our)\b/i.test(video.title) ? 1 : 0)),
    challenge: average(videos.map((video) => /\b(challenge|compete|survive|test|tested|train|trained|try|tried|versus|vs)\b/i.test(video.title) ? 1 : 0)),
  };
}

function overlap(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  const union = new Set([...a, ...b]);
  return union.size ? [...a].filter((value) => b.has(value)).length / union.size : 0;
}

function similarity(own, twin) {
  const topic = overlap(own.topics, twin.topics);
  const title = 1 - Math.min(1, (Math.abs(own.numbers - twin.numbers) + Math.abs(own.firstPerson - twin.firstPerson) + Math.abs(own.challenge - twin.challenge)) / 3);
  const duration = Math.min(own.averageDuration, twin.averageDuration) / Math.max(1, own.averageDuration, twin.averageDuration);
  const cadence = Math.min(own.cadenceDays, twin.cadenceDays) / Math.max(1, own.cadenceDays, twin.cadenceDays);
  return Math.round(Math.min(.98, topic * .42 + title * .28 + duration * .16 + cadence * .14) * 100);
}

function publicProfile(channel, videos) {
  const strongest = [...videos].sort((left, right) => (right.views / daysAgo(right.publishedAt)) - (left.views / daysAgo(left.publishedAt)))[0];
  return {
    id: channel.id,
    title: channel.title,
    thumbnailUrl: channel.thumbnailUrl,
    subscriberCount: channel.subscriberCount,
    videoCount: channel.videoCount,
    totalViews: channel.totalViews,
    strongestVideo: strongest ? {
      id: strongest.id,
      title: strongest.title,
      views: strongest.views,
      viewsPerDay: Math.round(strongest.views / daysAgo(strongest.publishedAt)),
    } : undefined,
    analyzedAt: new Date().toISOString(),
  };
}

function previewAnalytics(channel, videos, rangeDays) {
  const summary = summarize(videos.slice(0, 20));
  const dailyBaseline = Math.max(1_000, summary.averageViews / Math.max(5, summary.cadenceDays || 9));
  const currentViews = Math.round(dailyBaseline * rangeDays * 1.08);
  const totals = mockAnalyticsTotals(currentViews, rangeDays);
  const currentSubscriberLosses = Math.max(1, Math.round(totals.current.netSubscribers * .13));
  const comparisonSubscriberLosses = Math.max(1, Math.round(totals.comparison.netSubscribers * .15));
  const comparisonViews = totals.comparison.views;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - rangeDays + 1);
  const comparisonStart = new Date(start);
  comparisonStart.setUTCDate(comparisonStart.getUTCDate() - rangeDays);
  const comparisonEnd = new Date(start);
  comparisonEnd.setUTCDate(comparisonEnd.getUTCDate() - 1);
  const shares = [.23, .17, .13, .1, .08, .065, .05, .04, .032, .026, .021, .016];
  return {
    channel: { handle: channel.customUrl || CHANNEL_HANDLE },
    period: { startDate: isoDate(start), endDate: isoDate(new Date()), days: rangeDays },
    comparisonPeriod: { startDate: isoDate(comparisonStart), endDate: isoDate(comparisonEnd), days: rangeDays },
    current: {
      views: totals.current.views,
      watchMinutes: totals.current.watchMinutes,
      subscribersGained: totals.current.netSubscribers + currentSubscriberLosses,
      subscribersLost: currentSubscriberLosses,
      averageViewDuration: Math.round(MOCK_AVERAGE_VIEW_MINUTES[rangeDays] * 60),
      averageViewPercentage: 47.6,
    },
    comparison: {
      views: totals.comparison.views,
      watchMinutes: totals.comparison.watchMinutes,
      subscribersGained: totals.comparison.netSubscribers + comparisonSubscriberLosses,
      subscribersLost: comparisonSubscriberLosses,
      averageViewDuration: Math.round(totals.comparison.watchMinutes / Math.max(1, totals.comparison.views) * 60),
      averageViewPercentage: 43.4,
    },
    timeline: normalizedMockTimeline(totals.current, rangeDays),
    comparisonTimeline: normalizedMockTimeline(totals.comparison, rangeDays, true),
    videos: videos.slice(0, shares.length).map((video, index) => {
      const views = Math.round(currentViews * shares[index]);
      const likes = Math.round(views * Math.max(.028, .061 - index * .0022));
      const comments = Math.round(views * Math.max(.0011, .0032 - index * .00014));
      const shareCount = Math.round(views * Math.max(.0007, .0017 - index * .00008));
      return {
        id: video.id,
        views,
        watchMinutes: Math.round(views * (6.8 - index * .24)),
        averageViewDuration: Math.max(300, 408 - index * 13),
        averageViewPercentage: Math.max(35, 51.7 - index * 2.1),
        netSubscribers: Math.round(views * Math.max(.0038, .007 - index * .00035)),
        likes,
        comments,
        shares: shareCount,
        commentRate: Math.round((comments / Math.max(1, views)) * 100_000) / 1_000,
        interactionRate: Math.round(((likes + comments + shareCount) / Math.max(1, views)) * 10_000) / 100,
      };
    }),
    traffic: [
      { source: "SUBSCRIBER", views: Math.round(currentViews * .38), watchMinutes: Math.round(currentViews * .38 * 6.6) },
      { source: "RELATED_VIDEO", views: Math.round(currentViews * .24), watchMinutes: Math.round(currentViews * .24 * 6.2) },
      { source: "YT_SEARCH", views: Math.round(currentViews * .16), watchMinutes: Math.round(currentViews * .16 * 6.1) },
      { source: "SHORTS", views: Math.round(currentViews * .09), watchMinutes: Math.round(currentViews * .09 * 2.4) },
      { source: "EXT_URL", views: Math.round(currentViews * .07), watchMinutes: Math.round(currentViews * .07 * 5.7) },
      { source: "NOTIFICATION", views: Math.round(currentViews * .04), watchMinutes: Math.round(currentViews * .04 * 7.1) },
    ],
    comparisonTraffic: [
      { source: "SUBSCRIBER", views: Math.round(comparisonViews * .44), watchMinutes: Math.round(comparisonViews * .44 * 6.2) },
      { source: "RELATED_VIDEO", views: Math.round(comparisonViews * .16), watchMinutes: Math.round(comparisonViews * .16 * 5.8) },
      { source: "YT_SEARCH", views: Math.round(comparisonViews * .15), watchMinutes: Math.round(comparisonViews * .15 * 5.9) },
      { source: "SHORTS", views: Math.round(comparisonViews * .11), watchMinutes: Math.round(comparisonViews * .11 * 2.2) },
      { source: "EXT_URL", views: Math.round(comparisonViews * .07), watchMinutes: Math.round(comparisonViews * .07 * 5.4) },
      { source: "NOTIFICATION", views: Math.round(comparisonViews * .04), watchMinutes: Math.round(comparisonViews * .04 * 6.8) },
    ],
    preview: { publicData: true, simulatedAnalytics: true },
    updatedAt: new Date().toISOString(),
  };
}

function socialLinks(channel) {
  const links = [];
  const found = channel.description.match(/https?:\/\/[^\s<>"')]+/gi) || [];
  const add = (platform, label, url) => {
    if (!links.some((item) => item.platform === platform)) links.push({ platform, label, url });
  };
  for (const raw of found) {
    try {
      const url = new URL(raw.replace(/[.,;]+$/, ""));
      const handle = url.pathname.split("/").filter(Boolean)[0] || url.hostname;
      if (url.hostname.includes("instagram.com")) add("instagram", `@${handle.replace(/^@/, "")}`, url.toString());
      else if (url.hostname === "x.com" || url.hostname.includes("twitter.com")) add("x", `@${handle.replace(/^@/, "")}`, url.toString());
      else if (!url.hostname.includes("youtube.com") && !url.hostname.includes("youtu.be")) add("website", url.hostname.replace(/^www\./, ""), url.toString());
    } catch {
      // Ignore malformed public description links.
    }
  }
  add("youtube", channel.title, `https://www.youtube.com/${channel.customUrl || channel.id}`);
  return links.slice(0, 4);
}

function creatorTwinResult(channel, videos, twinChannel, twinVideos) {
  const own = summarize(videos.slice(0, 30));
  const twin = summarize(twinVideos.slice(0, 30));
  const performanceRatio = twin.averageViews / Math.max(1, own.averageViews);
  const cadenceGap = Math.round(Math.abs(twin.cadenceDays - own.cadenceDays));
  const durationGap = Math.round(Math.abs(twin.averageDuration - own.averageDuration) / 60);
  const titleGap = Math.round(Math.abs(twin.numbers - own.numbers) * 100);
  const topicMatch = Math.round(overlap(own.topics, twin.topics) * 100);
  const topVideos = [...twinVideos].sort((left, right) => right.views - left.views).slice(0, 5);
  const titleDirection = twin.numbers >= own.numbers ? "uses specific numbers more often" : "uses fewer number-led titles";
  return {
    generatedAt: new Date().toISOString(),
    cached: true,
    creator: {
      id: twinChannel.id,
      name: twinChannel.title,
      avatarUrl: twinChannel.thumbnailUrl,
      similarity: similarity(own, twin),
      primaryNiche: "Fitness · Challenges",
      averageViews: Math.round(twin.averageViews),
      recentMomentum: `${performanceRatio.toFixed(1)}× your views per video`,
      outlierFrequency: `${Math.round(twin.outlierFrequency * 100)}% became big hits`,
      channelUrl: `https://www.youtube.com/${twinChannel.customUrl || twinChannel.id}`,
    },
    whyMatched: [
      `${topicMatch}% overlap in common title topics`,
      "Both channels use first-person fitness challenges",
      `Videos are usually within ${Math.max(1, durationGap)} minutes of the same length`,
      `Upload schedules are about ${Math.max(1, cadenceGap)} days apart`,
    ],
    differences: [
      { category: "Views", detail: "Views per recent video", twin: `${compact(twin.averageViews)} per video`, you: `${compact(own.averageViews)} per video` },
      { category: "Upload schedule", detail: "How often videos are posted", twin: `Every ${Math.max(1, Math.round(twin.cadenceDays))} days`, you: `Every ${Math.max(1, Math.round(own.cadenceDays))} days` },
      { category: "Titles", detail: titleDirection, twin: `${Math.round(twin.numbers * 100)}% use numbers`, you: `${Math.round(own.numbers * 100)}% use numbers` },
      { category: "Big-hit videos", detail: "Videos above the recent average", twin: `${Math.round(twin.outlierFrequency * 100)}%`, you: `${Math.round(own.outlierFrequency * 100)}%` },
    ].filter((item) => item.category !== "Titles" || titleGap >= 5),
    insights: [
      { what: `${twinChannel.title}'s recent videos average ${compact(twin.averageViews)} views.`, why: `That is ${performanceRatio.toFixed(1)}× this preview channel's recent average.`, adapt: "Try one original fitness challenge around a shared audience interest." },
      { what: `${Math.round(twin.numbers * 100)}% of recent titles use a number.`, why: `That differs from this channel by ${titleGap} percentage points.`, adapt: "Use one truthful number only when it makes the promise clearer." },
      { what: `They post about every ${Math.max(1, Math.round(twin.cadenceDays))} days.`, why: cadenceGap ? `That is ${cadenceGap} days different from this channel.` : "The channels already post on a similar schedule.", adapt: "Test that rhythm for three videos, then compare views per day." },
    ],
    topVideos: topVideos.map((video) => ({
      id: video.id,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      views: video.views,
      outlierScore: Math.round((video.views / Math.max(1, twin.averageViews)) * 10) / 10,
      publishedAt: video.publishedAt,
      duration: video.duration,
      url: video.url,
    })),
    links: socialLinks(twinChannel),
    inspirationContext: {
      titlePattern: `${Math.round(twin.firstPerson * 100)}% first-person titles and ${Math.round(twin.numbers * 100)}% number-led titles`,
      thumbnailPattern: "Use the selected creator's real thumbnails only as visual references; do not copy layouts or assets",
      storyStructure: "A clear fitness challenge, escalating attempts, and a measurable ending",
      publishingRhythm: `Approximately every ${Math.max(1, Math.round(twin.cadenceDays))} days`,
      contentFramework: `Original ideas around ${twin.topics.slice(0, 4).join(", ") || "fitness challenges"}`,
    },
    preview: { publicData: true },
  };
}

async function loadLiveData(force = false) {
  if (!force && cachedData && cacheExpiresAt > Date.now()) return cachedData;
  if (!force && pendingLoad) return pendingLoad;
  pendingLoad = (async () => {
    const [channel, twinChannel] = await Promise.all([fetchChannel(CHANNEL_HANDLE), fetchChannel(TWIN_HANDLE)]);
    const [videos, twinVideos] = await Promise.all([fetchChannelVideos(channel), fetchChannelVideos(twinChannel)]);
    if (!videos.length) throw new Error(`${channel.title} has no public videos available.`);
    if (!twinVideos.length) throw new Error(`${twinChannel.title} has no public videos available.`);
    const profile = publicProfile(channel, videos);
    const twin = creatorTwinResult(channel, videos, twinChannel, twinVideos);
    cachedData = { channel, videos, profile, twin };
    cacheExpiresAt = Date.now() + CACHE_MS;
    return cachedData;
  })();
  try {
    return await pendingLoad;
  } finally {
    pendingLoad = null;
  }
}

function json(response, payload, status = 200) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function requestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function proxyToStanley(request, response) {
  const headers = { ...request.headers, host: new URL(APP_ORIGIN).host, "accept-encoding": "identity" };
  delete headers.connection;
  delete headers.upgrade;
  const upstream = await fetch(new URL(request.url || "/", APP_ORIGIN), {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await requestBody(request),
    redirect: "manual",
  });
  const responseHeaders = Object.fromEntries(upstream.headers);
  delete responseHeaders["content-encoding"];
  delete responseHeaders["content-length"];
  delete responseHeaders["transfer-encoding"];
  const contentType = upstream.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const html = (await upstream.text()).replace(
      "<head>",
      `<head><script>try{localStorage.setItem("stanley-onboarding-v1","skipped")}catch{}</script>`,
    );
    response.writeHead(upstream.status, responseHeaders);
    response.end(html);
    return;
  }
  response.writeHead(upstream.status, responseHeaders);
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://localhost:${MOCK_PORT}`);
  try {
    if (url.pathname === "/api/youtube/status") {
      const data = await loadLiveData();
      return json(response, { configured: true, connected: true, captionAccess: false, profile: data.profile, preview: true });
    }
    if (url.pathname === "/api/youtube/videos") {
      const data = await loadLiveData();
      return json(response, { videos: data.videos });
    }
    if (url.pathname === "/api/youtube/analytics") {
      const data = await loadLiveData();
      const requestedRange = numeric(url.searchParams.get("range"));
      const range = VALID_RANGES.has(requestedRange) ? requestedRange : 30;
      return json(response, previewAnalytics(data.channel, data.videos, range));
    }
    if (url.pathname === "/api/youtube/creator-twin") {
      const refresh = url.searchParams.get("refresh") === "true";
      const data = await loadLiveData(refresh);
      return json(response, { ...data.twin, cached: !refresh });
    }
    if (url.pathname === "/api/youtube/avatar") {
      const data = await loadLiveData();
      response.writeHead(302, { location: data.profile.thumbnailUrl, "cache-control": "no-store" });
      return response.end();
    }
    if (url.pathname === "/api/youtube/disconnect") return json(response, { connected: false });
    if (url.pathname === "/api/youtube/connect") {
      response.writeHead(302, { location: "/?youtube=connected" });
      return response.end();
    }
    return await proxyToStanley(request, response);
  } catch (error) {
    console.error("YouTube preview error:", error instanceof Error ? error.message : error);
    return json(response, { error: error instanceof Error ? error.message : "The YouTube preview could not load." }, 502);
  }
});

server.on("upgrade", (request, socket, head) => {
  const target = new URL(APP_ORIGIN);
  const upstream = net.connect(Number(target.port || 80), target.hostname, () => {
    const headers = Object.entries({ ...request.headers, host: target.host })
      .map(([name, value]) => `${name}: ${value}`).join("\r\n");
    upstream.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${headers}\r\n\r\n`);
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(MOCK_PORT, async () => {
  try {
    const data = await loadLiveData();
    console.log(`Live-data channel preview: ${data.channel.title}`);
    console.log(`Open:                      http://localhost:${MOCK_PORT}`);
    console.log(`Proxying Stanley from:     ${APP_ORIGIN}`);
    console.log("Public channel/video fields are live; private Analytics fields are simulated for UI preview.");
  } catch (error) {
    console.error("The preview server started, but initial YouTube data failed:", error instanceof Error ? error.message : error);
  }
});
