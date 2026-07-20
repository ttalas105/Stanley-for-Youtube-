import { NextResponse } from "next/server";
import {
  YOUTUBE_SESSION_COOKIE,
  cookieOptions,
  fetchChannelVideos,
  readYouTubeSession,
  seal,
} from "../oauth";
import { PRIVATE_CHANNEL_CACHE, cached } from "../server-cache";

export async function GET(request: Request) {
  const session = await readYouTubeSession();
  if (!session) return NextResponse.json({ error: "Connect YouTube to choose one of your videos." }, { status: 401 });

  try {
    const force = new URL(request.url).searchParams.get("refresh") === "true";
    // Keep every owner-visible upload in the picker. Public videos can be read
    // directly; private and unlisted videos use owner-authorized captions.
    const result = await cached(`channel-videos:${session.profile.id}`, 2 * 60 * 1000, async () => (
      (await fetchChannelVideos(session.accessToken))
        .filter((video) => ["public", "private", "unlisted"].includes(video.privacyStatus))
    ), { force });
    const response = NextResponse.json({ videos: result.value });
    response.headers.set("Cache-Control", force ? "no-store" : PRIVATE_CHANNEL_CACHE);
    response.headers.set("Vary", "Cookie");
    response.headers.set("X-Stanley-Cache", result.hit ? "hit" : "miss");
    response.cookies.set(YOUTUBE_SESSION_COOKIE, await seal(session), cookieOptions(request.url));
    return response;
  } catch (error) {
    console.error("YouTube videos could not be loaded:", error);
    return NextResponse.json({ error: "Your YouTube videos could not be loaded. Try reconnecting the channel." }, { status: 502 });
  }
}
