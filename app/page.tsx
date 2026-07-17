"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Check, ChevronDown, ChevronRight, Clock3, Copy as CopyIcon, Download, ExternalLink, Eye, Facebook, FileText, Globe2, Image as ImageIcon, Instagram, LayoutDashboard, LogOut, MessageCircle, Minus, PanelLeftClose, PanelLeftOpen, Puzzle, RefreshCw, Sparkles, SquarePen, ThumbsDown, ThumbsUp, Timer, Users, Video, WandSparkles, X } from "lucide-react";

type CreationMode = "auto" | "idea" | "title" | "thumbnail";
type WorkspaceView = "dashboard" | "create";

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
  }>;
  traffic: Array<{ source: string; views: number; watchMinutes: number }>;
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

const NAV_ITEMS: Array<{ icon: string; label: string; view?: WorkspaceView }> = [
  { icon: "dashboard", label: "Dashboard", view: "dashboard" },
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

function YouTubeAvatar({ profile, alt = "" }: { profile: YouTubeProfile; alt?: string }) {
  const sourceKey = `${profile.id}:${profile.thumbnailUrl}:${profile.analyzedAt}`;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = failedSource === sourceKey;
  const initial = profile.title.trim().charAt(0).toUpperCase() || "Y";
  if (!profile.thumbnailUrl || failed) {
    return <span className="youtube-avatar-fallback" role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>{initial}</span>;
  }
  return <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`/api/youtube/avatar?v=${encodeURIComponent(profile.analyzedAt)}`} alt={alt} onError={() => setFailedSource(sourceKey)} />
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
  onSkip,
}: {
  step: Exclude<OnboardingStep, "loading" | "done">;
  direction: OnboardingDirection;
  error: string;
  configured: boolean;
  profile: YouTubeProfile | null;
  onContinue: () => void;
  onBack: () => void;
  onConnect: () => void;
  onSkip: () => void;
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
            <p className="onboarding-label startup-label"><Sparkles aria-hidden="true" /> Your YouTube creative sidekick</p>
            <h1>Hey, meet <span className="startup-name">Stanley.</span></h1>
            <p className="onboarding-copy">Bring the rough idea. Stanley finds the angle, pressure-tests what people want to watch, and helps you shape a video you can actually make.</p>
            <button className="onboarding-primary" type="button" onClick={onContinue}>Show me how <ChevronRight aria-hidden="true" /></button>
            <p className="onboarding-footnote startup-footnote"><span>Ideas</span><span>Research</span><span>Full video plans</span></p>
          </>}

          {step === "features" && <>
            <p className="onboarding-label feature-label"><Sparkles aria-hidden="true" /> Start messy. Stanley will organize it.</p>
            <h1>One chat.<br />Your whole video.</h1>
            <p className="onboarding-copy">Start with a rough thought, a weird angle, or a title that is not clicking yet.</p>
            <div className="feature-list">
              <article><span><OnboardingIcon name="ideas" /></span><div><h2>Find an idea worth making</h2><p>Use real YouTube patterns to find a sharper angle.</p></div></article>
              <article><span><OnboardingIcon name="build" /></span><div><h2>Build the full package</h2><p>Shape the title, thumbnail, hook, and script together.</p></div></article>
              <article><span><OnboardingIcon name="learn" /></span><div><h2>Keep it sounding like you</h2><p>Stanley remembers your channel, choices, and creative style.</p></div></article>
            </div>
            <div className="onboarding-actions"><button className="onboarding-back" type="button" onClick={onBack}>Back</button><button className="onboarding-primary" type="button" onClick={onContinue}>Connect my channel <ChevronRight aria-hidden="true" /></button></div>
          </>}

          {step === "connect" && <>
            <div className="onboarding-youtube-mark" aria-hidden="true"><YouTubeIcon /></div>
            <h1>Connect your YouTube account.</h1>
            <p className="onboarding-copy">Stanley reads your recent channel signals and uses what already worked to suggest sharper ideas, titles, and scripts. You can connect later.</p>
            <div className="connect-benefits"><span><Check aria-hidden="true" /> Topics your viewers come back for</span><span><Check aria-hidden="true" /> Videos that outperform your baseline</span><span><Check aria-hidden="true" /> Patterns in your strongest titles</span></div>
            {error && <p className="onboarding-error" role="alert">{error}</p>}
            {!configured && <p className="oauth-dev-note"><strong>Preview setup</strong><span>Private Google credentials are needed before connection can open.</span></p>}
            <div className="onboarding-connect-actions">
              <button className="onboarding-primary youtube-button" type="button" onClick={onConnect}><span className="youtube-button-icon"><YouTubeIcon /></span> Connect YouTube</button>
              <button className="onboarding-skip" type="button" onClick={onSkip}>Skip for now</button>
            </div>
            <button className="onboarding-back standalone" type="button" onClick={onBack}>Back</button>
          </>}

          {step === "analyzing" && <>
            <p className="onboarding-label"><span className="analysis-live-dot" /> Channel connected</p>
            <h1>Getting to know<br />{profile?.title || "your channel"}.</h1>
            <p className="onboarding-copy">Stanley is finding the signals that can make your next creative conversation more useful.</p>
            <div className="analysis-steps">
              <p><span>✓</span> Channel and recent videos found</p>
              <p><span className="analysis-dot" /> Comparing video performance</p>
              <p><span className="analysis-dot muted" /> Preparing your first recommendations</p>
            </div>
          </>}
        </div>
        <aside className="onboarding-visual-panel"><OnboardingVisual step={step} profile={profile} /></aside>
      </section>

      <footer className="onboarding-footer"><span>Built for YouTube creators</span><span>Your ideas stay private</span></footer>
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

function CreatorTwinPanel({
  profile,
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
  profile: YouTubeProfile;
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
    return <section className="dashboard-panel dashboard-creator-twin" aria-labelledby="creator-twin-heading">
      <div className="dashboard-panel-heading"><div><span className="dashboard-section-kicker">Compare your channel</span><h2 id="creator-twin-heading">Creator Twin</h2><p>Find a creator in your niche who is performing better.</p></div><span className="dashboard-twin-status"><i /> Premium</span></div>
      <div className="dashboard-twin-visual" aria-hidden="true">
        <span className="dashboard-twin-orbit orbit-one" />
        <span className="dashboard-twin-orbit orbit-two" />
        <span className="dashboard-twin-node node-one" />
        <span className="dashboard-twin-node node-two" />
        <span className="dashboard-twin-node node-three" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={profile.thumbnailUrl} alt="" />
        <span className="dashboard-twin-echo">✦</span>
      </div>
      <div className="dashboard-twin-placeholder"><span>Your niche comes first</span><strong>See what a stronger similar creator does better.</strong><p>We compare niche, topics, titles, video length, upload schedule, and views.</p><button type="button" onClick={() => { setResultView("overview"); onAnalyze(); }}><Sparkles aria-hidden="true" /> Find my Creator Twin</button></div>
    </section>;
  }

  const createPrompt = result ? [
    `Generate one original YouTube video idea inspired by the observable patterns from ${result.creator.name}.`,
    `Title pattern: ${result.inspirationContext.titlePattern}.`,
    `Thumbnail pattern: ${result.inspirationContext.thumbnailPattern}.`,
    `Story structure: ${result.inspirationContext.storyStructure}.`,
    `Publishing rhythm: ${result.inspirationContext.publishingRhythm}.`,
    `Content framework: ${result.inspirationContext.contentFramework}.`,
    "Do not copy an existing video, title, thumbnail, subject, or wording. Use the structure only as inspiration for a new idea that fits my channel.",
  ].join("\n") : "";
  const referenceVideo = result?.topVideos[0] ? {
    ...result.topVideos[0],
    privacyStatus: "public",
  } : undefined;
  const connectLinks = result ? (() => {
    const instagram = result.links.find((link) => link.platform === "instagram");
    const xLink = result.links.find((link) => link.platform === "x");
    const fallback = result.links.find((link) => ["tiktok", "facebook", "website"].includes(link.platform))
      || result.links.find((link) => link.platform === "youtube");
    return [instagram, xLink || fallback].filter((link, index, links): link is CreatorTwinResult["links"][number] => Boolean(link) && links.findIndex((item) => item?.url === link?.url) === index);
  })() : [];

  return <section className="dashboard-panel dashboard-creator-twin dashboard-creator-twin-expanded" aria-labelledby="creator-twin-heading">
    <div className="dashboard-panel-heading dashboard-twin-expanded-heading">
      <div><span className="dashboard-section-kicker">Compare your channel</span><h2 id="creator-twin-heading">Creator Twin</h2><p>{result ? `Using public YouTube information · ${result.cached ? "saved result" : "just checked"}` : "Scanning your niche for similar creators who are performing better."}</p></div>
      <div className="dashboard-twin-controls">
        {result && !loading ? <button type="button" onClick={() => { setResultView("overview"); onRefresh(); }} aria-label="Refresh Creator Twin"><RefreshCw aria-hidden="true" /> Refresh</button> : null}
        <button type="button" onClick={() => { setResultView("overview"); onClose(); }} aria-label="Close Creator Twin"><X aria-hidden="true" /></button>
      </div>
    </div>

    {loading ? <div className="dashboard-twin-scan" role="status" aria-live="polite">
      <div className="dashboard-twin-scan-card">
        <div className="dashboard-twin-scan-visual" aria-hidden="true">
          <span className="dashboard-twin-scan-ring ring-one" />
          <span className="dashboard-twin-scan-ring ring-two" />
          <span className="dashboard-twin-scan-source">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.thumbnailUrl} alt="" />
          </span>
          <span className="dashboard-twin-scan-beam" />
          <span className="dashboard-twin-scan-target">✦</span>
          <i className="dashboard-twin-scan-particle particle-one" />
          <i className="dashboard-twin-scan-particle particle-two" />
        </div>
        <div className="dashboard-twin-scan-copy">
          <span>Scanning your niche</span>
          <strong>Finding your Creator Twin</strong>
          <p>Looking for creators who make similar videos and are performing better.</p>
          <div className="dashboard-twin-scan-steps">
            {[
              ["Understanding your niche", "Topics repeated across your channel and recent videos"],
              ["Scanning stronger creators", "Similar channels earning more views per video"],
              ["Choosing the useful match", "Niche fit first, stronger performance second"],
            ].map(([step, detail], index) => <div key={step} style={{ "--scan-delay": `${index * 420}ms` } as React.CSSProperties}><span><Check aria-hidden="true" /></span><p><strong>{step}</strong><small>{detail}</small></p></div>)}
          </div>
          <footer><i /> Comparing niche fit and performance...</footer>
        </div>
      </div>
    </div> : error ? <div className="dashboard-twin-error" role="alert"><strong>Creator Twin could not finish.</strong><p>{error}</p><button type="button" onClick={onRefresh}><RefreshCw aria-hidden="true" /> Try again</button></div> : result ? <div className="dashboard-twin-results">
      <article className="dashboard-twin-profile-card">
        <div className="dashboard-twin-profile-main">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.creator.avatarUrl} alt={`${result.creator.name} channel avatar`} />
          <div><span>Your closest match</span><h3>{result.creator.name}</h3><p>{result.creator.primaryNiche}</p></div>
          <strong>{result.creator.similarity}%<small>similar</small></strong>
        </div>
        <dl className="dashboard-twin-profile-stats">
          <div><dt>Views per video</dt><dd>{formatDashboardCompact(result.creator.averageViews)}</dd></div>
          <div><dt>Their views compared with yours</dt><dd>{result.creator.recentMomentum}</dd></div>
          <div><dt>Videos that did much better than usual</dt><dd>{result.creator.outlierFrequency}</dd></div>
        </dl>
        <div className="dashboard-twin-profile-footer">
          <button type="button" aria-label="Make a new idea inspired by this creator" onClick={() => onCreate(createPrompt, referenceVideo)}><WandSparkles aria-hidden="true" /> Make a new idea from this</button>
          <a href={result.creator.channelUrl} target="_blank" rel="noreferrer">Open their channel <ExternalLink aria-hidden="true" /></a>
          {connectLinks.length ? <div className="dashboard-twin-connect"><span>Connect with them</span>{connectLinks.map((link) => <a key={link.platform} href={link.url} target="_blank" rel="noreferrer" aria-label={`${link.platform}: ${link.label}`} title={link.label}>
            {link.platform === "x" ? <b aria-hidden="true">𝕏</b> : link.platform === "instagram" ? <Instagram aria-hidden="true" /> : link.platform === "tiktok" ? <b aria-hidden="true">♪</b> : link.platform === "facebook" ? <Facebook aria-hidden="true" /> : link.platform === "youtube" ? <YouTubeIcon /> : <Globe2 aria-hidden="true" />}
          </a>)}</div> : null}
        </div>
      </article>

      <div className="dashboard-twin-result-tabs" role="tablist" aria-label="Creator Twin details">
        {(["overview", "differences", "videos"] as const).map((view) => <button key={view} type="button" role="tab" aria-selected={resultView === view} className={resultView === view ? "active" : ""} onClick={() => setResultView(view)}>
          {view === "overview" ? "Overview" : view === "differences" ? "Differences" : `Videos (${result.topVideos.length})`}
        </button>)}
      </div>

      <div className="dashboard-twin-result-view" role="tabpanel" key={resultView}>
        {resultView === "overview" ? <div className="dashboard-twin-overview-simple">
          <article className="dashboard-twin-match-card">
            <span className="dashboard-twin-block-label">Why Stanley chose this creator</span>
            <ul>{result.whyMatched.slice(0, 3).map((reason) => <li key={reason}><Check aria-hidden="true" />{reason}</li>)}</ul>
          </article>
          <article className="dashboard-twin-next-move">
            <span className="dashboard-twin-block-label">Best thing to try</span>
            <strong>{result.insights[0]?.what}</strong>
            <p>{result.insights[0]?.why}</p>
            <div><Sparkles aria-hidden="true" /><span><small>Try this</small>{result.insights[0]?.adapt}</span></div>
          </article>
        </div> : null}

        {resultView === "differences" ? <div className="dashboard-twin-detail-grid">
          <article className="dashboard-twin-block dashboard-twin-differences">
            <span className="dashboard-twin-block-label">What works better for them</span>
            <div>{result.differences.map((difference) => <section key={`${difference.category}-${difference.detail}`}><header><strong>{difference.category}</strong><span>{difference.detail}</span></header><dl><div><dt>{result.creator.name}</dt><dd>{difference.twin}</dd></div><div><dt>You</dt><dd>{difference.you}</dd></div></dl></section>)}</div>
          </article>
          <article className="dashboard-twin-block dashboard-twin-insights">
            <span className="dashboard-twin-block-label">What you can try</span>
            <ol>{result.insights.map((insight, index) => <li key={insight.what}><i>{index + 1}</i><div><strong>{insight.what}</strong><p>{insight.why}</p><span>{insight.adapt}</span></div></li>)}</ol>
          </article>
        </div> : null}

        {resultView === "videos" ? <article className="dashboard-twin-block dashboard-twin-content">
          <div className="dashboard-twin-content-heading"><div><span className="dashboard-twin-block-label">Best videos</span><h3>Videos you can learn from</h3></div></div>
          <div className="dashboard-twin-video-grid">{result.topVideos.map((video) => {
            const option: YouTubeVideoOption = { ...video, privacyStatus: "public" };
            return <article key={video.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={video.thumbnailUrl} alt="" />
              <div><strong>{video.title}</strong><p>{formatDashboardCompact(video.views)} views · {video.outlierScore.toFixed(1)}× their usual views · {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(video.publishedAt))}</p><button type="button" onClick={() => onStudy(option)}>Learn from this video <ArrowUpRight aria-hidden="true" /></button></div>
            </article>;
          })}</div>
        </article> : null}
      </div>
    </div> : null}
  </section>;
}

function ChannelDashboard({
  active,
  status,
  videos,
  loading,
  error,
  onConnect,
  onCreate,
  onCreateFromPattern,
  onUseVideo,
  onRefresh,
}: {
  active: boolean;
  status: YouTubeStatus;
  videos: YouTubeVideoOption[];
  loading: boolean;
  error: string;
  onConnect: () => void;
  onCreate: () => void;
  onCreateFromPattern: (prompt: string, video?: YouTubeVideoOption) => void;
  onUseVideo: (video: YouTubeVideoOption) => void;
  onRefresh: () => void;
}) {
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [chartMetric, setChartMetric] = useState<DashboardChartMetric>("views");
  const [dashboardRange, setDashboardRange] = useState<DashboardRange>(30);
  const [uploadView, setUploadView] = useState<"top" | "latest">("top");
  const [discoveryView, setDiscoveryView] = useState<"traffic" | "audience" | "reach">("traffic");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [creatorTwinExpanded, setCreatorTwinExpanded] = useState(false);
  const [creatorTwinLoading, setCreatorTwinLoading] = useState(false);
  const [creatorTwinError, setCreatorTwinError] = useState("");
  const [creatorTwin, setCreatorTwin] = useState<CreatorTwinResult | null>(null);
  const profile = status.profile;
  const compare = true;

  useEffect(() => {
    if (!status.connected || !profile) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ range: String(dashboardRange), compare: "true" });

    async function loadAnalytics() {
      setAnalyticsLoading(true);
      setAnalyticsError("");
      try {
        const response = await fetch(`/api/youtube/analytics?${params}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json() as DashboardAnalytics & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Your YouTube numbers could not be loaded.");
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
  }, [dashboardRange, profile, refreshVersion, status.connected]);

  async function analyzeCreatorTwin(force = false) {
    setCreatorTwinExpanded(true);
    setCreatorTwinLoading(true);
    setCreatorTwinError("");
    const startedAt = Date.now();
    const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      const response = await fetch(`/api/youtube/creator-twin${force ? "?refresh=true" : ""}`, { cache: "no-store" });
      const payload = await response.json() as CreatorTwinResult & { error?: string };
      const remaining = reducedMotion ? 0 : Math.max(0, 2000 - (Date.now() - startedAt));
      if (remaining) await new Promise((resolve) => window.setTimeout(resolve, remaining));
      if (!response.ok) throw new Error(payload.error || "Creator Twin could not be calculated.");
      setCreatorTwin(payload);
    } catch (caught) {
      setCreatorTwinError(caught instanceof Error ? caught.message : "Creator Twin could not be calculated.");
    } finally {
      setCreatorTwinLoading(false);
    }
  }

  if (!status.connected || !profile) {
    return <section className={`dashboard-scroll-region${active ? " dashboard-is-active" : " dashboard-is-inactive"}`} aria-hidden={active ? undefined : true} inert={active ? undefined : true}>
      <div className="dashboard-shell dashboard-empty">
        <div className="dashboard-empty-mark"><YouTubeIcon /></div>
        <p>Channel dashboard</p>
        <h1>See what is working on your channel.</h1>
        <span>Connect your channel to see your views, watch time, recent videos, and simple ideas for what to make next.</span>
        <button type="button" onClick={onConnect}><YouTubeIcon /> Connect YouTube</button>
      </div>
    </section>;
  }

  const refresh = () => {
    onRefresh();
    setRefreshVersion((version) => version + 1);
  };
  const current = analytics?.current || null;
  const comparison = analytics?.comparison || null;
  const currentNet = netSubscribers(current);
  const comparisonNet = netSubscribers(comparison);
  const metricCards = [
    { label: "Views", value: current?.views ?? null, previous: comparison?.views ?? null, formatter: formatDashboardCompact, icon: <Eye aria-hidden="true" /> },
    { label: "Subscribers gained", value: currentNet, previous: comparisonNet, formatter: formatDashboardNet, icon: <Users aria-hidden="true" /> },
    { label: "Average watch time", value: current?.averageViewDuration ?? null, previous: comparison?.averageViewDuration ?? null, formatter: formatDashboardDuration, icon: <Timer aria-hidden="true" /> },
  ];
  const videoById = new Map(videos.map((video) => [video.id, video]));
  const topVideos = (analytics?.videos || []).slice(0, 5).map((performance) => ({
    ...performance,
    video: videoById.get(performance.id),
  }));
  const recentUploads = [...videos]
    .filter((video) => video.privacyStatus === "public")
    .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())
    .slice(0, 6);
  const geometry = chartGeometry(analytics?.timeline || [], compare ? analytics?.comparisonTimeline || [] : [], chartMetric);
  const labelIndexes = analytics?.timeline.length
    ? Array.from(new Set([0, Math.floor((analytics.timeline.length - 1) / 2), analytics.timeline.length - 1]))
    : [];
  const trafficTotal = (analytics?.traffic || []).reduce((sum, source) => sum + source.views, 0);
  const traffic = (analytics?.traffic || []).slice(0, 6);
  const audienceStats = [
    { label: "People who came back", value: "61.8%", detail: "8.8M people", tone: "primary" },
    { label: "First-time viewers", value: "38.2%", detail: "5.4M people", tone: "secondary" },
    { label: "Watch time from subscribers", value: "72.4%", detail: "+4.8% from the time before", tone: "positive" },
    { label: "People watching on phones", value: "68.1%", detail: "9.7M people", tone: "neutral" },
  ];
  const reachStats = [
    { label: "Times YouTube showed a thumbnail", value: "86.4M", detail: "12.6% more than before" },
    { label: "People who clicked after seeing it", value: "7.8%", detail: "0.9 more clicks for every 100 times shown" },
    { label: "Different people who watched", value: "14.2M", detail: "8.4% more than before" },
    { label: "Average views per person", value: "2.65", detail: "0.18 more than before" },
  ];
  const reachBars = [42, 58, 51, 66, 61, 74, 69, 88, 80, 96, 86, 92];
  const viewChange = percentDelta(current?.views ?? null, comparison?.views ?? null);
  const patternExamples = topVideos.filter((item) => item.video).slice(0, 3);
  const patternViews = patternExamples.reduce((sum, item) => sum + (item.views || 0), 0);
  const patternShare = current?.views ? (patternViews / current.views) * 100 : null;
  const growthTone = viewChange === null || Math.abs(viewChange) < 1 ? "neutral" : viewChange > 0 ? "positive" : "negative";
  const growthLabel = growthTone === "positive" ? "Growing" : growthTone === "negative" ? "Slowing down" : "Staying steady";
  const growthDetail = viewChange === null ? "Nothing to compare with yet" : `${viewChange >= 0 ? "+" : "−"}${Math.abs(viewChange).toFixed(1)}% views`;
  const averageViewed = current?.averageViewPercentage ?? null;
  const attentionTone = averageViewed === null ? "neutral" : averageViewed >= 40 ? "positive" : averageViewed >= 30 ? "neutral" : "negative";
  const attentionLabel = averageViewed === null ? "No data" : averageViewed >= 40 ? "Strong" : averageViewed >= 30 ? "Okay" : "Could improve";
  const attentionDetail = averageViewed === null
    ? "Watch data is not available"
    : `People watched ${formatDashboardPercent(averageViewed)} on average · ${formatDashboardDuration(current?.averageViewDuration ?? 0)} per view`;
  const packagingTone = patternExamples.length >= 2 ? "positive" : "neutral";
  const packagingLabel = patternExamples.length >= 2 ? "Clear pattern" : "Too early";
  const packagingDetail = patternExamples.length >= 2 ? `${patternExamples.length} top videos use a similar style` : "More top videos needed";
  const performanceSignals = [
    { label: "Views", value: growthLabel, detail: growthDetail, tone: growthTone },
    { label: "Titles and thumbnails", value: packagingLabel, detail: packagingDetail, tone: packagingTone },
    { label: "People keep watching", value: attentionLabel, detail: attentionDetail, tone: attentionTone },
  ];
  const titleFormat = "Starts with what happened: “I tried…”, “I tested…”, or “I swapped…”";
  const thumbnailFormat = "One main person or object with an easy-to-see comparison";
  const videoFormat = "One challenge or test with a clear result";
  const exampleTitles = patternExamples.map((item) => item.video?.title).filter((title): title is string => Boolean(title));
  const patternPrompt = [
    `Give ${profile.title} one original YouTube video idea based on what is working in this dashboard.`,
    `Title: ${titleFormat}.`,
    `Thumbnail: ${thumbnailFormat}.`,
    `Video: ${videoFormat}.`,
    exampleTitles.length ? `Relevant examples: ${exampleTitles.map((title) => `“${title}”`).join("; ")}.` : "",
    "Use the same easy-to-understand structure with a new topic. Do not copy an old video. Give me the idea, title, thumbnail, opening, and one short reason it fits this channel.",
  ].filter(Boolean).join("\n");
  const lastUpdated = analytics?.updatedAt || profile.analyzedAt;
  const isBusy = loading || analyticsLoading;
  const visibleError = analyticsError || error;
  const dashboardRanges: Array<{ value: DashboardRange; label: string }> = [
    { value: 7, label: "Last 7 days" },
    { value: 30, label: "Last 30 days" },
    { value: 90, label: "Last 90 days" },
    { value: 180, label: "Last 6 months" },
    { value: 365, label: "Last year" },
  ];

  return <section className={`dashboard-scroll-region${active ? " dashboard-is-active" : " dashboard-is-inactive"}`} aria-hidden={active ? undefined : true} inert={active ? undefined : true}>
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div className="dashboard-channel">
          <YouTubeAvatar profile={profile} alt={`${profile.title} channel avatar`} />
          <div className="dashboard-channel-copy">
            <div className="dashboard-channel-title"><h1>{profile.title}</h1><span aria-label="Connected channel">✓</span></div>
            <div className="dashboard-channel-meta">
              <span><YouTubeIcon /><b>{formatDashboardCompact(profile.videoCount)}</b> videos</span>
              <span><Users aria-hidden="true" /><b>{formatDashboardCompact(profile.subscriberCount)}</b> subscribers</span>
              <span><Eye aria-hidden="true" /><b>{formatDashboardCompact(profile.totalViews)}</b> total views</span>
              <small>{analytics?.channel.handle || "Connected channel"} · Updated {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(lastUpdated))}</small>
            </div>
          </div>
          <div className={`dashboard-range-menu${analyticsLoading ? " is-updating" : ""}`} aria-busy={analyticsLoading || undefined}>
            <Clock3 aria-hidden="true" />
            <label htmlFor="dashboard-range-select">Show results from</label>
            <span>
              <select id="dashboard-range-select" aria-label="Show results from" value={dashboardRange} onChange={(event) => setDashboardRange(Number(event.target.value) as DashboardRange)}>
                {dashboardRanges.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <ChevronDown aria-hidden="true" />
            </span>
          </div>
        </div>
      </header>

      {visibleError && !isBusy ? <div className="dashboard-data-error"><span>{visibleError}</span><button type="button" onClick={refresh}>Try again</button></div> : null}

      <section className="dashboard-metrics" aria-label="Main channel numbers">
        {metricCards.map((metric, index) => {
          const change = compare ? percentDelta(metric.value, metric.previous) : null;
          const direction = change === null || Math.abs(change) < 0.05 ? "flat" : change > 0 ? "up" : "down";
          return <article key={metric.label} style={{ "--metric-delay": `${index * 55}ms` } as React.CSSProperties}>
            <div className="dashboard-metric-label">{metric.icon}<span>{metric.label}</span></div>
            <div className="dashboard-metric-value">
              <strong>{analyticsLoading && !analytics ? "—" : <AnimatedMetric value={metric.value} formatter={metric.formatter} />}</strong>
              <div className={`dashboard-metric-change ${direction}`}>
                {direction === "up" ? <ArrowUpRight aria-hidden="true" /> : direction === "down" ? <ArrowDownRight aria-hidden="true" /> : <Minus aria-hidden="true" />}
                <span>{!compare ? "Off" : change === null ? metric.previous === 0 && metric.value !== null && metric.value > 0 ? "New" : "—" : `${Math.abs(change).toFixed(1)}%`}</span>
              </div>
            </div>
            <small>{compare && analytics?.comparisonPeriod ? `compared with the ${analytics.comparisonPeriod.days} days before` : analytics ? `${formatTime(`${analytics.period.startDate}T00:00:00Z`)} – ${formatTime(`${analytics.period.endDate}T00:00:00Z`)}` : "Loading dates"}</small>
          </article>;
        })}
      </section>

      <section className="dashboard-panel dashboard-performance" aria-labelledby="performance-heading">
        <div className="dashboard-panel-heading">
          <div><span className="dashboard-section-kicker">How your channel is doing</span><h2 id="performance-heading">Your channel is {growthLabel.toLocaleLowerCase()}</h2><p>{viewChange === null ? growthDetail : `${growthDetail} compared with the time before`}.</p></div>
          <div className="dashboard-chart-tabs" aria-label="Chart metric">
            <button type="button" className={chartMetric === "views" ? "active" : ""} onClick={() => setChartMetric("views")}>Views</button>
            <button type="button" className={chartMetric === "watchMinutes" ? "active" : ""} onClick={() => setChartMetric("watchMinutes")}>Time watched</button>
            <button type="button" className={chartMetric === "netSubscribers" ? "active" : ""} onClick={() => setChartMetric("netSubscribers")}>Subscribers</button>
          </div>
        </div>
        <div className="dashboard-signal-strip" aria-label="Quick channel summary">
          {performanceSignals.map((signal, index) => <article className={`dashboard-signal ${signal.tone}`} key={signal.label} style={{ "--signal-delay": `${index * 80}ms` } as React.CSSProperties}>
            <span><i />{signal.label}</span><strong>{signal.value}</strong><small>{signal.detail}</small>
          </article>)}
        </div>
        {analyticsLoading && !analytics ? <div className="dashboard-chart-loading"><i /><i /><i /><i /><i /><i /><i /></div> : analytics?.timeline.length ? <div className="dashboard-chart-canvas">
          <div className="dashboard-chart-legend"><span><i className="current" /> Selected dates</span>{compare && analytics.comparison ? <span><i className="previous" /> Time before</span> : null}</div>
          <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="img" aria-label={`${chartMetric === "views" ? "Views" : chartMetric === "watchMinutes" ? "Time watched" : "Subscribers gained"} over the selected dates`} preserveAspectRatio="none">
            {[0, 0.5, 1].map((position) => {
              const value = geometry.maximum - (geometry.maximum - geometry.minimum) * position;
              const lineY = geometry.y(value);
              return <g key={position}><line className="dashboard-chart-grid" x1="14" x2="908" y1={lineY} y2={lineY} /><text x="16" y={Math.max(12, lineY - 6)}>{chartValue(value, chartMetric)}</text></g>;
            })}
            {geometry.fillPath ? <path className="dashboard-chart-area" d={geometry.fillPath} key={`area-${chartMetric}`} /> : null}
            {geometry.comparisonPath ? <path className="dashboard-chart-line previous" d={geometry.comparisonPath} key={`previous-${chartMetric}`} /> : null}
            {geometry.currentPath ? <path className="dashboard-chart-line current" d={geometry.currentPath} key={`current-${chartMetric}`} /> : null}
            {labelIndexes.map((index) => {
              const point = analytics.timeline[index];
              return <text className="dashboard-chart-date" key={point.date} x={geometry.x(index, analytics.timeline.length)} y={geometry.height - 8} textAnchor={index === 0 ? "start" : index === analytics.timeline.length - 1 ? "end" : "middle"}>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${point.date}T00:00:00Z`))}</text>;
            })}
          </svg>
        </div> : <p className="dashboard-no-data">There is no YouTube data for these dates yet.</p>}
      </section>

      <div className={`dashboard-insight-grid${creatorTwinExpanded ? " twin-expanded" : ""}`}>
        <section className="dashboard-panel dashboard-top-videos" aria-labelledby="top-videos-heading" aria-hidden={creatorTwinExpanded || undefined} inert={creatorTwinExpanded || undefined}>
          <div className="dashboard-panel-heading dashboard-upload-heading">
            <div><span className="dashboard-section-kicker">Your videos</span><h2 id="top-videos-heading">{uploadView === "top" ? "Top videos" : "Latest videos"}</h2><p>{uploadView === "top" ? patternShare === null ? "Your strongest videos right now." : `${patternShare.toFixed(1)}% of your views came from these videos.` : `${recentUploads.length} newest videos that anyone can watch.`}</p></div>
            <div className="dashboard-upload-tabs" role="tablist" aria-label="Choose which videos to see">
              <button type="button" role="tab" aria-selected={uploadView === "top"} className={uploadView === "top" ? "active" : ""} onClick={() => setUploadView("top")}>Top videos</button>
              <button type="button" role="tab" aria-selected={uploadView === "latest"} className={uploadView === "latest" ? "active" : ""} onClick={() => setUploadView("latest")}>Latest videos</button>
            </div>
          </div>
          <div className="dashboard-upload-switch" key={uploadView} role="tabpanel">
            {uploadView === "top" ? <>
              <div className="dashboard-pattern-primary">
                <span>What your best videos have in common</span>
                <strong>Your top videos make one simple promise in the title and show one clear idea in the thumbnail.</strong>
              </div>
              <dl className="dashboard-pattern-breakdown">
                <div><dt>Title style</dt><dd>{titleFormat}</dd></div>
                <div><dt>Thumbnail style</dt><dd>{thumbnailFormat}</dd></div>
                <div><dt>Video idea</dt><dd>{videoFormat}</dd></div>
              </dl>
              {patternExamples.length ? <>
                <span className="dashboard-pattern-evidence-label">Examples from your channel</span>
                <div className="dashboard-pattern-evidence" aria-label="High-performing examples">
                  {patternExamples.map((item, index) => item.video && <button type="button" key={item.id} onClick={() => onUseVideo(item.video!)} style={{ "--upload-delay": `${index * 70}ms` } as React.CSSProperties}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.video.thumbnailUrl} alt="" />
                    <span><strong>{item.video.title}</strong><small>{item.views === null ? "View data is not available" : `${formatDashboardCompact(item.views)} views${current?.views ? ` · ${((item.views / current.views) * 100).toFixed(1)}% of your views` : ""}`}</small></span>
                    <ArrowUpRight aria-hidden="true" />
                  </button>)}
                </div>
              </> : null}
              <button className="dashboard-pattern-action" type="button" onClick={() => onCreateFromPattern(patternPrompt, patternExamples[0]?.video)}><WandSparkles aria-hidden="true" /> Make a new idea with this style</button>
            </> : recentUploads.length ? <div className="dashboard-latest-video-list" aria-label="Latest public uploads">
              {recentUploads.slice(0, 5).map((video, index) => <button type="button" className="dashboard-latest-video" key={video.id} onClick={() => onUseVideo(video)} style={{ "--upload-delay": `${index * 55}ms` } as React.CSSProperties}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className="dashboard-latest-video-thumb"><img src={video.thumbnailUrl} alt="" /><i>{String(index + 1).padStart(2, "0")}</i></span>
                <span><strong>{video.title}</strong><small>{formatDashboardCompact(video.views)} views since it was posted · {formatTime(video.publishedAt)}</small></span>
                <ArrowUpRight aria-hidden="true" />
              </button>)}
            </div> : <p className="dashboard-no-data">No public uploads are available yet.</p>}
          </div>
        </section>

        <CreatorTwinPanel
          profile={profile}
          expanded={creatorTwinExpanded}
          loading={creatorTwinLoading}
          error={creatorTwinError}
          result={creatorTwin}
          onAnalyze={() => void analyzeCreatorTwin()}
          onRefresh={() => void analyzeCreatorTwin(true)}
          onClose={() => setCreatorTwinExpanded(false)}
          onCreate={onCreateFromPattern}
          onStudy={onUseVideo}
        />
      </div>

      <section className="dashboard-panel dashboard-traffic" aria-labelledby="discovery-heading">
        <div className="dashboard-panel-heading dashboard-discovery-heading">
          <div><span className="dashboard-section-kicker">How people find you <i>{discoveryView === "traffic" ? "YouTube data" : "Example only"}</i></span><h2 id="discovery-heading">{discoveryView === "traffic" ? "Where viewers found you" : discoveryView === "audience" ? "Who watches your videos" : "How often YouTube shows your videos"}</h2><p>{discoveryView === "traffic" ? `${formatDashboardCompact(trafficTotal)} views, grouped by where they came from` : discoveryView === "audience" ? "See who is new and who came back. These numbers are examples for now." : "See how often thumbnails were shown and how many people clicked. These numbers are examples for now."}</p></div>
          <div className="dashboard-upload-tabs dashboard-discovery-tabs" role="tablist" aria-label="Ways to understand your viewers">
            <button type="button" role="tab" aria-selected={discoveryView === "traffic"} className={discoveryView === "traffic" ? "active" : ""} onClick={() => setDiscoveryView("traffic")}>Where views came from</button>
            <button type="button" role="tab" aria-selected={discoveryView === "audience"} className={discoveryView === "audience" ? "active" : ""} onClick={() => setDiscoveryView("audience")}>Viewers</button>
            <button type="button" role="tab" aria-selected={discoveryView === "reach"} className={discoveryView === "reach" ? "active" : ""} onClick={() => setDiscoveryView("reach")}>Shown and clicked</button>
          </div>
        </div>
        <div className="dashboard-discovery-switch" key={discoveryView} role="tabpanel">
          {discoveryView === "traffic" ? <div className="dashboard-traffic-list">
            {traffic.map((source, index) => {
              const share = trafficTotal ? (source.views / trafficTotal) * 100 : 0;
              return <article key={source.source} style={{ "--traffic-delay": `${index * 60}ms` } as React.CSSProperties}>
                <div><strong>{dashboardTrafficLabel(source.source)}</strong><span>{formatDashboardCompact(source.views)} views</span></div>
                <span className="dashboard-traffic-track"><i style={{ "--traffic-size": `${Math.max(2, share)}%` } as React.CSSProperties} /></span>
                <b>{share.toFixed(1)}%</b>
              </article>;
            })}
            {!traffic.length && !analyticsLoading ? <p className="dashboard-no-data">YouTube does not have information about where these views came from for these dates.</p> : null}
          </div> : discoveryView === "audience" ? <div className="dashboard-audience-layout">
            <div className="dashboard-audience-chart" aria-label="61.8 percent of people came back"><div><strong>61.8%</strong><span>came back</span></div></div>
            <div className="dashboard-audience-stats">
              {audienceStats.map((stat, index) => <article className={stat.tone} key={stat.label} style={{ "--discovery-delay": `${index * 65}ms` } as React.CSSProperties}><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.detail}</small></article>)}
            </div>
            <div className="dashboard-audience-split"><span><i className="returning" /> People who came back</span><span><i className="new" /> First-time viewers</span><b>More people are coming back</b></div>
          </div> : <div className="dashboard-reach-layout">
            <div className="dashboard-reach-metrics">
              {reachStats.map((stat, index) => <article key={stat.label} style={{ "--discovery-delay": `${index * 65}ms` } as React.CSSProperties}><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.detail}</small></article>)}
            </div>
            <div className="dashboard-reach-chart" aria-label="How often thumbnails were shown over twelve weeks">
              <div className="dashboard-reach-chart-head"><span>How often thumbnails were shown</span><strong>Past 12 weeks</strong></div>
              <div className="dashboard-reach-bars">{reachBars.map((height, index) => <i key={`${height}-${index}`} style={{ "--reach-height": `${height}%`, "--reach-delay": `${index * 38}ms` } as React.CSSProperties} />)}</div>
              <div className="dashboard-reach-axis"><span>Apr 28</span><span>Jun 9</span><span>Jul 14</span></div>
            </div>
          </div>
          }
        </div>
      </section>

      <aside className="dashboard-summary" aria-labelledby="stanley-summary-heading">
        <div className="dashboard-summary-mascot" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/stanley-mascot-transparent.png" alt="" />
          <i className="spark-one">✦</i><i className="spark-two">✦</i>
        </div>
        <div className="dashboard-summary-content"><span className="dashboard-section-kicker">What to do next</span><h2 id="stanley-summary-heading">Try one small change</h2><p>Keep what works and change just one thing.</p></div>
        <button className="dashboard-summary-action" type="button" onClick={onCreate}><WandSparkles aria-hidden="true" /> Plan next video <ArrowUpRight aria-hidden="true" /></button>
      </aside>
    </div>
  </section>;
}

export default function Home() {
  const topicRef = useRef<HTMLTextAreaElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const latestAssistantRef = useRef<HTMLElement>(null);
  const latestScriptRef = useRef<HTMLElement>(null);
  const replyRunRef = useRef(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const attachmentButtonRef = useRef<HTMLButtonElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const dashboardVideosRequestedRef = useRef(false);
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
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<WorkspaceView>("create");

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
    let active = true;
    let analysisTimer: number | undefined;
    const draftsTimer = window.setTimeout(() => setDrafts(readDrafts()), 0);
    const sidebarTimer = window.setTimeout(() => setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "true"), 0);

    async function initialize() {
      const params = new URLSearchParams(window.location.search);
      const result = params.get("youtube");
      const replayOnboarding = params.get("onboarding") === "1";
      const savedOnboarding = window.localStorage.getItem(ONBOARDING_KEY);
      let status: YouTubeStatus = { configured: false, connected: false, profile: null };
      try {
        const response = await fetch("/api/youtube/status", { cache: "no-store" });
        if (response.ok) status = await response.json() as YouTubeStatus;
      } catch {
        // The generic Stanley experience still works if Google is temporarily unavailable.
      }
      if (!active) return;
      setYouTubeStatus(status);

      if (replayOnboarding) {
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
        if (savedOnboarding) {
          setNotice(resultMessage);
          setOnboardingStep("done");
        } else {
          setOnboardingStep("connect");
        }
      } else {
        setOnboardingStep(savedOnboarding ? "done" : "welcome");
      }
      document.documentElement.dataset.stanleyReady = "true";
    }

    void initialize();
    return () => {
      active = false;
      window.clearTimeout(draftsTimer);
      window.clearTimeout(sidebarTimer);
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
        const response = await fetch("/api/youtube/videos", { cache: "no-store", signal: controller.signal });
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

  function openDraft(draft: Draft) {
    replyRunRef.current += 1;
    setUploadedVideoCache(new Map());
    setActiveView("create");
    setSessionId(draft.id);
    setOriginalTopic(draft.topic);
    setMessages(restoreMessages(draft));
    setActiveActivity([]);
    setLoading(false);
    setTopic("");
    setAttachments([]);
    setAttachmentMenuOpen(false);
    setMode("auto");
    setError("");
    window.setTimeout(() => topicRef.current?.focus(), 250);
  }

  function startNewChat() {
    replyRunRef.current += 1;
    setUploadedVideoCache(new Map());
    setActiveView("create");
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
    window.location.assign("/api/youtube/connect?returnTo=/");
  }

  async function disconnectYouTube() {
    const previousStatus = youtubeStatus;
    setYouTubeStatus((current) => ({ ...current, connected: false, profile: null }));
    try {
      const response = await fetch("/api/youtube/disconnect", { method: "POST" });
      if (!response.ok) throw new Error("YouTube disconnect failed");
      setYouTubeVideos([]);
      setAttachments((current) => current.filter((attachment) => attachment.kind !== "youtube"));
    } catch {
      setYouTubeStatus(previousStatus);
    }
  }

  function skipOnboarding() {
    window.localStorage.setItem(ONBOARDING_KEY, "skipped");
    setActiveView("create");
    setOnboardingStep("done");
    window.setTimeout(() => topicRef.current?.focus(), 0);
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
      const response = await fetch("/api/youtube/videos", { cache: "no-store" });
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
      setActiveView(item.view);
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
    if (!youtubeStatus.connected) return;
    dashboardVideosRequestedRef.current = true;
    setVideosLoading(true);
    setVideosError("");
    try {
      const response = await fetch("/api/youtube/videos", { cache: "no-store" });
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
  if (onboardingStep !== "done") {
    return <Onboarding
      step={onboardingStep}
      direction={onboardingDirection}
      error={youtubeError}
      configured={youtubeStatus.configured}
      profile={youtubeStatus.profile}
      onContinue={continueOnboarding}
      onBack={backOnboarding}
      onConnect={connectYouTube}
      onSkip={skipOnboarding}
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

        <button className="sidebar-new-chat-button" type="button" onClick={startNewChat} title={sidebarCollapsed ? "New chat" : undefined}><NewChatIcon /><span>New chat</span></button>

        <nav aria-label="Stanley tools">
          {NAV_ITEMS.map((item) => {
            const active = item.view === activeView;
            return (
            <div className={active ? "nav-item active" : "nav-item"} data-label={item.label} key={item.label}>
              <button className="nav-tool-button" type="button" onClick={() => openTool(item)} aria-current={active ? "page" : undefined}>
                <span className="nav-icon" aria-hidden="true"><ToolIcon name={item.icon} /></span>
                <span>{item.label}</span>
              </button>
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
          <div><strong>{youtubeStatus.profile.title}</strong><small>YouTube connected</small></div>
        </div>}
      </aside>

      <section className="main-panel">
        <header className="main-header">
          <span className="header-balance" />
          {youtubeStatus.connected && youtubeStatus.profile ? <div className="channel-connection" title={`${youtubeStatus.profile.title} is connected`}>
            <YouTubeAvatar profile={youtubeStatus.profile} />
            <span className="channel-copy"><strong>{youtubeStatus.profile.title}</strong><small><i /> Connected channel</small></span>
            <button className="channel-disconnect" type="button" onClick={() => void disconnectYouTube()} title={`Disconnect ${youtubeStatus.profile.title}`} aria-label={`Disconnect ${youtubeStatus.profile.title}`}><LogOut aria-hidden="true" /></button>
          </div> : <button className="youtube-connect-header" type="button" onClick={connectYouTube}><YouTubeIcon /><span>Connect YouTube</span></button>}
          <div className="header-actions">
            {activeView === "create" && sessionId && <button className="debug-session" type="button" onClick={copySessionId} title={`Copy session ID: ${sessionId}`} aria-label="Copy session ID"><DebugIcon /><span>Debug</span><code>{sessionId.slice(0, 8)}</code></button>}
          </div>
        </header>

        <ChannelDashboard
          active={activeView === "dashboard"}
          status={youtubeStatus}
          videos={youtubeVideos}
          loading={videosLoading}
          error={videosError}
          onConnect={connectYouTube}
          onCreate={() => startDashboardPrompt("Analyze my channel and give me three strong video ideas for my next upload")}
          onCreateFromPattern={(prompt, video) => startDashboardPrompt(prompt, video)}
          onUseVideo={(video) => startDashboardPrompt(`Analyze this upload and help me build a stronger follow-up video: ${video.title}`, video)}
          onRefresh={() => void refreshDashboard()}
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
