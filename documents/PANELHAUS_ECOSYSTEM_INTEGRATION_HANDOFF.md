# panel_shaq → Panel Haus Ecosystem — Integration Handoff

**For:** the panel_shaq team (repo `Mjons/panel_shaq`) + their AI assistant.
**From:** Panel Haus. **Date:** 2026-06-06.
**Companion (PH side):** `CROSS_APP_AUTH_AND_CREDITS.md`. **Prereq:** do this **after** Panel Haus's Clerk
migration is live (PH provides the Clerk keys + credit-API URLs at that point).

This doc is written to be **self-contained** — it states what we found in panel_shaq, what changes, and
exactly which files to touch.

---

## The goal

panel_shaq joins the Panel Haus ecosystem: a user is the **same account** across PH (web) and panel_shaq
(mobile PWA), with **one shared ink balance**. Users are primarily brought from PH → mobile → panel_shaq
and should land already signed in. panel_shaq adopts **Panel Haus's exact credit system** — its current
free-daily-quota + BYOK rate-limiter is **retired**.

## What panel_shaq is today (our recon — confirm on your side)

- **Stack:** Vite + React 19 PWA, wrapped as an Android TWA (`shaq.panelhaus.app`). Deployed on Vercel.
- **Backend:** its own 10 Vercel serverless functions in `api/` (Gemini proxy + usage tracking); already
  calls PH server-to-server for the meme handoff (`PANELHAUS_API_BASE` → `/api/handoff/consume`).
- **DB:** its own **Supabase** Postgres (tables `usage`, `emails`) — separate from PH's Postgres.
- **Auth:** **anonymous** Supabase sign-in only. `src/services/supabase.ts` `getUserId()` →
  `signInAnonymously()`, cached; passed to the backend as the `x-user-id` header
  (`src/services/geminiService.ts`). No Clerk, no real accounts, no wallet login.
- **Economy:** no ink balance — a per-day quota in `api/final-render.ts` `checkUsage()` (anon
  10 text / 5 image; BYOK 50 / 20), HTTP 429 at the limit.

## What changes (3 swaps — auth, identity, credits)

### 1. Auth → Clerk (same instance as Panel Haus)

- Add `@clerk/clerk-react`. Initialise with the **same** `VITE_CLERK_PUBLISHABLE_KEY` PH gives you — it
  **must be the same Clerk instance**, or you get a separate user pool and the "same account" breaks.
- Wrap the app root in `<ClerkProvider publishableKey={…}>`; use Clerk's sign-in UI (email primary on
  mobile; wallet is web-only for now).
- Because `shaq.panelhaus.app` shares the `panelhaus.app` apex with one Clerk instance, a user signed in
  on PH web is **auto-recognised** here (apex-cookie SSO) — most of your users arrive already signed in.

### 2. Identity → the Clerk user (retire the anonymous UID)

- Replace `getUserId()`/`signInAnonymously()` (`src/services/supabase.ts`) — identity is now the Clerk
  user, shared with PH.
- Replace the `x-user-id` anon-UID header (`src/services/geminiService.ts`) with the Clerk session token:
  `const token = await getToken();` → send `Authorization: Bearer ${token}`.
- Your serverless functions validate that token with **`@clerk/backend verifyToken`** (same instance, same
  JWKS) → resolves the same user PH knows. (Or forward it to PH and let PH resolve — see §3.)

### 3. Credits → Panel Haus's shared ink (retire the Supabase daily-limiter)

- **Remove** the `checkUsage()` daily-quota logic in `api/final-render.ts` (and any sibling usage
  increment/limit code). panel_shaq no longer owns an economy.
- **Before** each AI generation, call PH's credit API (PH provides exact URLs after its Clerk migration),
  forwarding the user's Clerk Bearer token — **server-to-server**, the same way you already call
  `/api/handoff/consume`:
  - `GET  {PANELHAUS_API_BASE}/api/credits/balance` → show the user's ink + tier.
  - `POST {PANELHAUS_API_BASE}/api/credits/reserve` `{ action, cost }` → atomically charge ink; on 402
    "insufficient," surface PH's upsell/out-of-ink UX instead of generating.
  - `POST {PANELHAUS_API_BASE}/api/credits/refund` → call this if your Gemini generation **fails** after a
    reserve, so the user isn't charged for failed work.
- **Do NOT** implement balance math locally — PH is the single source of truth, and its `reserve` is
  atomic (safe against the same user spending on two devices at once).
- Supabase may stay for your **own local analytics** (e.g. `emails`) — just not for identity or credits.

## Exact integration points (from recon — verify line numbers in current code)

| Concern                  | File                                                                | Change                                                                          |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Anonymous identity       | `src/services/supabase.ts` (`getUserId`)                            | Replace with Clerk; drop `signInAnonymously`.                                   |
| Token sent to backend    | `src/services/geminiService.ts` (`x-user-id` header, ~`:125`)       | Send `Authorization: Bearer <Clerk token>` instead.                             |
| Daily quota / economy    | `api/final-render.ts` (`checkUsage`, ~`:49`) + sibling usage writes | Remove; call PH `/api/credits/reserve` before generating, `/refund` on failure. |
| Per-generation functions | `api/generate-*.ts`, `insert-panel.ts`, etc.                        | Verify Clerk token (or proxy to PH); charge ink via PH before the Gemini call.  |
| App root                 | wherever the React tree mounts                                      | Wrap in `<ClerkProvider>`.                                                      |

## What Panel Haus provides to you

- The **same Clerk instance** publishable key (`VITE_CLERK_PUBLISHABLE_KEY`) + the JWKS / `CLERK_JWT_KEY`
  for backend `verifyToken`.
- The **credit-API URLs + contract** (`/api/credits/balance|reserve|refund`), Clerk-Bearer authed.
- The **per-action ink costs** (so mobile prices generations the same as web).
- `authorizedParties` will include `shaq.panelhaus.app`.

## Safety notes

- Send the Clerk Bearer over HTTPS only; tokens are short-lived JWTs.
- All concurrency/over-spend protection lives in PH's atomic `reserve` — don't reinvent it.
- Refund on failed generations so users aren't charged for nothing.

## Sequence

1. PH ships its Clerk migration + the credit-spend API, then hands you the keys + URLs + ink costs.
2. You: add Clerk (same instance) → replace anon identity → swap the daily-limiter for PH credit calls →
   test the shared-account + shared-balance flow.

## Verification

- Sign in on PH web, open `shaq.panelhaus.app` on mobile → already signed in, same account, same balance.
- Generate on mobile → ink deducts from the shared PH balance → reflected on PH web.
- Insufficient balance on mobile → PH's out-of-ink/upsell path, no generation.
- Failed Gemini call after a reserve → `/refund` restores the ink.

## Open decisions

- Mobile wallet login (WalletConnect) — defer; email is the primary on mobile for v1.
- Whether to keep any Supabase usage for local analytics (optional).
- Exact PH→mobile routing/deep-link UX (PH side).
