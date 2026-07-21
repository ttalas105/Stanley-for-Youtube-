# YouTube Outlier Demo

Chrome MV3 extension and local Express backend for analyzing recent YouTube channel uploads. Project-owned source is TypeScript; browser and Node output is generated JavaScript.

## Install and verify

From this directory:

```bash
npm install
npm run typecheck
npm run build
```

Useful individual commands:

```bash
npm run build:extension
npm run build:server
npm run dev
npm start
```

`npm run dev` runs the TypeScript backend directly. `npm start` runs the compiled backend at `server/dist/server.js`, so run `npm run build:server` first.

Local `*.test.ts` files are intentionally ignored and are not distributed with the repository.

## Configuration

The backend works without OAuth or a YouTube API key by reading the channel's public RSS feed and public watch-page metadata. For the official YouTube Data API path, create `server/.env` from `server/.env.example`:

```text
YOUTUBE_API_KEY=PASTE_KEY_HERE
PORT=3000
# EXTENSION_ID=abcdefghijklmnopqrstuvwxyzabcdef
# SNAPSHOT_FILE=/optional/custom/snapshots.json
```

When configured, the YouTube API key is read only by the backend and takes precedence over the public-data fallback. `PORT` defaults to `3000`; `EXTENSION_ID` optionally restricts CORS to one unpacked extension; `SNAPSHOT_FILE` optionally changes the local snapshot file.

## Load the extension

1. Run `npm run build:extension`.
2. Open `chrome://extensions` and enable Developer Mode.
3. Choose **Load unpacked** and select `extension/dist`.
4. Start the backend with `npm start`.
5. Open the extension once and click **Start**.
6. Browse to a supported YouTube handle or `/channel/UC…` page. Stanley appears in the channel header with an **Analyze this channel** action and adds an outlier ratio beside each video title. The channel analysis covers standout evidence, momentum changes, repeatable patterns, and a prefilled handoff to the Stanley web app.

Successful scans are stored in `server/data/snapshots.json` by default. Growth comparisons require multiple scans at least 30 minutes apart.

## Debugging

- Content UI: the YouTube tab’s DevTools console.
- Service worker: **Inspect views** on `chrome://extensions`.
- Popup: right-click the extension popup and choose **Inspect**.
- Backend: the terminal running `npm run dev` or `npm start`.
- Compiled extension: `extension/dist`.
- Compiled backend: `server/dist/server.js`.
