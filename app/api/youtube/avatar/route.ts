import { fetchChannelProfile, readYouTubeSession } from "../oauth";

const AVATAR_HOSTS = new Set([
  "yt3.ggpht.com",
  "yt3.googleusercontent.com",
  "lh3.googleusercontent.com",
]);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function safeAvatarUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && AVATAR_HOSTS.has(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

async function loadAvatar(value: string | undefined) {
  const url = safeAvatarUrl(value);
  if (!url) return null;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/*",
      "User-Agent": "Stanley-for-YouTube/1.0",
    },
  });
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "";
  if (!contentType.startsWith("image/")) return null;
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_AVATAR_BYTES) return null;
  const body = await response.arrayBuffer();
  if (!body.byteLength || body.byteLength > MAX_AVATAR_BYTES) return null;
  return { body, contentType };
}

export async function GET() {
  const session = await readYouTubeSession();
  if (!session) return new Response(null, { status: 404 });

  let avatar = await loadAvatar(session.profile.thumbnailUrl);
  if (!avatar) {
    try {
      const refreshedProfile = await fetchChannelProfile(session.accessToken);
      if (refreshedProfile.thumbnailUrl !== session.profile.thumbnailUrl) {
        avatar = await loadAvatar(refreshedProfile.thumbnailUrl);
      }
    } catch (error) {
      console.warn("YouTube avatar refresh was unavailable.", error);
    }
  }
  if (!avatar) return new Response(null, { status: 502 });

  return new Response(avatar.body, {
    headers: {
      "Content-Type": avatar.contentType,
      "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
