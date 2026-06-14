# Production Launch Checklist — Shared Clerk Auth, Shared Ink, In-App Purchase

Everything required to take the `clerk` branch live on `m.panelhaus.app` beyond `git push`.
"PH" = Panel Haus (`panelhaus.app`, the `Comic-Pro2` repo) — the upstream that owns the
shared user pool, the ink balance (Postgres), and Stripe.

Companion docs: `CLERK_CREDITS_INTEGRATION_BUILD_PLAN.md`, `CREDIT_PURCHASE_INAPP_PLAN.md`,
`STRIPE_CREDIT_PURCHASE_TESTING.md`, `CLERK_INTEGRATION_DEFERRED_AND_WALLET_NOTES.md`.

---

## 0. TL;DR

Generation, shared balance, and booster purchases all work in prod once the **prod Clerk
keys + env vars** are set on the panel_shaq Vercel project and **DNS** points at it. Two
items need a change on the **PH deployment** (admin no-deduct, referral forwarding). Wallet
login works only inside a wallet's in-app browser until WalletConnect-via-Clerk is added;
email + Google cover everyone else.

---

## 1. panel_shaq Vercel project — environment variables

> `VITE_`-prefixed vars are baked into the bundle **at build time**, so they must be set
> **before** the deploy build runs. Changing them later requires a rebuild/redeploy.

| Var | Value | Notes |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_…` | **Same production Clerk instance as PH** (shared user pool). Build-time. |
| `CLERK_SECRET_KEY` | `sk_live_…` | Same instance. Server-side; verifies the Bearer. |
| `PANELHAUS_API_BASE` | `https://www.panelhaus.app` | Must be the **non-redirecting `www`** origin (apex 307s to www and strips `Authorization`). |
| `GEMINI_API_KEY` | (the shared key) | Used for signed-in (shared-ink) generation + BYOK fallback. |
| `INK_COST_TEXT` | `1` (optional) | Charge per text/vision call. |
| `INK_COST_IMAGE_FLASH` / `INK_COST_IMAGE_PRO` | `1` / `2` (optional) | Charge per image by selected model. |
| `GEMINI_IMAGE_MODEL_FLASH` / `GEMINI_IMAGE_MODEL_PRO` | (optional) | Gemini model per tier. |
| `PUBLIC_APP_ORIGIN` | `https://m.panelhaus.app` (optional) | Stripe-return host fallback; the incoming browser Origin is used first, so this is rarely needed. |

**No Stripe secrets, price IDs, or webhook secret on our side** — all of that lives on PH.

---

## 2. Clerk dashboard (production instance)

- [ ] panel_shaq uses the **same production Clerk instance** as PH (same `pk_live`/`sk_live`),
      so accounts + sessions are shared across `*.panelhaus.app`.
- [ ] Subdomains are allowed automatically: per Clerk's docs, sessions "automatically work across
      all associated subdomains" of the verified primary domain, so **`m.panelhaus.app` needs no
      extra config by default**. ONLY if the optional **Allowed Subdomains** allowlist (Dashboard →
      Allowed Subdomains → "Enable allowed subdomains") is turned ON do you need to add
      `m.panelhaus.app` there. With it off (default) all subdomains have wildcard access.
      (Separate from the backend `authorizedParties` list used by `verifyToken`, which already
      includes `m.panelhaus.app` in code.)
- [ ] Sign-in methods **Email + Google + MetaMask** enabled (instance-level, already shared).
- [ ] **Bot protection stays ON** in production (it's only turned OFF on the *dev* instance
      to avoid the wallet/email CAPTCHA loop — never disable it in prod).

---

## 3. Upstream (PH) deployment — must be in place

These are PH-side; verify them on the deployed `www.panelhaus.app` before launch.

- [ ] **Admin no-deduct:** the `reserve` endpoint's admin-bypass (admin user + the
      `AI_ADMIN_RATE_LIMIT_BYPASS` toggle) must be **deployed**. Until then, **admins are
      charged ink in prod** (normal users are unaffected). This is the one functional gap.
- [ ] **Authorized parties:** PH's Clerk verification allowlist includes
      `https://m.panelhaus.app` (so our Bearer tokens verify).
- [ ] **Payments live:** `ENABLE_PAYMENTS=true`, live Stripe **booster price IDs**
      (`STRIPE_PRICE_BOOSTER_SMALL/MEDIUM/LARGE`), live `STRIPE_SECRET_KEY`, and the
      registered Stripe **webhook** → `…/api/stripe-webhook`. (All already used by PH's own
      site, so this is typically already true — just confirm live mode.)

> Stripe note: the local **Stripe CLI** is only for local testing. In production the
> registered webhook grants credits automatically; nothing to run.

---

## 4. Infra / DNS

- [ ] `m.panelhaus.app` DNS → this Vercel project.
- [ ] Deploy the `clerk` branch (merge to the production branch or set it as the prod branch).
- [ ] `npm run lint` is clean (the only check); Vercel builds with `vite build`.

---

## 5. Post-deploy smoke test (prod)

1. Open `https://m.panelhaus.app` → sign in (Email or Google) → avatar + ink chip appear.
2. Generate panels / an image → ink balance drops by the shown cost; same balance visible on
   `panelhaus.app` (shared account).
3. Settings → **Get more ink** → buy a booster with a real card (or a Stripe test card if PH
   is still in test mode) → land back on `…/success` → "Purchase complete" toast → balance
   rises within ~10s.
4. Drain to near-zero → trigger a generation → **out-of-ink** opens the Buy sheet instantly
   with the "You're out of ink" banner (no error toast).
5. BYOK: paste a personal Gemini key in Settings → generation works with **no** deduction
   (badge shows "Free").
6. `/c/from-meme` meme flow still works with **no** auth prompts.

---

## 6. Known gaps / deferred (track separately)

### 6a. Referral forwarding — NOT wired (mobile signups currently lose referral credit)
PH captures `?ref=CODE` in its own `localStorage`, which is **origin-scoped** —
`m.panelhaus.app` can't read `panelhaus.app`'s copy. So referral credit is lost on mobile
signup today. To fix (two small parts):
1. **Upstream:** the redirect that sends mobile users to `m.panelhaus.app` must append the
   pending `?ref=` (and `?comic=`) to the URL.
2. **panel_shaq:** read `?ref=` on load, store it, and after Clerk signup call PH's
   `POST /api/referral/link-pending` (Clerk-authed, idempotent — same endpoint PH's web uses).

Do this before any launch that relies on referrals.

### 6b. Wallet login in a plain mobile browser — partial
- **In a wallet's in-app browser** (injected `window.ethereum`): Clerk's MetaMask button
  works → Clerk `web3:<wallet>` session → **shared account + balance.** ✅ Verify
  empirically in the wallet browser once prod keys are live.
- **Plain mobile browser** (Safari/Chrome): no injected provider → the MetaMask button does
  nothing. ❌ Needs **WalletConnect**, wired **through Clerk's web3 strategy** (deferred) so
  identity stays unified.
- **Covers everyone now:** Email + Google work in any mobile browser with the same shared
  account/balance. A wallet-only user on a plain browser should use the wallet's in-app
  browser once, or add an email/Google to their account once.
- ⚠️ Never add a custom wagmi/SIWE wallet stack for auth — a SIWE session is not a Clerk
  session, so PH's credit API wouldn't recognize it and those users would get a **separate
  account with no shared balance.** Wallet must always flow through Clerk.

---

## 7. Rollback / safety

- The whole integration is **gated on `VITE_CLERK_PUBLISHABLE_KEY`**. If it's unset at build
  time, the app reverts to the legacy anon/BYOK path (no auth, no shared credits) — a clean
  kill-switch if anything goes wrong with the shared-account path.
- BYOK always works regardless (users with their own Gemini key bypass Clerk + credits).
