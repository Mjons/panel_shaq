import { track } from "./analytics";

// GTD ship-claim (mobile half of Comic-Pro2's creator-invite feature).
// One "ship" (export/share completed) → a one-shot bottom sheet inviting the
// user to claim a GTD whitelist spot. Claiming grants NOTHING immediately —
// it locks a whitelist spot only; everyone who ships is auto-approved.
//
// SIGNED-IN ONLY: the invite fires only when a Clerk identity is present
// (product decision — GTD spots are for authenticated exporters). A signed-out
// ship is a silent no-op that does NOT consume the one-shot flag, so the user
// still gets their invite the first time they ship while signed in. Ships from
// the Clerk-free /c/from-meme root therefore never fire (identity is always
// null there); markShipped still records their share_completed analytics.
//
// This module must import ZERO Clerk (markShipped is called from the meme
// root too). Clerk data arrives via the registerShipIdentity holder (set by
// <ShipIdentityBridge/>, which lives inside <ClerkProvider>) — the same
// holder pattern as src/services/clerkToken.ts.

type Props = Record<string, string | number | boolean>;

export type ShipIdentity = {
  clerkUserId: string;
  email?: string;
  wallet?: string;
};

export type ClaimApplication = {
  made: string;
  audience: string;
  platform: string;
  cadence: string;
  goal?: string;
  handle?: string;
  wallet?: string;
};

// panelshaq_* per this repo's convention. Deliberately NOT desktop's key names:
// localStorage is per-origin so the apps never share it — cross-app suppression
// is the server GET's job (both apps share one Upstash namespace).
const SHOWN_KEY = "panelshaq_ship_claim_shown";
const APPLIED_KEY = "panelshaq_ship_claim_applied";
const ENDPOINT = "/api/creator-application";

// Let the native share sheet finish dismissing before ours slides up.
const SHOW_DELAY_MS = 700;

// ---------- identity holder ----------

let _identity: ShipIdentity | null = null;

export function registerShipIdentity(id: ShipIdentity | null): void {
  _identity = id;
}

export function getShipIdentity(): ShipIdentity | null {
  return _identity;
}

/**
 * Mirrors Panel Haus's user_id construction (Comic-Pro2 api/lib/clerk.js:108):
 *   const userId = normEmail ? `email:${normEmail}` : `web3:${normWallet}`;
 * so a signed-in mobile claim keys on the same Redis id as a desktop claim.
 *
 * The anonymous fallbacks are byte-identical to desktop's applicationIdentity()
 * (raw lowercased wallet, then raw lowercased handle — no prefix, no
 * @-stripping) so anonymous claimers with the same wallet collide on the same
 * key across apps. Do not "improve" this normalization.
 */
export function applicationIdentity(
  app: Partial<ClaimApplication> = {},
): string | null {
  if (_identity?.email) return `email:${_identity.email.trim().toLowerCase()}`;
  if (_identity?.wallet) return `web3:${_identity.wallet.trim().toLowerCase()}`;
  return (
    (app.wallet || "").trim().toLowerCase() ||
    (app.handle || "").trim().toLowerCase() ||
    null
  );
}

function identitySource(): string {
  if (_identity?.email) return "clerk-email";
  if (_identity?.wallet) return "clerk-wallet";
  return "anon";
}

// ---------- localStorage gates (blocked storage is non-fatal) ----------

function markShownLocally(val: string): void {
  try {
    localStorage.setItem(SHOWN_KEY, val);
  } catch {
    /* storage blocked */
  }
}

function shownLocally(): boolean {
  try {
    return !!localStorage.getItem(SHOWN_KEY);
  } catch {
    return false;
  }
}

function appliedLocally(): boolean {
  try {
    return !!localStorage.getItem(APPLIED_KEY);
  } catch {
    return false;
  }
}

// ---------- the bus (mirrors src/services/buyCredits.ts) ----------

type Fn = (source: string) => void;
const listeners = new Set<Fn>();

export function onShipClaim(fn: Fn): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// ---------- the one-shot gate ----------

// Synchronous re-entrancy guard: the per-account gate below awaits a fetch, so
// two near-simultaneous ships could both pass shownLocally() and both fan out.
let dispatchInFlight = false;

export async function fireShipClaimOnce(source: string): Promise<void> {
  if (typeof window === "undefined") return;
  // Signed-in only. Return BEFORE any flag write: a signed-out ship must not
  // burn the one shot — the invite should still fire on their first
  // signed-in ship.
  if (!_identity) return;
  if (shownLocally() || appliedLocally()) return;
  if (dispatchInFlight) return;
  dispatchInFlight = true;

  try {
    // Per-account gate: if this identity already applied (on EITHER app — the
    // Upstash namespace is shared with Panel Haus), never prompt on this device.
    const id = applicationIdentity();
    if (id) {
      try {
        const res = await fetch(`${ENDPOINT}?identity=${encodeURIComponent(id)}`);
        if (res.ok) {
          const { applied } = await res.json();
          if (applied) {
            markShownLocally("already-applied");
            return;
          }
        }
      } catch {
        // Network hiccup — FAIL OPEN: show the modal rather than eating it.
      }
    }

    // Flag BEFORE fan-out: a re-entrant ship can't double-fire, and dismissing
    // the sheet CONSUMES the one shot (desktop parity — no re-prompt, ever).
    markShownLocally(String(Date.now()));

    // Module-level timer (not a useEffect) so an unmounting ship surface
    // can't cancel it.
    setTimeout(() => {
      track("ship_claim_shown", { source });
      for (const fn of listeners) fn(source);
    }, SHOW_DELAY_MS);
  } finally {
    dispatchInFlight = false;
  }
}

// ---------- the single "ship" concept ----------

/**
 * One call = one ship. Emits the existing share_completed analytics event
 * (same name, same {surface, ...} props — no dashboard breaks) AND arms the
 * claim. Invariant: grep -rn '"share_completed"' src/ → only this file, plus
 * the deliberate makeComic.ts exclusion (it navigates away immediately, which
 * would destroy the sheet and burn the one shot).
 */
export function markShipped(surface: string, props?: Props): void {
  track("share_completed", { surface, ...(props || {}) });
  void fireShipClaimOnce(surface); // never awaited, never throws
}

// ---------- submit ----------

/**
 * Desktop parity: write localStorage FIRST, then POST, never throw, ignore the
 * response. The done view must never be blocked by storage/network failure.
 *
 * Plain fetch on purpose — apiPost() would open Clerk sign-in and THROW for a
 * signed-out non-BYOK user, fire generation_started, and run an ink pre-check.
 */
export async function submitShipClaim(
  app: ClaimApplication,
  source: string,
): Promise<void> {
  try {
    localStorage.setItem(APPLIED_KEY, JSON.stringify({ ...app, ts: Date.now() }));
  } catch {
    /* storage blocked */
  }

  const application: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(app).filter(([, v]) => typeof v === "string" && v),
    ),
    app: "mobile",
    source,
    identity_source: identitySource(),
  };
  if (_identity?.clerkUserId) application.clerk_user_id = _identity.clerkUserId;
  if (_identity?.email) application.email = _identity.email;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: applicationIdentity(app), application }),
      signal: controller.signal,
    });
  } catch {
    /* non-blocking by design */
  } finally {
    clearTimeout(timer);
  }
}

// ---------- dev / QA helpers ----------

export function forceShipClaim(): void {
  for (const fn of listeners) fn("admin-test");
}

/** Clears BOTH keys — clearing only _shown leaves _applied suppressing forever. */
export function resetShipClaim(): void {
  try {
    localStorage.removeItem(SHOWN_KEY);
    localStorage.removeItem(APPLIED_KEY);
  } catch {
    /* ignore */
  }
}
