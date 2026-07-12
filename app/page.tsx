"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Tone = "Curious" | "Bold" | "Useful" | "Story-led";

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
};

type Draft = {
  id: string;
  createdAt: string;
  topic: string;
  titles: GeneratedTitle[];
  research?: Research;
};

const TONES: Tone[] = ["Curious", "Bold", "Useful", "Story-led"];
const SAVED_KEY = "stanley-saved-titles";
const DRAFTS_KEY = "stanley-title-drafts";

const PROMPTS = [
  { icon: "✎", label: "Turn my experiment into a story", value: "I ran a 30-day experiment and tracked the honest results" },
  { icon: "✦", label: "Find a surprising angle", value: "Help me find the counterintuitive angle in my next YouTube video" },
];

const NAV_ITEMS = [
  ["✦", "Title generator"],
  ["⌁", "Write"],
  ["□", "Content calendar"],
  ["↗", "Insights"],
  ["◇", "Integrations"],
  ["◷", "Rituals"],
];

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function Home() {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState<Tone>("Curious");
  const [references, setReferences] = useState("");
  const [titles, setTitles] = useState<GeneratedTitle[]>([]);
  const [research, setResearch] = useState<Research | null>(null);
  const [saved, setSaved] = useState<GeneratedTitle[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activeTab, setActiveTab] = useState<"generated" | "saved">("generated");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSaved(readStorage<GeneratedTitle[]>(SAVED_KEY, []));
      setDrafts(readStorage<Draft[]>(DRAFTS_KEY, []));
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

  const visibleTitles = activeTab === "generated" ? titles : saved;
  const savedIds = useMemo(() => new Set(saved.map((item) => item.id)), [saved]);
  const hasResults = titles.length > 0 || activeTab === "saved";

  async function generateTitles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTopic = topic.trim();
    if (cleanTopic.length < 8) {
      setError("Give Stanley a little more detail about the video.");
      return;
    }

    setLoading(true);
    setError("");
    setActiveTab("generated");

    try {
      const response = await fetch("/api/generate-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: cleanTopic, audience: audience.trim(), tone, references: references.trim() }),
      });
      const payload = (await response.json()) as { titles?: GeneratedTitle[]; research?: Research; error?: string };
      if (!response.ok || !payload.titles) throw new Error(payload.error || "The titles did not make it back. Try again.");

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
        const next = [newDraft, ...current].slice(0, 6);
        window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
        return next;
      });
      setNotice("12 fresh titles drafted");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(value: string, message = "Copied to clipboard") {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(message);
    } catch {
      setError("Clipboard access is blocked in this browser.");
    }
  }

  function toggleSaved(item: GeneratedTitle) {
    setSaved((current) => {
      const next = current.some((savedTitle) => savedTitle.id === item.id)
        ? current.filter((savedTitle) => savedTitle.id !== item.id)
        : [item, ...current];
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      return next;
    });
    setNotice(savedIds.has(item.id) ? "Removed from saved" : "Saved for later");
  }

  function openDraft(draft: Draft) {
    setTopic(draft.topic);
    setTitles(draft.titles);
    setResearch(draft.research || null);
    setActiveTab("generated");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="app-shell" id="top">
      <aside className="sidebar">
        <a className="wordmark" href="#top" aria-label="Stanley title lab home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/stanley-mascot.png" alt="" width="58" height="58" />
          <span>Stanley</span>
        </a>

        <nav aria-label="Stanley tools">
          {NAV_ITEMS.map(([icon, label], index) => index === 0 ? (
            <a className="nav-item active" href="#composer" key={label}>
              <span aria-hidden="true">{icon}</span>{label}
            </a>
          ) : (
            <div className="nav-item unavailable" aria-disabled="true" key={label}>
              <span aria-hidden="true">{icon}</span>{label}<small>Soon</small>
            </div>
          ))}
        </nav>

        <button className="saved-shortcut" type="button" onClick={() => setActiveTab("saved") }>
          <span aria-hidden="true">♡</span> Saved titles <strong>{saved.length}</strong>
        </button>

        {drafts.length > 0 && (
          <section className="recent-drafts" aria-labelledby="recent-heading">
            <h2 id="recent-heading">Recent conversations</h2>
            {drafts.slice(0, 4).map((draft) => (
              <button type="button" key={draft.id} onClick={() => openDraft(draft)}>
                <span>{draft.topic}</span>
                <small>{formatTime(draft.createdAt)}</small>
              </button>
            ))}
          </section>
        )}

        <div className="sidebar-foot">
          <span className="model-chip"><i /> Gemini 3.1 Flash-Lite</span>
          <p>Research connected</p>
        </div>
      </aside>

      <section className="main-panel">
        <header className="main-header">
          <div><span className="header-icon" aria-hidden="true">◯</span> Conversations</div>
          <button className="mobile-saved" type="button" onClick={() => setActiveTab("saved")}>Saved <strong>{saved.length}</strong></button>
        </header>

        <div className={hasResults ? "content results-mode" : "content"}>
          {!hasResults && (
            <section className="welcome" aria-labelledby="welcome-title">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="hero-mascot" src="/stanley-mascot.png" alt="Stanley, your AI YouTube strategist" width="228" height="228" />
              <h1 id="welcome-title">Ask Stanley</h1>
              <p>Your AI YouTube title strategist</p>
            </section>
          )}

          {hasResults && activeTab === "generated" && (
            <div className="results-intro">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/stanley-mascot.png" alt="" width="72" height="72" />
              <div><span>Stanley&apos;s title draft</span><h1>12 angles worth clicking</h1></div>
            </div>
          )}

          <form className={hasResults ? "brief-form compact" : "brief-form"} id="composer" onSubmit={generateTitles}>
            <div className="composer">
              <span className="composer-plus" aria-hidden="true">+</span>
              <label className="sr-only" htmlFor="topic">What is the video about?</label>
              <textarea
                id="topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="What is your next video about?"
                maxLength={900}
                rows={hasResults ? 2 : 1}
              />
              <button className="generate-button" type="submit" disabled={loading} aria-label={loading ? "Drafting hooks…" : "Generate 12 titles"}>
                <span aria-hidden="true">{loading ? "···" : "↑"}</span>
              </button>
            </div>

            <details className="brief-options">
              <summary>Fine-tune the brief <span>Audience, tone & references</span><b aria-hidden="true">+</b></summary>
              <div className="options-grid">
                <div>
                  <label htmlFor="audience">Who is it for? <span>optional</span></label>
                  <input id="audience" value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="e.g. busy creators in their 20s" maxLength={180} />
                </div>
                <fieldset>
                  <legend>Writing style</legend>
                  <div className="tone-grid">
                    {TONES.map((item) => (
                      <button className={tone === item ? "tone active" : "tone"} key={item} type="button" onClick={() => setTone(item)} aria-pressed={tone === item}>{item}</button>
                    ))}
                  </div>
                </fieldset>
                <div className="reference-field">
                  <label htmlFor="references">Title references <span>optional</span></label>
                  <textarea id="references" value={references} onChange={(event) => setReferences(event.target.value)} placeholder="Paste titles whose rhythm you like, one per line." maxLength={700} rows={3} />
                </div>
              </div>
            </details>
            <div className="composer-meta"><span>Researches real YouTube winners</span><span>Typical AI cost under $0.003</span></div>
            {error && <p className="form-error" role="alert">{error}</p>}
          </form>

          {!hasResults && (
            <div className="prompt-row">
              {PROMPTS.map((prompt) => <button type="button" key={prompt.label} onClick={() => setTopic(prompt.value)}><span aria-hidden="true">{prompt.icon}</span>{prompt.label}</button>)}
            </div>
          )}

          {loading ? (
            <div className="loading-sheet">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/stanley-mascot.png" alt="" width="92" height="92" />
              <h2>Working the angles</h2>
              <p>Studying successful videos, then testing curiosity, stakes, specificity, and story.</p>
              <div className="loading-line" /><div className="loading-line short" /><div className="loading-line" />
            </div>
          ) : hasResults && (
            <section className="results" aria-live="polite">
              <div className="results-toolbar">
                <div className="tabs" role="tablist" aria-label="Title lists">
                  <button role="tab" aria-selected={activeTab === "generated"} className={activeTab === "generated" ? "active" : ""} onClick={() => setActiveTab("generated")}>Fresh ideas <span>{titles.length || "—"}</span></button>
                  <button role="tab" aria-selected={activeTab === "saved"} className={activeTab === "saved" ? "active" : ""} onClick={() => setActiveTab("saved")}>Saved <span>{saved.length}</span></button>
                </div>
                {visibleTitles.length > 0 && <button className="copy-all" type="button" onClick={() => copyText(visibleTitles.map((item, index) => `${index + 1}. ${item.title}`).join("\n"), "All titles copied")}>Copy all</button>}
              </div>

              {activeTab === "generated" && research && (
                <details className="research-card">
                  <summary><span className="research-status"><i /> Evidence used</span><strong>{research.analyzed} comparable videos analyzed for “{research.query}”</strong><span className="research-open">View sources +</span></summary>
                  <div className="research-sources">
                    {research.examples.map((video) => <a href={video.url} target="_blank" rel="noreferrer" key={video.id}><span>{video.title}</span><small>{video.channel} · {video.views.toLocaleString()} views · {video.viewsPerDay.toLocaleString()}/day</small></a>)}
                  </div>
                </details>
              )}

              {visibleTitles.length > 0 ? (
                <div className="title-list">
                  {visibleTitles.map((item, index) => (
                    <article className="title-card" key={item.id}>
                      <div className="card-number">{String(index + 1).padStart(2, "0")}</div>
                      <div className="card-content"><div className="card-meta"><span className="angle-tag">{item.angle}</span><span>{item.characterCount} characters</span></div><h2>{item.title}</h2><p>{item.whyItWorks}</p></div>
                      <div className="card-actions"><button type="button" onClick={() => copyText(item.title)} aria-label={`Copy: ${item.title}`}>Copy</button><button type="button" className={savedIds.has(item.id) ? "saved" : ""} onClick={() => toggleSaved(item)} aria-label={savedIds.has(item.id) ? `Unsave: ${item.title}` : `Save: ${item.title}`}>{savedIds.has(item.id) ? "Saved" : "Save"}</button></div>
                    </article>
                  ))}
                </div>
              ) : <div className="saved-empty"><span>♡</span><h2>No saved titles yet.</h2><p>Save the strongest options from any draft and they&apos;ll stay on this device.</p></div>}
            </section>
          )}
        </div>
      </section>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
