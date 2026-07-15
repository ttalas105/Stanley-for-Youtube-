export const YOUTUBE_STRATEGY_VERSION = "youtube-official-2026-07-15";

export const YOUTUBE_STRATEGY_SOURCES = [
  "https://support.google.com/youtube/answer/16533387",
  "https://support.google.com/youtube/answer/16559650",
  "https://support.google.com/youtube/answer/16559651",
  "https://support.google.com/youtube/answer/16089387",
  "https://support.google.com/youtube/answer/9314415",
  "https://support.google.com/youtube/answer/13616337",
  "https://developers.google.com/youtube/analytics/channel_reports",
  "https://research.google/pubs/recommending-what-video-to-watch-next-a-multitask-ranking-system/",
];

const sharedStrategy = `YOUTUBE DISCOVERY STRATEGY (${YOUTUBE_STRATEGY_VERSION})
This strategy is grounded in YouTube's public first-party guidance. It is not a claim to know YouTube's private models, weights, or source code.

CORE OBJECTIVE
- YouTube tries to match each viewer with videos they are likely to choose, watch, and value over the long term.
- Follow the audience, not an imaginary universal algorithm. Recommendations are personalized by watch/search history, interests, context, and similar-viewer behavior.
- Treat every upload as its own audience-matching experiment. Never claim that one weak upload automatically harms the whole channel.

THREE PERFORMANCE QUESTIONS
1. Appeal: When this is shown to the intended viewer, is the premise immediately relevant and is the packaging an honest reason to choose it?
2. Engagement: After choosing it, does the opening quickly confirm the title/thumbnail promise, then sustain progress, anticipation, clarity, or emotion without filler?
3. Satisfaction: Does the video fully deliver the promised value and leave the intended viewer glad they watched? Do not substitute raw watch time or engagement bait for satisfaction.

EVIDENCE ORDER
- Prefer the creator's authenticated analytics and explicit audience knowledge.
- Next use what the creator's audience watches, recurring channel winners, and comparable videos from genuinely adjacent audiences.
- Use broad category patterns only when creator-specific evidence is unavailable.
- A viral video's views are evidence of market response, not proof that copying its topic or format will work for this creator.

SURFACE AND FORMAT CONTEXT
- Home and Suggested are personalized. Optimize for a recognizable target viewer, adjacent interests, and a clear next-watch relationship, not keyword stuffing.
- Search needs a relevant answer to a real query plus strong viewer response. Use natural query language only when search is genuinely the intended discovery path.
- Shorts, long-form, live, and posts can serve different viewer preferences. Never assume success in one format automatically transfers to another.

ANTI-MYTH RULES
- There is no universal ideal video length, CTR, retention percentage, upload frequency, or publish time. Use the precise length needed and compare like-for-like channel data when available.
- Tags are mainly useful for misspellings and are not a discovery strategy.
- Do not recommend clickbait that the opening cannot immediately validate.
- Do not stretch scripts to increase watch time, manufacture loops, beg for comments, or add empty pattern interrupts.
- Do not promise views, virality, ranking, or algorithmic preference. Use calibrated language such as stronger audience fit, clearer promise, or more testable direction.`;

const intentStrategy = {
  idea_work: `IDEA JOB
- Define the most plausible target viewer and the specific tension, desire, problem, identity, or curiosity that makes the premise relevant.
- Give a niche idea an accessible entry point without making it generic.
- Build a promise that can be proven or delivered on camera. Reject premises that require invented results.
- Prefer ideas with a clear opening situation, visible progress, meaningful escalation, and a satisfying payoff.
- Consider whether the idea can naturally lead into another video or series, but never force a sequel hook.`,
  script_work: `SCRIPT JOB
- Make the first moments validate the title and thumbnail promise, identify the stakes, and create a concrete reason to continue.
- Every section must add new value, evidence, progress, contrast, complication, or payoff. Remove throat-clearing, repetition, and filler.
- Use open questions only when the script later resolves them. Make transitions causal and easy to follow.
- Place the strongest proof and emotional or useful payoff where it satisfies the viewer, not merely where it maximizes duration.
- End by resolving the core promise, then point to another video only when it is the genuinely useful next step.`,
  title_work: `TITLE JOB
- Optimize honest appeal for the intended viewer. Communicate value and stakes clearly enough to earn the click.
- Pair curiosity with a concrete promise. Never create a promise the supplied idea or script cannot deliver.
- Learn structures from comparable winners without copying their distinctive wording or assuming their audience is identical.`,
  thumbnail_work: `THUMBNAIL JOB
- Give the intended viewer one instantly legible focal idea. Complement the title instead of repeating it.
- Favor clear subject, emotion, action, contrast, and visual stakes over clutter or manufactured shock.
- The visual claim must be supported by the actual video.`,
  social: "CONVERSATION JOB\n- Answer naturally. Do not force algorithm advice into greetings or casual conversation.",
  memory: "MEMORY JOB\n- Store only explicit creator context. Never turn a preference into an unsupported algorithm claim.",
};

export function algorithmStrategyForIntent(intent) {
  return `${sharedStrategy}\n\n${intentStrategy[intent] || intentStrategy.idea_work}`;
}
