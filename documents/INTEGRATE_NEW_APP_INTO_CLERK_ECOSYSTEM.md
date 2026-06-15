# Playbook: Integrate a New App into the Shared Panel Haus Clerk Ecosystem

A step-by-step, reusable guide for plugging **another** app (a new Panel Haus property, a
sister product, etc.) into the **same Clerk account + shared ink-credit balance** that Panel
Haus (`panelhaus.app`) and Panel Haus Mobile (`m.panelhaus.app`) already share. It distills
everything learned building the panel_shaq integration so the next one is mechanical.

Reference implementation to copy from: this repo (panel_shaq). Deep dives:
`CLERK_AUTH_AND_WALLET_ARCHITECTURE.md` (auth + wallet), `CLERK_CREDITS_INTEGRATION_BUILD_PLAN.md`
(credits), `REFERRAL_INTEGRATION.md`, `CREDIT_PURCHASE_INAPP_PLAN.md` (buy ink),
`LOCAL_DEV_CLERK_CREDITS.md` (local gotchas).

---

## 0. The one mental model (internalize this first)

```
SAME Clerk instance (same pk_live / sk_live on every app)
   → SAME Clerk user
   → SAME Panel Haus user_id ("email:<email>" or "web3:<wallet>")
   → SAME user_credits row (one shared ink balance)
```

Everything else follows from this. The new app **mints** Clerk tokens (frontend) and **sends**
them to Panel Haus's credit API (which **verifies** them). For PH to accept a token it must be:
1. minted by the **same Clerk instance** PH uses, and
2. carry an **authorized party (`azp`)** that PH's backend allowlists (your origin).

Get those two right and the shared account/balance "just works." Get either wrong and you get
`401`s with a working-looking sign-in. PH (Postgres) is always the single source of truth for
credits; your app never stores balances or grants credits itself.

---

## 1. Prerequisites (obtain once from the PH owner)

| Value | Used where | Notes |
|---|---|---|
| `pk_live_…` (publishable) | new app frontend | The **same** Clerk instance as PH. Public-safe. |
| `sk_live_…` (secret) | new app backend | Same instance; backend `verifyToken`. Server-only. |
| PH credit API origin | new app backend | `https://www.panelhaus.app` (the non-redirecting `www`). |
| Per-action ink costs | new app backend | Your own env (PH deducts whatever amount you send). |

For **local dev** use the **Development** instance keys (`pk_test`/`sk_test`) on every app
(prod `pk_live` is domain-locked and 400s on localhost). See `LOCAL_DEV_CLERK_CREDITS.md`.

---

## 2. Frontend wiring (mirror panel_shaq)

1. `npm i @clerk/clerk-react` (frontend) and `@clerk/backend` (for your serverless routes).
2. Wrap the app in `<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} appearance={…}>`,
   **gated on the key being set** so the app degrades gracefully when it's absent. Copy
   `src/main.tsx`.
3. Add a **token holder + gate bridge** so non-React code can mint tokens and open sign-in:
   copy `src/services/clerkToken.ts` (`getClerkToken`, `isClerkSignedIn`, `openClerkSignIn`,
   `isClerkEnabled`) and `src/services/ClerkTokenBridge.tsx` (registers Clerk's `getToken` +
   `clerk.openSignIn()` on mount). Mount the bridge inside `<ClerkProvider>`.
4. **Soft gate** at the action that costs credits: if not BYOK and `isClerkEnabled()` and
   `!isClerkSignedIn()` → `openClerkSignIn()` and abort; otherwise attach
   `Authorization: Bearer <getClerkToken()>` to the API call. Copy the `apiPost` block in
   `src/services/geminiService.ts`.
5. Sign-in UI: use Clerk's prebuilt modal (`<SignInButton mode="modal">` / `openClerkSignIn()`).
   Don't rebuild email/Google.

---

## 3. Backend wiring (per-route, self-contained)

Each serverless route is independent (platforms can't share local files), so **inline** these
helpers per route (do not DRY into a shared import). Copy from `api/generate-image.ts` /
`api/credits-balance.ts`:

```ts
import { verifyToken } from "@clerk/backend";

const AUTHORIZED_PARTIES = [
  "https://YOUR-NEW-APP-ORIGIN",        // <-- the new app's prod origin (the token's azp)
  "http://localhost:3000", "http://localhost:5173", /* your dev ports */
];

// Non-redirecting origin: the apex 307s to www and STRIPS Authorization on the hop.
const PH_BASE = (process.env.PANELHAUS_API_BASE || "https://www.panelhaus.app")
  .trim().replace("://panelhaus.app", "://www.panelhaus.app").replace(/\/+$/, "");

async function verifyClerkBearer(token: string) {
  if (!token || !process.env.CLERK_SECRET_KEY) return false;
  try {
    const c = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: AUTHORIZED_PARTIES,
    });
    return !!c?.sub;
  } catch { return false; }
}
// reserveInk(bearer, amount, action, idempotencyKey) -> POST `${PH_BASE}/api/credits/reserve`
// refundInk(bearer, amount, idempotencyKey, reason)   -> POST `${PH_BASE}/api/credits/refund`
// (use redirect:"manual"; treat status 0 as a misconfig -> 502)
```

Per credit-charging route: verify the Bearer → reserve ink before the work → refund on failure.
BYOK (`x-api-key`) bypasses; admins bypass deduction PH-side; with no `CLERK_SECRET_KEY` fall
back to your legacy/anon path. Read path: copy `api/credits-balance.ts` to show the balance.

---

## 4. The PH-side change you MUST coordinate (one line)

PH verifies tokens with **its own** `authorizedParties` allowlist. **Your new app's origin must
be added there**, or PH returns `401` for every call from your app even though sign-in works.

- File: `Comic-Pro2/api/lib/clerk.js` → add `"https://YOUR-NEW-APP-ORIGIN"` (and dev ports) to
  the `AUTHORIZED_PARTIES` array.
- This is the **only** required change in the PH repo for auth. Hand it to whoever deploys PH.
- (Credits/referral/Stripe endpoints already exist PH-side; nothing else to build there.)

---

## 5. Clerk dashboard

- Use the **same application/instance** as PH (same keys). Do **not** create a new Clerk app.
- **Subdomain of `panelhaus.app`** (e.g. `x.panelhaus.app`): sessions are shared automatically;
  nothing to configure unless the optional "Allowed Subdomains" allowlist is ON (then add yours).
- **Different root domain**: configure it as a **satellite domain** in Clerk (and set
  `allowedRedirectOrigins` on the primary). Subdomains don't need this; different roots do.
- Sign-in methods (Email/Google/MetaMask) are **instance-level** (shared). You can't toggle them
  per app in the dashboard; adjust per-app via `appearance` only (see §7).
- Keep **bot protection ON** in prod; turn it OFF only on the **dev** instance if the web3
  sign-up CAPTCHA loops locally.

---

## 6. Optional modules (copy the pattern only if you want them)

- **Buying ink (Stripe):** proxy PH's `stripe-create-checkout` server-to-server, forwarding the
  Bearer + setting `Origin` so Stripe returns to your host. Copy `api/credits-checkout.ts` +
  `src/services/checkout.ts` + `BuyCreditsSheet`. No Stripe secrets on your side. See
  `CREDIT_PURCHASE_INAPP_PLAN.md` + `STRIPE_CREDIT_PURCHASE_TESTING.md`.
- **Referral:** capture `?ref=PH-XXXXXX` on load, link after sign-in via a proxy to PH's
  idempotent `referral/link-pending`; show the user's own code via `referral/code`. Copy
  `src/services/referral.ts` + `ReferralLinker` + `api/referral-*.ts`. See `REFERRAL_INTEGRATION.md`.
- **Wallet (MetaMask via Clerk):** show Clerk's native MetaMask only when `window.ethereum`
  exists (conditional `appearance`), and add an "Open in MetaMask" deep-link for plain mobile
  browsers. Copy `src/clerkAppearance.ts` (conditional hide), `src/services/wallet.ts`,
  `src/components/WalletDeepLinkButton.tsx`, and the `?signin=wallet` return handler in
  `src/App.tsx`. NEVER use wagmi/SIWE for auth (separate identity, breaks the shared balance).
  See `CLERK_AUTH_AND_WALLET_ARCHITECTURE.md`.

---

## 7. Per-app appearance (without affecting other apps)

`appearance` on **your** `<ClerkProvider>` is yours alone; it never touches other apps. Use it
to theme the modal and to conditionally show/hide a provider button, e.g. hide MetaMask when no
`window.ethereum`:
```ts
socialButtonsBlockButton__metamask: { display: "none" },
socialButtonsIconButton__metamask: { display: "none" },
```
(Inline style objects override the global appearance's class strings reliably.) To insert custom
content you cannot use the prebuilt modal (it's closed); build a headless form with Clerk Elements
instead, but that's rarely worth it.

---

## 8. Env vars (new app)

| Var | Scope | Value |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` (or your framework's prefix) | frontend, build-time | PH's `pk_live_…` |
| `CLERK_SECRET_KEY` | server | PH's `sk_live_…` |
| `PANELHAUS_API_BASE` | server | `https://www.panelhaus.app` (www, no trailing slash) |
| `INK_COST_*` | server | your per-action costs (PH deducts what you send) |
| `GEMINI_API_KEY` (if you call Gemini) | server | shared or your own |

`VITE_`-style keys bake at **build time** → set before building and **redeploy** after changes.

---

## 9. Gotchas (every one of these bit us)

| Symptom | Cause / fix |
|---|---|
| `401` from PH while "signed in" | Different Clerk instance than PH, **or** your origin not in PH's `authorizedParties` (§4). |
| `clerk.<domain>/v1/environment` 400 on localhost | Using `pk_live` on localhost. Use dev `pk_test`. |
| Balance call returns `308 {}` / stuck | `PANELHAUS_API_BASE` had a trailing slash / apex / whitespace → redirect strips `Authorization`. Normalize to `www`, trim, strip trailing slash (§3). |
| MetaMask CAPTCHA loops (dev) | Turn OFF bot protection on the **dev** Clerk instance only. |
| Env changed but behavior didn't | `VITE_` keys bake at build; redeploy. Server env applies on next deploy too. |
| Wallet button does nothing in a plain mobile browser | No `window.ethereum`; that's expected. Use the deep-link (§6). |

---

## 10. Verification (end to end)
1. Type-check / build.
2. Sign in on the new app → the SAME account shows on `panelhaus.app`.
3. Do a credit-charging action → ink drops on PH and on the new app's balance chip.
4. Out-of-credits → reserve `402` surfaces cleanly; force a failure → refund restores ink.
5. (If wallet) native MetaMask appears with a provider; deep-link works on plain mobile.
6. (If referral) `?ref=` links the referrer after sign-up.
7. BYOK (if supported) bypasses auth + credits.

---

## 11. Hard rules
- One Clerk instance, shared keys; auth ALWAYS through Clerk (never a separate wallet/SIWE session).
- Add your origin to PH's `authorizedParties` (the only required PH change for auth).
- Always hit the `www` PH origin; never the apex.
- Keep API routes self-contained (inline helpers; don't DRY across routes).
- Your app never stores or grants credits; PH is the source of truth.
- Per-app differences go in your own `appearance` only; never edit other apps or shared embeds.
