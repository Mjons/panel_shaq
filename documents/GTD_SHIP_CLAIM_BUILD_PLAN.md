# GTD Ship-Claim Build Plan (Panel Haus Mobile)

**Status:** implemented (July 14, 2026) — pending the Upstash env vars in Vercel + manual QA

> **AMENDMENT (July 14, owner decision): the invite is SIGNED-IN ONLY.** This
> supersedes every "anonymous claim" statement below about the CLIENT trigger.
> `fireShipClaimOnce` returns early when no Clerk identity is registered — and
> it does so **before** any flag write, so a signed-out ship never burns the
> one shot (the invite still fires on the user's first signed-in ship). The
> `ShipClaimHost` is mounted in `App.tsx` only; the Clerk-free `/c/from-meme`
> root has no host (its `markShipped` calls keep recording share analytics but
> can never fire the invite). The **endpoint** (`api/creator-application`) is
> unchanged and still accepts anonymous POSTs — it is shared byte-for-byte
> with desktop's, and desktop's client remains anonymous-capable; diverging
> the server would fork the shared contract for no benefit.
**Ports from:** Comic-Pro2 (Panel Haus desktop) changelogs `1139` (feature), `1140` (code review), `1141` (endpoint hardening)
**Touches:** nothing in the Clerk auth or ink/credit systems. Read that sentence twice.

---

## 1. What this is

When a user **ships** (exports or shares their comic, GIF, `.comic` file, or meme), a one-shot modal appears:

> **You're a creator now.**
> You just shipped your first piece. That makes you a real UGC creator, and it earns you a **guaranteed spot** on the Smudgies drop whitelist.

They tap through to a short application (4 one-tap questions, plus an optional goal / X handle / 0x address), it POSTs to an anonymous Redis-backed endpoint, and they get a confirmation view. Desktop already does exactly this. We are giving mobile the same thing, registering into the **same store**.

### The user's question, answered directly

> "User shares their comic, they get registered the same way it does on Comic-Pro2. Is that the case?"

**Yes.** Same modal flow, same 4 questions, same optional fields, same anonymous free endpoint, and critically the application lands in the **same Upstash Redis under the same keys in the same record shape**:

```
creator:application:<identity>    one record per identity  (the shared dedupe key)
creator:applications             append-only admin list    (desktop's existing export script sees mobile leads)
```

A desktop claimer is suppressed on mobile, and a mobile claimer is suppressed on desktop, because both apps read and write the same `creator:application:<identity>` key — **when an identity exists**. One verified caveat: desktop resolves its claim identity from the **legacy JWT** (`creatorInvite.js safeUserId()` -> `getUserIdFromToken()`, which reads the old `nft_token`/`email_token`), not from Clerk. A pure-Clerk desktop claimer who types no wallet/handle submits `identity: null` -> no dedupe key -> mobile may prompt that user once more. Worst case is one duplicate lead row and one extra prompt (harmless: nothing is granted, everyone is auto-approved). Our mobile identity (`email:`/`web3:` from the Clerk session, §13) is strictly stronger than desktop's.

The only differences are mobile adaptations, not behaviour changes:

1. It renders as a `BottomSheet` instead of the desktop modal.
2. A second sheet host is needed for `/c/from-meme`, which is a separate React root.
3. We add server-side input validation, closing the still-open CR 1140 finding #5 in our copy.

---

## 2. The four invariants (violating any of these is a bug)

These come straight from the desktop source and its changelogs. They are the things most likely to be got wrong.

### 2.1 The claim GRANTS NOTHING

It locks a whitelist spot. That is all. The drop still mints at **0.03 ETH**. Everyone who ships is **auto-approved**: "spots are limited and reviewed" and "reviewed within 24 hours" are *framing*. There is no review queue, no pending state, no rejection path anywhere in the code (the stored record is only `{identity, application, ts}`).

Desktop states this plainly at `CreatorInviteModal.jsx:10-12`:

```js
// Short "application" - 4 one-tap questions (required) that double as the
// profiling seed, plus an optional goal + handle. Guise-of-elitism front door:
// everyone who shipped is auto-approved, but the framing implies a review.
```

**Our copy must not promise more than desktop's**, or the two apps contradict each other publicly. Ship the desktop strings verbatim. The rewards (Pro tools, 500 AI credits, a Smudgie) are framed as what **the drop** delivers, never as something the claim grants now.

### 2.2 It spends and grants ZERO credits

`grep -cniE "credit|requireAuth|deductCredit|reserveCredit" api/creator-application.js` on desktop returns **0**.

The credit/timeout invariant (reserve up front, refund on failure, an in-handler deadline whose budget matches `maxDuration`) applies to **paid** endpoints. This endpoint is free and makes no provider call, so it deliberately does none of that. **Do not "helpfully" add a credit guard, a reserve, a refund, or a deadline wrapper.** Do not import `credits.ts`, `inkCosts.ts`, or anything from the ink path.

### 2.3 The endpoint is ANONYMOUS

No `requireAuth`. No Clerk verification. Signed-out users must be able to claim, and the `/c/from-meme` root has no `ClerkProvider` at all. Gating is a client-side one-shot localStorage flag plus a server-side dedupe by identity. Storage is **Redis, not Postgres**.

If you reach for `requireAuth` or `apiPost` here, you break the whole feature.

### 2.4 `creator-application` is NOT `creator-program`

Two different systems. Do not conflate them.

| | `api/creator-application` (this) | `api/creator-program/*` (not this) |
|---|---|---|
| Auth | none, anonymous | Clerk `requireAuth` on all routes |
| Storage | Upstash Redis | Vercel Postgres |
| Feature flag | none | `ENABLE_CREATOR_PROGRAM` |
| Credits | none | grants credits |
| Wallet | unverified text | signature-verified |
| Purpose | lightweight lead capture at the ship moment | the real program (join, qualify, attach wallet) |

---

## 3. Architecture

```
ship surface  (ShareScreen x8, GifEditor x2, .comic x1, memeShare x5)
      |
      |  markShipped(surface, props?)
      v
src/services/shipClaim.ts          bus + one-shot gate + identity holder + submit
      |                            (imports ZERO Clerk)
      |  fan out to Set<Fn> listeners  (the buyCredits.ts pattern)
      v
src/components/ShipClaimHost.tsx   subscribes, owns open state.  MOUNTED TWICE:
      |                              - src/App.tsx           (main root)
      |                              - src/from-meme/FromMemeRoot.tsx (meme root)
      v
src/components/ShipClaimSheet.tsx  ONE component, BottomSheet, 3 views
      |
      |  plain fetch (anonymous, no Clerk, no ink)
      v
api/creator-application.ts         Upstash, SHARED DB with Panel Haus
```

### Two decisions already taken

**Own route + shared Upstash** (not a proxy). A proxy to Panel Haus's endpoint would present **our serverless egress IP** to its per-IP rate limiter, collapsing every mobile claimant into a single 10-per-hour bucket (the 11th mobile applicant in an hour would get a 429). Running our own route means the rate limiter sees the **real client IP** at our own edge, while pointing at the **same Upstash DB** keeps one dedupe namespace and one admin list. Zero Comic-Pro2 changes.

**Triggers: main app + meme receiver.** All the real mobile ship surfaces, including `/c/from-meme`. `makeComic.ts` is excluded on purpose (see §7.3).

> **Possible future pivot to comic-only.** The scope may later narrow to comic ships only (dropping memes). The architecture makes that a two-line change, and `markShipped` keeps emitting analytics either way: (a) remove `<ShipClaimHost />` from `FromMemeRoot.tsx` (the meme root can no longer show the sheet), and (b) add a surface prefix guard at the top of `fireShipClaimOnce` — `if (source.startsWith("meme_")) return;` — so meme ships stop arming the claim while `share_completed` analytics continue unchanged. No call sites move.

---

## 4. New file: `src/services/shipClaim.ts`

The core. Bus + gate + identity + submit.

**It must import zero Clerk.** It runs inside the Clerk-free meme root. Clerk data reaches it through a module-level holder, exactly the pattern already used by `src/services/clerkToken.ts`.

```ts
import { track } from "./analytics";

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

// localStorage keys follow the repo's panelshaq_* convention. They deliberately do
// NOT match desktop's key names: localStorage is per-origin, so panelhaus.app and
// m.panelhaus.app never share it anyway. Cross-app suppression is the server GET's job.
const SHOWN_KEY = "panelshaq_ship_claim_shown";
const APPLIED_KEY = "panelshaq_ship_claim_applied";
const ENDPOINT = "/api/creator-application";

// Let the native share sheet finish dismissing before we slide ours up.
const SHOW_DELAY_MS = 700;

// ---------- identity holder (set by ShipIdentityBridge, which lives inside ClerkProvider)

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
 * so a signed-in mobile claim keys on the same Redis id as the desktop claim.
 *
 * The anonymous fallbacks are byte-identical to desktop's applicationIdentity()
 * (raw lowercased wallet, then raw lowercased handle, no prefix, no @-stripping),
 * so an anonymous desktop applicant and an anonymous mobile applicant with the
 * same wallet collide on the same key. Do not "improve" this normalization.
 */
export function applicationIdentity(app: Partial<ClaimApplication> = {}): string | null {
  const id = _identity;
  if (id?.email) return `email:${id.email.trim().toLowerCase()}`;
  if (id?.wallet) return `web3:${id.wallet.trim().toLowerCase()}`;
  return (
    (app.wallet || "").trim().toLowerCase() ||
    (app.handle || "").trim().toLowerCase() ||
    null
  );
}

function identitySource(): string {
  const id = _identity;
  if (id?.email) return "clerk-email";
  if (id?.wallet) return "clerk-wallet";
  return "anon";
}

// ---------- localStorage gates (every access try/caught: blocked storage is non-fatal)

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

// ---------- the bus (mirrors src/services/buyCredits.ts)

type Fn = (source: string) => void;
const listeners = new Set<Fn>();

export function onShipClaim(fn: Fn): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// ---------- the one-shot gate

// Synchronous re-entrancy guard: the per-account gate below awaits a fetch, so two
// near-simultaneous ships could both pass shownLocally() and both fan out.
let dispatchInFlight = false;

export async function fireShipClaimOnce(source: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (shownLocally() || appliedLocally()) return;
  if (dispatchInFlight) return;
  dispatchInFlight = true;

  try {
    // Per-account gate: if this identity already applied (on ANY app, since we share
    // Panel Haus's Redis), never prompt again on this device either.
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
        // Network hiccup: FAIL OPEN. Show the modal rather than silently eating it.
      }
    }

    // Set the flag BEFORE fan-out so a re-entrant ship can't double-fire, and so
    // dismissing the sheet CONSUMES the one shot (desktop parity: no re-prompt, ever).
    markShownLocally(String(Date.now()));

    // Module-level timer, NOT a useEffect: an unmounting ship surface must not cancel it.
    setTimeout(() => {
      track("ship_claim_shown", { source });
      for (const fn of listeners) fn(source);
    }, SHOW_DELAY_MS);
  } finally {
    dispatchInFlight = false;
  }
}

// ---------- the single "ship" concept

/**
 * One call = one ship. Emits the existing share_completed analytics event (same name,
 * same {surface, ...} props, so no dashboard breaks) AND arms the claim.
 *
 * Invariant to keep this honest:
 *   grep -rn '"share_completed"' src/   ->   must match ONLY this file.
 */
export function markShipped(surface: string, props?: Props): void {
  track("share_completed", { surface, ...(props || {}) });
  void fireShipClaimOnce(surface); // never awaited, never throws
}

// ---------- submit

/**
 * Desktop parity: write localStorage FIRST, then POST, never throw, ignore the response.
 * The confirmation view must never be blocked by a storage or network failure.
 *
 * Plain fetch on purpose. apiPost() would call openClerkSignIn() and THROW for a
 * signed-out non-BYOK user, fire generation_started, and run an ink pre-check.
 */
export async function submitShipClaim(app: ClaimApplication, source: string): Promise<void> {
  try {
    localStorage.setItem(APPLIED_KEY, JSON.stringify({ ...app, ts: Date.now() }));
  } catch {
    /* storage blocked */
  }

  const id = _identity;
  const application = {
    ...app,
    app: "mobile",
    source,
    identity_source: identitySource(),
    ...(id?.clerkUserId ? { clerk_user_id: id.clerkUserId } : {}),
    ...(id?.email ? { email: id.email } : {}),
  };

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

// ---------- dev / QA helpers

export function forceShipClaim(): void {
  for (const fn of listeners) fn("admin-test");
}

export function resetShipClaim(): void {
  try {
    localStorage.removeItem(SHOWN_KEY);
    localStorage.removeItem(APPLIED_KEY);
  } catch {
    /* ignore */
  }
}
```

> **Note on `resetShipClaim`:** it must clear **both** keys. Desktop shipped a bug where clearing only the shown-flag left `appliedLocally()` suppressing the modal forever (fixed in 1141).

---

## 5. New file: `api/creator-application.ts`

**Self-contained.** Per `CLAUDE.md`, Vercel cannot share local files between functions, and `lib/api-utils.ts` is imported by nothing. Keep it that way. This route imports only `@upstash/redis` and `node:crypto`.

**Imports no auth helper, no credit helper, no Supabase.**

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import crypto from "node:crypto";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

// Keys MUST match Panel Haus byte for byte: we share its Upstash DB, so one wrong
// character silently forks the dedupe namespace and desktop's admin export stops
// seeing mobile leads. See Comic-Pro2 api/creator-application.js.
const keyFor = (id: string) => `creator:application:${String(id).slice(0, 200)}`;
const LIST_KEY = "creator:applications";

const RATE_MAX = parseInt(process.env.CREATOR_APP_RATE_LIMIT_PER_HOUR || "10", 10);
const RATE_WINDOW = 3600;
const MAX_APP_CHARS = parseInt(process.env.CREATOR_APP_MAX_CHARS || "4000", 10);
const LIST_MAX = parseInt(process.env.CREATOR_APP_LIST_MAX || "20000", 10);
const KEY_TTL = parseInt(process.env.CREATOR_APP_KEY_TTL_DAYS || "365", 10) * 86400;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/**
 * Trusted-hop client IP. The RIGHTMOST x-forwarded-for entry is the edge-appended
 * one; the leftmost is client-controlled and an attacker could rotate it to mint
 * unlimited rate-limit buckets.
 */
function clientIpHash(req: VercelRequest): string {
  const xff = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ip =
    (req.headers["x-real-ip"] as string) ||
    xff[xff.length - 1] ||
    (req.socket as any)?.remoteAddress ||
    "unknown";
  return crypto.createHash("sha256").update(String(ip)).digest("hex").slice(0, 16);
}

// ---------- validation (fixes the still-open CR 1140 finding #5 on the desktop copy)

const ENUMS: Record<string, readonly string[]> = {
  made: ["Comic", "Meme", "Brand content", "Other"],
  audience: ["Myself", "A brand or client", "A community I run"],
  platform: ["X", "TikTok", "Instagram", "Discord", "Nowhere yet"],
  cadence: ["Daily", "Weekly", "Now and then"],
};

// Strip control chars and angle brackets so nothing stored can ever render as markup
// in an admin panel, present or future.
const clean = (v: unknown, max: number): string =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .replace(/[<>]/g, "")
        .trim()
        .slice(0, max)
    : "";

/** Build a FRESH allowlisted object. Unknown keys are dropped, never passed through. */
function sanitizeApplication(raw: any): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;

  const out: Record<string, string> = {};

  // The 4 required enums. Anything not exactly on the offered list is a 400.
  for (const key of Object.keys(ENUMS)) {
    const v = raw[key];
    if (typeof v !== "string" || !ENUMS[key].includes(v)) return null;
    out[key] = v;
  }

  const goal = clean(raw.goal, 500);
  if (goal) out.goal = goal;

  const handle = clean(raw.handle, 64);
  if (handle) out.handle = handle;

  const wallet = typeof raw.wallet === "string" ? raw.wallet.trim() : "";
  if (/^0x[a-fA-F0-9]{40}$/.test(wallet)) out.wallet = wallet;

  // Offline-dedupe metadata we attach client-side.
  if (raw.app === "mobile") out.app = "mobile";
  if (typeof raw.source === "string" && /^[a-z0-9_]{1,40}$/.test(raw.source)) {
    out.source = raw.source;
  }
  if (typeof raw.clerk_user_id === "string" && /^user_[A-Za-z0-9]{1,48}$/.test(raw.clerk_user_id)) {
    out.clerk_user_id = raw.clerk_user_id;
  }
  const email = clean(raw.email, 200);
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.email = email;
  if (["clerk-email", "clerk-wallet", "anon"].includes(raw.identity_source)) {
    out.identity_source = raw.identity_source;
  }

  return out;
}

/** The Redis key. Printable ASCII only, so it can't pollute the key namespace. */
function sanitizeIdentity(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v || v.length > 200) return null;
  return /^[\x21-\x7E]+$/.test(v) ? v : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Use .json(), not .end(): the dev plugin's mockRes has no end().
  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });

  const redis = getRedis();

  // ----- GET: has this identity already applied? Fail open. NOT rate limited.
  if (req.method === "GET") {
    const identity = sanitizeIdentity(req.query?.identity);
    if (!identity || !redis) return res.status(200).json({ applied: false });
    try {
      const exists = await redis.exists(keyFor(identity));
      return res.status(200).json({ applied: !!exists });
    } catch {
      return res.status(200).json({ applied: false }); // fail open
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ----- POST
  const rawApp = (req.body as any)?.application;
  if (JSON.stringify(rawApp || {}).length > MAX_APP_CHARS) {
    return res.status(413).json({ error: "Application too large", code: "PAYLOAD_TOO_LARGE" });
  }

  const application = sanitizeApplication(rawApp);
  if (!application) {
    return res.status(400).json({ error: "Invalid application", code: "INVALID_APPLICATION" });
  }

  const identity = sanitizeIdentity((req.body as any)?.identity);

  // Rate limit: best effort. A Redis hiccup must NEVER block a legit applicant.
  if (redis) {
    try {
      const rlKey = `ratelimit:creator-app:${clientIpHash(req)}`;
      const hits = await redis.incr(rlKey);
      if (hits === 1) await redis.expire(rlKey, RATE_WINDOW);
      if (hits > RATE_MAX) {
        return res
          .status(429)
          .json({ error: "Too many applications. Try again later.", code: "RATE_LIMIT" });
      }
    } catch (e: any) {
      console.warn("[creator-application] rate-limit check failed:", e?.message);
    }
  }

  // Stored as a JSON STRING: Panel Haus's admin list reader expects strings.
  const record = JSON.stringify({
    identity: identity ? String(identity).slice(0, 200) : null,
    application,
    ts: Date.now(),
  });

  // No Redis configured: never 500. Intent capture must not block the confirmation view.
  if (!redis) {
    console.warn("[creator-application] Upstash not configured; application dropped");
    return res.status(200).json({ ok: true, alreadyApplied: false });
  }

  try {
    if (identity) {
      const already = await redis.exists(keyFor(identity));
      if (already) return res.status(200).json({ ok: true, alreadyApplied: true });
      await redis.set(keyFor(identity), record, { ex: KEY_TTL });
    }
    await redis.rpush(LIST_KEY, record);
    await redis.ltrim(LIST_KEY, -LIST_MAX, -1);
  } catch (e: any) {
    console.warn("[creator-application] redis write failed:", e?.message);
    // Still return ok: the user did their part.
  }

  return res.status(200).json({ ok: true, alreadyApplied: false });
}
```

### Contract summary

| Method | Result |
|---|---|
| `OPTIONS` | `200 {ok:true}` |
| `GET ?identity=<id>` | `200 {applied:boolean}`. No identity / no Redis / Redis throw -> `{applied:false}` (fail open). Not rate limited. |
| `POST {identity, application}` | `200 {ok:true, alreadyApplied:boolean}` |
| | `400 INVALID_APPLICATION` (enum validation failed) |
| | `413 PAYLOAD_TOO_LARGE` (>4000 chars) |
| | `429 RATE_LIMIT` (>10/hour/IP) |
| anything else | `405` |

---

## 6. New UI files

### 6.1 `src/components/ShipClaimHost.tsx`

This is what lets both React roots share one sheet without duplicating it.

```tsx
import { useEffect, useState } from "react";
import { onShipClaim } from "../services/shipClaim";
import { track } from "../services/analytics";
import { ShipClaimSheet } from "./ShipClaimSheet";

export function ShipClaimHost() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");

  useEffect(
    () =>
      onShipClaim((s) => {
        setSource(s);
        setOpen(true);
      }),
    [],
  );

  return (
    <ShipClaimSheet
      isOpen={open}
      source={source}
      onClose={(view) => {
        track("ship_claim_dismissed", { source, view });
        setOpen(false);
      }}
    />
  );
}
```

### 6.2 `src/components/ShipClaimSheet.tsx`

One component, rendered under **both** roots. Wraps `BottomSheet` (`{isOpen, onClose, title?, children}`), structurally modelled on `BuyCreditsSheet.tsx` (local `busy` state, no toast needed since submit never visibly fails).

**Verified safe in the Clerk-free meme root:** `BottomSheet` uses `useCoachTipSuppression`, which calls module-level `pauseCoachTips()` / `resumeCoachTips()`. It is **not** a React context, so no provider is required.

Three views: `invite` -> `apply` -> `done`.

**Copy, verbatim from desktop.** Do not paraphrase.

- Invite: heading **"You're a creator now."**, body "You just shipped your first piece. That makes you a real UGC creator, and it earns you a **guaranteed spot** on the Smudgies drop whitelist."
- Section header **"Your GTD whitelist unlocks"** with the three rewards (Pro tools / 500 AI credits / Your own Smudgie), framed as what **the drop** delivers.
- "Spots are limited and reviewed. Takes about a minute."
- Invite CTA: **"Claim my GTD spot"**. Reward descriptions verbatim: Pro tools "The full studio, unlocked." / 500 AI credits "On the house, to keep creating." / Your own Smudgie "Full of surprises."
- Done: heading **"You're on the list."**, body "Application in. GTD spots are reviewed within 24 hours — we'll email you before the **Smudgies drop**, where you'll unlock Pro tools, 500 AI credits, and your Smudgie."

**The 4 required questions, verbatim:**

```ts
const CHOICE_QS = [
  { key: "made",     q: "What did you just make?", opts: ["Comic", "Meme", "Brand content", "Other"] },
  { key: "audience", q: "Who do you create for?",  opts: ["Myself", "A brand or client", "A community I run"] },
  { key: "platform", q: "Where do you post?",      opts: ["X", "TikTok", "Instagram", "Discord", "Nowhere yet"] },
  { key: "cadence",  q: "How often do you ship?",  opts: ["Daily", "Weekly", "Now and then"] },
] as const;
```

Rendered as single-select chips, min 44px tap height.

**The 3 optional fields:**

| Field | Control | Validation |
|---|---|---|
| `goal` | textarea, "What do you want out of the Smudgies drop?", placeholder "A sentence is plenty." | none |
| `handle` | text, "X handle", placeholder "@you" | none |
| `wallet` | text, "Ethereum address", placeholder "0x..." | valid iff **empty** or `/^0x[a-fA-F0-9]{40}$/` |

Wallet helper text: "This is where your Smudgie mints at the drop. No wallet yet? Add it later." On invalid: "That doesn't look like an ETH address (0x + 40 characters)."

**Submit enabled iff** all 4 choices answered **and** wallet valid-or-empty **and** not submitting.

```tsx
const choicesDone = CHOICE_QS.every((q) => answers[q.key]);
const wallet = (answers.wallet || "").trim();
const walletValid = !wallet || /^0x[a-fA-F0-9]{40}$/.test(wallet);
const canSubmit = choicesDone && walletValid && !submitting;
```

On submit: `await submitShipClaim(answers, source)` (never throws), then `setView("done")` unconditionally.

**Wallet prefill:** `getShipIdentity()?.wallet` on open. Bonus only, and it is `undefined` for email users and always `undefined` in the meme root, so the field stays free text.

**Art:** `SMUDGE_POSES.cheering` from `src/components/Smudge.tsx` (`/Smudge_the_dirty_sponge/15-cheering.webp`). Keep the `onError` hide. **Drop desktop's CSS confetti** (60 lines, janky on low-end Android).

### 6.3 `src/components/ShipIdentityBridge.tsx`

The only Clerk-touching piece. Mounted in `main.tsx` **inside `<ClerkProvider>`**, next to `<PosthogIdentifyBridge/>`.

```tsx
import { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { registerShipIdentity } from "../services/shipClaim";

export function ShipIdentityBridge() {
  const { isSignedIn, user } = useUser();

  useEffect(() => {
    if (isSignedIn && user) {
      registerShipIdentity({
        clerkUserId: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        wallet: user.web3Wallets?.[0]?.web3Wallet,
      });
    } else {
      registerShipIdentity(null);
    }
  }, [isSignedIn, user]);

  return null;
}
```

Why a bridge instead of calling `useUser()` in the sheet: the sheet also renders under `FromMemeRoot`, which has **no `ClerkProvider`**. `useUser()` there would throw and take down the whole meme editor.

---

## 7. Files to modify

### 7.1 Ship call sites: `track("share_completed", ...)` becomes `markShipped(...)`

**Why a helper instead of adding `fireShipClaimOnce` next to each `track()` call:** the alternative is 14 two-line edits, and it permanently couples "did we remember both calls?" to reviewer diligence. Any future ship surface would silently lose the claim trigger. With `markShipped`, each site is a one-token rename, the 3 currently-untracked surfaces get analytics for free, and there is a mechanical invariant:

```
grep -rn '"share_completed"' src/    ->    must match ONLY src/services/shipClaim.ts
```

The event name and props are unchanged, so no existing PostHog or Vercel dashboard breaks.

| File | Sites | Change |
|---|---|---|
| `src/screens/ShareScreen.tsx` | 155, 167, 198, 212, 352, 372, 413, 429 | `track("share_completed", {surface: "X", ...rest})` -> `markShipped("X", {...rest})` |
| `src/screens/ShareScreen.tsx` | **265** | after `await downloadComicFile(json, projectName)`, add `markShipped("comic_file_export")`. **New analytics surface** (it fires nothing today). |
| `src/screens/GifEditorScreen.tsx` | **113** `handleDownload` | after `link.click()`, add `markShipped("gif_download")`. **New.** |
| `src/screens/GifEditorScreen.tsx` | **123** `handleShare` | wrap `navigator.share` in try/catch. Fire `markShipped("gif_share")` **only on a resolved share**. Swallow `AbortError`. Fall through to `handleDownload()` on other errors. **This also fixes a live bug:** the `navigator.share` there is currently uncaught, so a user cancelling the share sheet produces an unhandled rejection. |
| `src/from-meme/memeShare.ts` | 5 sites (`meme_share`, `meme_share_download`, `meme_copy`, `meme_copy_download`, `meme_download`) | `track(...)` -> `markShipped(...)` |

### 7.2 Hosts

| File | Change |
|---|---|
| `src/App.tsx` | Render `<ShipClaimHost />` after the `BuyCreditsSheet` block (around 762-771). **Un-gated.** Do **NOT** wrap it in `isClerkEnabled()`. |
| `src/from-meme/FromMemeRoot.tsx` | Render `<ShipClaimHost />` as a sibling of `<FromMemeInner/>`, **inside `<ToastProvider>`**: <br>`<ToastProvider><FromMemeInner /><ShipClaimHost /></ToastProvider>` |
| `src/main.tsx` | Add `<ShipIdentityBridge />` inside `<ClerkProvider>`, next to `<PosthogIdentifyBridge />`. |

> **Why not inside `FromMemeInner`:** it early-returns on several branches (`if (adminGallery) return <AdminGallery/>`, loading, error), so a sibling placed inside it would be skipped. Putting it in `FromMemeRoot` means it survives every branch, renders `null` until the bus fires, and costs nothing.

> **`main.tsx` renders `<FromMemeRoot/>` INSTEAD of `<App/>`**, never both, so the two hosts can never double-mount.

### 7.3 Do NOT touch

- **`src/from-meme/makeComic.ts`.** It calls `window.location.assign("/")` immediately after its `track()`. A modal there would mount and be instantly destroyed, **burning the one shot with nothing shown** (the flag is written before fan-out). Leave its `track()` call as-is and add a comment explaining the exclusion.
- `geminiService.ts`, `credits.ts`, `inkCosts.ts`, `clerkToken.ts`, and every credit-bearing API route.

### 7.4 Supporting changes

| File | Change |
|---|---|
| `vite.config.ts` | **Dev-only.** The `vercelApiDev` plugin's `mockReq` (lines 17-21) has **no `query`**, so the `GET ?identity=` gate silently fails open and cannot be tested locally. Add `query` parsed from `req.url`, plus `end()` / `setHeader()` no-ops on `mockRes`. |
| `package.json` | Add `@upstash/redis` (match Comic-Pro2's pin). |
| `CLAUDE.md` | Document the two new server env vars in the "Server (Vercel env, runtime)" section. |

---

## 8. Analytics

`Props = Record<string, string \| number \| boolean>`. **Flat scalars only**, no nested objects or arrays.

| Event | Props |
|---|---|
| `share_completed` (existing) | `{surface, ...}`; now also emits `comic_file_export`, `gif_download`, `gif_share` |
| `ship_claim_shown` | `{source}` |
| `ship_claim_started` | `{source}` (invite -> apply tap) |
| `ship_claim_submitted` | `{source, made, audience, platform, cadence, has_goal, has_handle, has_wallet, signed_in}` |
| `ship_claim_dismissed` | `{source, view}` where view is `invite` / `apply` / `done` |

**Never** send `goal`, `handle`, or `wallet` **values** to analytics. Booleans only.

---

## 9. Env + dependencies

**Dependency:** `@upstash/redis`.

**Server env** (Vercel Production + Preview, and `.env.local` for dev). Use the **same values as Panel Haus**, that is the whole point:

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Optional overrides, all defaulting to Panel Haus's numbers. Only set them if you need to diverge:

```
CREATOR_APP_RATE_LIMIT_PER_HOUR=10
CREATOR_APP_MAX_CHARS=4000
CREATOR_APP_LIST_MAX=20000
CREATOR_APP_KEY_TTL_DAYS=365
```

**No `VITE_*` flag.** The feature is always on.

**`vercel.json`: no change.** It has no `functions` block (routes set `maxDuration` per-file via `export const config`), and its rewrite already excludes `/api/`. This route needs no `maxDuration`: it makes no provider call.

---

## 10. Implementation order

1. `npm install @upstash/redis`.
2. Write `api/creator-application.ts`. Test it with `curl` before any UI exists.
3. Write `src/services/shipClaim.ts`.
4. Fix `vite.config.ts` (add `req.query`) so the GET gate is testable locally.
5. Write `ShipClaimSheet.tsx`, `ShipClaimHost.tsx`, `ShipIdentityBridge.tsx`.
6. Mount the hosts (`App.tsx`, `FromMemeRoot.tsx`) and the bridge (`main.tsx`).
7. Migrate the ship call sites to `markShipped` (ShareScreen x9, GifEditorScreen x2, memeShare x5).
8. `npm run lint`, then work the verification list.
9. Update `CLAUDE.md` + `CHANGELOG.md`.

---

## 11. Verification

`npm run lint` (`tsc --noEmit`) is the **only** automated check; there is no test suite. Use **`./dev.ps1`** (port **3002**), which loads `.env.local` server vars. Plain `npm run dev` will not hand the route its Upstash creds.

1. `npm run lint` is clean.
2. `grep -rn '"share_completed"' src/` matches **only** `src/services/shipClaim.ts` plus the deliberate `makeComic.ts` exclusion (kept on `track()` with an explanatory comment — it navigates away immediately). This is the mechanical proof that all 13 pre-existing sites migrated.
3. `grep -n "clerk" src/components/ShipClaimSheet.tsx src/components/ShipClaimHost.tsx src/services/shipClaim.ts` returns **nothing**. (If it does, the meme root will crash.)
4. **Anonymous path (the critical one).** Private window, **do not sign in**. Share tab -> tap any share/download. Expect: the sheet slides up after ~700ms, **no Clerk sign-in modal**, no `generation_started` event, no ink call. Complete the form -> exactly one `POST /api/creator-application` -> `{ok:true, alreadyApplied:false}` -> done view.
5. **Meme root.** `http://localhost:3002/c/from-meme?stub=1&template=drake-hotline-bling` -> share or download the meme -> the sheet appears, and there is **no Clerk error** in the console.
6. **One-shot.** Ship again -> nothing happens.
7. **Dismissal consumes the shot.** Reset, ship, close the sheet without applying, ship again -> it does **not** reappear.
8. **Reset for re-testing.** Clear **both** keys (clearing only the first leaves the second suppressing):
   ```js
   localStorage.removeItem("panelshaq_ship_claim_shown");
   localStorage.removeItem("panelshaq_ship_claim_applied");
   ```
9. **Signed-in server gate.** Sign in, apply, clear both localStorage keys, ship again -> the `GET ?identity=email:you@x.com` returns `{applied:true}` -> **no modal**, and `panelshaq_ship_claim_shown === "already-applied"`. (Requires the `vite.config.ts` query fix.)
10. **Fail open.** Block `/api/creator-application` in DevTools -> ship -> the modal still shows.
11. **Server validation.**
    ```bash
    # enum violation -> 400
    curl -X POST localhost:3002/api/creator-application -H 'content-type: application/json' \
      -d '{"identity":"x","application":{"made":"<img src=x onerror=alert(1)>"}}'

    # valid, but with markup in a free-text field -> 200, and the stored goal has < > stripped
    curl -X POST localhost:3002/api/creator-application -H 'content-type: application/json' \
      -d '{"identity":"web3:0xabc","application":{"made":"Comic","audience":"Myself","platform":"X","cadence":"Daily","goal":"<script>hi</script>"}}'
    ```
12. **Rate limit.** 11 POSTs in a row -> the 11th returns `429 RATE_LIMIT`.
13. **Shared namespace (proves the whole premise).** After a mobile submit, run the same GET against **panelhaus.app** with the same identity -> `{applied:true}`. That is one dedupe namespace and one admin list, confirmed.
14. **Regression: the credit system is untouched.** Sign in, run a generation -> ink still reserves and refunds, the ink chip still updates, the Buy Ink sheet still opens from Settings.

---

## 12. Risks, ranked

1. **Reusing `apiPost`.** `geminiService.ts:151-157` calls `openClerkSignIn()` and **throws** for a signed-out non-BYOK user, and it fires `generation_started` plus an ink pre-check. Using it breaks the anonymous requirement, pollutes the funnel, and drags in the credit system. The plain-fetch helper inside `shipClaim.ts` is non-negotiable.
2. **Sharing Panel Haus's Upstash DB.** We write to its live keys. One wrong character in a key string, or pushing an object where Panel Haus pushes a JSON **string**, silently forks the namespace or corrupts its admin list reader. Copy the three key strings character for character and confirm with verification step 13.
3. **The sheet importing Clerk, directly or transitively.** It renders under `FromMemeRoot`, which has no `ClerkProvider`, so a `useUser()` anywhere in that tree throws and takes down the whole meme editor. Enforce with verification step 3.
4. **Gating `<ShipClaimHost/>` behind `isClerkEnabled()`** by copy-pasting the `BuyCreditsSheet` block next to it. That silently kills the anonymous path. This is the single easiest mistake to make here.
5. **`makeComic.ts`.** If it ever calls `markShipped`, the modal mounts and is destroyed by its `window.location.assign("/")`, burning the one shot with nothing shown. Excluded on purpose.
6. **GIF share -> download fallback double-firing.** `handleShare` falls through to `handleDownload()`, which also ships. Fire `gif_share` only on a **resolved** `navigator.share`, never on `AbortError`. The claim itself is idempotent, but analytics would double-count.
7. **Copy drift.** Any rewording of "guaranteed spot" or "reviewed within 24 hours", or anything implying the claim grants something **now**, contradicts desktop's public copy.
8. **PWA cache.** `registerType: "autoUpdate"` means returning users run a stale bundle for one load after deploy. Not a correctness issue, but expect it in QA: the sheet will not appear until the second load.

---

## 13. Identity: the one accepted imperfection

Panel Haus's canonical `user_id` is resolved from **Postgres** (`Comic-Pro2/api/lib/clerk.js:121`), so mobile cannot compute it with certainty. Its construction is near-deterministic though, verified at `clerk.js:108`:

```js
const userId = normEmail ? `email:${normEmail}` : `web3:${normWallet}`;   // email wins
```

We mirror that exactly (see `applicationIdentity` in §4), so signed-in claims key on the same Redis id across both apps.

**Residual risk (two causes, verified):**

1. A pre-existing *legacy* Panel Haus row can carry either id shape (a wallet-first legacy account with an email later attached keeps `web3:...`), so a small number of users could key differently across apps.
2. **Desktop's claim identity is legacy-JWT-based, not Clerk-based.** `creatorInvite.js safeUserId()` calls `getUserIdFromToken()` (`authHelpers.js:229`), which decodes the old `nft_token`/`email_token` — for users who have one, `payload.userId` IS the `email:<x>`/`web3:<x>` convention, so it matches what we compute. But a pure-Clerk desktop user with no legacy token gets `null`, falls back to typed wallet/handle, and often submits `identity: null` — no dedupe key at all.

**Worst case in both: one duplicate lead row and one extra prompt.** Harmless: nothing is granted, everyone is auto-approved, and no credits move.

**Mitigation:** we stash `clerk_user_id`, `email`, `app: "mobile"`, `source`, and `identity_source` inside the `application` payload, so an admin can join offline on Panel Haus's `users.clerk_user_id` and dedupe with certainty.

---

## 14. Out of scope

- **Any Comic-Pro2 change.** Its endpoint's open CR 1140 finding #5 (no server-side enum validation, latent stored-XSS if an admin panel renders the values) is the owner's to fix. We fix it in **our** copy and should tell them.
- **The Creator Program** (`api/creator-program/*`). Different system: Clerk-authed, Postgres, feature-flagged, grants credits.
- **Any change to the Clerk auth or ink/credit systems.** They stay untouched.
- Git stays manual: commit only when asked, push only when asked.
