const PUBLIC_RESEARCH_CUE = /\b(?:research|search\s+(?:youtube|for)|look\s+(?:it\s+)?up|data[- ]backed|evidence[- ]backed|comparable\s+videos?|competitors?|current\s+trends?|youtube\s+data|what(?:'s|\s+is|\s+has\s+been)?\s+working|videos?\s+that\s+(?:worked|performed)|analy[sz]e\s+(?:the\s+)?(?:market|niche|competition))\b/i;
const CHANNEL_RESEARCH_CUE = /\b(?:my|our)\s+(?:channel|analytics|recent\s+uploads?|videos?|performance|audience)|based\s+on\s+(?:my|our)\s+channel|use\s+(?:my|our)\s+channel\b/i;

export function resolveResearchAccess(currentMessage, hasYouTubeAttachment = false) {
  const message = typeof currentMessage === "string" ? currentMessage : "";
  const publicSearch = PUBLIC_RESEARCH_CUE.test(message);
  const channelSnapshot = CHANNEL_RESEARCH_CUE.test(message);
  return {
    publicSearch,
    channelSnapshot,
    videoEvidence: Boolean(hasYouTubeAttachment || publicSearch || channelSnapshot),
  };
}
