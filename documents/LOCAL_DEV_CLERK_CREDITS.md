# Local Dev — Clerk Auth + Shared Credits (the gotchas)

How to run **panel_shaq + Panel Haus locally** with shared Clerk login and the shared
ink economy, and how to dodge the traps (CAPTCHA loop, prod-key-on-localhost, port
clashes, token-instance mismatch). Companion: `CLERK_CREDITS_INTEGRATION_BUILD_PLAN.md`.

---

## 0. The one rule that explains most failures

**A Clerk token is only valid for the instance that minted it, and that instance
must be reachable from your origin.** Two consequences:

- **Production keys (`pk_live`/`sk_live`) do NOT work on `http://localhost`.** A
  production Clerk instance is domain-locked (HTTPS + its real domain). On localhost
  the Frontend API returns **400** and sign-in never establishes. → For local dev, use
  the **Development** instance keys (`pk_test`/`sk_test`).
- **Both apps must use the SAME instance keys.** panel_shaq mints the token; PH verifies
  it. If panel_shaq is on instance A and PH's `CLERK_SECRET_KEY` is instance B, PH logs
  `[auth] legacy JWT verify failed (expected for Clerk tokens): invalid algorithm` and
  returns 401. Copy the **same** `pk_test`/`sk_test` into **both** `.env.local` files.

---

## 1. The CAPTCHA loop on MetaMask sign-up (and the fix)

**Symptom:** "Continue with MetaMask" → you sign → a CAPTCHA appears → you solve it →
it asks again, forever. (First-time wallet/email sign-in is a **sign-UP**, which trips
Clerk's bot-protection CAPTCHA; the invisible widget loops on a dev instance + localhost.)

**Fix (do this for local dev):**
1. Clerk Dashboard → switch to the **Development** instance (not Production).
2. **Configure → Attack protection** (Bot sign-up protection) → **turn it OFF**.
3. It's **per-instance**, so production keeps bot protection ON — unaffected.

After that, wallet/email sign-up completes locally with no CAPTCHA.

**Do NOT** add a global `<div id="clerk-captcha" />` to "fix" it — that's only for
**custom** sign-up forms. With the prebuilt `<SignIn>` modal it pulls the CAPTCHA out of
the modal to the page root and the wallet prompt never fires. The modal manages its own
CAPTCHA; just turn bot protection off on dev.

**Alternative if you don't want to touch the toggle:** bot protection only fires on
**sign-up**. Create the account once where it won't loop (e.g. wallet on PH **desktop**
via the extension, or email/Google), then **sign in** on mobile — sign-in never CAPTCHAs.

**MetaMask won't prompt at all?** A stuck/pending request from a previous loop — click
the MetaMask extension icon, clear anything queued, fully reload, retry. Disable other
wallet extensions (they fight over `window.ethereum`).

---

## 2. Running all three locally (ports matter)

panel_shaq serves its own `/api/*` **in-process** via the `vercelApiDev` plugin in
`vite.config.ts` — so it runs on **plain Vite**, no `vercel dev` needed. `dev.ps1` just
loads `.env.local` into the shell first (Windows `vercel dev` doesn't pass env to
functions; Vite needs the server vars in `process.env`).

| App | Command (in its repo) | Port |
|---|---|---|
| Panel Haus frontend | `npm run dev` | 5173 |
| Panel Haus backend | `./dev.ps1` | **3001** |
| **panel_shaq** | `./dev.ps1` (runs Vite) | **3002** ← open this |

- `panel_shaq/.env.local`: `PANELHAUS_API_BASE=http://localhost:3001` (PH backend).
- **Port discipline:** PH's Clerk `authorizedParties` only allows `localhost:5173` +
  `localhost:3001`; we added **`localhost:3002`** for panel_shaq to both PH's
  `api/lib/clerk.js` and panel_shaq's route `AUTHORIZED_PARTIES`. So panel_shaq must run
  on **3002** (or another listed port), or PH rejects the token.
- You do **not** need PH's frontend for credit testing — only PH's **backend** (3001).
- After killing stragglers (`taskkill /F /IM node.exe`), start **PH backend first** so
  ports land deterministically.

---

## 3. `.env.local` (panel_shaq) for local dev

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_…   # SAME dev instance as Comic-Pro2/.env.local
CLERK_SECRET_KEY=sk_test_…             # SAME dev instance
PANELHAUS_API_BASE=http://localhost:3001
GEMINI_API_KEY=…                       # a real key (free AI Studio key) or PH's
INK_COST_IMAGE=1
INK_COST_TEXT=1
```
Restart `dev.ps1` after editing (the `VITE_` key bakes at startup). No quotes needed.

`Comic-Pro2/.env.local` must have the **same** `pk_test`/`sk_test`, plus `POSTGRES_URL`,
`ENABLE_PAYMENTS=true`, `FREE_TIER_CREDIT_AMOUNT`, `GEMINI_API_KEY`.

---

## 4. Admin (no-deduction) testing

`reserve.js` (PH) bypasses deduction only when **`isAdminUser(userId)` AND the redis
flag `AI_ADMIN_RATE_LIMIT_BYPASS` is ON** — same toggle PH's own routes use.

- Be an admin: your wallet in `ADMIN_WALLETS` (or email in the admin list) on PH.
- Toggle ON → admin generates with **no** ink deducted. Toggle OFF → admin deducts (good
  for testing the non-admin path with one account).
- Redis caveat: the flag lives in Upstash. If PH-local falls back to **mock redis**, the
  flag reads off → admin still deducts locally. Point PH-local at the real Upstash to
  test bypass.

---

## 5. Quick error → cause map

| You see | Cause |
|---|---|
| `clerk.<domain>/v1/environment` → **400** on localhost | Using **prod** `pk_live` on localhost. Use dev `pk_test`. |
| MetaMask CAPTCHA **loops** | Bot protection on the dev instance → turn it OFF (§1). |
| MetaMask **never prompts** | Global `#clerk-captcha` div present (remove it) / stuck pending request / token from another instance. |
| `/api/*` **401** while "signed in" | Token's `azp` (your port) not in `AUTHORIZED_PARTIES`, or panel_shaq/PH on **different** instances. |
| `/api/credits-balance` **502** | panel_shaq can't reach `PANELHAUS_API_BASE` — PH backend not running / wrong port. |
| PH log `legacy JWT verify failed … invalid algorithm` | A request hit PH with a token Clerk couldn't verify (wrong instance / stale / expired). Symptom, not cause. |

---

## 6. Verify the loop works end-to-end

1. Sign in (email or wallet) on `localhost:3002` → avatar + ink chip appear.
2. **Non-admin** (bypass toggle OFF): generate panels → ink −1; generate image → ink −1;
   drain to 0 → "out of ink"; force a failure → ink refunded.
3. **Admin** (bypass ON): generate → no deduction.
4. Cross-check: `SELECT type, amount, created_at FROM credit_transactions WHERE user_id =
   '<you>' ORDER BY created_at DESC LIMIT 5;` — billed gens insert a `credit_reserve`
   row; admin-bypassed gens insert none.

> Reminder: local uses the **dev** Clerk pool — a fresh user with the dev free-tier grant
> (not your prod 520). The mechanics are identical; only the data pool differs. Real
> shared accounts/balances are exercised on the deployed `m.panelhaus.app` (prod keys).
