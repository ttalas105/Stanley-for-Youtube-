"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

type CreationMode = "auto" | "idea" | "title" | "thumbnail";

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
  hook: string;
  whyItCouldWork: string;
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
  coldOpen: string;
  sections: Array<{ heading: string; narration: string }>;
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
  blocked?: boolean;
  streaming?: boolean;
  attachments?: MessageAttachment[];
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
  conversationTopic?: string;
  blocked?: boolean;
  error?: string;
};

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

type MessageAttachment = Pick<ComposerAttachment, "id" | "kind" | "name" | "previewUrl" | "thumbnailUrl" | "videoId" | "url">;

const DRAFTS_KEY = "stanley-title-drafts";
const ONBOARDING_KEY = "stanley-onboarding-v1";
const MAX_USER_TURNS = 9;
const STANLEY_LOGO = "https://stanbrandhub.lovable.app/downloads/Stanley_Logo_Lockup_Dark.png";

const NAV_ITEMS = [
  { icon: "spark", label: "Create", active: true },
  { icon: "outlier", label: "Outliers", badge: true },
  { icon: "extension", label: "Chrome extension" },
];

const MODE_PLACEHOLDERS: Record<CreationMode, string[]> = {
  auto: ["How can I help you grow?", "Give me ideas for my next video", "Make this title impossible to ignore", "Plan a thumbnail people will notice"],
  idea: ["What kind of videos do you want to make?", "Find my next breakout video idea", "Turn this rough thought into a video", "What should I film next?"],
  title: ["What is the video about?", "Rewrite this title with a stronger hook", "Give me titles based on what already works", "Help me package this video"],
  thumbnail: ["Describe the video you need a thumbnail for", "Plan a thumbnail with one clear focal point", "Make me a thumbnail concept for", "What should the thumbnail show?"],
};

const PLACEHOLDER_TYPE_DELAY = 42;
const PLACEHOLDER_HOLD_DELAY = 5600;
const PLACEHOLDER_ERASE_DELAY = 22;
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
        return `${index + 1}. ${item.idea}\nHook: ${item.hook}\nResearch basis: ${item.researchBasis || "Not recorded"}${outline}`;
      }).join("\n\n")}`
      : message.thumbnails?.length
        ? `Thumbnail concepts:\n${message.thumbnails.map((item, index) => `${index + 1}. ${item.concept}: ${item.visual}`).join("\n")}`
        : message.script
          ? `Full script: ${message.script.title}\nCold open: ${message.script.coldOpen}\n${message.script.sections.map((section) => `${section.heading}: ${section.narration}`).join("\n")}\nEnding: ${message.script.ending}`
          : "";
  return { role: message.role, content: artifactLines ? `${message.content}\n${artifactLines}` : message.content };
}

function ToolIcon({ name }: { name: string }) {
  if (name === "outlier") return <span className="outlier-mark">10.4×</span>;
  if (name === "extension") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h4.2a2.8 2.8 0 1 1 4.6 2.15V9H21v5h-3.2a2.8 2.8 0 1 0-4.6 2.85V21H8v-3.2a2.8 2.8 0 1 1-2.85-4.6H3V8h4V4a1 1 0 0 1 2-1Z" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.55 5.2L19 9l-5.45 1.8L12 16l-1.55-5.2L5 9l5.45-1.8L12 2Zm6 12 .9 3.1L22 18l-3.1.9L18 22l-.9-3.1L14 18l3.1-.9L18 14Z" /></svg>;
}

function NewChatIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 5.3 18.7 9.3M4 20l3.4-.7L19 7.7a1.4 1.4 0 0 0 0-2l-.7-.7a1.4 1.4 0 0 0-2 0L4.7 16.6 4 20Z" /><path d="M13 4H6a2 2 0 0 0-2 2v5" /></svg>;
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

function DisconnectIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 14.5 14.5 9.5M7.2 16.8l-1.4 1.4a2.8 2.8 0 0 1-4-4l3.4-3.4a2.8 2.8 0 0 1 4 0M16.8 7.2l1.4-1.4a2.8 2.8 0 0 1 4 4l-3.4 3.4a2.8 2.8 0 0 1-4 0" /></svg>;
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
      <div className="channel-trust"><span>✓</span><p><strong>Read-only access</strong><small>Stanley cannot upload, edit, or delete videos.</small></p></div>
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

export default function Home() {
  const topicRef = useRef<HTMLTextAreaElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const replyRunRef = useRef(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<CreationMode>("auto");
  const [originalTopic, setOriginalTopic] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    let active = true;
    let analysisTimer: number | undefined;
    const draftsTimer = window.setTimeout(() => setDrafts(readDrafts()), 0);

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
      if (analysisTimer) window.clearTimeout(analysisTimer);
      delete document.documentElement.dataset.stanleyReady;
    };
  }, []);

  useEffect(() => {
    if (topic || loading || recording || transcribing) return;
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
      timer = window.setTimeout(typeCharacter, 220);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [mode, placeholderIndex, topic, loading, recording, transcribing]);

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
    setDrafts((current) => {
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
      return next;
    });
  }

  async function submitMessage(rawMessage: string) {
    const cleanMessage = rawMessage.trim();
    const userTurns = messages.filter((message) => message.role === "user").length;
    if (!cleanMessage || loading || userTurns >= MAX_USER_TURNS) return;
    const runId = ++replyRunRef.current;

    // A successful YouTube connection starts the chat with a personalized
    // assistant greeting. The creator's first typed message is still the root
    // topic even though that greeting already exists in `messages`.
    const isFirstMessage = userTurns === 0;
    const rootTopic = isFirstMessage ? cleanMessage : originalTopic;
    const activeSessionId = sessionId || crypto.randomUUID();
    const currentAttachments = attachments;
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
      })),
    };
    const pendingMessages = [...messages, userMessage];

    setLoading(true);
    setError("");
    setTopic("");
    setAttachments([]);
    setAttachmentMenuOpen(false);
    setMessages(pendingMessages);
    if (isFirstMessage) setOriginalTopic(rootTopic);
    if (!sessionId) setSessionId(activeSessionId);

    try {
      const response = await fetch("/api/generate-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: rootTopic,
          mode,
          sessionId: activeSessionId,
          attachments: currentAttachments.map((attachment) => ({
            kind: attachment.kind,
            name: attachment.name,
            mimeType: attachment.mimeType,
            data: attachment.data,
            videoId: attachment.videoId,
            url: attachment.url,
            title: attachment.title,
            views: attachment.views,
            publishedAt: attachment.publishedAt,
            privacyStatus: attachment.privacyStatus,
          })),
          ...(isFirstMessage ? {} : { messages: pendingMessages.map(serializeMessage) }),
        }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.reply) throw new Error(payload.error || "Stanley could not finish that response. Try again.");

      const responseMode = isCreationMode(payload.mode) && payload.mode !== "auto" ? payload.mode : undefined;
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: payload.reply,
        mode: responseMode,
        titles: payload.titles,
        ideas: payload.ideas,
        script: payload.script,
        thumbnails: payload.thumbnails,
        research: payload.research,
        blocked: payload.blocked,
      };
      const completedMessages = [...pendingMessages, assistantMessage];
      const completedTopic = payload.conversationTopic?.trim() || rootTopic;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduceMotion) {
        const chunkSize = Math.max(1, Math.ceil(assistantMessage.content.length / 72));
        for (let end = chunkSize; end < assistantMessage.content.length; end += chunkSize) {
          if (replyRunRef.current !== runId) return;
          setMessages([...pendingMessages, {
            id: assistantMessage.id,
            role: "assistant",
            content: assistantMessage.content.slice(0, end),
            streaming: true,
          }]);
          await new Promise<void>((resolve) => window.setTimeout(resolve, 14));
        }
      }
      if (replyRunRef.current !== runId) return;
      setMessages(completedMessages);
      setLoading(false);
      if (completedTopic !== originalTopic) setOriginalTopic(completedTopic);
      persistConversation(activeSessionId, completedTopic, completedMessages);
      if (isCreationMode(payload.mode)) setMode(payload.mode);
      const artifactCount = payload.titles?.length || payload.ideas?.length || payload.thumbnails?.length || (payload.script ? 1 : 0);
      setNotice(payload.blocked ? "Request kept inside creation mode" : artifactCount ? `${artifactCount} options ready` : "Stanley replied");
    } catch (caught) {
      setMessages(messages);
      setTopic(cleanMessage);
      setAttachments(currentAttachments);
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
    setSessionId(draft.id);
    setOriginalTopic(draft.topic);
    setMessages(restoreMessages(draft));
    setTopic("");
    setAttachments([]);
    setAttachmentMenuOpen(false);
    setMode("auto");
    setError("");
    window.setTimeout(() => topicRef.current?.focus(), 250);
  }

  function startNewChat() {
    replyRunRef.current += 1;
    setTopic("");
    setMode("auto");
    setOriginalTopic("");
    setSessionId("");
    setMessages([]);
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

  function skipOnboarding() {
    window.localStorage.setItem(ONBOARDING_KEY, "skipped");
    setOnboardingStep("done");
    window.setTimeout(() => topicRef.current?.focus(), 0);
  }

  async function disconnectYouTube() {
    try {
      const response = await fetch("/api/youtube/disconnect", { method: "POST" });
      if (!response.ok) throw new Error("Disconnect failed");
      setYouTubeStatus((current) => ({ ...current, connected: false, profile: null }));
      setNotice("YouTube disconnected");
    } catch {
      setNotice("YouTube could not be disconnected");
    }
  }

  function removeAttachment(id: string) {
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
    if (kind === "video" && attachments.some((attachment) => attachment.kind === "video" || attachment.kind === "youtube")) {
      setError("Remove the current video before attaching another one.");
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
    setVideosLoading(true);
    setVideosError("");
    try {
      const response = await fetch("/api/youtube/videos", { cache: "no-store" });
      const payload = await response.json() as { videos?: YouTubeVideoOption[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Your videos could not be loaded.");
      setYouTubeVideos(payload.videos || []);
    } catch (caught) {
      setVideosError(caught instanceof Error ? caught.message : "Your videos could not be loaded.");
    } finally {
      setVideosLoading(false);
    }
  }

  function attachSelectedYouTubeVideo() {
    const video = youtubeVideos.find((item) => item.id === selectedVideoId);
    if (!video) return;
    setAttachments((current) => [
      ...current.filter((attachment) => attachment.kind !== "youtube" && attachment.kind !== "video"),
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

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!event.currentTarget.value.trim() || loading || recording || transcribing) return;
    event.currentTarget.form?.requestSubmit();
  }

  function openTool(label: string, active?: boolean) {
    if (active) {
      document.querySelector("#composer")?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => topicRef.current?.focus(), 250);
      return;
    }
    setNotice(`${label} is coming soon`);
  }

  const inConversation = messages.length > 0;
  const userTurns = messages.filter((message) => message.role === "user").length;
  const chatLimitReached = userTurns >= MAX_USER_TURNS;
  const streamingReply = messages.some((message) => message.streaming);
  const composerPlaceholder = chatLimitReached
    ? "Start a new chat to keep working"
    : transcribing
      ? "Transcribing your voice message…"
      : "";
  const filteredYoutubeVideos = youtubeVideos.filter((video) => video.title.toLocaleLowerCase().includes(videoSearch.trim().toLocaleLowerCase()));

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
                  <span><strong>{attachment.title || attachment.name}</strong><small>{attachment.kind === "youtube" ? "YouTube video" : attachment.kind === "image" ? "Image" : "Video"}</small></span>
                  <button type="button" onClick={() => removeAttachment(attachment.id)} aria-label={`Remove ${attachment.title || attachment.name}`}><CloseIcon /></button>
                </div>)}
              </div>}

              <label className="sr-only" htmlFor={large ? "topic" : "chat-topic"}>Message Stanley</label>
              <div className="composer-input-shell">
                <textarea
                  ref={topicRef}
                  id={large ? "topic" : "chat-topic"}
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  disabled={chatLimitReached}
                  placeholder={composerPlaceholder}
                  maxLength={1200}
                  rows={large ? 2 : 1}
                />
                {!topic && !composerPlaceholder && typedPlaceholder && <span className="typewriter-placeholder" aria-hidden="true">
                  {typedPlaceholder}<i />
                </span>}
              </div>

              <div className="composer-toolbar">
                <div className="composer-tools-left">
                  <button className={attachmentMenuOpen ? "attach-button active" : "attach-button"} type="button" onClick={() => setAttachmentMenuOpen((current) => !current)} aria-expanded={attachmentMenuOpen} aria-haspopup="menu" aria-label="Add attachment"><PlusIcon /></button>
                </div>
                <div className="composer-tools-right">
                  {recording && <span className="recording-time"><i /> {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}</span>}
                  {transcribing && <span className="transcribing-label"><i /> Listening</span>}
                  <button className={recording ? "mic-button recording" : "mic-button"} type="button" disabled={loading || transcribing || chatLimitReached} onClick={() => void toggleRecording()} aria-label={recording ? "Stop recording" : "Start voice message"} aria-pressed={recording}><MicIcon /></button>
                  <button className="generate-button" type="submit" disabled={!topic.trim() || loading || recording || transcribing || chatLimitReached} aria-label="Send message"><span className="send-arrow" aria-hidden="true" /></button>
                </div>
              </div>
            </div>

            {attachmentMenuOpen && <div className="attachment-menu" role="menu" aria-label="Add to your message">
              <button type="button" role="menuitem" onClick={() => imageInputRef.current?.click()}><span><UploadImageIcon /></span><span><strong>Attach an image</strong><small>JPG, PNG, WebP, or GIF</small></span></button>
              <button type="button" role="menuitem" onClick={() => videoInputRef.current?.click()}><span><UploadVideoIcon /></span><span><strong>Attach a video</strong><small>MP4, WebM, MOV, or MPEG</small></span></button>
              <div className="attachment-menu-divider" />
              <button type="button" role="menuitem" onClick={() => void openYouTubePicker()}><span className="youtube-menu-icon"><YouTubeIcon /></span><span><strong>Add from YouTube</strong><small>Choose one of your uploads</small></span></button>
            </div>}
          </div>

          <input className="sr-only" ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => void handleFileSelection("image", event)} aria-label="Upload images" />
          <input className="sr-only" ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/mpeg" onChange={(event) => void handleFileSelection("video", event)} aria-label="Upload video" />
          {large ? <p className="composer-hint">Ask for ideas, scripts, titles, or thumbnails. Stanley will work out what you need.</p> : <div className="composer-meta">{error ? <p className="form-error" role="alert">{error}</p> : <p>Stanley can only help build your YouTube video.</p>}<span>{userTurns}/{MAX_USER_TURNS}</span></div>}
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
    <main className="app-shell" id="top" data-session-id={sessionId || undefined}>
      <aside className="sidebar">
        <a className="sidebar-brand" href="#top" aria-label="Stanley home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/stanley-mascot.png" alt="" width="34" height="34" />
          <span><strong>Stanley</strong><small><YouTubeIcon /> for YouTube</small></span>
        </a>

        <button className="sidebar-new-chat-button" type="button" onClick={startNewChat}><NewChatIcon /><span>New chat</span></button>

        <nav aria-label="Stanley tools">
          {NAV_ITEMS.map((item) => (
            <div className={item.active ? "nav-item active" : "nav-item"} key={item.label}>
              <button className="nav-tool-button" type="button" onClick={() => openTool(item.label, item.active)} aria-current={item.active ? "page" : undefined}>
                <span className={item.badge ? "nav-badge" : "nav-icon"} aria-hidden="true"><ToolIcon name={item.icon} /></span>
                <span>{item.label}</span>
              </button>
              {item.active && <button className="nav-new-chat" type="button" onClick={startNewChat} aria-label="Start new chat"><NewChatIcon /></button>}
            </div>
          ))}
        </nav>

        <section className="title-history" aria-labelledby="history-heading">
          <h2 id="history-heading">Chats</h2>
          {drafts.length > 0 ? drafts.slice(0, 6).map((draft) => (
            <button type="button" key={draft.id} onClick={() => openDraft(draft)} aria-current={draft.id === sessionId ? "true" : undefined}>
              <span>{draft.topic}</span><small>{formatTime(draft.createdAt)}</small>
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
          {youtubeStatus.connected && youtubeStatus.profile ? <div className="channel-connection">
            {youtubeStatus.profile.thumbnailUrl ? <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={youtubeStatus.profile.thumbnailUrl} alt="" width="28" height="28" />
            </> : <span className="channel-fallback" aria-hidden="true"><YouTubeIcon /></span>}
            <span className="channel-copy"><strong>{youtubeStatus.profile.title}</strong><small>Connected channel</small></span>
            <button className="channel-disconnect" type="button" onClick={() => void disconnectYouTube()} aria-label={`Disconnect ${youtubeStatus.profile.title}`}><DisconnectIcon /><span>Disconnect</span></button>
          </div> : <button className="youtube-connect-header" type="button" onClick={connectYouTube}><YouTubeIcon /><span>Connect YouTube</span></button>}
          <div className="header-actions">
            {sessionId && <button className="debug-session" type="button" onClick={copySessionId} title={`Copy session ID: ${sessionId}`} aria-label="Copy session ID"><DebugIcon /><span>Debug</span><code>{sessionId.slice(0, 8)}</code></button>}
            <button className="header-new-chat" type="button" onClick={startNewChat} aria-label="New conversation"><NewChatIcon /></button>
          </div>
        </header>

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
                      {message.ideas?.length ? <h1>Video ideas</h1> : null}
                      {message.script ? <h1>Full video script</h1> : null}
                      {message.titles?.length ? <h1>Title directions</h1> : null}
                      {message.thumbnails?.length ? <h1>Thumbnail concepts</h1> : null}
                      <p>{message.content}{message.streaming && <span className="assistant-typing-cursor" aria-hidden="true" />}</p>
                    </div>
                  </div>

                  {message.ideas?.length ? <div className="creation-list idea-list">{message.ideas.map((item, index) => {
                    const evidenceSources = (item.sourceNumbers || []).map((sourceNumber) => message.research?.examples[sourceNumber - 1]).filter((video): video is ResearchVideo => Boolean(video));
                    return (
                      <article className="creation-item idea-item" key={item.id}>
                        <span className="card-number">{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <h2>{item.idea}</h2>
                          <p><strong>Hook:</strong> {item.hook}</p>
                          <p>{item.whyItCouldWork}</p>
                          {item.researchBasis ? <div className="idea-evidence"><strong>Data signal</strong><p>{item.researchBasis}</p>{evidenceSources.length > 0 ? <div>{evidenceSources.map((video) => <a href={video.url} target="_blank" rel="noreferrer" key={video.id}>{video.title}</a>)}</div> : null}</div> : null}
                          {item.scriptOutline ? <details className="idea-script">
                            <summary><span>Script blueprint</span><small>Opening + {item.scriptOutline.beats.length} beats + payoff</small></summary>
                            <div className="script-outline-body">
                              <section><h3>Cold open</h3><p>{item.scriptOutline.opening}</p></section>
                              <section><h3>Story beats</h3><ol>{item.scriptOutline.beats.map((beat, beatIndex) => <li key={`${item.id}-beat-${beatIndex}`}>{beat}</li>)}</ol></section>
                              <section><h3>Payoff</h3><p>{item.scriptOutline.payoff}</p></section>
                              <button className="write-script-button" type="button" disabled={loading || chatLimitReached} onClick={() => void submitMessage(`Write the full YouTube script for idea ${index + 1}: "${item.idea}". Follow its hook and script blueprint, and keep every factual claim honest.`)} aria-label={`Write full script for idea ${index + 1}`}>Write full script</button>
                            </div>
                          </details> : null}
                        </div>
                      </article>
                    );
                  })}</div> : null}

                  {message.titles?.length ? <div className="creation-list title-list">{message.titles.map((item, index) => (
                    <article className="creation-item title-card" key={item.id}><span className="card-number">{String(index + 1).padStart(2, "0")}</span><div className="card-content"><span className="angle-tag">{item.angle}</span><h2>{item.title}</h2><p>{item.whyItWorks}</p></div></article>
                  ))}</div> : null}

                  {message.thumbnails?.length ? <div className="thumbnail-list">{message.thumbnails.map((item, index) => (
                    <article className="thumbnail-item" key={item.id}>
                      <div className="thumbnail-preview"><span>{item.textOverlay === "No text" ? "" : item.textOverlay}</span></div>
                      <div><span className="angle-tag">Concept {String(index + 1).padStart(2, "0")}</span><h2>{item.concept}</h2><p>{item.visual}</p><p><strong>Why it works:</strong> {item.whyItWorks}</p></div>
                    </article>
                  ))}</div> : null}

                  {message.script ? <section className="full-script" aria-label={`Script for ${message.script.title}`}>
                    <header><div><h2>{message.script.title}</h2><p>{message.script.targetLength}</p></div></header>
                    <section><h3>Cold open</h3><p>{message.script.coldOpen}</p></section>
                    {message.script.sections.map((section, index) => <section key={`${message.id}-section-${index}`}><h3>{section.heading}</h3><p>{section.narration}</p></section>)}
                    <section><h3>Ending</h3><p>{message.script.ending}</p></section>
                  </section> : null}

                  {message.research && (
                    <details className="research-card">
                      <summary><span className={`research-status ${message.research.coverage || "strong"}`}><i /> {message.research.coverage === "limited" ? "Limited evidence" : message.research.coverage === "none" ? "Broad guidance" : "Evidence used"}</span><strong>{message.research.analyzed > 0 ? `${message.research.analyzed} videos analyzed for “${message.research.query}”` : `No close matches found for “${message.research.query}”`}</strong>{message.research.examples.length > 0 && <span className="research-open">Sources +</span>}</summary>
                      <div className="research-sources">{message.research.examples.map((video) => <a href={video.url} target="_blank" rel="noreferrer" key={video.id}><span>{video.title}</span><small>{video.channel} · {video.views.toLocaleString()} views</small></a>)}</div>
                    </details>
                  )}

                  {!message.streaming && <div className="assistant-actions">
                    <button className={feedback[message.id] === "up" ? "feedback-response selected" : "feedback-response"} type="button" aria-label="Mark response as helpful" aria-pressed={feedback[message.id] === "up"} onClick={() => rateResponse(message.id, "up")}><FeedbackIcon /></button>
                    <button className={feedback[message.id] === "down" ? "feedback-response selected" : "feedback-response"} type="button" aria-label="Mark response as not helpful" aria-pressed={feedback[message.id] === "down"} onClick={() => rateResponse(message.id, "down")}><FeedbackIcon down /></button>
                    <button className="copy-response" type="button" onClick={() => copyText(message.content, "Response copied")} aria-label="Copy response"><span className="copy-icon" aria-hidden="true" /> Copy</button>
                    {message.titles?.length ? <button className="copy-response" type="button" onClick={() => copyText(message.titles!.map((item, index) => `${index + 1}. ${item.title}`).join("\n"), "Titles copied")} aria-label="Copy all titles"><span className="copy-icon" aria-hidden="true" /> Copy titles</button> : null}
                    {message.ideas?.length ? <button className="copy-response" type="button" onClick={() => copyText(message.ideas!.map((item, index) => `${index + 1}. ${item.idea}\nHook: ${item.hook}\nWhy it could work: ${item.whyItCouldWork}\nData signal: ${item.researchBasis || "Broad format guidance"}${item.scriptOutline ? `\n\nSCRIPT BLUEPRINT\nCold open: ${item.scriptOutline.opening}\n${item.scriptOutline.beats.map((beat, beatIndex) => `${beatIndex + 1}. ${beat}`).join("\n")}\nPayoff: ${item.scriptOutline.payoff}` : ""}`).join("\n\n---\n\n"), "Ideas and scripts copied")} aria-label="Copy all ideas and script blueprints"><span className="copy-icon" aria-hidden="true" /> Copy ideas + scripts</button> : null}
                    {message.script ? <button className="copy-response" type="button" onClick={() => copyText(`${message.script!.title} (${message.script!.targetLength})\n\nCOLD OPEN\n${message.script!.coldOpen}\n\n${message.script!.sections.map((section) => `${section.heading.toUpperCase()}\n${section.narration}`).join("\n\n")}\n\nENDING\n${message.script!.ending}`, "Full script copied")} aria-label="Copy full script"><span className="copy-icon" aria-hidden="true" /> Copy full script</button> : null}
                    {message.thumbnails?.length ? <button className="copy-response" type="button" onClick={() => copyText(message.thumbnails!.map((item, index) => `${index + 1}. ${item.concept}\nVisual: ${item.visual}\nText: ${item.textOverlay}`).join("\n\n"), "Thumbnail concepts copied")} aria-label="Copy all thumbnail concepts"><span className="copy-icon" aria-hidden="true" /> Copy concepts</button> : null}
                  </div>}
                </article>
              ))}

              {loading && !streamingReply && <div className="assistant-thinking" role="status" aria-label="Stanley is thinking"><span className="thinking-spinner" /></div>}
              <div ref={conversationEndRef} aria-hidden="true" />
            </section>
          )}
        </div>

        {inConversation && renderComposer(false)}
      </section>

      {videoPickerOpen && <div className="video-picker-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setVideoPickerOpen(false);
      }}>
        <section className="video-picker" role="dialog" aria-modal="true" aria-labelledby="video-picker-title">
          <header><div><h2 id="video-picker-title">Select a reference video</h2><p>Attach one of your YouTube videos to this message.</p></div><button type="button" onClick={() => setVideoPickerOpen(false)} aria-label="Close video picker"><CloseIcon /></button></header>
          {youtubeStatus.connected && <label className="video-search"><SearchIcon /><span className="sr-only">Search your videos</span><input value={videoSearch} onChange={(event) => setVideoSearch(event.target.value)} placeholder="Search your videos" /></label>}
          <div className="video-picker-tabs" aria-label="Video source"><button type="button" className="active">Your videos</button><span>Connected to {youtubeStatus.profile?.title || "YouTube"}</span></div>
          <div className="video-grid">
            {videosLoading ? <div className="video-picker-state"><span className="thinking-spinner" />Loading your videos…</div> : videosError ? <div className="video-picker-state error"><p>{videosError}</p>{!youtubeStatus.connected && <button type="button" onClick={connectYouTube}><YouTubeIcon /> Connect YouTube</button>}</div> : filteredYoutubeVideos.length ? filteredYoutubeVideos.map((video) => <button className={selectedVideoId === video.id ? "video-option selected" : "video-option"} type="button" key={video.id} onClick={() => setSelectedVideoId(video.id)} aria-pressed={selectedVideoId === video.id}>
              <span className="video-option-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={video.thumbnailUrl} alt="" />
                {selectedVideoId === video.id && <i>✓</i>}
              </span>
              <strong>{video.title}</strong><small>{formatViews(video.views)} views</small>
            </button>) : <div className="video-picker-state">No matching videos found.</div>}
          </div>
          <footer><button className="video-cancel" type="button" onClick={() => setVideoPickerOpen(false)}>Cancel</button><button className="video-continue" type="button" onClick={attachSelectedYouTubeVideo} disabled={!selectedVideoId}>Add video</button></footer>
        </section>
      </div>}

      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
