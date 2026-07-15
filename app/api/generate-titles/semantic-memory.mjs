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

const REFERENCE_CUES = {
  identity: /\b(?:my|our)\s+(?:name|background|experience|identity|role)\b/i,
  preference: /\b(?:my|our)\s+(?:favou?rite|preferred|usual|go-to|preferences?|interests?)\b|\bwhat\s+(?:i|we)\s+(?:like|love|prefer)\b/i,
  audience: /\b(?:my|our)\s+(?:audience|viewers|subscribers|community)\b/i,
  channel: /\b(?:my|our)\s+(?:channel|niche|uploads?|videos?)\b/i,
  relationship: /\b(?:my|our)\s+(?:pet|dog|cat|partner|friend|brother|sister|mom|mother|dad|father|son|daughter)\b|\b(?:pet|person)\s+i\s+(?:mentioned|told you about)\b/i,
  subject: /\b(?:same|that|this|previous)\s+(?:subject|idea|video|project)\b/i,
  format: /\b(?:same|my|our|usual|previous)\s+(?:format|structure|style)\b/i,
  tone: /\b(?:same|my|our|usual|previous)\s+(?:tone|voice|style)\b/i,
  constraint: /\b(?:same|my|our|previous)\s+(?:constraint|limit|requirement)\b/i,
  decision: /\b(?:same|that|this|previous)\s+(?:decision|choice|direction)\b/i,
  proof: /\b(?:my|our|same|previous)\s+(?:proof|result|data|evidence)\b/i,
};

const GENERIC_MEMORY_WORDS = new Set([
  "about", "animal", "cat", "cats", "creator", "dog", "dogs", "favorite", "favourite", "likes", "love", "pet", "pets", "prefers", "their", "they", "video", "videos", "youtube",
]);

function meaningfulWords(value) {
  return new Set(clean(value, 400).toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length >= 3 && !GENERIC_MEMORY_WORDS.has(word)) || []);
}

function factMatchesRequest(fact, requestText) {
  const text = clean(requestText, 2_000).toLowerCase();
  if (!text) return false;
  const requestWords = meaningfulWords(text);
  const factWords = meaningfulWords(`${fact.key} ${fact.value}`);
  if (Array.from(factWords).some((word) => requestWords.has(word))) return true;

  const cue = REFERENCE_CUES[fact.category];
  if (!cue?.test(text)) return false;

  // A relational cue must also point at the same semantic slot. This keeps a
  // request for "my usual tone" from retrieving an unrelated pet preference.
  if (/\bfavou?rite\s+animal\b/i.test(text)) return /\b(?:cats?|dogs?|animals?|pets?|birds?|fish|horses?|rabbits?)\b/i.test(fact.value);
  if (/\b(?:tone|voice|style)\b/i.test(text)) return /\b(?:tone|voice|style|humor|humour|playful|serious|casual|formal)\b/i.test(`${fact.key} ${fact.value}`);
  if (/\b(?:audience|viewers|subscribers|community)\b/i.test(text)) return fact.category === "audience";
  if (/\b(?:channel|niche|uploads?)\b/i.test(text)) return fact.category === "channel";
  return true;
}

export function selectRelevantSemanticMemory(memory, creatorKeys = [], projectKeys = [], requestText = "") {
  const selectedCreatorKeys = new Set((Array.isArray(creatorKeys) ? creatorKeys : []).map(normalizeMemoryKey).filter(Boolean));
  const selectedProjectKeys = new Set((Array.isArray(projectKeys) ? projectKeys : []).map(normalizeMemoryKey).filter(Boolean));
  const creatorFacts = (Array.isArray(memory?.creator?.facts) ? memory.creator.facts : []).filter((fact) => {
    const normalized = normalizeMemoryFact(fact, "creator");
    return normalized && selectedCreatorKeys.has(normalized.key) && factMatchesRequest(normalized, requestText);
  });
  const projectFacts = (Array.isArray(memory?.project?.facts) ? memory.project.facts : []).filter((fact) => {
    const normalized = normalizeMemoryFact(fact, "project");
    return normalized && selectedProjectKeys.has(normalized.key) && factMatchesRequest(normalized, requestText);
  });
  return {
    creator: { summary: "", facts: creatorFacts },
    project: { summary: "", facts: projectFacts },
  };
}
