// Creator Card / Creator Program client.
//
// Panel Haus (panelhaus.app) OWNS this feature: point values, verification,
// idempotency, the tier inputs and the GTD threshold all live in its Postgres
// and its api/_lib/creatorCard.js. We render its state and post two kinds of
// click. Nothing here computes a point value, and nothing here decides whether
// a step is done — if you find yourself adding either, the change belongs
// upstream. That is what keeps mobile and web from ever disagreeing.
//
// Plain fetch + getClerkToken(), like src/services/referral.ts.
//
// ⚠️ DELIBERATELY NOT apiPost(). apiPost is the AI/ink path: it opens Clerk's
// sign-in modal and THROWS for a signed-out non-BYOK user, fires
// `generation_started`, and runs an out-of-ink precheck. None of that applies to
// a card that costs no ink, and the throw would break the Settings row for
// signed-out users. src/services/shipClaim.ts:253-254 avoids it for the same
// reason.

import { getClerkToken, isClerkEnabled } from "./clerkToken";

// ── Types ────────────────────────────────────────────────────────────────────

/** A card action id. Mirrors PH's CARD_ACTIONS keys — `mint` is intentionally
 *  absent: it is a display-only row with no server action. */
export type CardActionId =
  | "claim_card"
  | "follow_x"
  | "share_card"
  | "refer_friends"
  | "contest"
  | "first_creation";

export interface CardState {
  balance: number;
  /** Sum per point_transactions type, e.g. { card_action_follow_x: 20 }. A step
   *  is done when its `card_action_<id>` entry is > 0. */
  breakdown: Record<string, number>;
  referralCode: string | null;
  referralCount: number;
  /** Opted in to the Creator Program == has a Creator Card. One flag, set by
   *  either surface. */
  member: boolean;
  /** ENABLE_CREATOR_PROGRAM upstream. Gates the join button AND the wallet row —
   *  the card runs on a different flag than join/attach-wallet, so a prod with
   *  only the card flag on would otherwise render buttons whose endpoints 404. */
  joinReady: boolean;
  discordConnected: boolean;
  discordUsername: string | null;
  /** Program enabled AND Discord OAuth configured. False => the claim cannot be
   *  completed, so nothing else can be earned either. */
  discordReady: boolean;
  mintReminder: { optedIn: boolean; email: string | null };
  walletAddress: string | null;
  /** Server-owned threshold. Render THIS, never a local 100 — the number the
   *  card shows and the number attach-wallet enforces must move together. */
  gtdPointsRequired: number;
  /** The internal PH user id, used to deal the card scene (and to key the
   *  once-ever celebration flag). Absent on older PH deploys. */
  artSeed: string | null;
  /** What THIS load newly recorded, so the UI can toast it. */
  awarded: Array<{ action: string; points: number }>;
}

export interface ActionResult {
  ok: boolean;
  awarded?: number;
  balance?: number;
  /** NOT_MEMBER | CLAIM_REQUIRED | NOT_VERIFIED — the client branches on this. */
  code?: string;
  error?: string;
}

export interface JoinResult {
  ok: boolean;
  bonusGranted?: number;
  /** True when PH said ALREADY_JOINED — a success, not a failure. */
  alreadyJoined?: boolean;
  error?: string;
}

export interface AttachWalletResult {
  ok: boolean;
  walletAddress?: string;
  code?: string;
  error?: string;
}

// ── Session cache ────────────────────────────────────────────────────────────

// Stale-while-revalidate, module-level so it outlives the screen: reopening the
// card renders instantly from here while a refresh runs behind it. The skeleton
// then shows only on a genuine first load. Mirrors PH's own swrCache.
let cachedState: CardState | null = null;

export function getCachedCardState(): CardState | null {
  return cachedState;
}

export function clearCachedCardState(): void {
  cachedState = null;
}

// ── Internals ────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await getClerkToken();
  if (!token) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function normalizeState(d: Record<string, unknown>): CardState {
  return {
    balance: typeof d.balance === "number" ? d.balance : 0,
    breakdown: (d.breakdown as Record<string, number>) || {},
    referralCode: (d.referralCode as string) ?? null,
    referralCount: typeof d.referralCount === "number" ? d.referralCount : 0,
    member: !!d.member,
    joinReady: !!d.joinReady,
    discordConnected: !!d.discordConnected,
    discordUsername: (d.discordUsername as string) ?? null,
    discordReady: !!d.discordReady,
    mintReminder: {
      optedIn: !!(d.mintReminder as { optedIn?: boolean })?.optedIn,
      email: (d.mintReminder as { email?: string })?.email ?? null,
    },
    walletAddress: (d.walletAddress as string) ?? null,
    // Fall back only if an older PH deploy omits it. The card must never render
    // a threshold different from the one attach-wallet enforces, so this is a
    // first-paint safety net, not a second source of truth.
    gtdPointsRequired:
      typeof d.gtdPointsRequired === "number" ? d.gtdPointsRequired : 100,
    artSeed: (d.artSeed as string) ?? null,
    awarded: Array.isArray(d.awarded)
      ? (d.awarded as Array<{ action: string; points: number }>)
      : [],
  };
}

// ── Reads ────────────────────────────────────────────────────────────────────

/**
 * Load the card. Returns null when Clerk is off, the user is signed out, or the
 * feature is disabled upstream (404) — callers hide the surface rather than
 * showing an error.
 *
 * RETRIES 401s. Clerk session tokens are minted per request but the provider is
 * not ready the instant the app boots, and the Discord claim returns via a
 * FULL-PAGE navigation — i.e. always a cold boot. Without this the card would
 * reliably fail to load on exactly the return that matters most. PH's own modal
 * does the same, for the same reason.
 */
export async function fetchCardState(): Promise<CardState | null> {
  if (!isClerkEnabled()) return null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const headers = await authHeaders();
    if (!headers) {
      if (attempt === 2) return null;
      await sleep(1500);
      continue;
    }
    try {
      const r = await fetch("/api/creator-card-state", { headers });
      if (r.status === 401) {
        if (attempt === 2) return null;
        await sleep(1500);
        continue;
      }
      if (!r.ok) return null;
      const d = await r.json().catch(() => null);
      if (!d) return null;
      cachedState = normalizeState(d);
      return cachedState;
    } catch {
      return null;
    }
  }
  return null;
}

// ── Writes ───────────────────────────────────────────────────────────────────

/**
 * Record a click-initiated action (the honour asks, plus the connected-but-
 * unclaimed claim edge). The verified steps are recorded by the SERVER on load,
 * not here — do not add client calls for `contest` / `first_creation` /
 * `refer_friends`; PH checks its own evidence and would refuse them anyway.
 */
export async function recordCardAction(
  action: CardActionId,
): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Please sign in first." };
  try {
    const r = await fetch("/api/creator-card-action", {
      method: "POST",
      headers,
      body: JSON.stringify({ action }),
    });
    const d = await r.json().catch(() => ({}) as Record<string, unknown>);
    if (r.ok)
      return {
        ok: true,
        awarded: d.awarded as number,
        balance: d.balance as number,
      };
    return {
      ok: false,
      code: d.code as string,
      error: d.error as string,
      balance: d.balance as number,
    };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

/**
 * Join the Creator Program — which IS getting a Creator Card; one act, either
 * surface. Grants a one-time ink bonus into the shared balance.
 *
 * 409 ALREADY_JOINED is a SUCCESS: it means they joined on Panel Haus web,
 * which is the entire point of a shared account.
 */
export async function joinProgram(): Promise<JoinResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Please sign in first." };
  try {
    const r = await fetch("/api/creator-program-join", {
      method: "POST",
      headers,
    });
    const d = await r.json().catch(() => ({}) as Record<string, unknown>);
    if (r.ok) return { ok: true, bonusGranted: (d.bonusGranted as number) || 0 };
    if (r.status === 409 && d.code === "ALREADY_JOINED")
      return { ok: true, alreadyJoined: true };
    return { ok: false, error: (d.error as string) || "Could not join" };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

/**
 * Begin the Discord claim. Returns the authorize URL for the caller to navigate
 * to; it does NOT navigate itself, so the caller can keep the click inside the
 * user gesture and decide how to leave.
 */
export async function startDiscordClaim(): Promise<{
  url?: string;
  error?: string;
}> {
  const headers = await authHeaders();
  if (!headers) return { error: "Please sign in first." };
  try {
    const r = await fetch("/api/creator-discord-start", { headers });
    const d = await r.json().catch(() => ({}) as Record<string, unknown>);
    if (r.ok && typeof d.url === "string") return { url: d.url };
    return {
      error:
        d.code === "DISCORD_NOT_CONFIGURED"
          ? "Discord isn't configured yet"
          : (d.error as string) || "Could not start Discord connect",
    };
  } catch {
    return { error: "Network error" };
  }
}

/**
 * Attach the wallet the Smudgie mints to. Pasted path — unsigned by design.
 * Every guard (membership, the points gate, uniqueness, EIP-55 format) is
 * enforced upstream; we surface its message rather than pre-judging the address.
 */
export async function attachMintWallet(
  address: string,
): Promise<AttachWalletResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Please sign in first." };
  try {
    const r = await fetch("/api/creator-attach-wallet", {
      method: "POST",
      headers,
      body: JSON.stringify({ address }),
    });
    const d = await r.json().catch(() => ({}) as Record<string, unknown>);
    if (r.ok)
      return { ok: true, walletAddress: d.walletAddress as string };
    return {
      ok: false,
      code: d.code as string,
      error: (d.error as string) || "Could not attach that wallet",
    };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

/** Opt in/out of the single pre-mint reminder email. */
export async function setMintReminder(
  optIn: boolean,
  email?: string,
): Promise<{ ok: boolean; optedIn?: boolean; email?: string | null; error?: string }> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Please sign in first." };
  try {
    const r = await fetch("/api/creator-mint-reminder", {
      method: "POST",
      headers,
      body: JSON.stringify(email ? { optIn, email } : { optIn }),
    });
    const d = await r.json().catch(() => ({}) as Record<string, unknown>);
    if (r.ok)
      return {
        ok: true,
        optedIn: !!d.optedIn,
        email: (d.email as string) ?? null,
      };
    return { ok: false, error: (d.error as string) || "Could not save that" };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
