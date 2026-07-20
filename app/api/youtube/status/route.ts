import { NextResponse } from "next/server";
import { YOUTUBE_SESSION_COOKIE, cookieOptions, hasYouTubeCaptionAccess, oauthConfigured, readYouTubeSession, seal } from "../oauth";

export async function GET(request: Request) {
  const session = await readYouTubeSession();
  const response = NextResponse.json({
    configured: oauthConfigured(),
    connected: Boolean(session),
    captionAccess: hasYouTubeCaptionAccess(session),
    profile: session?.profile || null,
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Vary", "Cookie");
  if (session) response.cookies.set(YOUTUBE_SESSION_COOKIE, await seal(session), cookieOptions(request.url));
  return response;
}
