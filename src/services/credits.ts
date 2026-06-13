// Shared ink balance (Panel Haus is the source of truth — read via our
// /api/credits-balance proxy). A tiny event bus lets generation responses push a
// fresh balance (apiPost emits the newBalance returned by reserve) so the nav chip
// updates instantly without re-fetching.

type Listener = (credits: number) => void;
const listeners = new Set<Listener>();

export function onBalanceChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitBalance(credits: number): void {
  for (const l of listeners) l(credits);
}

/** Fetch the current ink balance via the proxy. Returns null if unavailable. */
export async function fetchBalance(token: string): Promise<number | null> {
  try {
    const r = await fetch("/api/credits-balance", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const d = await r.json();
    return typeof d?.credits === "number" ? d.credits : null;
  } catch {
    return null;
  }
}
