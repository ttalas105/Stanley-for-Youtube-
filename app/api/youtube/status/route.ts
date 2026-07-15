import { NextResponse } from "next/server";
import { YOUTUBE_SESSION_COOKIE, cookieOptions, oauthConfigured, readYouTubeSession, seal } from "../oauth";

export async function GET(request: Request) {
  const session = await readYouTubeSession();
  const response = NextResponse.json({
    configured: oauthConfigured(),
    connected: Boolean(session),
    profile: session?.profile || null,
  });
  if (session) response.cookies.set(YOUTUBE_SESSION_COOKIE, await seal(session), cookieOptions(request.url));
  return response;
}
