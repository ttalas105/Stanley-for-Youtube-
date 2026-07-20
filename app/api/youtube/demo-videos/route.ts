import { WILL_TENNYSON_DEMO, publicDemoCreator } from "../../../creator-profiles";
import { PUBLIC_DEMO_CACHE, cached } from "../server-cache";

type ChannelResponse = {
  items?: Array<{
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
  error?: { message?: string };
};

type PlaylistResponse = {
  items?: Array<{ contentDetails?: { videoId?: string } }>;
  error?: { message?: string };
};

type VideosResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      publishedAt?: string;
      thumbnails?: {
        default?: { url?: string };
        medium?: { url?: string };
        high?: { url?: string };
        maxres?: { url?: string };
      };
    };
    statistics?: { viewCount?: string };
    contentDetails?: { duration?: string };
    status?: { privacyStatus?: string };
  }>;
  error?: { message?: string };
};

function youtubeUrl(path: string, params: Record<string, string>, key: string) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  url.search = new URLSearchParams({ ...params, key }).toString();
  return url;
}

async function youtubeJson<T>(url: URL) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  const payload = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || "YouTube did not return public channel data.");
  return payload;
}

export async function loadDemoVideos(creatorId: string, force = false) {
  const creator = publicDemoCreator(creatorId);
  if (!creator) throw new Error("That demo creator is not available.");

  return cached(`demo-videos:${creator.id}`, 15 * 60 * 1000, async () => {
    const key = process.env.YOUTUBE_API_KEY?.trim();
    if (!key) throw new Error("YouTube public data is not configured.");

    const channelPayload = await youtubeJson<ChannelResponse>(youtubeUrl("channels", {
      part: "contentDetails",
      forHandle: creator.handle.replace(/^@/, ""),
    }, key));
    const uploadsPlaylist = channelPayload.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylist) throw new Error("The creator upload feed was not returned.");

    const playlistPayload = await youtubeJson<PlaylistResponse>(youtubeUrl("playlistItems", {
      part: "contentDetails",
      playlistId: uploadsPlaylist,
      maxResults: "36",
    }, key));
    const ids = (playlistPayload.items || [])
      .map((item) => item.contentDetails?.videoId)
      .filter((id): id is string => Boolean(id));
    if (!ids.length) return { videos: [], updatedAt: new Date().toISOString() };

    const videosPayload = await youtubeJson<VideosResponse>(youtubeUrl("videos", {
      part: "snippet,statistics,contentDetails,status",
      id: ids.join(","),
      maxResults: "36",
    }, key));
    const videos = (videosPayload.items || []).flatMap((video) => {
      if (!video.id || video.status?.privacyStatus !== "public") return [];
      const thumbnails = video.snippet?.thumbnails;
      return [{
        id: video.id,
        title: video.snippet?.title?.trim() || "Untitled video",
        thumbnailUrl: thumbnails?.maxres?.url || thumbnails?.high?.url || thumbnails?.medium?.url || thumbnails?.default?.url || "",
        publishedAt: video.snippet?.publishedAt || new Date(0).toISOString(),
        views: Number(video.statistics?.viewCount || 0),
        duration: video.contentDetails?.duration || "PT0S",
        privacyStatus: "public",
        url: `https://www.youtube.com/watch?v=${video.id}`,
      }];
    }).sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime());

    return { videos, updatedAt: new Date().toISOString() };
  }, { force });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const creatorId = requestUrl.searchParams.get("creator") || WILL_TENNYSON_DEMO.id;
  if (!publicDemoCreator(creatorId)) return Response.json({ error: "That demo creator is not available." }, { status: 404 });
  const force = requestUrl.searchParams.get("refresh") === "true";

  try {
    const result = await loadDemoVideos(creatorId, force);
    return Response.json(result.value, { headers: { "Cache-Control": force ? "no-store" : PUBLIC_DEMO_CACHE, "X-Stanley-Cache": result.hit ? "hit" : "miss" } });
  } catch (error) {
    console.warn("Public demo videos could not be refreshed.", error);
    const message = error instanceof Error ? error.message : "Public videos could not be loaded.";
    return Response.json({ error: message }, { status: message.includes("not configured") ? 503 : 502 });
  }
}
