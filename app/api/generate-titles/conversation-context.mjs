const namedOrdinals = new Map([
  ["first", 1], ["second", 2], ["third", 3], ["fourth", 4], ["fifth", 5],
  ["sixth", 6], ["seventh", 7], ["eighth", 8], ["ninth", 9], ["tenth", 10],
]);

const simpleScriptFollowUp = /^(?:(?:ok(?:ay)?|yeah|yep|yes|cool|great|perfect|nice|alright|so|then|now|please|let['’]?s do it)[,!]?\s+)*(?:(?:can|could|would)\s+you\s+)?(?:(?:write|draft|make|create|generate)(?:\s+me)?\s+(?:(?:the|a|this|that|its|my|full|complete)\s+)*(?:(?:youtube|video)\s+)?script(?:\s+(?:for|from|based\s+on)\s+(?:it|this|that|the\s+(?:idea|option)|(?:idea|option)\s*#?\d{1,2}))?|turn\s+(?:it|this|that|the\s+idea)\s+into\s+(?:a\s+)?(?:full\s+|complete\s+)?script|(?:write|script)\s+(?:it|this|that)\s+out)[.!?]*$/i;

export function isSimpleScriptFollowUp(messages, currentMessage) {
  const message = typeof currentMessage === "string" ? currentMessage.trim() : "";
  if (!message || message.length > 160 || /[\r\n]/.test(message) || !simpleScriptFollowUp.test(message)) return false;
  if (!Array.isArray(messages) || messages.length < 2) return false;
  return messages.slice(0, -1).some((item) => item?.role === "assistant" && typeof item.content === "string" && item.content.trim().length >= 24);
}

export function requestedOptionNumber(value) {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message) return 0;

  const labeled = /\b(?:option|idea|title)\s*(?:number\s*)?#?\s*(\d{1,2})\b/i.exec(message);
  if (labeled) return Number(labeled[1]);

  const numericOrdinal = /\b(\d{1,2})(?:st|nd|rd|th)\s*(?:one|option|idea|title)?\b/i.exec(message);
  if (numericOrdinal) return Number(numericOrdinal[1]);

  const named = /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(?:one|option|idea|title)\b/i.exec(message);
  return named ? namedOrdinals.get(named[1].toLowerCase()) || 0 : 0;
}

function numberedIdea(content, optionNumber) {
  const marker = "Idea options:";
  const markerIndex = content.lastIndexOf(marker);
  if (markerIndex < 0) return "";
  const sections = content.slice(markerIndex + marker.length).trim().split(/\n(?=\d{1,2}\.\s)/);
  const prefix = `${optionNumber}. `;
  return sections.find((section) => section.startsWith(prefix))?.slice(prefix.length).trim() || "";
}

export function resolveSelectedIdea(messages, currentMessage) {
  const optionNumber = requestedOptionNumber(currentMessage);
  if (!optionNumber || !Array.isArray(messages)) return null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant" || typeof message.content !== "string") continue;
    const idea = numberedIdea(message.content, optionNumber);
    if (idea) return { optionNumber, idea };
  }
  return null;
}
