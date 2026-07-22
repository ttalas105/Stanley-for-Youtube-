const ACTIONS = {
  idea: {
    id: "idea",
    label: "Make an idea from this",
    prompt: "Create three original YouTube video ideas inspired by the verified research we just reviewed, adapted to my voice and channel instead of copying the creator.",
    question: "Want to make an idea like this?",
  },
  script: {
    id: "script",
    label: "Write the top idea",
    prompt: "Write the complete, word-for-word YouTube script for the recommended idea.",
    question: "Want me to turn the top idea into a complete script?",
  },
  filming: {
    id: "filming",
    label: "Plan the shoot",
    prompt: "Give me practical filming advice and a shot-by-shot production plan for this script.",
    question: "Want practical advice and a shot-by-shot plan for filming it?",
  },
  thumbnail: {
    id: "thumbnail",
    label: "Make the thumbnail",
    prompt: "Create the finished YouTube thumbnail for the current video.",
    question: "Want me to create the finished thumbnail next?",
  },
  review: {
    id: "review",
    label: "Review the full package",
    prompt: "Review the full video package we developed. Identify the single highest-leverage improvement across the idea, title, script, filming plan, and thumbnail, then make that improvement.",
    question: "Want me to review the full package and make its highest-leverage improvement?",
  },
};

const AFFIRMATIVE_REPLY = /^(?:yes|yeah|yep|yup|sure|please|absolutely|definitely|ok(?:ay)?|go ahead|do it|let'?s do it|sounds good)(?:\s+please)?[.!]*$/i;

const CONTINUATION_QUESTIONS = [
  { id: "idea", pattern: /want to make an idea like this\?/i },
  { id: "script", pattern: /want me to turn (?:the|that|your).*idea into a complete script\?/i },
  { id: "filming", pattern: /want practical advice and a shot-by-shot plan for filming it\?/i },
  { id: "thumbnail", pattern: /want me to create the finished thumbnail next\?/i },
  { id: "review", pattern: /want me to review the full package and make its highest-leverage improvement\?/i },
];

function copyAction(action) {
  return action ? [{ ...action }] : [];
}

export function workflowNextActions(artifacts = {}) {
  if (artifacts.blocked) return [];
  if (artifacts.hasThumbnailImage || artifacts.hasThumbnails) return copyAction(ACTIONS.review);
  if (artifacts.hasFilmingPlan) return copyAction(ACTIONS.thumbnail);
  if (artifacts.hasScript) return copyAction(ACTIONS.filming);
  if (artifacts.hasIdeas) return copyAction(ACTIONS.script);
  if (artifacts.hasTitles) return copyAction(ACTIONS.thumbnail);
  if (artifacts.hasResearch) return copyAction(ACTIONS.idea);
  return [];
}

export function workflowContinuationForReply(currentMessage, messages = []) {
  const reply = typeof currentMessage === "string" ? currentMessage.trim() : "";
  if (!AFFIRMATIVE_REPLY.test(reply) || !Array.isArray(messages)) return null;
  const previousAssistant = messages
    .slice(0, -1)
    .reverse()
    .find((message) => message?.role === "assistant" && typeof message.content === "string");
  if (!previousAssistant) return null;
  const match = CONTINUATION_QUESTIONS.find((item) => item.pattern.test(previousAssistant.content));
  return match ? { ...ACTIONS[match.id] } : null;
}

function trimWords(value, limit) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= limit) return words.join(" ");
  return `${words.slice(0, limit).join(" ")}...`;
}

export function formatStanleyReply(reply) {
  const clean = typeof reply === "string"
    ? reply
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
    : "";
  if (!clean) return "";

  const lines = clean.split("\n").filter(Boolean);
  if (lines.some((line) => /^\d+\.\s+/.test(line))) return clean;
  if (lines.length > 1 && lines.some((line) => /^[-*]\s+/.test(line))) {
    return lines.slice(0, 5).map((line) => {
      const point = line.replace(/^[-*]\s+/, "");
      return `- ${trimWords(point, 25)}`;
    }).join("\n");
  }

  const sentences = clean
    .replace(/\n+/g, " ")
    .match(/[^.!?]+(?:[.!?]+|$)/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) || [];
  const wordCount = clean.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 16 && lines.length === 1) return clean;
  if (sentences.length <= 1 && wordCount <= 28) return clean;

  return sentences
    .slice(0, 4)
    .map((sentence) => `- ${trimWords(sentence.replace(/^[-*]\s+/, ""), 24)}`)
    .join("\n");
}

export function appendWorkflowQuestion(reply, actions = []) {
  const cleanReply = formatStanleyReply(reply);
  const question = typeof actions?.[0]?.question === "string" ? actions[0].question.trim() : "";
  if (!question) return cleanReply;

  let statement = cleanReply;
  if (statement.endsWith("?")) {
    const previousBoundary = Math.max(
      statement.lastIndexOf(".", statement.length - 2),
      statement.lastIndexOf("!", statement.length - 2),
      statement.lastIndexOf("\n", statement.length - 2),
    );
    const trailingQuestion = statement.slice(previousBoundary + 1).trim();
    if (trailingQuestion.length <= 180) statement = statement.slice(0, previousBoundary + 1).trim();
  }

  return [statement, question].filter(Boolean).join("\n\n");
}

export function addWorkflowGuidance(payload) {
  if (!payload || typeof payload !== "object" || payload.error) return payload;
  const conciseReply = formatStanleyReply(payload.reply);
  const usedResearchTool = Array.isArray(payload.agent?.toolCalls) && payload.agent.toolCalls.some((call) => (
    (call?.name === "youtube_channel_snapshot" || call?.name === "youtube_search_reference_videos")
      && (call?.status === "complete" || call?.status === "partial")
  ));
  const actions = workflowNextActions({
    blocked: Boolean(payload.blocked),
    hasIdeas: Array.isArray(payload.ideas) && payload.ideas.length > 0,
    hasTitles: Array.isArray(payload.titles) && payload.titles.length > 0,
    hasScript: Boolean(payload.script),
    hasFilmingPlan: Boolean(payload.filmingPlan),
    hasThumbnailImage: Boolean(payload.thumbnailImage),
    hasThumbnails: Array.isArray(payload.thumbnails) && payload.thumbnails.length > 0,
    hasResearch: usedResearchTool || (Array.isArray(payload.research?.examples) && payload.research.examples.length > 0),
  });
  if (!actions.length) return { ...payload, reply: conciseReply };
  return {
    ...payload,
    reply: appendWorkflowQuestion(conciseReply, actions),
    nextActions: actions,
  };
}
