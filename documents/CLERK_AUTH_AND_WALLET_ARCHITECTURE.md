# Clerk Auth + Wallet Architecture (Panel Haus Mobile)

The authoritative reference for how `m.panelhaus.app` (panel_shaq) authenticates users
and connects wallets, all through **one shared Clerk instance** with Panel Haus
(`panelhaus.app`) so the account and ink-credit balance are unified.

This consolidates the auth/wallet picture. Companion docs:
`CLERK_CREDITS_INTEGRATION_BUILD_PLAN.md` (credit wiring), `CLERK_INTEGRATION_DEFERRED_AND_WALLET_NOTES.md`
(design rationale / what was deferred), `LOCAL_DEV_CLERK_CREDITS.md` (local setup + gotchas),
`PRODUCTION_LAUNCH_CHECKLIST.md`, `REFERRAL_INTEGRATION.md`, `STRIPE_CREDIT_PURCHASE_TESTING.md`.

---

## 1. Goal

One Clerk account + one ink balance across both apps. Sign up on mobile = same user on
desktop; AI generation on mobile spends the same shared balance. Auth is **always Clerk**
(email, Google, or web3/MetaMask) so every path resolves to the same Panel Haus `user_id`
(`email:<email>` or `web3:<wallet>`). A non-Clerk wallet stack (wagmi/SIWE) is deliberately
**not** used, because a SIWE session is not a Clerk session and would create a separate
identity with no shared balance.

The whole integration is **gated on `VITE_CLERK_PUBLISHABLE_KEY`**: unset → the app runs the
legacy anonymous/BYOK path exactly as before (graceful degradation, kill-switch).

---

## 2. The wallet solution (progressive enhancement by environment)

The core insight: **Clerk's web3 sign-in needs an injected `window.ethereum` provider.** That
provider exists in a desktop extension and inside a wallet app's in-app browser, but **not** in
a normal mobile browser. So we adapt the offered methods to the environment instead of showing
a button that can't work:

| Environment | `window.ethereum`? | Methods offered | How wallet is reached |
|---|---|---|---|
| Desktop browser, **no** extension | no | Email + Google | (no wallet path; install extension or use email/Google) |
| Desktop browser, **with** MetaMask extension | yes | Email + Google **+ MetaMask** | Clerk's **native MetaMask button inside the sign-in modal** |
| **MetaMask app's in-app browser** (mobile) | yes | Email + Google **+ MetaMask** | Clerk's **native MetaMask button inside the modal** |
| **Plain mobile browser** (Safari/Chrome), MetaMask app installed | no | Email + Google **+ "Open in MetaMask"** | a **deep-link** that reopens the site inside MetaMask's in-app browser, where the native button then appears |

So: **no provider → Email/Google only** (no dead-end MetaMask button); **provider present →
native MetaMask added in the Clerk modal**; **plain mobile with the app → custom deep-link** to
bounce into the in-app browser where the native flow works. Every successful path is a Clerk
session, so the shared account/balance always holds.

### Why this is the right design
- **Progressive enhancement, no dead ends.** A wallet button only appears where it can actually
  work. Plain-mobile users get the one action that helps (open the app), not a button that no-ops.
- **Single identity.** Wallet auth flows through Clerk's web3 strategy, so a wallet user is the
  same Clerk user / PH `user_id` on both apps with one balance. No fragmented "wallet account vs
  email account," no double free-credit grants, no "where's my balance" support load.
- **Minimal custom surface.** We reuse Clerk's prebuilt modal + native MetaMask button for the
  connect/sign step (it handles the signature, CAPTCHA, sign-in-or-up). The only custom code is a
  pure-navigation deep-link for the one case Clerk can't cover. Less to maintain, fewer bugs.
- **Shared instance respected.** Sign-in methods are configured once at the shared Clerk dashboard
  (instance-level); we don't (and can't) toggle them per app there, and we never edit the other
  apps. panel_shaq only adjusts its **own** appearance.

### What we explicitly did NOT do (and why)
- **No wagmi / RainbowKit / WalletConnect / SIWE** (MemeGen's stack). That authenticates on its
  own backend → a non-Clerk session → separate identity → breaks the shared balance. We borrowed
  only MemeGen's *deep-link UX* (`metamask.app.link/dapp/...`), not its auth.
- **No custom button inside Clerk's modal.** Clerk's prebuilt `<SignIn/>`/modal is closed: the
  only customization is `appearance` (CSS) or a fully headless rebuild. You cannot inject a custom
  React button into it, and you cannot override the native MetaMask button's connect logic
  (its only hook, `authenticateWithMetamask`'s `customNavigate`, controls post-auth navigation,
  not the wallet connection). Verified against Clerk docs.
- **No custom email/Google flow.** We use Clerk's prebuilt modal for those (robust OAuth + OTP +
  CAPTCHA for free).

---

## 3. Frontend architecture

- **`src/main.tsx`** wraps the app branch in `<ClerkProvider publishableKey={…} appearance={clerkAppearance}>`
  only when the key is set (meme receiver `/c/from-meme` stays Clerk-free). Mounts
  `<ClerkTokenBridge/>` and `<ReferralLinker/>` as invisible helpers.
- **`src/services/clerkToken.ts`** is a module-level holder so non-React code (`apiPost`) can reach
  Clerk: `getClerkToken()` (fresh per-request token), `isClerkSignedIn()`, `openClerkSignIn()`,
  `isClerkEnabled()`. **`src/services/ClerkTokenBridge.tsx`** registers Clerk's `getToken` and the
  gate (`{ isSignedIn, openSignIn: () => clerk.openSignIn() }`) on mount.
- **Sign-in surfaces** (Clerk's native modal via `<SignInButton mode="modal">` / `openClerkSignIn()`):
  - `src/components/AccountControls.tsx`: top-nav: signed-out shows the compact wallet deep-link
    button (when applicable) + "Sign in"; signed-in shows the ink chip + custom account menu.
  - `src/components/AccountSection.tsx`: Settings → Account: full-text "Sign in" + wallet button,
    plus balance/tier, referral card, buy-ink.
  - **Generation soft-gate**: `src/services/geminiService.ts` `apiPost` opens the modal
    (`openClerkSignIn()`) when a non-BYOK, signed-out user triggers a generation.
- **MetaMask visibility** is controlled in **`src/clerkAppearance.ts`**: it reads `window.ethereum`
  once at load and **hides** the native MetaMask button (`socialButtonsBlockButton__metamask` /
  `socialButtonsIconButton__metamask` → `display:none`) when there's **no** provider, and **shows**
  it when there is. This appearance is panel_shaq-only; panelhaus always shows MetaMask.
- **Deep-link path** for plain mobile:
  - `src/services/wallet.ts`: `hasInjectedProvider()` (`!!window.ethereum`), `isMobileBrowser()`
    (UA regex), `shouldDeepLinkToWallet()` (mobile && no provider && https && not localhost),
    `metaMaskDappLink()` → `https://metamask.app.link/dapp/${host}${path}?signin=wallet`.
  - `src/components/WalletDeepLinkButton.tsx`: renders **only** when `shouldDeepLinkToWallet()`.
    `compact` variant = icon-only pill for the nav; default = full-text button for Settings.
  - `src/App.tsx`: on the `?signin=wallet` return (now inside MetaMask's browser, provider
    present), auto-opens the Clerk sign-in modal and strips the param.

> Note: `shouldDeepLinkToWallet()` is false on **localhost** and on **http**, so the deep-link
> button never shows in local dev. Test it on the deployed https origin on a real phone.

---

## 4. Backend architecture (per-route, self-contained)

Each `api/*.ts` route is an independent Vercel function (Vercel can't share local files), so the
auth + credit gate is **inlined per route** (do not DRY into a shared import):

- **`verifyClerkBearer(token)`** uses `@clerk/backend` `verifyToken({ secretKey: CLERK_SECRET_KEY,
  authorizedParties: AUTHORIZED_PARTIES })`. `AUTHORIZED_PARTIES` includes `https://m.panelhaus.app`
  (the token's `azp`) plus localhost dev ports. A token minted by a *different* Clerk instance, or
  carrying an unlisted `azp`, fails verification → 401.
- **Metering** (when Clerk is configured): every AI route **reserves ink** at
  `${PANELHAUS_API_BASE}/api/credits/reserve` before calling Gemini and **refunds** on failure.
  Image routes cost `INK_COST_IMAGE_FLASH`/`_PRO` by the selected model; text/vision routes cost
  `INK_COST_TEXT`. `PANELHAUS_API_BASE` is normalized (apex→www, trimmed, trailing slashes stripped)
  to avoid the cross-origin redirect that strips `Authorization`.
- **BYOK** (`x-api-key`) bypasses Clerk + credits entirely (user pays Google). **Admins** bypass
  deduction PH-side. **Legacy** (no `CLERK_SECRET_KEY`) falls back to the anonymous daily limiter.
- Read path: `api/credits-balance.ts` proxies the balance for the nav chip + Settings.

`apiPost` (`geminiService.ts`) attaches `Authorization: Bearer <clerk token>` for signed-in
non-BYOK calls, soft-gates signed-out users (opens the modal), runs an instant out-of-ink
pre-check against the cached balance, and surfaces 402 as the in-app buy sheet.

---

## 5. Identity & sharing

```
Clerk user (email or web3 wallet)
   → Panel Haus user_id ("email:<email>" or "web3:<wallet>")
   → user_credits (the one shared ink balance)
```

PH's credit API authorizes every call with a Clerk token (`requireAuth` → `verifyToken`). Because
panel_shaq mints tokens from the **same** Clerk instance, PH resolves them to the same user. This
is the entire reason wallet auth must stay inside Clerk: a wallet signed in via Clerk becomes
`web3:<wallet>`, the same identity PH already creates for desktop wallet users.

---

## 6. Environment variables (panel_shaq)

| Var | Where | Notes |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | frontend (build-time) | `pk_live_…`, **same Clerk instance as PH**. Unset → legacy/no-auth. |
| `CLERK_SECRET_KEY` | server | `sk_live_…`, same instance; route `verifyToken`. Unset → legacy limiter. |
| `PANELHAUS_API_BASE` | server | `https://www.panelhaus.app` (non-redirecting `www`, no trailing slash). |
| `GEMINI_API_KEY` | server | shared key for signed-in generation + BYOK fallback. |
| `INK_COST_TEXT` / `INK_COST_IMAGE_FLASH` / `INK_COST_IMAGE_PRO` | server | per-action ink (default 1/1/2). |
| `GEMINI_IMAGE_MODEL_FLASH` / `_PRO` | server | Gemini model per tier. |
| `PUBLIC_APP_ORIGIN` | server | optional Stripe-return host; defaults fine, not needed. |

No wallet/web3 env vars and no new dependencies: wallet auth is Clerk's web3 strategy; the deep
link is plain navigation.

---

## 7. CAPTCHA / bot protection

Clerk bot-protection (Smart CAPTCHA) fires on **sign-up**, including first-time web3. The prebuilt
modal + native MetaMask button **handle CAPTCHA themselves**, so we do **not** add a manual
`<div id="clerk-captcha"/>` (a global one previously interfered with the modal's wallet prompt). In
local dev the CAPTCHA can loop on the dev instance; the fix is to turn **off** bot protection on the
**Development** Clerk instance only (prod keeps it on). See `LOCAL_DEV_CLERK_CREDITS.md`.

---

## 8. File map

| Concern | File |
|---|---|
| Provider + helper mounts | `src/main.tsx` |
| Token + gate holder | `src/services/clerkToken.ts`, `src/services/ClerkTokenBridge.tsx` |
| MetaMask conditional visibility + theme | `src/clerkAppearance.ts` |
| Wallet env detection + deep link | `src/services/wallet.ts` |
| Deep-link button (nav compact / settings full) | `src/components/WalletDeepLinkButton.tsx` |
| Sign-in entry points | `src/components/AccountControls.tsx`, `src/components/AccountSection.tsx` |
| Deep-link return handler | `src/App.tsx` (`?signin=wallet`) |
| Client auth + soft-gate + metering hooks | `src/services/geminiService.ts` (`apiPost`) |
| Per-route verify + reserve/refund | every `api/*.ts` AI route + `api/credits-balance.ts` |
| Shared balance cache | `src/services/credits.ts` |

---

## 9. Verification matrix

| Scenario | Expected |
|---|---|
| Desktop + extension → Sign in | Modal shows Email + Google + **MetaMask**; wallet sign-in → shared account/balance |
| Desktop, no extension | Modal shows Email + Google only; no wallet button anywhere |
| MetaMask in-app browser (phone) | Modal shows MetaMask; sign-in → `web3:<wallet>` Clerk session |
| Plain mobile browser (deployed https) | Nav/Settings show **Open in MetaMask**; tap → reopens in MetaMask browser → `?signin=wallet` auto-opens modal → MetaMask works |
| Localhost dev | No deep-link button (by design); native MetaMask only if you have the extension |
| BYOK key set | Generation works, no deduction, no auth required |
| Cross-app | Same account + ink balance on `panelhaus.app` |
| `/c/from-meme` | Untouched, Clerk-free |

---

## 10. Constraints to preserve
- Auth always flows through Clerk (never a separate wallet session) so the shared balance holds.
- Sign-in methods are instance-level (shared with PH); panel_shaq only changes its own appearance,
  never the other apps or the shared `hausbar.js`.
- API routes stay self-contained (inline the auth/credit helpers; do not DRY).
- The meme receiver stays Clerk-free.
