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
  const date = new Date(value);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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
        body: JSON.stringify({
          topic: cleanTopic,
          audience: audience.trim(),
          tone,
          references: references.trim(),
        }),
      });

      const payload = (await response.json()) as {
        titles?: GeneratedTitle[];
        research?: Research;
        error?: string;
      };

      if (!response.ok || !payload.titles) {
        throw new Error(payload.error || "The titles did not make it back. Try again.");
      }

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
    if (savedIds.has(item.id)) {
      setSaved((current) => {
        const next = current.filter((savedTitle) => savedTitle.id !== item.id);
        window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
        return next;
      });
      setNotice("Removed from saved");
    } else {
      setSaved((current) => {
        const next = [item, ...current];
        window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
        return next;
      });
      setNotice("Saved for later");
    }
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
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Stanley title lab home">
          <span className="wordmark-mark">S</span>
          <span>Stanley</span>
          <em>title lab</em>
        </a>
        <div className="topbar-meta">
          <span className="model-chip"><i /> Gemini 3.1 Flash-Lite</span>
          <button className="saved-shortcut" type="button" onClick={() => setActiveTab("saved")}>
            Saved <strong>{saved.length}</strong>
          </button>
        </div>
      </header>

      <section className="workspace" id="top">
        <aside className="brief-column">
          <div className="kicker"><span>01</span> Title generator</div>
          <h1>Find the title<br />before you film.</h1>
          <p className="intro-copy">
            Give Stanley the raw idea. Get twelve sharp YouTube titles built around different reasons to click.
          </p>

          <form className="brief-form" onSubmit={generateTitles}>
            <label className="field-label" htmlFor="topic">
              What is the video about? <span>required</span>
            </label>
            <div className="textarea-wrap">
              <textarea
                id="topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="e.g. I tried waking up at 5am for 30 days and tracked what changed..."
                maxLength={900}
                rows={5}
              />
              <small>{topic.length}/900</small>
            </div>

            <label className="field-label" htmlFor="audience">
              Who is it for? <span>optional</span>
            </label>
            <input
              id="audience"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              placeholder="e.g. busy creators in their 20s"
              maxLength={180}
            />

            <fieldset>
              <legend className="field-label">Writing style</legend>
              <div className="tone-grid">
                {TONES.map((item) => (
                  <button
                    className={tone === item ? "tone active" : "tone"}
                    key={item}
                    type="button"
                    onClick={() => setTone(item)}
                    aria-pressed={tone === item}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </fieldset>

            <details className="reference-details">
              <summary>Add title references <span>+</span></summary>
              <label className="sr-only" htmlFor="references">Title references</label>
              <textarea
                id="references"
                value={references}
                onChange={(event) => setReferences(event.target.value)}
                placeholder="Paste 1–5 titles whose rhythm or style you like. One per line."
                maxLength={700}
                rows={3}
              />
            </details>

            <button className="generate-button" type="submit" disabled={loading}>
              <span>{loading ? "Drafting hooks…" : "Generate 12 titles"}</span>
              <b aria-hidden="true">→</b>
            </button>
            <p className="cost-note">Researches real YouTube winners · typical AI cost under $0.003</p>
            {error && <p className="form-error" role="alert">{error}</p>}
          </form>

          {drafts.length > 0 && (
            <section className="recent-drafts" aria-labelledby="recent-heading">
              <div className="section-rule"><h2 id="recent-heading">Recent drafts</h2></div>
              {drafts.slice(0, 4).map((draft) => (
                <button type="button" key={draft.id} onClick={() => openDraft(draft)}>
                  <span>{draft.topic}</span>
                  <small>{formatTime(draft.createdAt)}</small>
                </button>
              ))}
            </section>
          )}
        </aside>

        <section className="results-column" aria-live="polite">
          <div className="results-toolbar">
            <div className="tabs" role="tablist" aria-label="Title lists">
              <button
                role="tab"
                aria-selected={activeTab === "generated"}
                className={activeTab === "generated" ? "active" : ""}
                onClick={() => setActiveTab("generated")}
              >
                Fresh ideas <span>{titles.length || "—"}</span>
              </button>
              <button
                role="tab"
                aria-selected={activeTab === "saved"}
                className={activeTab === "saved" ? "active" : ""}
                onClick={() => setActiveTab("saved")}
              >
                Saved <span>{saved.length}</span>
              </button>
            </div>
            {visibleTitles.length > 0 && (
              <button
                className="copy-all"
                type="button"
                onClick={() => copyText(visibleTitles.map((item, index) => `${index + 1}. ${item.title}`).join("\n"), "All titles copied")}
              >
                Copy all
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading-sheet">
              <div className="pencil-loader"><span /><span /><span /></div>
              <h2>Working the angles</h2>
              <p>Testing curiosity, stakes, specificity, and story.</p>
              {[78, 91, 64, 84].map((width, index) => (
                <div className="loading-line" key={width} style={{ width: `${width}%`, animationDelay: `${index * 120}ms` }} />
              ))}
            </div>
          ) : visibleTitles.length > 0 ? (
            <div className="title-list">
              {activeTab === "generated" && research && (
                <details className="research-card">
                  <summary>
                    <span className="research-status"><i /> Evidence used</span>
                    <strong>{research.analyzed} comparable videos analyzed for “{research.query}”</strong>
                    <span className="research-open">View sources +</span>
                  </summary>
                  <div className="research-sources">
                    {research.examples.map((video) => (
                      <a href={video.url} target="_blank" rel="noreferrer" key={video.id}>
                        <span>{video.title}</span>
                        <small>{video.channel} · {video.views.toLocaleString()} views · {video.viewsPerDay.toLocaleString()}/day</small>
                      </a>
                    ))}
                  </div>
                </details>
              )}
              <div className="margin-note">clickworthy, not clickbait →</div>
              {visibleTitles.map((item, index) => (
                <article className="title-card" key={item.id}>
                  <div className="card-number">{String(index + 1).padStart(2, "0")}</div>
                  <div className="card-content">
                    <div className="card-meta">
                      <span className="angle-tag">{item.angle}</span>
                      <span>{item.characterCount} characters</span>
                    </div>
                    <h2>{item.title}</h2>
                    <p>{item.whyItWorks}</p>
                  </div>
                  <div className="card-actions">
                    <button type="button" onClick={() => copyText(item.title)} aria-label={`Copy: ${item.title}`}>
                      Copy
                    </button>
                    <button
                      type="button"
                      className={savedIds.has(item.id) ? "saved" : ""}
                      onClick={() => toggleSaved(item)}
                      aria-label={savedIds.has(item.id) ? `Unsave: ${item.title}` : `Save: ${item.title}`}
                    >
                      {savedIds.has(item.id) ? "Saved" : "Save"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-sheet">
              <span className="paperclip" aria-hidden="true">⌇</span>
              <p className="hand-note">your next title starts here</p>
              <h2>{activeTab === "saved" ? "No saved titles yet." : "Turn one rough idea into twelve reasons to click."}</h2>
              <p>
                {activeTab === "saved"
                  ? "Save the strongest options from any draft and they’ll stay on this device."
                  : "Stanley varies the psychological angle, keeps the language natural, and explains why each title works."}
              </p>
              {activeTab === "generated" && (
                <div className="angle-preview">
                  <span>Curiosity gap</span><span>Contrarian</span><span>Transformation</span><span>Specific proof</span>
                </div>
              )}
            </div>
          )}
        </section>
      </section>

      <footer>
        <span>Stanley / YouTube title lab</span>
        <span>Ideas stay in your browser. Video briefs are sent only to Gemini for generation.</span>
      </footer>

      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
