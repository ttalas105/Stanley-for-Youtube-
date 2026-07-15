import { NextResponse } from "next/server";
import {
  YOUTUBE_SESSION_COOKIE,
  cookieOptions,
  fetchChannelVideos,
  readYouTubeSession,
  seal,
} from "../oauth";

export async function GET(request: Request) {
  const session = await readYouTubeSession();
  if (!session) return NextResponse.json({ error: "Connect YouTube to choose one of your videos." }, { status: 401 });

  try {
    // Keep every owner-visible upload in the picker. Public videos can be read
    // directly; private and unlisted videos use owner-authorized captions.
    const videos = (await fetchChannelVideos(session.accessToken))
      .filter((video) => ["public", "private", "unlisted"].includes(video.privacyStatus));
    const response = NextResponse.json({ videos });
    response.cookies.set(YOUTUBE_SESSION_COOKIE, await seal(session), cookieOptions(request.url));
    return response;
  } catch (error) {
    console.error("YouTube videos could not be loaded:", error);
    return NextResponse.json({ error: "Your YouTube videos could not be loaded. Try reconnecting the channel." }, { status: 502 });
  }
}
