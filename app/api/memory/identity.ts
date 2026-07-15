import { cookies } from "next/headers";
import { mergeMemoryOwners } from "@/db/memory";
import { cookieOptions, seal, unseal } from "../youtube/oauth";
import type { YouTubeSession } from "../youtube/oauth";

const MEMORY_OWNER_COOKIE = "stanley_memory_owner";
const MEMORY_CHANNEL_COOKIE = "stanley_memory_channel";
const OWNER_MAX_AGE = 60 * 60 * 24 * 365;

type MemoryChannelLink = { ownerId: string };

function anonymousOwner(value: string | undefined) {
  return value && /^[0-9a-f-]{36}$/i.test(value) ? `anonymous:${value}` : "";
}

async function linkedChannelOwner(value: string | undefined) {
  const link = await unseal<MemoryChannelLink>(value);
  return link?.ownerId && /^youtube:[a-zA-Z0-9_-]{8,80}$/.test(link.ownerId) ? link.ownerId : "";
}

export async function resolveMemoryOwner(requestUrl: string, youtubeSession: YouTubeSession | null) {
  const store = await cookies();
  const currentAnonymousOwner = anonymousOwner(store.get(MEMORY_OWNER_COOKIE)?.value);
  const currentLinkedOwner = await linkedChannelOwner(store.get(MEMORY_CHANNEL_COOKIE)?.value);

  if (youtubeSession?.profile.id) {
    const youtubeOwner = `youtube:${youtubeSession.profile.id}`;
    if (currentLinkedOwner !== youtubeOwner) {
      if (!currentLinkedOwner && currentAnonymousOwner) {
        try {
          await mergeMemoryOwners(currentAnonymousOwner, youtubeOwner);
        } catch (error) {
          // Keep the YouTube request usable and retry the migration on the next
          // request instead of writing a link that would strand anonymous data.
          console.warn("Creator memory migration will be retried.", error);
          return youtubeOwner;
        }
      }
      store.set(MEMORY_CHANNEL_COOKIE, await seal({ ownerId: youtubeOwner } satisfies MemoryChannelLink), {
        ...cookieOptions(requestUrl, OWNER_MAX_AGE),
      });
    }
    return youtubeOwner;
  }

  // Disconnecting YouTube revokes channel access, but it should not also erase
  // the creator's harmless cross-chat preferences and relationships.
  if (currentLinkedOwner) return currentLinkedOwner;
  if (currentAnonymousOwner) return currentAnonymousOwner;

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
