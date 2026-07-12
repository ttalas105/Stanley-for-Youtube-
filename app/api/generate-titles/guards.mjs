const titleMarker = /\b(?:youtube\s+)?(?:video\s+)?(?:titles?|ideas?|thumbnails?)\b/i;

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
  /\b(?:youtube\s+)?(?:video\s+)?(?:titles?|ideas?|thumbnails?)\b[\s\S]{0,140}\b(?:but\s+first|before\s+that|first\s+(?:do|write|tell|show|give|explain|create|make)|then\s+(?:do|write|tell|show|give|explain|create|make))\b/i,
  /\b(?:but\s+first|before\s+(?:that|you\s+(?:do|write|tell|show|give|explain|create|make))|first\s+(?:do|write|tell|show|give|explain|create|make))\b[\s\S]{0,180}\b(?:youtube\s+)?(?:video\s+)?(?:titles?|ideas?|thumbnails?)\b/i,
  /\b(?:pretend|claim|say|mention)\b[\s\S]{0,90}\b(?:youtube\s+)?(?:video\s+)?(?:titles?|ideas?|thumbnails?)\b[\s\S]{0,90}\b(?:actually|instead|really)\b/i,
];

export function hasTitlePretext(value) {
  return titleMarker.test(value) && titlePretextPatterns.some((pattern) => pattern.test(value));
}

export function looksLikePromptAttack(value) {
  return promptAttackPatterns.some((pattern) => pattern.test(value)) || hasTitlePretext(value);
}
