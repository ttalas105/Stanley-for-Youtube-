# Stanley for YouTube

Stanley is a conversational YouTube creative partner. It can develop video ideas, titles, scripts, and thumbnail directions while choosing when current channel or reference-video evidence is actually useful.

## What works today

- Unified responsive chat for ideas, titles, scripts, and thumbnail concepts
- Gemini 3.1 Flash-Lite behind a provider-neutral adapter
- A bounded agent loop with three read-only YouTube tools
- Connected-channel OAuth, private channel snapshots, and recent-video selection
- Current comparable-video search with source freshness and coverage metadata
- Exact video metadata inspection with honest transcript limitations
- Cross-chat creator memory plus project-specific conversation memory
- Image, short-video, microphone, and YouTube-video attachments
- Strict server-side tool validation, timeouts, duplicate-read memoization, and loop breakers
- Inspectable research sources and safe agent run IDs

## Local setup

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Copy `.env.example` to `.env.local` and configure the services you want to use:

```env
GEMINI_API_KEY=...
YOUTUBE_API_KEY=...
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
OAUTH_SESSION_SECRET=...
```

Gemini is required. The public YouTube key should be restricted to YouTube Data API v3. OAuth credentials enable the optional connected-channel experience and use read-only YouTube and YouTube Analytics scopes. Keep every value server-side.

## Commands

```bash
npm run dev
npm run lint
npm test
npm run test:e2e
npm run test:agent
npm run build
```

The Playwright suite covers the full chat, attachments, onboarding, OAuth states, persistence, keyboard behavior, failures, and responsive layout. The agent suite covers tool selection, schema failures, timeout and round containment, memoization, and structured completion. For interactive browser debugging, use `npm run test:e2e:ui`; for a visible run, use `npm run test:e2e:headed`.

Ten versioned live-model scenarios are included but are deliberately cost-gated. With localhost running, execute them only after approving real Gemini and YouTube usage:

```bash
# PowerShell
$env:RUN_LIVE_AGENT_EVALS="1"
npm run eval:agent
```

## Cost and quota

Gemini 3.1 Flash-Lite is currently listed at $0.25 per million input tokens and $1.50 per million output tokens. Agent turns can contain multiple model rounds, so actual cost depends on conversation length, evidence calls, and output size. Safe traces record normalized token usage for every run.

YouTube Data API uses quota rather than token billing. Google currently gives `search.list` its own 100-calls-per-day bucket at one unit per call, while `videos.list` costs one unit from the general allocation. Check the Google Cloud quota page because limits can vary by project and policy revision.

## Architecture

The browser sends the conversation, selected mode, and bounded attachments to `/api/generate-titles`. A fail-closed scope preflight protects the product boundary, then one generic kernel gives Gemini three explicit read tools:

1. `youtube_channel_snapshot`
2. `youtube_search_reference_videos`
3. `youtube_get_video_evidence`

Gemini decides whether to call them or answer directly. The runtime validates every argument, enforces deadlines and tool budgets, executes authorized reads, and returns typed evidence envelopes. Ideas, titles, scripts, comparisons, and thumbnail briefs remain model output rather than artificial tools. API keys and OAuth tokens never leave the server.
