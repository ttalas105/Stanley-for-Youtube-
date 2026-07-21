import type { YouTubeChannelProfile, YouTubeVideoReference } from "./oauth";

const WILL_PROFILE_SNAPSHOT = {
  id: "UCB2wtYpfbCpYDc5TeTwuqFA",
  title: "Will Tennyson",
  thumbnailUrl: "https://yt3.ggpht.com/ytc/AIdro_lr-x0NjJnkH7qkp89dWDAU4gsV-57RpcelBJ7vZtDB1xE=s800-c-k-c0x00ffffff-no-rj",
  subscriberCount: 5_140_000,
  videoCount: 660,
  totalViews: 1_410_238_386,
} as const;

export const WILL_TENNYSON_VIDEO_SNAPSHOT: YouTubeVideoReference[] = [
  {
    id: "eAANIrbWa6M",
    title: "I Swapped Diets With A Victoria's Secret Model",
    thumbnailUrl: "https://i.ytimg.com/vi/eAANIrbWa6M/maxresdefault.jpg",
    publishedAt: "2026-07-12T14:00:11Z",
    views: 4_783_734,
    duration: "PT28M45S",
    privacyStatus: "public",
    url: "https://www.youtube.com/watch?v=eAANIrbWa6M",
  },
  {
    id: "nt1TGErpc0Q",
    title: "How Much Does Size Really Matter?",
    thumbnailUrl: "https://i.ytimg.com/vi/nt1TGErpc0Q/maxresdefault.jpg",
    publishedAt: "2026-06-28T14:00:39Z",
    views: 1_854_255,
    duration: "PT27M57S",
    privacyStatus: "public",
    url: "https://www.youtube.com/watch?v=nt1TGErpc0Q",
  },
  {
    id: "HQ_7noX-2Qg",
    title: "I Investigated The World's Skinniest vs Fattest City",
    thumbnailUrl: "https://i.ytimg.com/vi/HQ_7noX-2Qg/maxresdefault.jpg",
    publishedAt: "2026-06-14T14:00:26Z",
    views: 8_674_244,
    duration: "PT38M44S",
    privacyStatus: "public",
    url: "https://www.youtube.com/watch?v=HQ_7noX-2Qg",
  },
  {
    id: "4dcHzIhiveg",
    title: "$0 vs $10,000 Gym Memberships in Japan",
    thumbnailUrl: "https://i.ytimg.com/vi/4dcHzIhiveg/maxresdefault.jpg",
    publishedAt: "2026-05-31T14:00:17Z",
    views: 4_966_110,
    duration: "PT32M43S",
    privacyStatus: "public",
    url: "https://www.youtube.com/watch?v=4dcHzIhiveg",
  },
  {
    id: "IT0Aao0LJrw",
    title: "I Investigated The Country Where it's Illegal To Be Fat",
    thumbnailUrl: "https://i.ytimg.com/vi/IT0Aao0LJrw/maxresdefault.jpg",
    publishedAt: "2026-05-17T14:00:20Z",
    views: 15_050_832,
    duration: "PT29M51S",
    privacyStatus: "public",
    url: "https://www.youtube.com/watch?v=IT0Aao0LJrw",
  },
  {
    id: "fEEhx8DUcMo",
    title: "I Tried Anti-Aging TikToks",
    thumbnailUrl: "https://i.ytimg.com/vi/fEEhx8DUcMo/maxresdefault.jpg",
    publishedAt: "2026-05-03T14:00:59Z",
    views: 2_990_115,
    duration: "PT33M7S",
    privacyStatus: "public",
    url: "https://www.youtube.com/watch?v=fEEhx8DUcMo",
  },
  {
    id: "oXGft6hMrzU",
    title: "I Transformed My Basement into a Professional Gym!",
    thumbnailUrl: "https://i.ytimg.com/vi/oXGft6hMrzU/maxresdefault.jpg",
    publishedAt: "2026-04-19T14:01:13Z",
    views: 3_728_265,
    duration: "PT33M56S",
    privacyStatus: "public",
    url: "https://www.youtube.com/watch?v=oXGft6hMrzU",
  },
];

export function publicDemoApiKey() {
  return process.env.YOUTUBE_API_KEY?.trim() || process.env.YOUTUBE_OAUTH_API_KEY?.trim() || "";
}

export function willTennysonProfileSnapshot(): YouTubeChannelProfile {
  return {
    ...WILL_PROFILE_SNAPSHOT,
    analyzedAt: new Date().toISOString(),
  };
}

export function willTennysonVideosSnapshot(): YouTubeVideoReference[] {
  return WILL_TENNYSON_VIDEO_SNAPSHOT.map((video) => ({ ...video }));
}
