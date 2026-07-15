import { NextResponse } from "next/server";
import { YOUTUBE_SESSION_COOKIE, cookieOptions, readYouTubeSession } from "../oauth";

export async function POST(request: Request) {
  const session = await readYouTubeSession();
  if (session?.accessToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(session.accessToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } catch (error) {
      console.warn("Google token revocation was unavailable; the local session will still be removed.", error);
    }
  }
  const response = NextResponse.json({ connected: false });
  response.cookies.set(YOUTUBE_SESSION_COOKIE, "", cookieOptions(request.url, 0));
  return response;
}
