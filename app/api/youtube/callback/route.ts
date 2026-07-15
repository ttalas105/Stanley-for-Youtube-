import { NextResponse } from "next/server";
import {
  OAuthAttempt,
  YOUTUBE_OAUTH_COOKIE,
  YOUTUBE_SESSION_COOKIE,
  YouTubeSession,
  cookieOptions,
  fetchChannelProfile,
  getOAuthClientId,
  getOAuthClientSecret,
  oauthConfigured,
  safeReturnTo,
  seal,
  unseal,
} from "../oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const failure = (reason: string) => NextResponse.redirect(new URL(`/?youtube=${encodeURIComponent(reason)}`, url.origin));
  if (!oauthConfigured()) return failure("not-configured");
  if (url.searchParams.get("error")) return failure("cancelled");

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const cookieHeader = request.headers.get("cookie") || "";
  const attemptValue = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${YOUTUBE_OAUTH_COOKIE}=`))?.slice(YOUTUBE_OAUTH_COOKIE.length + 1);
  const attempt = await unseal<OAuthAttempt>(attemptValue);
  if (!attempt || !state || state !== attempt.state || !code) return failure("invalid-state");

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: getOAuthClientId(),
        client_secret: getOAuthClientSecret(),
        code,
        code_verifier: attempt.codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: `${url.origin}/api/youtube/callback`,
      }),
    });
    const token = await tokenResponse.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error_description?: string;
    };
    if (!tokenResponse.ok || !token.access_token) throw new Error(token.error_description || "Google did not return an access token");

    const profile = await fetchChannelProfile(token.access_token);
    const session: YouTubeSession = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + Math.max(60, token.expires_in || 3600) * 1000,
      scope: token.scope || "",
      profile,
    };
    const destination = new URL(safeReturnTo(attempt.returnTo), url.origin);
    destination.searchParams.set("youtube", "connected");
    const response = NextResponse.redirect(destination);
    response.cookies.set(YOUTUBE_SESSION_COOKIE, await seal(session), cookieOptions(request.url));
    response.cookies.set(YOUTUBE_OAUTH_COOKIE, "", cookieOptions(request.url, 0));
    return response;
  } catch (error) {
    console.error("YouTube OAuth callback failed:", error);
    return failure("connection-failed");
  }
}
