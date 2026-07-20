import type { ApiVideo, ChannelAnalysisResponse, ChannelSummary } from "../shared/types";
import { stats as S, type BucketDefinition } from "./statistics";
import { config as C } from "./config";

export interface TitleMetadata {
  characterCount: number; wordCount: number; containsNumber: boolean; containsQuestionMark: boolean;
  containsAllCapsWord: boolean; containsBrackets: boolean; containsParentheses: boolean;
  containsYear: boolean; beginsWithI: boolean; beginsWithHow: boolean; beginsWithWhy: boolean;
}
export interface AnalyzedVideo extends ApiVideo {
  isLikelyShort: boolean; ageHours: number; ageDays: number; viewsPerDay: number;
  baselineViews: number | null; outlierMultiple: number | null; likeRate: number | null;
  commentRate: number | null; titleMetadata: TitleMetadata; viewRank: number | null; outlierRank: number | null;
}
interface GroupSummary { key: string; label: string; count: number; limitedSample: boolean; medianViews: number | null; medianViewsPerDay: number | null; medianOutlier: number | null }
interface Metrics { medianViews: number | null; meanViews: number | null; highestViewed: AnalyzedVideo | null; highestOutlier: AnalyzedVideo | null; medianViewsPerDay: number | null; uploadsPerMonth: number | null; above2: number; above5: number; consistency: number | null; dateStart: string | null; dateEnd: string | null }
interface FrequencyGap { uploadNumber: number; publishedAt: string; days: number; previousVideo: AnalyzedVideo; video: AnalyzedVideo }
interface Frequency { uploadCount: number; validUploads: AnalyzedVideo[]; gaps: FrequencyGap[]; medianDays: number | null; meanDays: number | null; longestDays: number | null; shortestDays: number | null; uploadsPer30Days: number | null }
interface TitlePattern { key: keyof TitleMetadata; label: string; matchingCount: number; nonMatchingCount: number; matchingMedianOutlier: number | null; nonMatchingMedianOutlier: number | null; matchingMedianViewsPerDay: number | null; limitedSample: boolean }
interface TitleAnalysis { scatter: Array<{ x: number; y: number; video: AnalyzedVideo }>; buckets: GroupSummary[]; patterns: TitlePattern[] }
interface Engagement { likeScatter: Array<{ x: number; y: number; video: AnalyzedVideo }>; commentScatter: Array<{ x: number; y: number; video: AnalyzedVideo }>; medianLikeRate: number | null; medianCommentRate: number | null; highestLikeRateVideo: AnalyzedVideo | null; highestCommentRateVideo: AnalyzedVideo | null; validLikeCount: number; validCommentCount: number }
export interface ContentFormat { key: string; label: string; count: number; share: number; medianOutlier: number | null; medianViewsPerDay: number | null; sampleVideo: AnalyzedVideo | null }
export interface AnalysisResult { channel: ChannelSummary; scannedAt: string; videos: AnalyzedVideo[]; eligible: AnalyzedVideo[]; metrics: Metrics; uploadPatterns: { duration: GroupSummary[]; weekday: GroupSummary[]; frequency: Frequency; title: TitleAnalysis; engagement: Engagement; formats: ContentFormat[]; observedPatterns: string[] } }

  function buildAnalysis(payload: ChannelAnalysisResponse): AnalysisResult {
    const scannedAt = new Date(payload.scannedAt || Date.now());
    const raw = Array.isArray(payload.videos) ? payload.videos : [];
    const videos = raw.map((video) => normalizeVideo(video, scannedAt));
    const eligible = videos.filter((video) => !video.isLikelyShort).sort(byPublishedAsc);
    const priorViews = [];
    for (const video of eligible) {
      video.baselineViews = S.median(priorViews);
      video.outlierMultiple = S.safeDivide(video.viewCount, video.baselineViews);
      priorViews.push(video.viewCount);
    }

    rank(videos, "viewRank", (video) => video.viewCount);
    rank(videos, "outlierRank", (video) => video.outlierMultiple);
    const newest = [...videos].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    const eligibleNewest = newest.filter((video) => !video.isLikelyShort);
    const metrics = buildMetrics(videos, eligibleNewest);
    const uploadPatterns = buildUploadPatterns(newest, eligibleNewest, metrics, scannedAt);
    return { channel: payload.channel || {}, scannedAt: scannedAt.toISOString(), videos: newest, eligible: eligibleNewest, metrics, uploadPatterns };
  }

  function normalizeVideo(video: ApiVideo, scannedAt: Date): AnalyzedVideo {
    const published = new Date(video.publishedAt);
    const ageHours = Math.max(0, (scannedAt.getTime() - published.getTime()) / 3600000);
    const viewCount = numberOrZero(video.viewCount);
    return {
      id: String(video.id || ""), title: String(video.title || "Untitled video"),
      thumbnailUrl: video.thumbnailUrl || null, publishedAt: published.toISOString(),
      durationSeconds: numberOrZero(video.durationSeconds), viewCount,
      likeCount: optionalNumber(video.likeCount), commentCount: optionalNumber(video.commentCount),
      isLikelyShort: numberOrZero(video.durationSeconds) < C.longFormMinimumSeconds,
      ageHours, ageDays: ageHours / 24, viewsPerDay: S.safeDivide(viewCount, Math.max(ageHours / 24, 1 / 24)) || 0,
      baselineViews: null, outlierMultiple: null,
      youtubeUrl: video.youtubeUrl || `https://www.youtube.com/watch?v=${encodeURIComponent(video.id || "")}`,
      likeRate: S.safeDivide(optionalNumber(video.likeCount), viewCount),
      commentRate: S.safeDivide(optionalNumber(video.commentCount), viewCount),
      titleMetadata: analyzeTitle(String(video.title || "Untitled video")),
      viewRank: null, outlierRank: null
    };
  }

  function buildUploadPatterns(videos: AnalyzedVideo[], eligible: AnalyzedVideo[], metrics: Metrics, scannedAt: Date) {
    const duration = groupByBuckets(eligible, C.durationBuckets, (video) => video.durationSeconds);
    const weekday = C.weekdays.map((label, index) => summarizeGroup(label.toLowerCase(), label,
      eligible.filter((video) => utcWeekdayIndex(video.publishedAt) === index)));
    const frequency = buildFrequency(videos, scannedAt);
    const title = buildTitleAnalysis(eligible);
    const engagement = buildEngagement(eligible);
    const formats = buildContentFormats(eligible);
    const observedPatterns = buildInsights({ videos, eligible, metrics, duration, weekday, frequency, title });
    return { duration, weekday, frequency, title, engagement, formats, observedPatterns };
  }

  function buildContentFormats(eligible: AnalyzedVideo[]): ContentFormat[] {
    const definitions: Array<{ key: string; label: string; matches: (title: string) => boolean }> = [
      { key: "challenge", label: "Challenges", matches: (title) => /\b(?:challenge|challenged|trying|tried|attempt|attempted|survive|survived|for \d+ days?)\b/i.test(title) },
      { key: "how-to", label: "How-to guides", matches: (title) => /\b(?:how to|guide|tutorial|beginner|tips?|explained|learn)\b/i.test(title) },
      { key: "comparison", label: "Reviews & comparisons", matches: (title) => /\b(?:vs\.?|versus|review|reviewed|best|worst|rated|ranking|ranked|compare|compared|comparison)\b/i.test(title) },
      { key: "experiment", label: "Experiments", matches: (title) => /\b(?:experiment|testing|tested|test|what happens|i spent|i used)\b/i.test(title) },
      { key: "list", label: "Lists & rankings", matches: (title) => /^(?:the )?\d+\b|\b(?:top \d+|\d+ (?:ways|things|tips|mistakes|reasons|lessons))\b/i.test(title) },
      { key: "story", label: "Personal stories", matches: (title) => /^(?:i|my|we)\b|\b(?:journey|story|day \d+|the truth|what happened)\b/i.test(title) },
      { key: "reaction", label: "Reactions", matches: (title) => /\b(?:react|reacting|reaction|responding|thoughts on|commentary)\b/i.test(title) },
      { key: "interview", label: "Interviews", matches: (title) => /\b(?:interview|podcast|conversation|talking with|ft\.|featuring)\b/i.test(title) },
      { key: "update", label: "News & updates", matches: (title) => /\b(?:update|news|announcement|announcing|new release|breaking)\b/i.test(title) },
    ];
    const groups = new Map<string, AnalyzedVideo[]>();
    for (const video of eligible) {
      const format = definitions.find((definition) => definition.matches(video.title)) || { key: "topic", label: "Topic-led videos" };
      groups.set(format.key, [...(groups.get(format.key) || []), video]);
    }
    return [...groups.entries()].map(([key, videos]) => {
      const definition = definitions.find((item) => item.key === key);
      const ranked = [...videos].sort((a, b) => (b.outlierMultiple ?? -1) - (a.outlierMultiple ?? -1));
      return {
        key,
        label: definition?.label || "Topic-led videos",
        count: videos.length,
        share: eligible.length ? videos.length / eligible.length : 0,
        medianOutlier: S.median(videos.map((video) => video.outlierMultiple)),
        medianViewsPerDay: S.median(videos.map((video) => video.viewsPerDay)),
        sampleVideo: ranked[0] || null,
      };
    }).sort((a, b) => b.count - a.count || (b.medianOutlier ?? -1) - (a.medianOutlier ?? -1));
  }

  function groupByBuckets(videos: AnalyzedVideo[], definitions: readonly (BucketDefinition & { label: string })[], getter: (video: AnalyzedVideo) => number): GroupSummary[] {
    return definitions.map((definition) => summarizeGroup(definition.key, definition.label,
      videos.filter((video) => S.bucket(getter(video), definitions) === definition.key)));
  }

  function summarizeGroup(key: string, label: string, videos: AnalyzedVideo[]): GroupSummary {
    return {
      key, label, count: videos.length, limitedSample: videos.length < C.insightThresholds.limitedGroup,
      medianViews: S.median(videos.map((video) => video.viewCount)),
      medianViewsPerDay: S.median(videos.map((video) => video.viewsPerDay)),
      medianOutlier: S.median(videos.map((video) => video.outlierMultiple))
    };
  }

  function buildFrequency(videos: AnalyzedVideo[], scannedAt: Date): Frequency {
    const validUploads = videos.filter((video) => video.id && validDateAtOrBefore(video.publishedAt, scannedAt))
      .sort(byPublishedAsc);
    const gaps = validUploads.slice(1).map((video, index) => ({
      uploadNumber: index + 2, publishedAt: video.publishedAt, days: (new Date(video.publishedAt).getTime() - new Date(validUploads[index]?.publishedAt || video.publishedAt).getTime()) / 86400000,
      previousVideo: validUploads[index] || video, video
    })).filter((gap) => Number.isFinite(gap.days) && gap.days >= 0);
    const spanDays = validUploads.length > 1 ? (new Date(validUploads.at(-1)?.publishedAt || 0).getTime() - new Date(validUploads[0]?.publishedAt || 0).getTime()) / 86400000 : null;
    return {
      uploadCount: validUploads.length, validUploads, gaps,
      medianDays: S.median(gaps.map((gap) => gap.days)), meanDays: S.mean(gaps.map((gap) => gap.days)),
      longestDays: gaps.length ? Math.max(...gaps.map((gap) => gap.days)) : null,
      shortestDays: gaps.length ? Math.min(...gaps.map((gap) => gap.days)) : null,
      uploadsPer30Days: validUploads.length > 1 && spanDays !== null && spanDays > 0 ? validUploads.length / spanDays * 30 : null
    };
  }

  function buildTitleAnalysis(eligible: AnalyzedVideo[]): TitleAnalysis {
    const scatter = eligible.filter((video): video is AnalyzedVideo & { outlierMultiple: number } => Number.isFinite(video.outlierMultiple)).map((video) => ({ x: video.titleMetadata.characterCount, y: video.outlierMultiple, video }));
    const buckets = groupByBuckets(eligible, C.titleLengthBuckets, (video) => video.titleMetadata.characterCount);
    const definitions: Array<[keyof TitleMetadata, string]> = [
      ["containsNumber", "Contains a number"], ["containsQuestionMark", "Contains a question mark"],
      ["containsAllCapsWord", "Contains an all-caps word"], ["containsBrackets", "Contains brackets"],
      ["containsParentheses", "Contains parentheses"], ["containsYear", "Contains a year"],
      ["beginsWithI", "Begins with “I”"], ["beginsWithHow", "Begins with “How”"], ["beginsWithWhy", "Begins with “Why”"]
    ];
    const patterns = definitions.map(([key, label]) => {
      const matching = eligible.filter((video) => video.titleMetadata[key]);
      const nonMatching = eligible.filter((video) => !video.titleMetadata[key]);
      return { key, label, matchingCount: matching.length, nonMatchingCount: nonMatching.length,
        matchingMedianOutlier: S.median(matching.map((video) => video.outlierMultiple)),
        nonMatchingMedianOutlier: S.median(nonMatching.map((video) => video.outlierMultiple)),
        matchingMedianViewsPerDay: S.median(matching.map((video) => video.viewsPerDay)),
        limitedSample: matching.length < C.insightThresholds.limitedPattern };
    });
    return { scatter, buckets, patterns };
  }

  function buildEngagement(eligible: AnalyzedVideo[]): Engagement {
    const likeVideos = eligible.filter((video): video is AnalyzedVideo & { likeRate: number } => video.viewCount > 0 && Number.isFinite(video.likeRate));
    const commentVideos = eligible.filter((video): video is AnalyzedVideo & { commentRate: number } => video.viewCount > 0 && Number.isFinite(video.commentRate));
    const highestLikeRateVideo = [...likeVideos].sort((a, b) => b.likeRate - a.likeRate)[0] || null;
    const highestCommentRateVideo = [...commentVideos].sort((a, b) => b.commentRate - a.commentRate)[0] || null;
    return {
      likeScatter: likeVideos.filter((video): video is typeof video & { outlierMultiple: number } => Number.isFinite(video.outlierMultiple)).map((video) => ({ x: video.likeRate, y: video.outlierMultiple, video })),
      commentScatter: commentVideos.filter((video): video is typeof video & { outlierMultiple: number } => Number.isFinite(video.outlierMultiple)).map((video) => ({ x: video.commentRate, y: video.outlierMultiple, video })),
      medianLikeRate: S.median(likeVideos.map((video) => video.likeRate)), medianCommentRate: S.median(commentVideos.map((video) => video.commentRate)),
      highestLikeRateVideo, highestCommentRateVideo, validLikeCount: likeVideos.length, validCommentCount: commentVideos.length
    };
  }

  function buildInsights({ videos, eligible, metrics, duration, weekday, frequency, title }: { videos: AnalyzedVideo[]; eligible: AnalyzedVideo[]; metrics: Metrics; duration: GroupSummary[]; weekday: GroupSummary[]; frequency: Frequency; title: TitleAnalysis }): string[] {
    if (!eligible.length) return [];
    const insights = [];
    const totalViews = videos.reduce((sum, video) => sum + video.viewCount, 0);
    const top3Views = [...videos].sort((a, b) => b.viewCount - a.viewCount).slice(0, 3).reduce((sum, video) => sum + video.viewCount, 0);
    const share = S.safeDivide(top3Views, totalViews);
    if (share !== null) {
      const wording = share > C.insightThresholds.highConcentration ? "Performance is highly concentrated in a small number of breakout uploads."
        : share >= C.insightThresholds.moderateConcentration ? "Performance is moderately concentrated in the channel’s top uploads." : "Views are relatively distributed across the analyzed uploads.";
      insights.push(`The top 3 videos account for ${(share * 100).toFixed(0)}% of views across ${videos.length} analyzed uploads. ${wording}`);
    }
    if (metrics.consistency !== null) {
      const label = metrics.consistency >= 75 ? "highly consistent" : metrics.consistency >= 50 ? "moderately consistent" : "volatile";
      insights.push(`The channel’s consistency score is ${Math.round(metrics.consistency)}/100, categorized as ${label}.`);
    }
    const recent = eligible.slice(0, 20).filter((video): video is AnalyzedVideo & { outlierMultiple: number } => Number.isFinite(video.outlierMultiple));
    if (recent.length >= 2) insights.push(`${recent.filter((video) => video.outlierMultiple >= 2).length} of the last ${recent.length} long-form uploads exceeded 2× baseline.`);
    const chronologicalBaselines = [...eligible].reverse().map((video) => video.baselineViews).filter(Number.isFinite);
    const normalizedSlope = S.safeDivide(S.linearRegressionSlope(chronologicalBaselines), S.mean(chronologicalBaselines));
    if (chronologicalBaselines.length >= 2 && normalizedSlope !== null) {
      const direction = normalizedSlope > C.baselineDirection.rising ? "rising" : normalizedSlope < C.baselineDirection.declining ? "declining" : "stable";
      insights.push(`The recent rolling baseline is ${direction}, based on ${chronologicalBaselines.length} eligible uploads.`);
    }
    if (frequency.medianDays !== null && frequency.gaps.length >= 2) insights.push(`The channel uploads approximately once every ${formatInsightNumber(frequency.medianDays)} days, based on ${frequency.gaps.length} upload intervals.`);
    insights.push(groupWinnerInsight(duration, "duration", "medianOutlier", "median outlier score"));
    insights.push(groupWinnerInsight(weekday, "weekday", "medianViewsPerDay", "median views per day"));
    const shortTitles = eligible.filter((video) => video.titleMetadata.characterCount < 50);
    const longTitles = eligible.filter((video) => video.titleMetadata.characterCount >= 50);
    const shortMedian = S.median(shortTitles.map((video) => video.outlierMultiple));
    const longMedian = S.median(longTitles.map((video) => video.outlierMultiple));
    if (shortTitles.length >= 2 && longTitles.length >= 2 && materiallyLeads(shortMedian, longMedian)) insights.push(`Titles under 50 characters had a higher median outlier score, based on ${shortTitles.length} uploads.`);
    const numberPattern = title.patterns.find((pattern) => pattern.key === "containsNumber");
    if (numberPattern && numberPattern.matchingCount >= 2 && materiallyLeads(numberPattern.matchingMedianOutlier, numberPattern.nonMatchingMedianOutlier)) insights.push(`Videos containing numbers had a higher median outlier score, based on ${numberPattern.matchingCount} matching uploads.${numberPattern.limitedSample ? " Limited sample." : ""}`);
    return insights.filter(Boolean);
  }

  function groupWinnerInsight(groups: GroupSummary[], kind: string, metric: "medianOutlier" | "medianViewsPerDay", metricLabel: string): string {
    const candidates = groups.filter((group): group is GroupSummary & Record<typeof metric, number> => Number.isFinite(group[metric]) && group.count >= C.insightThresholds.limitedGroup).sort((a, b) => b[metric] - a[metric]);
    const winner = candidates[0];
    const runnerUp = candidates[1];
    if (!winner || (runnerUp && !materiallyLeads(winner[metric], runnerUp[metric]))) return `No clear ${kind} pattern is visible in the analyzed sample.`;
    return `${winner.label} had the highest ${metricLabel}, based on ${winner.count} uploads.`;
  }

  function materiallyLeads(value: number | null, runnerUp: number | null) { return value !== null && runnerUp !== null && value > runnerUp && (runnerUp === 0 || (S.safeDivide(value - runnerUp, Math.abs(runnerUp)) ?? 0) >= C.insightThresholds.materialLead); }
  function analyzeTitle(title: string): TitleMetadata { const trimmed = title.trim(); return { characterCount: title.length, wordCount: trimmed ? trimmed.split(/\s+/).length : 0, containsNumber: /\d/.test(title), containsQuestionMark: /\?/.test(title), containsAllCapsWord: /\b[A-Z]{2,}\b/.test(title), containsBrackets: /\[[^\]]*\]/.test(title), containsParentheses: /\([^)]*\)/.test(title), containsYear: /\b(?:19|20)\d{2}\b/.test(title), beginsWithI: /^I\b/i.test(trimmed), beginsWithHow: /^How\b/i.test(trimmed), beginsWithWhy: /^Why\b/i.test(trimmed) }; }
  function utcWeekdayIndex(value: string) { const day = new Date(value).getUTCDay(); return Number.isFinite(day) ? (day + 6) % 7 : null; }
  function validDateAtOrBefore(value: string, scannedAt: Date) { const date = new Date(value); return Number.isFinite(date.getTime()) && date <= scannedAt; }
  function formatInsightNumber(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(1); }

  function buildMetrics(videos: AnalyzedVideo[], eligible: AnalyzedVideo[]): Metrics {
    const views = eligible.map((video) => video.viewCount);
    const validOutliers = eligible.filter((video): video is AnalyzedVideo & { outlierMultiple: number } => Number.isFinite(video.outlierMultiple));
    const logViews = views.map((value) => Math.log1p(value));
    const logMean = S.mean(logViews);
    const coefficient = S.safeDivide(S.standardDeviation(logViews), logMean);
    const dates = videos.map((video) => new Date(video.publishedAt).getTime()).filter(Number.isFinite);
    const spanDays = dates.length > 1 ? (Math.max(...dates) - Math.min(...dates)) / 86400000 : 0;
    return {
      medianViews: S.median(views), meanViews: S.mean(views),
      highestViewed: [...eligible].sort((a, b) => b.viewCount - a.viewCount)[0] || null,
      highestOutlier: [...validOutliers].sort((a, b) => b.outlierMultiple - a.outlierMultiple)[0] || null,
      medianViewsPerDay: S.median(eligible.map((video) => video.viewsPerDay)),
      uploadsPerMonth: spanDays > 0 ? videos.length / spanDays * 30.4375 : null,
      above2: validOutliers.filter((video) => video.outlierMultiple >= 2).length,
      above5: validOutliers.filter((video) => video.outlierMultiple >= 5).length,
      consistency: coefficient === null ? null : S.clamp(100 - coefficient * 100, 0, 100),
      dateStart: dates.length ? new Date(Math.min(...dates)).toISOString() : null,
      dateEnd: dates.length ? new Date(Math.max(...dates)).toISOString() : null
    };
  }

  function rank(videos: AnalyzedVideo[], property: "viewRank" | "outlierRank", getter: (video: AnalyzedVideo) => number | null) {
    [...videos].filter((video): video is AnalyzedVideo => Number.isFinite(getter(video)))
      .sort((a, b) => (getter(b) ?? 0) - (getter(a) ?? 0) || b.publishedAt.localeCompare(a.publishedAt))
      .forEach((video, index) => { video[property] = index + 1; });
  }

  function byPublishedAsc(a: AnalyzedVideo, b: AnalyzedVideo) { return a.publishedAt.localeCompare(b.publishedAt); }
  function optionalNumber(value: unknown) { return value === null || value === undefined || value === "" ? null : (Number.isFinite(Number(value)) ? Number(value) : null); }
  function numberOrZero(value: unknown) { return Number.isFinite(Number(value)) ? Number(value) : 0; }

export { buildAnalysis };
