const CREATOR_CATEGORIES = new Set(["identity", "preference", "audience", "channel", "relationship"]);
const PROJECT_CATEGORIES = new Set(["subject", "relationship", "format", "tone", "constraint", "decision", "proof"]);
const SENSITIVE_KEY = /(?:password|passcode|secret|token|api[_-]?key|credential|credit[_-]?card|bank|routing|social[_-]?security|\bssn\b|\bsin\b|medical|health|diagnosis|exact[_-]?address|home[_-]?address|phone|email)/i;
const SENSITIVE_VALUE = /(?:\bAIza[\w-]{20,}|\bsk-[\w-]{16,}|\bBearer\s+[\w.-]{12,}|\b\d{3}-\d{2}-\d{4}\b|\b(?:\d[ -]*?){13,19}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/i;

function clean(value, maxLength) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

export function normalizeMemoryKey(value) {
  const key = clean(value, 64).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return key && !SENSITIVE_KEY.test(key) ? key : "";
}

export function normalizeMemoryFact(value, scope = "project") {
  if (!value || typeof value !== "object") return null;
  const key = normalizeMemoryKey(value.key);
  const factValue = clean(value.value, 280);
  const allowed = scope === "creator" ? CREATOR_CATEGORIES : PROJECT_CATEGORIES;
  const category = clean(value.category, 32).toLowerCase();
  if (!key || !factValue || !allowed.has(category) || SENSITIVE_VALUE.test(factValue)) return null;
  return { key, value: factValue, category };
}

export function mergeMemoryFacts(current, incoming, removals, scope = "project", limit = 32) {
  const merged = new Map();
  for (const fact of Array.isArray(current) ? current : []) {
    const normalized = normalizeMemoryFact(fact, scope);
    if (normalized) merged.set(normalized.key, normalized);
  }
  for (const rawKey of Array.isArray(removals) ? removals : []) {
    const key = normalizeMemoryKey(rawKey);
    if (key) merged.delete(key);
  }
  for (const fact of Array.isArray(incoming) ? incoming : []) {
    const normalized = normalizeMemoryFact(fact, scope);
    if (normalized) merged.set(normalized.key, normalized);
  }
  return Array.from(merged.values()).slice(-limit);
}

export function cleanMemorySummary(value) {
  return clean(value, 1_200);
}

export function emptySemanticMemory() {
  return {
    creator: { summary: "", facts: [] },
    project: { summary: "", facts: [] },
  };
}

export function formatSemanticMemory(memory) {
  const creatorFacts = Array.isArray(memory?.creator?.facts) ? memory.creator.facts : [];
  const projectFacts = Array.isArray(memory?.project?.facts) ? memory.project.facts : [];
  if (!memory?.creator?.summary && !memory?.project?.summary && !creatorFacts.length && !projectFacts.length) return "";
  return JSON.stringify({
    creator: { summary: memory.creator.summary || "", facts: creatorFacts },
    currentVideoProject: { summary: memory.project.summary || "", facts: projectFacts },
  });
}
