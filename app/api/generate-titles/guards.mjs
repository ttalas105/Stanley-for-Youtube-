const titleMarker = /\b(?:youtube\s+)?(?:video\s+)?(?:titles?|ideas?|scripts?|thumbnails?)\b/i;
const creativeAssetMarker = /\b(?:youtube\s+)?(?:video\s+)?(?:titles?|ideas?|scripts?|thumbnails?)\b/gi;
const productionGuidanceMarker = /\b(?:how\s+(?:do\s+i|should\s+i|to)\s+)?(?:film|shoot|record|edit)\b|\b(?:shot\s*list|b-?roll|camera\s+setup|filming\s+plan|production\s+plan)\b/i;
const directProductionRequest = /\b(?:how\s+(?:do\s+i|should\s+i|to)\s+(?:film|shoot|record|edit)|tell\s+me\s+how\s+to\s+(?:film|shoot|record|edit)|filming\s+plan|production\s+plan|shot\s*list|camera\s+setup)\b/i;

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
const attachedMediaReference = /\b(?:this|that|my|the|attached|uploaded|selected)\s+(?:youtube\s+)?(?:video|clip|upload|footage|thumbnail|image)\b/i;
const attachedMediaAnalysis = /\b(?:what\s+can\s+you\s+tell\s+me\s+about|what\s+do\s+you\s+think\s+(?:about|of)|analy[sz]e|review|critique|assess|break\s+down|summarize|describe|give\s+me\s+feedback\s+on|tell\s+me\s+about)\b/i;
const mixedMediaTask = /\b(?:but\s+first|before\s+that|and\s+then|then|also)\s+(?:write|create|make|code|explain|tell|show|give|translate|search|browse|calculate)\b/i;
const youtubeGuidanceSubject = /\b(?:youtube\s+)?(?:video\s+)?(?:titles?|thumbnails?|scripts?|hooks?|openings?|ideas?|packaging|retention|audience\s+satisfaction)\b/i;
const youtubeGuidanceQuestion = /\b(?:what\s+(?:goes\s+into|makes|matters|should)|how\s+(?:do\s+i|does|should|can\s+i)|why\s+(?:do|does|is|are)|explain|teach\s+me|tips\s+for|principles\s+(?:of|for)|best\s+practices\s+(?:for|of))\b/i;
const mixedGuidanceRequest = /\b(?:but\s+first|before\s+that|and\s+then|then\s+also|also\s+(?:write|create|make|code|translate|search|browse|calculate))\b/i;
const directCreativeVerb = /\b(?:generate|create|make|write|draft|give(?:\s+me)?|suggest|improve|sharpen|rewrite|come\s+up\s+with|build|design|render|plan)\b/i;
const publicYouTubeResearchAction = /\b(?:find|show|list|research|search|look\s+(?:up|at|into)|take\s+a\s+look\s+at|check\s+out|go\s+to|visit|pull\s+up|access|analy[sz]e|review|audit|break\s+down|compare)\b/i;
const publicYouTubeResearchTarget = /\b(?:(?:youtube\s+)?(?:channel|creator)s?|you\s*tubers?|(?:youtube\s+)?videos?\s+(?:in|from|on)\s+(?:the\s+)?(?:last|past)\b|(?:(?:current|recent)\s+)?(?:successful|high[-\s]?performing|most\s+popular|most[-\s]?viewed|top[-\s]?performing|trending|viral)\s+(?:youtube\s+)?videos?|videos?\s+(?:that\s+are\s+)?(?:successful|high[-\s]?performing|trending|going\s+viral))\b/i;

export function hasTitlePretext(value) {
  const supportedAssets = typeof value === "string" ? value.match(creativeAssetMarker) || [] : [];
  // Multiple YouTube deliverables, or one deliverable plus practical filming
  // direction, are a normal package request. Let the semantic classifier judge
  // any unrelated remainder instead of treating sequencing words as an attack.
  if (supportedAssets.length >= 2 || (supportedAssets.length === 1 && productionGuidanceMarker.test(value))) return false;
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

export function looksLikeAttachedMediaAnalysis(value, hasAttachedMedia = false) {
  const message = typeof value === "string" ? value.trim() : "";
  if (!hasAttachedMedia || !message) return false;
  if (looksLikePromptAttack(message) || mixedMediaTask.test(message)) return false;
  return attachedMediaReference.test(message) && attachedMediaAnalysis.test(message);
}

export function looksLikeYouTubeCreationGuidance(value) {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message || looksLikePromptAttack(message) || looksLikeCreatorMemoryRequest(message) || mixedGuidanceRequest.test(message)) return false;
  return youtubeGuidanceSubject.test(message) && youtubeGuidanceQuestion.test(message);
}

export function looksLikePublicYouTubeResearchRequest(value) {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message || looksLikePromptAttack(message) || looksLikeCreatorMemoryRequest(message)) return false;
  return Boolean(explicitPublicYouTubeChannelName(message))
    || (publicYouTubeResearchAction.test(message) && publicYouTubeResearchTarget.test(message));
}

export function explicitPublicYouTubeChannelName(value) {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message) return "";
  const channelUrl = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:channel\/(UC[A-Za-z0-9_-]{20,30})|@([A-Za-z0-9._-]{3,30}))\b/i.exec(message);
  if (channelUrl?.[1]) return channelUrl[1];
  if (channelUrl?.[2]) return `@${channelUrl[2]}`;
  const namedCreator = /\b(?:research|look\s+up|check\s+out|analy[sz]e|review|audit)\s+(?:on\s+)?(?:a|an|the)?\s*(?:youtube\s+)?(?:creator|youtuber|channel)\s+(?:named|called)\s+["“”']?([A-Za-z0-9][A-Za-z0-9&.'_-]*(?:\s+[A-Za-z0-9][A-Za-z0-9&.'_-]*){0,4})["“”']?(?=\s*(?:[.!?]|$|\band\s+(?:tell|give|show|analy[sz]e|compare|make|use)\b))/i.exec(message);
  const channelMatch = /\b(?:go\s+to|visit|check\s+out|pull\s+up|look\s+(?:up|at)|take\s+a\s+look\s+at|access|analy[sz]e|review|audit|break\s+down|compare\s+(?:me\s+)?(?:to|with))\s+(?:the\s+)?["“”']?(.{2,80}?)["“”']?(?:['’]s?)?\s+(?:youtube\s+)?channel\b/i.exec(message);
  const directLookup = /\b(?:look\s+up|check\s+out|research)\s+(?:the\s+)?(?:youtube\s+)?(?:creator\s+|youtuber\s+)?["“”']?([A-Za-z0-9][A-Za-z0-9&.'_-]*(?:\s+[A-Za-z0-9][A-Za-z0-9&.'_-]*){0,4})["“”']?(?:\s+(?:on\s+youtube|youtube\s+channel|channel|youtuber|creator))?(?=\s*(?:[.!?]|$|\band\s+(?:tell|give|show|analy[sz]e|compare|make|use)\b))/i.exec(message);
  const channelName = (namedCreator?.[1] || channelMatch?.[1] || directLookup?.[1])
    ?.replace(/\s+/g, " ")
    .replace(/["“”']+$/g, "")
    .replace(/[.,!?;:]+$/g, "")
    .trim();
  if (!channelName || /^(?:my|our|your|their|the|this|that|youtube|youtubers?|creators?|channels?|videos?|comparable\s+videos?|current\s+trends?)$/i.test(channelName)) return "";
  return channelName;
}

export function explicitYouTubeVideoId(value) {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message) return "";
  const urlMatch = /(?:youtu\.be\/|youtube\.com\/watch\?[^\s]*v=)([A-Za-z0-9_-]{11})\b/i.exec(message);
  if (urlMatch?.[1]) return urlMatch[1];
  const labelMatch = /\b(?:youtube\s+)?video(?:\s+id)?\s+([A-Za-z0-9_-]{11})\b/i.exec(message);
  return labelMatch?.[1] || "";
}

export function requestedCreativeDeliverables(value) {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message) return [];

  const exclusiveMatch = /(?:\b(?:just|only)\s+(?:(?:give|create|make|write|generate)\s+(?:me\s+)?)?(?:(?:the|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|\d+)\s+)?(?:(?:stronger|shorter|better|new|alternate|alternative|improved)\s+)*(?:video\s+)?(ideas?|scripts?|titles?|thumbnails?)\b|\b(?:give|create|make|write|generate)\s+(?:me\s+)?(?:just|only)\s+(?:(?:the|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|\d+)\s+)?(?:(?:stronger|shorter|better|new|alternate|alternative|improved)\s+)*(?:video\s+)?(ideas?|scripts?|titles?|thumbnails?)\b|\b(?:video\s+)?(ideas?|scripts?|titles?|thumbnails?)\s+only\b)/i.exec(message);
  if (exclusiveMatch) {
    const asset = (exclusiveMatch[1] || exclusiveMatch[2] || exclusiveMatch[3]).toLowerCase().replace(/s$/, "");
    return [asset];
  }

  if (!directCreativeVerb.test(message) && !directProductionRequest.test(message)) return [];
  const referenceBoundary = /\b(?:using|based\s+on|drawing\s+on|informed\s+by)\b/i.exec(message);
  const requestText = referenceBoundary && titleMarker.test(message.slice(0, referenceBoundary.index))
    ? message.slice(0, referenceBoundary.index)
    : message;
  const requested = [];
  if (/\b(?:video\s+)?ideas?\b/i.test(requestText)) requested.push("idea");
  if (/\b(?:video\s+)?scripts?\b/i.test(requestText)) requested.push("script");
  if (/\b(?:video\s+)?titles?\b/i.test(requestText)) requested.push("title");
  if (/\b(?:video\s+)?thumbnails?\b/i.test(requestText)) requested.push("thumbnail");
  if (directProductionRequest.test(requestText)) requested.push("filming_plan");
  return requested;
}

export function resolveRequestedCreativeDeliverables(modelDeliverables, explicitDeliverables, intentDeliverable = null) {
  const supported = new Set(["idea", "script", "title", "thumbnail", "filming_plan"]);
  const explicit = Array.isArray(explicitDeliverables)
    ? explicitDeliverables.filter((item) => supported.has(item))
    : [];
  if (explicit.length) return Array.from(new Set(explicit));
  const inferred = Array.isArray(modelDeliverables)
    ? modelDeliverables.filter((item) => supported.has(item))
    : [];
  if (supported.has(intentDeliverable)) inferred.push(intentDeliverable);
  return Array.from(new Set(inferred));
}

export function requestedTitleCount(value, fallback = 12) {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message) return fallback;
  const numberWords = {
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  };
  const match = /\b(\d{1,2}|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:(?:stronger|shorter|better|new|alternate|alternative|improved)\s+)*(?:youtube\s+|video\s+)?titles?\b/i.exec(message);
  if (match) {
    const parsed = /^\d+$/.test(match[1]) ? Number(match[1]) : numberWords[match[1].toLowerCase()];
    return Math.max(1, Math.min(12, parsed || fallback));
  }
  if (/\b(?:youtube\s+|video\s+)?title\s+(?:options|directions|ideas|alternatives)\b/i.test(message)) return fallback;
  if (/\b(?:youtube\s+|video\s+)?title\b(?!s)/i.test(message)) return 1;
  return fallback;
}

const creativeIntents = new Set(["idea_work", "script_work", "title_work", "thumbnail_work", "filming_work"]);
const directCreationRequest = /\b(?:give|generate|create|make|list|brainstorm|suggest|write|draft|rewrite|improve|rank|plan|film|shoot|record|come\s+up\s+with|show\s+me|find)\b/i;

export function shouldGenerateImmediately(value, intent, resolvedBrief = "", hasConnectedChannel = false) {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message || !creativeIntents.has(intent)) return false;
  if (looksLikePromptAttack(message) || looksLikeCreatorMemoryRequest(message)) return false;
  if (!directCreationRequest.test(message)) return false;

  const brief = typeof resolvedBrief === "string" && resolvedBrief.trim() ? resolvedBrief.trim() : message;
  const meaningfulWords = brief.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || [];
  return hasConnectedChannel || meaningfulWords.length >= 5;
}
