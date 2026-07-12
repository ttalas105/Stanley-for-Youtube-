# Stanley for YouTube

Stanley is an evidence-based YouTube title generator. It researches real comparable videos, ranks long-form examples by views per day, and uses those winning packaging patterns to draft twelve original titles with Gemini.

## What works today

- Light notebook-style responsive title lab
- YouTube Data API research using relevant videos from the last three years
- View-velocity ranking with Shorts filtered out
- Gemini 3.1 Flash-Lite structured title generation
- Inspectable research sources for every generation
- Copy one/all, save favorites, and reopen recent drafts
- Device-local saved titles and draft history
- Server-only API keys, input validation, and lightweight rate limiting

## Local setup

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add two restricted server keys to `.env.local`:

```env
GEMINI_API_KEY=...
YOUTUBE_API_KEY=...
```

The Gemini key needs access to the Gemini API. The YouTube key should be restricted to YouTube Data API v3. Do not expose either key to browser code.

## Commands

```bash
npm run dev
npm run lint
npm test
npm run test:e2e
npm run build
```

The Playwright suite runs 18 Chromium scenarios covering form validation, request payloads, loading and API failures, research evidence, copying, saved-title persistence, recent drafts, keyboard behavior, and mobile overflow. For interactive debugging, use `npm run test:e2e:ui`; for a visible browser run, use `npm run test:e2e:headed`.

## Cost and quota

Gemini 3.1 Flash-Lite is currently $0.25 per million input tokens and $1.50 per million output tokens. A normal Stanley generation is designed to cost under $0.003.

YouTube Data API uses quota rather than usage billing. A fresh research query costs approximately 101 units (100 for search and 1 for video statistics). Identical research queries are cached in each running server instance for six hours. Google's standard 10,000-unit allocation supports about 99 uncached research queries per day.

## Architecture

The browser sends only the creator brief to `/api/generate-titles`. The server derives a focused search query, retrieves and ranks comparable YouTube videos, then sends the brief plus the strongest research patterns to Gemini using a strict JSON schema. API keys never leave the server. Saved titles and history remain in local storage.
