"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Check, ChevronDown, ChevronRight, Clock3, Copy as CopyIcon, Download, ExternalLink, Eye, Facebook, FileText, Globe2, Image as ImageIcon, Instagram, LayoutDashboard, MessageCircle, Minus, PanelLeftClose, PanelLeftOpen, Puzzle, RefreshCw, Search, Sparkles, SquarePen, ThumbsDown, ThumbsUp, Users, Video, WandSparkles, X } from "lucide-react";
import { InputText } from "primereact/inputtext";
import { Paginator } from "primereact/paginator";
import dashboardStyles from "./dashboard.module.css";
import { findDiscoveryGrowth } from "./dashboard-signals.mjs";
import { type CreatorProfileId, WILL_TENNYSON_DEMO, isCreatorProfileId } from "./creator-profiles";
import { PerformanceTimelinePanel } from "./PerformanceTimelinePanel";

type CreationMode = "auto" | "idea" | "title" | "thumbnail";
type WorkspaceView = "dashboard" | "creatorTwin" | "create";

type StanleyAppProps = {
  initialView?: WorkspaceView;
};

type GeneratedTitle = {
  id: string;
  title: string;
  angle: string;
  whyItWorks: string;
  characterCount: number;
};

type GeneratedIdea = {
  id: string;
  idea: string;
  suggestedTitle?: string;
  format?: string;
  difficulty?: "Easy" | "Moderate" | "Ambitious";
  recommended?: boolean;
  hook: string;
  whyItCouldWork: string;
  channelFit?: string;
  researchBasis?: string;
  sourceNumbers?: number[];
  scriptOutline?: {
    opening: string;
    beats: string[];
    payoff: string;
  };
};

type GeneratedScript = {
  title: string;
  targetLength: string;
  viewerPromise?: string;
  voiceDirection?: string;
  coldOpen: string;
  sections: Array<{ heading: string; narration: string; visualDirection?: string }>;
  ending: string;
};

type GeneratedFilmingPlan = {
  format: string;
  setup: string;
  shotList: string[];
  editNotes: string;
};

type ThumbnailConcept = {
  id: string;
  concept: string;
  visual: string;
  textOverlay: string;
  whyItWorks: string;
};

type GeneratedThumbnailImage = {
  id: string;
  mimeType: string;
  data?: string;
  aspectRatio: "16:9";
  width: number;
  height: number;
  sourceUsed: boolean;
  model: string;
  alt: string;
};

type ResearchVideo = {
  id: string;
  title: string;
  channel: string;
  views: number;
  viewsPerDay: number;
  publishedAt: string;
  url: string;
};

type Research = {
  query: string;
  analyzed: number;
  examples: ResearchVideo[];
  coverage?: "strong" | "limited" | "none";
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: Exclude<CreationMode, "auto">;
  titles?: GeneratedTitle[];
  ideas?: GeneratedIdea[];
  script?: GeneratedScript;
  filmingPlan?: GeneratedFilmingPlan;
  thumbnails?: ThumbnailConcept[];
  thumbnailImage?: GeneratedThumbnailImage;
  research?: Research;
  agent?: AgentRun;
  activity?: AgentActivity[];
  blocked?: boolean;
  streaming?: boolean;
  attachments?: MessageAttachment[];
};

type AgentActivity = {
  id: string;
  label: string;
  detail?: string;
  status: "active" | "complete" | "limited";
  kind: "thinking" | "context" | "tool" | "answer";
};

type AgentRun = {
  runId: string;
  modelRounds: number;
  durationMs: number;
  toolCalls: Array<{
    name: string;
    status: "complete" | "partial" | "empty" | "error";
    memoHit: boolean;
    errorCode?: string;
  }>;
};

type Draft = {
  id: string;
  createdAt: string;
  topic: string;
  messages?: ChatMessage[];
  titles?: GeneratedTitle[];
  research?: Research;
  creatorProfile?: CreatorProfileId;
};

type ApiPayload = {
  reply?: string;
  mode?: unknown;
  titles?: GeneratedTitle[];
  ideas?: GeneratedIdea[];
  script?: GeneratedScript;
  filmingPlan?: GeneratedFilmingPlan;
  thumbnails?: ThumbnailConcept[];
  thumbnailImage?: GeneratedThumbnailImage;
  research?: Research;
  agent?: AgentRun;
  conversationTopic?: string;
  blocked?: boolean;
  error?: string;
};

type StreamEvent =
  | { type: "activity"; activity: AgentActivity }
  | { type: "result"; status: number; payload: ApiPayload };

type OnboardingStep = "loading" | "welcome" | "features" | "connect" | "analyzing" | "done";
type OnboardingDirection = "forward" | "back";

type YouTubeProfile = {
  id: string;
  title: string;
  thumbnailUrl: string;
  subscriberCount: number;
  videoCount: number;
  totalViews: number;
  strongestVideo?: { id: string; title: string; views: number; viewsPerDay: number };
  analyzedAt: string;
};

type YouTubeStatus = {
  configured: boolean;
  connected: boolean;
  captionAccess?: boolean;
  profile: YouTubeProfile | null;
};

function cleanYouTubeDisplayName(value: string) {
  return value
    .replace(/\s*\(\s*api\s+preview\s*\)\s*$/i, "")
    .replace(/\s*(?:[-–—·|]\s*)?api\s+preview\s*$/i, "")
    .trim();
}

function normalizeYouTubeStatus(status: YouTubeStatus): YouTubeStatus {
  if (!status.profile) return status;
  const title = cleanYouTubeDisplayName(status.profile.title) || status.profile.title;
  return title === status.profile.title ? status : { ...status, profile: { ...status.profile, title } };
}

type YouTubeVideoOption = {
  id: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  views: number;
  duration: string;
  privacyStatus: string;
  url: string;
};

type DashboardChartMetric = "views" | "watchMinutes" | "netSubscribers";
type DashboardRange = 7 | 30 | 90 | 180 | 365;

type DashboardPeriodMetrics = {
  views: number | null;
  watchMinutes: number | null;
  subscribersGained: number | null;
  subscribersLost: number | null;
  averageViewDuration: number | null;
  averageViewPercentage: number | null;
};

type DashboardAnalytics = {
  channel: { handle: string | null };
  period: { startDate: string; endDate: string; days: number };
  comparisonPeriod: { startDate: string; endDate: string; days: number } | null;
  current: DashboardPeriodMetrics;
  comparison: DashboardPeriodMetrics | null;
  timeline: Array<{ date: string; views: number; watchMinutes: number; netSubscribers: number }>;
  comparisonTimeline: Array<{ date: string; views: number; watchMinutes: number; netSubscribers: number }>;
  videos: Array<{
    id: string;
    views: number | null;
    watchMinutes: number | null;
    averageViewDuration: number | null;
    averageViewPercentage: number | null;
    netSubscribers: number;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    commentRate: number | null;
    interactionRate: number | null;
  }>;
  traffic: Array<{ source: string; views: number; watchMinutes: number }>;
  comparisonTraffic?: Array<{ source: string; views: number; watchMinutes: number }>;
  updatedAt: string;
};

type CreatorTwinResult = {
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

function selectableYouTubeVideos(videos: YouTubeVideoOption[]) {
  return videos.filter((video) => ["public", "private", "unlisted"].includes(video.privacyStatus));
}

type ComposerAttachment = {
  id: string;
  kind: "image" | "video" | "youtube";
  name: string;
  mimeType?: string;
  size?: number;
  data?: string;
  previewUrl?: string;
  videoId?: string;
  thumbnailUrl?: string;
  url?: string;
  title?: string;
  views?: number;
  publishedAt?: string;
  privacyStatus?: string;
};

type MessageAttachment = Pick<ComposerAttachment, "id" | "kind" | "name" | "previewUrl" | "thumbnailUrl" | "videoId" | "url" | "title" | "views" | "publishedAt" | "privacyStatus">;

const DRAFTS_KEY = "stanley-title-drafts";
const ONBOARDING_KEY = "stanley-onboarding-v1";
const SIDEBAR_KEY = "stanley-sidebar-collapsed";
const CREATOR_PROFILE_KEY = "stanley-creator-profile";
const TOP_VIDEOS_PAGE_SIZE = 6;

const NAV_ITEMS: Array<{ icon: string; label: string; view?: WorkspaceView }> = [
  { icon: "dashboard", label: "Dashboard", view: "dashboard" },
  { icon: "creatorTwin", label: "Creator Twin", view: "creatorTwin" },
  { icon: "extension", label: "Chrome extension" },
];

const MODE_PLACEHOLDERS: Record<CreationMode, string[]> = {
  auto: [
    "Help me get more views on my next video",
    "Analyze my channel and tell me what to make next",
    "Find a video idea that fits my channel",
    "Improve the title and thumbnail for my next upload",
  ],
  idea: [
    "Give me three video ideas based on my channel",
    "Find a follow-up idea to my best-performing video",
    "Research my niche and find an idea worth filming",
    "What topic should I cover next to reach more viewers?",
  ],
  title: [
    "Give me better titles for my most recent upload",
    "Rewrite this title with a clearer reason to click",
    "Make this title more clickable without using clickbait",
    "Give me five title options based on what works in my niche",
  ],
  thumbnail: [
    "Generate a thumbnail for my next video",
    "Turn this photo into a YouTube thumbnail",
    "Make this thumbnail clearer at phone size",
    "Create a thumbnail that complements this title",
  ],
};

const PLACEHOLDER_TYPE_DELAY = 38;
const PLACEHOLDER_HOLD_DELAY = 4400;
const PLACEHOLDER_ERASE_DELAY = 20;
const PLACEHOLDER_BETWEEN_DELAY = 420;

function isCreationMode(value: unknown): value is CreationMode {
  return value === "auto" || value === "idea" || value === "title" || value === "thumbnail";
}

function getModePlaceholders(value: unknown) {
  return MODE_PLACEHOLDERS[isCreationMode(value) ? value : "auto"];
}

const QUICK_STARTS: Array<{ label: string; prompt: string; mode: CreationMode; icon: string }> = [
  { label: "Video ideas", prompt: "Help me find a data-backed idea for my next YouTube video about ", mode: "idea", icon: "✦" },
  { label: "Better titles", prompt: "Research comparable videos and improve this YouTube title: ", mode: "title", icon: "T" },
  { label: "New thumbnail", prompt: "Generate a finished YouTube thumbnail for this video: ", mode: "thumbnail", icon: "▣" },
  { label: "Write a script", prompt: "Help me write a complete YouTube script about ", mode: "idea", icon: "✎" },
  { label: "Use my channel", prompt: "Based on my connected channel, find a strong direction for my next video about ", mode: "idea", icon: "▶" },
  { label: "Improve my packaging", prompt: "Help me improve the idea, title, and thumbnail direction for ", mode: "auto", icon: "◇" },
];

function readDrafts() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(DRAFTS_KEY) || "[]") as Draft[];
  } catch {
    return [];
  }
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatViews(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function AgentActivityTimeline({ activity, live, durationMs }: { activity: AgentActivity[]; live?: boolean; durationMs?: number }) {
  if (!activity.length) return live ? <div className="assistant-thinking" role="status" aria-label="Stanley is thinking"><span className="thinking-spinner" /></div> : null;

  const rows = <ol>{activity.map((item) => <li key={item.id} className={item.status}>
    <span className="activity-state" aria-hidden="true">{item.status === "complete" ? "✓" : item.status === "limited" ? "!" : ""}</span>
    <div><strong>{item.label}</strong>{item.detail ? <small>{item.detail}</small> : null}</div>
  </li>)}</ol>;

  if (live) return <section className="agent-activity live" role="status" aria-label="Stanley is working">
    <header><span className="thinking-spinner" /><div><strong>Working through it</strong><small>Live steps from this request</small></div></header>
    {rows}
  </section>;

  return <details className="agent-activity complete">
    <summary><span className="activity-summary-icon" aria-hidden="true">✓</span><strong>Worked through {activity.length} {activity.length === 1 ? "step" : "steps"}</strong>{durationMs ? <small>{(durationMs / 1000).toFixed(1)}s</small> : null}<ChevronRight className="activity-chevron" aria-hidden="true" /></summary>
    {rows}
  </details>;
}

function compactSentences(value: string, maxLength = 280) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const excerpt = clean.slice(0, maxLength + 1);
  const sentenceEnd = Math.max(excerpt.lastIndexOf(". "), excerpt.lastIndexOf("! "), excerpt.lastIndexOf("? "));
  return `${excerpt.slice(0, sentenceEnd > 110 ? sentenceEnd + 1 : maxLength).trim()}…`;
}

function formatAssistantAnswer(payload: ApiPayload) {
  const reply = payload.reply?.trim() || "";
  if (payload.ideas?.length || payload.script || payload.filmingPlan || payload.thumbnailImage) return reply;
  if (payload.titles?.length) return [reply, ...payload.titles.map((item, index) => `${index + 1}. ${item.title}`)].filter(Boolean).join("\n\n");
  if (payload.thumbnails?.length) {
    const concepts = payload.thumbnails.map((item, index) => `${index + 1}. ${item.concept}\n${item.visual}${item.textOverlay && item.textOverlay !== "No text" ? `\nOn-screen text: ${item.textOverlay}` : ""}`);
    return [reply, ...concepts].filter(Boolean).join("\n\n");
  }
  return reply;
}

function ConversationalAnswer({ text, streaming }: { text: string; streaming?: boolean }) {
  // Models are inconsistent about blank lines between numbered items. Normalize
  // every numbered line into its own block so formatting never depends on
  // whether the model used one newline or two.
  const blocks = text
    .replace(/\r\n/g, "\n")
    .replace(/([^\n])\n(?=\d+\.\s)/g, "$1\n\n")
    .split(/\n{2,}/);
  return <div className="assistant-answer">{blocks.map((block, index) => {
    const lines = block.split("\n").filter(Boolean);
    if (!lines.length) return null;
    const numbered = lines[0].match(/^(\d+)\.\s+(.*)$/);
    if (numbered) {
      const labeled = numbered[2].match(/^([^:\n]{2,48}:)\s+(.+)$/);
      return <section className="assistant-option" key={`${index}-${lines[0]}`}>
      <p className="assistant-option-title"><span>{numbered[1]}.</span> {labeled ? <><strong>{labeled[1]}</strong> {labeled[2]}</> : <strong>{numbered[2]}</strong>}</p>
      {lines.slice(1).map((line, lineIndex) => {
        const label = line.match(/^(Why it works|Format|On-screen text):\s*(.*)$/);
        return <p key={`${lineIndex}-${line}`}>{label ? <><b>{label[1]}:</b> {label[2]}</> : line}</p>;
      })}
    </section>;
    }
    const labeled = lines[0].match(/^(Cold open|Ending):\s*(.*)$/);
    return <section className="assistant-paragraph" key={`${index}-${lines[0]}`}>
      {labeled ? <p><b>{labeled[1]}:</b> {labeled[2]}</p> : lines.length > 1 ? <><h2>{lines[0]}</h2>{lines.slice(1).map((line) => <p key={line}>{line}</p>)}</> : <p>{lines[0]}</p>}
    </section>;
  })}{streaming ? <span className="assistant-typing-cursor" aria-hidden="true" /> : null}</div>;
}

function structuredLeadText(message: ChatMessage) {
  if (message.ideas?.length) {
    const ideaListStart = message.content.search(/\n\n1\.\s/);
    return ideaListStart >= 0 ? message.content.slice(0, ideaListStart).trim() : message.content;
  }
  if (message.script) {
    const scriptStart = message.content.indexOf(`\n\n${message.script.title}\n`);
    return scriptStart >= 0 ? message.content.slice(0, scriptStart).trim() : message.content;
  }
  return message.content;
}

function ideaClipboardText(ideas: GeneratedIdea[]) {
  return ideas.map((item, index) => `${index + 1}. ${item.idea}${item.recommended ? " [TOP PICK]" : ""}\nWorking title: ${item.suggestedTitle || "Not set"}\nFormat: ${item.format || "Not set"} · Difficulty: ${item.difficulty || "Not set"}\nHook: ${item.hook}\nWhy it could work: ${item.whyItCouldWork}\nChannel fit: ${item.channelFit || "Based on the supplied brief"}\nComparable signal: ${item.researchBasis || "Broad format guidance"}${item.scriptOutline ? `\n\nSCRIPT BLUEPRINT\nCold open: ${item.scriptOutline.opening}\n${item.scriptOutline.beats.map((beat, beatIndex) => `${beatIndex + 1}. ${beat}`).join("\n")}\nPayoff: ${item.scriptOutline.payoff}` : ""}`).join("\n\n---\n\n");
}

function scriptClipboardText(script: GeneratedScript) {
  return `${script.title} (${script.targetLength})\n\nCOLD OPEN\n${script.coldOpen}\n\n${script.sections.map((section) => `${section.heading.toUpperCase()}\n${section.narration}${section.visualDirection ? `\n\nVisual: ${section.visualDirection}` : ""}`).join("\n\n")}\n\nENDING\n${script.ending}`;
}

function filmingPlanClipboardText(plan: GeneratedFilmingPlan) {
  return `HOW TO FILM\nFormat: ${plan.format}\nSetup: ${plan.setup}\n\nSHOT LIST\n${plan.shotList.map((shot, index) => `${index + 1}. ${shot}`).join("\n")}\n\nEDIT\n${plan.editNotes}`;
}

function assistantClipboardText(message: ChatMessage) {
  if (message.ideas?.length) return ideaClipboardText(message.ideas);
  if (message.script && message.filmingPlan) return `${scriptClipboardText(message.script)}\n\n---\n\n${filmingPlanClipboardText(message.filmingPlan)}`;
  if (message.script) return scriptClipboardText(message.script);
  if (message.filmingPlan) return filmingPlanClipboardText(message.filmingPlan);
  if (message.titles?.length) return message.titles.map((item, index) => `${index + 1}. ${item.title}`).join("\n");
  if (message.thumbnails?.length) return message.thumbnails.map((item, index) => `${index + 1}. ${item.concept}\nVisual: ${item.visual}\nText: ${item.textOverlay}`).join("\n\n");
  return message.content;
}

function assistantCopyLabel(message: ChatMessage) {
  if (message.ideas?.length) return "Copy all ideas and script blueprints";
  if (message.script && message.filmingPlan) return "Copy script and filming plan";
  if (message.script) return "Copy full script";
  if (message.filmingPlan) return "Copy filming plan";
  if (message.titles?.length) return "Copy all titles";
  if (message.thumbnails?.length) return "Copy all thumbnail concepts";
  return "Copy response";
}

function IdeaWorkspace({ ideas }: { ideas: GeneratedIdea[] }) {
  return <section className="idea-workspace" aria-label={`${ideas.length} video ideas`}>
    <div className="idea-results">
      {ideas.map((item, index) => <article className={item.recommended ? "assistant-option idea-result recommended" : "assistant-option idea-result"} key={item.id}>
        <div className="idea-result-body">
          <div className="idea-title-line">
            <h3><span aria-hidden="true">{index + 1}.</span> {item.suggestedTitle || item.idea}</h3>
            {item.recommended ? <span className="top-pick">Top pick</span> : null}
          </div>
          {item.suggestedTitle ? <p className="idea-premise">{item.idea}</p> : null}
          <p className="idea-why"><strong>Why it could work:</strong> {compactSentences(item.whyItCouldWork, 360)}</p>
          {item.format || item.difficulty ? <p className="idea-meta-line">{[item.format, item.difficulty].filter(Boolean).join(" · ")}</p> : null}
        </div>
      </article>)}
    </div>

    <details className="response-details">
      <summary><strong>See the thinking behind these ideas</strong><ChevronDown aria-hidden="true" /></summary>
      <div className="idea-plans">{ideas.map((item, index) => <section key={item.id}>
        <h3>{index + 1}. {item.suggestedTitle || item.idea}</h3>
        <p><strong>Opening hook:</strong> {item.scriptOutline?.opening || item.hook}</p>
        {item.channelFit ? <p><strong>Why it fits:</strong> {item.channelFit}</p> : null}
        {item.researchBasis ? <p><strong>Evidence:</strong> {item.researchBasis}</p> : null}
        {item.scriptOutline ? <div className="story-beats"><strong>Story beats</strong><ol>{item.scriptOutline.beats.map((beat, beatIndex) => <li key={`${item.id}-beat-${beatIndex}`}>{beat}</li>)}</ol></div> : null}
        {item.scriptOutline?.payoff ? <p className="idea-payoff"><strong>Payoff:</strong> {item.scriptOutline.payoff}</p> : null}
      </section>)}</div>
    </details>
  </section>;
}

function ThumbnailWorkspace({ thumbnail, disabled, onEdit }: { thumbnail: GeneratedThumbnailImage; disabled: boolean; onEdit: () => void }) {
  const imageUrl = thumbnail.data ? `data:${thumbnail.mimeType};base64,${thumbnail.data}` : "";
  function downloadThumbnail() {
    if (!imageUrl) return;
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `stanley-youtube-thumbnail.${thumbnail.mimeType.includes("jpeg") ? "jpg" : "png"}`;
    link.click();
  }

  return <section className="thumbnail-workspace" aria-label="Generated YouTube thumbnail">
    {imageUrl ? <figure className="generated-thumbnail">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={thumbnail.alt} />
    </figure> : <div className="thumbnail-unavailable"><ImageIcon aria-hidden="true" /><p><strong>Thumbnail preview expired</strong><span>Generate it again to restore the full-size image.</span></p></div>}
    <div className="thumbnail-toolbar">
      <div><strong>Generated thumbnail</strong><span>{thumbnail.width} x {thumbnail.height} / 16:9 / {thumbnail.sourceUsed ? "Reference image used" : "Created from your brief"}</span></div>
      <div>
        <button type="button" disabled={!imageUrl} onClick={downloadThumbnail}><Download aria-hidden="true" /> Download</button>
        <button className="thumbnail-edit" type="button" disabled={disabled || !imageUrl} onClick={onEdit}><WandSparkles aria-hidden="true" /> Refine in chat</button>
      </div>
    </div>
  </section>;
}

function ScriptWorkspace({ script, workspaceRef }: { script: GeneratedScript; workspaceRef?: React.Ref<HTMLElement> }) {
  return <section ref={workspaceRef} className="script-workspace assistant-answer" aria-label={`Script: ${script.title}`}>
    <header className="artifact-header script-header">
      <div className="artifact-heading">
        <span className="artifact-icon" aria-hidden="true"><FileText /></span>
        <div><h2>{script.title}</h2><p>{script.targetLength} · {script.sections.length + 2} script beats</p></div>
      </div>
    </header>

    <div className="script-flow">
      <section className="script-block script-hook">
        <header><span className="script-block-index">Hook</span><h3>Cold open</h3></header>
        <p>{script.coldOpen}</p>
      </section>
      {script.sections.map((section, index) => <section className="script-block" key={`${section.heading}-${index}`}>
        <header><span className="script-block-index">{String(index + 1).padStart(2, "0")}</span><h3>{section.heading}</h3></header>
        <p>{section.narration}</p>
        {section.visualDirection ? <small className="script-visual"><strong>On screen:</strong> {section.visualDirection}</small> : null}
      </section>)}
      <section className="script-block script-ending">
        <header><span className="script-block-index">End</span><h3>Ending</h3></header>
        <p>{script.ending}</p>
      </section>
    </div>

  </section>;
}

function FilmingPlanWorkspace({ plan }: { plan: GeneratedFilmingPlan }) {
  return <section className="filming-plan-workspace assistant-answer" aria-label="How to film this video">
    <header className="artifact-header filming-plan-header">
      <div className="artifact-heading">
        <span className="artifact-icon filming-icon" aria-hidden="true"><Video /></span>
        <div><h2>How to film it</h2><p>{plan.format} · {plan.shotList.length} planned shots</p></div>
      </div>
    </header>
    <div className="filming-plan-body">
      <div className="filming-plan-overview">
        <p><strong>Format</strong><span>{plan.format}</span></p>
        <p><strong>Setup</strong><span>{plan.setup}</span></p>
      </div>
      <section>
        <h3>Shot list</h3>
        <ol>{plan.shotList.map((shot, index) => <li key={`${index}-${shot}`}>{shot}</li>)}</ol>
      </section>
      <section>
        <h3>Edit</h3>
        <p>{plan.editNotes}</p>
      </section>
    </div>
  </section>;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("File could not be read"));
    reader.readAsDataURL(file);
  });
}

function restoreMessages(draft: Draft): ChatMessage[] {
  if (draft.messages?.length) return draft.messages;
  if (!draft.titles?.length) return [];
  return [
    { id: `${draft.id}-user`, role: "user", content: draft.topic },
    {
      id: `${draft.id}-assistant`,
      role: "assistant",
      mode: "title",
      content: draft.research?.analyzed
        ? `I reviewed ${draft.research.analyzed} comparable videos and built these directions from the strongest packaging patterns.`
        : "I built these directions around the clearest promise in your video.",
      titles: draft.titles,
      research: draft.research,
    },
  ];
}

function serializeMessage(message: ChatMessage) {
  if (message.role === "user") {
    const attachmentLines = message.attachments?.map((attachment) =>
      attachment.kind === "youtube"
        ? `Selected YouTube reference: ${attachment.name}${attachment.url ? ` (${attachment.url})` : ""}`
        : `Uploaded ${attachment.kind}: ${attachment.name}`,
    ).join("\n");
    return { role: message.role, content: attachmentLines ? `${message.content}\n${attachmentLines}` : message.content };
  }
  const artifactSections: string[] = [];
  if (message.titles?.length) artifactSections.push(`Title options:\n${message.titles.map((item, index) => `${index + 1}. ${item.title}`).join("\n")}`);
  if (message.ideas?.length) artifactSections.push(`Idea options:\n${message.ideas.map((item, index) => {
    const outline = item.scriptOutline ? `\nOpening: ${item.scriptOutline.opening}\nBeats: ${item.scriptOutline.beats.join(" | ")}\nPayoff: ${item.scriptOutline.payoff}` : "";
    return `${index + 1}. ${item.idea}${item.recommended ? " [RECOMMENDED]" : ""}\nWorking title: ${item.suggestedTitle || "Not recorded"}\nFormat: ${item.format || "Not recorded"} · Difficulty: ${item.difficulty || "Not recorded"}\nHook: ${item.hook}\nChannel fit: ${item.channelFit || "Not recorded"}\nResearch basis: ${item.researchBasis || "Not recorded"}${outline}`;
  }).join("\n\n")}`);
  if (message.script) artifactSections.push(`Full script: ${message.script.title}${message.script.viewerPromise ? `\nViewer promise: ${message.script.viewerPromise}` : ""}${message.script.voiceDirection ? `\nVoice: ${message.script.voiceDirection}` : ""}\nCold open: ${message.script.coldOpen}\n${message.script.sections.map((section) => `${section.heading}: ${section.narration}${section.visualDirection ? `\nOn screen: ${section.visualDirection}` : ""}`).join("\n")}\nEnding: ${message.script.ending}`);
  if (message.filmingPlan) artifactSections.push(`Filming plan:\nFormat: ${message.filmingPlan.format}\nSetup: ${message.filmingPlan.setup}\nShot list: ${message.filmingPlan.shotList.join(" | ")}\nEdit: ${message.filmingPlan.editNotes}`);
  if (message.thumbnailImage) artifactSections.push(`Generated thumbnail: ${message.thumbnailImage.aspectRatio}, ${message.thumbnailImage.sourceUsed ? "edited from creator-supplied visual reference" : "created from the video brief"}.`);
  if (message.thumbnails?.length) artifactSections.push(`Thumbnail concepts:\n${message.thumbnails.map((item, index) => `${index + 1}. ${item.concept}: ${item.visual}`).join("\n")}`);
  const artifactLines = artifactSections.join("\n\n");
  return { role: message.role, content: artifactLines ? `${message.content}\n${artifactLines}` : message.content };
}

function isAgentActivity(value: unknown): value is AgentActivity {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AgentActivity>;
  return typeof item.id === "string" && typeof item.label === "string" && (item.status === "active" || item.status === "complete" || item.status === "limited");
}

async function readApiResponse(response: Response, onActivity: (activity: AgentActivity) => void) {
  if (!response.headers.get("content-type")?.includes("application/x-ndjson") || !response.body) {
    return { status: response.status, payload: await response.json() as ApiPayload };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: { status: number; payload: ApiPayload } | null = null;
  const consumeLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as StreamEvent;
    if (event.type === "activity" && isAgentActivity(event.activity)) onActivity(event.activity);
    if (event.type === "result") result = { status: event.status, payload: event.payload };
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    lines.forEach(consumeLine);
    if (done) break;
  }
  if (buffer.trim()) consumeLine(buffer);
  if (!result) throw new Error("Stanley ended the response before returning an answer.");
  return result;
}

function ToolIcon({ name }: { name: string }) {
  if (name === "dashboard") return <LayoutDashboard aria-hidden="true" />;
  if (name === "creatorTwin") return <Users aria-hidden="true" />;
  if (name === "extension") return <Puzzle aria-hidden="true" />;
  return <Sparkles aria-hidden="true" />;
}

function NewChatIcon() {
  return <SquarePen aria-hidden="true" />;
}

function DebugIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5V4a3 3 0 0 1 6 0v1.5M5 12h14M7 8.5l-2-2M17 8.5l2-2M7 15l-2 2M17 15l2 2" /><rect x="7" y="6" width="10" height="14" rx="5" /></svg>;
}

function FeedbackIcon({ down = false }: { down?: boolean }) {
  return down
    ? <ThumbsDown className="feedback-icon" aria-hidden="true" />
    : <ThumbsUp className="feedback-icon" aria-hidden="true" />;
}

function YouTubeIcon() {
  return <svg className="youtube-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1A31 31 0 0 0 2 12a31 31 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22 12a31 31 0 0 0-.4-4.8Z" /><path className="youtube-play" d="m10 15.2 5-3.2-5-3.2v6.4Z" /></svg>;
}

function YouTubeAvatar({ profile, alt = "", direct = false }: { profile: YouTubeProfile; alt?: string; direct?: boolean }) {
  const sourceKey = `${profile.id}:${profile.thumbnailUrl}:${profile.analyzedAt}`;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = failedSource === sourceKey;
  const initial = profile.title.trim().charAt(0).toUpperCase() || "Y";
  if (!profile.thumbnailUrl || failed) {
    return <span className="youtube-avatar-fallback" role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>{initial}</span>;
  }
  return <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={direct ? profile.thumbnailUrl : `/api/youtube/avatar?v=${encodeURIComponent(profile.analyzedAt)}`} alt={alt} referrerPolicy={direct ? "no-referrer" : undefined} onError={() => setFailedSource(sourceKey)} />
  </>;
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
}

function MicIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></svg>;
}

function UploadImageIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m6 17 4.3-4.5 3 3 2-2L19 17M8 9h.01" /></svg>;
}

function UploadVideoIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="14" height="14" rx="3" /><path d="m17 10 4-2v8l-4-2M8 9l5 3-5 3V9Z" /></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" /></svg>;
}

function OnboardingIcon({ name }: { name: "ideas" | "build" | "learn" }) {
  if (name === "ideas") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 22h4M8.5 15.5A7 7 0 1 1 15.5 15.5c-.9.6-1.5 1.2-1.5 2.5h-4c0-1.3-.6-1.9-1.5-2.5Z" /></svg>;
  if (name === "build") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 19 4.2-1L19 7.2A2.3 2.3 0 0 0 15.8 4L5 14.8 4 19Z" /><path d="m14.5 5.5 4 4" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19V4M16 19v-7M22 19V7" /><path d="M2 19h22" /></svg>;
}

function OnboardingVisual({ step, profile }: { step: Exclude<OnboardingStep, "loading" | "done">; profile: YouTubeProfile | null }) {
  const reel = ({
    welcome: {
      frames: [
        "/product-reel/stanley-home.png",
        "/product-reel/stanley-ideas.png",
        "/product-reel/stanley-dashboard.png",
      ],
    },
    features: {
      frames: [
        "/product-reel/stanley-ideas.png",
        "/product-reel/stanley-home.png",
        "/product-reel/stanley-dashboard.png",
      ],
    },
    connect: {
      frames: [
        "/product-reel/stanley-dashboard.png",
        "/product-reel/stanley-ideas.png",
        "/product-reel/stanley-home.png",
      ],
    },
    analyzing: {
      frames: [
        "/product-reel/stanley-dashboard.png",
        "/product-reel/stanley-ideas.png",
        "/product-reel/stanley-home.png",
      ],
    },
  } satisfies Record<Exclude<OnboardingStep, "loading" | "done">, { frames: [string, string, string] }>)[step];

  if (reel) return (
    <div className={`onboarding-product-reel product-reel-${step}`} aria-hidden="true">
      <div className="product-reel-stage">
        {reel.frames.map((frame, index) => <figure className="product-reel-frame" key={`${step}-${frame}`} style={{ "--reel-index": index } as React.CSSProperties}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={frame} alt="" />
        </figure>)}
      </div>
    </div>
  );

  if (step === "welcome") return (
    <div className="onboarding-visual-canvas startup-visual" aria-hidden="true">
      <div className="startup-visual-header">
        <span><i /> Stanley creative system</span>
        <strong><span /> Ready</strong>
      </div>

      <div className="startup-flow">
        <article className="startup-input-card">
          <span><i /> Your idea</span>
          <p>I want to make a video about building better habits...</p>
          <small>Rough is perfect.</small>
        </article>

        <div className="startup-core-wrap">
          <span className="startup-core-ring ring-one" />
          <span className="startup-core-ring ring-two" />
          <div className="startup-core">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/stanley-mascot-transparent.png" alt="" width="74" height="74" />
          </div>
          <small>Thinking with you</small>
        </div>

        <div className="startup-output-stack">
          <article>
            <span><OnboardingIcon name="ideas" /></span>
            <div><small>Angle found</small><strong>The habit nobody sticks with</strong></div>
          </article>
          <article>
            <span><OnboardingIcon name="build" /></span>
            <div><small>Title direction</small><strong>A clear reason to click</strong></div>
          </article>
          <article>
            <span><OnboardingIcon name="learn" /></span>
            <div><small>Story mapped</small><strong>Hook, beats, and payoff</strong></div>
          </article>
        </div>
      </div>

      <div className="startup-visual-footer">
        <span><i /> Creative workspace online</span>
        <span>Idea · research · full plan</span>
      </div>
    </div>
  );

  if (step === "features") return (
    <div className="onboarding-visual-canvas feature-visual" aria-hidden="true">
      <div className="feature-chat-shell">
        <aside className="feature-chat-sidebar">
          <div className="feature-chat-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/stanley-mascot-transparent.png" alt="" width="34" height="34" />
            <div><strong>Stanley</strong><small><YouTubeIcon /> for YouTube</small></div>
          </div>

          <div className="feature-chat-nav active"><SquarePen /><span>New chat</span></div>
          <div className="feature-chat-nav"><LayoutDashboard /><span>Dashboard</span></div>
          <div className="feature-chat-nav"><Puzzle /><span>Extension</span></div>

          <div className="feature-chat-history">
            <span>Chats</span>
            <i />
            <i />
          </div>
        </aside>

        <div className="feature-chat-main">
          <header className="feature-chat-topbar">
            <span><PanelLeftClose /></span>
            <strong><YouTubeIcon /> Connect YouTube</strong>
          </header>

          <div className="feature-chat-thread">
            <p className="feature-chat-kicker"><Sparkles /> One chat, full creative plan</p>

            <div className="feature-chat-user">
              <span>I have a rough idea about building better habits.</span>
              <i />
            </div>

            <div className="feature-chat-assistant">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/stanley-mascot-transparent.png" alt="" width="30" height="30" />
              <p><span>Stanley</span><strong>Let&apos;s turn it into a video people will click—and finish.</strong></p>
            </div>

            <div className="feature-chat-thinking"><i /><i /><i /><span>Shaping your video</span></div>

            <div className="feature-chat-results">
              <article>
                <span><OnboardingIcon name="ideas" /></span>
                <p><small>Angle</small><strong>The habit nobody sticks with</strong></p>
                <i>01</i>
              </article>
              <article>
                <span><OnboardingIcon name="build" /></span>
                <p><small>Title</small><strong>I Tried the Habit Everyone Keeps Recommending</strong></p>
                <i>02</i>
              </article>
              <article>
                <span><OnboardingIcon name="learn" /></span>
                <p><small>Script</small><strong>Hook · 3 beats · Payoff</strong></p>
                <i>03</i>
              </article>
            </div>
          </div>

          <div className="feature-chat-composer">
            <span>Ask Stanley anything...</span>
            <i><ChevronRight /></i>
          </div>
        </div>
      </div>
    </div>
  );

  if (step === "connect") return (
    <div className="onboarding-visual-canvas connect-visual" aria-hidden="true">
      <div className="connect-visual-header">
        <span><YouTubeIcon /> Channel signal preview</span>
        <strong>Read-only</strong>
      </div>

      <div className="connect-channel-card">
        <div className="connect-channel-avatar"><YouTubeIcon /></div>
        <div><span>Your YouTube channel</span><strong>Connect to reveal your patterns</strong></div>
        <i><span /> Private</i>
      </div>

      <div className="connect-signal-scan">
        <article style={{ "--signal": "88%" } as React.CSSProperties}>
          <span>01</span>
          <p><strong>Topics viewers return for</strong><small>Find the subjects with repeat interest.</small></p>
          <div><i /></div>
        </article>
        <article style={{ "--signal": "68%" } as React.CSSProperties}>
          <span>02</span>
          <p><strong>Videos that break your baseline</strong><small>See which uploads outperform the rest.</small></p>
          <div><i /></div>
        </article>
        <article style={{ "--signal": "78%" } as React.CSSProperties}>
          <span>03</span>
          <p><strong>Patterns in winning titles</strong><small>Spot formats worth building on.</small></p>
          <div><i /></div>
        </article>
      </div>

      <div className="connect-trust-strip">
        <span><Check /></span>
        <p><strong>Private analysis, without publishing</strong><small>Stanley can read channel signals. It cannot upload, edit, or delete videos.</small></p>
      </div>
    </div>
  );

  return (
    <div className="onboarding-visual-canvas visual-channel" aria-hidden="true">
      <div className="channel-preview-head">
        <div className="channel-preview-avatar">{profile ? <YouTubeAvatar profile={profile} /> : <YouTubeIcon />}</div>
        <div><span>{step === "analyzing" ? "Channel connected" : "Your YouTube channel"}</span><strong>{profile?.title || "Connect to see your channel"}</strong></div>
        <i className={step === "analyzing" ? "connected" : ""}>{step === "analyzing" ? "Connected" : "Read-only"}</i>
      </div>
      <div className="channel-signals">
        <article><span>01</span><p><strong>Topics you cover most</strong><small>See which subjects get the strongest response.</small></p><i style={{ "--signal": "88%" } as React.CSSProperties} /></article>
        <article><span>02</span><p><strong>Videos that stand out</strong><small>Compare views across your recent uploads.</small></p><i style={{ "--signal": "68%" } as React.CSSProperties} /></article>
        <article><span>03</span><p><strong>Patterns in your titles</strong><small>See which formats worked before.</small></p><i style={{ "--signal": "78%" } as React.CSSProperties} /></article>
      </div>
      <div className="channel-trust"><span>✓</span><p><strong>Private analysis, without publishing</strong><small>Stanley uses captions and channel data only. It never uploads, edits, or deletes videos.</small></p></div>
    </div>
  );
}

function Onboarding({
  step,
  direction,
  error,
  configured,
  profile,
  onContinue,
  onBack,
  onConnect,
}: {
  step: Exclude<OnboardingStep, "loading" | "done">;
  direction: OnboardingDirection;
  error: string;
  configured: boolean;
  profile: YouTubeProfile | null;
  onContinue: () => void;
  onBack: () => void;
  onConnect: () => void;
}) {
  const index = step === "welcome" ? 1 : step === "features" ? 2 : 3;
  return (
    <main className={`onboarding-shell onboarding-direction-${direction}`}>
      <header className="onboarding-header">
        <div className="onboarding-wordmark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="onboarding-wordmark-mascot" src="/stanley-mascot-transparent.png" alt="" width="48" height="48" />
          <strong>Stanley</strong>
          <span className="product-label"><YouTubeIcon /><span>for YouTube</span></span>
        </div>
        <div className="onboarding-step-meta"><span>{step === "analyzing" ? "Setting things up" : `Step ${index} of 3`}</span><div>{[1, 2, 3].map((item) => <i className={item <= index ? "active" : ""} key={item} />)}</div></div>
      </header>

      <section className={`onboarding-stage onboarding-${step}`} aria-live="polite" key={step}>
        <div className="onboarding-copy-panel">
          {step === "welcome" && <>
            <h1>Plan your next YouTube video.</h1>
            <p className="onboarding-copy">Stanley can research a topic, develop the idea, write titles and scripts, and make thumbnails in one conversation.</p>
            <div className="onboarding-welcome-actions">
              <button className="onboarding-primary" type="button" onClick={onContinue}>Continue <ChevronRight aria-hidden="true" /></button>
            </div>
          </>}

          {step === "features" && <>
            <h1>Start with whatever you have.</h1>
            <p className="onboarding-copy">Type a topic, paste a title, or attach a video. Ask for one result or a complete video plan.</p>
            <div className="onboarding-example">
              <span>For example</span>
              <p>“I spent 30 days learning to cook. Help me turn it into a video.”</p>
            </div>
            <p className="onboarding-followup">Reply in the same chat to revise any part.</p>
            <div className="onboarding-actions"><button className="onboarding-back" type="button" onClick={onBack}>Back</button><button className="onboarding-primary" type="button" onClick={onContinue}>Continue <ChevronRight aria-hidden="true" /></button></div>
          </>}

          {step === "connect" && <>
            <div className="onboarding-youtube-mark" aria-hidden="true"><YouTubeIcon /></div>
            <h1>Connect your YouTube channel.</h1>
            <p className="onboarding-copy">Stanley uses your videos and analytics to research ideas for your channel. A connected YouTube account is required.</p>
            <div className="connect-benefits"><span><Check aria-hidden="true" /> Use recent channel performance</span><span><Check aria-hidden="true" /> Find topics and title patterns</span><span><Check aria-hidden="true" /> Personalize ideas to your audience</span></div>
            <p className="onboarding-permission"><strong>Read-only access.</strong> Stanley cannot upload, edit, or delete videos.</p>
            {error && <p className="onboarding-error" role="alert">{error}</p>}
            {!configured && <p className="oauth-dev-note"><strong>Preview setup</strong><span>Private Google credentials are needed before connection can open.</span></p>}
            <div className="onboarding-connect-actions">
              <button className="onboarding-primary youtube-button" type="button" onClick={onConnect}><span className="youtube-button-icon"><YouTubeIcon /></span> Connect YouTube</button>
            </div>
            <button className="onboarding-back standalone" type="button" onClick={onBack}>Back</button>
          </>}

          {step === "analyzing" && <>
            <h1>Loading {profile?.title || "your channel"}.</h1>
            <p className="onboarding-copy">Checking recent videos and performance. This usually takes a few seconds.</p>
            <div className="analysis-steps">
              <p><span>✓</span> YouTube connected</p>
              <p><span className="analysis-dot" /> Loading recent videos</p>
              <p><span className="analysis-dot muted" /> Preparing your chat</p>
            </div>
          </>}
        </div>
        <aside className="onboarding-visual-panel"><OnboardingVisual step={step} profile={profile} /></aside>
      </section>

      <footer className="onboarding-footer"><span>Setup takes about 30 seconds</span><span>Read-only YouTube access</span></footer>
    </main>
  );
}

function formatDashboardCompact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatDashboardDuration(value: number) {
  const seconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatDashboardWatchTime(minutes: number) {
  if (Math.abs(minutes) < 60) return `${Math.round(minutes)} min`;
  return `${formatDashboardCompact(minutes / 60)} hrs`;
}

function formatDashboardPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDashboardNet(value: number) {
  return `${value > 0 ? "+" : ""}${formatDashboardCompact(value)}`;
}

function netSubscribers(metrics: DashboardPeriodMetrics | null) {
  if (!metrics || (metrics.subscribersGained === null && metrics.subscribersLost === null)) return null;
  return (metrics.subscribersGained ?? 0) - (metrics.subscribersLost ?? 0);
}

function percentDelta(current: number | null, comparison: number | null) {
  if (current === null || comparison === null || comparison === 0) return null;
  return ((current - comparison) / Math.abs(comparison)) * 100;
}

function AnimatedMetric({ value, formatter }: { value: number | null; formatter: (value: number) => string }) {
  const [displayed, setDisplayed] = useState(value ?? 0);
  const displayedRef = useRef(value ?? 0);

  useEffect(() => {
    if (value === null) return;
    let frame = 0;
    const startingValue = displayedRef.current;
    const difference = value - startingValue;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 1 : 420;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const nextValue = startingValue + difference * eased;
      displayedRef.current = nextValue;
      setDisplayed(nextValue);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <>{value === null ? "—" : formatter(displayed)}</>;
}

const TRAFFIC_SOURCE_LABELS: Record<string, string> = {
  ADVERTISING: "YouTube ads",
  ANNOTATION: "Links inside videos",
  CAMPAIGN_CARD: "Cards inside videos",
  END_SCREEN: "End screens",
  EXT_URL: "Other websites and apps",
  HASHTAGS: "Hashtag pages",
  NO_LINK_EMBEDDED: "Videos shown on other websites",
  NO_LINK_OTHER: "Direct links or unknown",
  NOTIFICATION: "Notifications",
  PLAYLIST: "Playlists",
  PROMOTED: "YouTube promotions",
  RELATED_VIDEO: "Suggested videos",
  SHORTS: "Shorts feed",
  SOUND_PAGE: "Sound pages",
  SUBSCRIBER: "YouTube home and subscriptions",
  YT_CHANNEL: "Channel pages",
  YT_OTHER_PAGE: "Other places on YouTube",
  YT_SEARCH: "YouTube search",
};

function dashboardTrafficLabel(value: string) {
  return TRAFFIC_SOURCE_LABELS[value] || value.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function chartGeometry(
  current: DashboardAnalytics["timeline"],
  comparison: DashboardAnalytics["comparisonTimeline"],
  metric: DashboardChartMetric,
) {
  const width = 920;
  const height = 258;
  const left = 14;
  const right = 12;
  const top = 16;
  const bottom = 34;
  const values = [...current, ...comparison].map((point) => point[metric]);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(1, ...values);
  const span = maximum - minimum || 1;
  const x = (index: number, length: number) => left + (index / Math.max(1, length - 1)) * (width - left - right);
  const y = (value: number) => top + ((maximum - value) / span) * (height - top - bottom);
  const pathFor = (series: DashboardAnalytics["timeline"] | DashboardAnalytics["comparisonTimeline"]) => series
    .map((point, index) => `${index ? "L" : "M"}${x(index, series.length).toFixed(1)},${y(point[metric]).toFixed(1)}`)
    .join(" ");
  const currentPath = pathFor(current);
  const baseline = y(Math.max(minimum, 0));
  const fillPath = currentPath && `${currentPath} L${x(current.length - 1, current.length).toFixed(1)},${baseline.toFixed(1)} L${x(0, current.length).toFixed(1)},${baseline.toFixed(1)} Z`;
  return {
    width,
    height,
    currentPath,
    comparisonPath: pathFor(comparison),
    fillPath,
    maximum,
    minimum,
    y,
    x,
  };
}

function chartValue(value: number, metric: DashboardChartMetric) {
  if (metric === "watchMinutes") return formatDashboardWatchTime(value);
  if (metric === "netSubscribers") return formatDashboardNet(Math.round(value));
  return formatDashboardCompact(value);
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function LedgerTrendChart({
  label,
  metric,
  currentValue,
  previousValue,
  timeline,
  comparisonTimeline,
  days,
}: {
  label: string;
  metric: "views" | "netSubscribers";
  currentValue: number | null;
  previousValue: number | null;
  timeline: DashboardAnalytics["timeline"];
  comparisonTimeline: DashboardAnalytics["comparisonTimeline"];
  days: number;
}) {
  const geometry = chartGeometry(timeline, comparisonTimeline, metric);
  const change = percentDelta(currentValue, previousValue);
  const formatter = metric === "views" ? formatDashboardCompact : formatDashboardNet;
  return <section className={dashboardStyles.ledgerTrendChart} aria-label={`${label}, current ${days} days compared with previous ${days} days`}>
    <header>
      <div><span>{label}</span><strong>{currentValue === null ? "—" : formatter(currentValue)}</strong></div>
      <small className={change === null ? "" : change >= 0 ? dashboardStyles.up : dashboardStyles.down}>{change === null ? "No comparison" : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}%`}</small>
    </header>
    <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none" aria-hidden="true">
      {geometry.comparisonPath ? <path className={dashboardStyles.ledgerTrendPrevious} d={geometry.comparisonPath} /> : null}
      {geometry.currentPath ? <path className={dashboardStyles.ledgerTrendCurrent} d={geometry.currentPath} /> : null}
    </svg>
    <footer><span><i />This {days}D</span><span><i />Prior {days}D</span></footer>
  </section>;
}

type DashboardDiagnostic = {
  id: string;
  severity: "opportunity" | "watch" | "problem" | "healthy";
  title: string;
  where: string;
  why: string;
  action: string;
  videoId?: string;
};

type PerformanceBriefVideo = {
  video: YouTubeVideoOption;
  performance?: DashboardAnalytics["videos"][number];
};

function creatorTwinPrompt(result: CreatorTwinResult) {
  return [
    `Create one original YouTube video idea for my channel using the observable structure behind ${result.creator.name}'s current performance.`,
    `Title pattern: ${result.inspirationContext.titlePattern}.`,
    `Thumbnail pattern: ${result.inspirationContext.thumbnailPattern}.`,
    `Story structure: ${result.inspirationContext.storyStructure}.`,
    `Content framework: ${result.inspirationContext.contentFramework}.`,
    "Keep the subject, title, thumbnail, and wording original. Give me the idea, title, thumbnail direction, and opening.",
  ].join("\n");
}

type CreatorTwinViewTransition = {
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  finished: Promise<void>;
};

function runCreatorTwinViewTransition(update: () => void, direction: "expand" | "collapse" = "expand") {
  const transitionDocument = document as Document & { startViewTransition?: (callback: () => void) => CreatorTwinViewTransition };
  if (!transitionDocument.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update();
    return;
  }

  const transitionRoot = document.documentElement;
  transitionRoot.dataset.creatorTwinTransition = direction;
  const clearTransitionDirection = () => {
    if (transitionRoot.dataset.creatorTwinTransition === direction) delete transitionRoot.dataset.creatorTwinTransition;
  };

  try {
    const transition = transitionDocument.startViewTransition(() => flushSync(update));
    void transition.ready.catch(() => undefined);
    void transition.updateCallbackDone.catch(() => undefined);
    void transition.finished.catch(() => undefined).finally(clearTransitionDirection);
  } catch {
    clearTransitionDirection();
    update();
  }
}

function ChannelPerformanceBrief({
  videos,
  traffic,
  trafficTotal,
  current,
  selectedVideoId,
  twin,
  showTwinReport,
  animateTwinReveal,
  twinLoading,
  twinError,
  periodLabel,
  onSelectVideo,
  onSelectTraffic,
  onOpenTwin,
  onBackToOverview,
  onRescanTwin,
  onCreate,
}: {
  videos: PerformanceBriefVideo[];
  traffic: DashboardAnalytics["traffic"];
  trafficTotal: number;
  current: DashboardAnalytics["current"] | null;
  selectedVideoId: string;
  twin: CreatorTwinResult | null;
  showTwinReport: boolean;
  animateTwinReveal: boolean;
  twinLoading: boolean;
  twinError: string;
  periodLabel: string;
  onSelectVideo: (id: string) => void;
  onSelectTraffic: (source: string) => void;
  onOpenTwin: () => void;
  onBackToOverview: () => void;
  onRescanTwin: () => void;
  onCreate: (prompt: string, video?: YouTubeVideoOption) => void;
}) {
  const trafficRows = traffic.slice(0, 4);
  const topTrafficViews = Math.max(1, ...trafficRows.map((source) => source.views));
  const currentNet = netSubscribers(current);
  const twinTopViews = Math.max(1, ...(twin?.topVideos || []).map((video) => video.views));
  const twinReference = twin?.topVideos[0] ? { ...twin.topVideos[0], privacyStatus: "public" } : undefined;
  const twinRailState = twinLoading ? "scanning" : twin ? "found" : twinError ? "error" : "idle";

  const twinReport = twin && showTwinReport ? <div className={`${dashboardStyles.creatorTwinBrief} ${dashboardStyles.creatorTwinOverlay}${animateTwinReveal ? ` ${dashboardStyles.creatorTwinRevealing}` : ""}`}>
    <header className={dashboardStyles.twinBriefHeader}>
      <div className={dashboardStyles.twinBriefIdentity}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={twin.creator.avatarUrl} alt={`${twin.creator.name} channel avatar`} referrerPolicy="no-referrer" />
        <div><span>Creator Twin</span><h2 id="creator-twin-brief-heading">{twin.creator.name}</h2><p>{twin.creator.primaryNiche}</p></div>
      </div>
      <div className={dashboardStyles.twinBriefActions}>
        <button className={dashboardStyles.twinBriefBack} type="button" onClick={onBackToOverview} aria-label="Back to period overview" title="Back to period overview"><ArrowLeft aria-hidden="true" /></button>
        <button type="button" onClick={onRescanTwin}><RefreshCw aria-hidden="true" /> Scan again</button>
        <button className={dashboardStyles.twinBriefPrimary} type="button" onClick={() => onCreate(creatorTwinPrompt(twin), twinReference)}>Make a video <ArrowUpRight aria-hidden="true" /></button>
      </div>
    </header>
    <div className={dashboardStyles.twinBriefGrid}>
      <section className={dashboardStyles.twinMatchSummary} aria-label="Creator Twin summary">
        <div className={dashboardStyles.twinMatchRing} style={{ "--twin-match-value": Math.max(0, Math.min(100, twin.creator.similarity)) } as React.CSSProperties}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className={dashboardStyles.twinMatchTrack} cx="60" cy="60" r="53" pathLength="100" />
            <circle className={dashboardStyles.twinMatchProgress} cx="60" cy="60" r="53" pathLength="100" />
          </svg>
          <strong>{twin.creator.similarity}%</strong><span>match</span>
        </div>
        <dl className={dashboardStyles.twinStatRail}>
          <div><dt>Views / video</dt><dd>{formatDashboardCompact(twin.creator.averageViews)}</dd></div>
          <div><dt>Momentum</dt><dd>{twin.creator.recentMomentum}</dd></div>
          <div><dt>Outliers</dt><dd>{twin.creator.outlierFrequency}</dd></div>
        </dl>
      </section>
      <section className={dashboardStyles.twinVideoGraph} aria-labelledby="twin-video-graph-heading">
        <header><div><span>Reference videos</span><h3 id="twin-video-graph-heading">What is working for them</h3></div></header>
        <div>{twin.topVideos.slice(0, 4).map((video, index) => <div className={dashboardStyles.twinGraphRow} key={video.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={video.thumbnailUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" data-twin-reference-thumbnail />
          <span title={video.title}>{video.title}</span>
          <i aria-hidden="true"><b style={{ "--twin-video-scale": Math.max(0, Math.min(1, video.views / twinTopViews)), "--twin-video-delay": `${index * 35}ms` } as React.CSSProperties} /></i>
          <strong>{formatDashboardCompact(video.views)}</strong>
        </div>)}</div>
      </section>
      <section className={dashboardStyles.twinPatternStrip} aria-label="Recommended pattern">
        <div className={dashboardStyles.twinPatternLead}><span>Pattern to test</span><strong>{twin.insights[0]?.what || twin.inspirationContext.titlePattern}</strong></div>
        <dl className={dashboardStyles.twinPatternDetails}>
          <div data-pattern="title"><dt>Title</dt><dd>{twin.inspirationContext.titlePattern}</dd></div>
          <div data-pattern="story"><dt>Story</dt><dd>{twin.inspirationContext.storyStructure}</dd></div>
          <div data-pattern="rhythm"><dt>Rhythm</dt><dd>{twin.inspirationContext.publishingRhythm}</dd></div>
        </dl>
        <div className={dashboardStyles.twinPatternAction}><a href={twin.creator.channelUrl} target="_blank" rel="noreferrer">View channel <ExternalLink aria-hidden="true" /></a></div>
      </section>
    </div>
  </div> : null;

  return <section className={`${dashboardStyles.performanceBrief}${showTwinReport ? ` ${dashboardStyles.creatorTwinHost}` : ""}`} aria-labelledby={showTwinReport ? "creator-twin-brief-heading" : "performance-brief-heading"} data-twin-rail-state={twinRailState}>
    <div className={dashboardStyles.twinOverviewLayer} aria-hidden={showTwinReport || undefined} inert={showTwinReport || undefined}>
    <header className={dashboardStyles.briefHeader}>
      <div><h2 id="performance-brief-heading">What moved this period</h2></div>
      <span className={dashboardStyles.briefScope}><i />{periodLabel}</span>
    </header>
    <button className={dashboardStyles.twinBeacon} type="button" onClick={onOpenTwin} aria-label={twinRailState === "scanning" ? "Finding your Creator Twin" : twinRailState === "found" ? "Creator found" : twinRailState === "error" ? "Retry Creator Twin scan" : "Scan for my Creator Twin"} aria-busy={twinLoading || undefined} disabled={twinRailState === "scanning" || twinRailState === "found"} data-state={twinRailState}>
      <span className={dashboardStyles.twinMascotStage} aria-hidden="true">
        <i className={dashboardStyles.twinMascotHalo} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={dashboardStyles.twinRailStanley} src="/stanley-mascot-dashboard.png" alt="" width="112" height="112" decoding="async" />
      </span>
      {twinRailState === "scanning" ? <TwinRailScan /> : twinRailState === "found" && twin ? <>
        <span className={`${dashboardStyles.twinBeaconCopy} ${dashboardStyles.twinRailFoundCopy}`}><strong>Creator found</strong></span>
        <span className={`${dashboardStyles.twinPatternStack} ${dashboardStyles.twinRailPatternsComplete}`}>
          <span><i aria-hidden="true" /><b>Topics</b><small>Pattern aligned</small></span>
          <span><i aria-hidden="true" /><b>Format</b><small>Pattern aligned</small></span>
          <span><i aria-hidden="true" /><b>Momentum</b><small>Pattern aligned</small></span>
        </span>
        <span className={`${dashboardStyles.twinBeaconAction} ${dashboardStyles.twinRailFoundAction}`}>Opening report<ArrowUpRight aria-hidden="true" /></span>
      </> : twinRailState === "error" ? <>
        <span className={dashboardStyles.twinBeaconCopy}><small>Scan paused</small><strong>Creator Twin could not finish</strong></span>
        <span className={dashboardStyles.twinRailError} role="alert">{twinError}</span>
        <span className={dashboardStyles.twinBeaconAction}>Try again<RefreshCw aria-hidden="true" /></span>
      </> : <>
        <span className={dashboardStyles.twinBeaconCopy}><small>Creator Twin</small><strong>Find the creator pattern closest to yours</strong></span>
        <span className={dashboardStyles.twinPatternStack}>
          <span><i aria-hidden="true" /><b>Topics</b><small>Themes and title language</small></span>
          <span><i aria-hidden="true" /><b>Format</b><small>Length and packaging patterns</small></span>
          <span><i aria-hidden="true" /><b>Momentum</b><small>Views, cadence, and outliers</small></span>
        </span>
        <span className={dashboardStyles.twinBeaconAction}>Scan for my Twin<ArrowUpRight aria-hidden="true" /></span>
      </>}
    </button>
    <div className={dashboardStyles.briefStages}>
      <article className={dashboardStyles.briefStage}>
        <div className={dashboardStyles.stageHeading}><span><Globe2 aria-hidden="true" /></span><div><h3>Where views came from</h3></div></div>
        <div className={dashboardStyles.sourceBars}>
          {trafficRows.length ? trafficRows.map((source) => {
            const share = trafficTotal ? (source.views / trafficTotal) * 100 : 0;
            return <button type="button" key={source.source} onClick={() => onSelectTraffic(source.source)} aria-label={`Inspect ${dashboardTrafficLabel(source.source)}, ${share.toFixed(1)} percent of measured traffic`}>
              <span><strong>{dashboardTrafficLabel(source.source)}</strong><small>{share.toFixed(0)}%</small></span>
              <i aria-hidden="true"><b style={{ "--source-scale": Math.max(.04, source.views / topTrafficViews) } as React.CSSProperties} /></i>
            </button>;
          }) : <p className={dashboardStyles.briefEmpty}>Traffic source data is unavailable for this period.</p>}
        </div>
      </article>
      <article className={`${dashboardStyles.briefStage} ${dashboardStyles.videoStage}`}>
        <div className={dashboardStyles.stageHeading}><span><Video aria-hidden="true" /></span><div><h3>What earned attention</h3></div></div>
        <div className={dashboardStyles.briefVideos}>
          {videos.slice(0, 3).map(({ video, performance }, index) => <button type="button" key={video.id} className={selectedVideoId === video.id ? dashboardStyles.briefVideoSelected : ""} aria-pressed={selectedVideoId === video.id} onClick={() => onSelectVideo(video.id)}>
            <span className={dashboardStyles.briefVideoRank}>{String(index + 1).padStart(2, "0")}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={video.thumbnailUrl} alt="" loading="lazy" />
            <span className={dashboardStyles.briefVideoCopy}><strong>{video.title}</strong><small>{formatDashboardCompact(performance?.views ?? video.views)} views</small></span>
            <ChevronRight aria-hidden="true" />
          </button>)}
        </div>
      </article>
      <article className={`${dashboardStyles.briefStage} ${dashboardStyles.outcomeStage}`}>
        <div className={dashboardStyles.stageHeading}><span><ArrowUpRight aria-hidden="true" /></span><div><h3>What the channel gained</h3></div></div>
        <dl className={dashboardStyles.outcomeMetrics}>
          <div><dt>Views</dt><dd>{current?.views === null || current?.views === undefined ? "—" : formatDashboardCompact(current.views)}</dd></div>
          <div><dt>Watch time</dt><dd>{current?.watchMinutes === null || current?.watchMinutes === undefined ? "—" : formatDashboardWatchTime(current.watchMinutes)}</dd></div>
          <div><dt>Subscribers</dt><dd>{currentNet === null ? "—" : formatDashboardNet(currentNet)}</dd></div>
        </dl>
      </article>
    </div>
    </div>
    {twinReport}
  </section>;
}

function CreatorTwinRouteHero({
  loading,
  result,
  onAnalyze,
}: {
  loading: boolean;
  result: CreatorTwinResult | null;
  onAnalyze: () => void;
}) {
  return <section className={dashboardStyles.creatorTwinHero} data-loading={loading || undefined} data-result={Boolean(result) || undefined} aria-labelledby="creator-twin-route-heading">
    <div className={dashboardStyles.creatorTwinHeroCopy}>
      <span className={dashboardStyles.creatorTwinEngineStatus}><i aria-hidden="true" /> Stanley match engine</span>
      <h1 id="creator-twin-route-heading">Find your creative twin.</h1>
      <p>Stanley reads your topics, packaging, and momentum to find the creator pattern closest to yours—and the next move worth borrowing.</p>
      <div className={dashboardStyles.creatorTwinSignals} aria-label="Signals used for matching">
        <span><i aria-hidden="true" />Topics</span>
        <span><i aria-hidden="true" />Format</span>
        <span><i aria-hidden="true" />Momentum</span>
      </div>
      <button className={dashboardStyles.creatorTwinHeroAction} type="button" onClick={onAnalyze} disabled={loading}>
        {loading ? <><RefreshCw aria-hidden="true" /> Finding your twin…</> : result ? <><RefreshCw aria-hidden="true" /> Find a fresh match</> : <><Sparkles aria-hidden="true" /> Find my Creator Twin</>}
      </button>
    </div>
    <div className={dashboardStyles.creatorTwinHeroStage} aria-hidden="true">
      <span className={`${dashboardStyles.creatorTwinHeroOrbit} ${dashboardStyles.creatorTwinHeroOrbitOuter}`}><i /><i /><i /></span>
      <span className={`${dashboardStyles.creatorTwinHeroOrbit} ${dashboardStyles.creatorTwinHeroOrbitInner}`} />
      <span className={dashboardStyles.creatorTwinHeroSweep} />
      <span className={dashboardStyles.creatorTwinSignalNode} data-node="topics">Topics</span>
      <span className={dashboardStyles.creatorTwinSignalNode} data-node="format">Format</span>
      <span className={dashboardStyles.creatorTwinSignalNode} data-node="momentum">Momentum</span>
      <span className={dashboardStyles.creatorTwinMascot}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/stanley-mascot-dashboard.png" alt="" width="144" height="144" decoding="async" />
      </span>
      {result ? <span className={dashboardStyles.creatorTwinFoundNode}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={result.creator.avatarUrl} alt="" referrerPolicy="no-referrer" />
        <b>{result.creator.similarity}%</b>
      </span> : null}
      <span className={dashboardStyles.creatorTwinStageLabel}>{loading ? "Comparing creator patterns" : result ? `${result.creator.name} found` : "Ready to scan"}</span>
    </div>
  </section>;
}

function CreatorTwinPanel({
  expanded,
  loading,
  error,
  result,
  onAnalyze,
  onRefresh,
  onClose,
  onCreate,
  onStudy,
}: {
  expanded: boolean;
  loading: boolean;
  error: string;
  result: CreatorTwinResult | null;
  onAnalyze: () => void;
  onRefresh: () => void;
  onClose: () => void;
  onCreate: (prompt: string, video?: YouTubeVideoOption) => void;
  onStudy: (video: YouTubeVideoOption) => void;
}) {
  const [resultView, setResultView] = useState<"overview" | "differences" | "videos">("overview");

  if (!expanded) {
    return <section className={dashboardStyles.twinCompact} aria-labelledby="creator-twin-heading">
      <Users aria-hidden="true" />
      <div><span className={dashboardStyles.sectionEyebrow}>Competitive reference</span><h2 id="creator-twin-heading">Creator Twin</h2><p>Find the stronger creator pattern closest to yours.</p></div>
      <button type="button" onClick={() => { setResultView("overview"); onAnalyze(); }}>Find my Creator Twin</button>
    </section>;
  }

  const createPrompt = result ? creatorTwinPrompt(result) : "";
  const referenceVideo = result?.topVideos[0] ? { ...result.topVideos[0], privacyStatus: "public" } : undefined;
  const connectLinks = result ? (() => {
    const instagram = result.links.find((link) => link.platform === "instagram");
    const xLink = result.links.find((link) => link.platform === "x");
    const fallback = result.links.find((link) => ["tiktok", "facebook", "website"].includes(link.platform))
      || result.links.find((link) => link.platform === "youtube");
    return [instagram, xLink || fallback].filter((link, index, links): link is CreatorTwinResult["links"][number] => Boolean(link) && links.findIndex((item) => item?.url === link?.url) === index);
  })() : [];

  return <section className={dashboardStyles.twinExpanded} aria-label="Creator Twin">
    {loading ? <TwinLabScan /> : error ? <div className={dashboardStyles.twinError} role="alert"><strong>Creator Twin could not finish.</strong><p>{error}</p><button type="button" onClick={onRefresh}>Try again</button></div> : result ? <div className={dashboardStyles.twinResults}>
      <header className={dashboardStyles.twinResultHeader}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={result.creator.avatarUrl} alt={`${result.creator.name} channel avatar`} referrerPolicy="no-referrer" />
        <div className={dashboardStyles.twinResultIdentity}>
          <span><Check aria-hidden="true" /> Closest creator match</span>
          <h2 id="creator-twin-heading">{result.creator.name}</h2>
          <p>{result.creator.primaryNiche}</p>
        </div>
        <div className={dashboardStyles.twinMatchScore} aria-label={`${result.creator.similarity}% pattern match`}>
          <strong>{result.creator.similarity}%</strong><span>pattern match</span>
          <i aria-hidden="true"><b style={{ transform: `scaleX(${result.creator.similarity / 100})` }} /></i>
        </div>
        <div className={dashboardStyles.twinHeaderActions}>
          <button className={dashboardStyles.twinPrimaryAction} type="button" onClick={() => onCreate(createPrompt, referenceVideo)}>Build from this pattern <ArrowUpRight aria-hidden="true" /></button>
          <a href={result.creator.channelUrl} target="_blank" rel="noreferrer">Open channel <ExternalLink aria-hidden="true" /></a>
          <button className={dashboardStyles.twinIconAction} type="button" onClick={() => { setResultView("overview"); onRefresh(); }} aria-label="Scan again" title="Scan again"><RefreshCw aria-hidden="true" /></button>
          <button className={dashboardStyles.twinIconAction} type="button" onClick={() => { setResultView("overview"); onClose(); }} aria-label="Hide Creator Twin result" title="Hide result"><X aria-hidden="true" /></button>
        </div>
      </header>
      <div className={dashboardStyles.twinMetricRail} role="list" aria-label="Creator comparison summary">
        <div role="listitem"><span>Average views</span><strong>{formatDashboardCompact(result.creator.averageViews)}</strong><small>per recent video</small></div>
        <div role="listitem"><span>Momentum edge</span><strong>{result.creator.recentMomentum}</strong><small>against your recent baseline</small></div>
        <div role="listitem"><span>Breakout rate</span><strong>{result.creator.outlierFrequency}</strong><small>across the analyzed sample</small></div>
      </div>
      <div className={dashboardStyles.twinSubnav}>
      <div className={dashboardStyles.twinNavigation}>
        {connectLinks.length ? <div className={dashboardStyles.socialLinks}>{connectLinks.map((link) => <a key={link.platform} href={link.url} target="_blank" rel="noreferrer" aria-label={`${link.platform}: ${link.label}`} title={link.label}>
          {link.platform === "x" ? <b aria-hidden="true">𝕏</b> : link.platform === "instagram" ? <Instagram aria-hidden="true" /> : link.platform === "facebook" ? <Facebook aria-hidden="true" /> : link.platform === "youtube" ? <YouTubeIcon /> : <Globe2 aria-hidden="true" />}
        </a>)}</div> : null}
      </div>
      <div className={dashboardStyles.twinTabs} role="tablist" aria-label="Creator Twin details">
        {(["overview", "differences", "videos"] as const).map((view) => <button key={view} type="button" role="tab" aria-selected={resultView === view} className={resultView === view ? dashboardStyles.activeTab : ""} onClick={() => setResultView(view)}>
          {view === "overview" ? "Why this match" : view === "differences" ? "Key differences" : `Top videos (${result.topVideos.length})`}
        </button>)}
      </div>
      </div>
      <div className={dashboardStyles.twinView} role="tabpanel" key={resultView}>
        {resultView === "overview" ? <div className={dashboardStyles.twinOverview}>
          <section className={dashboardStyles.twinEvidence}>
            <div><span>Match evidence</span><h3>Why Stanley chose {result.creator.name}</h3><p>The overlap is strongest across the signals that shape what viewers see and how often they return.</p></div>
            <ul>{result.whyMatched.slice(0, 4).map((reason) => <li key={reason}><Check aria-hidden="true" /><span>{reason}</span></li>)}</ul>
          </section>
          <aside className={dashboardStyles.twinNextMove}>
            <span>Best pattern to test next</span>
            <h3>{result.insights[0]?.what}</h3>
            <p>{result.insights[0]?.why}</p>
            <strong>{result.insights[0]?.adapt}</strong>
            <button type="button" onClick={() => onCreate(createPrompt, referenceVideo)}>Turn this into a video <ArrowUpRight aria-hidden="true" /></button>
          </aside>
        </div> : null}
        {resultView === "differences" ? <div className={dashboardStyles.twinDifferences}>
          <div className={dashboardStyles.twinDifferenceHeading}><div><span>Where the patterns separate</span><h3>Use the gap, not the creator.</h3></div><p>Borrow the behavior that is working. Keep your own voice, subject, and visual identity.</p></div>
          <div className={dashboardStyles.twinDifferenceTable} role="table" aria-label={`Differences between ${result.creator.name} and your channel`}>
            <div role="row"><span role="columnheader">Signal</span><span role="columnheader">{result.creator.name}</span><span role="columnheader">Your channel</span></div>
            {result.differences.slice(0, 4).map((difference) => <div role="row" key={`${difference.category}-${difference.detail}`}><span role="cell"><strong>{difference.category}</strong><small>{difference.detail}</small></span><span role="cell">{difference.twin}</span><span role="cell">{difference.you}</span></div>)}
          </div>
        </div> : null}
        {resultView === "videos" ? <div className={dashboardStyles.twinVideos}>{result.topVideos.map((video, index) => {
          const option: YouTubeVideoOption = { ...video, privacyStatus: "public" };
          return <article className={dashboardStyles.twinVideo} key={video.id}>
            <span className={dashboardStyles.twinVideoRank}>{String(index + 1).padStart(2, "0")}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={video.thumbnailUrl} alt="" />
            <div><strong>{video.title}</strong><p>{formatDashboardCompact(video.views)} views · {video.outlierScore.toFixed(1)}× usual · {formatTime(video.publishedAt)}</p></div>
            <button type="button" onClick={() => onStudy(option)}>Study video</button>
          </article>;
        })}</div> : null}
      </div>
    </div> : null}
  </section>;
}

function TwinLabScan() {
  const stageRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const progressTrackRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const startedAt = performance.now();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const signalNodes = Array.from(stageRef.current?.querySelectorAll<HTMLElement>("[data-convergence-node]") ?? []);
    const signalTraces = Array.from(stageRef.current?.querySelectorAll<SVGPathElement>("[data-convergence-trace]") ?? []);
    const activeThresholds = [8, 36, 64];
    const arrivalThresholds = [30, 58, 82];
    let frame = 0;
    let previousProgress = -1;

    const updateProgress = (now: number) => {
      const elapsed = Math.min(1, (now - startedAt) / 2400);
      const measuredProgress = Math.min(98, Math.round(elapsed * 100));
      const progress = reducedMotion
        ? elapsed === 1 ? 98 : Math.floor(measuredProgress / 25) * 25
        : measuredProgress;

      if (progress !== previousProgress) {
        previousProgress = progress;
        const phase = progress < 36 ? "topics" : progress < 64 ? "format" : progress < 86 ? "momentum" : "found";
        const phaseLabel = phase === "topics" ? "Scanning topics" : phase === "format" ? "Reading format" : phase === "momentum" ? "Checking momentum" : "Twin found";

        progressRef.current?.setAttribute("aria-valuenow", String(progress));
        progressRef.current?.setAttribute("aria-valuetext", phaseLabel);
        progressRef.current?.setAttribute("data-phase", phase);
        stageRef.current?.setAttribute("data-phase", phase);
        stageRef.current?.toggleAttribute("data-complete", progress >= 86);
        if (progressTrackRef.current) progressTrackRef.current.style.transform = `scaleX(${progress / 100})`;
        signalNodes.forEach((node, index) => {
          node.toggleAttribute("data-active", progress >= activeThresholds[index]);
          node.toggleAttribute("data-arrived", progress >= arrivalThresholds[index]);
        });
        signalTraces.forEach((trace, index) => {
          trace.toggleAttribute("data-active", progress >= activeThresholds[index]);
          trace.toggleAttribute("data-arrived", progress >= arrivalThresholds[index]);
        });
      }

      if (elapsed < 1) frame = window.requestAnimationFrame(updateProgress);
    };

    frame = window.requestAnimationFrame(updateProgress);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <div className={`${dashboardStyles.twinLabScan} ${dashboardStyles.twinLabScanMinimal}`} role="status" aria-live="polite" aria-label="Finding your Creator Twin">
    <div className={dashboardStyles.twinLabStage} ref={stageRef}>
      <div className={dashboardStyles.patternConvergence} aria-hidden="true">
        <span className={`${dashboardStyles.convergenceNode} ${dashboardStyles.convergenceTopics}`} data-convergence-node="topics"><i /><span><b>Topics</b><small>Themes + titles</small></span></span>
        <span className={`${dashboardStyles.convergenceNode} ${dashboardStyles.convergenceFormat}`} data-convergence-node="format"><i /><span><b>Format</b><small>Length + packaging</small></span></span>
        <span className={`${dashboardStyles.convergenceNode} ${dashboardStyles.convergenceMomentum}`} data-convergence-node="momentum"><i /><span><b>Momentum</b><small>Views + cadence</small></span></span>
        <svg className={dashboardStyles.convergenceTraces} viewBox="0 0 720 260" preserveAspectRatio="none">
          <path className={dashboardStyles.convergenceTraceBase} d="M 164 58 C 260 58 270 130 348 130" pathLength="1" vectorEffect="non-scaling-stroke" />
          <path className={dashboardStyles.convergenceTraceBase} d="M 164 202 C 260 202 270 130 348 130" pathLength="1" vectorEffect="non-scaling-stroke" />
          <path className={dashboardStyles.convergenceTraceBase} d="M 556 130 C 480 130 444 130 372 130" pathLength="1" vectorEffect="non-scaling-stroke" />
          <path className={dashboardStyles.convergenceTraceFlow} data-convergence-trace="topics" d="M 164 58 C 260 58 270 130 348 130" pathLength="1" vectorEffect="non-scaling-stroke" />
          <path className={dashboardStyles.convergenceTraceFlow} data-convergence-trace="format" d="M 164 202 C 260 202 270 130 348 130" pathLength="1" vectorEffect="non-scaling-stroke" />
          <path className={dashboardStyles.convergenceTraceFlow} data-convergence-trace="momentum" d="M 556 130 C 480 130 444 130 372 130" pathLength="1" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className={dashboardStyles.convergenceCore}>
          <i className={dashboardStyles.convergenceHalo} />
          <i className={dashboardStyles.convergenceConfirmation} data-convergence-confirmation />
          <span className={dashboardStyles.stanleyScanner}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/stanley-mascot-dashboard.png" alt="" width="112" height="112" decoding="async" />
          </span>
          <small>Twin found</small>
        </span>
      </div>
      <div ref={progressRef} className={`${dashboardStyles.scanProgressHud} ${dashboardStyles.convergenceProgress}`} role="progressbar" aria-label="Creator Twin scan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} aria-valuetext="Scanning topics" data-phase="topics">
        <div className={dashboardStyles.scanProgressDetails} aria-hidden="true">
          <span className={dashboardStyles.scanProgressTrack}><i ref={progressTrackRef} /></span>
          <div className={dashboardStyles.scanProgressSteps}><span>Topics</span><span>Format</span><span>Momentum</span></div>
        </div>
      </div>
    </div>
  </div>;
}

function TwinRailScan() {
  const patternRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const progressTrackRef = useRef<HTMLElement>(null);
  const phaseLabelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const startedAt = performance.now();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const railButton = patternRef.current?.closest<HTMLButtonElement>("button");
    const patterns = Array.from(railButton?.querySelectorAll<HTMLElement>("[data-rail-pattern]") ?? []);
    const signals = Array.from(railButton?.querySelectorAll<HTMLElement>("[data-rail-signal]") ?? []);
    const activeThresholds = [8, 36, 64];
    const arrivalThresholds = [30, 58, 82];
    let frame = 0;
    let previousProgress = -1;

    const updateProgress = (now: number) => {
      const elapsed = Math.min(1, (now - startedAt) / 2400);
      const measuredProgress = Math.min(98, Math.round(elapsed * 100));
      const progress = reducedMotion ? elapsed === 1 ? 98 : Math.floor(measuredProgress / 25) * 25 : measuredProgress;

      if (progress !== previousProgress) {
        previousProgress = progress;
        const phase = progress < 36 ? "topics" : progress < 64 ? "format" : progress < 86 ? "momentum" : "found";
        const phaseLabel = phase === "topics" ? "Reading topics" : phase === "format" ? "Comparing format" : phase === "momentum" ? "Checking momentum" : "Twin found";
        progressRef.current?.setAttribute("aria-valuenow", String(progress));
        progressRef.current?.setAttribute("aria-valuetext", phaseLabel);
        progressRef.current?.setAttribute("data-phase", phase);
        railButton?.setAttribute("data-phase", phase);
        railButton?.toggleAttribute("data-complete", progress >= 86);
        if (progressTrackRef.current) progressTrackRef.current.style.transform = `scaleX(${progress / 100})`;
        if (phaseLabelRef.current) phaseLabelRef.current.textContent = phaseLabel;
        patterns.forEach((pattern, index) => {
          pattern.toggleAttribute("data-active", progress >= activeThresholds[index]);
          pattern.toggleAttribute("data-arrived", progress >= arrivalThresholds[index]);
        });
        signals.forEach((signal, index) => {
          signal.toggleAttribute("data-active", progress >= activeThresholds[index]);
          signal.toggleAttribute("data-arrived", progress >= arrivalThresholds[index]);
        });
      }

      if (elapsed < 1) frame = window.requestAnimationFrame(updateProgress);
    };

    frame = window.requestAnimationFrame(updateProgress);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <>
    <span className={dashboardStyles.visuallyHidden} role="status" aria-live="polite" aria-label="Finding your Creator Twin">Finding your Creator Twin</span>
    <span className={dashboardStyles.twinBeaconCopy}><small>Creator Twin</small><strong>Reading your creator pattern</strong></span>
    <span className={`${dashboardStyles.twinPatternStack} ${dashboardStyles.twinRailPatternScan}`} ref={patternRef}>
      <span data-rail-pattern="topics"><i aria-hidden="true" /><b>Topics</b><small>Themes and title language</small></span>
      <span data-rail-pattern="format"><i aria-hidden="true" /><b>Format</b><small>Length and packaging patterns</small></span>
      <span data-rail-pattern="momentum"><i aria-hidden="true" /><b>Momentum</b><small>Views, cadence, and outliers</small></span>
    </span>
    <span className={dashboardStyles.twinRailSignalSpine} aria-hidden="true"><i data-rail-signal="topics" /><i data-rail-signal="format" /><i data-rail-signal="momentum" /></span>
    <span className={`${dashboardStyles.twinBeaconAction} ${dashboardStyles.twinRailProgress}`} ref={progressRef} role="progressbar" aria-label="Creator Twin scan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} aria-valuetext="Reading topics" data-phase="topics">
      <span aria-hidden="true"><i ref={progressTrackRef} /></span><small ref={phaseLabelRef}>Reading topics</small>
    </span>
  </>;
}

function ChannelDashboard({
  active,
  surface,
  status,
  videos,
  loading,
  error,
  onConnect,
  onCreate,
  onCreateFromPattern,
  onUseVideo,
  onRefresh,
  publicOnly = false,
}: {
  active: boolean;
  surface: "dashboard" | "creatorTwin";
  status: YouTubeStatus;
  videos: YouTubeVideoOption[];
  loading: boolean;
  error: string;
  onConnect: () => void;
  onCreate: () => void;
  onCreateFromPattern: (prompt: string, video?: YouTubeVideoOption) => void;
  onUseVideo: (video: YouTubeVideoOption) => void;
  onRefresh: () => void;
  publicOnly?: boolean;
}) {
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [dashboardRange, setDashboardRange] = useState<DashboardRange>(30);
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [selectedTrafficSource, setSelectedTrafficSource] = useState("");
  const [activeDiagnosticId, setActiveDiagnosticId] = useState("");
  const [drawerMode, setDrawerMode] = useState<"video" | "diagnostic" | "traffic" | "twin" | null>(null);
  const [ledgerQuery, setLedgerQuery] = useState("");
  const [ledgerSort, setLedgerSort] = useState<"performance" | "period">("performance");
  const [ledgerPage, setLedgerPage] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [creatorTwinExpanded, setCreatorTwinExpanded] = useState(false);
  const [creatorTwinLoading, setCreatorTwinLoading] = useState(false);
  const [creatorTwinError, setCreatorTwinError] = useState("");
  const [creatorTwin, setCreatorTwin] = useState<CreatorTwinResult | null>(null);
  const [showCreatorTwinReport, setShowCreatorTwinReport] = useState(false);
  const [creatorTwinRevealActive, setCreatorTwinRevealActive] = useState(false);
  const [showPerformanceReport, setShowPerformanceReport] = useState(false);
  const [reportDiagnosticId, setReportDiagnosticId] = useState("");
  const analyticsCacheRef = useRef(new Map<string, DashboardAnalytics>());
  const signalStripRef = useRef<HTMLElement>(null);
  const activeChartMetricRef = useRef<DashboardChartMetric>("views");
  const creatorTwinRunRef = useRef(0);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const performanceReportRef = useRef<HTMLElement>(null);
  const profile = status.profile;

  useEffect(() => {
    if (!active || surface !== "dashboard" || !status.connected || !profile) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ range: String(dashboardRange), compare: "true" });
    const cacheKey = `${publicOnly ? "demo" : "live"}:${profile.id}:${dashboardRange}`;
    const cachedAnalytics = analyticsCacheRef.current.get(cacheKey);
    if (cachedAnalytics) {
      setAnalytics(cachedAnalytics);
      setAnalyticsLoading(false);
      setAnalyticsError("");
      return;
    }

    async function loadAnalytics() {
      setAnalyticsLoading(true);
      setAnalyticsError("");
      try {
        const endpoint = publicOnly ? "/api/youtube/demo-analytics" : "/api/youtube/analytics";
        const response = await fetch(`${endpoint}?${params}`, { signal: controller.signal });
        const payload = await response.json() as DashboardAnalytics & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Your YouTube numbers could not be loaded.");
        analyticsCacheRef.current.set(cacheKey, payload);
        setAnalytics(payload);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setAnalyticsError(caught instanceof Error ? caught.message : "Your YouTube numbers could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setAnalyticsLoading(false);
      }
    }

    void loadAnalytics();
    return () => controller.abort();
  }, [active, dashboardRange, profile, publicOnly, refreshVersion, status.connected, surface]);

  async function analyzeCreatorTwin(force = false) {
    const runId = ++creatorTwinRunRef.current;
    const scanStartedAt = performance.now();
    const collapseToRail = () => {
      setShowCreatorTwinReport(false);
      setCreatorTwin(null);
      setCreatorTwinRevealActive(false);
    };
    if (showCreatorTwinReport) runCreatorTwinViewTransition(collapseToRail, "collapse");
    else collapseToRail();
    setCreatorTwinExpanded(true);
    setCreatorTwinLoading(true);
    setCreatorTwinError("");
    try {
      const params = new URLSearchParams();
      if (publicOnly) params.set("creator", WILL_TENNYSON_DEMO.id);
      if (force) params.set("refresh", "true");
      const response = await fetch(`/api/youtube/creator-twin${params.size ? `?${params}` : ""}`, force ? { cache: "no-store" } : undefined);
      const payload = await response.json() as CreatorTwinResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Creator Twin could not be calculated.");
      const remainingScanTime = Math.max(0, 2400 - (performance.now() - scanStartedAt));
      const avatar = new window.Image();
      avatar.referrerPolicy = "no-referrer";
      avatar.src = payload.creator.avatarUrl;
      const avatarReady = avatar.decode().catch(() => undefined);
      const minimumScan = remainingScanTime ? new Promise((resolve) => window.setTimeout(resolve, remainingScanTime)) : Promise.resolve();
      const avatarWindow = new Promise((resolve) => window.setTimeout(resolve, remainingScanTime));
      await Promise.all([minimumScan, Promise.race([avatarReady, avatarWindow])]);
      if (runId !== creatorTwinRunRef.current) return;
      setCreatorTwin(payload);
    } catch (caught) {
      if (runId !== creatorTwinRunRef.current) return;
      setCreatorTwinError(caught instanceof Error ? caught.message : "Creator Twin could not be calculated.");
    } finally {
      if (runId === creatorTwinRunRef.current) setCreatorTwinLoading(false);
    }
  }

  useEffect(() => {
    if (!creatorTwinRevealActive) return;
    const revealTimer = window.setTimeout(() => setCreatorTwinRevealActive(false), 920);
    return () => window.clearTimeout(revealTimer);
  }, [creatorTwinRevealActive]);

  useEffect(() => {
    if (!creatorTwin || creatorTwinLoading || showCreatorTwinReport) return;
    const holdDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 600;
    const expandTimer = window.setTimeout(() => {
      setShowCreatorTwinReport(true);
      setCreatorTwinRevealActive(true);
    }, holdDuration);
    return () => window.clearTimeout(expandTimer);
  }, [creatorTwin, creatorTwinLoading, showCreatorTwinReport]);

  useEffect(() => {
    if (!active) return;
    function handleDashboardShortcut(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setDrawerMode(null);
    }
    window.addEventListener("keydown", handleDashboardShortcut);
    return () => window.removeEventListener("keydown", handleDashboardShortcut);
  }, [active]);

  useEffect(() => {
    if (drawerMode) drawerCloseRef.current?.focus();
  }, [drawerMode]);

  if (!status.connected || !profile) {
    return <section className={`${dashboardStyles.viewport} ${active ? dashboardStyles.active : dashboardStyles.inactive}`} aria-hidden={active ? undefined : true} inert={active ? undefined : true}>
      <div className={dashboardStyles.emptyShell}>
        <span>Dashboard</span>
        <h1>Connect a channel to open your analytics workspace.</h1>
        <p>Views, watch time, uploads, channel patterns, and the next creation decision will appear here.</p>
        <button type="button" onClick={onConnect}><YouTubeIcon /> Connect YouTube</button>
      </div>
    </section>;
  }

  if (surface === "creatorTwin") {
    return <section className={`${dashboardStyles.viewport} ${active ? dashboardStyles.active : dashboardStyles.inactive}`} aria-hidden={active ? undefined : true} inert={active ? undefined : true}>
      <div className={`${dashboardStyles.shell} ${dashboardStyles.creatorTwinRoute}`}>
        <CreatorTwinRouteHero
          loading={creatorTwinLoading}
          result={creatorTwin}
          onAnalyze={() => void analyzeCreatorTwin(Boolean(creatorTwin))}
        />
        {creatorTwinExpanded && !creatorTwinLoading ? <CreatorTwinPanel
          expanded={creatorTwinExpanded}
          loading={creatorTwinLoading}
          error={creatorTwinError}
          result={creatorTwin}
          onAnalyze={() => void analyzeCreatorTwin()}
          onRefresh={() => void analyzeCreatorTwin(true)}
          onClose={() => setCreatorTwinExpanded(false)}
          onCreate={onCreateFromPattern}
          onStudy={onUseVideo}
        /> : null}
      </div>
    </section>;
  }

  const refresh = () => {
    analyticsCacheRef.current.clear();
    onRefresh();
    setRefreshVersion((version) => version + 1);
  };
  const current = analytics?.current || null;
  const comparison = analytics?.comparison || null;
  const currentNet = netSubscribers(current);
  const comparisonNet = netSubscribers(comparison);
  const videoById = new Map(videos.map((video) => [video.id, video]));
  const publicVideos = [...videos]
    .filter((video) => video.privacyStatus === "public")
    .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime());
  const recentUploads = publicVideos.slice(0, 8);
  const analyticsVideoById = new Map((analytics?.videos || []).map((video) => [video.id, video]));
  const comparableViewMedian = median((analytics?.videos || []).map((video) => video.views).filter((value): value is number => value !== null));
  const ledgerSource = (analytics?.videos || []).flatMap((performance) => {
    const video = videoById.get(performance.id);
    return video ? [{ video, performance }] : [];
  });
  const ledgerRows = ledgerSource
    .filter(({ video }) => {
      if (ledgerQuery && !video.title.toLocaleLowerCase().includes(ledgerQuery.toLocaleLowerCase())) return false;
      return true;
    })
    .sort((left, right) => {
      return (right.performance?.views ?? right.video.views) - (left.performance?.views ?? left.video.views);
    });
  const ledgerPageCount = Math.max(1, Math.ceil(ledgerRows.length / TOP_VIDEOS_PAGE_SIZE));
  const visibleLedgerPage = Math.min(ledgerPage, ledgerPageCount);
  const ledgerPageStart = (visibleLedgerPage - 1) * TOP_VIDEOS_PAGE_SIZE;
  const pagedLedgerRows = ledgerRows.slice(ledgerPageStart, ledgerPageStart + TOP_VIDEOS_PAGE_SIZE);
  const ledgerViewsMax = ledgerRows.reduce((maximum, { video, performance }) => Math.max(maximum, performance?.views ?? video.views), 0);
  const ledgerSubscriberYieldMax = ledgerRows.reduce((maximum, { video, performance }) => {
    const rowViews = performance?.views ?? video.views;
    const subscriberYield = performance && rowViews > 0 ? Math.max(0, performance.netSubscribers) / rowViews * 1_000 : 0;
    return Math.max(maximum, subscriberYield);
  }, 0);
  const strongestRows = ledgerSource
    .sort((left, right) => (right.performance?.views ?? right.video.views) - (left.performance?.views ?? left.video.views))
    .slice(0, 3);
  const trafficTotal = (analytics?.traffic || []).reduce((sum, source) => sum + source.views, 0);
  const traffic = (analytics?.traffic || []).slice(0, 4);
  const comparisonTraffic = analytics?.comparisonTraffic || [];
  const comparisonTrafficTotal = comparisonTraffic.reduce((sum, source) => sum + source.views, 0);
  const viewChange = percentDelta(current?.views ?? null, comparison?.views ?? null);
  const lastUpdated = analytics?.updatedAt || profile.analyzedAt;
  const channelHandle = analytics?.channel.handle?.trim();
  const visibleChannelHandle = channelHandle && !/^api\s+preview$/i.test(channelHandle) ? channelHandle : "";
  const isBusy = loading || analyticsLoading;
  const visibleError = analyticsError || error;
  const dashboardRanges: Array<{ value: DashboardRange; label: string; short: string }> = [
    { value: 7, label: "Last 7 days", short: "7D" },
    { value: 30, label: "Last 30 days", short: "30D" },
    { value: 90, label: "Last 90 days", short: "90D" },
    { value: 180, label: "Last 6 months", short: "6M" },
    { value: 365, label: "Last year", short: "1Y" },
  ];
  const activeRangeLabel = dashboardRanges.find((range) => range.value === dashboardRange)?.label || "Selected period";
  const timeline = analytics?.timeline || [];
  const comparisonTimeline = analytics?.comparisonTimeline || [];
  const uploadMarkers = timeline.length ? recentUploads.flatMap((video) => {
    const published = new Date(video.publishedAt).getTime();
    const start = new Date(`${timeline[0].date}T00:00:00Z`).getTime();
    const end = new Date(`${timeline[timeline.length - 1].date}T23:59:59Z`).getTime();
    if (!Number.isFinite(published) || published < start || published > end) return [];
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    timeline.forEach((point, index) => {
      const distance = Math.abs(new Date(`${point.date}T00:00:00Z`).getTime() - published);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    return [{ video, index: closestIndex }];
  }) : [];
  const leadingRow = strongestRows[0];
  const leadingShare = leadingRow?.performance?.views !== null && leadingRow?.performance?.views !== undefined && current?.views
    ? (leadingRow.performance.views / current.views) * 100
    : null;
  const leadingTraffic = traffic[0];
  const leadingTrafficShare = leadingTraffic && trafficTotal ? (leadingTraffic.views / trafficTotal) * 100 : null;
  const discoveryGrowth = findDiscoveryGrowth(analytics?.traffic || [], comparisonTraffic);
  const diagnostics: DashboardDiagnostic[] = [];
  if (viewChange !== null) diagnostics.push({
    id: "period-views",
    severity: viewChange > 5 ? "opportunity" : viewChange < -10 ? "problem" : Math.abs(viewChange) <= 5 ? "healthy" : "watch",
    title: viewChange > 5 ? "Views accelerated" : viewChange < -5 ? "Views slowed" : "Views stayed near baseline",
    where: `Selected ${analytics?.period.days ?? dashboardRange}-day period`,
    why: `${viewChange >= 0 ? "+" : "−"}${Math.abs(viewChange).toFixed(1)}% versus the comparison period${leadingShare !== null ? `; the leading video contributed ${leadingShare.toFixed(1)}% of period views` : ""}.`,
    action: leadingRow ? "Check the leading upload before planning a follow-up." : "Use this period as the baseline for your next upload.",
    videoId: leadingRow?.video.id,
  });
  else diagnostics.push({
    id: "period-views",
    severity: "healthy",
    title: "Views baseline is forming",
    where: "Selected period",
    why: "A comparison period is not available yet.",
    action: "Compare again after the next upload.",
    videoId: leadingRow?.video.id,
  });
  if (current?.averageViewPercentage !== null && current?.averageViewPercentage !== undefined) diagnostics.push({
    id: "viewer-attention",
    severity: current.averageViewPercentage >= 40 ? "healthy" : current.averageViewPercentage < 30 ? "watch" : "healthy",
    title: current.averageViewPercentage >= 40 ? "Viewer attention is holding" : "Viewer attention needs review",
    where: "Channel average view duration",
    why: `Viewers watched ${formatDashboardPercent(current.averageViewPercentage)} on average${current.averageViewDuration !== null ? `, or ${formatDashboardDuration(current.averageViewDuration)} per view` : ""}.`,
    action: current.averageViewPercentage >= 40 ? "Keep the opening structure for the next subject." : "Review the opening before changing the packaging.",
    videoId: leadingRow?.video.id,
  });
  else diagnostics.push({
    id: "viewer-attention",
    severity: "watch",
    title: "Viewer attention needs more data",
    where: "Channel average view duration",
    why: "Average view duration is unavailable for this period.",
    action: "Check retention again after the next upload.",
    videoId: leadingRow?.video.id,
  });
  if (comparisonTrafficTotal && discoveryGrowth?.shareChange !== undefined) diagnostics.push(discoveryGrowth.shareChange > 1 ? {
    id: "discovery-growth",
    severity: "opportunity",
    title: `${dashboardTrafficLabel(discoveryGrowth.source.source)} is gaining ground`,
    where: "Traffic source mix",
    why: `${discoveryGrowth.currentShare.toFixed(1)}% of measured traffic, up ${discoveryGrowth.shareChange.toFixed(1)} points from the previous period.`,
    action: "Study the videos feeding this source before the next upload.",
    videoId: leadingRow?.video.id,
  } : {
    id: "discovery-growth",
    severity: "healthy",
    title: "Discovery mix held steady",
    where: "Traffic source mix",
    why: "No meaningful traffic source gained more than one point of share.",
    action: "Keep the current mix and check again after the next upload.",
    videoId: leadingRow?.video.id,
  });
  else if (leadingTraffic && leadingTrafficShare !== null) diagnostics.push({
    id: "traffic-source",
    severity: "opportunity",
    title: `${dashboardTrafficLabel(leadingTraffic.source)} leads discovery`,
    where: "Channel traffic sources",
    why: `${formatDashboardCompact(leadingTraffic.views)} views, or ${leadingTrafficShare.toFixed(1)}% of measured source traffic, came from this source.`,
    action: leadingRow ? "Use the strongest video as the follow-up reference." : "Check this source after the next public upload.",
    videoId: leadingRow?.video.id,
  });
  if (!diagnostics.length) diagnostics.push({ id: "no-anomaly", severity: "healthy", title: "No meaningful anomaly detected", where: "Selected period", why: "The available comparison data is not sufficient for a stronger diagnosis.", action: "Keep collecting channel data and compare again after the next upload." });
  const selectedPerformance = selectedVideoId ? analyticsVideoById.get(selectedVideoId) : undefined;
  const selectedVideoRecord = selectedVideoId ? videoById.get(selectedVideoId) : undefined;
  const selectedVideo = selectedVideoRecord ? { ...selectedVideoRecord, views: Math.max(selectedVideoRecord.views, selectedPerformance?.views ?? 0) } : undefined;
  const selectedDiagnostic = diagnostics.find((diagnostic) => diagnostic.id === activeDiagnosticId) || diagnostics[0];
  const selectedTraffic = traffic.find((source) => source.source === selectedTrafficSource);
  const selectVideo = (id: string) => {
    setSelectedVideoId(id);
    setActiveDiagnosticId("");
    setDrawerMode("video");
  };
  const selectDiagnostic = (diagnostic: DashboardDiagnostic) => {
    setActiveDiagnosticId(diagnostic.id);
    if (diagnostic.videoId) setSelectedVideoId(diagnostic.videoId);
    setDrawerMode("diagnostic");
  };
  const selectTraffic = (source: string) => {
    setSelectedTrafficSource(source);
    setDrawerMode("traffic");
  };
  const openCreatorTwin = () => {
    if (!creatorTwinLoading) void analyzeCreatorTwin();
  };
  const backToPerformanceOverview = () => runCreatorTwinViewTransition(() => {
    creatorTwinRunRef.current += 1;
    setShowCreatorTwinReport(false);
    setCreatorTwin(null);
    setCreatorTwinError("");
    setCreatorTwinRevealActive(false);
    setCreatorTwinLoading(false);
  }, "collapse");
  const closeCreatorTwin = () => {
    runCreatorTwinViewTransition(() => {
      setCreatorTwinExpanded(false);
      setDrawerMode(null);
    }, "collapse");
  };
  const metricSignals = [
    { label: "Views", value: current?.views ?? null, previous: comparison?.views ?? null, formatter: formatDashboardCompact, metric: "views" as const, icon: <Eye aria-hidden="true" /> },
    { label: "Watch time", value: current?.watchMinutes ?? null, previous: comparison?.watchMinutes ?? null, formatter: formatDashboardWatchTime, metric: "watchMinutes" as const, icon: <Clock3 aria-hidden="true" /> },
    { label: "Net subscribers", value: currentNet, previous: comparisonNet, formatter: formatDashboardNet, metric: "netSubscribers" as const, icon: <Users aria-hidden="true" /> },
  ];
  const highlightChartMetric = (metric: DashboardChartMetric) => {
    activeChartMetricRef.current = metric;
    signalStripRef.current?.querySelectorAll<HTMLElement>("[data-dashboard-signal-metric]").forEach((card) => {
      card.toggleAttribute("data-chart-active", card.dataset.dashboardSignalMetric === metric);
    });
  };
  const togglePerformanceReport = () => {
    if (showPerformanceReport) {
      setShowPerformanceReport(false);
      setReportDiagnosticId("");
      return;
    }
    flushSync(() => setShowPerformanceReport(true));
    window.requestAnimationFrame(() => performanceReportRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    }));
  };
  const generateDiagnosticFollowUp = (diagnostic: DashboardDiagnostic) => {
    const sourceVideo = diagnostic.videoId ? videoById.get(diagnostic.videoId) : undefined;
    const prompt = [
      `Create one original follow-up video idea from this ${activeRangeLabel.toLowerCase()} channel finding: ${diagnostic.title}.`,
      `Evidence: ${diagnostic.why}`,
      `Recommended next move: ${diagnostic.action}`,
      sourceVideo ? `Use the observable performance pattern from “${sourceVideo.title}” as supporting evidence, without copying its subject or packaging.` : "Use the channel-level evidence as the creative baseline.",
      "Give me the idea, title, thumbnail direction, opening hook, and why it follows from this finding.",
    ].join("\n");
    onCreateFromPattern(prompt, sourceVideo);
  };

  return <section className={`${dashboardStyles.viewport} ${active ? dashboardStyles.active : dashboardStyles.inactive}`} aria-hidden={active ? undefined : true} inert={active ? undefined : true}>
    <div className={dashboardStyles.shell}>
      <header className={dashboardStyles.channelHeader} data-dashboard-channel-header>
        <div className={dashboardStyles.channelIdentity}>
          <YouTubeAvatar profile={profile} alt={`${profile.title} channel avatar`} direct={publicOnly} />
          <div className={dashboardStyles.channelCopy}>
            <h1>{profile.title}</h1>
            <div>{visibleChannelHandle ? <small>{visibleChannelHandle}</small> : null}{publicOnly ? <span className={dashboardStyles.demoAnalyticsLabel}>Demo workspace</span> : null}</div>
            <dl className={dashboardStyles.channelTotals}>
              <div><dd>{formatDashboardCompact(profile.subscriberCount)}</dd><dt>subscribers</dt></div>
              <div><dd>{formatDashboardCompact(profile.totalViews)}</dd><dt>lifetime views</dt></div>
              <div><dd>{formatDashboardCompact(profile.videoCount)}</dd><dt>videos</dt></div>
            </dl>
          </div>
        </div>
      </header>

      {visibleError && !isBusy ? <div className={dashboardStyles.dataError} role="alert"><span>{visibleError}</span><button type="button" onClick={refresh}>Try again</button></div> : null}

      <section className={dashboardStyles.signalStrip} aria-label="Channel overview" ref={signalStripRef}>
        <div className={dashboardStyles.signalScroller}>{metricSignals.map((metric) => {
          const change = percentDelta(metric.value, metric.previous);
          const direction = change === null || Math.abs(change) < 0.05 ? "flat" : change > 0 ? "up" : "down";
          return <article className={dashboardStyles.signalMetric} key={`${metric.label}-${dashboardRange}-${refreshVersion}`} data-dashboard-signal-metric={metric.metric} data-chart-active={activeChartMetricRef.current === metric.metric ? "" : undefined}>
            <span className={dashboardStyles.signalLabel}>{metric.icon}{metric.label}</span>
            <strong>{analyticsLoading && !analytics ? "—" : <AnimatedMetric value={metric.value} formatter={metric.formatter} />}</strong>
            <small className={dashboardStyles[direction]}>{direction === "up" ? <ArrowUpRight aria-hidden="true" /> : direction === "down" ? <ArrowDownRight aria-hidden="true" /> : <Minus aria-hidden="true" />}{change === null ? "No comparison" : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}% vs prior ${analytics?.comparisonPeriod?.days ?? dashboardRange} days`}</small>
          </article>;
        })}</div>
      </section>

      <div className={dashboardStyles.insightGrid}>
      <PerformanceTimelinePanel timeline={timeline} comparisonTimeline={comparisonTimeline} uploadMarkers={uploadMarkers.map(({ video, index }) => ({ id: video.id, title: video.title, index }))} loading={analyticsLoading && !analytics} rangeLabel={activeRangeLabel} range={dashboardRange} selectedVideoId={selectedVideoId} onSelectUpload={selectVideo} onRangeChange={(range) => { setDashboardRange(range); setLedgerPage(1); }} onMetricChange={highlightChartMetric}>
      <footer className={dashboardStyles.reportLauncher}>
        <button type="button" aria-expanded={showPerformanceReport} onClick={togglePerformanceReport}>{showPerformanceReport ? <>Close report <X aria-hidden="true" /></> : <>Generate report <ArrowUpRight aria-hidden="true" /></>}</button>
      </footer>
      </PerformanceTimelinePanel>
      </div>

      {showPerformanceReport ? <section className={dashboardStyles.performanceReport} aria-labelledby="performance-report-heading" ref={performanceReportRef}>
        <header className={dashboardStyles.performanceReportHeader}>
          <h2 id="performance-report-heading">Channel performance report</h2><span>{activeRangeLabel} · {diagnostics.length} findings</span>
        </header>
        <div className={dashboardStyles.performanceFindingList}>
          {diagnostics.map((diagnostic, index) => {
            const expanded = reportDiagnosticId === diagnostic.id;
            return <article className={dashboardStyles.performanceFindingItem} data-expanded={expanded || undefined} key={`report-${diagnostic.id}`} style={{ "--finding-index": index } as React.CSSProperties}>
              <button type="button" id={`report-finding-${diagnostic.id}`} aria-controls={`report-finding-detail-${diagnostic.id}`} aria-expanded={expanded} onClick={() => setReportDiagnosticId(expanded ? "" : diagnostic.id)}><strong>{diagnostic.title}</strong><ChevronDown aria-hidden="true" /></button>
              {expanded ? <div className={dashboardStyles.performanceFindingDetail} id={`report-finding-detail-${diagnostic.id}`} role="region" aria-labelledby={`report-finding-${diagnostic.id}`}>
                <div><span>Evidence</span><p>{diagnostic.why}</p></div>
                <div><span>Next move</span><p>{diagnostic.action}</p></div>
                <button type="button" onClick={() => generateDiagnosticFollowUp(diagnostic)}>Generate follow-up <ArrowUpRight aria-hidden="true" /></button>
              </div> : null}
            </article>;
          })}
        </div>
      </section> : null}

      <section className={dashboardStyles.ledgerSection} aria-labelledby="video-ledger-heading">
        <header className={dashboardStyles.ledgerHeader}>
          <div className={dashboardStyles.ledgerHeading}><h2 id="video-ledger-heading">Top videos</h2></div>
          <div className={dashboardStyles.ledgerTools}>
            <div className={dashboardStyles.ledgerSearch} role="search"><Search aria-hidden="true" /><InputText unstyled type="search" aria-label="Search top videos" value={ledgerQuery} onChange={(event) => { setLedgerQuery(event.target.value); setLedgerPage(1); }} placeholder="Search top videos" />{ledgerQuery ? <button type="button" className={dashboardStyles.ledgerSearchClear} aria-label="Clear video search" onClick={() => { setLedgerQuery(""); setLedgerPage(1); }}><X aria-hidden="true" /></button> : null}</div>
            <div className={dashboardStyles.ledgerModeSwitch} role="tablist" aria-label="Top videos view">{([{ value: "performance", label: "Performance" }, { value: "period", label: "Period analytics" }] as const).map((item) => <button type="button" role="tab" key={item.value} aria-selected={ledgerSort === item.value} aria-controls="video-ledger-panel" onClick={() => { setLedgerSort(item.value); setLedgerPage(1); }}>{item.label}</button>)}</div>
          </div>
        </header>
        <div className={`${dashboardStyles.ledgerViewport}${ledgerSort === "period" ? ` ${dashboardStyles.ledgerViewportPeriod}` : ""}`} id="video-ledger-panel" role="tabpanel" aria-label={ledgerSort === "performance" ? "Video performance" : "Period analytics"}>
          <div className={`${dashboardStyles.ledgerView} ${dashboardStyles[`ledgerView${ledgerSort[0].toUpperCase() + ledgerSort.slice(1)}`]}`} key={`${ledgerSort}-${visibleLedgerPage}`}>
            {ledgerSort === "period" && analytics ? <div className={dashboardStyles.ledgerPeriodSummary}>
              <LedgerTrendChart label="Views" metric="views" currentValue={current?.views ?? null} previousValue={comparison?.views ?? null} timeline={timeline} comparisonTimeline={comparisonTimeline} days={analytics.period.days} />
              <LedgerTrendChart label="Net subscribers" metric="netSubscribers" currentValue={currentNet} previousValue={comparisonNet} timeline={timeline} comparisonTimeline={comparisonTimeline} days={analytics.period.days} />
            </div> : null}
            {ledgerSort === "performance" && ledgerRows.length ? <div className={dashboardStyles.ledgerPerformanceColumns} aria-hidden="true">
              <span>Video · outlier rank</span>
              <span className={dashboardStyles.ledgerMetricHeadings}><span>Total views</span><span>Subscribers</span><span>Likes</span></span>
              <span />
            </div> : null}
            <div className={dashboardStyles.ledgerRows}>{ledgerRows.length ? pagedLedgerRows.map(({ video, performance }, index) => {
            const absoluteIndex = ledgerPageStart + index;
            const rowViews = performance?.views ?? video.views;
            const rowTotalViews = Math.max(video.views, rowViews);
            const outlierRatio = performance?.views !== null && performance?.views !== undefined && comparableViewMedian ? performance.views / comparableViewMedian : null;
            const viewStrength = ledgerViewsMax ? Math.min(1, rowViews / ledgerViewsMax) : 0;
            const viewShare = current?.views ? rowViews / current.views : null;
            const subscriberGain = performance?.netSubscribers ?? null;
            const subscriberYield = subscriberGain !== null && rowViews > 0 ? Math.max(0, subscriberGain) / rowViews * 1_000 : null;
            const subscriberStrength = subscriberYield !== null && ledgerSubscriberYieldMax ? Math.min(1, subscriberYield / ledgerSubscriberYieldMax) : 0;
            const duration = video.duration ? video.duration.replace(/^PT/, "").toLowerCase() : "Public upload";
            const followUpPrompt = [
              `Create one original follow-up video idea for my channel using the observable performance pattern from “${video.title}”.`,
              `Reference result: ${formatDashboardCompact(rowViews)} views${performance?.averageViewPercentage === null || performance?.averageViewPercentage === undefined ? "" : `, ${formatDashboardPercent(performance.averageViewPercentage)} average viewed`}${performance ? `, ${formatDashboardNet(performance.netSubscribers)} subscribers` : ""}.`,
              "Keep the subject, title, thumbnail, and wording original. Give me the idea, title, thumbnail direction, and opening.",
            ].join("\n");
            const rowKeyboardHandler = (event: KeyboardEvent<HTMLElement>) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-dashboard-ledger-row]"));
                rows[Math.min(rows.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus();
              } else if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectVideo(video.id);
              }
            };
            const action = <button className={dashboardStyles.ledgerCreateButton} type="button" onClick={(event) => { event.stopPropagation(); onCreateFromPattern(followUpPrompt, video); }} onKeyDown={(event) => event.stopPropagation()}>Make a video <ArrowUpRight aria-hidden="true" /></button>;
            const identity = <div className={dashboardStyles.ledgerVideoSummary}>
              <span className={dashboardStyles.ledgerRank} aria-hidden="true">{String(absoluteIndex + 1).padStart(2, "0")}</span>
              <span className={dashboardStyles.ledgerVideo}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={video.thumbnailUrl} alt="" loading="lazy" />
                <span><strong>{video.title}</strong><small><span>{duration}</span><i aria-hidden="true" /><span>{formatTime(video.publishedAt)}</span>{ledgerSort === "performance" ? <b className={dashboardStyles.ledgerOutlierChip}>{outlierRatio === null ? "No baseline" : `${outlierRatio.toFixed(1)}× outlier`}</b> : null}</small></span>
              </span>
            </div>;
            const rowProps = {
              tabIndex: 0,
              "data-dashboard-ledger-row": true,
              onClick: () => selectVideo(video.id),
              onKeyDown: rowKeyboardHandler,
            };

            if (ledgerSort === "period") return <article className={`${dashboardStyles.ledgerIntelligenceRow} ${dashboardStyles.ledgerPeriodRow}${selectedVideoId === video.id ? ` ${dashboardStyles.ledgerSelected}` : ""}`} key={video.id} {...rowProps}>
              {identity}
              <div className={`${dashboardStyles.ledgerContribution} ${dashboardStyles.ledgerViewsContribution}`}>
                <div><span>Period views</span><strong>{formatDashboardCompact(rowViews)}</strong></div>
                <span className={dashboardStyles.ledgerMeter}><i style={{ "--ledger-signal": Math.max(.04, viewShare ?? viewStrength) } as React.CSSProperties} /></span>
                <small>{viewShare === null ? "Share unavailable" : `${(viewShare * 100).toFixed(1)}% of channel views`}</small>
              </div>
              <div className={`${dashboardStyles.ledgerContribution} ${dashboardStyles.ledgerSubscriberContribution}`}>
                <div><span>Net subscribers</span><strong>{subscriberGain === null ? "—" : formatDashboardNet(subscriberGain)}</strong></div>
                <span className={dashboardStyles.ledgerMeter}><i style={{ "--ledger-signal": Math.max(.07, subscriberStrength) } as React.CSSProperties} /></span>
                <small>{subscriberYield === null ? "Conversion unavailable" : `${subscriberYield.toFixed(1)} per 1K views`}</small>
              </div>
              <div className={dashboardStyles.ledgerRowAction}>{action}<ChevronRight aria-hidden="true" /></div>
            </article>;

            return <article className={`${dashboardStyles.ledgerIntelligenceRow} ${dashboardStyles.ledgerPerformanceRow}${selectedVideoId === video.id ? ` ${dashboardStyles.ledgerSelected}` : ""}`} key={video.id} {...rowProps}>
              {identity}
              <dl className={dashboardStyles.ledgerEvidenceRail}>
                <div><dt>Total views</dt><dd>{formatDashboardCompact(rowTotalViews)}</dd></div>
                <div><dt>Subscribers</dt><dd>{subscriberGain === null ? "—" : formatDashboardNet(subscriberGain)}</dd></div>
                <div><dt>Likes</dt><dd>{performance?.likes === null || performance?.likes === undefined ? "—" : formatDashboardCompact(performance.likes)}</dd></div>
              </dl>
              <div className={dashboardStyles.ledgerRowAction}>{action}</div>
            </article>;
          }) : <p className={dashboardStyles.ledgerEmpty}>{analyticsLoading ? "Loading period video data." : ledgerQuery ? "No period videos match this search." : "No videos recorded activity in this period."}</p>}</div>
          </div>
        </div>
        {ledgerRows.length > TOP_VIDEOS_PAGE_SIZE ? <footer className={dashboardStyles.ledgerPagination} aria-label="Top videos pagination">
          <span>{ledgerPageStart + 1}–{Math.min(ledgerPageStart + TOP_VIDEOS_PAGE_SIZE, ledgerRows.length)} of {ledgerRows.length}</span>
          <Paginator
            unstyled
            className={dashboardStyles.ledgerPaginator}
            first={ledgerPageStart}
            rows={TOP_VIDEOS_PAGE_SIZE}
            totalRecords={ledgerRows.length}
            pageLinkSize={6}
            template={{
              layout: "PrevPageLink PageLinks NextPageLink",
              PageLinks: (options) => <button
                type="button"
                className={`${dashboardStyles.ledgerPaginatorButton}${options.page === visibleLedgerPage - 1 ? ` ${dashboardStyles.ledgerPaginatorActive}` : ""}`}
                aria-label={`Page ${options.page + 1}`}
                aria-current={options.page === visibleLedgerPage - 1 ? "page" : undefined}
                onClick={options.onClick}
              >{options.page + 1}</button>,
            }}
            onPageChange={(event) => setLedgerPage(event.page + 1)}
            pt={{
              pages: { className: dashboardStyles.ledgerPaginatorPages },
              prevPageButton: { className: dashboardStyles.ledgerPaginatorButton },
              nextPageButton: { className: dashboardStyles.ledgerPaginatorButton },
            }}
          />
        </footer> : null}
      </section>
    </div>

    {drawerMode && typeof document !== "undefined" ? createPortal(<div className={`${dashboardStyles.drawerLayer}${drawerMode === "twin" ? ` ${dashboardStyles.twinLabLayer}` : ""}`}><button className={dashboardStyles.drawerBackdrop} type="button" aria-label="Close details" onClick={drawerMode === "twin" ? closeCreatorTwin : () => { setDrawerMode(null); setCreatorTwinExpanded(false); }} /><aside className={`${dashboardStyles.detailDrawer}${drawerMode === "twin" ? ` ${dashboardStyles.twinLabDrawer}` : ""}`} role="dialog" aria-modal="true" aria-labelledby="dashboard-drawer-heading" style={drawerMode === "twin" ? { viewTransitionName: "creator-twin-lab" } as React.CSSProperties : undefined}>
      <header className={dashboardStyles.drawerHeader}><div><span>{drawerMode === "video" ? "Video evidence" : drawerMode === "diagnostic" ? "Diagnostic evidence" : drawerMode === "traffic" ? "Traffic evidence" : "Stanley match engine"}</span><h2 id="dashboard-drawer-heading">{drawerMode === "video" ? "Video details" : drawerMode === "diagnostic" ? selectedDiagnostic.title : drawerMode === "traffic" ? selectedTraffic ? dashboardTrafficLabel(selectedTraffic.source) : "Traffic source" : "Creator Twin Lab"}</h2></div><button ref={drawerCloseRef} type="button" aria-label="Close details" onClick={drawerMode === "twin" ? closeCreatorTwin : () => { setDrawerMode(null); setCreatorTwinExpanded(false); }}><X aria-hidden="true" /></button></header>
      <div className={dashboardStyles.drawerContent}>
        {drawerMode === "video" && selectedVideo ? <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={dashboardStyles.drawerThumbnail} src={selectedVideo.thumbnailUrl} alt={`${selectedVideo.title} thumbnail`} />
          <div className={dashboardStyles.drawerTitle}><span>{formatTime(selectedVideo.publishedAt)}</span><h3>{selectedVideo.title}</h3></div><dl className={dashboardStyles.drawerMetrics}><div><dt>Total views</dt><dd>{formatDashboardCompact(selectedVideo.views)}</dd></div><div><dt>Period views</dt><dd>{selectedPerformance?.views === null || selectedPerformance?.views === undefined ? "—" : formatDashboardCompact(selectedPerformance.views)}</dd></div><div><dt>Outlier ratio</dt><dd>{selectedPerformance?.views !== null && selectedPerformance?.views !== undefined && comparableViewMedian ? `${(selectedPerformance.views / comparableViewMedian).toFixed(1)}×` : "—"}</dd></div><div><dt>Likes</dt><dd>{selectedPerformance?.likes === null || selectedPerformance?.likes === undefined ? "—" : formatDashboardCompact(selectedPerformance.likes)}</dd></div><div><dt>Comments</dt><dd>{selectedPerformance?.comments === null || selectedPerformance?.comments === undefined ? "—" : formatDashboardCompact(selectedPerformance.comments)}</dd></div><div><dt>Comment rate</dt><dd>{selectedPerformance?.commentRate === null || selectedPerformance?.commentRate === undefined ? "—" : `${selectedPerformance.commentRate.toFixed(2)}%`}</dd></div><div><dt>Average duration</dt><dd>{selectedPerformance?.averageViewDuration === null || selectedPerformance?.averageViewDuration === undefined ? "—" : formatDashboardDuration(selectedPerformance.averageViewDuration)}</dd></div><div><dt>Average viewed</dt><dd>{selectedPerformance?.averageViewPercentage === null || selectedPerformance?.averageViewPercentage === undefined ? "—" : formatDashboardPercent(selectedPerformance.averageViewPercentage)}</dd></div><div><dt>Watch time</dt><dd>{selectedPerformance?.watchMinutes === null || selectedPerformance?.watchMinutes === undefined ? "—" : formatDashboardWatchTime(selectedPerformance.watchMinutes)}</dd></div><div><dt>Subscribers</dt><dd>{selectedPerformance ? formatDashboardNet(selectedPerformance.netSubscribers) : "—"}</dd></div></dl><div className={dashboardStyles.drawerActions}><a href={selectedVideo.url} target="_blank" rel="noreferrer">Open video <ExternalLink aria-hidden="true" /></a><button type="button" onClick={() => onUseVideo(selectedVideo)}>Create from this <ArrowUpRight aria-hidden="true" /></button></div>
        </> : null}
        {drawerMode === "diagnostic" ? <div className={dashboardStyles.diagnosticDetail}><span className={`${dashboardStyles.severity} ${dashboardStyles[selectedDiagnostic.severity]}`}><i />{selectedDiagnostic.severity}</span><h3>{selectedDiagnostic.title}</h3><dl><div><dt>Where it happened</dt><dd>{selectedDiagnostic.where}</dd></div><div><dt>Evidence</dt><dd>{selectedDiagnostic.why}</dd></div><div><dt>Recommended action</dt><dd>{selectedDiagnostic.action}</dd></div></dl>{selectedDiagnostic.videoId && videoById.get(selectedDiagnostic.videoId) ? <button className={dashboardStyles.relatedVideoButton} type="button" onClick={() => selectVideo(selectedDiagnostic.videoId!)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={videoById.get(selectedDiagnostic.videoId)!.thumbnailUrl} alt="" /><span><small>Affected video</small><strong>{videoById.get(selectedDiagnostic.videoId)!.title}</strong></span><ChevronRight aria-hidden="true" /></button> : null}<div className={dashboardStyles.drawerActions}><button type="button" onClick={() => onCreateFromPattern(patternPrompt, selectedDiagnostic.videoId ? videoById.get(selectedDiagnostic.videoId) : undefined)}>Generate follow-up idea <ArrowUpRight aria-hidden="true" /></button><button type="button" onClick={onCreate}>Plan next video</button></div></div> : null}
        {drawerMode === "traffic" && selectedTraffic ? <div className={dashboardStyles.trafficDetail}><span className={dashboardStyles.sectionEyebrow}>Channel discovery source</span><h3>{dashboardTrafficLabel(selectedTraffic.source)}</h3><p>This is aggregate channel traffic for the selected period. The current API does not attribute it to an individual video.</p><dl><div><dt>Views</dt><dd>{formatDashboardCompact(selectedTraffic.views)}</dd></div><div><dt>Share of measured sources</dt><dd>{trafficTotal ? `${((selectedTraffic.views / trafficTotal) * 100).toFixed(1)}%` : "—"}</dd></div><div><dt>Watch time</dt><dd>{formatDashboardWatchTime(selectedTraffic.watchMinutes)}</dd></div></dl></div> : null}
        {drawerMode === "twin" ? <CreatorTwinPanel expanded={creatorTwinExpanded} loading={creatorTwinLoading} error={creatorTwinError} result={creatorTwin} onAnalyze={() => void analyzeCreatorTwin()} onRefresh={() => void analyzeCreatorTwin(true)} onClose={closeCreatorTwin} onCreate={onCreateFromPattern} onStudy={onUseVideo} /> : null}
      </div>
    </aside></div>, document.body) : null}

  </section>;
}

export default function Home({ initialView = "create" }: StanleyAppProps = {}) {
  const topicRef = useRef<HTMLTextAreaElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const latestAssistantRef = useRef<HTMLElement>(null);
  const latestScriptRef = useRef<HTMLElement>(null);
  const replyRunRef = useRef(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const attachmentButtonRef = useRef<HTMLButtonElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const creatorMenuRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const dashboardVideosRequestedRef = useRef(false);
  const willVideosRequestedRef = useRef(false);
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<CreationMode>("auto");
  const [originalTopic, setOriginalTopic] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeActivity, setActiveActivity] = useState<AgentActivity[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [feedback, setFeedback] = useState<Record<string, "up" | "down">>({});
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("loading");
  const [onboardingDirection, setOnboardingDirection] = useState<OnboardingDirection>("forward");
  const [youtubeStatus, setYouTubeStatus] = useState<YouTubeStatus>({ configured: false, connected: false, profile: null });
  const [youtubeError, setYouTubeError] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [typedPlaceholder, setTypedPlaceholder] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [uploadedVideoCache, setUploadedVideoCache] = useState<Map<string, ComposerAttachment>>(() => new Map());
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const [youtubeVideos, setYouTubeVideos] = useState<YouTubeVideoOption[]>([]);
  const [videoSearch, setVideoSearch] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosError, setVideosError] = useState("");
  const [willVideos, setWillVideos] = useState<YouTubeVideoOption[]>([]);
  const [willVideosLoading, setWillVideosLoading] = useState(false);
  const [willVideosError, setWillVideosError] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<WorkspaceView>(initialView);
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfileId>("connected");
  const [creatorMenuOpen, setCreatorMenuOpen] = useState(false);
  const [willProfile, setWillProfile] = useState<YouTubeProfile>({
    id: `demo:${WILL_TENNYSON_DEMO.id}`,
    title: WILL_TENNYSON_DEMO.title,
    thumbnailUrl: "",
    subscriberCount: 0,
    videoCount: 0,
    totalViews: 0,
    analyzedAt: "demo",
  });

  useEffect(() => {
    const syncRoute = () => {
      const nextView: WorkspaceView = window.location.pathname === "/dashboard" ? "dashboard" : window.location.pathname === "/creator-twin" ? "creatorTwin" : "create";
      setActiveView(nextView);
      if (window.location.pathname === "/") {
        window.history.replaceState({}, "", `/chat${window.location.search}${window.location.hash}`);
      }
    };
    syncRoute();
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);
  useEffect(() => {
    if (!attachmentMenuOpen) return;

    function closeAttachmentMenu(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (attachmentButtonRef.current?.contains(event.target) || attachmentMenuRef.current?.contains(event.target)) return;
      setAttachmentMenuOpen(false);
    }

    function closeAttachmentMenuWithKeyboard(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setAttachmentMenuOpen(false);
      attachmentButtonRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeAttachmentMenu);
    document.addEventListener("keydown", closeAttachmentMenuWithKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeAttachmentMenu);
      document.removeEventListener("keydown", closeAttachmentMenuWithKeyboard);
    };
  }, [attachmentMenuOpen]);
  useEffect(() => {
    if (!creatorMenuOpen) return;

    function closeCreatorMenu(event: PointerEvent) {
      if (!(event.target instanceof Node) || creatorMenuRef.current?.contains(event.target)) return;
      setCreatorMenuOpen(false);
    }

    function closeCreatorMenuWithKeyboard(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setCreatorMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeCreatorMenu);
    document.addEventListener("keydown", closeCreatorMenuWithKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeCreatorMenu);
      document.removeEventListener("keydown", closeCreatorMenuWithKeyboard);
    };
  }, [creatorMenuOpen]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/youtube/demo-profile?creator=${WILL_TENNYSON_DEMO.id}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { profile?: YouTubeProfile };
        if (response.ok && payload.profile) setWillProfile(payload.profile);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    let active = true;
    let analysisTimer: number | undefined;
    const draftsTimer = window.setTimeout(() => setDrafts(readDrafts()), 0);
    const sidebarTimer = window.setTimeout(() => setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "true"), 0);
    const creatorProfileTimer = window.setTimeout(() => {
      const savedCreatorProfile = window.localStorage.getItem(CREATOR_PROFILE_KEY);
      if (isCreatorProfileId(savedCreatorProfile)) setCreatorProfile(savedCreatorProfile);
    }, 0);

    async function initialize() {
      const params = new URLSearchParams(window.location.search);
      const result = params.get("youtube");
      const replayOnboarding = params.get("onboarding") === "1";
      const extensionPrompt = params.get("source") === "youtube-extension"
        ? params.get("stanleyPrompt")?.trim().slice(0, 600) || ""
        : "";
      const savedOnboarding = window.localStorage.getItem(ONBOARDING_KEY);
      let status: YouTubeStatus = { configured: false, connected: false, profile: null };
      try {
        const response = await fetch("/api/youtube/status", { cache: "no-store" });
        if (response.ok) status = normalizeYouTubeStatus(await response.json() as YouTubeStatus);
      } catch {
        // Keep the connection gate visible if Google is temporarily unavailable.
      }
      if (!active) return;
      setYouTubeStatus(status);

      if (extensionPrompt) {
        setActiveView("create");
        setMode("idea");
        setTopic(extensionPrompt);
        setOnboardingStep(status.connected ? (savedOnboarding ? "done" : "welcome") : (savedOnboarding ? "connect" : "welcome"));
        window.history.replaceState({}, "", window.location.pathname);
        analysisTimer = window.setTimeout(() => {
          if (active && savedOnboarding && status.connected) topicRef.current?.focus();
        }, 120);
      } else if (replayOnboarding) {
        setOnboardingStep("welcome");
      } else if (result === "connected" && status.connected && status.profile) {
        setActiveView("create");
        setOnboardingStep("analyzing");
        window.localStorage.setItem(ONBOARDING_KEY, "complete");
        window.history.replaceState({}, "", window.location.pathname);
        analysisTimer = window.setTimeout(() => {
          if (!active) return;
          const standout = status.profile?.strongestVideo;
          const insight = standout
            ? `Your recent standout is “${standout.title},” currently moving at about ${standout.viewsPerDay.toLocaleString()} views per day.`
            : `I found ${status.profile?.videoCount.toLocaleString()} videos and I’m ready to learn what you want to make next.`;
          setMessages([{
            id: crypto.randomUUID(),
            role: "assistant",
            content: `You’re connected to ${status.profile?.title}. ${insight}\n\nWant me to find your next video idea, improve a title, or start with something already on your mind?`,
          }]);
          setOnboardingStep("done");
        }, 1500);
      } else if (result && result !== "connected") {
        const messagesByResult: Record<string, string> = {
          "not-configured": "Google OAuth is not configured on this server yet.",
          cancelled: "YouTube connection was cancelled. Nothing was changed.",
          "invalid-state": "That connection attempt expired. Please try again.",
          "connection-failed": "Google could not finish the connection. Please try again.",
        };
        const resultMessage = messagesByResult[result] || "YouTube could not be connected.";
        setYouTubeError(resultMessage);
        window.history.replaceState({}, "", window.location.pathname);
        setOnboardingStep("connect");
      } else {
        setOnboardingStep(status.connected ? (savedOnboarding ? "done" : "welcome") : (savedOnboarding ? "connect" : "welcome"));
      }
      document.documentElement.dataset.stanleyReady = "true";
    }

    void initialize();
    return () => {
      active = false;
      window.clearTimeout(draftsTimer);
      window.clearTimeout(sidebarTimer);
      window.clearTimeout(creatorProfileTimer);
      if (analysisTimer) window.clearTimeout(analysisTimer);
      delete document.documentElement.dataset.stanleyReady;
    };
  }, []);

  useEffect(() => {
    if (onboardingStep !== "done" || !youtubeStatus.connected || dashboardVideosRequestedRef.current) return;
    dashboardVideosRequestedRef.current = true;
    const controller = new AbortController();

    async function loadDashboardVideos() {
      setVideosLoading(true);
      setVideosError("");
      try {
        const response = await fetch("/api/youtube/videos", { signal: controller.signal });
        const payload = await response.json() as { videos?: YouTubeVideoOption[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Your videos could not be loaded.");
        setYouTubeVideos(selectableYouTubeVideos(payload.videos || []));
      } catch (caught) {
        if (controller.signal.aborted) return;
        setVideosError(caught instanceof Error ? caught.message : "Your videos could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setVideosLoading(false);
      }
    }

    void loadDashboardVideos();
    return () => controller.abort();
  }, [onboardingStep, youtubeStatus.connected]);

  useEffect(() => {
    if (onboardingStep !== "done" || creatorProfile !== WILL_TENNYSON_DEMO.id || willVideosRequestedRef.current) return;
    willVideosRequestedRef.current = true;
    const controller = new AbortController();

    async function loadWillVideos() {
      setWillVideosLoading(true);
      setWillVideosError("");
      try {
        const response = await fetch(`/api/youtube/demo-videos?creator=${WILL_TENNYSON_DEMO.id}`, { signal: controller.signal });
        const payload = await response.json() as { videos?: YouTubeVideoOption[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Will's public videos could not be loaded.");
        setWillVideos(selectableYouTubeVideos(payload.videos || []));
      } catch (caught) {
        if (controller.signal.aborted) return;
        setWillVideosError(caught instanceof Error ? caught.message : "Will's public videos could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setWillVideosLoading(false);
      }
    }

    void loadWillVideos();
    return () => controller.abort();
  }, [creatorProfile, onboardingStep]);

  useEffect(() => {
    if (messages.length > 0 || topic || loading || recording || transcribing) return;
    const suggestions = getModePlaceholders(mode);
    const phrase = suggestions[placeholderIndex % suggestions.length] || suggestions[0];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timer: number | undefined;
    let character = 0;

    const showNextPhrase = () => {
      setPlaceholderIndex((current) => (current + 1) % suggestions.length);
    };

    if (reducedMotion) {
      timer = window.setTimeout(() => {
        setTypedPlaceholder(phrase);
        timer = window.setTimeout(showNextPhrase, PLACEHOLDER_HOLD_DELAY);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const eraseCharacter = () => {
      character -= 1;
      setTypedPlaceholder(phrase.slice(0, Math.max(0, character)));
      timer = character > 0
        ? window.setTimeout(eraseCharacter, PLACEHOLDER_ERASE_DELAY)
        : window.setTimeout(showNextPhrase, PLACEHOLDER_BETWEEN_DELAY);
    };

    const typeCharacter = () => {
      character += 1;
      setTypedPlaceholder(phrase.slice(0, character));
      timer = character < phrase.length
        ? window.setTimeout(typeCharacter, PLACEHOLDER_TYPE_DELAY)
        : window.setTimeout(eraseCharacter, PLACEHOLDER_HOLD_DELAY);
    };

    timer = window.setTimeout(() => {
      setTypedPlaceholder("");
      timer = window.setTimeout(typeCharacter, 180);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [messages.length, mode, placeholderIndex, topic, loading, recording, transcribing]);

  useEffect(() => () => {
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (onboardingStep === "loading") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }, [onboardingStep]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const textarea = topicRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }, [topic, messages.length]);

  useEffect(() => {
    if (!loading || !messages.length) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = window.requestAnimationFrame(() => conversationEndRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "end",
    }));
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, loading, activeActivity.length]);

  function scrollLatestScriptToStart() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => latestScriptRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    })));
  }

  function scrollLatestAssistantToStart() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => latestAssistantRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    })));
  }

  function persistConversation(id: string, rootTopic: string, nextMessages: ChatMessage[]) {
    const firstTitleResponse = nextMessages.find((message) => message.role === "assistant" && message.titles?.length);
    const current = readDrafts();
    const existing = current.find((draft) => draft.id === id);
    const updated: Draft = {
      id,
      createdAt: existing?.createdAt || new Date().toISOString(),
      topic: rootTopic,
      messages: nextMessages.map((message) => ({
        ...message,
        attachments: message.attachments?.map((attachment) => ({ ...attachment, previewUrl: undefined })),
      })),
      titles: firstTitleResponse?.titles,
      research: firstTitleResponse?.research,
      creatorProfile,
    };
    const next = [updated, ...current.filter((draft) => draft.id !== id)].slice(0, 8);
    const storageSafe = next.map((draft) => ({
      ...draft,
      messages: draft.messages?.map((message) => ({
        ...message,
        thumbnailImage: message.thumbnailImage ? { ...message.thumbnailImage, data: undefined } : undefined,
      })),
    }));
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(storageSafe));
    setDrafts(next);
  }

  async function submitMessage(rawMessage: string) {
    const cleanMessage = rawMessage.trim();
    const userTurns = messages.filter((message) => message.role === "user").length;
    if (!cleanMessage || loading) return;
    const ownerOnlyYouTubeAttachment = attachments.find((attachment) =>
      attachment.kind === "youtube" && attachment.privacyStatus !== "public",
    );
    if (ownerOnlyYouTubeAttachment && !youtubeStatus.captionAccess) {
      setError(`Reconnect YouTube once to let Stanley read the captions for “${ownerOnlyYouTubeAttachment.title || ownerOnlyYouTubeAttachment.name}”.`);
      return;
    }
    const runId = ++replyRunRef.current;

    // A successful YouTube connection starts the chat with a personalized
    // assistant greeting. The creator's first typed message is still the root
    // topic even though that greeting already exists in `messages`.
    const isFirstMessage = userTurns === 0;
    const rootTopic = isFirstMessage ? cleanMessage : originalTopic;
    // An empty thread is always a new conversation. Derive this from the
    // rendered message state as well as sessionId so a rapid New chat -> Send
    // sequence cannot reuse the previous id while React is under load.
    const activeSessionId = messages.length === 0 ? crypto.randomUUID() : sessionId || crypto.randomUUID();
    const currentAttachments = attachments;
    const previousAttachments = messages.flatMap((message) => message.attachments || []);
    const retainedYouTubeReference = previousAttachments.filter((attachment) => attachment.kind === "youtube").at(-1);
    const retainedUploadedVideo = previousAttachments.filter((attachment) => attachment.kind === "video").at(-1);
    const cachedUploadedVideo = retainedUploadedVideo ? uploadedVideoCache.get(retainedUploadedVideo.id) : undefined;
    const retainedGeneratedThumbnail = messages.filter((message) => message.role === "assistant" && message.thumbnailImage?.data).at(-1)?.thumbnailImage;
    const requestAttachments: ComposerAttachment[] = [...currentAttachments];
    if (!requestAttachments.some((attachment) => attachment.kind === "youtube") && retainedYouTubeReference) {
      requestAttachments.push(retainedYouTubeReference);
    }
    if (!requestAttachments.some((attachment) => attachment.kind === "video") && cachedUploadedVideo) {
      requestAttachments.push(cachedUploadedVideo);
    }
    if (mode === "thumbnail" && !requestAttachments.some((attachment) => attachment.kind === "image") && retainedGeneratedThumbnail?.data) {
      requestAttachments.push({
        id: retainedGeneratedThumbnail.id,
        kind: "image",
        name: "Previous generated thumbnail",
        mimeType: retainedGeneratedThumbnail.mimeType,
        size: Math.floor(retainedGeneratedThumbnail.data.length * .75),
        data: retainedGeneratedThumbnail.data,
      });
    }
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: cleanMessage,
      attachments: currentAttachments.map((attachment) => ({
        id: attachment.id,
        kind: attachment.kind,
        name: attachment.title || attachment.name,
        previewUrl: attachment.previewUrl,
        thumbnailUrl: attachment.thumbnailUrl,
        videoId: attachment.videoId,
        url: attachment.url,
        title: attachment.title,
        views: attachment.views,
        publishedAt: attachment.publishedAt,
        privacyStatus: attachment.privacyStatus,
      })),
    };
    const pendingMessages = [...messages, userMessage];

    setLoading(true);
    setActiveActivity([]);
    setError("");
    setTopic("");
    setAttachments([]);
    setAttachmentMenuOpen(false);
    setMessages(pendingMessages);
    if (isFirstMessage) setOriginalTopic(rootTopic);
    if (!sessionId || messages.length === 0) setSessionId(activeSessionId);

    try {
      const activityLog: AgentActivity[] = [];
      const updateActivity = (activity: AgentActivity) => {
        const existingIndex = activityLog.findIndex((item) => item.id === activity.id);
        if (existingIndex >= 0) activityLog[existingIndex] = activity;
        else activityLog.push(activity);
        setActiveActivity([...activityLog]);
      };
      const response = await fetch("/api/generate-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({
          topic: rootTopic,
          mode,
          sessionId: activeSessionId,
          creatorProfile,
          attachments: requestAttachments.map((attachment) => ({
            kind: attachment.kind,
            name: attachment.name,
            mimeType: attachment.mimeType,
            data: attachment.data,
            videoId: attachment.videoId,
            url: attachment.url,
            title: attachment.title,
            thumbnailUrl: attachment.thumbnailUrl,
            views: attachment.views,
            publishedAt: attachment.publishedAt,
            privacyStatus: attachment.privacyStatus,
          })),
          ...(isFirstMessage ? {} : { messages: pendingMessages.map(serializeMessage) }),
        }),
      });
      const streamed = await readApiResponse(response, updateActivity);
      const payload = streamed.payload;
      if (streamed.status >= 400 || !payload.reply) throw new Error(payload.error || "Stanley could not finish that response. Try again.");

      const responseMode = isCreationMode(payload.mode) && payload.mode !== "auto" ? payload.mode : undefined;
      const presentedAnswer = formatAssistantAnswer(payload);
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: presentedAnswer,
        mode: responseMode,
        titles: payload.titles,
        ideas: payload.ideas,
        script: payload.script,
        filmingPlan: payload.filmingPlan,
        thumbnails: payload.thumbnails,
        thumbnailImage: payload.thumbnailImage,
        research: payload.research,
        agent: payload.agent,
        activity: [...activityLog],
        blocked: payload.blocked,
      };
      const completedMessages = [...pendingMessages, assistantMessage];
      const completedTopic = payload.conversationTopic?.trim() || rootTopic;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduceMotion) {
        const targetTicks = Math.min(450, Math.max(80, Math.ceil(assistantMessage.content.length / 4)));
        const chunkSize = Math.max(1, Math.ceil(assistantMessage.content.length / targetTicks));
        for (let end = chunkSize; end < assistantMessage.content.length; end += chunkSize) {
          if (replyRunRef.current !== runId) return;
          setMessages([...pendingMessages, {
            id: assistantMessage.id,
            role: "assistant",
            content: assistantMessage.content.slice(0, end),
            activity: [...activityLog],
            streaming: true,
          }]);
          await new Promise<void>((resolve) => window.setTimeout(resolve, 12));
        }
      }
      if (replyRunRef.current !== runId) return;
      // Save the completed turn before rendering its artifacts. This prevents a
      // very fast New chat click from racing the history write.
      persistConversation(activeSessionId, completedTopic, completedMessages);
      setMessages(completedMessages);
      setActiveActivity([]);
      setLoading(false);
      if (payload.script) scrollLatestScriptToStart();
      else scrollLatestAssistantToStart();
      if (completedTopic !== originalTopic) setOriginalTopic(completedTopic);
      if (isCreationMode(payload.mode)) setMode(payload.mode);
      const artifactCount = (payload.titles?.length || 0)
        + (payload.ideas?.length || 0)
        + (payload.thumbnails?.length || 0)
        + (payload.thumbnailImage ? 1 : 0)
        + (payload.script ? 1 : 0)
        + (payload.filmingPlan ? 1 : 0);
      setNotice(payload.blocked ? "Request kept inside creation mode" : artifactCount ? `${artifactCount} ${artifactCount === 1 ? "result" : "results"} ready` : "Stanley replied");
    } catch (caught) {
      setMessages(messages);
      setTopic(cleanMessage);
      setAttachments(currentAttachments);
      setActiveActivity([]);
      // Keep the attempted chat ID visible after a failure so the exact server
      // trace can be copied and retried without losing the uploaded context.
      setError(caught instanceof Error ? caught.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
      window.setTimeout(() => topicRef.current?.focus(), 0);
    }
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(topic);
  }

  async function copyText(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(message);
    } catch {
      setError("Clipboard access is blocked in this browser.");
    }
  }

  function copySessionId() {
    if (!sessionId) return;
    void copyText(sessionId, "Session ID copied");
  }

  function chooseQuickStart(prompt: string, selectedMode: CreationMode) {
    setMode(selectedMode);
    setPlaceholderIndex(0);
    setTopic(prompt);
    window.setTimeout(() => {
      topicRef.current?.focus();
      topicRef.current?.setSelectionRange(prompt.length, prompt.length);
    }, 0);
  }

  function rateResponse(messageId: string, value: "up" | "down") {
    setFeedback((current) => ({ ...current, [messageId]: value }));
    setNotice(value === "up" ? "Marked as helpful" : "Feedback noted");
  }

  function navigateWorkspace(view: WorkspaceView, replace = false) {
    const path = view === "dashboard" ? "/dashboard" : view === "creatorTwin" ? "/creator-twin" : "/chat";
    if (window.location.pathname !== path) {
      window.history[replace ? "replaceState" : "pushState"]({}, "", path);
    }
    setActiveView(view);
  }

  function openDraft(draft: Draft) {
    replyRunRef.current += 1;
    setUploadedVideoCache(new Map());
    navigateWorkspace("create");
    setSessionId(draft.id);
    setOriginalTopic(draft.topic);
    setMessages(restoreMessages(draft));
    setActiveActivity([]);
    setLoading(false);
    setTopic("");
    setAttachments([]);
    setAttachmentMenuOpen(false);
    setMode("auto");
    const draftCreatorProfile = isCreatorProfileId(draft.creatorProfile) ? draft.creatorProfile : "connected";
    setCreatorProfile(draftCreatorProfile);
    window.localStorage.setItem(CREATOR_PROFILE_KEY, draftCreatorProfile);
    setError("");
    window.setTimeout(() => topicRef.current?.focus(), 250);
  }

  function startNewChat() {
    replyRunRef.current += 1;
    setUploadedVideoCache(new Map());
    navigateWorkspace("create");
    setTopic("");
    setMode("auto");
    setOriginalTopic("");
    setSessionId("");
    setMessages([]);
    setActiveActivity([]);
    setLoading(false);
    setAttachments([]);
    setAttachmentMenuOpen(false);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => topicRef.current?.focus(), 0);
  }

  function switchCreatorProfile(nextProfile: CreatorProfileId) {
    setCreatorMenuOpen(false);
    if (nextProfile === creatorProfile) return;
    setCreatorProfile(nextProfile);
    window.localStorage.setItem(CREATOR_PROFILE_KEY, nextProfile);
    if (activeView === "create") startNewChat();
    setNotice(nextProfile === "connected"
      ? `Now creating for ${youtubeStatus.profile?.title || "your connected channel"}`
      : `Demo workspace loaded for ${WILL_TENNYSON_DEMO.title}`);
  }

  function continueOnboarding() {
    setYouTubeError("");
    setOnboardingDirection("forward");
    setOnboardingStep((current) => current === "welcome" ? "features" : "connect");
  }

  function backOnboarding() {
    setYouTubeError("");
    setOnboardingDirection("back");
    setOnboardingStep((current) => current === "connect" ? "features" : "welcome");
  }

  function connectYouTube() {
    window.location.assign("/api/youtube/connect?returnTo=/chat");
  }

  function removeAttachment(id: string) {
    setUploadedVideoCache((current) => {
      if (!current.has(id)) return current;
      const next = new Map(current);
      next.delete(id);
      return next;
    });
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }

  async function handleFileSelection(kind: "image" | "video", event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    setAttachmentMenuOpen(false);
    if (!files.length) return;

    const allowedImages = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    const allowedVideos = new Set(["video/mp4", "video/webm", "video/quicktime", "video/mpeg"]);
    const currentBytes = attachments.reduce((total, attachment) => total + (attachment.size || 0), 0);
    const existingImages = attachments.filter((attachment) => attachment.kind === "image").length;
    if (kind === "image" && existingImages + files.length > 3) {
      setError("Attach up to three images at a time.");
      return;
    }
    if (kind === "video" && attachments.some((attachment) => attachment.kind === "video")) {
      setError("Remove the current source video before attaching another one.");
      return;
    }

    try {
      const next: ComposerAttachment[] = [];
      for (const file of files) {
        const allowed = kind === "image" ? allowedImages : allowedVideos;
        const maxSize = kind === "image" ? 8 * 1024 * 1024 : 18 * 1024 * 1024;
        if (!allowed.has(file.type) || file.size > maxSize) {
          throw new Error(kind === "image" ? "Use a JPG, PNG, WebP, or GIF under 8 MB." : "Use an MP4, WebM, MOV, or MPEG video under 18 MB.");
        }
        if (currentBytes + next.reduce((total, item) => total + (item.size || 0), 0) + file.size > 18 * 1024 * 1024) {
          throw new Error("Keep all attachments under 18 MB for one message.");
        }
        const dataUrl = await fileToDataUrl(file);
        const data = dataUrl.slice(dataUrl.indexOf(",") + 1);
        next.push({
          id: crypto.randomUUID(),
          kind,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          data,
          previewUrl: dataUrl,
        });
      }
      setUploadedVideoCache((current) => {
        const uploadedVideos = next.filter((attachment) => attachment.kind === "video");
        if (!uploadedVideos.length) return current;
        return new Map(uploadedVideos.map((attachment) => [attachment.id, attachment]));
      });
      setAttachments((current) => [...current, ...next]);
      setError("");
      window.setTimeout(() => topicRef.current?.focus(), 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That file could not be attached.");
    }
  }

  async function openYouTubePicker() {
    setAttachmentMenuOpen(false);
    setVideoPickerOpen(true);
    setSelectedVideoId("");
    setVideoSearch("");
    if (!youtubeStatus.connected) {
      setVideosError("Connect your YouTube channel to choose from your uploads.");
      return;
    }
    if (youtubeVideos.length > 0) {
      setVideosError("");
      return;
    }
    setVideosLoading(true);
    setVideosError("");
    try {
      const response = await fetch("/api/youtube/videos");
      const payload = await response.json() as { videos?: YouTubeVideoOption[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Your videos could not be loaded.");
      setYouTubeVideos(selectableYouTubeVideos(payload.videos || []));
    } catch (caught) {
      setVideosError(caught instanceof Error ? caught.message : "Your videos could not be loaded.");
    } finally {
      setVideosLoading(false);
    }
  }

  function attachSelectedYouTubeVideo() {
    const video = youtubeVideos.find((item) => item.id === selectedVideoId);
    if (!video) return;
    if (video.privacyStatus !== "public" && !youtubeStatus.captionAccess) {
      connectYouTube();
      return;
    }
    setAttachments((current) => [
      ...current.filter((attachment) => attachment.kind !== "youtube"),
      {
        id: crypto.randomUUID(),
        kind: "youtube",
        name: video.title,
        title: video.title,
        videoId: video.id,
        thumbnailUrl: video.thumbnailUrl,
        url: video.url,
        views: video.views,
        publishedAt: video.publishedAt,
        privacyStatus: video.privacyStatus,
      },
    ]);
    setVideoPickerOpen(false);
    setError("");
    window.setTimeout(() => topicRef.current?.focus(), 0);
  }

  async function transcribeRecording(blob: Blob) {
    setTranscribing(true);
    setError("");
    try {
      const file = new File([blob], "stanley-voice-message.webm", { type: blob.type || "audio/webm" });
      const dataUrl = await fileToDataUrl(file);
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType: file.type, data: dataUrl.slice(dataUrl.indexOf(",") + 1) }),
      });
      const payload = await response.json() as { transcript?: string; error?: string };
      if (!response.ok || !payload.transcript) throw new Error(payload.error || "I could not hear that clearly.");
      setTopic((current) => current.trim() ? `${current.trim()} ${payload.transcript}` : payload.transcript || current);
      window.setTimeout(() => topicRef.current?.focus(), 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "I could not hear that clearly. Try again.");
    } finally {
      setTranscribing(false);
    }
  }

  function stopRecording() {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    setRecording(false);
  }

  async function toggleRecording() {
    if (recording) {
      stopRecording();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice input is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      const chunks: Blob[] = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) chunks.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size) void transcribeRecording(blob);
      }, { once: true });
      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecordingSeconds(0);
      setRecording(true);
      setError("");
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((current) => {
          const next = current + 1;
          if (next >= 90) window.setTimeout(stopRecording, 0);
          return next;
        });
      }, 1000);
    } catch {
      setError("Microphone access was blocked. Allow it in the browser, then try again.");
    }
  }

  const promptSuggestions = getModePlaceholders(mode);
  const promptSuggestion = promptSuggestions[placeholderIndex % promptSuggestions.length] || promptSuggestions[0];

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Tab" && messages.length === 0 && !event.currentTarget.value && typedPlaceholder) {
      event.preventDefault();
      const textarea = event.currentTarget;
      setTopic(promptSuggestion);
      window.requestAnimationFrame(() => {
        textarea.setSelectionRange(promptSuggestion.length, promptSuggestion.length);
      });
      return;
    }
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!event.currentTarget.value.trim() || loading || recording || transcribing) return;
    event.currentTarget.form?.requestSubmit();
  }

  function openTool(item: (typeof NAV_ITEMS)[number]) {
    if (item.view) {
      navigateWorkspace(item.view);
      if (item.view === "create") window.setTimeout(() => topicRef.current?.focus(), 0);
      return;
    }
    setNotice(`${item.label} is coming soon`);
  }

  function startDashboardPrompt(prompt: string, video?: YouTubeVideoOption) {
    startNewChat();
    setMode("idea");
    setTopic(prompt);
    if (video?.privacyStatus === "public") {
      setAttachments([{
        id: crypto.randomUUID(),
        kind: "youtube",
        name: video.title,
        title: video.title,
        videoId: video.id,
        thumbnailUrl: video.thumbnailUrl,
        url: video.url,
        views: video.views,
        publishedAt: video.publishedAt,
        privacyStatus: video.privacyStatus,
      }]);
    }
    window.setTimeout(() => {
      topicRef.current?.focus();
      topicRef.current?.setSelectionRange(prompt.length, prompt.length);
    }, 0);
  }

  async function refreshDashboard() {
    if (creatorProfile === WILL_TENNYSON_DEMO.id) {
      willVideosRequestedRef.current = true;
      setWillVideosLoading(true);
      setWillVideosError("");
      try {
        const response = await fetch(`/api/youtube/demo-videos?creator=${WILL_TENNYSON_DEMO.id}&refresh=true`, { cache: "no-store" });
        const payload = await response.json() as { videos?: YouTubeVideoOption[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Will's public videos could not be loaded.");
        setWillVideos(selectableYouTubeVideos(payload.videos || []));
      } catch (caught) {
        setWillVideosError(caught instanceof Error ? caught.message : "Will's public videos could not be loaded.");
      } finally {
        setWillVideosLoading(false);
      }
      return;
    }
    if (!youtubeStatus.connected) return;
    dashboardVideosRequestedRef.current = true;
    setVideosLoading(true);
    setVideosError("");
    try {
      const response = await fetch("/api/youtube/videos?refresh=true", { cache: "no-store" });
      const payload = await response.json() as { videos?: YouTubeVideoOption[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Your videos could not be loaded.");
      setYouTubeVideos(selectableYouTubeVideos(payload.videos || []));
    } catch (caught) {
      setVideosError(caught instanceof Error ? caught.message : "Your videos could not be loaded.");
    } finally {
      setVideosLoading(false);
    }
  }

  const inConversation = messages.length > 0;
  const streamingReply = messages.some((message) => message.streaming);
  const latestAssistantMessageId = [...messages].reverse().find((message) => message.role === "assistant")?.id;
  const latestScriptMessageId = [...messages].reverse().find((message) => message.script)?.id;
  const publicDemoSelected = creatorProfile === WILL_TENNYSON_DEMO.id;
  const activeDashboardStatus: YouTubeStatus = publicDemoSelected
    ? { configured: true, connected: true, profile: willProfile }
    : youtubeStatus;
  const activeDashboardVideos = publicDemoSelected ? willVideos : youtubeVideos;
  const activeDashboardLoading = publicDemoSelected ? willVideosLoading : videosLoading;
  const activeDashboardError = publicDemoSelected ? willVideosError : videosError;
  const composerPlaceholder = transcribing ? "Transcribing your voice message…" : "";
  const filteredYoutubeVideos = youtubeVideos.filter((video) =>
    ["public", "private", "unlisted"].includes(video.privacyStatus)
    && video.title.toLocaleLowerCase().includes(videoSearch.trim().toLocaleLowerCase()),
  );
  const selectedYouTubeVideo = youtubeVideos.find((video) => video.id === selectedVideoId);
  const selectedVideoNeedsCaptionAccess = Boolean(selectedYouTubeVideo && selectedYouTubeVideo.privacyStatus !== "public" && !youtubeStatus.captionAccess);

  function applyPromptSuggestion() {
    if (!promptSuggestion) return;
    setTopic(promptSuggestion);
    window.requestAnimationFrame(() => {
      topicRef.current?.focus();
      topicRef.current?.setSelectionRange(promptSuggestion.length, promptSuggestion.length);
    });
  }

  function handleComposerChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const textarea = event.currentTarget;
    setTopic(textarea.value);
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }

  function renderComposer(large: boolean) {
    return (
      <form className={large ? "brief-form unified-composer" : "conversation-composer"} id="composer" onSubmit={sendMessage}>
        <div className="composer-stack">
          <div className="composer-frame">
            <div className={large ? "composer composer-large" : "composer"}>
              {attachments.length > 0 && <div className="composer-attachments" aria-label="Attached references">
                {attachments.map((attachment) => <div className="composer-attachment" key={attachment.id}>
                  {attachment.kind === "image" && attachment.previewUrl ? <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={attachment.previewUrl} alt="" />
                  </> : attachment.kind === "video" && attachment.previewUrl ? <video src={attachment.previewUrl} muted /> : attachment.thumbnailUrl ? <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={attachment.thumbnailUrl} alt="" />
                  </> : <span className="attachment-file-icon"><UploadVideoIcon /></span>}
                  <span><strong>{attachment.title || attachment.name}</strong><small>{attachment.kind === "youtube"
                    ? attachment.privacyStatus === "public" ? "Public YouTube video" : `${attachment.privacyStatus === "private" ? "Private" : "Unlisted"} · captions enabled`
                    : attachment.kind === "image" ? "Image" : attachments.some((item) => item.kind === "youtube") ? "Source video · full analysis" : "Video"}</small></span>
                  <button type="button" onClick={() => removeAttachment(attachment.id)} aria-label={`Remove ${attachment.title || attachment.name}`}><CloseIcon /></button>
                </div>)}
              </div>}

              <label className="sr-only" htmlFor={large ? "topic" : "chat-topic"}>Message Stanley</label>
              <div className="composer-input-shell">
                <textarea
                  ref={topicRef}
                  id={large ? "topic" : "chat-topic"}
                  value={topic}
                  onChange={handleComposerChange}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={composerPlaceholder}
                  maxLength={1200}
                  rows={large ? 2 : 1}
                />
                {large && !topic && !composerPlaceholder && typedPlaceholder && <div className="typewriter-suggestion">
                  <span className="typewriter-placeholder" aria-hidden="true">{typedPlaceholder}</span>
                  <button className="suggestion-apply" type="button" onClick={applyPromptSuggestion} aria-label={`Use suggestion: ${promptSuggestion}`} title="Use this suggestion"><span aria-hidden="true">↹</span><kbd>Tab</kbd></button>
                </div>}
              </div>

              <div className="composer-toolbar">
                <div className="composer-tools-left">
                  <button ref={attachmentButtonRef} className={attachmentMenuOpen ? "attach-button active" : "attach-button"} type="button" onClick={() => setAttachmentMenuOpen((current) => !current)} aria-expanded={attachmentMenuOpen} aria-haspopup="menu" aria-controls="attachment-menu" aria-label="Add attachment"><PlusIcon /></button>
                </div>
                <div className="composer-tools-right">
                  {recording && <span className="recording-time"><i /> {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}</span>}
                  {transcribing && <span className="transcribing-label"><i /> Listening</span>}
                  <button className={recording ? "mic-button recording" : "mic-button"} type="button" disabled={loading || transcribing} onClick={() => void toggleRecording()} aria-label={recording ? "Stop recording" : "Start voice message"} aria-pressed={recording}><MicIcon /></button>
                  <button className="generate-button" type="submit" disabled={!topic.trim() || loading || recording || transcribing} aria-label="Send message"><span className="send-arrow" aria-hidden="true" /></button>
                </div>
              </div>
            </div>

            {attachmentMenuOpen && <div ref={attachmentMenuRef} className="attachment-menu" id="attachment-menu" role="menu" aria-label="Add to your message">
              <button type="button" role="menuitem" onClick={() => imageInputRef.current?.click()}><span><UploadImageIcon /></span><span><strong>Attach an image</strong><small>JPG, PNG, WebP, or GIF</small></span></button>
              <button type="button" role="menuitem" onClick={() => videoInputRef.current?.click()}><span><UploadVideoIcon /></span><span><strong>Attach a video</strong><small>MP4, WebM, MOV, or MPEG</small></span></button>
              <div className="attachment-menu-divider" />
              <button type="button" role="menuitem" onClick={() => void openYouTubePicker()}><span className="youtube-menu-icon"><YouTubeIcon /></span><span><strong>Add from YouTube</strong><small>Choose one of your uploads</small></span></button>
            </div>}
          </div>

          <input className="sr-only" ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => void handleFileSelection("image", event)} aria-label="Upload images" />
          <input className="sr-only" ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/mpeg" onChange={(event) => void handleFileSelection("video", event)} aria-label="Upload video" />
          {!large && error && <div className="composer-meta"><p className="form-error" role="alert">{error}</p></div>}
          {large && error && <p className="form-error" role="alert">{error}</p>}
        </div>
      </form>
    );
  }

  if (onboardingStep === "loading") return <main className="onboarding-loading" aria-label="Loading Stanley" />;
  if (onboardingStep !== "done" || !youtubeStatus.connected) {
    return <Onboarding
      step={onboardingStep === "done" ? "connect" : onboardingStep}
      direction={onboardingDirection}
      error={youtubeError}
      configured={youtubeStatus.configured}
      profile={youtubeStatus.profile}
      onContinue={continueOnboarding}
      onBack={backOnboarding}
      onConnect={connectYouTube}
    />;
  }

  return (
    <main className={sidebarCollapsed ? "app-shell sidebar-is-collapsed" : "app-shell"} id="top" data-session-id={sessionId || undefined}>
      <aside className="sidebar">
        <div className="sidebar-head">
          <a className="sidebar-brand" href="#top" aria-label="Stanley home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/stanley-mascot.png" alt="" width="36" height="36" />
            <span><strong>Stanley</strong><small><YouTubeIcon /> for YouTube</small></span>
          </a>
        </div>

        <a className="sidebar-new-chat-button" href="/chat" onClick={(event) => { event.preventDefault(); startNewChat(); }} title={sidebarCollapsed ? "New chat" : undefined}><NewChatIcon /><span>New chat</span></a>

        <nav aria-label="Stanley tools">
          {NAV_ITEMS.map((item) => {
            const active = item.view === activeView;
            return (
            <div className={active ? "nav-item active" : "nav-item"} data-label={item.label} key={item.label}>
              {item.view ? <a className="nav-tool-button" href={item.view === "dashboard" ? "/dashboard" : item.view === "creatorTwin" ? "/creator-twin" : "/chat"} onClick={(event) => { event.preventDefault(); openTool(item); }} aria-current={active ? "page" : undefined}>
                <span className="nav-icon" aria-hidden="true"><ToolIcon name={item.icon} /></span>
                <span>{item.label}</span>
              </a> : <button className="nav-tool-button" type="button" onClick={() => openTool(item)}>
                <span className="nav-icon" aria-hidden="true"><ToolIcon name={item.icon} /></span>
                <span>{item.label}</span>
              </button>}
            </div>
          )})}
        </nav>

        <button
          className="sidebar-collapse"
          type="button"
            onClick={(event) => {
              event.currentTarget.blur();
              setSidebarCollapsed((current) => {
                window.localStorage.setItem(SIDEBAR_KEY, String(!current));
                return !current;
              });
            }}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
        </button>

        <section className="title-history" aria-labelledby="history-heading">
          <h2 id="history-heading">Chats</h2>
          {drafts.length > 0 ? drafts.slice(0, 6).map((draft) => (
            <button type="button" key={draft.id} onClick={() => openDraft(draft)} aria-current={draft.id === sessionId ? "true" : undefined}>
              <MessageCircle aria-hidden="true" /><span>{draft.topic}</span><small>{formatTime(draft.createdAt)}</small>
            </button>
          )) : <p>Your creation chats will appear here.</p>}
        </section>

        {youtubeStatus.connected && youtubeStatus.profile && <div className="sidebar-account">
          <YouTubeAvatar profile={youtubeStatus.profile} />
          <div><strong>{youtubeStatus.profile.title}</strong><small>YouTube channel</small></div>
        </div>}
      </aside>

      <section className="main-panel">
        <header className="main-header">
          <span className="header-balance" />
          {youtubeStatus.connected && youtubeStatus.profile ? <div className="creator-switcher" ref={creatorMenuRef}>
            <button className="channel-connection channel-trigger" type="button" onClick={() => setCreatorMenuOpen((current) => !current)} aria-expanded={creatorMenuOpen} aria-haspopup="menu" aria-controls="creator-profile-menu" aria-label={`Switch creator profile. Current: ${publicDemoSelected ? WILL_TENNYSON_DEMO.title : youtubeStatus.profile.title}`} title="Switch creator profile">
              <YouTubeAvatar profile={publicDemoSelected ? willProfile : youtubeStatus.profile} direct={publicDemoSelected} />
              <span className="channel-copy">
                <strong>{publicDemoSelected ? WILL_TENNYSON_DEMO.title : youtubeStatus.profile.title}</strong>
                <small><i />{publicDemoSelected ? "Public demo" : "Your channel"}</small>
              </span>
              <ChevronDown className="channel-chevron" aria-hidden="true" />
            </button>
            {creatorMenuOpen && <div className="creator-profile-menu" id="creator-profile-menu" role="menu" aria-label="Switch creator profile">
              <div className="creator-menu-heading"><strong>Creative profile</strong></div>
              <button className="creator-profile-option" type="button" role="menuitemradio" aria-checked={creatorProfile === "connected"} onClick={() => switchCreatorProfile("connected")}>
                <YouTubeAvatar profile={youtubeStatus.profile} alt={youtubeStatus.profile.title} />
                <span><strong>{youtubeStatus.profile.title}</strong><small>Your channel · Private analytics</small></span>
                <Check aria-hidden="true" />
              </button>
              <button className="creator-profile-option" type="button" role="menuitemradio" aria-checked={creatorProfile === WILL_TENNYSON_DEMO.id} onClick={() => switchCreatorProfile(WILL_TENNYSON_DEMO.id)}>
                <YouTubeAvatar profile={willProfile} alt={WILL_TENNYSON_DEMO.title} direct />
                <span><strong>{WILL_TENNYSON_DEMO.title}</strong><small>Demo · {willProfile.subscriberCount ? `${formatViews(willProfile.subscriberCount)} subscribers` : "Public channel data"}</small></span>
                <Check aria-hidden="true" />
              </button>
            </div>}
          </div> : <button className="youtube-connect-header" type="button" onClick={connectYouTube}><YouTubeIcon /><span>Connect YouTube</span></button>}
          <div className="header-actions">
            {activeView === "create" && sessionId && <button className="debug-session" type="button" onClick={copySessionId} title={`Copy session ID: ${sessionId}`} aria-label="Copy session ID"><DebugIcon /><span>Debug</span><code>{sessionId.slice(0, 8)}</code></button>}
          </div>
        </header>

        <ChannelDashboard
          active={activeView === "dashboard" || activeView === "creatorTwin"}
          surface={activeView === "creatorTwin" ? "creatorTwin" : "dashboard"}
          status={activeDashboardStatus}
          videos={activeDashboardVideos}
          loading={activeDashboardLoading}
          error={activeDashboardError}
          onConnect={connectYouTube}
          onCreate={() => startDashboardPrompt(publicDemoSelected ? `Analyze ${WILL_TENNYSON_DEMO.title}'s public channel and give me three strong video ideas` : "Analyze my channel and give me three strong video ideas for my next upload")}
          onCreateFromPattern={(prompt, video) => startDashboardPrompt(prompt, video)}
          onUseVideo={(video) => startDashboardPrompt(`Analyze this upload and help me build a stronger follow-up video: ${video.title}`, video)}
          onRefresh={() => void refreshDashboard()}
          publicOnly={publicDemoSelected}
        />
        {activeView === "create" ? <>
        <div className={inConversation ? "content conversation-mode" : "content"}>
          {!inConversation ? (
            <>
              <section className="welcome" aria-labelledby="welcome-title">
                <h1 id="welcome-title">Where should we start?</h1>
                <p>Ideas, titles, scripts, and thumbnails in one conversation.</p>
              </section>

              {renderComposer(true)}
              <div className="quick-starts" aria-label="Start with a YouTube task">
                {QUICK_STARTS.map((item) => <button type="button" key={item.label} onClick={() => chooseQuickStart(item.prompt, item.mode)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
              </div>
            </>
          ) : (
            <section className="conversation" aria-live="polite">
              {messages.map((message) => message.role === "user" ? (
                <div className="user-message" key={message.id}>
                  {message.attachments?.length ? <div className="user-message-attachments">{message.attachments.map((attachment) => <div key={attachment.id}>
                    {attachment.previewUrl || attachment.thumbnailUrl ? <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={attachment.previewUrl || attachment.thumbnailUrl} alt="" />
                    </> : <span><UploadVideoIcon /></span>}
                    <small>{attachment.name}</small>
                  </div>)}</div> : null}
                  <p>{message.content}</p>
                </div>
              ) : (
                <article
                  className={message.blocked ? "assistant-message blocked" : "assistant-message"}
                  key={message.id}
                  ref={message.id === latestAssistantMessageId ? latestAssistantRef : undefined}
                  data-latest-response={message.id === latestAssistantMessageId ? "true" : undefined}
                  aria-busy={message.streaming || undefined}
                >
                  <div className="assistant-lead">
                    <div>
                      {message.blocked && <span className="boundary-label">Creation boundary</span>}
                      {message.activity?.length && !message.streaming ? <AgentActivityTimeline activity={message.activity} durationMs={message.agent?.durationMs} /> : null}
                      {structuredLeadText(message) ? <ConversationalAnswer text={structuredLeadText(message)} streaming={message.streaming} /> : null}
                    </div>
                  </div>

                  {message.ideas?.length ? <IdeaWorkspace ideas={message.ideas} /> : null}

                  {message.script ? <ScriptWorkspace script={message.script} workspaceRef={message.id === latestScriptMessageId ? latestScriptRef : undefined} /> : null}

                  {message.filmingPlan ? <FilmingPlanWorkspace plan={message.filmingPlan} /> : null}

                  {message.thumbnailImage ? <ThumbnailWorkspace thumbnail={message.thumbnailImage} disabled={loading} onEdit={() => {
                    setMode("thumbnail");
                    setTopic("Make this thumbnail ");
                    window.setTimeout(() => topicRef.current?.focus(), 0);
                  }} /> : null}

                  {message.research && (
                    <details className="research-card">
                      <summary><span className={`research-status ${message.research.coverage || "strong"}`}><i /> {message.research.coverage === "limited" ? "Limited evidence" : message.research.coverage === "none" ? "Broad guidance" : "Evidence used"}</span><strong>{message.research.analyzed > 0 ? `${message.research.analyzed} videos analyzed for “${message.research.query}”` : `No close matches found for “${message.research.query}”`}</strong>{message.research.examples.length > 0 && <span className="research-open">Sources +</span>}</summary>
                      <div className="research-sources">{message.research.examples.map((video) => <a href={video.url} target="_blank" rel="noreferrer" key={video.id}><span>{video.title}</span><small>{video.channel} · {video.views.toLocaleString()} views</small></a>)}</div>
                    </details>
                  )}

                  {!message.streaming && <div className="assistant-actions">
                    <button className={feedback[message.id] === "up" ? "feedback-response selected" : "feedback-response"} type="button" aria-label="Mark response as helpful" aria-pressed={feedback[message.id] === "up"} onClick={() => rateResponse(message.id, "up")}><FeedbackIcon /></button>
                    <button className={feedback[message.id] === "down" ? "feedback-response selected" : "feedback-response"} type="button" aria-label="Mark response as not helpful" aria-pressed={feedback[message.id] === "down"} onClick={() => rateResponse(message.id, "down")}><FeedbackIcon down /></button>
                    <button className="copy-response" type="button" onClick={() => copyText(assistantClipboardText(message), "Copied")} aria-label={assistantCopyLabel(message)}><CopyIcon className="copy-icon" aria-hidden="true" /> Copy</button>
                  </div>}

                </article>
              ))}

              {loading && !streamingReply ? <AgentActivityTimeline activity={activeActivity} live /> : null}
              <div ref={conversationEndRef} data-testid="conversation-end" aria-hidden="true" />
            </section>
          )}
        </div>

        {inConversation && renderComposer(false)}
        </> : null}
      </section>

      {videoPickerOpen && <div className="video-picker-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setVideoPickerOpen(false);
      }}>
        <section className="video-picker" role="dialog" aria-modal="true" aria-labelledby="video-picker-title">
          <header><div><h2 id="video-picker-title">Select a reference video</h2><p>Attach one of your YouTube videos to this message.</p></div><button type="button" onClick={() => setVideoPickerOpen(false)} aria-label="Close video picker"><CloseIcon /></button></header>
          {youtubeStatus.connected && <label className="video-search"><SearchIcon /><span className="sr-only">Search your videos</span><input value={videoSearch} onChange={(event) => setVideoSearch(event.target.value)} placeholder="Search your videos" /></label>}
          <div className="video-picker-tabs" aria-label="Video source"><button type="button" className="active">Your videos</button></div>
          <div className="video-grid">
            {videosLoading ? <div className="video-picker-state"><span className="thinking-spinner" />Loading your videos…</div> : videosError ? <div className="video-picker-state error"><p>{videosError}</p>{!youtubeStatus.connected && <button type="button" onClick={connectYouTube}><YouTubeIcon /> Connect YouTube</button>}</div> : filteredYoutubeVideos.length ? filteredYoutubeVideos.map((video) => <button className={selectedVideoId === video.id ? "video-option selected" : "video-option"} type="button" key={video.id} onClick={() => setSelectedVideoId(video.id)} aria-pressed={selectedVideoId === video.id}>
              <span className="video-option-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={video.thumbnailUrl} alt="" />
                {selectedVideoId === video.id && <i>✓</i>}
              </span>
              <strong>{video.title}</strong><small>{formatViews(video.views)} views <span className={`video-visibility ${video.privacyStatus}`}>{video.privacyStatus}</span></small>
            </button>) : <div className="video-picker-state">No matching videos found.</div>}
          </div>
          <footer>
            {selectedVideoNeedsCaptionAccess && <p>Reconnect once to analyze this video through its owner captions.</p>}
            <button className="video-cancel" type="button" onClick={() => setVideoPickerOpen(false)}>Cancel</button>
            <button className="video-continue" type="button" onClick={attachSelectedYouTubeVideo} disabled={!selectedVideoId}>{selectedVideoNeedsCaptionAccess ? "Enable private analysis" : "Add video"}</button>
          </footer>
        </section>
      </div>}

      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
