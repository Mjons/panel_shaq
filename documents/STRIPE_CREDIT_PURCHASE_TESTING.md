# Stripe Credit Purchase — How It Works & How To Test (esp. Locally)

How the in-app **Buy Ink** flow works end to end, and **exactly** what you must run
locally to test it. The single most important local fact:

> **Locally, the Stripe CLI MUST be running and forwarding webhooks to the Panel Haus
> (Comic-Pro2) backend.** Without it, checkout "succeeds" on Stripe but your balance
> never increases, because the thing that actually grants credits is PH's webhook, and
> Stripe cannot reach `localhost` on its own.

Companion docs: `CREDIT_PURCHASE_INAPP_PLAN.md` (the build), `LOCAL_DEV_CLERK_CREDITS.md`
(Clerk + shared-credit local setup, ports), `CLERK_CREDITS_INTEGRATION_BUILD_PLAN.md`.

---

## 1. The flow (who does what)

panel_shaq holds **no** Stripe secrets, price IDs, or webhook. It only *triggers*
checkout and *handles the return*. Panel Haus (Comic-Pro2) owns Stripe and grants the
credits. The shared balance lives in PH's Postgres.

```
[user taps a booster in BuyCreditsSheet]
        │  Clerk getToken()
        ▼
panel_shaq  POST /api/credits-checkout  { type:"booster", boosterSize }   (Bearer)
        │   forwards Bearer + sets Origin (our host) server-to-server
        ▼
PH  POST /api/stripe-create-checkout  → requireAuth → stripe.checkout.sessions.create
        │   returns { url }  (Stripe-hosted checkout page)
        ▼
panel_shaq  window.location.href = url
        ▼
[Stripe hosted page]  user pays with a test card
        │
        ├─(A) Stripe fires a WEBHOOK ─────────────► PH /api/stripe-webhook
        │                                            → addCredits(userId, credits,
        │                                              'booster_purchase', session.id)
        │                                            → SHARED BALANCE goes up
        │
        └─(B) Stripe REDIRECTS the browser back ──► our origin
                 success: /success?session_id=…&type=booster
                 cancel:  /app?checkout_canceled=booster
                        ▼
            panel_shaq App.tsx return-handler:
              success → toast + POLL /api/credits-balance (now, +3s, +7s) → emitBalance
                        → nav chip + Settings update → history.replaceState("/")
              cancel  → "canceled" toast → clean URL
```

**Key insight:** (A) and (B) are independent. The redirect (B) is just navigation; the
**money→credits** step is the webhook (A). The poll in (B) only *reads* the balance the
webhook (A) wrote. So if the webhook never arrives, the poll finds the old balance.

---

## 2. Why local testing needs the Stripe CLI

In production, PH has a real webhook endpoint registered in the Stripe Dashboard, so
Stripe POSTs `checkout.session.completed` to `https://www.panelhaus.app/api/stripe-webhook`
automatically. Nothing extra to do.

Locally, your PH backend is at `http://localhost:3001` — **Stripe on the public internet
cannot reach it.** The Stripe CLI bridges that gap: it opens a tunnel from Stripe to your
machine and replays events to a local URL you choose. It also prints a **webhook signing
secret** (`whsec_…`) that PH must use to verify the event signature.

**No CLI running ⇒ no webhook ⇒ `addCredits` never runs ⇒ balance unchanged**, even though
the Stripe page said "payment successful" and you got redirected back with a success toast.
This is the #1 "it doesn't work locally" cause.

---

## 3. Local setup, step by step

### 3.1 Prerequisites
- PH (Comic-Pro2) running locally: backend on **`:3001`** (`./dev.ps1` in Comic-Pro2).
- panel_shaq running on **`:3002`** (`./dev.ps1`), with `PANELHAUS_API_BASE=http://localhost:3001`.
- Both apps on the **same dev Clerk instance** (see `LOCAL_DEV_CLERK_CREDITS.md`).
- A **Stripe account in TEST mode** (PH's Stripe, test-mode keys).
- The **Stripe CLI** installed: https://stripe.com/docs/stripe-cli (`stripe login` once).

### 3.2 Comic-Pro2 (PH) `.env.local` — the Stripe bits
PH is where Stripe lives, so these go in **Comic-Pro2**, not panel_shaq:
```
ENABLE_PAYMENTS=true
STRIPE_SECRET_KEY=sk_test_…                 # PH's Stripe TEST secret key
STRIPE_WEBHOOK_SECRET=whsec_…               # from `stripe listen` (step 3.3) — paste it here
STRIPE_PRICE_BOOSTER_SMALL=price_…          # test-mode price IDs for the 3 boosters
STRIPE_PRICE_BOOSTER_MEDIUM=price_…
STRIPE_PRICE_BOOSTER_LARGE=price_…
# plus the usual: POSTGRES_URL, CLERK keys (dev), GEMINI_API_KEY, FREE_TIER_CREDIT_AMOUNT
```
Restart PH after editing.

### 3.3 Run the Stripe CLI (the part people forget)
In a **separate terminal**, forward Stripe events to PH's local webhook route:
```
stripe listen --forward-to http://localhost:3001/api/stripe-webhook
```
- It prints: `Ready! Your webhook signing secret is whsec_xxx`. **Copy that `whsec_…`**
  into `Comic-Pro2/.env.local` as `STRIPE_WEBHOOK_SECRET`, then restart PH so it picks it
  up. (The secret is stable per `stripe listen` session; if you restart the CLI and it
  prints a new one, update the env again.)
- **Leave this terminal running** the whole time you test. Every successful test payment
  shows up here as `checkout.session.completed → [200]` once PH accepts it.

### 3.4 panel_shaq `.env.local` — Stripe needs nothing new
panel_shaq holds no Stripe config. The only optional var is the return host:
```
PUBLIC_APP_ORIGIN=http://localhost:3002      # optional — see below
```
You can usually **omit it**: the proxy uses the incoming browser Origin first, which is
already `http://localhost:3002` when you're testing there. Set it only to force a specific
return host. (Default if unset and no Origin header: `https://m.panelhaus.app`.)

---

## 4. Run a test purchase

1. Three terminals up: **PH backend (3001)**, **panel_shaq (3002)**, **`stripe listen`**.
2. Open `http://localhost:3002`, sign in (dev Clerk instance), note the ink chip value.
3. Settings → **Get more ink** (or tap the ⚡ chip, or trigger an out-of-ink generation).
4. Pick a pack → you're redirected to Stripe's hosted checkout.
5. Pay with a **test card**: `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
6. Stripe redirects you back to `localhost:3002/success?session_id=…` → "Purchase complete"
   toast; the URL cleans to `/`.
7. Watch the **`stripe listen` terminal**: you should see
   `checkout.session.completed … [200]`. That `[200]` means PH granted the credits.
8. Within ~10s the ink chip + Settings balance rise by the pack's credits (the poll picks
   up the webhook's write). If it doesn't, see §6.

**Test cards** (Stripe test mode):
- Success: `4242 4242 4242 4242`
- Generic decline: `4000 0000 0000 0002` → no credits granted, no webhook success.
- Auth-required (3DS): `4000 0027 6000 3184`.

---

## 5. What "come back to where I am" actually means

The Stripe redirect is a **full page navigation away and back**, so the SPA reboots. You
do **not** lose work: panel_shaq persists story, panels, vault, and the active tab in
localStorage/IndexedDB and autosaves the working project, so after the reload you land on
the **same tab** with your project intact. The URL is reset to `/` (we strip the
`session_id`/`checkout_canceled` params). The only thing not preserved is transient
in-memory UI state that was never persisted.

---

## 6. Troubleshooting (local)

| Symptom | Cause / Fix |
|---|---|
| Paid on Stripe, success toast, **balance unchanged** | `stripe listen` not running, or `STRIPE_WEBHOOK_SECRET` in PH `.env.local` doesn't match the CLI's printed secret. Start the CLI, copy the `whsec_…`, restart PH, retry. |
| `stripe listen` shows the event but **`[400]`/`[500]`** | Signature mismatch (wrong `STRIPE_WEBHOOK_SECRET`) or PH webhook error. Fix the secret / read PH logs. |
| "Couldn't start checkout" before any redirect | PH returned non-200 from `stripe-create-checkout`. Common: `ENABLE_PAYMENTS` not `true`, or a `STRIPE_PRICE_BOOSTER_*` not set (PH returns `500 "Price ID not configured…"`). |
| "Payments are temporarily unavailable." | PH `503` — `ENABLE_PAYMENTS` is off. |
| `401` from `/api/credits-checkout` | Not signed in / token's `azp` (your port `3002`) not in PH `AUTHORIZED_PARTIES`, or the two apps are on different Clerk instances. |
| `/api/credits-checkout` **502** "Upstream redirect" | `PANELHAUS_API_BASE` points at the apex; use the non-redirecting origin (locally `http://localhost:3001`). |
| Redirect goes to the wrong host after paying | `Origin` resolution: set `PUBLIC_APP_ORIGIN=http://localhost:3002`. |
| Balance updates in DB but not in the UI | The poll runs 3 times over ~10s; if the webhook is slower, reopen Settings or refresh. Confirm with the DB query below. |

**Confirm the grant in Postgres** (PH DB):
```sql
SELECT type, amount, reference_id, created_at
FROM credit_transactions
WHERE user_id = '<your user_id>'
ORDER BY created_at DESC LIMIT 5;
```
A successful purchase inserts a `booster_purchase` row with `reference_id = <stripe session id>`.
The webhook is **idempotent** on that `reference_id`, so replaying the same event won't
double-grant.

---

## 7. Production (for contrast)
- PH has a real webhook endpoint registered in the Stripe Dashboard → no CLI needed.
- panel_shaq needs **no** Stripe env; `PANELHAUS_API_BASE=https://www.panelhaus.app` and
  the browser Origin (`https://m.panelhaus.app`) drive the return automatically.
- Switch PH to Stripe **live** keys + live price IDs; everything else is identical.

---

## 8. One-line summary
Local testing = **PH backend (3001) + panel_shaq (3002) + `stripe listen --forward-to
http://localhost:3001/api/stripe-webhook` running, with that CLI's `whsec_…` set as
`STRIPE_WEBHOOK_SECRET` in Comic-Pro2.** Miss the CLI and credits never land locally.
