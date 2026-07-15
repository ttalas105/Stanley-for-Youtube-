"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronRight, Eye, FileText, LayoutDashboard, LogOut, MessageCircle, PanelLeftClose, PanelLeftOpen, Puzzle, RefreshCw, Sparkles, SquarePen, TrendingUp, Users, Video, WandSparkles } from "lucide-react";

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

type ThumbnailConcept = {
  id: string;
  concept: string;
  visual: string;
  textOverlay: string;
  whyItWorks: string;
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
  thumbnails?: ThumbnailConcept[];
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
  thumbnails?: ThumbnailConcept[];
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
const STANLEY_LOGO = "https://stanbrandhub.lovable.app/downloads/Stanley_Logo_Lockup_Dark.png";

const NAV_ITEMS: Array<{ icon: string; label: string; view?: WorkspaceView }> = [
  { icon: "dashboard", label: "Dashboard", view: "dashboard" },
  { icon: "outlier", label: "Outliers" },
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
    "Create three thumbnail concepts for my next video",
    "Plan a thumbnail with one clear focal point",
    "Improve the thumbnail idea for my most recent upload",
    "Match this title with a stronger thumbnail concept",
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
  { label: "New thumbnail", prompt: "Create a clear thumbnail concept for this YouTube video: ", mode: "thumbnail", icon: "▣" },
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
  if (payload.ideas?.length || payload.script) return reply;
  if (payload.titles?.length) return [reply, ...payload.titles.map((item, index) => `${index + 1}. ${item.title}`)].filter(Boolean).join("\n\n");
  if (payload.thumbnails?.length) {
    const concepts = payload.thumbnails.map((item, index) => `${index + 1}. ${item.concept}\n${item.visual}${item.textOverlay && item.textOverlay !== "No text" ? `\nOn-screen text: ${item.textOverlay}` : ""}`);
    return [reply, ...concepts].filter(Boolean).join("\n\n");
  }
  return reply;
}

function ConversationalAnswer({ text, streaming }: { text: string; streaming?: boolean }) {
  const blocks = text.split(/\n\n/);
  return <div className="assistant-answer">{blocks.map((block, index) => {
    const lines = block.split("\n").filter(Boolean);
    if (!lines.length) return null;
    if (/^\d+\.\s/.test(lines[0])) return <section className="assistant-option" key={`${index}-${lines[0]}`}>
      <strong>{lines[0]}</strong>
      {lines.slice(1).map((line, lineIndex) => {
        const label = line.match(/^(Why it works|Format|On-screen text):\s*(.*)$/);
        return <p key={`${lineIndex}-${line}`}>{label ? <><b>{label[1]}:</b> {label[2]}</> : line}</p>;
      })}
    </section>;
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
  const brief = [
    script.viewerPromise ? `VIEWER PROMISE\n${script.viewerPromise}` : "",
    script.voiceDirection ? `VOICE\n${script.voiceDirection}` : "",
  ].filter(Boolean).join("\n\n");
  return `${script.title} (${script.targetLength})${brief ? `\n\n${brief}` : ""}\n\nCOLD OPEN\n${script.coldOpen}\n\n${script.sections.map((section) => `${section.heading.toUpperCase()}\n${section.narration}${section.visualDirection ? `\n\nVisual: ${section.visualDirection}` : ""}`).join("\n\n")}\n\nENDING\n${script.ending}`;
}

function assistantClipboardText(message: ChatMessage) {
  if (message.ideas?.length) return ideaClipboardText(message.ideas);
  if (message.script) return scriptClipboardText(message.script);
  if (message.titles?.length) return message.titles.map((item, index) => `${index + 1}. ${item.title}`).join("\n");
  if (message.thumbnails?.length) return message.thumbnails.map((item, index) => `${index + 1}. ${item.concept}\nVisual: ${item.visual}\nText: ${item.textOverlay}`).join("\n\n");
  return message.content;
}

function assistantCopyLabel(message: ChatMessage) {
  if (message.ideas?.length) return "Copy all ideas and script blueprints";
  if (message.script) return "Copy full script";
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

function IdeaNextSteps({ ideas, disabled, onPrompt }: { ideas: GeneratedIdea[]; disabled: boolean; onPrompt: (prompt: string) => void }) {
  const recommendedIdea = ideas.find((item) => item.recommended) || ideas[0];
  return <section className="idea-next-actions compact" aria-label="Next steps for the top idea">
      <div><strong>What do you want to do next?</strong><small>Continue with “{recommendedIdea.suggestedTitle || recommendedIdea.idea}”</small></div>
      <div>
        <button className="primary" type="button" disabled={disabled} onClick={() => onPrompt(`Write the complete YouTube script for the recommended idea: "${recommendedIdea.idea}".`)}><FileText /> Write the script</button>
        <button type="button" disabled={disabled} onClick={() => onPrompt(`Give me five strong YouTube title options for the recommended idea: "${recommendedIdea.idea}".`)}>Make titles</button>
        <button type="button" disabled={disabled} onClick={() => onPrompt(`Create three thumbnail concepts for the recommended idea: "${recommendedIdea.idea}".`)}>Plan thumbnail</button>
      </div>
    </section>;
}

function ScriptWorkspace({ script }: { script: GeneratedScript }) {
  return <section className="script-workspace assistant-answer" aria-label={`Script: ${script.title}`}>
    <header className="artifact-header script-header">
      <div className="artifact-heading">
        <span className="artifact-icon" aria-hidden="true"><FileText /></span>
        <div><h2>{script.title}</h2><p>{script.targetLength} · {script.sections.length + 2} script beats</p></div>
      </div>
    </header>

    {script.viewerPromise || script.voiceDirection ? <div className="script-brief" aria-label="Script strategy">
      {script.viewerPromise ? <p><strong>Viewer promise</strong><span>{script.viewerPromise}</span></p> : null}
      {script.voiceDirection ? <p><strong>Delivery</strong><span>{script.voiceDirection}</span></p> : null}
    </div> : null}

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
  const artifactLines = message.titles?.length
    ? `Title options:\n${message.titles.map((item, index) => `${index + 1}. ${item.title}`).join("\n")}`
    : message.ideas?.length
      ? `Idea options:\n${message.ideas.map((item, index) => {
        const outline = item.scriptOutline ? `\nOpening: ${item.scriptOutline.opening}\nBeats: ${item.scriptOutline.beats.join(" | ")}\nPayoff: ${item.scriptOutline.payoff}` : "";
        return `${index + 1}. ${item.idea}${item.recommended ? " [RECOMMENDED]" : ""}\nWorking title: ${item.suggestedTitle || "Not recorded"}\nFormat: ${item.format || "Not recorded"} · Difficulty: ${item.difficulty || "Not recorded"}\nHook: ${item.hook}\nChannel fit: ${item.channelFit || "Not recorded"}\nResearch basis: ${item.researchBasis || "Not recorded"}${outline}`;
      }).join("\n\n")}`
      : message.thumbnails?.length
        ? `Thumbnail concepts:\n${message.thumbnails.map((item, index) => `${index + 1}. ${item.concept}: ${item.visual}`).join("\n")}`
        : message.script
          ? `Full script: ${message.script.title}${message.script.viewerPromise ? `\nViewer promise: ${message.script.viewerPromise}` : ""}${message.script.voiceDirection ? `\nVoice: ${message.script.voiceDirection}` : ""}\nCold open: ${message.script.coldOpen}\n${message.script.sections.map((section) => `${section.heading}: ${section.narration}${section.visualDirection ? `\nOn screen: ${section.visualDirection}` : ""}`).join("\n")}\nEnding: ${message.script.ending}`
          : "";
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
  if (name === "outlier") return <TrendingUp aria-hidden="true" />;
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
  return <svg className={down ? "feedback-icon down" : "feedback-icon"} viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v10H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h3Zm0 9h9.2a2 2 0 0 0 1.9-1.4l2.2-7A2 2 0 0 0 18.4 8H14l.7-3.1A2.3 2.3 0 0 0 10.3 3L7 10v9Z" /></svg>;
}

function YouTubeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1A31 31 0 0 0 2 12a31 31 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22 12a31 31 0 0 0-.4-4.8Z" /><path className="youtube-play" d="m10 15.2 5-3.2-5-3.2v6.4Z" /></svg>;
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
    <div className="onboarding-visual-canvas visual-welcome" aria-hidden="true">
      <div className="visual-toolbar"><span><i /> Creative room</span><span>Research ready</span></div>
      <div className="visual-thread">
        <div className="visual-user-message">I have a rough idea for my next video...</div>
        <div className="visual-stanley-message">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/stanley-mascot.png" alt="" width="46" height="46" />
          <div><span>Stanley</span><p>Let&apos;s turn it into something people will click and keep watching.</p></div>
        </div>
      </div>
      <div className="visual-idea-stack">
        <article><span>Idea</span><strong>The angle worth testing</strong><i className="idea-score">High fit</i></article>
        <article><span>Title</span><strong>A clear reason to click</strong><i className="idea-arrow">↗</i></article>
        <article><span>Script</span><strong>A hook that earns the next minute</strong><i className="idea-lines" /></article>
      </div>
      <div className="visual-status"><span>✦</span> One conversation. A complete video plan.</div>
    </div>
  );

  if (step === "features") return (
    <div className="onboarding-visual-canvas visual-package" aria-hidden="true">
      <div className="package-hero">
        <div className="package-preview"><span className="preview-play">▶</span><span className="preview-caption">Your next upload</span></div>
        <div className="package-title"><span>Title direction</span><strong>I Tried the Habit Everyone Keeps Recommending</strong><small>Clear promise · honest curiosity</small></div>
      </div>
      <div className="package-support">
        <article className="package-script"><span>Script map</span><strong>Hook</strong><i /><strong>Story beats</strong><i /><i /><strong>Payoff</strong></article>
        <article className="package-thumbnail"><span>Thumbnail concept</span><div><b>THE<br />TRUTH</b><i>●</i></div><small>One subject. One emotion. No clutter.</small></article>
      </div>
      <div className="package-research"><span className="research-pulse" /><p><strong>Research in the background</strong><small>Stanley checks what is already earning attention before suggesting the direction.</small></p></div>
    </div>
  );

  return (
    <div className="onboarding-visual-canvas visual-channel" aria-hidden="true">
      <div className="channel-preview-head">
        <div className="channel-preview-avatar">{profile?.thumbnailUrl ? <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.thumbnailUrl} alt="" />
        </> : <YouTubeIcon />}</div>
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
          <img src={STANLEY_LOGO} alt="Stanley" width="174" height="52" />
          <span className="product-label"><YouTubeIcon /><span>for YouTube</span></span>
        </div>
        <div className="onboarding-step-meta"><span>{step === "analyzing" ? "Setting things up" : `Step ${index} of 3`}</span><div>{[1, 2, 3].map((item) => <i className={item <= index ? "active" : ""} key={item} />)}</div></div>
      </header>

      <section className={`onboarding-stage onboarding-${step}`} aria-live="polite" key={step}>
        <div className="onboarding-copy-panel">
          {step === "welcome" && <>
            <p className="onboarding-label"><span>✦</span> Your YouTube creative sidekick</p>
            <h1>Hey, meet Stanley.</h1>
            <p className="onboarding-copy">Bring the idea. Stanley helps you figure out what people want to watch and turn it into a video you can actually make.</p>
            <button className="onboarding-primary" type="button" onClick={onContinue}>Show me how <span aria-hidden="true">→</span></button>
            <p className="onboarding-footnote">Ideas, titles, thumbnails, research, and scripts all in one chat.</p>
          </>}

          {step === "features" && <>
            <p className="onboarding-label"><span>◇</span> Start messy. Stanley will organize it.</p>
            <h1>One chat.<br />Your whole video.</h1>
            <p className="onboarding-copy">Start with a rough thought, a weird angle, or a title that is not clicking yet.</p>
            <div className="onboarding-features">
              <article><span><OnboardingIcon name="ideas" /></span><div><h2>Find an idea worth making</h2><p>Use real YouTube patterns to find a sharper angle.</p></div></article>
              <article><span><OnboardingIcon name="build" /></span><div><h2>Build the full package</h2><p>Shape the title, thumbnail, hook, and script together.</p></div></article>
              <article><span><OnboardingIcon name="learn" /></span><div><h2>Keep it sounding like you</h2><p>Stanley remembers your channel, choices, and creative style.</p></div></article>
            </div>
            <div className="onboarding-actions"><button className="onboarding-back" type="button" onClick={onBack}>Back</button><button className="onboarding-primary" type="button" onClick={onContinue}>Connect my channel <span aria-hidden="true">→</span></button></div>
          </>}

          {step === "connect" && <>
            <div className="onboarding-youtube-mark" aria-hidden="true"><YouTubeIcon /></div>
            <h1>Connect your YouTube account.</h1>
            <p className="onboarding-copy">Stanley looks at your recent videos and uses what already worked to suggest better ideas, titles, and scripts. You can skip this and connect later.</p>
            <div className="connect-benefits"><span>✓ Topics your viewers come back for</span><span>✓ Videos that stand out by views</span><span>✓ Patterns in your strongest titles</span></div>
            {error && <p className="onboarding-error" role="alert">{error}</p>}
            {!configured && <p className="oauth-dev-note">Google OAuth needs its private test credentials before connection can open.</p>}
            <div className="onboarding-connect-actions">
              <button className="onboarding-primary youtube-button" type="button" onClick={onConnect}><YouTubeIcon /> Connect YouTube</button>
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

function AnimatedMetric({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    let frame = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 1 : 850;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayed(Math.round(value * eased));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <>{formatViews(displayed)}</>;
}

function ChannelDashboard({
  status,
  videos,
  loading,
  error,
  onConnect,
  onCreate,
  onUseVideo,
  onRefresh,
}: {
  status: YouTubeStatus;
  videos: YouTubeVideoOption[];
  loading: boolean;
  error: string;
  onConnect: () => void;
  onCreate: () => void;
  onUseVideo: (video: YouTubeVideoOption) => void;
  onRefresh: () => void;
}) {
  const profile = status.profile;
  if (!status.connected || !profile) {
    return <section className="dashboard-shell dashboard-empty">
      <div className="dashboard-empty-mark"><YouTubeIcon /></div>
      <p>Channel dashboard</p>
      <h1>Put your YouTube signals to work.</h1>
      <span>Connect your channel to see real performance stats, recent uploads, and smarter starting points for your next video.</span>
      <button type="button" onClick={onConnect}><YouTubeIcon /> Connect YouTube</button>
    </section>;
  }

  const recentVideos = [...videos]
    .filter((video) => video.privacyStatus === "public")
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 6);
  const topVideo = [...recentVideos].sort((a, b) => b.views - a.views)[0];
  const maxViews = Math.max(1, ...recentVideos.map((video) => video.views));
  const averageRecentViews = recentVideos.length
    ? Math.round(recentVideos.reduce((sum, video) => sum + video.views, 0) / recentVideos.length)
    : 0;

  return <section className="dashboard-scroll-region">
    <div className="dashboard-shell">
      <header className="dashboard-hero">
        <div className="dashboard-identity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.thumbnailUrl} alt="" />
          <span><i /> Live channel data</span>
        </div>
        <div className="dashboard-hero-copy">
          <p>{profile.title}</p>
          <h1>Your channel, at a glance.</h1>
          <span>See what is getting attention, then turn the signal into your next upload.</span>
        </div>
        <div className="dashboard-hero-actions">
          <button className="dashboard-refresh" type="button" onClick={onRefresh} disabled={loading}><RefreshCw aria-hidden="true" /> Refresh</button>
          <button className="dashboard-create" type="button" onClick={onCreate}><WandSparkles aria-hidden="true" /> Create from my channel</button>
        </div>
      </header>

      <div className="dashboard-metrics" aria-label="Channel totals">
        <article><span><Users aria-hidden="true" /> Subscribers</span><strong><AnimatedMetric value={profile.subscriberCount} /></strong><small>Current total</small></article>
        <article><span><Eye aria-hidden="true" /> Channel views</span><strong><AnimatedMetric value={profile.totalViews} /></strong><small>Lifetime total</small></article>
        <article><span><Video aria-hidden="true" /> Videos</span><strong><AnimatedMetric value={profile.videoCount} /></strong><small>Published uploads</small></article>
        <article><span><TrendingUp aria-hidden="true" /> Recent average</span><strong>{loading ? "—" : <AnimatedMetric value={averageRecentViews} />}</strong><small>Views across the latest {recentVideos.length || 0}</small></article>
      </div>

      {error && !loading ? <div className="dashboard-data-error"><span>{error}</span><button type="button" onClick={onRefresh}>Try again</button></div> : null}

      <div className="dashboard-insight-grid">
        <section className="dashboard-performance" aria-labelledby="performance-heading">
          <div className="dashboard-panel-heading"><div><h2 id="performance-heading">Recent performance</h2><p>Views across your latest public uploads</p></div><span>{loading ? "Loading" : `${recentVideos.length} videos`}</span></div>
          {loading ? <div className="dashboard-chart-loading"><i /><i /><i /><i /><i /></div> : recentVideos.length ? <div className="dashboard-bars">
            {recentVideos.map((video, index) => <button type="button" onClick={() => onUseVideo(video)} key={video.id} title={`Build from ${video.title}`}>
              <span className="dashboard-bar-label"><b>{video.title}</b><small>{formatViews(video.views)}</small></span>
              <span className="dashboard-bar-track"><i style={{ "--bar-size": `${Math.max(6, (video.views / maxViews) * 100)}%`, "--bar-delay": `${index * 70}ms` } as CSSProperties} /></span>
            </button>)}
          </div> : <p className="dashboard-no-data">No public uploads were returned yet.</p>}
        </section>

        <aside className="dashboard-standout">
          <div className="dashboard-panel-heading"><div><h2>Standout upload</h2><p>Best recent view count</p></div><TrendingUp aria-hidden="true" /></div>
          {topVideo ? <>
            <div className="dashboard-standout-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={topVideo.thumbnailUrl} alt="" />
              <span>{formatViews(topVideo.views)} views</span>
            </div>
            <h3>{topVideo.title}</h3>
            <button type="button" onClick={() => onUseVideo(topVideo)}>Build a follow-up <ArrowUpRight aria-hidden="true" /></button>
          </> : <p className="dashboard-no-data">Your standout will appear when videos load.</p>}
        </aside>
      </div>

      <section className="dashboard-uploads" aria-labelledby="uploads-heading">
        <div className="dashboard-panel-heading"><div><h2 id="uploads-heading">Latest uploads</h2><p>Use any video as context for a new creative direction</p></div></div>
        <div className="dashboard-upload-list">
          {recentVideos.slice(0, 5).map((video) => <article key={video.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={video.thumbnailUrl} alt="" />
            <div><strong>{video.title}</strong><span>{formatViews(video.views)} views · {formatTime(video.publishedAt)}</span></div>
            <a href={video.url} target="_blank" rel="noreferrer" aria-label={`Open ${video.title} on YouTube`}><ArrowUpRight aria-hidden="true" /></a>
            <button type="button" onClick={() => onUseVideo(video)}>Create from this</button>
          </article>)}
        </div>
      </section>
    </div>
  </section>;
}

export default function Home() {
  const topicRef = useRef<HTMLTextAreaElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
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
    if (onboardingStep !== "done" || activeView !== "dashboard" || !youtubeStatus.connected || dashboardVideosRequestedRef.current) return;
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
  }, [activeView, onboardingStep, youtubeStatus.connected]);

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
    if (!messages.length) return;
    window.requestAnimationFrame(() => conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }, [messages.length, loading]);

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
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
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
    const requestAttachments: ComposerAttachment[] = [...currentAttachments];
    if (!requestAttachments.some((attachment) => attachment.kind === "youtube") && retainedYouTubeReference) {
      requestAttachments.push(retainedYouTubeReference);
    }
    if (!requestAttachments.some((attachment) => attachment.kind === "video") && cachedUploadedVideo) {
      requestAttachments.push(cachedUploadedVideo);
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
        thumbnails: payload.thumbnails,
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
      if (completedTopic !== originalTopic) setOriginalTopic(completedTopic);
      if (isCreationMode(payload.mode)) setMode(payload.mode);
      const artifactCount = payload.titles?.length || payload.ideas?.length || payload.thumbnails?.length || (payload.script ? 1 : 0);
      setNotice(payload.blocked ? "Request kept inside creation mode" : artifactCount ? `${artifactCount} options ready` : "Stanley replied");
    } catch (caught) {
      setMessages(messages);
      setTopic(cleanMessage);
      setAttachments(currentAttachments);
      setActiveActivity([]);
      if (isFirstMessage) {
        setOriginalTopic("");
        setSessionId("");
      }
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
          {youtubeStatus.profile.thumbnailUrl ? <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={youtubeStatus.profile.thumbnailUrl} alt="" width="30" height="30" />
          </> : <span><YouTubeIcon /></span>}
          <div><strong>{youtubeStatus.profile.title}</strong><small>YouTube connected</small></div>
        </div>}
      </aside>

      <section className="main-panel">
        <header className="main-header">
          <span className="header-balance" />
          {youtubeStatus.connected && youtubeStatus.profile ? <div className="channel-connection" title={`${youtubeStatus.profile.title} is connected`}>
            {youtubeStatus.profile.thumbnailUrl ? <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={youtubeStatus.profile.thumbnailUrl} alt="" width="28" height="28" />
            </> : <span className="channel-fallback" aria-hidden="true"><YouTubeIcon /></span>}
            <span className="channel-copy"><strong>{youtubeStatus.profile.title}</strong><small><i /> Connected channel</small></span>
            <button className="channel-disconnect" type="button" onClick={() => void disconnectYouTube()} title={`Disconnect ${youtubeStatus.profile.title}`} aria-label={`Disconnect ${youtubeStatus.profile.title}`}><LogOut aria-hidden="true" /></button>
          </div> : <button className="youtube-connect-header" type="button" onClick={connectYouTube}><YouTubeIcon /><span>Connect YouTube</span></button>}
          <div className="header-actions">
            {activeView === "create" && sessionId && <button className="debug-session" type="button" onClick={copySessionId} title={`Copy session ID: ${sessionId}`} aria-label="Copy session ID"><DebugIcon /><span>Debug</span><code>{sessionId.slice(0, 8)}</code></button>}
          </div>
        </header>

        {activeView === "dashboard" ? <ChannelDashboard
          status={youtubeStatus}
          videos={youtubeVideos}
          loading={videosLoading}
          error={videosError}
          onConnect={connectYouTube}
          onCreate={() => startDashboardPrompt("Analyze my channel and give me three strong video ideas for my next upload")}
          onUseVideo={(video) => startDashboardPrompt(`Analyze this upload and help me build a stronger follow-up video: ${video.title}`, video)}
          onRefresh={() => void refreshDashboard()}
        /> : <>
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
                <article className={message.blocked ? "assistant-message blocked" : "assistant-message"} key={message.id} aria-busy={message.streaming || undefined}>
                  <div className="assistant-lead">
                    <div>
                      {message.blocked && <span className="boundary-label">Creation boundary</span>}
                      {message.activity?.length && !message.streaming ? <AgentActivityTimeline activity={message.activity} durationMs={message.agent?.durationMs} /> : null}
                      {structuredLeadText(message) ? <ConversationalAnswer text={structuredLeadText(message)} streaming={message.streaming} /> : null}
                    </div>
                  </div>

                  {message.ideas?.length ? <IdeaWorkspace ideas={message.ideas} /> : null}

                  {message.script ? <ScriptWorkspace script={message.script} /> : null}

                  {message.research && (
                    <details className="research-card">
                      <summary><span className={`research-status ${message.research.coverage || "strong"}`}><i /> {message.research.coverage === "limited" ? "Limited evidence" : message.research.coverage === "none" ? "Broad guidance" : "Evidence used"}</span><strong>{message.research.analyzed > 0 ? `${message.research.analyzed} videos analyzed for “${message.research.query}”` : `No close matches found for “${message.research.query}”`}</strong>{message.research.examples.length > 0 && <span className="research-open">Sources +</span>}</summary>
                      <div className="research-sources">{message.research.examples.map((video) => <a href={video.url} target="_blank" rel="noreferrer" key={video.id}><span>{video.title}</span><small>{video.channel} · {video.views.toLocaleString()} views</small></a>)}</div>
                    </details>
                  )}

                  {!message.streaming && <div className="assistant-actions">
                    <button className={feedback[message.id] === "up" ? "feedback-response selected" : "feedback-response"} type="button" aria-label="Mark response as helpful" aria-pressed={feedback[message.id] === "up"} onClick={() => rateResponse(message.id, "up")}><FeedbackIcon /></button>
                    <button className={feedback[message.id] === "down" ? "feedback-response selected" : "feedback-response"} type="button" aria-label="Mark response as not helpful" aria-pressed={feedback[message.id] === "down"} onClick={() => rateResponse(message.id, "down")}><FeedbackIcon down /></button>
                    <button className="copy-response" type="button" onClick={() => copyText(assistantClipboardText(message), "Copied")} aria-label={assistantCopyLabel(message)}><span className="copy-icon" aria-hidden="true" /> Copy</button>
                  </div>}

                  {message.ideas?.length ? <IdeaNextSteps ideas={message.ideas} disabled={loading} onPrompt={(prompt) => void submitMessage(prompt)} /> : null}
                </article>
              ))}

              {loading && !streamingReply ? <AgentActivityTimeline activity={activeActivity} live /> : null}
              <div ref={conversationEndRef} aria-hidden="true" />
            </section>
          )}
        </div>

        {inConversation && renderComposer(false)}
        </>}
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
