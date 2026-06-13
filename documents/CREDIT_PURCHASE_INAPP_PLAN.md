# In-App Credit Purchase (Stripe) — Implementation Plan

> Self-contained: written so an engineer/agent with **no prior context** can build it.
> Lets panel_shaq (`m.panelhaus.app`) sell ink credits using **Panel Haus's existing
> Stripe** — same prices, same checkout, same webhook, same shared balance. No Stripe
> keys or webhook on our side.

Companion docs: `CLERK_CREDITS_INTEGRATION_BUILD_PLAN.md` (auth + spend, already built),
`CLERK_INTEGRATION_DEFERRED_AND_WALLET_NOTES.md`. PH side: `Comic-Pro2/api/stripe-*.js`.

---

## 1. Why this works without us touching Stripe

panel_shaq already shares one Clerk account + one ink balance with PH (PH Postgres is the
source of truth; we call PH's `/api/credits/*` with a Clerk Bearer). **Buying** is the same
shape: we call PH's existing checkout endpoint with the user's Clerk token; PH creates a
Stripe Checkout session; the user pays on Stripe's hosted page; **PH's Stripe webhook grants
the credits to the same `userId`** → the shared balance (and our nav chip) updates. We never
hold `STRIPE_SECRET_KEY`, price IDs, or the webhook secret.

### Verified facts (from `Comic-Pro2/api/`, read 2026-06)

- **`POST /api/stripe-create-checkout`** — Clerk-authed (`requireAuth`). Returns `{ sessionId, url }` (Stripe-hosted Checkout URL). Body:
  - Booster (one-time credit pack): `{ type: "booster", boosterSize: "small" | "medium" | "large" }` → 75 / 150 / 300 credits (`CREDITS_BOOSTER_*`, default).
  - **Founder Pass (one-time, in v1):** `{ type: "one_time_purchase" }` → grants `ONE_TIME_PURCHASE_CREDITS` (default 500) + tier `creator_plus`; price ~$49.99 (`VITE_ONE_TIME_PURCHASE_PRICE`). Formerly "lifetime access," **now branded "Founder Pass."** Only meaningful when PH runs `PAYMENT_MODE=one_time`. **Re-purchase is blocked:** if the user already has `creator_plus`, the endpoint returns `400 { error:"Already purchased", message:"You already have full access. Use booster packs to add more credits." }` — the UI must handle this (show "You already own the Founder Pass" / hide the button).
  - Subscription `{ type:"subscription", tier, billingCycle }` (400/1000 credits) and `brand_purchase` — **out of scope**; keep the PH pricing link for those.
  - Requires PH env `ENABLE_PAYMENTS=true` (already on — PH sells today). All `STRIPE_PRICE_*` IDs live on PH.
- **`success_url` / `cancel_url` are built from `req.headers.origin`** with hardcoded paths: success → `${origin}/success?session_id={CHECKOUT_SESSION_ID}&type=<type>`, cancel → `${origin}/app?checkout_canceled=<type>`. ⟵ we control the host via the Origin header on our server-side call (see §3.3).
- **No CORS allowlist** on `stripe-create-checkout` (unlike `/api/credits/*`). So it **must** be called **server-to-server via our proxy**, never directly from the browser (a direct call CORS-fails, same as the meme-handoff consume).
- **`api/stripe-webhook.js`** grants credits by `session.metadata.userId` via `addCredits(userId, credits, 'booster_purchase'|'one_time_purchase'|…, session.id)`. Idempotent on `(reference_id=session.id)`. **Nothing for us to build here.**
- **`POST /api/stripe-create-portal-session`** — Clerk-authed; returns a Stripe Billing Portal URL (manage/cancel subscription). Optional to proxy.

---

## 2. Architecture

```
[signed-in user taps "Buy 150 credits"]
        │  Clerk getToken()
        ▼
[our frontend]  POST /api/credits-checkout  { type:"booster", boosterSize:"medium" }  (Bearer)
        ▼
[our serverless]  api/credits-checkout.ts
        │  forwards Bearer + body to PH, sets Origin: https://m.panelhaus.app
        │  POST ${PANELHAUS_API_BASE}/api/stripe-create-checkout
        ▼
[PH]  requireAuth → resolves userId → stripe.checkout.sessions.create(...)  → { url }
        ▼
[our frontend]  window.location.href = url      (Stripe-hosted checkout)
        ▼
[Stripe]  user pays  → Stripe fires webhook → PH credits the shared balance (metadata.userId)
        │
        └─ success_url → https://m.panelhaus.app/success?session_id=...&type=booster
                 ▼
        [our app] detects the return → toast "purchase complete" → refetch balance → clean URL
```

- BFF pattern, identical to reserve/refund and handoff-consume.
- Stripe checkout + payment UI = Stripe-hosted (mobile-safe, PCI handled by Stripe/PH).
- Credit granting = PH webhook (already exists). We only **trigger** and **return-handle**.

---

## 3. Implementation

### 3.1 New serverless proxy — `api/credits-checkout.ts`

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Server-to-server proxy to PH's Stripe checkout. PH's endpoint has no CORS, so the
// browser can't call it directly. We forward the Clerk Bearer and set Origin so PH
// builds success/cancel URLs back to OUR origin. No Stripe secrets live here.
const PH_BASE = process.env.PANELHAUS_API_BASE || "https://www.panelhaus.app";
const SELF_ORIGIN = process.env.PUBLIC_APP_ORIGIN || "https://m.panelhaus.app";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const auth = (req.headers["authorization"] as string) || "";
  if (!auth) return res.status(401).json({ error: "Authentication required" });

  try {
    const r = await fetch(`${PH_BASE}/api/stripe-create-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,         // forward the Clerk Bearer
        Origin: SELF_ORIGIN,         // PH uses req.headers.origin for success/cancel URLs
      },
      body: JSON.stringify(req.body || {}),
    });
    // Pass PH's response straight through ({ url } on success, or its error/code).
    return res.status(r.status).json(await r.json().catch(() => ({})));
  } catch {
    return res.status(502).json({ error: "Checkout creation failed" });
  }
}
```

Notes:
- `PUBLIC_APP_ORIGIN` is a new **optional** env (default `https://m.panelhaus.app`); set it to the dev origin (`http://localhost:3000`) when testing locally so the Stripe return comes back to dev.
- (Optional) add a sibling `api/credits-portal.ts` that proxies `POST /api/stripe-create-portal-session` the same way, for "Manage subscription."

### 3.2 Frontend — pack picker + redirect

Add `src/services/checkout.ts` (one generic call covers boosters AND the Founder Pass):

```ts
import { getClerkToken } from "./clerkToken";

export type BoosterSize = "small" | "medium" | "large";
export type CheckoutReq =
  | { type: "booster"; boosterSize: BoosterSize }
  | { type: "one_time_purchase" }; // Founder Pass

export class AlreadyOwnedError extends Error {}

export async function startCheckout(body: CheckoutReq): Promise<void> {
  const token = await getClerkToken();
  if (!token) throw new Error("Please sign in first.");
  const r = await fetch("/api/credits-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 503) throw new Error("Payments are temporarily unavailable.");
  // Founder Pass already owned (PH returns 400 "Already purchased")
  if (r.status === 400 && /already purchased/i.test(d?.error || ""))
    throw new AlreadyOwnedError(d?.message || "You already own the Founder Pass.");
  if (!r.ok || !d?.url) throw new Error(d?.error || "Couldn't start checkout.");
  window.location.href = d.url; // Stripe-hosted checkout
}
```

Add `src/components/BuyCreditsSheet.tsx` — a `BottomSheet` (reuse `src/components/BottomSheet.tsx`)
with the three booster packs **and** a Founder Pass option. Mirror PH's amounts so pricing
matches; keep the dollar prices **display-only** (the real price is Stripe's):

```ts
export const BOOSTER_PACKS = [
  { size: "small",  credits: 75,  label: "75 credits" },
  { size: "medium", credits: 150, label: "150 credits" },
  { size: "large",  credits: 300, label: "300 credits" },
] as const;
// Founder Pass: one-time, ~$49.99, 500 credits + creator_plus tier (lifetime full access).
```

- Booster row → `startCheckout({ type: "booster", boosterSize: size })`.
- Founder Pass row → `startCheckout({ type: "one_time_purchase" })`; on `AlreadyOwnedError`,
  show "You already own the Founder Pass" and disable it. Ideally hide/disable the Founder
  Pass entirely when the user's `tier` (from `/api/credits-balance`) is already `creator_plus`.
- Disable + spinner while awaiting each. Use the frontend-design skill for the visual; match
  the dark/orange theme tokens.

### 3.3 Return handling (success / cancel)

PH returns the user to `…/success?session_id=…&type=…` or `…/app?checkout_canceled=…` on
**our** origin (because of the Origin header). Our SPA serves index.html for any path
(vercel rewrite), so handle it once at startup. In `src/App.tsx` (early effect) or `main.tsx`:

```ts
const p = new URLSearchParams(window.location.search);
if (window.location.pathname === "/success" || p.get("session_id")) {
  // payment done — webhook credits the balance (may lag a few seconds)
  toast("Purchase complete — credits added.");
  refetchBalance();                 // re-GET /api/credits-balance; emitBalance()
  history.replaceState(null, "", "/");
} else if (p.get("checkout_canceled")) {
  toast("Checkout canceled.");
  history.replaceState(null, "", "/");
}
```

- **Webhook lag:** the balance may take a few seconds. Either poll `/api/credits-balance`
  2–3× over ~10s after success, or just show "added" and let the chip refresh.
- Keep this OUT of the `/c/from-meme` branch.

### 3.4 Wire the entry points

- **Settings → Account "Get more ink"** (`AccountSection.tsx`): instead of linking to PH
  pricing, open `BuyCreditsSheet`.
- **Out-of-ink 402** (`apiPost` throws "out of ink"): surface a CTA that opens
  `BuyCreditsSheet` (e.g. via the toast/error bus or a small modal).
- **Nav ink chip** (optional): tapping it opens the sheet.

Keep the PH `/pricing` link as a fallback for subscriptions if we don't build the sub UI.

---

## 4. Scope (decided)

- **v1:** **booster packs** (75/150/300 one-time top-ups) **+ the Founder Pass**
  (`one_time_purchase`, ~$49.99 → 500 credits + `creator_plus` lifetime full access).
  Both go through the same proxy + `BuyCreditsSheet`; the only extra is the
  "already owned" handling for the Founder Pass.
- **Out of scope (use the PH `/pricing` link):** subscriptions (`type:"subscription"`,
  Creator Lite/Plus monthly/yearly) and `brand_purchase`. Can be added later as v2 with a
  `credits-portal` proxy for manage/cancel (existing-sub replacement is already handled PH-side).
- **Dependency:** the Founder Pass requires PH `PAYMENT_MODE=one_time` + `ONE_TIME_PURCHASE_PRICE_ID`
  set. If PH is in subscription mode, hide the Founder Pass row (or it will 500 "price not configured").

---

## 5. Env

- **None new required.** Reuses `PANELHAUS_API_BASE=https://www.panelhaus.app`.
- Optional: `PUBLIC_APP_ORIGIN` (default `https://m.panelhaus.app`) — set to your dev origin
  when testing so the Stripe return lands on dev.
- PH side must have `ENABLE_PAYMENTS=true` (already on) and all `STRIPE_PRICE_*` set (already).

---

## 6. Security / correctness

- No Stripe secrets, price IDs, or webhook secret on our side — all on PH.
- Proxy requires a Clerk Bearer; PH `requireAuth` authorizes and binds the purchase to that
  `userId` (can't buy for someone else).
- Credit granting is PH's idempotent webhook (`reference_id = session.id`) — safe against
  double-fires; we never grant credits ourselves.
- Don't trust client-sent prices/credit amounts — we only send `type`/`boosterSize`; PH maps
  to the real Stripe price.

---

## 7. Verification (Stripe test mode)

1. Ensure PH is in Stripe **test** mode with test price IDs; sign in on `m.panelhaus.app`.
2. Open Buy sheet → pick 150 → redirected to Stripe Checkout.
3. Pay with test card `4242 4242 4242 4242` (any future expiry/CVC).
4. Land back on our origin `…/success?session_id=…` → "purchase complete" toast.
5. Within a few seconds the nav chip + Settings balance increase by 150 (webhook).
6. Cancel flow: start checkout → cancel → land on `…/app?checkout_canceled` → "canceled" toast,
   no charge, balance unchanged.
7. Confirm on PH web (same account) the balance also reflects the purchase.
8. Decline card `4000 0000 0000 0002` → Stripe shows failure, no credit granted.
9. **Founder Pass:** buy `one_time_purchase` with the test card → balance +500 and tier
   becomes `creator_plus` (check the Settings Account panel).
10. **Already-owned:** with `creator_plus`, tap Founder Pass again → proxy returns `400`
    "Already purchased" → UI shows "You already own the Founder Pass," no Stripe redirect.

---

## 8. Files summary

**New:**
- `api/credits-checkout.ts` — proxy → PH `stripe-create-checkout` (sets Origin, forwards Bearer).
- `src/services/checkout.ts` — `startCheckout()` (boosters + Founder Pass) + `AlreadyOwnedError`.
- `src/components/BuyCreditsSheet.tsx` — booster packs + Founder Pass (BottomSheet), with already-owned handling.
- (optional) `api/credits-portal.ts` + a "Manage subscription" button.

**Modified:**
- `src/App.tsx` (or `main.tsx`) — success/cancel return handling.
- `src/components/AccountSection.tsx` — "Get more ink" opens the sheet (not the PH link).
- `apiPost` 402 path / nav chip — open the sheet from the out-of-ink CTA.
- `.env.example` — document optional `PUBLIC_APP_ORIGIN`.
- `documents/CLERK_CREDITS_INTEGRATION_BUILD_PLAN.md` / `CLAUDE.md` — note the buy flow + `credits-checkout` route.
