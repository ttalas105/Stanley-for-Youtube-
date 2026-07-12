import { getErrorMessage, isBackgroundMessage, isChannelAnalysisResponse, isRecord } from "../shared/guards";
import type { ChannelAnalysisResponse, ExtensionResponse, SupportedChannelIdentifier } from "../shared/types";

const BACKEND_ORIGIN = "http://localhost:3000";
const BACKEND_URL = `${BACKEND_ORIGIN}/analyze-channel`;

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isBackgroundMessage(message)) {
    sendResponse({ ok: false, error: "Invalid extension message." });
    return false;
  }
  const request: Promise<unknown> = message.type === "ANALYZE_CHANNEL"
    ? analyzeChannel(message.channel)
    : message.type === "GET_CHANNEL_SNAPSHOTS"
      ? backendGet(`/api/snapshots/channel/${encodeURIComponent(message.channelId)}`)
      : backendGet(`/api/snapshots/video/${encodeURIComponent(message.videoId)}`);
  request.then((data) => sendResponse({ ok: true, data })).catch((error: unknown) => sendResponse({ ok: false, error: getErrorMessage(error) }));
  return true;
});

async function analyzeChannel(channel: SupportedChannelIdentifier): Promise<ChannelAnalysisResponse> {
  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(channel),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(errorFromPayload(payload) || `Backend returned ${response.status}`);
    if (!isChannelAnalysisResponse(payload)) throw new Error("Backend returned an invalid analysis response.");
    return payload;
  } catch (error: unknown) {
    if (error instanceof TypeError) throw new Error("Backend not running. Start the server on http://localhost:3000 and try again.");
    throw error;
  }
}

async function backendGet(path: string): Promise<unknown> {
  try {
    const response = await fetch(`${BACKEND_ORIGIN}${path}`);
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(errorFromPayload(payload) || `Backend returned ${response.status}`);
    if (!isRecord(payload)) throw new Error("Backend returned an invalid snapshot response.");
    return payload;
  } catch (error: unknown) {
    if (error instanceof TypeError) throw new Error("Backend not running. Start the server on http://localhost:3000 and try again.");
    throw error;
  }
}

function errorFromPayload(payload: unknown): string | null {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : null;
}
