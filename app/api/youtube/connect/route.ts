import { NextResponse } from "next/server";
import {
  YOUTUBE_OAUTH_COOKIE,
  cookieOptions,
  getOAuthClientId,
  oauthConfigured,
  safeReturnTo,
  seal,
} from "../oauth";

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  if (!oauthConfigured()) {
    return NextResponse.redirect(new URL("/?youtube=not-configured", requestUrl.origin));
  }

  const state = crypto.randomUUID();
  const codeVerifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64Url(new Uint8Array(digest));
  const redirectUri = `${requestUrl.origin}/api/youtube/callback`;
  const returnTo = safeReturnTo(requestUrl.searchParams.get("returnTo"));
  const attempt = await seal({ state, codeVerifier, returnTo });

  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: getOAuthClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/yt-analytics.readonly",
    ].join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  }).toString();

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(YOUTUBE_OAUTH_COOKIE, attempt, cookieOptions(request.url, 600));
  return response;
}
