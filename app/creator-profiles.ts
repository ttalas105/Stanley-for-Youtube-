export type CreatorProfileId = "connected" | "will-tennyson";

export type PublicDemoCreator = {
  id: Exclude<CreatorProfileId, "connected">;
  title: string;
  handle: string;
  channelName: string;
  channelUrl: string;
  niche: string;
};

export const WILL_TENNYSON_DEMO: PublicDemoCreator = {
  id: "will-tennyson",
  title: "Will Tennyson",
  handle: "@WillTennyson",
  channelName: "Will Tennyson",
  channelUrl: "https://www.youtube.com/@WillTennyson",
  niche: "fitness entertainment, challenges, food, training, and personality-led storytelling",
};

export function isCreatorProfileId(value: unknown): value is CreatorProfileId {
  return value === "connected" || value === WILL_TENNYSON_DEMO.id;
}

export function publicDemoCreator(value: unknown): PublicDemoCreator | null {
  return value === WILL_TENNYSON_DEMO.id ? WILL_TENNYSON_DEMO : null;
}
