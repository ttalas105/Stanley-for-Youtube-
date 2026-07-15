const unsupportedChannelClaim = /\b(?:channel|existing audience|returning audience|recent uploads?|previous videos?|recurring (?:subject|character))\b/i;

export function sanitizeChannelFit(value, allowChannelClaims = false) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || allowChannelClaims || !unsupportedChannelClaim.test(text)) return text;
  return "Brief fit: This stays centered on the subject and format the creator asked for in this chat.";
}
