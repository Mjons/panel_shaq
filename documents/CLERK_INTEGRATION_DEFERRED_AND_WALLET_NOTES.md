# Clerk Integration — Deferred Work + Wallet/Identity Notes

**Status:** the Clerk shared-auth + shared-credits integration is code-complete on the
`clerk` branch. This doc captures the two pieces we deliberately **did NOT build yet**,
and answers the design question about doing a **custom wallet flow with Clerk-email-only**.

Companion docs: `CLERK_CREDITS_INTEGRATION_BUILD_PLAN.md` (what was built),
`PANELHAUS_ECOSYSTEM_INTEGRATION_HANDOFF.md` (PH-side contract), and on the PH repo
`Comic-Pro2/documentation/architecture/CROSS_APP_AUTH_AND_CREDITS.md`.

---

## 1. Deferred (not built — by design)

### 1a. Referral-code forwarding (`?ref=` through the PH → mobile hop)

**What it is.** Panel Haus runs a referral program: a link like `panelhaus.app/?ref=CODE`
must end up attached to the new user's Clerk signup so PH's webhook (`linkReferral`)
credits the referrer.

**Why it's a "must-handle" (from the cross-app doc).** Mobile users are routed
PH → `m.panelhaus.app`. PH captures the code into **`localStorage` key
`panelhaus_referral_code`**, but localStorage is **origin-scoped** — `m.panelhaus.app`
(a different origin) **cannot** read PH's stored code. So if the redirect to mobile
drops the query string, **every mobile signup silently loses its referral credit.**

**What needs to happen.**
1. The PH-side redirect that bounces mobile users must **append the pending `?ref=`
   (and `?comic=`) params** to the `m.panelhaus.app` URL (PH-side change).
2. panel_shaq reads `?ref=` on load, stores it, and on Clerk signup calls PH's
   **`POST /api/referral/link-pending`** (Clerk-authed) — the same idempotent endpoint
   PH's own web frontend uses. No separate referral logic on our side.

**Effort / risk.** Small on our side (read query param + one authed POST after signup).
The PH redirect change is on the PH repo. **Recommended before any real launch** with
referrals on.

### 1b. WalletConnect for MetaMask in a plain mobile browser

**What it is.** Today wallet sign-in uses Clerk's built-in MetaMask strategy, which
needs an injected `window.ethereum` provider — present on desktop (extension) and inside
a wallet app's in-app browser, but **absent in a normal mobile browser** (Safari/Chrome).
So a phone user in a regular browser can't use the MetaMask button.

**What WalletConnect would add.** A QR / deep-link flow that opens the user's wallet app,
gets the signature, and returns to the browser — making wallet login work on mobile.

**Why it's deferred.** It's friction-heavy on mobile (app-switching, occasional flaky
returns), and **email + Google already cover mobile sign-in cleanly** while still giving
the same shared account + balance. Wallet is a power-user nicety on mobile, not the front
door. See §2 for the identity implications of *how* wallet sign-in is wired.

**Effort / risk.** Medium. The clean way is to wire WalletConnect **through Clerk's web3
strategy** (so identity stays unified) rather than a separate connector — see §2.

---

## 2. Design question: custom wallet flow + Clerk-email-only?

> "Is it bad UX to make a custom wallet connection and Clerk only via email? Would wallet
> users still share the same account as PH and be able to take over?"

### The one thing that makes sharing work

The shared account + shared balance works **only** because the **same Clerk identity**
resolves to the **same Panel Haus `user_id`**:

```
Clerk user  ──(clerk_user_id)──>  PH users.user_id  ("email:<email>" or "web3:<wallet>")
                                          └──> user_credits (the shared ink balance)
```

PH's credit API (`/api/credits/balance|reserve|refund`) authenticates every call with
**`requireAuth`**, which accepts a **Clerk token** (or PH's legacy JWT) and nothing else.
It has **no wallet-signature (SIWE) path**. So: *if a request doesn't carry a Clerk
identity, PH cannot map it to a shared account or balance.*

### Two very different meanings of "custom wallet"

**(A) Custom wallet OUTSIDE Clerk** (your own wagmi/SIWE, separate from Clerk):
- The mobile wallet session is **not a Clerk session** → no Clerk identity.
- PH's credit API can't resolve it → **wallet users would NOT share the PH account or
  balance**, and **could NOT "take over" their existing PH account.**
- You'd run **two parallel identity systems** (Clerk email accounts + separate wallet
  accounts). Result: fragmented identity, possible double/again-granted free credits,
  "why isn't my balance here?" support load. **This is the bad-UX choice** and it breaks
  the core goal for wallet users.
- Making it work would require **PH to add a new wallet-signature auth path** to its
  credit API and map `web3:<wallet>` → the same `user_id` — real PH-side work, plus new
  trust/attack surface (you'd be minting auth PH has to trust).

**(B) Custom wallet UI that still drives Clerk's web3 sign-in** (`useSignIn()` web3
strategy under your own buttons):
- It **is** a Clerk session → same Clerk identity as PH.
- Wallet users **share the same PH account + balance**, and **yes, they "take over"**
  their existing PH account on sign-in (the desired behavior — PH already creates wallet
  users as Clerk users via `user.web3Wallets[0]` → `web3:<wallet>`).
- You get a custom-looking wallet button **without** fragmenting identity. Costs more dev
  effort than Clerk's prebuilt modal, but it's the correct path if you want custom UI.

### "Take over" — clarifying the term

- **Desirable takeover** = signing in on mobile lands you in your *existing* PH account
  with its balance. This happens **only** when the mobile auth produces the **same Clerk
  identity** (same email, or same wallet held in Clerk). Path (B) and email/Google both
  do this; path (A) does not.
- **Account security** = whoever proves control of the identity (Clerk-verified email
  OTP / Google / wallet signature) gets the account. Keeping wallet verification **inside
  Clerk** means Clerk owns that signature check — don't re-implement it outside Clerk.

### Recommendation

- **Do not build wallet auth outside Clerk.** That's the only option that fails to share
  the balance and risks duplicate accounts.
- Pick one of:
  1. **Keep wallet inside Clerk** (today's build: Email + Google + MetaMask via Clerk).
     Mobile-browser wallet is friction; add WalletConnect later **via Clerk** (§1b) if
     wanted.
  2. **Email + Google on mobile, wallet deferred** (simplest, lowest friction). Pure
     wallet-only PH users add an email/Google to their Clerk account once, then mobile is
     frictionless forever.
  3. **Custom wallet UI via Clerk's web3 strategy** (path B) — only if you specifically
     want a bespoke wallet button; identity stays unified.

**Net:** "custom wallet + Clerk-email-only" is a bad choice **only in form (A)** (wallet
outside Clerk) — there, wallet users would not share PH's account/balance and couldn't
take over. Any approach where wallet sign-in flows **through Clerk** keeps one account,
one balance, and proper takeover.
