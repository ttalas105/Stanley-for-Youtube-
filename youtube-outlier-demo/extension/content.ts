import { buildAnalysis, type AnalysisResult, type AnalyzedVideo, type ContentFormat } from "./analysis";
import { stats } from "./statistics";
import { getErrorMessage, isChannelAnalysisResponse, isContentMessage, isRecord } from "../shared/guards";
import type { SupportedChannelIdentifier } from "../shared/types";

declare global {
  interface Window {
    __ytOutlierDemoLoaded?: boolean;
    __ytOutlierRefresh?: () => void;
    __ytOutlierDispose?: () => void;
  }
}

type StatusKind = "loading" | "success" | "error";
type OutlierTier = "breakout" | "above" | "below" | "unrated";
type TitlePlacement = { host: HTMLElement; heading: HTMLElement };
type PatternInsight = { label: string; value: string; score: number; detail: string };
type PulseLeader = { videoId: string; title: string; thumbnailUrl: string | null; viewGain: number | null; viewsPerHour: number | null; elapsedHours: number };
type PulseVideo = { videoId: string; title: string; thumbnailUrl: string | null; acceleration: { change: number; velocity1: number; velocity2: number; classification: "Accelerating" | "Decelerating" | "Stable" } | null };
type ChannelPulseData = {
  summary: {
    recordedScans: number;
    totalViewGain: number;
    medianViewsPerHour: number | null;
    fastestGrowingVideo: PulseLeader | null;
    largestAbsoluteGain: PulseLeader | null;
    videosWithComparisons: number;
  };
  videos: PulseVideo[];
};

const AUTO_SCAN_KEY = "autoScanEnabled";
const DETAIL_ID = "stanley-video-detail";
const CHANNEL_LAUNCHER_ID = "stanley-channel-launcher";
const CHANNEL_ANALYTICS_ID = "stanley-channel-analytics";
const CHANNEL_BACKDROP_ID = "stanley-channel-analytics-backdrop";
const STATUS_ID = "stanley-channel-status";
const LEGACY_PANEL_ID = "yt-outlier-panel";
const OVERLAY_SELECTOR = ".stanley-outlier-badge";
const VIDEO_LINK_SELECTOR = "a[href*='/watch?v=']";
const STANLEY_APP_URL = "http://localhost:3001/";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

let currentUrl = location.href;
let currentChannelKey = channelKey(getChannelFromUrl());
let autoScanEnabled = false;
let lastScannedChannelKey = "";
let analysis: AnalysisResult | null = null;
let channelPulse: ChannelPulseData | null = null;
let overlayRenderTimer: ReturnType<typeof setTimeout> | null = null;
let statusTimer: ReturnType<typeof setTimeout> | null = null;
let scanToken = 0;
let activeDetailButton: HTMLButtonElement | null = null;
let activeAnalyticsTrigger: HTMLButtonElement | null = null;
let openAnalyticsAfterScan = false;
let pageObserver: MutationObserver | null = null;
let disposed = false;
const activeScans = new Set<string>();

window.__ytOutlierDispose?.();
window.__ytOutlierDemoLoaded = true;
window.__ytOutlierRefresh = refreshUi;
window.__ytOutlierDispose = dispose;
void init();

async function init(): Promise<void> {
  removeInjectedUi();
  if (!extensionContextAvailable()) {
    dispose();
    return;
  }

  try {
    chrome.runtime.onMessage.addListener(handleContentMessage);
    chrome.storage.onChanged.addListener(handleStorageChange);
    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("keydown", handleDocumentKeydown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    const stored = await chrome.storage.local.get(AUTO_SCAN_KEY);
    if (disposed) return;
    autoScanEnabled = stored[AUTO_SCAN_KEY] === true;
  } catch (error: unknown) {
    if (isInvalidatedContext(error)) {
      dispose();
      return;
    }
    showStatus("error", getErrorMessage(error) || "Stanley could not read its settings.");
  }

  refreshUi();
  pageObserver = new MutationObserver(handlePageMutation);
  pageObserver.observe(document.documentElement, { childList: true, subtree: true });
}

function dispose(): void {
  if (disposed) return;
  disposed = true;
  scanToken += 1;
  pageObserver?.disconnect();
  pageObserver = null;
  if (overlayRenderTimer) clearTimeout(overlayRenderTimer);
  if (statusTimer) clearTimeout(statusTimer);
  overlayRenderTimer = null;
  statusTimer = null;
  document.removeEventListener("click", handleDocumentClick, true);
  document.removeEventListener("keydown", handleDocumentKeydown);
  window.removeEventListener("resize", handleViewportChange);
  window.removeEventListener("scroll", handleViewportChange, true);
  try {
    chrome.runtime.onMessage.removeListener(handleContentMessage);
    chrome.storage.onChanged.removeListener(handleStorageChange);
  } catch {
    // A reloaded extension has already detached these listeners.
  }
  removeInjectedUi();
  if (window.__ytOutlierDispose === dispose) {
    delete window.__ytOutlierDispose;
    delete window.__ytOutlierRefresh;
    delete window.__ytOutlierDemoLoaded;
  }
}

function extensionContextAvailable(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function isInvalidatedContext(error: unknown): boolean {
  return !extensionContextAvailable() || /extension context invalidated/i.test(getErrorMessage(error));
}

function handlePageMutation(): void {
  if (disposed) return;
  if (!extensionContextAvailable()) {
    dispose();
    return;
  }
  if (location.href !== currentUrl) {
    currentUrl = location.href;
    const nextChannelKey = channelKey(getChannelFromUrl());
    if (nextChannelKey !== currentChannelKey) clearChannelUi();
    currentChannelKey = nextChannelKey;
    refreshUi();
    return;
  }
  if (autoScanEnabled && currentChannelKey) renderChannelLauncher();
  if (analysis && currentChannelKey) scheduleOverlayRender();
}

function handleStorageChange(changes: Record<string, chrome.storage.StorageChange>, areaName: string): void {
  if (disposed || areaName !== "local" || !changes[AUTO_SCAN_KEY]) return;
  autoScanEnabled = changes[AUTO_SCAN_KEY].newValue === true;
  if (autoScanEnabled) refreshUi();
  else clearChannelUi();
}

function handleContentMessage(message: unknown, _sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void): boolean {
  if (disposed || !isContentMessage(message)) return false;
  refreshUi();
  sendResponse({ ok: true, isChannelPage: Boolean(getChannelFromUrl()), autoScanEnabled });
  return false;
}

function getChannelFromUrl(): SupportedChannelIdentifier | null {
  const url = new URL(location.href);
  if (!(url.hostname === "youtube.com" || url.hostname.endsWith(".youtube.com"))) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const first = parts[0] || "";
  if (first.startsWith("@") && first.length > 1) return { type: "handle", value: first };
  if (first === "channel" && parts[1] && /^UC[a-zA-Z0-9_-]{20,}$/.test(parts[1])) return { type: "channelId", value: parts[1] };
  return null;
}

function channelKey(channel: SupportedChannelIdentifier | null): string {
  return channel ? `${channel.type}:${channel.value.toLowerCase()}` : "";
}

function refreshUi(): void {
  if (disposed) return;
  removeLegacyPanel();
  const channel = getChannelFromUrl();
  if (!channel) {
    clearChannelUi();
    return;
  }
  if (!autoScanEnabled) return;
  renderChannelLauncher();
  if (analysis && channelKey(channel) === lastScannedChannelKey) scheduleOverlayRender();
  else void autoScanChannel(channel);
}

async function autoScanChannel(channel: SupportedChannelIdentifier): Promise<void> {
  const key = channelKey(channel);
  if (disposed || !key || key === lastScannedChannelKey || activeScans.has(key)) return;
  if (!extensionContextAvailable()) {
    dispose();
    return;
  }

  activeScans.add(key);
  const token = ++scanToken;
  renderChannelLauncher();
  showStatus("loading", "Analyzing channel");

  try {
    const response: unknown = await chrome.runtime.sendMessage({ type: "ANALYZE_CHANNEL", channel });
    if (!isRecord(response) || response.ok !== true) {
      throw new Error(isRecord(response) && typeof response.error === "string" ? response.error : "Could not analyze this channel.");
    }
    if (!isChannelAnalysisResponse(response.data)) throw new Error("The channel analysis was invalid.");
    if (disposed || token !== scanToken || !autoScanEnabled || channelKey(getChannelFromUrl()) !== key) return;

    const nextAnalysis = buildAnalysis(response.data);
    const nextPulse = await loadChannelPulse(nextAnalysis.channel.id);
    if (disposed || token !== scanToken || !autoScanEnabled || channelKey(getChannelFromUrl()) !== key) return;
    analysis = nextAnalysis;
    channelPulse = nextPulse;
    lastScannedChannelKey = key;
    renderVideoOverlays();
    renderChannelLauncher();
    showStatus("success", "Outliers ready", 1500);
    if (openAnalyticsAfterScan) {
      openAnalyticsAfterScan = false;
      openChannelAnalytics();
    }
  } catch (error: unknown) {
    if (isInvalidatedContext(error)) {
      dispose();
      return;
    }
    if (!disposed && token === scanToken && autoScanEnabled && channelKey(getChannelFromUrl()) === key) {
      showStatus("error", "Couldn’t load channel analytics", 0, true);
      console.warn("Stanley channel analysis failed:", getErrorMessage(error));
    }
  } finally {
    activeScans.delete(key);
    renderChannelLauncher();
  }
}

async function loadChannelPulse(channelId: string): Promise<ChannelPulseData | null> {
  if (!channelId) return null;
  try {
    const response: unknown = await chrome.runtime.sendMessage({ type: "GET_CHANNEL_SNAPSHOTS", channelId });
    if (!isRecord(response) || response.ok !== true || !isChannelPulseData(response.data)) return null;
    return response.data;
  } catch (error: unknown) {
    if (isInvalidatedContext(error)) throw error;
    console.warn("Stanley pulse history could not be loaded:", getErrorMessage(error));
    return null;
  }
}

function renderChannelLauncher(): void {
  if (disposed || !autoScanEnabled || !getChannelFromUrl()) return;
  const host = document.querySelector<HTMLElement>(
    ".ytPageHeaderViewModelHeadline, ytd-c4-tabbed-header-renderer #inner-header-container, #channel-header-container #inner-header-container"
  );
  if (!host) return;

  host.classList.add("stanley-channel-launcher-host");
  let launcher = document.getElementById(CHANNEL_LAUNCHER_ID) as HTMLButtonElement | null;
  if (launcher && launcher.parentElement !== host) launcher.remove();
  if (!launcher?.isConnected) {
    launcher = document.createElement("button");
    launcher.id = CHANNEL_LAUNCHER_ID;
    launcher.type = "button";
    launcher.setAttribute("aria-haspopup", "dialog");
    launcher.innerHTML = `
      <img src="${escapeHtml(chrome.runtime.getURL("stanley-mascot-dashboard.png"))}" alt="" />
      <span><strong>Stanley</strong><small>Analyze this channel</small></span>`;
    launcher.addEventListener("click", handleChannelLauncherClick);
    host.appendChild(launcher);
  }

  const channel = getChannelFromUrl();
  const loading = Boolean(channel && activeScans.has(channelKey(channel)));
  const state = loading ? "loading" : analysis ? "ready" : "idle";
  if (launcher.dataset.state !== state) launcher.dataset.state = state;
  const label = launcher.querySelector<HTMLElement>("small");
  const nextLabel = loading ? "Analyzing…" : "Analyze this channel";
  if (label && label.textContent !== nextLabel) label.textContent = nextLabel;
  const accessibleLabel = loading ? "Stanley is analyzing this channel" : "Analyze this channel with Stanley";
  if (launcher.getAttribute("aria-label") !== accessibleLabel) launcher.setAttribute("aria-label", accessibleLabel);
  launcher.setAttribute("aria-busy", loading ? "true" : "false");
  if (launcher.disabled !== loading) launcher.disabled = loading;
}

function handleChannelLauncherClick(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
  const launcher = event.currentTarget instanceof HTMLButtonElement ? event.currentTarget : null;
  if (analysis && channelKey(getChannelFromUrl()) === lastScannedChannelKey) {
    activeAnalyticsTrigger = launcher;
    openChannelAnalytics();
    return;
  }
  const channel = getChannelFromUrl();
  if (!channel) return;
  activeAnalyticsTrigger = launcher;
  openAnalyticsAfterScan = true;
  renderChannelLauncher();
  void autoScanChannel(channel);
}

function scheduleOverlayRender(): void {
  if (disposed || overlayRenderTimer) return;
  overlayRenderTimer = setTimeout(() => {
    overlayRenderTimer = null;
    renderVideoOverlays();
  }, 120);
}

function renderVideoOverlays(): void {
  if (disposed || !analysis || !autoScanEnabled || !getChannelFromUrl()) return;
  const videosById = new Map(analysis.videos.map((video) => [video.id, video]));
  const usedIds = new Set<string>();
  const imageLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(VIDEO_LINK_SELECTOR))
    .filter((link) => link.matches(".ytLockupViewModelContentImage, #thumbnail") || Boolean(link.querySelector("img")));

  for (const imageLink of imageLinks) {
    const videoId = videoIdFromHref(imageLink.href);
    if (!videoId || usedIds.has(videoId)) continue;
    const video = videosById.get(videoId);
    if (!video) continue;
    const placement = findTitlePlacement(imageLink, videoId);
    if (!placement) continue;
    usedIds.add(videoId);
    upsertVideoBadge(placement, video);
  }
}

function findTitlePlacement(imageLink: HTMLAnchorElement, videoId: string): TitlePlacement | null {
  const card = imageLink.closest<HTMLElement>(".ytLockupViewModelHost, ytd-rich-grid-media, ytd-grid-video-renderer, ytd-video-renderer, ytd-rich-item-renderer");
  if (!card) return null;
  const titleLink = Array.from(card.querySelectorAll<HTMLAnchorElement>(VIDEO_LINK_SELECTOR)).find((link) => {
    return link !== imageLink && videoIdFromHref(link.href) === videoId && Boolean(link.closest("h3") || link.id === "video-title");
  });
  if (!titleLink) return null;
  const heading = titleLink.closest<HTMLElement>("h3") || titleLink.parentElement;
  const host = heading?.parentElement;
  return heading && host ? { heading, host } : null;
}

function upsertVideoBadge(placement: TitlePlacement, video: AnalyzedVideo): void {
  const { host, heading } = placement;
  host.classList.add("stanley-title-metric-host");
  heading.classList.add("stanley-title-heading");
  let existing = Array.from(host.children).find((child) => child instanceof HTMLButtonElement && child.classList.contains("stanley-outlier-badge")) as HTMLButtonElement | undefined;
  if (existing && existing.dataset.videoId !== video.id) {
    if (activeDetailButton === existing) closeDetailPopover(false);
    existing.remove();
    existing = undefined;
  }

  const label = formatOutlier(video.outlierMultiple);
  const accessibleLabel = video.outlierMultiple === null
    ? `Outlier score unavailable. View analytics for ${video.title}`
    : `${label} channel baseline. View analytics for ${video.title}`;
  const badge = existing || document.createElement("button");
  badge.type = "button";
  badge.className = "stanley-outlier-badge";
  badge.dataset.stanleyOverlay = "true";
  badge.dataset.videoId = video.id;
  badge.dataset.tier = outlierTier(video.outlierMultiple);
  badge.textContent = label;
  badge.title = accessibleLabel;
  badge.setAttribute("aria-label", accessibleLabel);
  badge.setAttribute("aria-haspopup", "dialog");
  badge.setAttribute("aria-expanded", activeDetailButton === badge ? "true" : "false");

  if (!existing) {
    badge.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openVideoDetail(video, badge);
    });
    host.appendChild(badge);
  }
}

function openVideoDetail(video: AnalyzedVideo, badge: HTMLButtonElement): void {
  closeDetailPopover(false);
  activeDetailButton = badge;
  badge.setAttribute("aria-expanded", "true");

  const recentTopVideos = topVideosInLastThirtyDays();
  const verdict = videoPerformanceVerdict(video);
  const recentSection = recentTopVideos.length ? `
    <section class="stanley-recent-videos" aria-labelledby="stanley-recent-heading">
      <header><h3 id="stanley-recent-heading">Recent channel leaders</h3><span>Past 30 days</span></header>
      ${renderRecentVideoList(recentTopVideos)}
    </section>` : "";
  const popover = document.createElement("section");
  popover.id = DETAIL_ID;
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-modal", "false");
  popover.setAttribute("aria-labelledby", "stanley-detail-title");
  popover.innerHTML = `
    <header class="stanley-detail-header">
      <div class="stanley-detail-brand">
        <img class="stanley-detail-mascot" src="${escapeHtml(chrome.runtime.getURL("stanley-mascot-dashboard.png"))}" alt="" />
        <div><strong>Stanley</strong><span>Quick video check</span></div>
      </div>
      <button type="button" class="stanley-detail-close" aria-label="Close video analytics">&times;</button>
    </header>
    <div class="stanley-detail-video">
      <h2 id="stanley-detail-title">${escapeHtml(video.title)}</h2>
      <p>Published ${escapeHtml(formatDate(video.publishedAt))}</p>
    </div>
    <section class="stanley-detail-verdict" data-tier="${outlierTier(video.outlierMultiple)}">
      <div><strong>${escapeHtml(verdict.label)}</strong><span>${escapeHtml(formatOutlier(video.outlierMultiple))} usual</span></div>
      <p>${escapeHtml(verdict.explainer)}</p>
    </section>
    ${renderVideoComparison(video)}
    ${recentSection}
    <a class="stanley-app-link" href="${escapeHtml(stanleyHandoffUrl(video))}" target="_blank" rel="noopener noreferrer">
      <span>Build a similar video in Stanley</span><span aria-hidden="true">↗</span>
    </a>`;

  popover.querySelector<HTMLButtonElement>(".stanley-detail-close")?.addEventListener("click", () => closeDetailPopover());
  document.body.appendChild(popover);
  positionDetailPopover(popover, badge);
  popover.querySelector<HTMLButtonElement>(".stanley-detail-close")?.focus({ preventScroll: true });
}

function topVideosInLastThirtyDays(): AnalyzedVideo[] {
  if (!analysis) return [];
  const scannedAt = new Date(analysis.scannedAt).getTime();
  if (!Number.isFinite(scannedAt)) return [];
  const cutoff = scannedAt - THIRTY_DAYS_MS;
  return [...analysis.eligible]
    .filter((video) => {
      const publishedAt = new Date(video.publishedAt).getTime();
      return Number.isFinite(publishedAt) && publishedAt >= cutoff && publishedAt <= scannedAt;
    })
    .sort((a, b) => b.viewCount - a.viewCount || b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 5);
}

function renderRecentVideoList(videos: AnalyzedVideo[]): string {
  if (!videos.length) return '<p class="stanley-recent-empty">No long-form uploads found in this window.</p>';
  return `<ol>${videos.map((video, index) => `
    <li>
      <span class="stanley-recent-rank">${index + 1}</span>
      <span class="stanley-recent-copy"><strong>${escapeHtml(video.title)}</strong><small>${escapeHtml(compactNumber(video.viewCount))} views · ${escapeHtml(formatOutlier(video.outlierMultiple))} outlier</small></span>
    </li>`).join("")}</ol>`;
}

function videoPerformanceVerdict(video: AnalyzedVideo): { label: string; explainer: string } {
  const multiple = video.outlierMultiple;
  const typical = video.baselineViews;
  const comparison = typical === null
    ? `It has ${compactNumber(video.viewCount)} views so far.`
    : `It has ${compactNumber(video.viewCount)} views. This channel usually gets about ${compactNumber(typical)}.`;
  if (!Number.isFinite(multiple)) return { label: "Not enough history yet", explainer: `${comparison} Stanley needs more uploads for a fair comparison.` };
  if ((multiple ?? 0) >= 2) return { label: "This video is taking off", explainer: `${comparison} It is performing far above the usual result.` };
  if ((multiple ?? 0) >= 1.1) return { label: "Doing better than usual", explainer: `${comparison} It is comfortably ahead of the normal range.` };
  if ((multiple ?? 0) >= .9) return { label: "Close to the usual result", explainer: `${comparison} It is performing about where viewers normally take it.` };
  return { label: "Below the usual result", explainer: `${comparison} It has not reached the channel’s normal view level yet.` };
}

function renderVideoComparison(video: AnalyzedVideo): string {
  const typical = video.baselineViews;
  const maximum = Math.max(video.viewCount, typical ?? 0, 1);
  const videoWidth = Math.max(7, video.viewCount / maximum * 100);
  const typicalWidth = typical === null ? 0 : Math.max(7, typical / maximum * 100);
  const accessible = typical === null
    ? `This video has ${compactNumber(video.viewCount)} views. A typical result is not available.`
    : `This video has ${compactNumber(video.viewCount)} views compared with the typical ${compactNumber(typical)} views.`;
  return `<section class="stanley-detail-comparison" aria-labelledby="stanley-comparison-heading">
    <header><h3 id="stanley-comparison-heading">Views at a glance</h3><span>${escapeHtml(compactNumber(video.viewsPerDay))}/day</span></header>
    <div class="stanley-comparison-chart" role="img" aria-label="${escapeHtml(accessible)}">
      <div class="stanley-comparison-row">
        <div><span>This video</span><strong>${escapeHtml(compactNumber(video.viewCount))}</strong></div>
        <i><b data-series="video" data-tier="${outlierTier(video.outlierMultiple)}" style="width:${videoWidth.toFixed(1)}%"></b></i>
      </div>
      <div class="stanley-comparison-row">
        <div><span>Typical</span><strong>${typical === null ? "—" : escapeHtml(compactNumber(typical))}</strong></div>
        <i><b data-series="typical" style="width:${typicalWidth.toFixed(1)}%"></b></i>
      </div>
    </div>
  </section>`;
}

function stanleyHandoffUrl(video: AnalyzedVideo): string {
  const prompt = `Help me develop an original YouTube video inspired by “${video.title},” keeping the same audience appeal and format while creating a distinctly new premise.`;
  const url = new URL(STANLEY_APP_URL);
  url.searchParams.set("stanleyPrompt", prompt);
  url.searchParams.set("source", "youtube-extension");
  url.searchParams.set("videoId", video.id);
  return url.toString();
}

function openChannelAnalytics(): void {
  if (!analysis) return;
  closeDetailPopover(false);
  closeChannelAnalytics(false);

  const result = analysis;
  const validOutliers = videosWithOutliers(result.eligible);
  const topVideos = [...validOutliers]
    .sort((a, b) => b.outlierMultiple - a.outlierMultiple || b.viewCount - a.viewCount)
    .slice(0, 5);
  const patterns = strongestPatternInsights(result);
  const contentFormats = strongestContentFormats(result);
  const momentum = channelMomentum(result);
  const channelAvatar = result.channel.avatarUrl
    ? `<img class="stanley-analysis-avatar" src="${escapeHtml(result.channel.avatarUrl)}" alt="${escapeHtml(result.channel.title)} profile picture" />`
    : `<span class="stanley-analysis-avatar stanley-analysis-avatar-fallback" aria-hidden="true">${escapeHtml(result.channel.title.charAt(0).toUpperCase() || "C")}</span>`;
  const backdrop = document.createElement("div");
  backdrop.id = CHANNEL_BACKDROP_ID;
  backdrop.innerHTML = `
    <section id="${CHANNEL_ANALYTICS_ID}" role="dialog" aria-modal="true" aria-labelledby="stanley-channel-analysis-title">
      <header class="stanley-analysis-header">
        <div class="stanley-analysis-brand">
          ${channelAvatar}
          <div>
            <h1 id="stanley-channel-analysis-title">${escapeHtml(result.channel.title)}</h1>
            <p class="stanley-analysis-context">
              <span>Channel analysis</span>
              <strong data-direction="${momentum.direction}">${escapeHtml(momentum.label.replace("Channel is ", ""))} ${escapeHtml(momentum.value)}</strong>
              <span>${escapeHtml(momentumPlainText(momentum.direction))}</span>
            </p>
          </div>
        </div>
        <button type="button" class="stanley-analysis-close" aria-label="Close channel analysis">&times;</button>
      </header>

      <div class="stanley-analysis-body">
        <dl class="stanley-analysis-metric-rail">
          ${analysisMetric("Typical views", result.metrics.medianViews === null ? "—" : compactNumber(result.metrics.medianViews), "The middle result across long-form uploads")}
          ${analysisMetric("Best video", result.metrics.highestOutlier ? formatOutlier(result.metrics.highestOutlier.outlierMultiple) : "—", result.metrics.highestOutlier?.title || "Not enough history")}
          ${analysisMetric("Breakouts", `${result.metrics.above2}`, `${result.metrics.above2} of ${validOutliers.length} uploads performed above 2× the channel baseline`)}
        </dl>

        ${renderStanleyPulse(result, channelPulse)}

        <div class="stanley-performance-grid">
          <section class="stanley-channel-growth" aria-labelledby="stanley-growth-heading">
            <header>
              <div><h2 id="stanley-growth-heading">Channel growth</h2><span>Uploads compared with usual</span></div>
              <div class="stanley-range-control" role="group" aria-label="Channel growth period">
                <button type="button" data-growth-days="30" aria-pressed="false">30 days</button>
                <button type="button" data-growth-days="180" aria-pressed="true">6 months</button>
                <button type="button" data-growth-days="365" aria-pressed="false">1 year</button>
              </div>
            </header>
            <div class="stanley-growth-chart-host">${renderChannelGrowth(result, 180)}</div>
          </section>

          <section class="stanley-top-videos" aria-labelledby="stanley-top-videos-heading">
            <header><h2 id="stanley-top-videos-heading">Top videos</h2><span>Ranked by outlier</span></header>
            ${renderTopVideos(topVideos)}
          </section>
        </div>

        ${renderPatternDNA(contentFormats, result.eligible.length)}

        <section class="stanley-next-plan" aria-labelledby="stanley-next-plan-heading">
          <header><h2 id="stanley-next-plan-heading">Next upload plan</h2><span>Three practical moves</span></header>
          <div class="stanley-next-moves">${patterns.map(renderNextMove).join("")}</div>
        </section>
      </div>

      <footer class="stanley-analysis-footer">
        <p>Based on public video data.</p>
        <a href="${escapeHtml(channelHandoffUrl(result))}" target="_blank" rel="noopener noreferrer"><span>Use these ideas in Stanley</span><span aria-hidden="true">↗</span></a>
      </footer>
    </section>`;

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeChannelAnalytics();
  });
  backdrop.querySelector<HTMLButtonElement>(".stanley-analysis-close")?.addEventListener("click", () => closeChannelAnalytics());
  const growthHost = backdrop.querySelector<HTMLElement>(".stanley-growth-chart-host");
  backdrop.querySelectorAll<HTMLButtonElement>("[data-growth-days]").forEach((button) => {
    button.addEventListener("click", () => {
      const days = Number(button.dataset.growthDays);
      if (!growthHost || !Number.isFinite(days)) return;
      backdrop.querySelectorAll<HTMLButtonElement>("[data-growth-days]").forEach((option) => option.setAttribute("aria-pressed", option === button ? "true" : "false"));
      growthHost.innerHTML = renderChannelGrowth(result, days);
    });
  });
  document.documentElement.classList.add("stanley-channel-analysis-open");
  document.body.appendChild(backdrop);
  backdrop.querySelector<HTMLButtonElement>(".stanley-analysis-close")?.focus({ preventScroll: true });
}

function closeChannelAnalytics(restoreFocus = true): void {
  document.getElementById(CHANNEL_BACKDROP_ID)?.remove();
  document.documentElement.classList.remove("stanley-channel-analysis-open");
  if (restoreFocus && activeAnalyticsTrigger?.isConnected) activeAnalyticsTrigger.focus({ preventScroll: true });
  if (restoreFocus) activeAnalyticsTrigger = null;
}

function videosWithOutliers(videos: AnalyzedVideo[]): Array<AnalyzedVideo & { outlierMultiple: number }> {
  return videos.filter((video): video is AnalyzedVideo & { outlierMultiple: number } => Number.isFinite(video.outlierMultiple));
}

function renderTopVideos(videos: Array<AnalyzedVideo & { outlierMultiple: number }>): string {
  if (!videos.length) return '<p class="stanley-analysis-empty">More videos are needed.</p>';
  return `<ol>${videos.map((video, index) => {
    const thumbnail = video.thumbnailUrl
      ? `<img src="${escapeHtml(video.thumbnailUrl)}" alt="" />`
      : '<span class="stanley-top-video-thumb-fallback" aria-hidden="true">▶</span>';
    return `<li>
      <a href="${escapeHtml(video.youtubeUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(video.title)} on YouTube">
        <span class="stanley-top-video-rank">${String(index + 1).padStart(2, "0")}</span>
        <span class="stanley-top-video-thumb">${thumbnail}</span>
        <span class="stanley-top-video-copy"><strong>${escapeHtml(video.title)}</strong><small>${escapeHtml(compactNumber(video.viewCount))} views</small></span>
        <strong class="stanley-top-video-score">${escapeHtml(formatOutlier(video.outlierMultiple))}</strong>
      </a>
    </li>`;
  }).join("")}</ol>`;
}

function renderStanleyPulse(result: AnalysisResult, pulse: ChannelPulseData | null): string {
  const historyReady = Boolean(pulse && pulse.summary.recordedScans >= 2 && pulse.summary.videosWithComparisons > 0 && pulse.summary.fastestGrowingVideo);
  const mascotUrl = escapeHtml(chrome.runtime.getURL("stanley-mascot-dashboard.png"));
  if (!historyReady || !pulse?.summary.fastestGrowingVideo) {
    const currentLeader = [...result.eligible].sort((a, b) => b.viewsPerDay - a.viewsPerDay)[0] || null;
    const pace = currentLeader ? `${compactNumber(currentLeader.viewsPerDay)}/day` : "Learning";
    const leaderCopy = currentLeader ? `${currentLeader.title} has the strongest current pace.` : "Stanley needs another upload scan.";
    return `<section class="stanley-pulse" data-state="learning" aria-labelledby="stanley-pulse-heading">
      <div class="stanley-pulse-intro">
        <span class="stanley-pulse-mascot" aria-hidden="true"><img src="${mascotUrl}" alt="" /><i></i></span>
        <div><h2 id="stanley-pulse-heading">Stanley Pulse</h2><strong>Learning this channel</strong><p>${escapeHtml(leaderCopy)} Check back after a later scan to see live acceleration.</p></div>
      </div>
      <dl>
        ${pulseMetric("Current pace", pace)}
        ${pulseMetric("Uploads scanned", String(result.eligible.length))}
        ${pulseMetric("Live history", pulse ? `${pulse.summary.recordedScans} scan${pulse.summary.recordedScans === 1 ? "" : "s"}` : "Starting")}
      </dl>
    </section>`;
  }

  const leader = pulse.summary.fastestGrowingVideo;
  const acceleration = pulse.videos.find((video) => video.videoId === leader.videoId)?.acceleration || null;
  const state = acceleration?.classification === "Accelerating" ? "hot" : acceleration?.classification === "Decelerating" ? "cooling" : "steady";
  const headline = state === "hot" ? `${leader.title} is speeding up` : state === "cooling" ? `${leader.title} is still leading` : `${leader.title} is moving fastest`;
  const detail = state === "hot"
    ? `Its viewing pace increased since Stanley’s previous scan.`
    : state === "cooling"
      ? `It still leads the channel, but its viewing pace is easing.`
      : `It is holding the channel’s strongest live pace.`;
  return `<section class="stanley-pulse" data-state="${state}" aria-labelledby="stanley-pulse-heading">
    <div class="stanley-pulse-intro">
      <span class="stanley-pulse-mascot" aria-hidden="true"><img src="${mascotUrl}" alt="" /><i></i></span>
      <div><h2 id="stanley-pulse-heading">Stanley Pulse</h2><strong>${escapeHtml(headline)}</strong><p>${escapeHtml(detail)}</p></div>
    </div>
    <dl>
      ${pulseMetric("Views per hour", leader.viewsPerHour === null ? "—" : compactNumber(leader.viewsPerHour))}
      ${pulseMetric("Channel gain", `+${compactNumber(pulse.summary.totalViewGain)}`)}
      ${pulseMetric("Videos compared", String(pulse.summary.videosWithComparisons))}
    </dl>
  </section>`;
}

function pulseMetric(label: string, value: string): string {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function strongestContentFormats(result: AnalysisResult): ContentFormat[] {
  const formats = result.uploadPatterns.formats.filter((format) => Number.isFinite(format.medianOutlier));
  const repeatable = formats.filter((format) => format.count >= 2);
  return [...(repeatable.length ? repeatable : formats)]
    .sort((a, b) => (b.medianOutlier ?? 0) - (a.medianOutlier ?? 0) || b.count - a.count)
    .slice(0, 3);
}

function renderPatternDNA(formats: ContentFormat[], uploadCount: number): string {
  if (!formats.length) {
    return `<section class="stanley-pattern-dna" aria-labelledby="stanley-dna-heading">
      <header><h2 id="stanley-dna-heading">Pattern DNA</h2><span>Repeatable video formats</span></header>
      <p class="stanley-dna-empty">Stanley needs more comparable uploads to find a pattern.</p>
    </section>`;
  }
  const leader = formats[0]!;
  const repeatable = leader.count >= 2;
  const summary = repeatable
    ? `${leader.label} are this channel’s strongest repeatable format.`
    : `${leader.label} are the clearest early signal so far.`;
  const highest = Math.max(...formats.map((format) => format.medianOutlier ?? 0), 1);
  return `<section class="stanley-pattern-dna" aria-labelledby="stanley-dna-heading">
    <header><div><h2 id="stanley-dna-heading">Pattern DNA</h2><span>Repeatable video formats</span></div><p>${escapeHtml(summary)}</p></header>
    <ol>${formats.map((format, index) => renderPatternGene(format, index, uploadCount, highest)).join("")}</ol>
  </section>`;
}

function renderPatternGene(format: ContentFormat, index: number, uploadCount: number, highest: number): string {
  const strength = Math.max(14, Math.min(100, ((format.medianOutlier ?? 0) / highest) * 100));
  const sample = format.sampleVideo ? `Best example: ${format.sampleVideo.title}` : format.label;
  return `<li title="${escapeHtml(sample)}">
    <span class="stanley-dna-mark" data-gene="${index}" aria-hidden="true">${Array.from({ length: 8 }, (_, dot) => `<i style="--delay:${dot * 45}ms"></i>`).join("")}</span>
    <div class="stanley-dna-copy"><strong>${escapeHtml(format.label)}</strong><small>${format.count} of ${uploadCount} uploads</small><span><i style="--strength:${strength.toFixed(1)}%"></i></span></div>
    <b>${escapeHtml(formatOutlier(format.medianOutlier))}</b>
  </li>`;
}

function strongestPatternInsights(result: AnalysisResult): PatternInsight[] {
  const insights: PatternInsight[] = [];
  const contentFormat = strongestContentFormats(result).find((format) => format.count >= 2);
  if (contentFormat) {
    insights.push({
      label: "Format",
      value: `${contentFormat.label} · ${formatOutlier(contentFormat.medianOutlier)}`,
      score: Math.min(100, Math.max(18, (contentFormat.medianOutlier ?? 0) / 2 * 100)),
      detail: `${contentFormat.count} uploads use this repeatable format.`,
    });
  }
  const titlePattern = [...result.uploadPatterns.title.patterns]
    .filter((pattern) => pattern.matchingCount >= 2 && Number.isFinite(pattern.matchingMedianOutlier) && Number.isFinite(pattern.nonMatchingMedianOutlier))
    .sort((a, b) => ((b.matchingMedianOutlier ?? 0) - (b.nonMatchingMedianOutlier ?? 0)) - ((a.matchingMedianOutlier ?? 0) - (a.nonMatchingMedianOutlier ?? 0)))[0];
  if (titlePattern && (titlePattern.matchingMedianOutlier ?? 0) > (titlePattern.nonMatchingMedianOutlier ?? 0)) {
    insights.push({
      label: "Title",
      value: `${titlePattern.label} · ${formatOutlier(titlePattern.matchingMedianOutlier)}`,
      score: Math.min(100, Math.max(18, (titlePattern.matchingMedianOutlier ?? 0) / 2 * 100)),
      detail: `${titlePattern.matchingCount} matching uploads; ${formatOutlier(titlePattern.nonMatchingMedianOutlier)} without it.`,
    });
  }

  const duration = [...result.uploadPatterns.duration]
    .filter((group) => group.count >= 2 && Number.isFinite(group.medianOutlier))
    .sort((a, b) => (b.medianOutlier ?? 0) - (a.medianOutlier ?? 0))[0];
  if (duration) {
    insights.push({
      label: "Length",
      value: `${duration.label} · ${formatOutlier(duration.medianOutlier)}`,
      score: Math.min(100, Math.max(18, (duration.medianOutlier ?? 0) / 2 * 100)),
      detail: `${duration.count} uploads in this length range.`,
    });
  }

  const weekday = [...result.uploadPatterns.weekday]
    .filter((group) => group.count >= 2 && Number.isFinite(group.medianViewsPerDay))
    .sort((a, b) => (b.medianViewsPerDay ?? 0) - (a.medianViewsPerDay ?? 0))[0];
  if (weekday) {
    insights.push({
      label: "Day",
      value: `${weekday.label} · ${compactNumber(weekday.medianViewsPerDay ?? 0)}/day`,
      score: 72,
      detail: `${weekday.count} uploads published on ${weekday.label}.`,
    });
  }

  for (const observed of result.uploadPatterns.observedPatterns) {
    if (insights.length >= 3) break;
    insights.push({ label: "Signal", value: "Worth testing", score: 48, detail: observed });
  }
  while (insights.length < 3) {
    insights.push({ label: "Signal", value: "More data needed", score: 24, detail: "Keep publishing so Stanley can compare more videos." });
  }
  return insights.slice(0, 3);
}

function channelMomentum(result: AnalysisResult): {
  direction: "up" | "down" | "steady" | "limited";
  label: string;
  value: string;
  videos: Array<AnalyzedVideo & { outlierMultiple: number }>;
} {
  const videos = videosWithOutliers(result.eligible).slice(0, 6);
  const recent = videosWithOutliers(result.eligible.slice(0, 5));
  const previous = videosWithOutliers(result.eligible.slice(5, 10));
  const recentMedian = stats.median(recent.map((video) => video.outlierMultiple));
  const previousMedian = stats.median(previous.map((video) => video.outlierMultiple));
  if (recentMedian === null || previousMedian === null || previousMedian <= 0) {
    return { direction: "limited", label: "Not enough data", value: recentMedian === null ? "—" : formatOutlier(recentMedian), videos };
  }
  const change = (recentMedian - previousMedian) / previousMedian;
  const direction = change > .15 ? "up" : change < -.15 ? "down" : "steady";
  const label = direction === "up" ? "Channel is growing" : direction === "down" ? "Channel is slowing" : "Channel is steady";
  const changeLabel = `${change >= 0 ? "+" : ""}${Math.round(change * 100)}%`;
  return { direction, label, value: changeLabel, videos };
}

function momentumPlainText(direction: "up" | "down" | "steady" | "limited"): string {
  if (direction === "up") return "Recent videos are beating the usual range.";
  if (direction === "down") return "Recent videos are below the usual range.";
  if (direction === "steady") return "Recent videos are performing normally.";
  return "More videos are needed to show a trend.";
}

function renderChannelGrowth(result: AnalysisResult, days: number): string {
  const scannedAt = new Date(result.scannedAt).getTime();
  const cutoff = scannedAt - days * 24 * 60 * 60 * 1000;
  const available = videosWithOutliers(result.eligible)
    .filter((video) => {
      const publishedAt = new Date(video.publishedAt).getTime();
      return Number.isFinite(publishedAt) && publishedAt >= cutoff && publishedAt <= scannedAt;
    })
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  if (!available.length) return '<div class="stanley-growth-empty"><strong>No uploads in this range</strong><span>Try a longer time period.</span></div>';
  const sampleCount = Math.min(10, available.length);
  const videos = sampleCount === available.length
    ? available
    : Array.from({ length: sampleCount }, (_, index) => available[Math.round(index * (available.length - 1) / (sampleCount - 1))]!).filter((video, index, all) => index === 0 || video.id !== all[index - 1]?.id);
  const width = 520;
  const floorY = 174;
  const maximum = Math.max(...videos.map((video) => video.outlierMultiple), 1.25);
  const denominator = Math.log1p(maximum);
  const points = videos.map((video, index) => ({
    x: videos.length === 1 ? width / 2 : 34 + index * ((width - 68) / (videos.length - 1)),
    y: floorY - (Math.log1p(video.outlierMultiple) / denominator) * 124,
    video,
  }));
  const linePath = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    const previous = points[index - 1]!;
    const midpoint = (previous.x + point.x) / 2;
    return `${path} C ${midpoint.toFixed(1)} ${previous.y.toFixed(1)}, ${midpoint.toFixed(1)} ${point.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }, "");
  const areaPath = `${linePath} L ${points.at(-1)!.x.toFixed(1)} ${floorY} L ${points[0]!.x.toFixed(1)} ${floorY} Z`;
  const baselineY = floorY - (Math.log1p(1) / denominator) * 124;
  const label = videos.map((video) => `${formatDate(video.publishedAt)}, ${formatOutlier(video.outlierMultiple)}`).join(". ");
  const rangeTrend = channelRangeTrend(available);
  const dateIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  return `<div class="stanley-growth-readout" data-direction="${rangeTrend.direction}"><strong>${escapeHtml(rangeTrend.label)}</strong><span>${escapeHtml(rangeTrend.detail)}</span></div>
  <div class="stanley-curve-wrap" role="img" aria-label="Channel growth for the selected period. Each point compares an upload with the channel's usual result. ${escapeHtml(label)}">
    <svg class="stanley-curve-chart" viewBox="0 0 ${width} 210" aria-hidden="true">
      <path class="stanley-curve-area" d="${areaPath}" />
      <line class="stanley-curve-baseline" x1="18" y1="${baselineY.toFixed(1)}" x2="502" y2="${baselineY.toFixed(1)}" />
      <text class="stanley-curve-baseline-label" x="20" y="${Math.max(12, baselineY - 7).toFixed(1)}">1× usual</text>
      <path class="stanley-curve-line" d="${linePath}" />
      ${points.map((point, index) => `<g class="stanley-curve-point" style="--stanley-point-delay:${index * 70}ms">
        <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="5" />
        ${index === points.length - 1 ? `<text class="stanley-curve-value" x="${point.x.toFixed(1)}" y="${Math.max(14, point.y - 13).toFixed(1)}">${escapeHtml(formatOutlier(point.video.outlierMultiple))}</text>` : ""}
      </g>`).join("")}
      ${dateIndexes.map((index) => {
        const point = points[index]!;
        const date = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(point.video.publishedAt));
        return `<text class="stanley-growth-date" x="${point.x.toFixed(1)}" y="201">${escapeHtml(date)}</text>`;
      }).join("")}
    </svg>
  </div>`;
}

function channelRangeTrend(videos: Array<AnalyzedVideo & { outlierMultiple: number }>): { direction: "up" | "down" | "steady" | "limited"; label: string; detail: string } {
  if (videos.length < 4) return { direction: "limited", label: `${videos.length} upload${videos.length === 1 ? "" : "s"}`, detail: "More uploads are needed for a trend." };
  const midpoint = Math.floor(videos.length / 2);
  const earlier = stats.median(videos.slice(0, midpoint).map((video) => video.outlierMultiple));
  const recent = stats.median(videos.slice(midpoint).map((video) => video.outlierMultiple));
  if (earlier === null || recent === null || earlier <= 0) return { direction: "limited", label: "Trend unavailable", detail: "More comparable uploads are needed." };
  const change = (recent - earlier) / earlier;
  if (change > .12) return { direction: "up", label: `Up ${Math.round(change * 100)}%`, detail: "Recent uploads are improving." };
  if (change < -.12) return { direction: "down", label: `Down ${Math.abs(Math.round(change * 100))}%`, detail: "Recent uploads are losing momentum." };
  return { direction: "steady", label: "Holding steady", detail: "Recent uploads are near the earlier pace." };
}

function renderNextMove(insight: PatternInsight, index: number): string {
  const signal = insight.value.split(" · ")[0] || insight.value;
  const copy = insight.label === "Format"
    ? `Build around ${signal.toLowerCase()}.`
    : insight.label === "Title"
    ? `Try this title pattern: ${signal}.`
    : insight.label === "Length"
      ? `Aim for a ${signal.toLowerCase()} video.`
      : insight.label === "Day"
        ? `Test your next upload on ${signal}.`
        : insight.detail;
  const heading = insight.label === "Format" ? "Choose the format" : insight.label === "Title" ? "Package the idea" : insight.label === "Length" ? "Plan the runtime" : insight.label === "Day" ? "Choose the timing" : "Run one clear test";
  return `<article title="${escapeHtml(insight.detail)}">
    <span>${String(index + 1).padStart(2, "0")}</span>
    <div><strong>${escapeHtml(heading)}</strong><p>${escapeHtml(copy)}</p></div>
  </article>`;
}

function analysisMetric(label: string, value: string, detail: string): string {
  return `<div title="${escapeHtml(detail)}"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function channelHandoffUrl(result: AnalysisResult): string {
  const formats = strongestContentFormats(result).map((format) => format.label.toLowerCase()).join(", ");
  const patternContext = formats ? ` Its strongest repeatable formats are ${formats}.` : "";
  const prompt = `Turn the strongest repeatable patterns from ${result.channel.title}’s recent uploads into three original YouTube video concepts for my channel.${patternContext}`;
  const url = new URL(STANLEY_APP_URL);
  url.searchParams.set("stanleyPrompt", prompt);
  url.searchParams.set("source", "youtube-extension");
  return url.toString();
}

function positionDetailPopover(popover: HTMLElement, badge: HTMLButtonElement): void {
  const badgeRect = badge.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const margin = 12;
  const left = Math.min(Math.max(margin, badgeRect.left), window.innerWidth - popoverRect.width - margin);
  const below = badgeRect.bottom + 10;
  const highestTop = Math.max(margin, window.innerHeight - popoverRect.height - margin);
  const top = below + popoverRect.height <= window.innerHeight - margin
    ? below
    : Math.min(Math.max(margin, badgeRect.top - 24), highestTop);
  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(top)}px`;
}

function closeDetailPopover(restoreFocus = true): void {
  document.getElementById(DETAIL_ID)?.remove();
  if (activeDetailButton) {
    activeDetailButton.setAttribute("aria-expanded", "false");
    if (restoreFocus && activeDetailButton.isConnected) activeDetailButton.focus({ preventScroll: true });
  }
  activeDetailButton = null;
}

function handleViewportChange(): void {
  closeDetailPopover(false);
}

function handleDocumentClick(event: MouseEvent): void {
  const target = event.target instanceof Node ? event.target : null;
  const popover = document.getElementById(DETAIL_ID);
  if (!target || !popover || popover.contains(target) || activeDetailButton?.contains(target)) return;
  closeDetailPopover(false);
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  if (document.getElementById(CHANNEL_BACKDROP_ID)) closeChannelAnalytics();
  else if (document.getElementById(DETAIL_ID)) closeDetailPopover();
}

function showStatus(kind: StatusKind, message: string, hideAfter = 0, retry = false): void {
  if (disposed) return;
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
  let status = document.getElementById(STATUS_ID);
  if (!status) {
    status = document.createElement("div");
    status.id = STATUS_ID;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    document.body.appendChild(status);
  }
  status.dataset.kind = kind;
  status.innerHTML = `<span class="stanley-status-icon" aria-hidden="true"></span><span>${escapeHtml(message)}</span>${retry ? '<button type="button">Retry</button>' : ""}`;
  status.querySelector<HTMLButtonElement>("button")?.addEventListener("click", () => {
    lastScannedChannelKey = "";
    status?.remove();
    refreshUi();
  });
  if (hideAfter > 0) statusTimer = setTimeout(() => status?.remove(), hideAfter);
}

function clearChannelUi(): void {
  scanToken += 1;
  analysis = null;
  channelPulse = null;
  lastScannedChannelKey = "";
  openAnalyticsAfterScan = false;
  activeScans.clear();
  removeInjectedUi();
}

function removeInjectedUi(): void {
  closeDetailPopover(false);
  closeChannelAnalytics(false);
  activeAnalyticsTrigger = null;
  document.querySelectorAll<HTMLElement>(OVERLAY_SELECTOR).forEach((element) => element.remove());
  document.querySelectorAll<HTMLElement>(".stanley-title-heading").forEach((element) => element.classList.remove("stanley-title-heading"));
  document.querySelectorAll<HTMLElement>(".stanley-title-metric-host").forEach((element) => element.classList.remove("stanley-title-metric-host"));
  document.querySelectorAll<HTMLElement>(".stanley-overlay-host").forEach((element) => element.classList.remove("stanley-overlay-host"));
  document.querySelectorAll<HTMLElement>(".stanley-channel-launcher-host").forEach((element) => element.classList.remove("stanley-channel-launcher-host"));
  document.getElementById(CHANNEL_LAUNCHER_ID)?.remove();
  document.getElementById(STATUS_ID)?.remove();
  removeLegacyPanel();
}

function removeLegacyPanel(): void {
  document.getElementById(LEGACY_PANEL_ID)?.remove();
}

function videoIdFromHref(href: string): string | null {
  try {
    return new URL(href, location.origin).searchParams.get("v");
  } catch {
    return null;
  }
}

function isChannelPulseData(value: unknown): value is ChannelPulseData {
  if (!isRecord(value) || !isRecord(value.summary) || !Array.isArray(value.videos)) return false;
  const summary = value.summary;
  return typeof summary.recordedScans === "number"
    && typeof summary.totalViewGain === "number"
    && isNullableFiniteNumber(summary.medianViewsPerHour)
    && (summary.fastestGrowingVideo === null || isPulseLeader(summary.fastestGrowingVideo))
    && (summary.largestAbsoluteGain === null || isPulseLeader(summary.largestAbsoluteGain))
    && typeof summary.videosWithComparisons === "number"
    && value.videos.every(isPulseVideo);
}

function isPulseLeader(value: unknown): value is PulseLeader {
  return isRecord(value)
    && typeof value.videoId === "string"
    && typeof value.title === "string"
    && (value.thumbnailUrl === null || typeof value.thumbnailUrl === "string")
    && isNullableFiniteNumber(value.viewGain)
    && isNullableFiniteNumber(value.viewsPerHour)
    && typeof value.elapsedHours === "number";
}

function isPulseVideo(value: unknown): value is PulseVideo {
  if (!isRecord(value)
    || typeof value.videoId !== "string"
    || typeof value.title !== "string"
    || !(value.thumbnailUrl === null || typeof value.thumbnailUrl === "string")) return false;
  if (value.acceleration === null) return true;
  if (!isRecord(value.acceleration)) return false;
  return typeof value.acceleration.change === "number"
    && typeof value.acceleration.velocity1 === "number"
    && typeof value.acceleration.velocity2 === "number"
    && ["Accelerating", "Decelerating", "Stable"].includes(String(value.acceleration.classification));
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function outlierTier(value: number | null): OutlierTier {
  if (!Number.isFinite(value)) return "unrated";
  if ((value ?? 0) >= 2) return "breakout";
  if ((value ?? 0) >= 1) return "above";
  return "below";
}

function formatOutlier(value: number | null): string {
  if (!Number.isFinite(value)) return "—";
  const numeric = value ?? 0;
  return `${numeric >= 10 ? numeric.toFixed(0) : numeric.toFixed(1)}×`;
}

function compactNumber(value: number): string {
  return stats.compactNumber(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "Unknown";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}
