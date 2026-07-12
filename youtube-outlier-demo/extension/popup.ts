import { getErrorMessage, isRecord } from "../shared/guards";

const scanButton = document.querySelector<HTMLButtonElement>("#scan");
const statusText = document.querySelector<HTMLParagraphElement>("#status");

if (!scanButton || !statusText) throw new Error("Popup markup is missing required controls.");

scanButton.addEventListener("click", async () => {
  scanButton.disabled = true;
  setStatus("Checking this tab...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !isYouTubeUrl(tab.url)) {
      setStatus("Open a YouTube channel page first.");
      return;
    }
    await ensureContentScript(tab.id);
    const response: unknown = await chrome.tabs.sendMessage(tab.id, { type: "START_SCAN" });
    if (!isRecord(response) || response.ok !== true) {
      throw new Error(isRecord(response) && typeof response.error === "string" ? response.error : "Could not start the scan.");
    }
    setStatus("Scan started. Check the side panel on YouTube.");
  } catch (error: unknown) {
    setStatus(getErrorMessage(error) || "Could not start the scan.");
  } finally {
    scanButton.disabled = false;
  }
});

function isYouTubeUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === "youtube.com" || parsed.hostname.endsWith(".youtube.com");
  } catch { return false; }
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING_CONTENT_SCRIPT" });
  } catch {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["vendor/chart.umd.min.js", "content.js"] });
  }
}

function setStatus(message: string): void { if (statusText) statusText.textContent = message; }
