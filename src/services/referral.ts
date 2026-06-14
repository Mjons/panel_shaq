import { getClerkToken, isClerkEnabled } from "./clerkToken";

// Referral handling for Panel Haus Mobile. We add no referral data of our own;
// PH owns the program. We only: capture an incoming ?ref= code (PH's redirect or a
// shared link), link it to the account after Clerk sign-in via PH's idempotent
// endpoint, and fetch the user's own code for sharing. Mirrors PH's web flow.

// Strict PH code format (mirror Comic-Pro2 useReferralCapture.js).
const CODE_RE = /^PH-[A-Z0-9]{6}$/;
const CODE_KEY = "panelshaq_referral_code";
const COMIC_KEY = "panelshaq_referral_comic_id";

export interface StoredReferral {
  code: string;
  comicId: string | null;
}

export function getStoredReferral(): StoredReferral | null {
  try {
    const code = localStorage.getItem(CODE_KEY);
    if (!code) return null;
    return { code, comicId: localStorage.getItem(COMIC_KEY) };
  } catch {
    return null;
  }
}

export function clearStoredReferral(): void {
  try {
    localStorage.removeItem(CODE_KEY);
    localStorage.removeItem(COMIC_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Read ?ref= (+ optional ?comic=) from the URL, persist a valid code, and strip
 * ONLY those params (preserving anything else) so they don't linger or re-trigger.
 * Safe to run for signed-out visitors (they sign up afterwards).
 */
export function captureReferralFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (!ref || !CODE_RE.test(ref)) return;

    localStorage.setItem(CODE_KEY, ref);
    const comic = params.get("comic");
    if (comic) localStorage.setItem(COMIC_KEY, comic);

    params.delete("ref");
    params.delete("comic");
    const qs = params.toString();
    const url = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    window.history.replaceState(null, "", url);
  } catch {
    /* ignore */
  }
}

/**
 * If a referral code is stored and the user is signed in, link it via PH's
 * idempotent endpoint. Clears the stored code on a terminal response (linked OR
 * skipped); keeps it on network error to retry next session. No-op without Clerk
 * or a token.
 */
export async function linkPendingReferral(): Promise<void> {
  if (!isClerkEnabled()) return;
  const stored = getStoredReferral();
  if (!stored) return;

  const token = await getClerkToken();
  if (!token) return; // not signed in yet; try again later

  try {
    const r = await fetch("/api/referral-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        referralCode: stored.code,
        comicId: stored.comicId || undefined,
      }),
    });
    const d = await r.json().catch(() => ({}) as { ok?: boolean });
    if (r.ok && d?.ok) {
      clearStoredReferral();
      try {
        const { trackOnce } = await import("./analytics");
        trackOnce("referral_linked", { code: stored.code });
      } catch {
        /* ignore */
      }
    }
    // Non-ok (e.g. transient 5xx) → keep the stored code for a later attempt.
  } catch {
    /* network error; keep the code, retry next session */
  }
}

export interface MyReferral {
  code: string;
  referralUrl: string;
}

// The user's own code + URL never change, so cache them for the session (no
// re-fetch when reopening Settings). The referral count CAN change, so it's cached
// only for instant display and refreshed on each open.
let cachedReferral: MyReferral | null = null;
let cachedCount: number | null = null;

export function getCachedMyReferral(): MyReferral | null {
  return cachedReferral;
}

export function getCachedReferralCount(): number | null {
  return cachedCount;
}

/** Fetch the signed-in user's own referral code + canonical share URL (cached for
 *  the session since it's immutable). */
export async function fetchMyReferral(): Promise<MyReferral | null> {
  if (cachedReferral) return cachedReferral;
  if (!isClerkEnabled()) return null;
  const token = await getClerkToken();
  if (!token) return null;
  try {
    const r = await fetch("/api/referral-code", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (typeof d?.code === "string" && typeof d?.referralUrl === "string") {
      cachedReferral = { code: d.code, referralUrl: d.referralUrl };
      return cachedReferral;
    }
    return null;
  } catch {
    return null;
  }
}

/** Fetch how many friends this user has referred. Updates the cache. Returns null
 *  if unavailable. */
export async function fetchReferralCount(): Promise<number | null> {
  if (!isClerkEnabled()) return null;
  const token = await getClerkToken();
  if (!token) return null;
  try {
    const r = await fetch("/api/referral-stats", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (typeof d?.referralCount === "number") {
      cachedCount = d.referralCount;
      return cachedCount;
    }
    return null;
  } catch {
    return null;
  }
}
