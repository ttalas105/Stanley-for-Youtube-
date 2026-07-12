"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

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
  thumbnails?: ThumbnailConcept[];
  research?: Research;
  blocked?: boolean;
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
  mode?: Exclude<CreationMode, "auto">;
  titles?: GeneratedTitle[];
  ideas?: GeneratedIdea[];
  thumbnails?: ThumbnailConcept[];
  research?: Research;
  conversationTopic?: string;
  blocked?: boolean;
  error?: string;
};

const DRAFTS_KEY = "stanley-title-drafts";
const MAX_USER_TURNS = 9;
const STANLEY_LOGO = "https://stanbrandhub.lovable.app/downloads/Stanley_Logo_Lockup_Dark.png";

const NAV_ITEMS = [
  { icon: "spark", label: "Create", active: true },
  { icon: "outlier", label: "Outliers", badge: true },
  { icon: "extension", label: "Chrome extension" },
];

const MODE_OPTIONS: Array<{ value: CreationMode; label: string; icon: string }> = [
  { value: "auto", label: "Auto", icon: "✦" },
  { value: "idea", label: "Ideas", icon: "◇" },
  { value: "title", label: "Titles", icon: "T" },
  { value: "thumbnail", label: "Thumbnails", icon: "▣" },
];

const MODE_PLACEHOLDERS: Record<CreationMode, string> = {
  auto: "Message Stanley…",
  idea: "What kind of videos do you want to make?",
  title: "What is the video about?",
  thumbnail: "Describe the video or title you need a thumbnail for…",
};

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
  if (message.role === "user") return { role: message.role, content: message.content };
  const artifactLines = message.titles?.length
    ? `Title options:\n${message.titles.map((item, index) => `${index + 1}. ${item.title}`).join("\n")}`
    : message.ideas?.length
      ? `Idea options:\n${message.ideas.map((item, index) => `${index + 1}. ${item.idea}`).join("\n")}`
      : message.thumbnails?.length
        ? `Thumbnail concepts:\n${message.thumbnails.map((item, index) => `${index + 1}. ${item.concept}: ${item.visual}`).join("\n")}`
        : "";
  return { role: message.role, content: artifactLines ? `${message.content}\n${artifactLines}` : message.content };
}

function ModePicker({ mode, onChange, disabled }: { mode: CreationMode; onChange: (mode: CreationMode) => void; disabled?: boolean }) {
  return (
    <div className="mode-picker" aria-label="Creation mode">
      {MODE_OPTIONS.map((option) => (
        <button type="button" key={option.value} className={mode === option.value ? "mode-option selected" : "mode-option"} aria-pressed={mode === option.value} disabled={disabled} onClick={() => onChange(option.value)}>
          <span aria-hidden="true">{option.icon}</span>{option.label}
        </button>
      ))}
    </div>
  );
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

export default function Home() {
  const topicRef = useRef<HTMLTextAreaElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<CreationMode>("auto");
  const [originalTopic, setOriginalTopic] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDrafts(readDrafts());
      document.documentElement.dataset.stanleyReady = "true";
    }, 0);
    return () => {
      window.clearTimeout(timer);
      delete document.documentElement.dataset.stanleyReady;
    };
  }, []);

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
        messages: nextMessages,
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

    const isFirstMessage = messages.length === 0;
    const rootTopic = isFirstMessage ? cleanMessage : originalTopic;
    const activeSessionId = sessionId || crypto.randomUUID();
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: cleanMessage };
    const pendingMessages = [...messages, userMessage];

    setLoading(true);
    setError("");
    setTopic("");
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
          ...(isFirstMessage ? {} : { messages: pendingMessages.map(serializeMessage) }),
        }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.reply) throw new Error(payload.error || "Stanley could not finish that response. Try again.");

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: payload.reply,
        mode: payload.mode,
        titles: payload.titles,
        ideas: payload.ideas,
        thumbnails: payload.thumbnails,
        research: payload.research,
        blocked: payload.blocked,
      };
      const completedMessages = [...pendingMessages, assistantMessage];
      const completedTopic = payload.conversationTopic?.trim() || rootTopic;
      setMessages(completedMessages);
      if (completedTopic !== originalTopic) setOriginalTopic(completedTopic);
      persistConversation(activeSessionId, completedTopic, completedMessages);
      if (payload.mode) setMode(payload.mode);
      const artifactCount = payload.titles?.length || payload.ideas?.length || payload.thumbnails?.length || 0;
      setNotice(payload.blocked ? "Request kept inside creation mode" : artifactCount ? `${artifactCount} options ready` : "Stanley replied");
    } catch (caught) {
      setMessages(messages);
      setTopic(cleanMessage);
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

  function openDraft(draft: Draft) {
    setSessionId(draft.id);
    setOriginalTopic(draft.topic);
    setMessages(restoreMessages(draft));
    setTopic("");
    setMode("auto");
    setError("");
    window.setTimeout(() => topicRef.current?.focus(), 250);
  }

  function startNewChat() {
    setTopic("");
    setMode("auto");
    setOriginalTopic("");
    setSessionId("");
    setMessages([]);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => topicRef.current?.focus(), 0);
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!event.currentTarget.value.trim() || loading) return;
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
  const modeLabel = MODE_OPTIONS.find((option) => option.value === mode)?.label || "Auto";

  return (
    <main className="app-shell" id="top">
      <aside className="sidebar">
        <a className="wordmark" href="#top" aria-label="Stanley home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={STANLEY_LOGO} alt="Stanley" width="174" height="52" />
        </a>

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
      </aside>

      <section className="main-panel">
        <header className="main-header">
          <span>Create</span>
          <span className="mode-indicator"><i aria-hidden="true" /> {modeLabel} mode</span>
        </header>

        <div className={inConversation ? "content conversation-mode" : "content"}>
          {!inConversation ? (
            <>
              <section className="welcome" aria-labelledby="welcome-title">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="hero-mascot" src="/stanley-mascot.png" alt="" width="112" height="112" />
                <h1 id="welcome-title">What&apos;s on your mind today?</h1>
                <p>Tell Stanley what you&apos;re making. It will detect whether you need an idea, title, or thumbnail concept.</p>
              </section>

              <form className="brief-form unified-composer" id="composer" onSubmit={sendMessage}>
                <div className="composer composer-large">
                  <label className="sr-only" htmlFor="topic">Message Stanley</label>
                  <textarea ref={topicRef} id="topic" value={topic} onChange={(event) => setTopic(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder={MODE_PLACEHOLDERS[mode]} maxLength={900} rows={2} />
                  <div className="composer-toolbar">
                    <ModePicker mode={mode} onChange={setMode} disabled={loading} />
                    <button className="generate-button" type="submit" disabled={!topic.trim() || loading} aria-label="Send message"><span className="send-arrow" aria-hidden="true" /></button>
                  </div>
                </div>
                {error && <p className="form-error" role="alert">{error}</p>}
                <p className="composer-hint">Stanley creates YouTube ideas, titles, and thumbnail concepts.</p>
              </form>
            </>
          ) : (
            <section className="conversation" aria-live="polite">
              {messages.map((message) => message.role === "user" ? (
                <div className="user-message" key={message.id}>{message.content}</div>
              ) : (
                <article className={message.blocked ? "assistant-message blocked" : "assistant-message"} key={message.id}>
                  <div className="assistant-lead">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/stanley-mascot.png" alt="" width="48" height="48" />
                    <div>
                      {message.blocked && <span className="boundary-label">Creation boundary</span>}
                      {message.ideas?.length ? <h1>Video ideas</h1> : null}
                      {message.titles?.length ? <h1>Title directions</h1> : null}
                      {message.thumbnails?.length ? <h1>Thumbnail concepts</h1> : null}
                      <p>{message.content}</p>
                    </div>
                  </div>

                  {message.ideas?.length ? <div className="creation-list idea-list">{message.ideas.map((item, index) => (
                    <article className="creation-item" key={item.id}><span className="card-number">{String(index + 1).padStart(2, "0")}</span><div><h2>{item.idea}</h2><p><strong>Hook:</strong> {item.hook}</p><p>{item.whyItCouldWork}</p></div></article>
                  ))}</div> : null}

                  {message.titles?.length ? <div className="creation-list title-list">{message.titles.map((item, index) => (
                    <article className="creation-item title-card" key={item.id}><span className="card-number">{String(index + 1).padStart(2, "0")}</span><div className="card-content"><span className="angle-tag">{item.angle}</span><h2>{item.title}</h2><p>{item.whyItWorks}</p></div></article>
                  ))}</div> : null}

                  {message.thumbnails?.length ? <div className="thumbnail-list">{message.thumbnails.map((item, index) => (
                    <article className="thumbnail-item" key={item.id}>
                      <div className="thumbnail-preview"><span>{item.textOverlay === "No text" ? "" : item.textOverlay}</span></div>
                      <div><span className="angle-tag">Concept {String(index + 1).padStart(2, "0")}</span><h2>{item.concept}</h2><p>{item.visual}</p><p><strong>Why it works:</strong> {item.whyItWorks}</p></div>
                    </article>
                  ))}</div> : null}

                  {message.research && (
                    <details className="research-card">
                      <summary><span className={`research-status ${message.research.coverage || "strong"}`}><i /> {message.research.coverage === "limited" ? "Limited evidence" : message.research.coverage === "none" ? "Broad guidance" : "Evidence used"}</span><strong>{message.research.analyzed > 0 ? `${message.research.analyzed} videos analyzed for “${message.research.query}”` : `No close matches found for “${message.research.query}”`}</strong>{message.research.examples.length > 0 && <span className="research-open">Sources +</span>}</summary>
                      <div className="research-sources">{message.research.examples.map((video) => <a href={video.url} target="_blank" rel="noreferrer" key={video.id}><span>{video.title}</span><small>{video.channel} · {video.views.toLocaleString()} views</small></a>)}</div>
                    </details>
                  )}

                  <div className="assistant-actions">
                    <button className="copy-response" type="button" onClick={() => copyText(message.content, "Response copied")} aria-label="Copy response"><span className="copy-icon" aria-hidden="true" /> Copy</button>
                    {message.titles?.length ? <button className="copy-response" type="button" onClick={() => copyText(message.titles!.map((item, index) => `${index + 1}. ${item.title}`).join("\n"), "Titles copied")} aria-label="Copy all titles"><span className="copy-icon" aria-hidden="true" /> Copy titles</button> : null}
                    {message.ideas?.length ? <button className="copy-response" type="button" onClick={() => copyText(message.ideas!.map((item, index) => `${index + 1}. ${item.idea}\nHook: ${item.hook}`).join("\n\n"), "Ideas copied")} aria-label="Copy all ideas"><span className="copy-icon" aria-hidden="true" /> Copy ideas</button> : null}
                    {message.thumbnails?.length ? <button className="copy-response" type="button" onClick={() => copyText(message.thumbnails!.map((item, index) => `${index + 1}. ${item.concept}\nVisual: ${item.visual}\nText: ${item.textOverlay}`).join("\n\n"), "Thumbnail concepts copied")} aria-label="Copy all thumbnail concepts"><span className="copy-icon" aria-hidden="true" /> Copy concepts</button> : null}
                  </div>
                </article>
              ))}

              {loading && <div className="assistant-thinking" role="status" aria-label="Stanley is thinking"><span className="thinking-spinner" /></div>}
              <div ref={conversationEndRef} aria-hidden="true" />
            </section>
          )}
        </div>

        {inConversation && (
          <form className="conversation-composer" id="composer" onSubmit={sendMessage}>
            <div className="composer-stack">
              <div className="composer">
                <label className="sr-only" htmlFor="chat-topic">Message Stanley</label>
                <textarea ref={topicRef} id="chat-topic" value={topic} onChange={(event) => setTopic(event.target.value)} onKeyDown={handleComposerKeyDown} disabled={chatLimitReached} placeholder={chatLimitReached ? "Start a new chat to keep working" : MODE_PLACEHOLDERS[mode]} maxLength={1200} rows={1} />
                <div className="composer-toolbar">
                  <ModePicker mode={mode} onChange={setMode} disabled={loading || chatLimitReached} />
                  <button className="generate-button" type="submit" disabled={!topic.trim() || loading || chatLimitReached} aria-label="Send message"><span className="send-arrow" aria-hidden="true" /></button>
                </div>
              </div>
              <div className="composer-meta">{error ? <p className="form-error" role="alert">{error}</p> : <p>Stanley can create ideas, titles, and thumbnail concepts. Unrelated tasks stay blocked.</p>}<span>{userTurns}/{MAX_USER_TURNS}</span></div>
            </div>
          </form>
        )}
      </section>

      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
