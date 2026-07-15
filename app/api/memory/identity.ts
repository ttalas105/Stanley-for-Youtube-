import { cookies } from "next/headers";
import type { YouTubeSession } from "../youtube/oauth";

const MEMORY_OWNER_COOKIE = "stanley_memory_owner";
const OWNER_MAX_AGE = 60 * 60 * 24 * 365;

export async function resolveMemoryOwner(requestUrl: string, youtubeSession: YouTubeSession | null) {
  if (youtubeSession?.profile.id) return `youtube:${youtubeSession.profile.id}`;

  const store = await cookies();
  const current = store.get(MEMORY_OWNER_COOKIE)?.value;
  if (current && /^[0-9a-f-]{36}$/i.test(current)) return `anonymous:${current}`;

  const id = crypto.randomUUID();
  store.set(MEMORY_OWNER_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(requestUrl).protocol === "https:",
    path: "/",
    maxAge: OWNER_MAX_AGE,
  });
  return `anonymous:${id}`;
}
