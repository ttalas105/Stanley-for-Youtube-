import { WILL_TENNYSON_DEMO, publicDemoCreator } from "../../../creator-profiles";
import { publicDemoApiKey, willTennysonProfileSnapshot } from "../demo-data";
import { PUBLIC_DEMO_CACHE, cached } from "../server-cache";

type ChannelResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      thumbnails?: {
        default?: { url?: string };
        medium?: { url?: string };
        high?: { url?: string };
      };
    };
    statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string };
  }>;
  error?: { message?: string };
};

function numeric(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const creatorId = requestUrl.searchParams.get("creator") || WILL_TENNYSON_DEMO.id;
  const creator = publicDemoCreator(creatorId);
  if (!creator) return Response.json({ error: "That demo creator is not available." }, { status: 404 });

  const force = requestUrl.searchParams.get("refresh") === "true";
  const result = await cached(`demo-profile:v2:${creator.id}`, 6 * 60 * 60 * 1000, async () => {
    const key = publicDemoApiKey();
    if (!key) {
      return {
        profile: willTennysonProfileSnapshot(),
        demo: true,
        source: "built-in-snapshot",
      };
    }

    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.search = new URLSearchParams({
      part: "snippet,statistics",
      forHandle: creator.handle.replace(/^@/, ""),
      key,
    }).toString();

    try {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
      const payload = await response.json() as ChannelResponse;
      const channel = payload.items?.[0];
      if (!response.ok || !channel?.id) throw new Error(payload.error?.message || "Public channel was not returned.");
      const thumbnails = channel.snippet?.thumbnails;
      return {
        profile: {
          id: channel.id,
          title: channel.snippet?.title?.trim() || creator.title,
          thumbnailUrl: thumbnails?.high?.url || thumbnails?.medium?.url || thumbnails?.default?.url || "",
          subscriberCount: numeric(channel.statistics?.subscriberCount),
          videoCount: numeric(channel.statistics?.videoCount),
          totalViews: numeric(channel.statistics?.viewCount),
          analyzedAt: new Date().toISOString(),
        },
        demo: true,
        source: "youtube-public-api",
      };
    } catch (error) {
      console.warn("Public demo profile could not be refreshed.", error);
      return {
        profile: willTennysonProfileSnapshot(),
        demo: true,
        source: "built-in-snapshot",
      };
    }
  }, { force });

  return Response.json(result.value, { headers: { "Cache-Control": force ? "no-store" : PUBLIC_DEMO_CACHE, "X-Stanley-Cache": result.hit ? "hit" : "miss" } });
}
