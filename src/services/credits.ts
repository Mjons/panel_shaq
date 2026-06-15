// Shared ink balance (Panel Haus is the source of truth — read via our
// /api/credits-balance proxy). A tiny event bus lets generation responses push a
// fresh balance (apiPost emits the newBalance returned by reserve) so the nav chip
// updates instantly without re-fetching.
//
// The last-known balance + tier are also cached at module level so a screen that
// mounts later (e.g. Settings) can render the value instantly instead of showing a
// spinner while it re-fetches — the nav chip fetches once at startup and primes
// this cache, and every generation keeps it in sync.

type Listener = (credits: number) => void;
const listeners = new Set<Listener>();

let cachedCredits: number | null = null;
let cachedTier: string | null = null;

export function getCachedBalance(): number | null {
  return cachedCredits;
}

export function getCachedTier(): string | null {
  return cachedTier;
}

export function onBalanceChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitBalance(credits: number): void {
  cachedCredits = credits;
  for (const l of listeners) l(credits);
}

/**
 * Fetch the current ink balance + tier via the proxy and prime the module cache.
 * Returns nulls if unavailable.
 */
export async function fetchAccount(
  token: string,
): Promise<{ credits: number | null; tier: string | null }> {
  try {
    const r = await fetch("/api/credits-balance", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return { credits: null, tier: null };
    const d = await r.json();
    const credits = typeof d?.credits === "number" ? d.credits : null;
    const tier = typeof d?.tier === "string" ? d.tier : null;
    if (credits !== null) cachedCredits = credits;
    if (tier !== null) {
      cachedTier = tier;
      // Tag the PostHog person with their tier for case-study segmentation.
      import("./analytics").then(({ setUserProps }) => setUserProps({ tier }));
    }
    return { credits, tier };
  } catch {
    return { credits: null, tier: null };
  }
}

/** Fetch just the ink balance (and prime the cache). Returns null if unavailable. */
export async function fetchBalance(token: string): Promise<number | null> {
  return (await fetchAccount(token)).credits;
}
