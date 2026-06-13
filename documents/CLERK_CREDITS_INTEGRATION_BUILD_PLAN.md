# Build Plan — Shared Clerk Auth + Shared Ink Credits (panel_shaq ↔ Panel Haus)

> Self-contained: written so an engineer (or agent) with **no prior context** can build it.

---

## 1. What we're building & why

`panel_shaq` (a.k.a. **Panel Haus Mobile**, deployed at `m.panelhaus.app`) is today a standalone
Vite + React 19 PWA with **no real accounts** — it uses an anonymous Supabase UID plus a per-day usage
quota / BYOK rate-limiter. The main app **Panel Haus** (repo `Comic-Pro2`, `panelhaus.app`) has Clerk auth
and a Postgres-backed **ink-credit** economy.

**Goal:** make a user the **same account** across both apps with **one shared ink balance**. Sign up on
mobile = same user on desktop; AI **image generation on mobile deducts the same shared balance**, the same
way desktop does. Everything else in panel_shaq stays the same (meme handoff, creation flow, export, GIF).

This is the panel_shaq side of an **already-agreed, already-deployed** design. Authoritative source docs:
- `Comic-Pro2/documentation/architecture/CROSS_APP_AUTH_AND_CREDITS.md`
- `Comic-Pro2/documentation/architecture/PANEL_SHAQ_INTEGRATION_HANDOFF.md`
  (mirror in our repo: `documents/PANELHAUS_ECOSYSTEM_INTEGRATION_HANDOFF.md`)

---

## 2. Prerequisites (what PH provides — confirmed available)

| Value | Used where | Notes |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` (`pk_live_…`) | frontend | **MUST be the same Clerk instance as PH** (else separate user pool → "same account" breaks). |
| `CLERK_SECRET_KEY` (`sk_live_…`) | our `api/` | backend `verifyToken`. |
| Credit API origin | our `api/` | **`https://www.panelhaus.app`** (see redirect gotcha §5). |
| Per-action ink costs | image routes | e.g. flash=1, pro=2 (mirror PH's `VITE_CREDIT_COST_*`). |

These are obtained once from the PH owner / Clerk dashboard and set as env vars (§9).

---

## 3. Verified facts (checked against live prod + source — do not re-litigate)

- **PH credit API is LIVE.** `GET /api/credits/balance`, `POST /api/credits/reserve`,
  `POST /api/credits/refund` return `401` (exist, auth-required) on `www.panelhaus.app`, and already
  **CORS-allow `https://m.panelhaus.app`** + `localhost:3000/5173/3001`. Source: `Comic-Pro2/api/credits/*.js`.
- **PH runs a live Clerk instance** (`pk_live_…` in prod bundle). Backend `requireAuth` uses
  `@clerk/backend verifyToken` with `authorizedParties` **already including `m.panelhaus.app`**
  (`Comic-Pro2/api/lib/clerk.js`).
- **Subdomain SSO is automatic** (Clerk docs): one instance on the `panelhaus.app` apex shares the session
  across all subdomains. **No satellite-domain config** (satellite is for *different* roots).
- **Canonical origin is `www`.** `panelhaus.app` `307`-redirects to `www.panelhaus.app`, and **both browser
  and Node `fetch` strip the `Authorization` header on cross-origin redirects** → always call `www` directly.
- **`reserve.amount` is explicit** (the `action` field is just a label) → our side must price each action.
- **Identity:** PH `user_id` = `email:<email>` or `web3:<wallet>`; an email always wins. Credits key on `user_id`.

### Full contracts (mirror exactly)

```
GET  /api/credits/balance        Authorization: Bearer <clerk JWT>
  200 → { success, credits, subscriptionCredits, boosterCredits, tier, nextReset }

POST /api/credits/reserve        Authorization: Bearer <clerk JWT>
  body { amount:int>0 (REQUIRED), action?:string(label), idempotencyKey?:string }
  200 → { success:true, newBalance }      402 → { code:'INSUFFICIENT_CREDITS', required }
  429 → { code:'WEEKLY_LIMIT_REACHED' }   404 → { code:'USER_NOT_FOUND' }   401

POST /api/credits/refund         Authorization: Bearer <clerk JWT>
  body { amount:int>0, idempotencyKey:string (REQUIRED, SAME as reserve), reason? }
  200 → { success:true, newBalance }   (idempotent; bound to the reserve; capped at reserved amount)
```

---

## 4. Wallet on mobile — the decision (READ THIS)

**Reality:** a normal **mobile browser has no injected `window.ethereum`** (MetaMask's extension is
desktop-only). Clerk's hosted MetaMask button calls that injected provider, so on mobile browsers it
**does nothing / errors**. Wallet login on mobile only works via (a) the wallet app's **in-app browser**
(provider injected) or (b) **WalletConnect** (bounce out to wallet app and back = friction). This is
inherent to web3-on-mobile, not fixable by us.

**Therefore:** wallet is **not** the mobile front door. Account + balance sharing is **method-agnostic** —
it works through Clerk regardless of how the user signed in. So:
- **Primary on mobile: Google (one-tap) + Email (OTP).** Near-zero friction; full shared account + balance.
- **MetaMask stays available** (renders automatically; it's enabled at the shared instance level) for
  desktop + in-app-browser users.
- **Narrow friction case:** a desktop **wallet-only** account signing in on a fresh mobile browser → one-time
  fix is to add an email/Google to that Clerk user (Clerk supports multiple identifiers per user); after that,
  frictionless forever. Alternatively WalletConnect / wallet in-app browser, once.
- **PWA vs browser is irrelevant to auth** — same `@clerk/clerk-react` web SDK in a tab, installed PWA, or
  Android TWA. (Only nuance: an iOS *installed* PWA uses WKWebView and may not silently share Safari's SSO
  cookie → those users sign in explicitly, still the same account.)

UI consequence: order the sign-in buttons **Google, Email, then MetaMask**; don't gate mobile behind wallet.

---

## 5. Locked product decisions

1. **BYOK stays** as a no-credit power mode: if the user has pasted their own Gemini key, skip Clerk + credits
   (they pay Google). Otherwise use shared key + shared ink.
2. **Soft gate:** app opens & is explorable; Clerk sign-in is prompted only when a user triggers an AI
   generation (and isn't on BYOK).
3. **Sign-in methods:** Email + Google + MetaMask (per §4 ordering).
4. **Charge ink on image generation** (the costly Gemini image calls). Text-helper routes are sign-in-gated
   but **not charged** in v1.

---

## 6. Architecture

```
Frontend (PWA, @clerk/clerk-react, SAME pk_live instance as PH)
  └ getToken() → Authorization: Bearer <clerk JWT> on every call to OUR api/
        │
Our api/ (BFF — forwards Bearer server-to-server to PH; same pattern as api/handoff-consume)
  ├ image-gen routes : reserve ink @PH → run Gemini(shared key) → refund @PH on failure
  ├ text-gen routes  : verify Bearer (sign-in gate) → run Gemini(shared key)   [v1: no charge]
  └ api/credits-balance: forward Bearer → PH /api/credits/balance  (read path for the UI chip)
        │  (ALWAYS target https://www.panelhaus.app — no redirect, header preserved)
PH backend = single source of truth (Postgres user_credits, atomic reserve-before-act)
```

- **BYOK short-circuit** at both layers: `x-api-key` present → skip Clerk + credits (today's path unchanged).
- **Server-side reserve is the real guard;** the UI gate is only UX.
- Each `api/` file stays **self-contained** — Vercel can't share local files (CLAUDE.md). `@clerk/backend` is
  an npm import (fine); our helpers are **inlined per route** (like `checkUsage` is today).

---

## 7. Implementation — frontend (`src/`)

### 7.1 Deps
`npm i @clerk/clerk-react` (frontend). Backend: `npm i @clerk/backend`.

### 7.2 `src/main.tsx` — wrap ONLY the App branch
The file already branches: `/c/from-meme` → `<FromMemeRoot/>`, else `<App/>`. Wrap **only the App branch**:
```tsx
import { ClerkProvider } from "@clerk/clerk-react";
import { ClerkTokenBridge } from "./services/ClerkTokenBridge";
// ...
root.render(
  <StrictMode><ErrorBoundary>
    {isMemeReceiver
      ? <FromMemeRoot/>                              {/* UNCHANGED — no Clerk, meme flow untouched */}
      : <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
          <ClerkTokenBridge/>
          <App/>
        </ClerkProvider>}
    <Analytics/>
  </ErrorBoundary></StrictMode>
);
```

### 7.3 Token plumbing (mirror `Comic-Pro2/src/lib/clerkToken.js`)
`src/services/clerkToken.ts`:
```ts
let _get: (() => Promise<string | null>) | null = null;
export const registerClerkTokenGetter = (fn: () => Promise<string|null>) => { _get = fn; };
export const getClerkToken = async () => { try { return _get ? await _get() : null; } catch { return null; } };
```
`src/services/ClerkTokenBridge.tsx` (registers Clerk's getToken; renders nothing):
```tsx
import { useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { registerClerkTokenGetter } from "./clerkToken";
export function ClerkTokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => registerClerkTokenGetter(() => getToken()), [getToken]);
  return null;
}
```

### 7.4 `src/services/geminiService.ts` `apiPost` — send Bearer (keep BYOK)
- Keep `x-api-key` injection (BYOK). **Replace** the `x-user-id` anon header with:
```ts
const token = await getClerkToken();
if (token) headers["Authorization"] = `Bearer ${token}`;
```
- On HTTP `402` from our routes → call `notifyError`/`onApiError` with an `out-of-ink` marker so `App.tsx`
  shows the upsell sheet (link `https://www.panelhaus.app/pricing`).

### 7.5 Soft gate (at generation)
Add a guard the screens call before kicking off a generation (or inside the generate functions):
```ts
// pseudo: returns true if allowed to proceed
function canGenerate(clerk, hasByokKey): boolean {
  if (hasByokKey) return true;            // BYOK bypass
  if (clerk.isSignedIn) return true;      // shared-ink path
  clerk.openSignIn();                      // Clerk modal (Google/Email/MetaMask)
  return false;
}
```
Use `useClerk().openSignIn()` / `useAuth().isSignedIn` from `@clerk/clerk-react`.

### 7.6 Remove the startup gate
- Delete `EmailGate` usage in `src/App.tsx` (`showAuthGate`, `authMode`, `panelshaq_auth_mode`). App opens
  straight to Workshop. (Email is now captured by Clerk at signup.)
- `src/services/supabase.ts`: drop `getUserId()`/`signInAnonymously()` (identity is the Clerk user now).
  Supabase may remain for **optional analytics only** — not identity, not credits.

---

## 8. Implementation — backend (`api/`)

Inline these helpers into each non-meme generating route (copy-paste; do NOT create a shared local import):

```js
import { verifyToken } from "@clerk/backend";
const AUTHORIZED = ["https://m.panelhaus.app","http://localhost:3000","http://localhost:5173"];

async function verifyClerkBearer(req) {                       // returns claims or null
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!t) return null;
  try { const c = await verifyToken(t, { secretKey: process.env.CLERK_SECRET_KEY, authorizedParties: AUTHORIZED });
        return c?.sub ? c : null; } catch { return null; }
}
const PH = () => process.env.PANELHAUS_API_BASE || "https://www.panelhaus.app";
async function reserveInk(bearer, amount, action, key) {
  const r = await fetch(`${PH()}/api/credits/reserve`, { method:"POST",
    headers:{ "Content-Type":"application/json", Authorization:`Bearer ${bearer}` },
    body: JSON.stringify({ amount, action, idempotencyKey:key }) });
  return { status:r.status, body: await r.json().catch(()=>({})) };
}
async function refundInk(bearer, amount, key, reason) {
  await fetch(`${PH()}/api/credits/refund`, { method:"POST",
    headers:{ "Content-Type":"application/json", Authorization:`Bearer ${bearer}` },
    body: JSON.stringify({ amount, idempotencyKey:key, reason }) }).catch(()=>{});
}
```

### 8.1 Image routes — `api/generate-image.ts`, `api/final-render.ts` (charge ink)
**Remove** the inlined `checkUsage()` Supabase quota logic. New flow:
```js
const byok = !!req.headers["x-api-key"];
const bearer = (req.headers.authorization||"").replace(/^Bearer /,"");
let amount = 0, idem = null;
if (!byok) {
  if (!bearer || !(await verifyClerkBearer(req))) return res.status(401).json({error:"sign in required"});
  amount = req.body?.model === "pro" ? (Number(process.env.INK_COST_IMAGE_PRO)||2)
                                     : (Number(process.env.INK_COST_IMAGE_FLASH)||1);
  idem = crypto.randomUUID();
  const r = await reserveInk(bearer, amount, "mobile_image", idem);
  if (r.status === 402) return res.status(402).json({ code:"INSUFFICIENT_CREDITS", required:r.body?.required });
  if (r.status === 429) return res.status(429).json({ code:"WEEKLY_LIMIT_REACHED" });
  if (r.status !== 200)  return res.status(502).json({ error:"credit reserve failed" });
}
try {
  const image = await geminiImage(/* shared GEMINI_API_KEY or BYOK key */);
  return res.status(200).json({ image, newBalance: byok ? undefined : /* from reserve */ undefined });
} catch (e) {
  if (!byok && idem) await refundInk(bearer, amount, idem, "gemini failed");
  return res.status(500).json({ error:"generation failed" });
}
```
(Capture `newBalance` from the reserve response if you want to push it to the UI.)

### 8.2 Text routes — `generate-panels.ts`, `insert-panel.ts`, `polish-story.ts` (gate only)
Remove `checkUsage()`; add: if not BYOK and `!(await verifyClerkBearer(req))` → `401`. No charge in v1.
Also add the same gate to `analyze-character.ts`, `critique-comic.ts`, `suggest-dialogue.ts` (currently
ungated). They already use `gemini-3.1-flash-lite-preview`.

### 8.3 New proxy `api/credits-balance.ts` (UI read path)
```js
export default async function handler(req, res) {
  const h = req.headers.authorization || "";
  const r = await fetch(`${process.env.PANELHAUS_API_BASE||"https://www.panelhaus.app"}/api/credits/balance`,
    { headers:{ Authorization:h } });
  res.status(r.status).json(await r.json().catch(()=>({})));
}
```
(Frontend calls this with the Bearer; renders the nav chip + Settings balance.)

---

## 9. Env vars (panel_shaq)

- Frontend (build-time): `VITE_CLERK_PUBLISHABLE_KEY=pk_live_…`
- Server (Vercel runtime): `CLERK_SECRET_KEY=sk_live_…`; `PANELHAUS_API_BASE=https://www.panelhaus.app`
  (set explicitly to the non-redirecting origin); reuse `GEMINI_API_KEY`; optional
  `INK_COST_IMAGE_FLASH=1`, `INK_COST_IMAGE_PRO=2`.
- Stop relying on `ANON_LIMIT_TEXT/IMAGE` + the Supabase `usage` table for gating.

---

## 10. UI/UX — profile + credit display (use the frontend-design skill)

- **Top nav** `src/components/Navigation.tsx` (current right cluster: settings · `<haus-switcher>`):
  add an **ink chip** (`⚡ {credits}` from `api/credits-balance`) + Clerk **`<UserButton/>`** (avatar →
  profile/sign-out) when signed in; a **"Sign in"** button when signed out. Keep the reordered layout
  (logo · hamburger · NEW · settings · switcher).
- **Sign-in surface:** Clerk `<SignIn/>` modal via `openSignIn()` — buttons ordered **Google, Email, MetaMask**.
- **Settings** `src/screens/SettingsScreen.tsx`: replace the "Today's Usage (50/20)" block with an
  **Account** section (avatar/email, tier, ink balance, "Get more ink" → `www.panelhaus.app/pricing`). Keep
  the BYOK key field, reframed: "Use your own Gemini key — unlimited, skips credits."
- **Out-of-ink (402):** a sheet/toast → upsell link to PH pricing.

---

## 11. Untouched

- Meme handoff (`/c/from-meme`, `src/from-meme/*`, `api/handoff-consume.ts`) — anonymous, no Clerk, no
  credits; `originUser:web3:…` stays display-only.
- GIF export, `.comic` export/bridge, all creation-screen core logic.

---

## 12. Edge cases / gotchas

- **www redirect** strips `Authorization` → always hit `www.panelhaus.app` (set `PANELHAUS_API_BASE`).
- **Reserve then crash before refund:** acceptable rare loss; the `idempotencyKey` makes retries safe and
  the refund is idempotent. (Optional later: persist pending reserves.)
- **iOS installed PWA** (WKWebView) may not silently SSO → explicit sign-in, same account.
- **Wallet-only desktop account on mobile browser** → §4 (add email/Google once, or WalletConnect/in-app).
- **Concurrency / two devices:** handled by PH's atomic reserve — never overspend.

---

## 13. Verification (E2E)

1. `npm run lint` (tsc --noEmit — the only check in this repo).
2. **Shared account:** sign in on `www.panelhaus.app` (desktop) → open `m.panelhaus.app` → already signed in;
   or sign up fresh on mobile → PH `users` row appears with the same `user_id`.
3. **Shared balance:** generate an image on mobile → ink drops on PH → reflected on desktop + nav chip.
4. **Out-of-ink:** low balance → reserve `402` → upsell, no generation.
5. **Refund:** force a Gemini failure after reserve → `/refund` restores ink (net unchanged).
6. **Concurrency:** two devices spend a low balance → never overspend.
7. **BYOK:** personal key set → generation works, **no** deduction.
8. **Meme flow:** `/c/from-meme?...` works with zero auth prompts.

---

## 14. Phasing (each independently testable)

- **P1 — Auth shell:** deps, `ClerkProvider` (App branch only), token bridge, nav `<UserButton>`/sign-in,
  remove `EmailGate`, soft gate. Generation still on old path. Test sign-in + apex SSO.
- **P2 — Image credit-spend:** `api/credits-balance` + nav chip; image routes reserve/refund; 402 upsell.
  Test shared-balance deduction, refund, out-of-ink.
- **P3 — Cleanup:** remove daily limiter + anon identity; gate text routes; Settings "Account" section; BYOK
  reframed. Run full §13.
```
