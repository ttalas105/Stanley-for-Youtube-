"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

type GeneratedTitle = {
  id: string;
  title: string;
  angle: string;
  whyItWorks: string;
  characterCount: number;
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

type Draft = {
  id: string;
  createdAt: string;
  topic: string;
  titles: GeneratedTitle[];
  research?: Research;
};

const DRAFTS_KEY = "stanley-title-drafts";

const NAV_ITEMS = [
  { icon: "✦", label: "Idea generator" },
  { icon: "T", label: "Title generator", active: true },
  { icon: "▣", label: "Thumbnail generator" },
  { icon: "10.4×", label: "Outliers", badge: true },
  { icon: "✚", label: "Chrome extension" },
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

export default function Home() {
  const topicRef = useRef<HTMLTextAreaElement>(null);
  const [topic, setTopic] = useState("");
  const [submittedTopic, setSubmittedTopic] = useState("");
  const [titles, setTitles] = useState<GeneratedTitle[]>([]);
  const [research, setResearch] = useState<Research | null>(null);
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
  }, [topic]);

  async function generateTitles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTopic = topic.trim();
    if (!cleanTopic) return;

    setLoading(true);
    setError("");
    setSubmittedTopic(cleanTopic);

    try {
      const response = await fetch("/api/generate-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: cleanTopic }),
      });
      const payload = (await response.json()) as { titles?: GeneratedTitle[]; research?: Research; error?: string };
      if (!response.ok || !payload.titles) throw new Error(payload.error || "Stanley could not finish this draft. Try again.");

      setTitles(payload.titles);
      setResearch(payload.research || null);
      const newDraft: Draft = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        topic: cleanTopic,
        titles: payload.titles,
        research: payload.research,
      };
      setDrafts((current) => {
        const next = [newDraft, ...current].slice(0, 8);
        window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
        return next;
      });
      setNotice("12 titles ready");
    } catch (caught) {
      setSubmittedTopic("");
      setError(caught instanceof Error ? caught.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(value: string, message = "Title copied") {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(message);
    } catch {
      setError("Clipboard access is blocked in this browser.");
    }
  }

  function openDraft(draft: Draft) {
    setTopic(draft.topic);
    setSubmittedTopic(draft.topic);
    setTitles(draft.titles);
    setResearch(draft.research || null);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startNewChat() {
    setTopic("");
    setSubmittedTopic("");
    setTitles([]);
    setResearch(null);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => topicRef.current?.focus(), 0);
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!event.currentTarget.value.trim()) return;
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

  const hasResults = titles.length > 0;
  const inConversation = Boolean(submittedTopic);
  const angleLabels = Array.from(new Set(titles.map((item) => item.angle))).slice(0, 4);

  return (
    <main className="app-shell" id="top">
      <aside className="sidebar">
        <a className="wordmark" href="#top" aria-label="Stanley title lab home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/stanley-mascot.png" alt="" width="48" height="48" />
          <span>Stanley</span>
        </a>

        <nav aria-label="Stanley tools">
          {NAV_ITEMS.map((item) => (
            <div className={item.active ? "nav-item active" : "nav-item"} key={item.label}>
              <button className="nav-tool-button" type="button" onClick={() => openTool(item.label, item.active)} aria-current={item.active ? "page" : undefined}>
                <span className={item.badge ? "nav-badge" : "nav-icon"} aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </button>
              {item.active && <button className="nav-new-chat" type="button" onClick={startNewChat} aria-label="Start new title chat"><span aria-hidden="true">✎</span></button>}
            </div>
          ))}
        </nav>

        <section className="title-history" aria-labelledby="history-heading">
          <h2 id="history-heading">Title history</h2>
          {drafts.length > 0 ? drafts.slice(0, 6).map((draft) => (
            <button type="button" key={draft.id} onClick={() => openDraft(draft)}>
              <span>{draft.topic}</span>
              <small>{formatTime(draft.createdAt)}</small>
            </button>
          )) : <p>Your generated title sessions will appear here.</p>}
        </section>
      </aside>

      <section className="main-panel">
        <header className="main-header">Title generator</header>

        <div className={inConversation ? "content conversation-mode" : "content"}>
          {!inConversation ? (
            <>
              <section className="welcome" aria-labelledby="welcome-title">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="hero-mascot" src="/stanley-mascot.png" alt="Stanley, your AI YouTube strategist" width="132" height="132" />
                <h1 id="welcome-title">What&apos;s your video about?</h1>
                <p>Describe the idea. Stanley will study what works and draft 12 title angles.</p>
              </section>

              <form className="brief-form" id="composer" onSubmit={generateTitles}>
                <div className="composer">
                  <label className="sr-only" htmlFor="topic">What is the video about?</label>
                  <textarea
                    ref={topicRef}
                    id="topic"
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="e.g. I tested five AI note-taking apps for 30 days…"
                    maxLength={900}
                    rows={1}
                  />
                  <button className="generate-button" type="submit" disabled={!topic.trim()} aria-label="Generate 12 titles">
                    <span className="send-arrow" aria-hidden="true" />
                  </button>
                </div>
                {error && <p className="form-error" role="alert">{error}</p>}
              </form>
            </>
          ) : (
            <>
              <section className="conversation" aria-live="polite">
                <div className="user-message">{submittedTopic}</div>

                {hasResults && (
                  <article className="assistant-message">
                    <div className="assistant-lead">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/stanley-mascot.png" alt="" width="48" height="48" />
                      <div>
                        <h1>Here are 12 directions.</h1>
                        <p>
                          {research?.analyzed
                            ? `I reviewed ${research.analyzed} comparable videos and used those patterns as evidence.`
                            : "I used broader YouTube packaging principles because close comparisons were limited."}
                          {angleLabels.length > 0 && ` The options explore ${angleLabels.join(", ")}.`}
                        </p>
                      </div>
                    </div>

                    <div className="title-list">
                      {titles.map((item, index) => (
                        <article className="title-card" key={item.id}>
                          <div className="card-number">{String(index + 1).padStart(2, "0")}</div>
                          <div className="card-content"><span className="angle-tag">{item.angle}</span><h2>{item.title}</h2><p>{item.whyItWorks}</p></div>
                        </article>
                      ))}
                    </div>

                    {research && (
                      <details className="research-card">
                        <summary><span className={`research-status ${research.coverage || "strong"}`}><i /> {research.coverage === "limited" ? "Limited evidence" : research.coverage === "none" ? "Broad guidance" : "Evidence used"}</span><strong>{research.analyzed > 0 ? `${research.analyzed} videos analyzed for “${research.query}”` : `No close matches found for “${research.query}”`}</strong>{research.examples.length > 0 && <span className="research-open">Sources +</span>}</summary>
                        <div className="research-sources">
                          {research.examples.map((video) => <a href={video.url} target="_blank" rel="noreferrer" key={video.id}><span>{video.title}</span><small>{video.channel} · {video.views.toLocaleString()} views</small></a>)}
                        </div>
                      </details>
                    )}

                    <div className="assistant-actions">
                      <button className="copy-response" type="button" onClick={() => copyText(titles.map((item, index) => `${index + 1}. ${item.title}`).join("\n"), "Titles copied")} aria-label="Copy all titles">
                        <span className="copy-icon" aria-hidden="true" /> Copy titles
                      </button>
                    </div>
                  </article>
                )}
              </section>

              <div className="conversation-composer" aria-label="Current title chat is complete">
                <div className="composer locked">
                  <label className="sr-only" htmlFor="locked-composer">Start a new chat to create another title set</label>
                  <textarea id="locked-composer" disabled placeholder="Start a new chat to create another title set" rows={1} />
                  <button className={loading ? "generate-button loading" : "generate-button"} type="button" disabled aria-label={loading ? "Generating titles" : "Chat complete"}>
                    <span className="send-arrow" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
