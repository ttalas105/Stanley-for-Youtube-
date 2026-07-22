export function hasPriorAssistantAnalysisForVideo(messages = [], video = {}) {
  const exactVideoId = typeof video.videoId === "string" ? video.videoId.trim() : "";
  const exactTitle = typeof video.title === "string" ? video.title.trim().toLowerCase() : "";
  if (!exactVideoId || !Array.isArray(messages) || messages.length < 2) return false;
  const earlierMessages = messages.slice(0, -1);
  let selectedAt = -1;
  for (let index = 0; index < earlierMessages.length; index += 1) {
    const message = earlierMessages[index];
    if (typeof message?.content !== "string") continue;
    const content = message.content.toLowerCase();
    if (content.includes(exactVideoId.toLowerCase()) || (exactTitle.length >= 12 && content.includes(exactTitle))) selectedAt = index;
  }
  if (selectedAt < 0) return false;
  if (earlierMessages[selectedAt]?.role === "assistant") return true;
  return earlierMessages.slice(selectedAt + 1).some((message) =>
    message?.role === "assistant" && typeof message.content === "string" && message.content.trim().length > 0,
  );
}

export function selectedYouTubeVideoId(attachments = [], currentMessage = "", hasPriorConversation = false) {
  if (!Array.isArray(attachments)) return "";
  const selected = attachments.find((attachment) =>
    attachment?.kind === "youtube"
    && typeof attachment.videoId === "string"
    && /^[A-Za-z0-9_-]{6,20}$/.test(attachment.videoId.trim()),
  );
  const videoId = selected?.videoId.trim() || "";
  if (!videoId || !hasPriorConversation) return videoId;
  const message = typeof currentMessage === "string" ? currentMessage : "";
  const refersToSelectedVideo = /\b(?:this|that|the|same|selected|attached|previous)\s+(?:youtube\s+)?(?:video|short|upload|clip)\b/i.test(message);
  return message.includes(videoId) || /Selected YouTube reference:/i.test(message) || refersToSelectedVideo ? videoId : "";
}
