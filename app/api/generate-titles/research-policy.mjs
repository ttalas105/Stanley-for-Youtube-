const PUBLIC_RESEARCH_CUE = /\b(?:research|search\s+(?:youtube|for)|look\s+(?:it\s+)?up|data[- ]backed|evidence[- ]backed|comparable\s+videos?|competitors?|current\s+trends?|youtube\s+data|what(?:'s|\s+is|\s+has\s+been)?\s+working|(?:current|recent)\s+(?:successful|high[- ]performing)\s+videos?|videos?\s+that\s+(?:worked|performed|succeeded)|analy[sz]e\s+(?:the\s+)?(?:market|niche|competition)|(?:find|show|list)\s+(?:me\s+)?(?:the\s+)?(?:current\s+successful|successful|high[-\s]?performing|most\s+popular|most[-\s]?viewed|top[-\s]?performing|trending)\s+(?:youtube\s+)?videos?|(?:access|analy[sz]e|review|audit|break\s+down|look\s+at)\b[^.!?]{0,100}\b(?:youtube\s+)?channel)\b/i;
const LATEST_CONNECTED_VIDEO_CUE = /\b(?:(?:my|our)\s+(?:(?:latest|last|newest|most\s+recent)\s+)(?:youtube\s+)?(?:video|upload)|(?:latest|last|newest|most\s+recent)\s+(?:youtube\s+)?(?:video|upload)\s+(?:on|from)\s+(?:my|our)\s+channel)\b/i;
const CHANNEL_RESEARCH_CUE = /\b(?:my|our)\s+(?:channel|analytics|recent\s+uploads?|videos?|performance|audience)|based\s+on\s+(?:my|our)\s+channel|use\s+(?:my|our)\s+channel\b/i;
const EXACT_VIDEO_CUE = /(?:youtu\.be\/|youtube\.com\/watch\?[^\s]*v=|\b(?:youtube\s+)?video(?:\s+id)?\s+)[A-Za-z0-9_-]{6,20}\b/i;

export function resolveResearchAccess(currentMessage, hasYouTubeAttachment = false) {
  const message = typeof currentMessage === "string" ? currentMessage : "";
  const publicSearch = PUBLIC_RESEARCH_CUE.test(message);
  const channelSnapshot = CHANNEL_RESEARCH_CUE.test(message) || LATEST_CONNECTED_VIDEO_CUE.test(message);
  const exactVideo = EXACT_VIDEO_CUE.test(message);
  return {
    publicSearch,
    channelSnapshot,
    videoEvidence: Boolean(hasYouTubeAttachment || publicSearch || channelSnapshot || exactVideo),
  };
}

export function requestsLatestConnectedVideo(currentMessage) {
  return LATEST_CONNECTED_VIDEO_CUE.test(typeof currentMessage === "string" ? currentMessage : "");
}

export function requestedResearchWindowHours(currentMessage) {
  const message = typeof currentMessage === "string" ? currentMessage : "";
  const match = /\b(?:last|past)\s+(?:(\d{1,3})\s*)?(hours?|hrs?|h|days?|weeks?)\b/i.exec(message);
  if (!match) return 0;
  const amount = Number(match[1] || 1);
  const unit = match[2].toLowerCase();
  const multiplier = unit.startsWith("week") ? 168 : unit.startsWith("day") ? 24 : 1;
  return Math.min(720, Math.max(1, amount * multiplier));
}

export function requestsBroadPopularVideos(currentMessage) {
  const message = typeof currentMessage === "string" ? currentMessage : "";
  return /\b(?:most\s+popular|most[-\s]?viewed|top[-\s]?performing|trending)\s+(?:youtube\s+)?videos?\b/i.test(message);
}
