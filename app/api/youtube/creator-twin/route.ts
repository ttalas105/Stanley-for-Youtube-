import { NextRequest, NextResponse } from "next/server";
import { fetchChannelVideos, readYouTubeSession, youtubeDataApiUrl, type YouTubeSession, type YouTubeVideoReference } from "../oauth";

type PublicVideo = YouTubeVideoReference & { channelId: string; channelTitle: string };

type ChannelDetails = {
  id: string;
  title: string;
  avatarUrl: string;
  description: string;
  topicCategories: string[];
  customUrl: string;
  subscriberCount: number;
  uploadsPlaylistId: string;
};

type VideoSummary = {
  averageViews: number;
  averageDurationSeconds: number;
  cadenceDays: number;
  viewsPerDay: number;
  outlierFrequency: number;
  topics: string[];
  topicCategories: string[];
  titleFeatures: TitleFeatures;
};

type TitleFeatures = {
  length: number;
  numbers: number;
  questions: number;
  firstPerson: number;
  transformation: number;
};

type Candidate = {
  channel: ChannelDetails;
  videos: PublicVideo[];
  summary: VideoSummary;
  score: SimilarityScore;
  performanceRatio: number;
};

type SimilarityScore = {
  total: number;
  topic: number;
  titles: number;
  duration: number;
  cadence: number;
  format: number;
  momentum: number;
  subscribers: number;
};

export type CreatorTwinResult = {
  generatedAt: string;
  cached: boolean;
  creator: {
    id: string;
    name: string;
    avatarUrl: string;
    similarity: number;
    primaryNiche: string;
    averageViews: number;
    recentMomentum: string;
    outlierFrequency: string;
    channelUrl: string;
  };
  whyMatched: string[];
  differences: Array<{ category: string; detail: string; twin: string; you: string }>;
  insights: Array<{ what: string; why: string; adapt: string }>;
  topVideos: Array<{
    id: string;
    title: string;
    thumbnailUrl: string;
    views: number;
    outlierScore: number;
    publishedAt: string;
    duration: string;
    url: string;
  }>;
  links: Array<{ platform: "x" | "instagram" | "tiktok" | "facebook" | "youtube" | "website"; label: string; url: string }>;
  inspirationContext: {
    titlePattern: string;
    thumbnailPattern: string;
    storyStructure: string;
    publishingRhythm: string;
    contentFramework: string;
  };
};

const CACHE_TTL = 6 * 60 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; result: CreatorTwinResult }>();
const DAY = 86_400_000;
const STOP_WORDS = new Set([
  "about", "after", "again", "against", "and", "are", "before", "being", "business", "can", "channel", "com", "contact", "content", "could", "creator", "did", "does", "email", "every", "first", "for", "from", "have", "http", "https", "how", "instagram", "into", "its", "just", "more", "most", "new", "not", "official", "one", "only", "other", "over", "really", "subscribe", "that", "the", "their", "them", "then", "there", "these", "they", "this", "through", "tiktok", "video", "videos", "was", "what", "when", "where", "which", "while", "why", "with", "would", "www", "you", "your", "youtube",
]);
const TRANSFORMATION_WORDS = /\b(after|before|became|built|changed|fixed|gained|learned|lost|made|swap(?:ped)?|test(?:ed)?|transform(?:ed)?|tried)\b/i;

function numeric(value: string | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function ratioSimilarity(left: number, right: number) {
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  return Math.min(left, right) / Math.max(left, right);
}

function parseDuration(value: string) {
  const match = value.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return numeric(match[1]) * 86_400 + numeric(match[2]) * 3_600 + numeric(match[3]) * 60 + numeric(match[4]);
}

function tokens(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word));
}

function normalizeTopicCategory(value: string) {
  try {
    const label = decodeURIComponent(new URL(value).pathname.split("/").filter(Boolean).at(-1) || "");
    return label.replaceAll("_", " ").toLowerCase().trim();
  } catch {
    return value.replaceAll("_", " ").toLowerCase().trim();
  }
}

function topTopics(videos: Pick<PublicVideo, "title">[], description = "", topicCategories: string[] = [], limit = 14) {
  const counts = new Map<string, number>();
  const add = (words: string[], weight: number) => {
    for (const word of new Set(words)) counts.set(word, (counts.get(word) || 0) + weight);
  };
  for (const video of videos) add(tokens(video.title), 4);
  add(tokens(description), 1);
  for (const category of topicCategories) add(tokens(category), 8);
  return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, limit).map(([word]) => word);
}

function titleFeatures(videos: Pick<PublicVideo, "title">[]): TitleFeatures {
  if (!videos.length) return { length: 0, numbers: 0, questions: 0, firstPerson: 0, transformation: 0 };
  return {
    length: average(videos.map((video) => video.title.length)),
    numbers: average(videos.map((video) => /\d/.test(video.title) ? 1 : 0)),
    questions: average(videos.map((video) => /\?/.test(video.title) ? 1 : 0)),
    firstPerson: average(videos.map((video) => /\b(i|i'm|i’ve|i've|my|we|our)\b/i.test(video.title) ? 1 : 0)),
    transformation: average(videos.map((video) => TRANSFORMATION_WORDS.test(video.title) ? 1 : 0)),
  };
}

function summarize(videos: PublicVideo[], channel?: Pick<ChannelDetails, "description" | "topicCategories">): VideoSummary {
  const published = videos.map((video) => new Date(video.publishedAt).getTime()).filter(Number.isFinite).sort((a, b) => b - a);
  const gaps = published.slice(0, -1).map((date, index) => Math.min(120, Math.max(0, (date - published[index + 1]) / DAY)));
  const averageViews = average(videos.map((video) => video.views));
  return {
    averageViews,
    averageDurationSeconds: average(videos.map((video) => parseDuration(video.duration)).filter(Boolean)),
    cadenceDays: average(gaps),
    viewsPerDay: average(videos.map((video) => video.views / Math.max(2, (Date.now() - new Date(video.publishedAt).getTime()) / DAY))),
    outlierFrequency: videos.length ? videos.filter((video) => video.views >= averageViews * 1.5).length / videos.length : 0,
    topics: topTopics(videos, channel?.description, channel?.topicCategories),
    topicCategories: channel?.topicCategories || [],
    titleFeatures: titleFeatures(videos),
  };
}

function setSimilarity(left: string[], right: string[]) {
  const a = new Set(left);
  const b = new Set(right);
  const union = new Set([...a, ...b]);
  if (!union.size) return 0;
  const intersection = [...a].filter((value) => b.has(value)).length;
  const overlap = intersection / Math.max(1, Math.min(a.size, b.size));
  const jaccard = intersection / union.size;
  return overlap * .65 + jaccard * .35;
}

function featureSimilarity(left: TitleFeatures, right: TitleFeatures) {
  const proportions: Array<keyof Omit<TitleFeatures, "length">> = ["numbers", "questions", "firstPerson", "transformation"];
  const style = average(proportions.map((key) => 1 - Math.abs(left[key] - right[key])));
  const length = Math.max(0, 1 - Math.abs(left.length - right.length) / 70);
  return { titles: (style + length) / 2, format: style };
}

export function scoreCreatorSimilarity(own: VideoSummary, candidate: VideoSummary, ownSubscribers: number, candidateSubscribers: number): SimilarityScore {
  const termSimilarity = setSimilarity(own.topics, candidate.topics);
  const categorySimilarity = setSimilarity(own.topicCategories || [], candidate.topicCategories || []);
  const topic = own.topicCategories?.length && candidate.topicCategories?.length
    ? termSimilarity * .72 + categorySimilarity * .28
    : termSimilarity;
  const features = featureSimilarity(own.titleFeatures, candidate.titleFeatures);
  const duration = ratioSimilarity(own.averageDurationSeconds, candidate.averageDurationSeconds);
  const cadence = ratioSimilarity(own.cadenceDays, candidate.cadenceDays);
  const momentum = ratioSimilarity(own.viewsPerDay, candidate.viewsPerDay);
  const subscriberDistance = Math.abs(Math.log10(ownSubscribers + 1) - Math.log10(candidateSubscribers + 1));
  const subscribers = Math.max(0, 1 - subscriberDistance / 2.5);
  return {
    total: topic * .30 + features.titles * .24 + duration * .14 + cadence * .13 + features.format * .10 + momentum * .06 + subscribers * .03,
    topic,
    titles: features.titles,
    duration,
    cadence,
    format: features.format,
    momentum,
    subscribers,
  };
}

async function youtubeJson<T>(url: URL, accessToken: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("YouTube could not load the channel information.");
  return response.json() as Promise<T>;
}

async function searchComparableChannels(accessToken: string, query: string) {
  type SearchResponse = { items?: Array<{ id?: { channelId?: string }; snippet?: { channelId?: string } }> };
  const [similarChannels, highViewVideos] = await Promise.all([
    youtubeJson<SearchResponse>(youtubeDataApiUrl("search", {
      part: "snippet", type: "channel", order: "relevance", q: query, maxResults: "12",
    }), accessToken).catch(() => ({ items: [] })),
    youtubeJson<SearchResponse>(youtubeDataApiUrl("search", {
      part: "snippet", type: "video", order: "viewCount", q: query, maxResults: "16",
    }), accessToken).catch(() => ({ items: [] })),
  ]);
  const ids = new Set<string>();
  for (const item of similarChannels.items || []) if (item.id?.channelId) ids.add(item.id.channelId);
  for (const item of highViewVideos.items || []) if (item.snippet?.channelId) ids.add(item.snippet.channelId);
  return [...ids].slice(0, 18);
}

async function fetchPublicVideos(accessToken: string, ids: string[]): Promise<PublicVideo[]> {
  if (!ids.length) return [];
  type VideosResponse = { items?: Array<{
    id: string;
    snippet?: { channelId?: string; channelTitle?: string; title?: string; publishedAt?: string; thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } } };
    statistics?: { viewCount?: string };
    contentDetails?: { duration?: string };
    status?: { privacyStatus?: string };
  }> };
  const chunks = Array.from({ length: Math.ceil(ids.length / 50) }, (_, index) => ids.slice(index * 50, index * 50 + 50));
  const responses = await Promise.all(chunks.map((chunk) => youtubeJson<VideosResponse>(youtubeDataApiUrl("videos", {
    part: "snippet,statistics,contentDetails,status", id: chunk.join(","),
  }), accessToken)));
  return responses.flatMap((response) => response.items || []).flatMap((video) => {
    if (!video.snippet?.channelId || video.status?.privacyStatus !== "public") return [];
    return [{
      id: video.id,
      channelId: video.snippet.channelId,
      channelTitle: video.snippet.channelTitle || "Unknown creator",
      title: video.snippet.title || "Untitled video",
      thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
      publishedAt: video.snippet.publishedAt || "",
      views: numeric(video.statistics?.viewCount),
      duration: video.contentDetails?.duration || "",
      privacyStatus: "public",
      url: `https://www.youtube.com/watch?v=${video.id}`,
    }];
  });
}

async function fetchChannels(accessToken: string, ids: string[]) {
  const response = await youtubeJson<{ items?: Array<{
    id: string;
    snippet?: { title?: string; description?: string; customUrl?: string; thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } } };
    statistics?: { subscriberCount?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
    topicDetails?: { topicCategories?: string[] };
  }> }>(youtubeDataApiUrl("channels", { part: "snippet,statistics,contentDetails,topicDetails", id: ids.join(",") }), accessToken);
  return new Map((response.items || []).map((channel): [string, ChannelDetails] => [channel.id, {
    id: channel.id,
    title: channel.snippet?.title || "Unknown creator",
    avatarUrl: channel.snippet?.thumbnails?.high?.url || channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url || "",
    description: channel.snippet?.description || "",
    topicCategories: (channel.topicDetails?.topicCategories || []).map(normalizeTopicCategory).filter(Boolean),
    customUrl: channel.snippet?.customUrl || "",
    subscriberCount: numeric(channel.statistics?.subscriberCount),
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads || "",
  }]));
}

async function fetchCandidateVideos(accessToken: string, channels: ChannelDetails[]) {
  const videoIds = new Set<string>();
  await Promise.all(channels.map(async (channel) => {
    if (!channel.uploadsPlaylistId) return;
    try {
      const playlist = await youtubeJson<{ items?: Array<{ contentDetails?: { videoId?: string } }> }>(youtubeDataApiUrl("playlistItems", {
        part: "contentDetails", playlistId: channel.uploadsPlaylistId, maxResults: "10",
      }), accessToken);
      for (const item of playlist.items || []) if (item.contentDetails?.videoId) videoIds.add(item.contentDetails.videoId);
    } catch (error) {
      console.warn(`Creator Twin could not sample ${channel.id}.`, error);
    }
  }));
  return fetchPublicVideos(accessToken, [...videoIds]);
}

async function fetchTopVideos(accessToken: string, channelId: string, fallback: PublicVideo[]) {
  try {
    const search = await youtubeJson<{ items?: Array<{ id?: { videoId?: string } }> }>(youtubeDataApiUrl("search", {
      part: "snippet", type: "video", order: "viewCount", channelId, maxResults: "5",
    }), accessToken);
    const ids = (search.items || []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id));
    const videos = await fetchPublicVideos(accessToken, ids);
    if (videos.length) return videos;
  } catch (error) {
    console.warn("Creator Twin top-video lookup was unavailable; using the matching sample.", error);
  }
  return [...fallback].sort((left, right) => right.views - left.views).slice(0, 5);
}

function compact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function days(value: number) {
  return `${Math.max(1, Math.round(value))} day${Math.round(value) === 1 ? "" : "s"}`;
}

function minutes(value: number) {
  return `${Math.max(1, Math.round(value / 60))} min`;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function titlePattern(features: TitleFeatures) {
  const options = [
    { value: features.numbers, label: "titles with a specific number" },
    { value: features.firstPerson, label: "titles that say “I” or “my”" },
    { value: features.transformation, label: "titles about a change or challenge" },
    { value: features.questions, label: "titles that ask a question" },
  ].sort((left, right) => right.value - left.value);
  return options[0].value >= .25 ? `${options[0].label} (${percent(options[0].value)} of their recent titles)` : `short titles with about ${Math.round(features.length)} letters`;
}

function matchReasons(own: VideoSummary, twin: VideoSummary, score: SimilarityScore) {
  const reasons = [
    { score: score.topic, text: `You cover many of the same topics (${percent(score.topic)} match)` },
    { score: score.titles, text: `Your titles are written in a similar way (${percent(score.titles)} match)` },
    { score: score.cadence, text: `You upload at nearly the same pace` },
    { score: score.duration, text: `Your videos are usually a similar length` },
    { score: score.format, text: `You use similar video and title formats` },
  ];
  return reasons.sort((left, right) => right.score - left.score).slice(0, 5).map((reason) => reason.text);
}

function differences(own: VideoSummary, twin: VideoSummary, performanceRatio: number) {
  const items: Array<{ impact: number; category: string; detail: string; twin: string; you: string }> = [];
  if (performanceRatio >= 1.15) items.push({ impact: performanceRatio, category: "Views", detail: "Recent videos get more views", twin: `${performanceRatio.toFixed(1)}× your views per video`, you: `${compact(own.averageViews)} per video` });
  const cadenceGap = own.cadenceDays - twin.cadenceDays;
  if (cadenceGap >= 2) items.push({ impact: cadenceGap / Math.max(1, own.cadenceDays), category: "Upload pace", detail: "Posts more often", twin: `Every ${days(twin.cadenceDays)}`, you: `Every ${days(own.cadenceDays)}` });
  const numberGap = twin.titleFeatures.numbers - own.titleFeatures.numbers;
  if (numberGap >= .15) items.push({ impact: numberGap, category: "Titles", detail: "Uses specific numbers more often", twin: percent(twin.titleFeatures.numbers), you: percent(own.titleFeatures.numbers) });
  const titleLengthGap = Math.abs(twin.titleFeatures.length - own.titleFeatures.length);
  if (titleLengthGap >= 7) items.push({ impact: titleLengthGap / 70, category: "Titles", detail: twin.titleFeatures.length < own.titleFeatures.length ? "More concise" : "More descriptive", twin: `${Math.round(twin.titleFeatures.length)} characters`, you: `${Math.round(own.titleFeatures.length)} characters` });
  const outlierGap = twin.outlierFrequency - own.outlierFrequency;
  if (outlierGap >= .1) items.push({ impact: outlierGap, category: "Big-hit videos", detail: "Big hits happen more often", twin: percent(twin.outlierFrequency), you: percent(own.outlierFrequency) });
  const durationGap = Math.abs(twin.averageDurationSeconds - own.averageDurationSeconds);
  if (durationGap >= Math.max(120, own.averageDurationSeconds * .2)) items.push({ impact: durationGap / Math.max(60, own.averageDurationSeconds), category: "Video length", detail: twin.averageDurationSeconds < own.averageDurationSeconds ? "Shorter videos" : "Longer videos", twin: minutes(twin.averageDurationSeconds), you: minutes(own.averageDurationSeconds) });
  return items.sort((left, right) => right.impact - left.impact).slice(0, 4).map(({ category, detail, twin: twinValue, you }) => ({ category, detail, twin: twinValue, you }));
}

function buildInsights(own: VideoSummary, twin: VideoSummary, creatorName: string, performanceRatio: number) {
  const pattern = titlePattern(twin.titleFeatures);
  const cadenceDelta = Math.round(Math.abs(own.cadenceDays - twin.cadenceDays));
  const durationDelta = Math.round(Math.abs(own.averageDurationSeconds - twin.averageDurationSeconds) / 60);
  return [
    {
      what: `${creatorName}'s recent videos average ${compact(twin.averageViews)} views.`,
      why: `That is about ${performanceRatio.toFixed(1)}× your views per video.`,
      adapt: `Try one new idea about ${twin.topics[0] || "a topic you both cover"}.`,
    },
    {
      what: `They often use ${pattern}.`,
      why: `It appears repeatedly in the videos used for this match.`,
      adapt: `Try that title style with your own idea and words.`,
    },
    twin.cadenceDays && cadenceDelta >= 2 ? {
      what: `They post about every ${days(twin.cadenceDays)}.`,
      why: `That is ${cadenceDelta} days ${twin.cadenceDays < own.cadenceDays ? "faster" : "slower"} than yours.`,
      adapt: `Try that schedule for three videos, then see how the views compare.`,
    } : {
      what: `Their average video is ${minutes(twin.averageDurationSeconds)}.`,
      why: `That is ${durationDelta} minutes ${twin.averageDurationSeconds < own.averageDurationSeconds ? "shorter" : "longer"} than yours.`,
      adapt: `Try that video length once, then check how much people watched.`,
    },
  ];
}

function socialLinks(channel: ChannelDetails) {
  const found = channel.description.match(/https?:\/\/[^\s<>"')]+/gi) || [];
  const links: CreatorTwinResult["links"] = [];
  const add = (platform: CreatorTwinResult["links"][number]["platform"], label: string, url: string) => {
    if (!links.some((link) => link.platform === platform)) links.push({ platform, label, url });
  };
  for (const raw of found) {
    try {
      const url = new URL(raw.replace(/[.,;]+$/, ""));
      const handle = url.pathname.split("/").filter(Boolean)[0];
      if ((url.hostname === "x.com" || url.hostname.endsWith("twitter.com")) && handle) add("x", `@${handle}`, url.toString());
      else if (url.hostname.endsWith("instagram.com") && handle) add("instagram", `@${handle}`, url.toString());
      else if (url.hostname.endsWith("tiktok.com") && handle) add("tiktok", handle.startsWith("@") ? handle : `@${handle}`, url.toString());
      else if (url.hostname.endsWith("facebook.com") && handle) add("facebook", handle, url.toString());
      else if (!/youtube\.com|youtu\.be/.test(url.hostname)) add("website", url.hostname.replace(/^www\./, ""), url.toString());
    } catch {
      // Ignore malformed URLs in public channel descriptions.
    }
  }
  add("youtube", channel.customUrl || channel.title, channel.customUrl ? `https://www.youtube.com/${channel.customUrl}` : `https://www.youtube.com/channel/${channel.id}`);
  const priority: Record<CreatorTwinResult["links"][number]["platform"], number> = { instagram: 0, x: 1, tiktok: 2, facebook: 3, website: 4, youtube: 5 };
  return links.sort((left, right) => priority[left.platform] - priority[right.platform]);
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildResult(candidate: Candidate, own: VideoSummary, topVideos: PublicVideo[]): CreatorTwinResult {
  const baseline = candidate.summary.averageViews || 1;
  return {
    generatedAt: new Date().toISOString(),
    cached: false,
    creator: {
      id: candidate.channel.id,
      name: candidate.channel.title,
      avatarUrl: candidate.channel.avatarUrl,
      similarity: Math.round(candidate.score.total * 100),
      primaryNiche: titleCase(candidate.summary.topics.slice(0, 2).join(" · ") || "Similar Format"),
      averageViews: Math.round(candidate.summary.averageViews),
      recentMomentum: `${candidate.performanceRatio.toFixed(1)}× your views per video`,
      outlierFrequency: `${percent(candidate.summary.outlierFrequency)} got many more views than usual`,
      channelUrl: candidate.channel.customUrl ? `https://www.youtube.com/${candidate.channel.customUrl}` : `https://www.youtube.com/channel/${candidate.channel.id}`,
    },
    whyMatched: matchReasons(own, candidate.summary, candidate.score),
    differences: differences(own, candidate.summary, candidate.performanceRatio),
    insights: buildInsights(own, candidate.summary, candidate.channel.title, candidate.performanceRatio),
    topVideos: topVideos.slice(0, 5).map((video) => ({
      id: video.id,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      views: video.views,
      outlierScore: Math.round((video.views / baseline) * 10) / 10,
      publishedAt: video.publishedAt,
      duration: video.duration,
      url: video.url,
    })),
    links: socialLinks(candidate.channel),
    inspirationContext: {
      titlePattern: titlePattern(candidate.summary.titleFeatures),
      thumbnailPattern: "Use the selected creator's top-video thumbnails only as visual references; do not copy their layout or assets",
      storyStructure: `${percent(candidate.summary.titleFeatures.transformation)} transformation-led and ${percent(candidate.summary.titleFeatures.firstPerson)} first-person titles in the sample`,
      publishingRhythm: `Approximately every ${days(candidate.summary.cadenceDays)}`,
      contentFramework: `Original videos around ${candidate.summary.topics.slice(0, 3).join(", ") || "the shared topic cluster"}`,
    },
  };
}

async function calculateCreatorTwin(session: YouTubeSession) {
  const ownVideos = (await fetchChannelVideos(session.accessToken, 30)).filter((video) => video.privacyStatus === "public")
    .map((video): PublicVideo => ({ ...video, channelId: session.profile.id, channelTitle: session.profile.title }));
  if (ownVideos.length < 3) return { error: "Creator Twin needs at least three public videos before it can find a good match.", status: 422 as const };
  const ownChannel = (await fetchChannels(session.accessToken, [session.profile.id])).get(session.profile.id);
  const own = summarize(ownVideos, ownChannel);
  const query = own.topics.slice(0, 3).join(" ");
  if (!query) return { error: "Creator Twin needs a few more videos about similar topics before it can find a match.", status: 422 as const };

  const candidateIds = (await searchComparableChannels(session.accessToken, query)).filter((id) => id !== session.profile.id);
  if (!candidateIds.length) return { error: "Stanley could not find a close match yet. Try again after you post another video.", status: 404 as const };
  const channels = await fetchChannels(session.accessToken, candidateIds);
  const publicVideos = await fetchCandidateVideos(session.accessToken, [...channels.values()]);
  const grouped = new Map<string, PublicVideo[]>();
  for (const video of publicVideos) grouped.set(video.channelId, [...(grouped.get(video.channelId) || []), video]);
  const eligibleGroups = [...grouped].filter(([, sample]) => sample.length >= 3);
  if (!eligibleGroups.length) return { error: "Stanley could not find a close match yet. Try again after you post another video.", status: 404 as const };
  const candidates = eligibleGroups.flatMap(([id, candidateVideos]): Candidate[] => {
    const channel = channels.get(id);
    if (!channel) return [];
    const summary = summarize(candidateVideos, channel);
    const score = scoreCreatorSimilarity(own, summary, session.profile.subscriberCount, channel.subscriberCount);
    const performanceRatio = Math.max(summary.averageViews / Math.max(1, own.averageViews), summary.viewsPerDay / Math.max(1, own.viewsPerDay));
    return [{ channel, videos: candidateVideos, summary, score, performanceRatio }];
  }).filter((candidate) => {
    const closeMatch = candidate.performanceRatio >= 1.1 && candidate.score.total >= .45 && candidate.score.topic >= .14;
    const strongerNicheCreator = candidate.performanceRatio >= 2 && candidate.score.total >= .36 && candidate.score.topic >= .24;
    return closeMatch || strongerNicheCreator;
  });
  const rank = (candidate: Candidate) => {
    const performanceBoost = Math.min(.1, Math.max(0, Math.log2(Math.max(1, candidate.performanceRatio))) * .025);
    return candidate.score.total + candidate.score.topic * .08 + performanceBoost;
  };
  const candidate = candidates.sort((left, right) => rank(right) - rank(left))[0];
  if (!candidate) return { error: "Stanley found no similar creator who is getting more views right now.", status: 404 as const };
  const topVideos = await fetchTopVideos(session.accessToken, candidate.channel.id, candidate.videos);
  return { result: buildResult(candidate, own, topVideos), channelId: session.profile.id };
}

export async function GET(request: NextRequest) {
  try {
    const session = await readYouTubeSession();
    if (!session) return NextResponse.json({ error: "Connect YouTube before analyzing your Creator Twin." }, { status: 401 });
    const force = request.nextUrl.searchParams.get("refresh") === "true";
    const saved = cache.get(session.profile.id);
    if (!force && saved && saved.expiresAt > Date.now()) return NextResponse.json({ ...saved.result, cached: true });
    const calculated = await calculateCreatorTwin(session);
    if ("error" in calculated) return NextResponse.json({ error: calculated.error }, { status: calculated.status });
    cache.set(calculated.channelId, { expiresAt: Date.now() + CACHE_TTL, result: calculated.result });
    return NextResponse.json(calculated.result);
  } catch (error) {
    console.error("Creator Twin analysis failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Creator Twin could not be calculated." }, { status: 502 });
  }
}
