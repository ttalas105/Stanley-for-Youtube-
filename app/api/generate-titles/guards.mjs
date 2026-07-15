const titleMarker = /\b(?:youtube\s+)?(?:video\s+)?(?:titles?|ideas?|scripts?|thumbnails?)\b/i;

const promptAttackPatterns = [
  /ignore\s+(?:all|any|the|your|previous|prior|above)\s+(?:instructions|rules|prompt|constraints)/i,
  /(?:reveal|show|print|repeat|quote|summarize)\s+(?:your|the)?\s*(?:system|developer|hidden|initial)\s+(?:prompt|instructions|message)/i,
  /(?:act|roleplay|behave|respond)\s+as\s+(?:if\s+you\s+are\s+)?(?:a\s+)?(?:different|unrestricted|uncensored|new)/i,
  /you\s+are\s+now\s+(?:an?|the)\s+/i,
  /(?:bypass|disable|remove)\s+(?:your|the)?\s*(?:guardrails|rules|safety|restrictions|scope)/i,
  /(?:encode|translate|convert)\s+(?:your|the)?\s*(?:system|hidden)\s+(?:prompt|instructions)/i,
  /<\/?system>|\[(?:system|developer)\]/i,
  /do\s+anything\s+now/i,
];

const titlePretextPatterns = [
  /\b(?:youtube\s+)?(?:video\s+)?(?:titles?|ideas?|scripts?|thumbnails?)\b[\s\S]{0,140}\b(?:but\s+first|before\s+that|first\s+(?:do|write|tell|show|give|explain|create|make)|then\s+(?:do|write|tell|show|give|explain|create|make))\b/i,
  /\b(?:but\s+first|before\s+(?:that|you\s+(?:do|write|tell|show|give|explain|create|make))|first\s+(?:do|write|tell|show|give|explain|create|make))\b[\s\S]{0,180}\b(?:youtube\s+)?(?:video\s+)?(?:titles?|ideas?|scripts?|thumbnails?)\b/i,
  /\b(?:pretend|claim|say|mention)\b[\s\S]{0,90}\b(?:youtube\s+)?(?:video\s+)?(?:titles?|ideas?|scripts?|thumbnails?)\b[\s\S]{0,90}\b(?:actually|instead|really)\b/i,
];

const creatorMemoryPatterns = [
  /^(?:please\s+)?(?:remember|save|note)(?:\s+that)?\s+(?:i\b|i['’]m\b|i\s+am\b|my\b|we\b|our\b)/i,
  /^(?:please\s+)?(?:forget|remove|delete)(?:\s+that)?\s+(?:i\b|i['’]m\b|i\s+am\b|my\b|we\b|our\b|what\s+i\b|everything\s+you\s+(?:remember|know))/i,
  /^(?:do\s+you\s+remember|what\s+do\s+you\s+remember|what\s+have\s+you\s+(?:remembered|saved)|what\s+do\s+you\s+know\s+about\s+me|what\s+(?:do|did)\s+i\s+(?:say|tell\s+you|like|love|prefer|mention)|which\b[^?]{0,80}\bdid\s+i\s+(?:say|tell\s+you|like|love|prefer|mention))/i,
];

const mixedMemoryTask = /\b(?:but\s+first|before\s+that|and\s+then|then|also)\s+(?:write|create|make|code|explain|tell|show|give|summarize|translate|search|browse|calculate)\b/i;
const sensitiveMemory = /\b(?:password|passcode|secret|token|api[_ -]?key|credential|credit[_ -]?card|bank|routing|social[_ -]?security|ssn|sin|medical|diagnosis|exact\s+address|home\s+address|phone|email)\b/i;

export function hasTitlePretext(value) {
  return titleMarker.test(value) && titlePretextPatterns.some((pattern) => pattern.test(value));
}

export function looksLikePromptAttack(value) {
  return promptAttackPatterns.some((pattern) => pattern.test(value)) || hasTitlePretext(value);
}

export function looksLikeCreatorMemoryRequest(value) {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message || message.length > 320 || /[\r\n]/.test(message)) return false;
  if (looksLikePromptAttack(message) || mixedMemoryTask.test(message) || sensitiveMemory.test(message)) return false;
  return creatorMemoryPatterns.some((pattern) => pattern.test(message));
}

const creativeIntents = new Set(["idea_work", "script_work", "title_work", "thumbnail_work"]);
const directCreationRequest = /\b(?:give|generate|create|make|list|brainstorm|suggest|write|draft|rewrite|improve|rank|come\s+up\s+with|show\s+me|find)\b/i;

export function shouldGenerateImmediately(value, intent, resolvedBrief = "", hasConnectedChannel = false) {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message || !creativeIntents.has(intent)) return false;
  if (looksLikePromptAttack(message) || looksLikeCreatorMemoryRequest(message)) return false;
  if (!directCreationRequest.test(message)) return false;

  const brief = typeof resolvedBrief === "string" && resolvedBrief.trim() ? resolvedBrief.trim() : message;
  const meaningfulWords = brief.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || [];
  return hasConnectedChannel || meaningfulWords.length >= 5;
}
