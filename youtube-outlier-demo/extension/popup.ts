import { getErrorMessage, isRecord } from "../shared/guards";

const AUTO_SCAN_KEY = "autoScanEnabled";
const toggleButton = requiredElement<HTMLButtonElement>("#start");
const toggleLabel = requiredElement<HTMLSpanElement>("#start-label");
const subtitle = requiredElement<HTMLParagraphElement>("#subtitle");
const stateIndicator = requiredElement<HTMLSpanElement>("#state-indicator");
const statusText = requiredElement<HTMLParagraphElement>("#status");

let enabled = false;
let busy = false;

void initialize();

toggleButton.addEventListener("click", () => {
  if (busy) return;
  void setEnabled(!enabled);
});

async function initialize(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(AUTO_SCAN_KEY);
    enabled = stored[AUTO_SCAN_KEY] === true;
    renderState();
    if (!enabled) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && isYouTubeUrl(tab.url)) {
      try {
        await ensureContentScript(tab.id);
      } catch (error: unknown) {
        setStatus(getErrorMessage(error) || "Reload YouTube to reconnect Stanley.");
      }
    }
  } catch (error: unknown) {
    renderState();
    setStatus(getErrorMessage(error) || "Could not read extension settings.");
  }
}

async function setEnabled(nextEnabled: boolean): Promise<void> {
  const transitionStartedAt = performance.now();
  busy = true;
  document.body.dataset.state = nextEnabled ? "activating" : "deactivating";
  toggleButton.disabled = true;
  toggleButton.dataset.loading = "true";
  toggleButton.setAttribute("aria-busy", "true");
  toggleLabel.textContent = nextEnabled ? "Turning on…" : "Turning off…";
  setStatus("");

  try {
    if (nextEnabled) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && isYouTubeUrl(tab.url)) await ensureContentScript(tab.id);
    }

    await chrome.storage.local.set({ [AUTO_SCAN_KEY]: nextEnabled });
    await finishToggleTransition(transitionStartedAt);
    enabled = nextEnabled;
    renderState();
  } catch (error: unknown) {
    renderState();
    setStatus(getErrorMessage(error) || `Could not turn Stanley ${nextEnabled ? "on" : "off"}.`);
  } finally {
    busy = false;
    toggleButton.disabled = false;
    delete toggleButton.dataset.loading;
    toggleButton.removeAttribute("aria-busy");
  }
}

function renderState(): void {
  document.body.dataset.state = enabled ? "running" : "idle";
  toggleLabel.textContent = enabled ? "Turn Stanley off" : "Turn Stanley on";
  subtitle.textContent = enabled
    ? "Stanley is active while you browse YouTube."
    : "Turn Stanley on for channel outliers and analysis.";
  stateIndicator.textContent = enabled ? "On" : "Off";
  toggleButton.setAttribute("aria-pressed", String(enabled));
  toggleButton.setAttribute("aria-label", enabled ? "Turn Stanley off" : "Turn Stanley on");
  setStatus("");
}

async function finishToggleTransition(startedAt: number): Promise<void> {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const remaining = 280 - (performance.now() - startedAt);
  if (remaining > 0) await new Promise<void>((resolve) => setTimeout(resolve, remaining));
}

function isYouTubeUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === "youtube.com" || parsed.hostname.endsWith(".youtube.com");
  } catch {
    return false;
  }
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

function setStatus(message: string): void {
  statusText.textContent = message;
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Popup markup is missing ${selector}.`);
  return element;
}
