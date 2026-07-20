type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

type CacheState = {
  entries: Map<string, CacheEntry>;
  pending: Map<string, Promise<unknown>>;
};

const globalCache = globalThis as typeof globalThis & {
  __stanleyYouTubeCache?: CacheState;
};

const state = globalCache.__stanleyYouTubeCache ??= {
  entries: new Map(),
  pending: new Map(),
};

const MAX_ENTRIES = 250;

function prune(now: number) {
  for (const [key, entry] of state.entries) {
    if (entry.expiresAt <= now) state.entries.delete(key);
  }
  while (state.entries.size > MAX_ENTRIES) {
    const oldest = state.entries.keys().next().value as string | undefined;
    if (!oldest) break;
    state.entries.delete(oldest);
  }
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  options: { force?: boolean } = {},
) {
  const now = Date.now();
  prune(now);

  if (!options.force) {
    const existing = state.entries.get(key);
    if (existing && existing.expiresAt > now) {
      return { value: existing.value as T, hit: true };
    }

    const pending = state.pending.get(key);
    if (pending) return { value: await pending as T, hit: true };
  }

  const request = load();
  state.pending.set(key, request);
  try {
    const value = await request;
    state.entries.delete(key);
    state.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    return { value, hit: false };
  } finally {
    if (state.pending.get(key) === request) state.pending.delete(key);
  }
}

export const PUBLIC_DEMO_CACHE = "public, max-age=300, s-maxage=900, stale-while-revalidate=86400";
export const PRIVATE_CHANNEL_CACHE = "private, max-age=60, stale-while-revalidate=300";
