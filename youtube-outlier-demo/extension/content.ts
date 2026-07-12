import { buildAnalysis, type AnalysisResult, type AnalyzedVideo } from "./analysis";
import { stats } from "./statistics";
import { config } from "./config";
import { charts } from "./charts";
import { growth } from "./growth";
import { getErrorMessage, isChannelAnalysisResponse, isContentMessage, isRecord } from "../shared/guards";
import type { ChannelSnapshot, SupportedChannelIdentifier, VideoSnapshot } from "../shared/types";
import type { SnapshotStore } from "../server/snapshot-store";

type GrowthSummary = Awaited<ReturnType<SnapshotStore["channel"]>>;
type GroupSummary = AnalysisResult["uploadPatterns"]["duration"][number];
type Frequency = AnalysisResult["uploadPatterns"]["frequency"];
type GrowthMetric = "viewCount" | "viewGain" | "viewsPerHour" | "likeGain" | "commentGain";
type AnalysisMetric = "viewCount" | "viewsPerDay" | "outlierMultiple";
type GroupMetric = "medianViews" | "medianViewsPerDay" | "medianOutlier";
type MetricCard = [string, string, string?];
type LatestInterval = NonNullable<GrowthSummary["videos"][number]["latestInterval"]>;
type ChartItem = { dataIndex: number; raw?: unknown; label?: string };
type TooltipLike = { opacity: number; dataPoints?: ChartItem[]; caretX: number; caretY: number };
type CommonOptions = { scales: Record<string, unknown>; plugins: { tooltip: Record<string, unknown> }; [key: string]: unknown };
type ScatterContext = { raw: { video: AnalyzedVideo; x?: number } };
declare global {
  interface Window {
    __ytOutlierDemoLoaded?: boolean;
    __ytOutlierRefresh?: () => void;
  }
}

(() => {
if (window.__ytOutlierDemoLoaded) { window.__ytOutlierRefresh?.(); return; }
window.__ytOutlierDemoLoaded = true;

const S = stats;
const C = config;
const Charts = charts;
const G = growth;
const BUTTON_ID = "yt-outlier-scan-button";
const PANEL_ID = "yt-outlier-panel";
const tabs = ["overview", "performance", "videos", "upload-patterns", "growth-tracking"];
let currentUrl = location.href;
let currentChannelKey = channelKey(getChannelFromUrl());
let panel: HTMLElement | null = null;
let analysis = null as unknown as AnalysisResult;
let activeTab = "overview";
let selectedVideoId: string | null = null;
let videoSort = "views";
let videoFilter = "all";
let titleSearch = "";
let recentMetric: AnalysisMetric = "outlierMultiple";
let ageMetric: AnalysisMetric = "viewCount";
let durationMetric: GroupMetric = "medianViews";
let weekdayMetric: GroupMetric = "medianViewsPerDay";
let navigationTimer: ReturnType<typeof setTimeout> | null = null;
let growthSummary: GrowthSummary | null = null;
let growthLoading = false;
let growthError = "";
let growthMetric: GrowthMetric = "viewCount";
let rankingMetric: GrowthMetric = "viewGain";
let growthVideoId: string | null = null;
let growthRequestToken = 0;
const growthSummaryCache = new Map<string, GrowthSummary>();
const videoSnapshotCache = new Map<string, VideoSnapshot[] | null>();

init();
window.__ytOutlierRefresh = refreshUi;

function init() {
  chrome.runtime.onMessage.addListener(handleContentMessage);
  refreshUi();
  const observer = new MutationObserver(() => {
    if (location.href === currentUrl || navigationTimer) return;
    navigationTimer = setTimeout(() => {
      navigationTimer = null;
      if (location.href === currentUrl) return;
      currentUrl = location.href;
      const nextKey = channelKey(getChannelFromUrl());
      if (nextKey !== currentChannelKey) clearAnalysis();
      currentChannelKey = nextKey;
      refreshUi();
    }, 120);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function handleContentMessage(message: unknown, _sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void) {
  if (!isContentMessage(message)) return false;
  if (message?.type === "PING_CONTENT_SCRIPT") {
    refreshUi();
    sendResponse({ ok: true, isChannelPage: Boolean(getChannelFromUrl()) });
    return false;
  }
  if (message?.type === "START_SCAN") {
    handleScanClick().then(() => sendResponse({ ok: true })).catch((error: unknown) => sendResponse({ ok: false, error: getErrorMessage(error) }));
    return true;
  }
  return false;
}

function getChannelFromUrl(): SupportedChannelIdentifier | null {
  const url = new URL(location.href);
  if (!["www.youtube.com", "youtube.com"].includes(url.hostname)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const first = parts[0] || "";
  if (first.startsWith("@") && first.length > 1) return { type: "handle", value: first };
  if (first === "channel" && parts[1] && /^UC[a-zA-Z0-9_-]{20,}$/.test(parts[1])) return { type: "channelId", value: parts[1] };
  return null;
}

function channelKey(channel: SupportedChannelIdentifier | null) { return channel ? `${channel.type}:${channel.value.toLowerCase()}` : ""; }
function refreshUi() { getChannelFromUrl() ? ensureButton() : (removeButton(), closePanel()); }
function ensureButton() {
  if (document.getElementById(BUTTON_ID)) return;
  const button = document.createElement("button");
  button.id = BUTTON_ID; button.type = "button"; button.textContent = "Scan Channel";
  button.addEventListener("click", handleScanClick); document.body.appendChild(button);
}
function removeButton() { document.getElementById(BUTTON_ID)?.remove(); }

async function handleScanClick() {
  const channel = getChannelFromUrl();
  if (!channel) return openMessage("Invalid channel URL", "Open a YouTube channel handle or channel ID page first.", true);
  openMessage("Scanning channel", "Fetching recent public uploads...");
  try {
    const response: unknown = await chrome.runtime.sendMessage({ type: "ANALYZE_CHANNEL", channel });
    if (!isRecord(response) || response.ok !== true) throw new Error(isRecord(response) && typeof response.error === "string" ? response.error : "Could not analyze this channel.");
    if (!isChannelAnalysisResponse(response.data)) throw new Error("Backend returned an invalid analysis response.");
    analysis = buildAnalysis(response.data);
    activeTab = "overview"; selectedVideoId = null; renderApp();
    loadGrowthSummary(analysis.channel.id, true);
  } catch (error: unknown) { openMessage("Scan failed", getErrorMessage(error), true); }
}

function ensurePanel() {
  panel = document.getElementById(PANEL_ID);
  if (panel) return;
  panel = document.createElement("aside"); panel.id = PANEL_ID;
  panel.innerHTML = `<header class="yt-outlier-panel-header"><h2 class="yt-outlier-title">Channel analysis</h2><button class="yt-outlier-icon-button yt-outlier-close" type="button" aria-label="Close analysis" title="Close">&times;</button></header><div class="yt-outlier-body"></div>`;
  panel.addEventListener("click", handlePanelClick);
  panel.addEventListener("change", handlePanelChange);
  panel.addEventListener("input", handlePanelInput);
  document.body.appendChild(panel);
}

function openMessage(title: string, message: string, error = false) {
  ensurePanel(); Charts.destroyAll();
  panel?.querySelector<HTMLElement>(".yt-outlier-title")?.replaceChildren(title);
  const body = panel?.querySelector<HTMLElement>(".yt-outlier-body");
  if (body) body.innerHTML = `<p class="${error ? "yt-outlier-error" : "yt-outlier-muted"}">${escapeHtml(message)}</p>`;
}
function closePanel() { Charts.destroyAll(); document.getElementById(PANEL_ID)?.remove(); panel = null; }
function clearAnalysis() { analysis = null as unknown as AnalysisResult; selectedVideoId = null; growthSummary = null; growthVideoId = null; growthError = ""; growthLoading = false; growthRequestToken++; Charts.destroyAll(); closePanel(); }

function renderApp() {
  ensurePanel(); Charts.destroyAll();
  panel?.querySelector<HTMLElement>(".yt-outlier-title")?.replaceChildren(analysis.channel.title || "Channel analysis");
  const body = panel?.querySelector<HTMLElement>(".yt-outlier-body");
  if (body) body.innerHTML = `${renderChannelHeader()}${renderTabs()}<main class="yt-outlier-tab-content">${renderTab()}</main>${renderDrawer()}`;
  requestAnimationFrame(renderCharts);
}

function renderChannelHeader() {
  const channel = analysis.channel;
  const m = analysis.metrics;
  return `<section class="yt-outlier-channel">
    ${channel.avatarUrl ? `<img class="yt-outlier-avatar" src="${attr(channel.avatarUrl)}" alt="">` : `<span class="yt-outlier-avatar"></span>`}
    <div class="yt-outlier-channel-copy"><strong>${escapeHtml(channel.title || "Unknown channel")}</strong><span>${escapeHtml(channel.handle || "Handle unavailable")}</span></div>
    <div class="yt-outlier-channel-facts"><span>${channel.subscriberCount === null ? "Subscribers hidden" : `${S.compactNumber(channel.subscriberCount)} subscribers`}</span><span>${analysis.videos.length} analyzed / ${analysis.eligible.length} long-form</span><span>${dateRange(m.dateStart, m.dateEnd)}</span><span>Scanned ${new Date(analysis.scannedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div>
  </section>`;
}

function renderTabs() {
  return `<nav class="yt-outlier-tabs" role="tablist">${tabs.map((tab) => `<button type="button" role="tab" data-tab="${tab}" aria-selected="${activeTab === tab}">${tab.split("-").map(capitalize).join(" ")}</button>`).join("")}</nav>`;
}

function renderTab() {
  if (activeTab === "overview") return renderOverview();
  if (activeTab === "performance") return renderPerformance();
  if (activeTab === "videos") return renderVideos();
  if (activeTab === "upload-patterns") return renderUploadPatterns();
  return renderGrowthTracking();
}

async function loadGrowthSummary(channelId: string | undefined, refresh = false) {
  if (!channelId) return;
  if (!refresh && growthSummaryCache.has(channelId)) { growthSummary = growthSummaryCache.get(channelId) || null; ensureGrowthVideo(); renderApp(); return; }
  const token = ++growthRequestToken; growthLoading = true; growthError = "";
  if (activeTab === "growth-tracking") renderApp();
  const response: unknown = await chrome.runtime.sendMessage({ type: "GET_CHANNEL_SNAPSHOTS", channelId }).catch((error: unknown) => ({ ok: false, error: getErrorMessage(error) }));
  if (token !== growthRequestToken || analysis?.channel.id !== channelId) return;
  growthLoading = false;
  if (!isRecord(response) || response.ok !== true) growthError = isRecord(response) && typeof response.error === "string" ? response.error : "Could not load growth snapshots.";
  else if (isRecord(response.data)) { growthSummary = response.data as unknown as GrowthSummary; growthSummaryCache.set(channelId, growthSummary); ensureGrowthVideo(); }
  if (panel) renderApp();
}

function ensureGrowthVideo() {
  const videos = growthSummary?.videos || [];
  if (!videos.some((video) => video.videoId === growthVideoId)) growthVideoId = videos.find((video) => video.snapshotCount >= 2)?.videoId || videos[0]?.videoId || null;
  if (growthVideoId) loadVideoSnapshots(growthVideoId);
}

async function loadVideoSnapshots(videoId: string) {
  if (!videoId || videoSnapshotCache.has(videoId)) return;
  videoSnapshotCache.set(videoId, null);
  const response = await chrome.runtime.sendMessage({ type: "GET_VIDEO_SNAPSHOTS", videoId }).catch(() => null);
  if (response?.ok) videoSnapshotCache.set(videoId, response.data.snapshots || []); else videoSnapshotCache.delete(videoId);
  if (panel && (growthVideoId === videoId || selectedVideoId === videoId)) renderApp();
}

function renderOverview() {
  const m = analysis.metrics;
  const cards: MetricCard[] = [
    ["Median views", S.compactNumber(m.medianViews)], ["Mean views", S.compactNumber(m.meanViews)],
    ["Highest-viewed", m.highestViewed ? `${S.compactNumber(m.highestViewed.viewCount)} · ${shorten(m.highestViewed.title, 28)}` : "Unavailable"],
    ["Highest outlier", m.highestOutlier ? formatMultiple(m.highestOutlier.outlierMultiple) : "Unavailable"],
    ["Median views/day", S.compactNumber(m.medianViewsPerDay)], ["Uploads/month", formatDecimal(m.uploadsPerMonth)],
    ["Above 2x baseline", String(m.above2)], ["Above 5x baseline", String(m.above5)],
    ["Consistency", m.consistency === null ? "Unavailable" : `${Math.round(m.consistency)}/100`, "Higher means recent uploads perform within a more consistent range. This is based on variation in log-transformed public view counts. Custom descriptive metric."]
  ];
  return `<section class="yt-outlier-metrics">${cards.map(metricCard).join("")}</section>
    ${chartCard("recent-chart", "Recent upload performance", "Performance across eligible uploads in chronological order.", metricToggle("recent-metric", recentMetric))}
    <div class="yt-outlier-chart-grid">${chartCard("distribution-chart", "Outlier distribution", "Eligible videos grouped by their prior-upload baseline multiple.")}${chartCard("top-chart", "Top outliers", "Select a bar to inspect that video.")}</div>`;
}

function renderPerformance() {
  return `${chartCard("baseline-chart", "Views versus baseline", "Actual public views compared with each prior-upload median baseline.")}
    ${chartCard("age-chart", "Video age versus performance", "How public performance varies with time since upload.", metricToggle("age-metric", ageMetric))}
    <div class="yt-outlier-chart-grid">${chartCard("rolling-chart", "Rolling baseline trend", rollingDirectionDescription())}${chartCard("concentration-chart", "Performance concentration", "Share of analyzed public views contributed by ranked videos.")}</div>`;
}

function chartCard(id: string, title: string, description: string, controls = "") {
  const hasData = analysis.eligible.length > 0;
  return `<section class="yt-outlier-chart-card"><div class="yt-outlier-section-heading"><div><h3>${title}</h3><p>${description}</p></div>${controls}</div>${hasData ? `<div class="yt-outlier-chart-wrap"><canvas id="${id}" aria-label="${title}"></canvas></div>` : `<div class="yt-outlier-empty">No eligible videos to chart.</div>`}</section>`;
}

function metricToggle(name: string, selected: string) {
  return `<select class="yt-outlier-select" data-control="${name}" aria-label="Chart metric"><option value="viewCount" ${selected === "viewCount" ? "selected" : ""}>Total views</option><option value="viewsPerDay" ${selected === "viewsPerDay" ? "selected" : ""}>Views per day</option><option value="outlierMultiple" ${selected === "outlierMultiple" ? "selected" : ""}>Outlier multiple</option></select>`;
}

function groupedMetricToggle(name: string, selected: string) {
  return `<select class="yt-outlier-select" data-control="${name}" aria-label="Chart metric">${options({ medianViews: "Median views", medianViewsPerDay: "Median views per day", medianOutlier: "Median outlier" }, selected)}</select>`;
}

function renderUploadPatterns() {
  const p = analysis.uploadPatterns;
  const e = p.engagement;
  return `<div class="yt-outlier-patterns">
    ${patternSection("Duration", `${chartCard("duration-chart", "Performance by video duration", "Long-form uploads grouped by runtime. Sample counts are shown for every bucket.", groupedMetricToggle("duration-metric", durationMetric))}${groupSummary(p.duration)}`)}
    ${patternSection("Weekday", `${chartCard("weekday-chart", "Performance by upload weekday", "Upload weekday is calculated in UTC. Small samples are descriptive only.", groupedMetricToggle("weekday-metric", weekdayMetric))}${groupSummary(p.weekday)}`)}
    ${patternSection("Upload frequency", `${frequencyMetrics(p.frequency)}${chartCardWithData("frequency-chart", "Gaps between consecutive uploads", "Uses all valid public uploads in the current scan sample.", p.frequency.gaps.length, "At least two valid public uploads are required to calculate gaps.")}`)}
    ${patternSection("Title patterns", `<div class="yt-outlier-chart-grid">${chartCardWithData("title-scatter-chart", "Title length versus outlier", "Each point represents an eligible long-form upload.", p.title.scatter.length, "No eligible videos have a valid outlier score.")}${chartCardWithData("title-buckets-chart", "Performance by title length", "Median outlier by title-character bucket, with sample counts.", p.title.scatter.length, "No eligible videos have a valid outlier score.")}</div>${titlePatternTable(p.title.patterns)}`)}
    ${patternSection("Engagement ratios", `${engagementMetrics(e)}<div class="yt-outlier-chart-grid">${chartCardWithData("like-scatter-chart", "Like rate versus outlier", "Public likes divided by public views.", e.likeScatter.length, "No videos have both valid like data and an outlier score.")}${chartCardWithData("comment-scatter-chart", "Comment rate versus outlier", "Public comments divided by public views.", e.commentScatter.length, "No videos have both valid comment data and an outlier score.")}</div><p class="yt-outlier-note">Public engagement ratios do not represent retention, watch time, or viewer satisfaction.</p>`)}
    ${patternSection("Observed patterns", observedPatterns(p.observedPatterns))}
  </div>`;
}

function patternSection(title: string, content: string) { return `<section class="yt-outlier-pattern-section"><h2>${title}</h2>${content}</section>`; }
function chartCardWithData(id: string, title: string, description: string, count: number, emptyText: string) { return `<section class="yt-outlier-chart-card"><div class="yt-outlier-section-heading"><div><h3>${title}</h3><p>${description}</p></div></div>${count ? `<div class="yt-outlier-chart-wrap"><canvas id="${id}" aria-label="${title}"></canvas></div>` : `<div class="yt-outlier-empty">${emptyText}</div>`}</section>`; }
function groupSummary(groups: GroupSummary[]) { return `<div class="yt-outlier-sample-grid">${groups.map((group) => `<div><strong>${escapeHtml(group.label)}</strong><span>${group.count} ${group.count === 1 ? "video" : "videos"}</span>${group.limitedSample ? `<em>Limited sample</em>` : ""}</div>`).join("")}</div>`; }
function frequencyMetrics(frequency: Frequency) { return `<div class="yt-outlier-metrics yt-outlier-pattern-metrics">${([
  ["Median days between uploads", formatDays(frequency.medianDays)], ["Mean days between uploads", formatDays(frequency.meanDays)],
  ["Longest recent upload gap", formatDays(frequency.longestDays)], ["Shortest recent upload gap", formatDays(frequency.shortestDays)],
  ["Uploads per 30 days", formatDecimal(frequency.uploadsPer30Days)]
] as MetricCard[]).map(metricCard).join("")}</div>`; }
function engagementMetrics(e: AnalysisResult["uploadPatterns"]["engagement"]) { return `<div class="yt-outlier-metrics yt-outlier-pattern-metrics">${([
  ["Median like rate", formatRate(e.medianLikeRate)], ["Median comment rate", formatRate(e.medianCommentRate)],
  ["Highest like-rate video", e.highestLikeRateVideo ? `${formatRate(e.highestLikeRateVideo.likeRate)} · ${shorten(e.highestLikeRateVideo.title, 24)}` : "Unavailable"],
  ["Highest comment-rate video", e.highestCommentRateVideo ? `${formatRate(e.highestCommentRateVideo.commentRate)} · ${shorten(e.highestCommentRateVideo.title, 24)}` : "Unavailable"],
  ["Videos with valid like data", String(e.validLikeCount)], ["Videos with valid comment data", String(e.validCommentCount)]
] as MetricCard[]).map(metricCard).join("")}</div>`; }
function titlePatternTable(patterns: AnalysisResult["uploadPatterns"]["title"]["patterns"]) { return `<div class="yt-outlier-table-wrap"><table class="yt-outlier-table yt-outlier-pattern-table"><thead><tr><th>Pattern</th><th>Matching</th><th>Non-matching</th><th>Matching median outlier</th><th>Non-matching median outlier</th><th>Matching median views/day</th><th>Sample</th></tr></thead><tbody>${patterns.map((pattern) => `<tr><td>${escapeHtml(pattern.label)}</td><td>${pattern.matchingCount}</td><td>${pattern.nonMatchingCount}</td><td>${formatMultiple(pattern.matchingMedianOutlier)}</td><td>${formatMultiple(pattern.nonMatchingMedianOutlier)}</td><td>${S.compactNumber(pattern.matchingMedianViewsPerDay)}</td><td>${pattern.limitedSample ? `<span class="yt-outlier-limited">Limited sample</span>` : "Sufficient"}</td></tr>`).join("")}</tbody></table></div>`; }
function observedPatterns(insights: string[]) { return `${insights.length ? `<ul class="yt-outlier-insights">${insights.map((insight) => `<li>${escapeHtml(insight)}</li>`).join("")}</ul>` : `<div class="yt-outlier-empty">Not enough eligible data to describe patterns.</div>`}<p class="yt-outlier-note">These are descriptive patterns from public channel data. They do not establish causation.</p>`; }

function renderGrowthTracking() {
  if (growthLoading) return `<div class="yt-outlier-empty"><strong>Loading growth snapshots…</strong><span>Based on extension snapshots</span></div>`;
  if (growthError) return `<div class="yt-outlier-empty"><strong>Growth data unavailable</strong><span>${escapeHtml(growthError)}</span></div>`;
  if (!growthSummary) { queueMicrotask(() => loadGrowthSummary(analysis?.channel.id)); return `<div class="yt-outlier-empty"><strong>Loading growth snapshots…</strong></div>`; }
  const scans = growthSummary.channelSnapshots || [];
  if (!scans.length) return growthEmpty("Growth tracking starts after the first successful scan.");
  if (scans.length === 1) return `${trackingNote()}${growthEmpty("One snapshot has been recorded. Scan this channel again later to create a real comparison.")}${renderSnapshotTable(scans)}`;
  const summary = growthSummary.summary;
  const fastest = summary.fastestGrowingVideo;
  const largest = summary.largestAbsoluteGain;
  return `${trackingNote()}<section class="yt-outlier-metrics yt-outlier-growth-metrics">${([
    ["Recorded scans", String(summary.recordedScans)], ["Time span covered", growthSpan(summary.firstCapturedAt, summary.lastCapturedAt)],
    ["Tracked views gained", signedNumber(summary.totalViewGain)], ["Median views/hour", signedNumber(summary.medianViewsPerHour)],
    ["Fastest-growing video", fastest ? shorten(fastest.title, 28) : "Unavailable"], ["Largest view gain", largest ? signedNumber(largest.viewGain) : "Unavailable"],
    ["Videos with comparisons", String(summary.videosWithComparisons)]
  ] as MetricCard[]).map(metricCard).join("")}</section>
  ${growthChartCard("momentum-chart", "Channel momentum", "Total observed view gain, median video velocity, and matched videos for each scan interval.")}
  ${renderFastestGrowth()}
  ${renderSelectedGrowth()}
  ${renderSnapshotTable(scans)}
  ${renderObservedChanges()}`;
}

function trackingNote() { return `<div class="yt-outlier-integrity"><strong>Observed since tracking began</strong><span>Based on extension snapshots · Observed growth between scans</span><span>No historical data exists before the first recorded scan</span></div>`; }
function growthEmpty(message: string) { return `<div class="yt-outlier-empty"><strong>${escapeHtml(message)}</strong><span>No historical data exists before the first recorded scan.</span></div>`; }
function growthChartCard(id: string, title: string, description: string, controls = "") { return `<section class="yt-outlier-chart-card"><div class="yt-outlier-section-heading"><div><h3>${title}</h3><p>${description}</p></div>${controls}</div><div class="yt-outlier-chart-wrap"><canvas id="${id}" aria-label="${title}"></canvas></div></section>`; }

function renderFastestGrowth() {
  const intervals = (growthSummary?.videos || []).map((video) => video.latestInterval).filter((item): item is LatestInterval => item !== null);
  const valid = intervals.filter((item) => Number.isFinite(item[rankingMetric as keyof LatestInterval]));
  const metricValue = (item: LatestInterval): number => Number(item[rankingMetric as keyof LatestInterval] || 0);
  const rows = [...valid].sort((a, b) => metricValue(b) - metricValue(a)).slice(0, 10);
  const controls = `<select class="yt-outlier-select" data-control="ranking-metric" aria-label="Ranking metric">${options({ viewGain: "Views gained", viewsPerHour: "Views per hour", likeGain: "Likes gained", commentGain: "Comments gained" }, rankingMetric)}</select>`;
  return `<section class="yt-outlier-chart-card"><div class="yt-outlier-section-heading"><div><h3>Fastest-growing videos</h3><p>Most recent valid interval. Public counter corrections remain visible.</p></div>${controls}</div>${rows.length ? `<div class="yt-outlier-chart-wrap"><canvas id="fastest-chart"></canvas></div><div class="yt-outlier-growth-list">${rows.map((item) => `<button type="button" data-growth-video="${attr(item.videoId)}">${item.thumbnailUrl ? `<img src="${attr(item.thumbnailUrl)}" alt="">` : ""}<span><strong>${escapeHtml(item.title)}</strong><small>${G.formatElapsed(item.elapsedHours)} · gain ${signedNumber(Number(item[itemMetricGain(rankingMetric)]))} · ${signedNumber(Number(item[rankingRate(rankingMetric)]))}/h${item.corrected ? " · corrected" : ""}</small></span></button>`).join("")}</div>` : `<div class="yt-outlier-empty">At least two snapshots with this metric are required.</div>`}</section>`;
}

function renderSelectedGrowth() {
  const videos = growthSummary?.videos || [];
  const selected = videos.find((video) => video.videoId === growthVideoId);
  const snapshots = growthVideoId ? videoSnapshotCache.get(growthVideoId) : undefined;
  const controls = `<div class="yt-outlier-growth-controls"><select class="yt-outlier-select" data-control="growth-video">${videos.map((video) => `<option value="${attr(video.videoId)}" ${video.videoId === growthVideoId ? "selected" : ""}>${escapeHtml(shorten(video.title, 45))}</option>`).join("")}</select><select class="yt-outlier-select" data-control="growth-metric">${options({ viewCount: "Cumulative views", viewGain: "Views gained", viewsPerHour: "Views gained per hour", likeGain: "Likes gained", commentGain: "Comments gained" }, growthMetric)}</select></div>`;
  if (!selected) return `<section class="yt-outlier-chart-card"><h3>Selected-video growth</h3><div class="yt-outlier-empty">No tracked videos are available.</div></section>`;
  if (snapshots === null || snapshots === undefined) return `<section class="yt-outlier-chart-card"><div class="yt-outlier-section-heading"><div><h3>Selected-video growth</h3><p>Observed growth between extension snapshots</p></div>${controls}</div><div class="yt-outlier-empty">Loading video snapshots…</div></section>`;
  if (snapshots.length < 2) return `<section class="yt-outlier-chart-card"><div class="yt-outlier-section-heading"><div><h3>Selected-video growth</h3><p>Observed growth between extension snapshots</p></div>${controls}</div><div class="yt-outlier-empty">One snapshot has been recorded. Scan this channel again later to create a real comparison.</div></section>`;
  const acceleration = G.acceleration(snapshots, C.growthAcceleration);
  return `${growthChartCard("video-growth-chart", "Selected-video growth", "Observed growth between extension snapshots", controls)}<p class="yt-outlier-note">Recent observed velocity change: ${acceleration ? `${acceleration.classification} (${signedNumber(acceleration.change)} views/hour)` : "Requires at least three valid snapshots."}</p>`;
}

function renderSnapshotTable(scans: ChannelSnapshot[]) {
  return `<section class="yt-outlier-growth-section"><h3>Snapshot history</h3><p class="yt-outlier-note">Scan timestamps are stored in UTC.</p><div class="yt-outlier-table-wrap"><table class="yt-outlier-table"><thead><tr><th>Captured</th><th>Analyzed videos</th><th>Subscribers</th><th>Channel views</th></tr></thead><tbody>${[...scans].reverse().map((scan) => `<tr><td>${formatTimestamp(scan.capturedAt)}</td><td>${scan.analyzedVideoCount}</td><td>${S.fullNumber(scan.subscriberCount)}</td><td>${S.fullNumber(scan.totalChannelViews)}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function renderObservedChanges() {
  const titleChanges = growthSummary?.titleChanges || []; const thumbnailChanges = growthSummary?.thumbnailChanges || [];
  const changeList = (items: Array<{ value: string | null; title?: string; changedAt: string | null; firstObservedAt: string }>, thumbnail: boolean) => items.length ? `<div class="yt-outlier-change-list">${items.map((item) => `<div>${thumbnail && item.value ? `<img src="${attr(item.value)}" alt="">` : ""}<span><strong>${escapeHtml(thumbnail ? item.title : item.value || "Unavailable")}</strong><small>${thumbnail ? `${escapeHtml(shorten(item.title, 35))} · ` : ""}${item.changedAt ? `Changed ${formatTimestamp(item.changedAt)}` : `First observed ${formatTimestamp(item.firstObservedAt)}`}</small></span></div>`).join("")}</div>` : `<p class="yt-outlier-muted">No ${thumbnail ? "thumbnail" : "title"} snapshots have been observed.</p>`;
  return `<section class="yt-outlier-growth-section"><h3>Changes observed since tracking began</h3><p class="yt-outlier-note">This is observed snapshot history, not complete historical data. Thumbnail URL identity ignores common CDN query and host variation; replacements at the same URL cannot be detected.</p><div class="yt-outlier-chart-grid"><div><h4>Title history</h4>${changeList(titleChanges, false)}</div><div><h4>Thumbnail history</h4>${changeList(thumbnailChanges, true)}</div></div></section>`;
}

function renderVideos() {
  const videos = getVisibleVideos();
  return `<div class="yt-outlier-video-tools"><input class="yt-outlier-search" type="search" data-control="title-search" value="${attr(titleSearch)}" placeholder="Search titles" aria-label="Search video titles"><select class="yt-outlier-select" data-control="video-filter">${filterOptions()}</select><select class="yt-outlier-select" data-control="video-sort">${sortOptions()}</select></div>
    <div class="yt-outlier-table-wrap"><table class="yt-outlier-table"><thead><tr><th>Video</th><th>Published</th><th>Age</th><th>Duration</th><th>Views</th><th>Views/day</th><th>Baseline</th><th>Outlier</th><th>Like rate</th><th>Comment rate</th></tr></thead><tbody>${videos.map(videoRow).join("")}</tbody></table>${videos.length ? "" : `<div class="yt-outlier-empty">No videos match these filters.</div>`}</div>`;
}

function videoRow(video: AnalyzedVideo) {
  return `<tr tabindex="0" data-video-id="${attr(video.id)}"><td><div class="yt-outlier-table-video">${video.thumbnailUrl ? `<img src="${attr(video.thumbnailUrl)}" alt="">` : ""}<strong>${escapeHtml(video.title)}</strong></div></td><td>${formatDate(video.publishedAt)}</td><td>${S.formatAge(video.ageHours)}</td><td>${S.formatDuration(video.durationSeconds)}</td><td>${S.compactNumber(video.viewCount)}</td><td>${S.compactNumber(video.viewsPerDay)}</td><td>${S.compactNumber(video.baselineViews)}</td><td>${formatMultiple(video.outlierMultiple)}</td><td>${formatRate(video.likeRate)}</td><td>${formatRate(video.commentRate)}</td></tr>`;
}

function renderDrawer() {
  const video = analysis?.videos.find((item) => item.id === selectedVideoId);
  if (!video) return "";
  loadVideoSnapshots(video.id);
  const medians = medianComparisons();
  return `<div class="yt-outlier-drawer-backdrop" data-action="close-drawer"></div><aside class="yt-outlier-drawer" aria-label="Video details"><button class="yt-outlier-icon-button" type="button" data-action="close-drawer" aria-label="Close details">&times;</button>
    ${video.thumbnailUrl ? `<img class="yt-outlier-drawer-thumb" src="${attr(video.thumbnailUrl)}" alt="">` : ""}<h3>${escapeHtml(video.title)}</h3>
    <dl class="yt-outlier-detail-grid">${detail("Upload date", new Date(video.publishedAt).toLocaleString())}${detail("Age", S.formatAge(video.ageHours))}${detail("Duration", S.formatDuration(video.durationSeconds))}${detail("Views", S.fullNumber(video.viewCount))}${detail("Views/day", S.fullNumber(video.viewsPerDay))}${detail("Baseline", S.fullNumber(video.baselineViews))}${detail("Outlier", formatMultiple(video.outlierMultiple))}${detail("View rank", rankText(video.viewRank))}${detail("Outlier rank", rankText(video.outlierRank))}${detail("Like rate", formatRate(video.likeRate))}${detail("Comment rate", formatRate(video.commentRate))}</dl>
    <h4>Compared with channel median</h4><dl class="yt-outlier-detail-grid">${comparisonDetail("Views", video.viewCount, medians.views)}${comparisonDetail("Views/day", video.viewsPerDay, medians.viewsPerDay)}${comparisonDetail("Like rate", video.likeRate, medians.likeRate, true)}${comparisonDetail("Comment rate", video.commentRate, medians.commentRate, true)}${comparisonDetail("Duration", video.durationSeconds, medians.duration)}</dl>
    <section class="yt-outlier-mini-chart"><h4>Nearby eligible uploads</h4><div class="yt-outlier-chart-wrap"><canvas id="comparison-chart"></canvas></div></section>
    ${renderDrawerGrowth(video.id)}
    <a class="yt-outlier-primary-link" href="${attr(video.youtubeUrl)}" target="_blank" rel="noopener noreferrer">Open on YouTube</a></aside>`;
}

function renderDrawerGrowth(videoId: string) {
  const snapshots = videoSnapshotCache.get(videoId);
  if (snapshots === undefined || snapshots === null) return `<section><h4>Observed growth between scans</h4><p class="yt-outlier-muted">Loading extension snapshots…</p></section>`;
  if (snapshots.length < 2) return `<section><h4>Observed growth between scans</h4><p class="yt-outlier-muted">One snapshot has been recorded. Scan this channel again later to create a real comparison.</p></section>`;
  const value = G.intervals(snapshots).at(-1); const current = snapshots.at(-1); const previous = snapshots.at(-2);
  if (!value || !current || !previous) return `<section><h4>Observed growth between scans</h4><p class="yt-outlier-muted">A valid spaced comparison is unavailable.</p></section>`;
  const acceleration = G.acceleration(snapshots, C.growthAcceleration);
  return `<section><h4>Observed growth between scans</h4><dl class="yt-outlier-detail-grid">${detail("Current views", S.fullNumber(current.viewCount))}${detail("Previous recorded views", S.fullNumber(previous.viewCount))}${detail("View gain", signedNumber(value.viewGain))}${detail("Hours since scan", formatDecimal(value.elapsedHours))}${detail("Views gained/hour", signedNumber(value.viewsPerHour))}${detail("Like gain", signedNumber(value.likeGain))}${detail("Comment gain", signedNumber(value.commentGain))}${detail("Velocity change", acceleration?.classification || "Requires 3 snapshots")}</dl>${value.corrected ? `<p class="yt-outlier-correction" title="YouTube may correct public counts after audits.">Public counter correction observed; the negative value is preserved.</p>` : ""}<div class="yt-outlier-mini-chart"><div class="yt-outlier-chart-wrap"><canvas id="drawer-growth-chart"></canvas></div></div></section>`;
}

function handlePanelClick(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target : null; if (!target) return;
  const close = target.closest(".yt-outlier-close"); if (close) return closePanel();
  const tab = target.closest<HTMLElement>("[data-tab]"); if (tab) { activeTab = tab.dataset.tab || "overview"; if (activeTab === "growth-tracking") loadGrowthSummary(analysis.channel.id); else renderApp(); return; }
  const growthVideo = target.closest<HTMLElement>("[data-growth-video]"); if (growthVideo?.dataset.growthVideo) { growthVideoId = growthVideo.dataset.growthVideo; loadVideoSnapshots(growthVideoId); renderApp(); return; }
  const videoTarget = target.closest<HTMLElement>("[data-video-id]"); if (videoTarget) { selectedVideoId = videoTarget.dataset.videoId || null; renderApp(); return; }
  if (target.closest('[data-action="close-drawer"]')) { selectedVideoId = null; renderApp(); }
}
function handlePanelChange(event: Event) {
  const target = event.target instanceof HTMLSelectElement ? event.target : null; if (!target) return;
  const control = target.dataset.control;
  if (control === "recent-metric") recentMetric = target.value as AnalysisMetric;
  if (control === "age-metric") ageMetric = target.value as AnalysisMetric;
  if (control === "duration-metric") durationMetric = target.value as GroupMetric;
  if (control === "weekday-metric") weekdayMetric = target.value as GroupMetric;
  if (control === "video-sort") videoSort = target.value;
  if (control === "video-filter") videoFilter = target.value;
  if (control === "ranking-metric") rankingMetric = target.value as GrowthMetric;
  if (control === "growth-metric") growthMetric = target.value as GrowthMetric;
  if (control === "growth-video") { growthVideoId = target.value; loadVideoSnapshots(growthVideoId); }
  renderApp();
}
function handlePanelInput(event: Event) {
  const target = event.target instanceof HTMLInputElement ? event.target : null;
  if (target?.dataset.control !== "title-search") return;
  titleSearch = target.value;
  renderApp();
  requestAnimationFrame(() => {
    const search = panel?.querySelector<HTMLInputElement>('[data-control="title-search"]');
    if (search) { search.focus(); search.setSelectionRange(search.value.length, search.value.length); }
  });
}

function renderCharts() {
  if (!analysis || !panel) return;
  if (activeTab === "overview") { renderRecent(); renderDistribution(); renderTop(); }
  if (activeTab === "performance") { renderBaseline(); renderAge(); renderRolling(); renderConcentration(); }
  if (activeTab === "upload-patterns") { renderDuration(); renderWeekday(); renderFrequency(); renderTitleScatter(); renderTitleBuckets(); renderEngagementScatters(); }
  if (activeTab === "growth-tracking") { renderMomentum(); renderFastestChart(); renderVideoGrowth(); }
  if (selectedVideoId) renderComparison();
  if (selectedVideoId) renderDrawerGrowthChart();
}

function renderRecent() {
  const videos = [...analysis.eligible].reverse();
  const values = videos.map((video) => video[recentMetric]);
  const rolling = S.rollingMedian(values);
  const p = Charts.colors();
  const options = commonOptions("Upload order", metricName(recentMetric), videos);
  options.plugins.tooltip = { enabled: false, external: (context: { chart: { canvas: HTMLCanvasElement; width: number }; tooltip: TooltipLike }) => renderRecentTooltip(context, videos) };
  Charts.render("recent", byId("recent-chart"), { type: "line", data: { labels: videos.map((_, index) => String(index + 1)), datasets: [{ label: metricName(recentMetric), data: values, borderColor: p.primary, backgroundColor: p.primary, pointRadius: 4 }, { label: "Rolling median", data: rolling, borderColor: p.accent, borderDash: [6, 4], pointRadius: 0 }] }, options });
}
function renderDistribution() {
  const counts = Object.fromEntries(C.outlierBuckets.map((item) => [item.key, 0]));
  analysis.eligible.forEach((video) => { const key = S.bucket(video.outlierMultiple, C.outlierBuckets); if (key) counts[key] = (counts[key] || 0) + 1; });
  const p = Charts.colors(); Charts.render("distribution", byId("distribution-chart"), { type: "bar", data: { labels: C.outlierBuckets.map((item) => item.label), datasets: [{ label: "Videos", data: Object.values(counts), backgroundColor: p.primary }] }, options: commonOptions("Outlier bucket", "Videos") });
}
function renderTop() {
  const videos = analysis.eligible.filter((video): video is AnalyzedVideo & { outlierMultiple: number } => Number.isFinite(video.outlierMultiple)).sort((a, b) => b.outlierMultiple - a.outlierMultiple).slice(0, 10).reverse();
  const p = Charts.colors(); const chart = Charts.render("top", byId("top-chart"), { type: "bar", data: { labels: videos.map((video) => shorten(video.title, 24)), datasets: [{ label: "Outlier multiple", data: videos.map((video) => video.outlierMultiple), backgroundColor: p.accent }] }, options: { ...commonOptions("Outlier multiple", "Video", videos, true), indexAxis: "y", onClick: (_event: unknown, elements: ChartItem[]) => { const element = elements[0]; const video = element ? videos[element.dataIndex] : undefined; if (video) { selectedVideoId = video.id; renderApp(); } } } });
  return chart;
}
function renderBaseline() {
  const videos = analysis.eligible.filter((video): video is AnalyzedVideo & { baselineViews: number } => Number.isFinite(video.baselineViews));
  const max = Math.max(1, ...videos.flatMap((video) => [video.baselineViews, video.viewCount])); const p = Charts.colors();
  Charts.render("baseline", byId("baseline-chart"), { type: "scatter", data: { datasets: [{ label: "Videos", data: videos.map((video) => ({ x: video.baselineViews, y: video.viewCount, video })), backgroundColor: p.primary }, { label: "Actual = baseline", data: [{ x: 0, y: 0 }, { x: max, y: max }], borderColor: p.muted, borderDash: [6, 4], pointRadius: 0, type: "line" }] }, options: scatterOptions("Baseline views", "Actual views") });
}
function renderAge() {
  const videos = analysis.eligible.filter((video) => Number.isFinite(video[ageMetric])); const p = Charts.colors();
  Charts.render("age", byId("age-chart"), { type: "scatter", data: { datasets: [{ label: metricName(ageMetric), data: videos.map((video) => ({ x: video.ageDays, y: video[ageMetric], video })), backgroundColor: p.primary }] }, options: scatterOptions("Video age (days)", metricName(ageMetric)) });
}
function renderRolling() {
  const videos = [...analysis.eligible].reverse().filter((video) => Number.isFinite(video.baselineViews)); const p = Charts.colors();
  Charts.render("rolling", byId("rolling-chart"), { type: "line", data: { labels: videos.map((_, index) => String(index + 1)), datasets: [{ label: "Rolling baseline", data: videos.map((video) => video.baselineViews), borderColor: p.primary, backgroundColor: p.primary }] }, options: commonOptions("Upload order", "Baseline views", videos) });
}
function renderConcentration() {
  const sorted = [...analysis.videos].sort((a, b) => b.viewCount - a.viewCount); const total = sorted.reduce((sum, video) => sum + video.viewCount, 0); const sums = (start: number, end?: number) => sorted.slice(start, end).reduce((sum, video) => sum + video.viewCount, 0);
  const values = [sums(0, 1), sums(1, 3), sums(3, 5), sums(5)].map((value) => S.safeDivide(value, total) === null ? 0 : value / total * 100);
  Charts.render("concentration", byId("concentration-chart"), { type: "doughnut", data: { labels: ["Top 1", "Videos 2-3", "Videos 4-5", "Remaining"], datasets: [{ data: values, backgroundColor: ["#065fd4", "#2ba640", "#f4b400", "#8a8a8a"] }] }, options: { plugins: { tooltip: { callbacks: { label: (context: { label: string; raw: number }) => `${context.label}: ${context.raw.toFixed(1)}%` } } } } });
}
function renderComparison() {
  const chronological = [...analysis.eligible].reverse(); const index = chronological.findIndex((video) => video.id === selectedVideoId); if (index < 0) return;
  const videos = chronological.slice(Math.max(0, index - 5), index + 6); const p = Charts.colors();
  Charts.render("comparison", byId("comparison-chart"), { type: "bar", data: { labels: videos.map((video) => shorten(video.title, 12)), datasets: [{ label: "Views", data: videos.map((video) => video.viewCount), backgroundColor: videos.map((video) => video.id === selectedVideoId ? p.accent : p.primary) }] }, options: commonOptions("Nearby uploads", "Views", videos) });
}

function renderDuration() { renderGroupedBar("duration", byId("duration-chart"), analysis.uploadPatterns.duration, durationMetric); }
function renderWeekday() { renderGroupedBar("weekday", byId("weekday-chart"), analysis.uploadPatterns.weekday, weekdayMetric); }
function renderGroupedBar(key: string, canvas: Element | null | undefined, groups: GroupSummary[], metric: GroupMetric) {
  const p = Charts.colors();
  Charts.render(key, canvas, { type: "bar", data: { labels: groups.map((group) => `${group.label} (n=${group.count})`), datasets: [{ label: groupedMetricName(metric), data: groups.map((group) => group[metric]), backgroundColor: groups.map((group) => group.limitedSample ? p.warning : p.primary) }] }, options: { ...commonOptions("Group", groupedMetricName(metric)), plugins: { tooltip: { callbacks: { afterBody: (items: ChartItem[]) => { const group = groups[items[0]?.dataIndex ?? -1]; return group ? [`Sample: ${group.count}`, ...(group.limitedSample ? ["Limited sample"] : [])] : []; } } } } } });
}
function renderFrequency() {
  const gaps = analysis.uploadPatterns.frequency.gaps; if (!gaps.length) return;
  const p = Charts.colors();
  Charts.render("frequency", byId("frequency-chart"), { type: "bar", data: { labels: gaps.map((gap) => formatDate(gap.publishedAt)), datasets: [{ label: "Days since previous upload", data: gaps.map((gap) => gap.days), backgroundColor: p.primary }] }, options: { ...commonOptions("Upload date", "Gap (days)"), plugins: { tooltip: { callbacks: { afterBody: (items: ChartItem[]) => { const gap = gaps[items[0]?.dataIndex ?? -1]; return gap ? [`Upload #${gap.uploadNumber}`, `Previous: ${shorten(gap.previousVideo.title, 44)}`, `Current: ${shorten(gap.video.title, 44)}`] : []; } } } } } });
}
function renderTitleScatter() {
  const points = analysis.uploadPatterns.title.scatter; if (!points.length) return;
  const p = Charts.colors(); Charts.render("title-scatter", byId("title-scatter-chart"), { type: "scatter", data: { datasets: [{ label: "Videos", data: points, backgroundColor: p.primary }] }, options: titleScatterOptions("Title character count", "Outlier multiple") });
}
function renderTitleBuckets() { renderGroupedBar("title-buckets", byId("title-buckets-chart"), analysis.uploadPatterns.title.buckets, "medianOutlier"); }
function renderEngagementScatters() {
  const e = analysis.uploadPatterns.engagement; const p = Charts.colors();
  if (e.likeScatter.length) Charts.render("like-scatter", byId("like-scatter-chart"), { type: "scatter", data: { datasets: [{ label: "Videos", data: e.likeScatter, backgroundColor: p.primary }] }, options: engagementScatterOptions("Like rate", "Outlier multiple") });
  if (e.commentScatter.length) Charts.render("comment-scatter", byId("comment-scatter-chart"), { type: "scatter", data: { datasets: [{ label: "Videos", data: e.commentScatter, backgroundColor: p.accent }] }, options: engagementScatterOptions("Comment rate", "Outlier multiple") });
}

function renderMomentum() {
  const items = growthSummary?.momentum || []; if (!items.length) return;
  const p = Charts.colors();
  Charts.render("momentum", byId("momentum-chart"), { type: "line", data: { labels: items.map((item) => formatTimestamp(item.capturedAt)), datasets: [
    { label: "Total observed view gain", data: items.map((item) => item.totalViewGain), borderColor: p.primary, backgroundColor: p.primary, yAxisID: "y" },
    { label: "Median views/hour", data: items.map((item) => item.medianViewsPerHour), borderColor: p.accent, backgroundColor: p.accent, yAxisID: "y" },
    { label: "Videos included", data: items.map((item) => item.videosIncluded), borderColor: p.warning, backgroundColor: p.warning, yAxisID: "count" }
  ] }, options: { scales: { x: { title: { text: "Scan timestamp" } }, y: { title: { text: "Observed growth" }, beginAtZero: true }, count: { position: "right", title: { text: "Videos included" }, beginAtZero: true, grid: { drawOnChartArea: false } } } } });
}

function renderFastestChart() {
  const valueFor = (item: LatestInterval): number => Number(item[rankingMetric as keyof LatestInterval] || 0);
  const items = (growthSummary?.videos || []).map((video) => video.latestInterval).filter((item): item is LatestInterval => item !== null && Number.isFinite(item[rankingMetric as keyof LatestInterval]))
    .sort((a, b) => valueFor(b) - valueFor(a)).slice(0, 10).reverse();
  if (!items.length) return;
  const p = Charts.colors();
  Charts.render("fastest", byId("fastest-chart"), { type: "bar", data: { labels: items.map((item) => shorten(item.title, 26)), datasets: [{ label: growthMetricLabel(rankingMetric), data: items.map(valueFor), backgroundColor: items.map((item) => Number(item[itemMetricGain(rankingMetric)] || 0) < 0 ? p.warning : p.primary) }] }, options: { indexAxis: "y", scales: { x: { title: { text: growthMetricLabel(rankingMetric) } }, y: { title: { text: "Video" } } }, plugins: { tooltip: { callbacks: { afterBody: (points: ChartItem[]) => { const item = items[points[0]?.dataIndex ?? -1]; return item ? [`Interval: ${G.formatElapsed(item.elapsedHours)}`, `Gain: ${signedNumber(Number(item[itemMetricGain(rankingMetric)]))}`, `Gain/hour: ${signedNumber(Number(item[rankingRate(rankingMetric)]))}`, ...(item.corrected ? ["Public count correction observed"] : [])] : []; } } } } } });
}

function renderVideoGrowth() {
  const snapshots = growthVideoId ? videoSnapshotCache.get(growthVideoId) : undefined; if (!snapshots || snapshots.length < 2) return;
  renderSnapshotLine("video-growth", byId("video-growth-chart"), snapshots, growthMetric);
}

function renderDrawerGrowthChart() {
  const snapshots = selectedVideoId ? videoSnapshotCache.get(selectedVideoId) : undefined; if (!snapshots || snapshots.length < 2) return;
  renderSnapshotLine("drawer-growth", byId("drawer-growth-chart"), snapshots, "viewCount");
}

function renderSnapshotLine(key: string, canvas: Element | null | undefined, snapshots: VideoSnapshot[], metric: GrowthMetric) {
  const sorted = G.dedupeSnapshots(snapshots); const values = metric === "viewCount" ? sorted.map((item) => item.viewCount) : [null, ...G.intervals(sorted).map((item) => item[metric as keyof typeof item] as number | null)];
  const p = Charts.colors();
  Charts.render(key, canvas, { type: "line", data: { labels: sorted.map((item) => formatTimestamp(item.capturedAt)), datasets: [{ label: growthMetricLabel(metric), data: values, borderColor: p.primary, backgroundColor: p.primary, pointBackgroundColor: values.map((value) => Number.isFinite(value) && (value ?? 0) < 0 ? p.warning : p.primary), spanGaps: false }] }, options: { scales: { x: { title: { text: "Snapshot timestamp" } }, y: { title: { text: growthMetricLabel(metric) }, beginAtZero: metric === "viewCount" } }, plugins: { tooltip: { callbacks: { afterBody: (points: ChartItem[]) => Number(points[0]?.raw) < 0 ? ["Public counts can decrease after audits or corrections."] : [] } } } } });
}

function itemMetricGain(metric: GrowthMetric): keyof LatestInterval { return metric === "viewsPerHour" || metric === "viewCount" ? "viewGain" : metric; }
function rankingRate(metric: GrowthMetric): keyof LatestInterval { return metric === "likeGain" ? "likesPerHour" : metric === "commentGain" ? "commentsPerHour" : "viewsPerHour"; }
function growthMetricLabel(metric: GrowthMetric) { return ({ viewCount: "Cumulative views", viewGain: "Views gained", viewsPerHour: "Views gained per hour", likeGain: "Likes gained", commentGain: "Comments gained" })[metric]; }

function commonOptions(xTitle: string, yTitle: string, videos: AnalyzedVideo[] = [], horizontal = false): CommonOptions {
  const x = { title: { text: xTitle } }, y = { title: { text: yTitle }, beginAtZero: true };
  return { scales: horizontal ? { x: y, y: { ...x, ticks: { callback: (value: unknown, index: number) => videos[index] ? shorten(videos[index]?.title, 22) : value } } } : { x, y }, plugins: { tooltip: { callbacks: { afterBody: (items: ChartItem[]) => { const video = videos[items[0]?.dataIndex ?? -1]; return video ? tooltipLines(video) : []; } } } } };
}
function scatterOptions(xTitle: string, yTitle: string) { return { scales: { x: { title: { text: xTitle }, beginAtZero: true, ticks: {} as Record<string, unknown> }, y: { title: { text: yTitle }, beginAtZero: true } }, plugins: { tooltip: { callbacks: { label: (item: ScatterContext) => tooltipLines(item.raw.video) } } } }; }
function titleScatterOptions(xTitle: string, yTitle: string) { const result = scatterOptions(xTitle, yTitle); result.plugins.tooltip.callbacks.label = (item: ScatterContext) => { const video = item.raw.video; return [video.title, `Characters: ${video.titleMetadata.characterCount}`, `Views: ${S.fullNumber(video.viewCount)}`, `Views/day: ${S.fullNumber(video.viewsPerDay)}`, `Outlier: ${formatMultiple(video.outlierMultiple)}`]; }; return result; }
function engagementScatterOptions(xTitle: string, yTitle: string) { const result = scatterOptions(xTitle, yTitle); result.scales.x.ticks = { callback: (value: unknown) => `${(Number(value) * 100).toFixed(1)}%` }; result.plugins.tooltip.callbacks.label = (item: ScatterContext) => { const video = item.raw.video; return [video.title, `${xTitle}: ${formatRate(item.raw.x ?? null)}`, `Views: ${S.fullNumber(video.viewCount)}`, `Outlier: ${formatMultiple(video.outlierMultiple)}`]; }; return result; }
function tooltipLines(video: AnalyzedVideo) { return [video.title, `Uploaded: ${formatDate(video.publishedAt)}`, `Age: ${S.formatAge(video.ageHours)}`, `Views: ${S.fullNumber(video.viewCount)}`, `Views/day: ${S.fullNumber(video.viewsPerDay)}`, `Baseline: ${S.fullNumber(video.baselineViews)}`, `Outlier: ${formatMultiple(video.outlierMultiple)}`]; }
function renderRecentTooltip({ chart, tooltip }: { chart: { canvas: HTMLCanvasElement; width: number }; tooltip: TooltipLike }, videos: AnalyzedVideo[]) {
  let node = panel?.querySelector<HTMLElement>(".yt-outlier-chart-tooltip") || null;
  if (!node) { node = document.createElement("div"); node.className = "yt-outlier-chart-tooltip"; chart.canvas.parentNode?.appendChild(node); }
  if (!tooltip || tooltip.opacity === 0) { node.hidden = true; return; }
  const dataIndex = tooltip.dataPoints?.[0]?.dataIndex;
  const video = dataIndex === undefined ? undefined : videos[dataIndex]; if (!video) return;
  node.hidden = false;
  node.innerHTML = `${video.thumbnailUrl ? `<img src="${attr(video.thumbnailUrl)}" alt="">` : ""}<strong>${escapeHtml(video.title)}</strong>${tooltipLines(video).slice(1).map((line) => `<span>${escapeHtml(line)}</span>`).join("")}`;
  node.style.left = `${Math.min(tooltip.caretX + 12, chart.width - 240)}px`; node.style.top = `${Math.max(0, tooltip.caretY - 60)}px`;
}

function getVisibleVideos(): AnalyzedVideo[] {
  const now = new Date(analysis.scannedAt).getTime();
  const filtered = analysis.videos.filter((video) => {
    if (titleSearch && !video.title.toLowerCase().includes(titleSearch.toLowerCase())) return false;
    if (videoFilter === "long" && video.isLikelyShort) return false;
    if (videoFilter === "shorts" && !video.isLikelyShort) return false;
    if (videoFilter.startsWith("above") && (!Number.isFinite(video.outlierMultiple) || (video.outlierMultiple ?? 0) < Number(videoFilter.slice(5)))) return false;
    const days = ({ days30: 30, days90: 90, year: 365 } as Record<string, number>)[videoFilter];
    return !days || now - new Date(video.publishedAt).getTime() <= days * 86400000;
  });
  const getters: Record<string, (video: AnalyzedVideo) => number> = { views: (v) => -v.viewCount, outlier: (v) => -(v.outlierMultiple ?? -Infinity), vpd: (v) => -v.viewsPerDay, recent: (v) => -new Date(v.publishedAt).getTime(), oldest: (v) => new Date(v.publishedAt).getTime(), longest: (v) => -v.durationSeconds, shortest: (v) => v.durationSeconds, likes: (v) => -(v.likeRate ?? -Infinity), comments: (v) => -(v.commentRate ?? -Infinity) };
  const getter = getters[videoSort] || getters.views!;
  return filtered.sort((a, b) => getter(a) - getter(b) || b.publishedAt.localeCompare(a.publishedAt));
}

function medianComparisons() { const e = analysis.eligible; return { views: S.median(e.map((v) => v.viewCount)), viewsPerDay: S.median(e.map((v) => v.viewsPerDay)), likeRate: S.median(e.map((v) => v.likeRate)), commentRate: S.median(e.map((v) => v.commentRate)), duration: S.median(e.map((v) => v.durationSeconds)) }; }
function rollingDirectionDescription() { const values = [...analysis.eligible].reverse().map((v) => v.baselineViews).filter(Number.isFinite); const normalized = S.safeDivide(S.linearRegressionSlope(values), S.mean(values)); const direction = normalized === null ? "unavailable" : normalized > C.baselineDirection.rising ? "rising" : normalized < C.baselineDirection.declining ? "declining" : "stable"; return `Recent baseline direction: ${direction}. A descriptive trend across eligible uploads.`; }
function metricCard([label, value, tooltip]: MetricCard) { return `<div class="yt-outlier-metric" ${tooltip ? `title="${attr(tooltip)}"` : ""}><span>${label}${tooltip ? " <sup>?</sup>" : ""}</span><strong>${escapeHtml(value)}</strong></div>`; }
function detail(label: string, value: string) { return `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`; }
function comparisonDetail(label: string, value: number | null, baseline: number | null, rate = false) { const difference = value !== null && baseline !== null ? value - baseline : null; const percent = S.percentageDifference(value, baseline); const formatted = difference === null ? "Unavailable" : `${difference >= 0 ? "+" : ""}${rate ? (difference * 100).toFixed(2) + " pp" : S.compactNumber(difference)}${percent === null ? "" : ` (${percent >= 0 ? "+" : ""}${percent.toFixed(1)}%)`}`; return detail(label, formatted); }
function filterOptions() { return options({ all: "All videos", long: "Long-form only", shorts: "Likely Shorts", above1: "Above 1x", above2: "Above 2x", above5: "Above 5x", days30: "Last 30 days", days90: "Last 90 days", year: "Last year" }, videoFilter); }
function sortOptions() { return options({ views: "Highest views", outlier: "Highest outlier", vpd: "Highest views/day", recent: "Most recent", oldest: "Oldest", longest: "Longest", shortest: "Shortest", likes: "Highest like rate", comments: "Highest comment rate" }, videoSort); }
function options(entries: Record<string, string>, selected: string) { return Object.entries(entries).map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join(""); }
function byId(id: string) { return panel?.querySelector(`#${id}`); }
function formatRate(value: number | null) { return Number.isFinite(value) ? `${((value ?? 0) * 100).toFixed(2)}%` : "Unavailable"; }
function formatMultiple(value: number | null) { return Number.isFinite(value) ? `${(value ?? 0).toFixed(2)}x` : "Unavailable"; }
function formatDecimal(value: number | null) { return Number.isFinite(value) ? (value ?? 0).toFixed(1) : "Unavailable"; }
function rankText(value: number | null) { return Number.isFinite(value) ? `#${value}` : "Unavailable"; }
function metricName(metric: AnalysisMetric) { return ({ viewCount: "Total views", viewsPerDay: "Views per day", outlierMultiple: "Outlier multiple" })[metric]; }
function groupedMetricName(metric: GroupMetric) { return ({ medianViews: "Median views", medianViewsPerDay: "Median views per day", medianOutlier: "Median outlier" })[metric]; }
function formatDays(value: number | null) { return Number.isFinite(value) ? `${(value ?? 0).toFixed((value ?? 0) >= 10 ? 1 : 2)} days` : "Unavailable"; }
function signedNumber(value: number | null) { return Number.isFinite(value) ? `${(value ?? 0) > 0 ? "+" : ""}${S.compactNumber(value)}` : "Unavailable"; }
function formatTimestamp(value: string | null) { return value ? new Date(value).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Unavailable"; }
function growthSpan(start: string | null, end: string | null) { const hours = start && end ? (Date.parse(end) - Date.parse(start)) / 3600000 : null; return G.formatElapsed(hours); }
function formatDate(value: string) { return new Date(value).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }); }
function dateRange(start: string | null, end: string | null) { return start && end ? `${formatDate(start)} - ${formatDate(end)}` : "Date range unavailable"; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function shorten(value: unknown, length: number) { const text = String(value || ""); return text.length > length ? `${text.slice(0, length - 1)}...` : text; }
function escapeHtml(value: unknown) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function attr(value: unknown) { return escapeHtml(value); }
})();
