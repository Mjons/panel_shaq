# panel_shaq — add crypto checkout to the mobile buy sheet

**For:** a fresh session working in `Claude_Projects/panel_shaq` (Panel Haus Mobile).
**Date:** 2026-07-20
**Status of the other side:** Panel Haus (Comic-Pro2) shipped its crypto checkout and it is
**LIVE in production with real money** (changelog `1275`). This repo is the last piece.

> Read §1–§3 before touching code. The single most important thing to internalise: **this
> repo builds NO payment logic.** It forwards a request and re-polls a balance. Everything
> that touches money already exists in Panel Haus.

---

## 1. TL;DR — the four changes

| # | File | Change |
|---|---|---|
| 1 | `api/crypto-create-invoice.ts` (**new**) | Clone of `api/credits-checkout.ts`, pointed at PH's `/api/crypto/create-invoice` |
| 2 | `src/services/checkout.ts` | Add `startCryptoBoosterCheckout(size)` next to the existing `startBoosterCheckout` |
| 3 | `src/services/credits.ts` + `src/components/BuyCreditsSheet.tsx` | Surface PH's `cryptoEnabled` flag (currently **dropped**) and render a Card/Crypto toggle |
| 4 | `src/App.tsx` | Crypto-aware return poll — the current 0/3s/7s schedule is far too short for on-chain settlement |

No new env vars. No webhook. No OxaPay SDK. No prices in this repo.

---

## 2. How the money actually flows (why this repo's part is tiny)

Panel Haus is the single source of truth for credits. panel_shaq has **no ledger** — its
"balance" is a proxied read of PH's. Two payment rails now exist:

```
CARD (already working here)
  BuyCreditsSheet → /api/credits-checkout (this repo, proxy)
                  → PH /api/stripe-create-checkout
                  → Stripe hosted page → Stripe webhook fires AT PH → PH grants credits
                  → user returns to m.panelhaus.app/success?session_id=… → we re-poll balance

CRYPTO (what you're adding)
  BuyCreditsSheet → /api/crypto-create-invoice (this repo, NEW proxy — same shape)
                  → PH /api/crypto/create-invoice
                  → OxaPay hosted page → OxaPay callback fires AT PH → PH grants credits
                  → user returns to m.panelhaus.app/success?crypto=1&type=booster → we re-poll
```

The shapes are deliberately identical. The **only** meaningful differences:

1. **Timing.** Card settles in seconds. Crypto settles **on-chain — routinely 1–3 minutes.**
   This is the one place the existing code is genuinely wrong for crypto (see §6).
2. **Return param.** Crypto returns with `?crypto=1&type=booster` and **no `session_id`**.

### Why PH receives the callback, not us
OxaPay bakes the `callback_url` inside each invoice. PH pins that URL to its own canonical
host (`PH_CANONICAL_BASE`) precisely so that a purchase started from mobile still gets
confirmed at PH. **Do not build a webhook route in this repo** — it would never be called,
and if you somehow pointed OxaPay at m.panelhaus.app the payment would be taken and never
credited. (This exact bug was caught in PH's design review; the pinning is intentional.)

---

## 3. What Panel Haus already guarantees (do not re-implement)

- **Auth + identity.** PH's `requireAuth` resolves the Clerk Bearer you forward to an
  internal `user_id`. The buyer cannot be spoofed from this side.
- **Pricing.** PH fetches the USD amount live from the Stripe price object at invoice time,
  so card and crypto can never disagree. The `PACKS` array in `BuyCreditsSheet.tsx` is
  **display-only** — the existing comment there already says so. Keep it that way.
- **Eligibility guards, rate limiting** (5 invoices/min/user), input validation.
- **Idempotency.** OxaPay retries callbacks; PH's grant is keyed on `oxaph_<track_id>` with a
  DB unique index, so double-crediting is impossible.
- **Credits land in the never-reset booster bucket** and survive subscription renewals.
- **Failure alerting.** A paid-but-unattributable invoice pings Discord (#panelhaus-alerts)
  at PH. Nothing to build here.

---

## 4. The contract you're calling

```
POST {PH_BASE}/api/crypto/create-invoice
Headers: Content-Type: application/json
         Authorization: Bearer <clerk token>   ← forwarded by your proxy
         Origin: https://m.panelhaus.app       ← set by your proxy (see below)
Body:    { "type": "booster", "boosterSize": "small" | "medium" | "large" }

200 → { url, trackId }        redirect the browser to `url` (OxaPay hosted page)
400 → invalid type/size, or "Already purchased" guards
401 → missing/bad auth
429 → rate limited (5/min per user)
500 → OXAPAY_NOT_CONFIGURED / CANONICAL_BASE_MISSING
502 → OXAPAY_API_ERROR (upstream failure — safe to retry later)
503 → OXAPAY_DISABLED (crypto turned off) or PRICE_UNAVAILABLE (Stripe unreachable)
```

**Only `type: "booster"` is relevant here** — panel_shaq sells boosters only. PH also accepts
`one_time_purchase` / `brand_purchase`, and explicitly **rejects `subscription`** (crypto
cannot auto-renew).

**Why `Origin` matters:** PH builds the post-payment `return_url` from the caller's Origin,
validated against an allowlist that includes `https://m.panelhaus.app` and (as of today)
`http://localhost:3002` for local dev. Your existing proxy already sets Origin correctly —
just copy that behavior. A non-allowlisted origin silently returns the user to
`www.panelhaus.app` instead of the mobile app.

---

## 5. The changes, file by file

### 5.1 `api/crypto-create-invoice.ts` (new)

Copy `api/credits-checkout.ts` **verbatim** and change exactly one thing: the upstream path
from `/api/stripe-create-checkout` to `/api/crypto/create-invoice`. Everything else — the
`PH_BASE` www-normalisation, the `Authorization` forward, the `Origin` forward, the
`redirect: "manual"` + `status === 0 → 502` guard, the method/auth checks — must stay
identical. Those aren't stylistic; the www-normalisation exists because the apex domain 307s
and **strips the Authorization header**, which would break auth in a way that looks like a
permissions bug.

### 5.2 `src/services/checkout.ts`

Add a sibling to `startBoosterCheckout` with the same contract and error handling:

```ts
export async function startCryptoBoosterCheckout(boosterSize: BoosterSize): Promise<void> {
  const token = await getClerkToken();
  if (!token) throw new Error("Please sign in first.");

  const r = await fetch("/api/crypto-create-invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ type: "booster", boosterSize }),
  });

  const d = await r.json().catch(() => ({}) as { url?: string; error?: string });
  if (r.status === 503) throw new Error("Crypto payments are temporarily unavailable.");
  if (!r.ok || !d?.url) throw new Error(d?.error || "Couldn't start crypto checkout.");

  try {
    const { track } = await import("./analytics");
    track("checkout_started", { pack: boosterSize, method: "crypto" });
  } catch { /* ignore */ }
  window.location.href = d.url; // OxaPay-hosted checkout
}
```

Consider adding `method: "card"` to the existing card `track()` call so the two rails are
comparable in PostHog.

### 5.3 Surface `cryptoEnabled` — **this is the one non-obvious step**

`api/credits-balance.ts` passes PH's JSON through verbatim, so `cryptoEnabled` and
`cryptoProvider` **already arrive**. But `src/services/credits.ts` → `fetchAccount()` picks
out only `credits` and `tier` and discards the rest, so the flag never reaches the UI.

Extend `fetchAccount`'s return type and the module cache with `cryptoEnabled: boolean`
(default `false`), mirroring how `credits`/`tier` are cached. Then in `BuyCreditsSheet.tsx`
render a Card/Crypto toggle **only when the flag is true**, so a half-configured or
crypto-disabled deploy never shows a dead button. The client must never decide this itself —
no env var, no hardcoded boolean.

Check the other `fetchAccount` consumers (`AccountSection.tsx`, `AccountControls.tsx`) still
compile after the type change — they destructure only what they need, so this should be
additive.

**UI reference (match what PH just shipped, changelog 1275):** a segmented Card/Crypto
control, both options the same size, distinguished by **fill + icon + label** rather than
colour alone; `CreditCard` and `Bitcoin` from lucide-react (already a dependency) — **no
emoji as icons**; `aria-pressed` on the active option; visible focus states. PH's
`src/components/Pricing/BoosterPackModal.jsx` has the exact pattern if you want to mirror it.

### 5.4 `src/App.tsx` — the crypto return poll

Current handler (~line 290) fires `refresh()` immediately, then at **3s and 7s**. That's
tuned for a Stripe webhook and will essentially always miss a crypto payment, leaving the
user staring at an unchanged balance right after paying.

Add a crypto branch keyed on `params.get("crypto") === "1"`:

- Poll on an escalating schedule totalling roughly **3 minutes** — PH uses
  `[3s, 7s, 15s, 30s, 60s, 65s]`.
- **Stop early** the moment the balance actually increases versus the value captured on entry.
- When the budget is exhausted, show an honest terminal message rather than an endless
  spinner — PH's wording: *"Payment received — still confirming on-chain. Your ink will land
  automatically."* It's true: PH will credit whenever the callback arrives, with or without
  the app open.
- Keep the card branch byte-identical. The existing `isSuccess` check
  (`pathname === "/success" || params.has("session_id")`) already catches the crypto return,
  since PH sends the user to `/success?crypto=1&type=booster`.
- Also worth adjusting the success toast: on the crypto path "Purchase complete. Credits
  added." is premature — say it's confirming.

---

## 6. Invariants — things that will silently cost real money if broken

1. **No webhook in this repo.** The callback is pinned to PH by design (§2).
2. **No prices, no credit amounts, no OxaPay keys here.** Display strings only.
3. **Never send `type: "subscription"`** to the crypto endpoint — it's rejected, and the
   rejection is deliberate (crypto has no stored payment method to auto-renew).
4. **Don't "simplify" the proxy's `Origin` forward or the www-normalisation** (§5.1).
5. **Crypto is slow. Don't shorten the poll** to match the card path.

---

## 7. Testing

⚠️ **Sandbox mode is OFF in production — purchases are real money.** Use the smallest pack
($6.99) and expect to actually pay it. Do not re-enable PH's sandbox to test: it's a
production-wide toggle and sandbox invoices mint *real* credits.

**Local (recommended first pass):** run panel_shaq's dev server on **port 3002** — that origin
was just added to PH's return-URL allowlist specifically so mobile can be tested locally. Set
`PANELHAUS_API_BASE=https://www.panelhaus.app` so the proxy talks to live PH. You can verify:
the toggle appears, the invoice is created, and you're redirected to a real OxaPay page.
Completing the payment credits the shared balance for real (real money), and the return lands
back on `localhost:3002/success?crypto=1&type=booster`.

**Checklist:**
- [ ] Toggle renders only when PH reports `cryptoEnabled` (turn `OXAPAY_ENABLED=false` on PH
      briefly to confirm it disappears — no dead button).
- [ ] Crypto buy redirects to an `oxapay.com` page.
- [ ] **Card checkout still works unchanged** (regression — it shares the sheet).
- [ ] After paying, the balance updates on its own within ~3 minutes without a manual refresh.
- [ ] Exhausting the poll shows the honest "still confirming" message, not a stuck spinner.
- [ ] Sign-out state: crypto button behaves like the card one ("Please sign in first").

---

## 8. Reference

**Read on the Panel Haus side (`Claude_Projects/Comic-Pro2`) if you need detail:**
- `documentation/changelog/1275_PH_STOREFRONT_CRYPTO_OXAPAY.md` — the full design, incl. the
  two "paid-never-credited" traps that were designed out and why the callback is pinned.
- `api/crypto/create-invoice.js` — the endpoint you're calling (gates, allowlist, errors).
- `src/components/Pricing/BoosterPackModal.jsx` — the Card/Crypto UI pattern to mirror.
- `src/components/UI/SubscriptionBadge.jsx` — the crypto poll schedule + stalled state.
- `documentation/architecture/CROSS_APP_AUTH_AND_CREDITS.md` — the shared-credit model.

**Conventions in THIS repo:** TypeScript (`.ts`/`.tsx`), Vite PWA packaged as an Android TWA,
Clerk auth shared with PH, deployed at `m.panelhaus.app`. Follow `CLAUDE.md` at the repo root.
Write a changelog entry in this repo's `CHANGELOG.md`/changelog folder per its own convention,
and let Tay run all npm commands and git operations — **do not commit or push without asking.**
