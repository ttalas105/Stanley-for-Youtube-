import { getErrorMessage, isRecord } from "../shared/guards";

const AUTO_SCAN_KEY = "autoScanEnabled";
const startButton = document.querySelector<HTMLButtonElement>("#start");
const startLabel = document.querySelector<HTMLSpanElement>("#start-label");
const subtitle = document.querySelector<HTMLParagraphElement>("#subtitle");
const statusText = document.querySelector<HTMLParagraphElement>("#status");

if (!startButton || !startLabel || !subtitle || !statusText) throw new Error("Popup markup is missing required controls.");

void initialize();

startButton.addEventListener("click", async () => {
  const transitionStartedAt = performance.now();
  document.body.dataset.state = "activating";
  startButton.disabled = true;
  startButton.dataset.loading = "true";
  startButton.setAttribute("aria-busy", "true");
  startLabel.textContent = "Starting...";
  setStatus("");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && isYouTubeUrl(tab.url)) await ensureContentScript(tab.id);
    await chrome.storage.local.set({ [AUTO_SCAN_KEY]: true });
    await finishActivationTransition(transitionStartedAt);
    renderRunning();
  } catch (error: unknown) {
    document.body.dataset.state = "idle";
    startButton.disabled = false;
    startLabel.textContent = "Start Stanley";
    setStatus(getErrorMessage(error) || "Could not start automatic analysis.");
  } finally {
    delete startButton.dataset.loading;
    startButton.removeAttribute("aria-busy");
  }
});

async function initialize(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(AUTO_SCAN_KEY);
    if (stored[AUTO_SCAN_KEY] === true) {
      renderRunning();
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && isYouTubeUrl(tab.url)) await ensureContentScript(tab.id);
    }
  } catch (error: unknown) {
    setStatus(getErrorMessage(error) || "Could not read extension settings.");
  }
}

function renderRunning(): void {
  document.body.dataset.state = "running";
  if (startLabel) startLabel.textContent = "Stanley ready";
  if (subtitle) subtitle.textContent = "Channel scanning is on.";
  if (startButton) {
    startButton.disabled = true;
    startButton.setAttribute("aria-label", "Stanley ready");
  }
  setStatus("");
}

async function finishActivationTransition(startedAt: number): Promise<void> {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const remaining = 320 - (performance.now() - startedAt);
  if (remaining > 0) await new Promise<void>((resolve) => setTimeout(resolve, remaining));
}

function isYouTubeUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === "youtube.com" || parsed.hostname.endsWith(".youtube.com");
  } catch { return false; }
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    const response: unknown = await chrome.tabs.sendMessage(tabId, { type: "PING_CONTENT_SCRIPT" });
    if (!isRecord(response) || response.ok !== true) throw new Error("Content script did not respond.");
  } catch {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  }
}

function setStatus(message: string): void { if (statusText) statusText.textContent = message; }
