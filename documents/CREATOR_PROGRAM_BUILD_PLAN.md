# Creator Program on Panel Haus Mobile — build plan

**Status:** planned, not built. **Written:** 2026-08-13.
**Companions:** `CLERK_CREDITS_INTEGRATION_BUILD_PLAN.md` (the shared-account/shared-ink pattern this
copies), `REFERRAL_INTEGRATION.md` (the proxy shape this copies), `GTD_SHIP_CLAIM_BUILD_PLAN.md`
(the *different, retired* system this must not be confused with).

This document is **self-contained on purpose**. Every fact below was verified against
`Comic-Pro2` source and is quoted with `path:line`, so a fresh session can build from this file
without re-exploring the desktop repo. Where the desktop repo's own docs disagree with its code, the
code won, and the disagreement is recorded at the end.

---

## 1. Why

Panel Haus desktop (`Comic-Pro2`, panelhaus.app) runs a **Creator Program / Creator Card**: users
join, complete a short list of asks, earn points into PH's Postgres, level a collectible card
through three tiers, and at 100 points attach the wallet the Smudge NFT will mint to. The GTD/FCFS
mint allowlist is derived offline from that ledger.

Panel Haus Mobile shares **one Clerk account and one PH Postgres user** with desktop but has no
Creator Program surface at all. A mobile-first user cannot join, cannot see their card, and cannot
attach a mint wallet — even though points they *would* earn are already accruing against them
server-side.

**Goal:** the same program, the same cards, the same asks, on mobile — against the **same PH
Postgres**, so anything done on either app is immediately true on the other.

### The two properties that make this cheap

**(a) The program is already fully server-owned.** Point values, verification, idempotency, tier
inputs and the GTD gate all live in `Comic-Pro2/api/_lib/creatorCard.js` and `creatorProgram.js`.
`GET /api/creator-card/state` returns everything a client renders **and records any newly-satisfied
step before answering**. Mobile does not reimplement the economy — it renders PH's state and posts
two kinds of click. The apps therefore *cannot* drift.

**(b) Bidirectional consistency is structural, not maintained.** Every card action is written by

```js
awardPoints(userId, spec.points, `card_action_${action}`, userId)   // creatorCard.js:245
```

against `point_transactions`, which carries

```sql
CREATE UNIQUE INDEX uniq_point_tx_type_ref ON point_transactions(type, reference_id)
  WHERE reference_id IS NOT NULL;                    -- 009_user_points.sql:44
```

With `reference_id = userId`, an ask completed on web is physically un-re-awardable on mobile and
vice versa. There is no `app`/`source` column on `point_transactions` and none is needed.

### Decisions already taken (approved)

| Decision | Choice |
|---|---|
| Scope | Core (join, 7 asks, points/tier/card, mint wallet) **+** mint-reminder opt-in **+** GTD unlock celebration **+** custom card art & zoom |
| Not in scope | The `/creators` marketing page |
| Placement | Settings → Account row → **full-screen overlay** |
| Comic-Pro2 edits | **Yes** — both (Discord return path, `artSeed`) |
| "Post your card" | **Native share sheet** (`navigator.share({files})`) |

---

## 2. Orientation — three things people confuse

| | Creator **Program** / Card | `creator-application` (ship-claim) | Referral program |
|---|---|---|---|
| Where | PH **Postgres** | Upstash **Redis** | PH Postgres |
| Auth | Clerk `requireAuth` on every route | **none**, anonymous | Clerk |
| Flag | `ENABLE_CREATOR_PROGRAM` / `ENABLE_CREATOR_CARD` | none | none |
| Grants | ink on join, points per ask | **nothing** | points + welcome ink |
| Status | **live — this document** | **RETIRED** both sides | live, already integrated here |
| Our code | *(to be built)* | `api/creator-application.ts`, `src/services/shipClaim.ts` (`SHIP_CLAIM_ENABLED = false`) | `api/referral-*.ts`, `src/services/referral.ts` |

**Nothing in this plan touches the ship-claim.** `CLAUDE.md:165` and
`GTD_SHIP_CLAIM_BUILD_PLAN.md:93-104` already state the distinction; the endpoint and its
`creator:application:*` / `creator:applications` Redis keys stay exactly as they are, because PH's
list/export/backup scripts still read them.

The Creator Program is also a **hard consumer of the referral system** — `refer_friends` verifies
against `getReferralCount(userId)`, which mobile already feeds via `api/referral-link.ts`.

---

## 3. Verified reference — everything a fresh session needs

### 3.1 The seven card rows

Client definitions: `Comic-Pro2/src/components/CreatorCard/CreatorCardModal.jsx:58-150` (`STEPS`).
Point values are **server-authoritative**: `Comic-Pro2/api/_lib/creatorCard.js:68-134`
(`CARD_ACTIONS`). Where the two carry the same number it must stay in sync or the balance visibly
jumps when the server reconciles the optimistic add.

| # | id | kind | label | hint | pts | completion evidence |
|---|----|------|-------|------|-----|---------------------|
| 1 | `claim_card` | ask | `Claim your card` | `Connect Discord, your name goes on it` | 20 | server: `cp_discord_id` is set |
| 2 | `follow_x` | ask, honor | `Follow @panelhausapp` | `Honor system, opens X` | 20 | **none** — honour system |
| 3 | `share_card` | ask, honor | `Post your card` | `Quote-post it with your referral link` | 15 | **none** — honour system |
| 4 | `refer_friends` | ask | `Refer two friends` | `Click to copy your link` | 25 (**displays 45**) | server: `getReferralCount >= 2` |
| 5 | `contest` | go | `Enter a contest` | `Opens Discord. Read the contest rules there before entering. Ticks once you actually enter one` | 20 | server: a `share_events` row with `contest_id IS NOT NULL` |
| 6 | `first_creation` | go | `Make something` | `Counts once you generate art` | 15 | server: any `credit_transactions` row `type NOT ILIKE '%grant%' AND NOT ILIKE '%refund%'` |
| 7 | `mint` | soon | `Mint Smudge` | `official OpenSea page coming soon` | — | inert; **no server action exists** |

Extra client fields:
- `claim_card.hintOff = 'Discord isn't configured yet'`
- `follow_x.subHint = 'x.com/panelhausapp'`, `href = 'https://x.com/intent/follow?screen_name=panelhausapp'`
- `refer_friends.displayPoints = 45`
- `DISCORD_INVITE_URL = 'https://discord.gg/panelhaus'` (`CreatorCardModal.jsx:156`)
- `GTD_POINTS_REQUIRED_FALLBACK = 100` (`:175`) — **first paint only**; the server value wins

### 3.2 The rules that are load-bearing

1. **`claim_card` gates everything.** `creatorCard.js:213-221` refuses every other action with
   `409 CLAIM_REQUIRED` until the claim has a ledger row. This closed a live hole where any
   signed-in account could POST `{action:'follow_x'}` for 20 points (changelog `1340`).
2. **The ledger is the truth for "claimed", not `cp_card_claimed_at`.** `creatorCard.js:164-182`
   explains why; the client's `cardLocked` reads the same row:
   ```js
   const cardLocked = !member || (breakdown?.card_action_claim_card ?? 0) === 0;  // :634
   ```
3. **Only the four `kind:'ask'` rows drive pips and tier.** `contest` / `first_creation` pay points
   and move nothing (`:608-614`, `:664-665`).
4. **Tiers** (`CreatorCard.jsx:91-105`):
   ```js
   TIERS = { STARTER: {name:'Starter', blurb:'Handle claimed. Cool steel foil. The entry card.', mod:''},
             PLUS:    {name:'Plus',    blurb:'Cyan foil. Most of the asks done.',      mod:'ph-card--plus'},
             OG:      {name:'OG',      blurb:'Animated gold foil. Every ask done. The flex card.', mod:'ph-card--og'} }
   tierFor(done, total) => done >= total ? 'OG' : done >= 2 ? 'PLUS' : 'STARTER'
   ```
5. **`refer_friends` shows 45, awards 25.** The other 20 is 2 × `POINTS_PER_REFERRAL_SIGNUP` paid
   separately by the referral system. `points: 25` must stay 25 — the optimistic path reads it.
6. **Four asks total 80; the GTD gate is 100.** `GTD_POINTS_REQUIRED = 100`
   (`creatorProgram.js:35`), shipped to the client as `gtdPointsRequired` and enforced by
   `attach-wallet.js:209-215`. A finished card is *still locked* — a contest (+20) is the only single
   step that closes the gap from four asks. **Never hardcode 100** except as the first-paint
   fallback, and the locked copy must always name the shortfall.
7. **`first_creation` already fires for mobile users today.** PH's `api/credits/reserve.js:99-104`
   writes `credit_transactions` with `type: 'credit_reserve'`, which passes the verify. Every mobile
   image generation satisfies it.
8. **The server sweep is one pass.** `state.js:128-146` walks `SWEEP_ORDER` (claim first, by
   construction — `creatorCard.js:156-159`), and `evidence.claimed` flips mid-loop so a single GET
   after the Discord return records the claim **and** pays out everything queued behind it. Newly
   awarded steps come back in `awarded[]` and must be toasted.
9. **The sweep is gated on membership** (`state.js:101-108`) — that gate *is* the consent record.
   Before it, merely opening the modal enrolled and paid every long-standing user, because
   `contest`/`first_creation` verify against permanent history (changelog `1317`).
10. **`onAward` runs on the first grant only** (`creatorCard.js:238-242`).

### 3.3 PH endpoint contracts

All use `requireAuth(req)` (`api/_lib/clerk.js:237-267`) — Clerk `verifyToken` first, legacy custom
JWT as fallback. It resolves to the internal `user_id` (`email:…` / `web3:…`).

**`GET /api/creator-card/state`** — the one load call. Flag `ENABLE_CREATOR_CARD` (404 if off).
**Mutates on GET** (runs the sweep). Response (`state.js:148-189`):

```jsonc
{
  "success": true,
  "balance": 115,                       // user_points.balance AFTER the sweep
  "breakdown": { "card_action_claim_card": 20, "referral_signup": 20, … },
  "referralCode": "PH-ABC123",
  "referralCount": 2,
  "member": true,                       // is_creator_program_member
  "joinReady": true,                    // ENABLE_CREATOR_PROGRAM === 'true'
  "discordConnected": true,
  "discordUsername": "someone",
  "discordReady": true,                 // enabled && DISCORD_CLIENT_ID && DISCORD_OAUTH_REDIRECT
  "mintReminder": { "optedIn": false, "email": "you@example.com" },
  "walletAddress": null,
  "gtdPointsRequired": 100,
  "awarded": [ { "action": "claim_card", "points": 20 } ]   // what THIS call newly recorded
  // + "artSeed": "email:you@example.com"   ← added by the PH edit in §4.2
}
```

**`POST /api/creator-card/action`** — body `{ action }`, allowlisted against `CARD_ACTIONS`.

| Status | Body |
|---|---|
| 200 | `{ success:true, action, awarded, balance }` |
| 400 | `{ error:'Unknown action' }` |
| 403 | `{ error:'Join the Creator Program first', code:'NOT_MEMBER', action, awarded:false, balance }` |
| 409 | `{ error:'Claim your card first', code:'CLAIM_REQUIRED', … }` |
| 409 | `{ error:'Action not completed yet', code:'NOT_VERIFIED', … }` |
| 404 | flag off · 401 unauthenticated · 500 `{ error:'Could not record action' }` |

**`POST /api/creator-program/join`** — no body. Flag `ENABLE_CREATOR_PROGRAM`.
- 200 `{ member:true, bonusGranted, bucket, tier, newBalance }`
- 409 `{ error:'Creator Program bonus already claimed', code:'ALREADY_JOINED', member:true }`
  — **treat as success**; reload and show the card.
- Grants a one-time ink bonus, idempotent at the credit layer via `reference_id = cp-bonus-<userId>`.

**`GET /api/creator-program/discord/start?from=…`** — send `Accept: application/json` and you get
`200 { url }`; otherwise a `302`. `503 DISCORD_NOT_CONFIGURED` when the env is missing. `from` is
signed into a 5-minute state JWT (`aud: 'discord-oauth-state'`).

**`GET /api/creator-program/discord/callback`** — no `requireAuth` (identity rides the signed
state). Writes `cp_discord_id` / `cp_discord_username`, then 302s back to the app with
`?discord=linked|taken|error`. `taken` = the `ux_cp_discord` unique index fired.

**`POST /api/creator-program/attach-wallet`** — body `{ address }` for the **pasted** path (no
signature; this is the primary UI path since changelog `1366`).

| Status | Code | Meaning |
|---|---|---|
| 200 | — | `{ success:true, walletAddress }` (lowercased) |
| 400 | `ADDRESS_INVALID` | fails `viem` `isAddress(strict)` — EIP-55 aware, EVM only |
| 403 | `NOT_A_MEMBER` | not joined |
| 403 | `POINTS_TOO_LOW` | `points < 100` |
| 409 | `WALLET_IS_ACCOUNT` | that address is someone else's login wallet |
| 409 | `WALLET_TAKEN` | `ux_cp_wallet` — one address across all accounts |

The address is trimmed before validation (`attach-wallet.js:90`) because pasted addresses routinely
carry whitespace. **Members cannot edit it afterwards** — the UI sends them to a Discord ticket.

**`POST /api/creator-card/mint-reminder`** — body `{ optIn: boolean, email? }`.
- 200 `{ success:true, optedIn, email, synced }`
- 400 `EMAIL_REQUIRED` / `EMAIL_INVALID`
- Postgres is written first; Brevo sync fails soft.

> **CORS is irrelevant to us** — mobile calls PH server-to-server through its own proxies. Worth
> knowing anyway: no `api/creator-program/*` route handles `OPTIONS` (all seven 405), so a direct
> browser call would have been a problem. `api/creator-card/*` do handle it, origin-allowlisted via
> `ALLOWED_ORIGINS`.

### 3.4 Database (PH Postgres — we never touch it directly)

`point_transactions` (`009_user_points.sql:30-44`): `id`, `user_id`, `amount`, `type`,
`reference_id`, `balance_after`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`; indexes on user /
reference / type, plus the partial unique index quoted in §1. `user_points` is `(user_id PK,
balance, updated_at)`.

Creator Program columns live on **`user_credits`** — 12 of them across migrations 010 / 020 / 021:

```sql
is_creator_program_member, creator_program_bonus_claimed, creator_program_joined_at,
creator_program_qualified_at, cp_wallet_address, cp_discord_id, cp_discord_username,   -- 010
cp_x_handle, cp_card_claimed_at,                                                        -- 020
cp_mint_reminder_email, cp_mint_reminder_opt_in_at, cp_mint_reminder_synced_at          -- 021

CREATE UNIQUE INDEX ux_cp_wallet  ON user_credits(cp_wallet_address) WHERE cp_wallet_address IS NOT NULL;
CREATE UNIQUE INDEX ux_cp_discord ON user_credits(cp_discord_id)     WHERE cp_discord_id     IS NOT NULL;
```

There is **no** task-completion table, no tier column, no submissions table. Completion is *only* a
`point_transactions` row. The tier is computed client-side and never stored.

### 3.5 Flags and env (PH side, already on in production)

`ENABLE_CREATOR_CARD=true` · `ENABLE_CREATOR_PROGRAM=true` · `VITE_ENABLE_CREATOR_CARD=true` ·
`DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `DISCORD_OAUTH_REDIRECT` set · `JWT_SECRET` ·
`PUBLIC_APP_ORIGIN` (default `https://www.panelhaus.app`).

**`Comic-Pro2/api/_lib/clerk.js:31-40` already lists `https://m.panelhaus.app` and
`http://localhost:3002` in `DEFAULT_AUTHORIZED_PARTIES`** — a mobile-minted Clerk token verifies
against PH with no change. This is the single fact that makes the whole integration a proxy job.

### 3.6 The card itself

`CreatorCard.jsx` (255 lines) + `creatorCard.css` (485 lines): portrait 5:7, foil ring, holographic
sweep, scrim ramp, points-as-hero, four pips, tier chrome steel → cyan → animated gold. The CSS is
self-contained apart from `--radius-panel` and `--color-surface-border`, plus a Google-Fonts
`@import` at `creatorCard.css:17` for Space Grotesk + JetBrains Mono.

Art is **dealt, not chosen** — `cardArt.js` FNV-1a-hashes the internal user id over a pool of 16
PNGs in `Comic-Pro2/public/cards/` (5.1 MB total). `CARD_ZOOM = 20` is a **floor, not a default**:
the scenes have a wordmark baked in and the ~20 % crop is what pushes it out of frame. `memberId` is
passed `null` at both desktop call sites, so `MEMBER #` never renders.

---

## 4. Comic-Pro2 edits (2 files, ~6 lines)

Everything else works untouched. These two do not.

### 4.1 Let the Discord claim return to mobile

`discord/start.js:42` accepts `from ∈ {card, creators}` only, and `callback.js:53-56` redirects to
`APP_ORIGIN` either way. A mobile user who claims today lands on PH web, whose `MobileBlocker`
bounces them to `m.panelhaus.app` **dropping the query string** — the claim persists, but they
arrive at the mobile home screen with no confirmation and no open card.

**`api/creator-program/discord/start.js:42`**

```js
// was: const from = req.query?.from === 'card' ? 'card' : 'creators';
const from = ['card', 'mobile'].includes(req.query?.from) ? req.query.from : 'creators';
```

**`api/creator-program/discord/callback.js:17` and `:53-56`**

```js
const MOBILE_ORIGIN = process.env.PUBLIC_MOBILE_ORIGIN || 'https://m.panelhaus.app';
…
returnTo = (result) =>
  decoded.from === 'mobile' ? `${MOBILE_ORIGIN}/?creatorCard=1&discord=${result}`
  : decoded.from === 'card' ? `${APP_ORIGIN}/app?creatorCard=1&discord=${result}`
  :                           `${APP_ORIGIN}/creators?discord=${result}`;
```

`from` still rides inside the **signed** state token and still resolves to one of three hardcoded
origins, so the open-redirect property the original comment protects is preserved.

### 4.2 Return the card-art seed

`artForUser()` hashes the **internal** user id, which mobile has no way to know. Deriving it from
the Clerk email would be an assumption — and wrong for wallet-first accounts.

**`api/creator-card/state.js`**, in the 200 response object:

```js
// The card scene is dealt by hashing the internal user id (cardArt.js). Mobile
// has no way to know that id, so ship it rather than have the two apps deal
// different scenes to the same person.
artSeed: userId,
```

No new query — `userId` is already in scope from `requireAuth`.

---

## 5. Work in panel_shaq

### 5.1 Proxy routes — 6 new files (`api/`), 19 → 25 functions

Copy `api/referral-code.ts` verbatim for GETs and `api/referral-link.ts` for POSTs. That shape is:

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Normalize to the non-redirecting origin (apex panelhaus.app 307s to www, which
// strips the Authorization header on the cross-origin hop). Force www.
const PH_BASE = (
  process.env.PANELHAUS_API_BASE || "https://www.panelhaus.app"
).trim().replace("://panelhaus.app", "://www.panelhaus.app").replace(/\/+$/, "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = (req.headers["authorization"] as string) || "";
  if (!auth) return res.status(401).json({ error: "Authentication required" });
  try {
    const r = await fetch(`${PH_BASE}/api/…`, { headers: { Authorization: auth }, redirect: "manual" });
    if (r.status === 0)
      return res.status(502).json({ error: "Upstream redirect. Set PANELHAUS_API_BASE to the non-redirecting origin (https://www.panelhaus.app)" });
    return res.status(r.status).json(await r.json().catch(() => ({})));
  } catch {
    return res.status(502).json({ error: "…" });
  }
}
```

**No `verifyToken`** (PH's `requireAuth` is the authority — the existing six PH proxies all do a
presence check only), **no `export const config`**, **no CORS**. Same-origin from the SPA.

| New file | Method | Upstream |
|---|---|---|
| `api/creator-card-state.ts` | GET | `/api/creator-card/state` |
| `api/creator-card-action.ts` | POST | `/api/creator-card/action` |
| `api/creator-program-join.ts` | POST | `/api/creator-program/join` |
| `api/creator-discord-start.ts` | GET | `/api/creator-program/discord/start?from=mobile` |
| `api/creator-attach-wallet.ts` | POST | `/api/creator-program/attach-wallet` |
| `api/creator-mint-reminder.ts` | POST | `/api/creator-card/mint-reminder` |

Route-specific notes:

- **`creator-discord-start.ts`** must send `Accept: application/json` upstream and **pin
  `from=mobile` server-side** — never read it from the query — so PH returns `{url}` rather than a
  302 the proxy would have to chase, and so the return destination cannot be influenced by the
  client.
- **`creator-program-join.ts`** must forward PH's **409** body through unchanged; the client treats
  `ALREADY_JOINED` as success.
- Remember the repo rule (`CLAUDE.md`): API routes are **deliberately self-contained**. Do not
  factor these six into a shared helper module — Vercel cannot share local files between functions.

### 5.2 Client service — `src/services/creatorCard.ts`

Modelled on `src/services/referral.ts`: plain `fetch` + `getClerkToken()` from
`src/services/clerkToken.ts`, gated on `isClerkEnabled()`.

**Never `apiPost`.** It opens the Clerk sign-in modal and throws for signed-out non-BYOK users,
fires `generation_started`, and runs an ink precheck. `src/services/shipClaim.ts:253-254` documents
avoiding it for exactly this reason.

Carry over two things from desktop:

- **Stale-while-revalidate**, a module-level cache mirroring `CreatorCardModal.jsx:178` so reopening
  the overlay is instant and the skeleton shows only on a genuine first load.
- **The 401 retry** (`CreatorCardModal.jsx:469-484`: up to 3 attempts, 1500 ms apart). It exists
  because the Clerk token is not ready on a cold boot, and the Discord return is exactly a cold boot.

Exports: `fetchCardState()`, `recordCardAction(action)`, `joinProgram()`, `startDiscordClaim()`,
`attachMintWallet(address)`, `setMintReminder(optIn, email?)`, `getCachedCardState()`.

### 5.3 Components — `src/components/creatorCard/`

**`CreatorCard.tsx` + `creatorCard.css`** — near-verbatim port. Keep `safeCssUrl` (it guards the
`url('…')` prop boundary, and matters *more* here because we are keeping the user upload). Three
edits:

1. Drop the `onPointerMove` / `onPointerLeave` tilt + holo tracking. There is no hover on touch and
   the card would stick at whatever tilt the last tap produced. Keep the always-on light sweep.
2. Define `--radius-panel` and `--color-surface-border` locally — the only two external vars.
3. **Delete the `@import` at `creatorCard.css:17`** and add `JetBrains+Mono:wght@500;700` to the
   existing Google-Fonts `<link>` in `index.html:50`/`:53`. Space Grotesk is already loaded there.
   This is not cosmetic: a cross-origin `@import` is a render-blocking second fetch **and** a hazard
   for `html-to-image`, which must inline stylesheets to rasterise the card for sharing.

Also keep, verbatim: the `color-mix(in srgb, …)` usage. Desktop uses it instead of Tailwind opacity
modifiers because its theme tokens are hand-written CSS variables; "simplifying" it silently breaks
the treatment.

**`cardArt.ts`** — verbatim `CARD_ART` + `artForUser` (FNV-1a over the seed). Copy the 16 PNGs from
`Comic-Pro2/public/cards/` to `public/cards/`. They must be **same-origin**: the PNG export fetches
the art and inlines it as a `data:` URL, so a cross-origin source would fail CORS. Only the dealt
scene is ever fetched at runtime, so the 5.1 MB is repo/deploy weight, not user bandwidth.

**`CreatorCardSteps.tsx`** — the seven rows with copy verbatim (see §8), plus:
- the dynamic refer-row hints — `Click to copy your link · {N} of 2 joined` (todo) and
  `{N} joined, click to copy your link again` (done), with the count emphasised once `> 0`;
- the refer-row subHint `+10 more points for every friend after the first two`;
- the locked-state hint override `Claim your card first` /
  `Claim your card first. Discord isn't configured yet`;
- **every desktop `title=` tooltip promoted to visible text.** Seven of them carry real information
  and are unreachable on touch.
- mobile row layout with ≥44 px touch targets.

Row-state machine, ported verbatim (`CreatorCardModal.jsx:636-662`) — order matters:

```js
if (isDone(step))                               return 'done';   // paid rows never grey out
if (step.kind === 'soon')                       return 'soon';   // outranks 'locked'
if (step.id !== 'claim_card' && cardLocked)     return 'locked';
if (step.kind === 'go')                         return 'go';
if (step.id === 'claim_card' && !discordReady)  return 'soon';
if (step.id === 'refer_friends')                return 'copy';   // clickable at 0 referrals
return 'todo';
```

Honor asks are **optimistic**: light the pip, POST in the background, and on failure **reload server
truth** rather than restoring a snapshot — `CreatorCardModal.jsx:675-682` records that the old
snapshot-revert could resurrect a pre-sweep state and wipe awards that had landed in between.

**`MintWalletSheet.tsx`** — paste → `Review` → confirm → receipt, ported from `MintWalletInput.tsx`
with copy verbatim. The address is shown **in full, never truncated** — it is the only place a member
can catch a wrong address for an unrecoverable NFT, and the checksum guard is partial (an
all-lowercase address carries nothing to verify against). Built on the existing bottom-sheet pattern
(`BuyCreditsSheet` / `ShipClaimSheet`). Paste path only; no wallet connector on mobile.

**`GtdUnlockCelebration.tsx`** — ported. Honour both desktop gates: `points >= gtdPointsRequired`
**and** no wallet attached (the scene exists to *ask* for a wallet). `prefers-reduced-motion` is a
real branch, not a dimmer — same composed scene, no movement, no confetti.

**`CardArtEditor.tsx`** — upload + framing slider, from `CreatorCardModal.jsx:351-417` and `:277-304`.
Keep the downscale ladder `[{max:1800,q:0.9},{max:1400,q:0.88},{max:1200,q:0.85}]` and the zoom clamp
`[CARD_ZOOM=20, CARD_ZOOM_MAX=60]`, clamped **on read as well as write**. The floor is load-bearing.
**Replace the `group-hover` reveal with a visible tap affordance** — on touch the desktop overlay is
invisible and the feature is undiscoverable.

**`CreatorCardScreen.tsx`** — the host:
- **Non-member** → the join pitch only. The asks list is deliberately **not rendered**; a column of
  rows they cannot action reads as broken, and nothing should imply they are already participating.
- **Member** → card, progress (`{completed} of 4 asks`, `{pct}%`, bar), the seven rows, then the
  wallet + mint-reminder band.
- The wallet band gates on **`joinReady`**, not just points — the card runs on `ENABLE_CREATOR_CARD`
  while attach-wallet requires `ENABLE_CREATOR_PROGRAM`, and a prod with only the first flag on would
  render a button whose endpoint 404s.

### 5.4 "Post your card" — native share sheet

Render the card node with **`html-to-image`** — already a dependency (`package.json`, used at
`src/services/comicPageExport.ts:9`). Follow desktop's two required steps or the export loses its
background:

1. `inlineArt()` — fetch the art URL and swap in a `data:` URL. The art is painted by
   `background-image: var(--art)` on a **pseudo-element**, and DOM rasterisers have to re-fetch and
   re-embed such backgrounds themselves; that is the step that was dropping the art from desktop
   exports.
2. `nextPaint()` — wait two `requestAnimationFrame`s so the browser paints the swapped-in art before
   rasterising.

Then hand the blob to the existing **`shareImage(blob, filename)`** in `src/from-meme/memeShare.ts`.
It already implements the correct mobile path — including the subtle guard for browsers that support
`navigator.share` with files but do not expose `navigator.canShare` — and returns
`"shared" | "downloaded" | "cancelled"`.

**One surgical edit to `memeShare.ts`:** add an optional trailing `surface` parameter (default
`"meme"`) so it reports `markShipped(\`${surface}_share\`)`. Existing call sites are unchanged, and
the repo invariant that `"share_completed"` appears only in `shipClaim.ts` (plus the deliberate
`makeComic.ts` exclusion) is preserved.

Crediting the +15:

| Result | Credit? | Why |
|---|---|---|
| `"shared"` | **yes** | the user picked a target — the mobile equivalent of desktop's "the X composer opened" |
| `"cancelled"` | no | they backed out |
| `"downloaded"` (fallback) | not yet | show a `Post on X` button that opens the X intent and credits on tap — desktop's Download PNG alone never credits either |

This is deliberately *stricter* than desktop, whose `window.open() !== null` heuristic is unreliable
in mobile webviews and would have credited on a popup-blocked no-op.

### 5.5 Wiring — exact insertion points

| File | Line | Change |
|---|---|---|
| `src/components/AccountSection.tsx` | `152` | Entry row beside `<ReferralCard />`, inside `<SignedIn>` — shows tier + points, opens the overlay |
| `src/App.tsx` | `~131` | `const CreatorCardScreen = lazyWithReload(() => import("./screens/CreatorCardScreen"))` |
| `src/App.tsx` | near `855-868` | Host the overlay + `MintWalletSheet`, beside `<BuyCreditsSheet/>` / `<ShipClaimHost/>` |
| `src/App.tsx` | mount effect | Read `?creatorCard=1&discord=…` → open the overlay, toast `linked` / `taken` / `error`, then `history.replaceState` the params away (mirrors `Toolbar.jsx:106-125`) |
| `index.html` | `50`, `53` | Add `JetBrains+Mono:wght@500;700` to the existing font `<link>` |
| `src/from-meme/memeShare.ts` | `shareImage` | Optional `surface` param, default `"meme"` |

**A full-screen overlay, not a tab** — the `GifEditorScreen` pattern (`onOpenGifEditor` / `onBack`
state in `App.tsx`). It keeps the card out of `TAB_ORDER` so a swipe cannot land on it mid-flow,
leaves the 6-slot bottom-nav pill alone, and returns cleanly to Settings. The Discord return opens
the same overlay state, so there is exactly one code path in.

Everything gated on `isClerkEnabled()`, like `ReferralCard`. The Clerk-free `/c/from-meme` root is
untouched.

Toast the `?discord=` outcomes with desktop's wording:
- `taken` → `That Discord account is already linked to another Panel Haus account`
- `error` → `Discord connect failed: try again`

### 5.6 Analytics

Desktop fires **zero** analytics from the entire Creator Program — no `track` / `gtag` / `posthog`
call sites in `src/components/CreatorCard/`, `src/pages/CreatorProgramV2/` or `useAttachWallet.js`;
its telemetry is server-side `point_transactions` only. Mobile has a real funnel through
`src/services/analytics.ts`, so add events in the existing `snake_case` `<noun>_<past-tense-verb>`
convention (21 events today):

`creator_card_opened` · `creator_program_joined {bonus}` · `creator_card_action {action}` ·
`creator_card_claim_started` · `mint_wallet_attached` · `creator_card_shared {result}`

Fire-and-forget through `track()`; never block UX on it.

---

## 6. Divergences from desktop — stated, not discovered later

| Desktop | Mobile | Why |
|---|---|---|
| Pointer tilt + holo cursor tracking | dropped | no hover on touch; it would stick at the last tap's angle |
| Hover-revealed upload overlay, 7 `title=` tooltips | visible affordances / inline text | unreachable on touch |
| Credit on `window.open() !== null` | credit on the share resolving | the heuristic is unreliable in mobile webviews |
| "Make something" dispatches `open-ai-panel-with-tab` | closes the overlay → mobile Director generate flow | same intent, mobile surface |
| Contest opens `discord.gg/panelhaus` | identical | no change |
| `/creators` marketing page | not ported | out of scope by decision — and it carries two known copy bugs: a non-existent "Author tier" in the FAQ, and a hardcoded "only 2,400 spots, first come first served" |

### The two things that cannot sync, and why

**localStorage is origin-scoped**, so `m.panelhaus.app` and `www.panelhaus.app` never share it.
Desktop keeps two pieces of card state there.

- **Custom art / zoom will be per-device.** `creator_card_art:<userId>` and
  `creator_card_zoom:<userId>` do not travel. A user who uploads on desktop still sees their dealt
  scene on mobile. This is exactly the limitation desktop's own comment flags — *"the right one is a
  server field on the creator record, not localStorage, so the card follows the account across
  devices."*
  **Decision for v1:** ship as localStorage — exact desktop parity, zero schema change.
  **⚠️ This is the one place the "shared across both apps" promise does not hold.** Closing it means
  a PH migration adding `cp_card_art` / `cp_card_zoom` to `user_credits`, an endpoint to write them,
  and moving *desktop* onto them too. Worth doing as a follow-up if the divergence is felt.
- **The GTD celebration can play a second time on mobile** (`creator_card_gtd_celebrated:<seed>` is
  also localStorage). **This one is benign:** desktop already suppresses the scene once a wallet is
  attached, so the only replay case is someone who crossed 100, watched it, and did *not* attach —
  which is precisely the person the scene exists to nudge.

---

## 7. Verification

1. `npm run lint` (`tsc --noEmit`) — the only check in this repo. There are no tests.
2. **Local setup.** PH on `:3001`, panel_shaq via `./dev.ps1` on `:3002`, **same dev Clerk
   instance**, `PANELHAUS_API_BASE=http://localhost:3001`. Set PH's
   `PUBLIC_MOBILE_ORIGIN=http://localhost:3002`, and add the local callback to the **Discord
   developer portal's** redirect allowlist (see §9 — this needs dashboard access).
3. **Reset a test account** (run in Comic-Pro2 — these read `POSTGRES_URL` from `.env.local`, which
   is production, so read the host they print):
   ```bash
   node scripts/dev/creator-program-optout.js <email> --apply   # leave the program
   node scripts/dev/reset-card-actions.js     <email> --apply   # clear the card steps
   ```
   Expect `contest` and `first_creation` to re-tick immediately on the next load — they derive from
   permanent history and no script un-does that. That is the sweep working, not a broken reset.
4. **Join on mobile** → `check-user-points.js` shows membership and the bonus credits; the desktop
   card immediately shows joined. Join again → `409`, treated as success, no double grant.
5. **Claim on mobile** → Discord → returns to `m.panelhaus.app/?creatorCard=1&discord=linked`, the
   overlay reopens, the claim ticks, and every already-satisfied step (`first_creation`,
   `refer_friends`, `contest`) backfills **in that same load**. Needing a second open is a
   regression against the `SWEEP_ORDER` contract.
6. `follow_x` / `share_card` → +20 / +15, visible on desktop after a reload. **Cancel** the share
   sheet → no credit.
7. Generate one image on a fresh mobile account → reopen the card → `first_creation` ticks. This
   proves `credit_reserve` satisfies the verify.
8. Cross-check every number against `node scripts/dev/check-user-points.js`. **That ledger is the
   tiebreaker** whenever the UI and expectations disagree.
9. At ≥100 points, paste a mint wallet → `set-creator-wallet.js <id>` shows it and
   `creator-card-report.js --export` has it in the `wallet` column. Paste the same address from a
   second account → `WALLET_TAKEN`. Paste a checksum-broken address → `ADDRESS_INVALID`. Paste one
   with a leading space → accepted (trimmed).
10. **Negative paths.** POST `creator-card-action` as a non-member → `403 NOT_MEMBER`; as an
    unclaimed member → `409 CLAIM_REQUIRED`. Confirm with `check-user-points.js` that **no**
    `point_transactions` row appeared for either.
11. Card art matches desktop for the same account (proves `artSeed`). Export the PNG → the art is
    present, not a blank gradient (proves `inlineArt` + `nextPaint`).
12. Unset `VITE_CLERK_PUBLISHABLE_KEY` → nothing mounts. `/c/from-meme` unaffected. Existing
    `shareImage` callers still report `meme_*` surfaces.

---

## 8. Copy appendix — verbatim strings

Reproduce these exactly; several are promise copy that must match desktop word for word.

**Join pitch** (`CreatorCardModal.jsx:1308-1352`)
```
Claim your Creator Card
The Creator Card is your place in the Panel Haus Creator Program.
  ✓ Your own card art, dealt when you join
  ✓ Points for every ask you complete
  ✓ Better mint position as the card levels
[ Join the Creator Program ]      (busy: "Joining…")
Free to join.
```
Disabled-button title when `!joinReady`: `The Creator Program isn't open yet`.
Join toasts: `Welcome in, +{N} credits` when a bonus landed, else `Welcome in`.

**Locked card face** (`CreatorCard.jsx:197-201`)
```
?
Claim to reveal
```
aria-label: `Card locked, claim it to reveal your scene`

**Sweep toasts** (`CreatorCardModal.jsx:526-530`)
`Card claimed, welcome in` for `claim_card`, otherwise `+{points} points`.

**Action-failure toasts** (`:729-736`)
`CLAIM_REQUIRED` → `Claim your card first` · `refer_friends` → `{N} of 2 so far` · otherwise
`Not completed yet`.

**Referral copy** — link format `https://panelhaus.app/?ref=<code>`; copy toast
`Link copied, send it to a friend`; not-ready toast
`Your referral link isn't ready yet, reopen in a moment`.

**Mint wallet band — locked**
```
Mint wallet
Unlocks at {gtdPointsRequired} points. {N} more to go. Limited spots available.
```
Both numbers are derived. **Do not reintroduce named earners here** — the previous copy ended
"Enter a contest (+20) or make something (+15)", which hardcoded two action names and two point
values in prose and went stale the moment the economy moved.

**Mint wallet band — actionable**
```
Secure your spot   limited spots available   The wallet your Smudgie gets sent to.
[ Add mint wallet ]
```

**Mint wallet band — settled**
```
Mint wallet   ✓ 0x<full 42-char address>  [copy]
Locked in. To change it, open a Discord ticket.
```
Copy toast: `Mint wallet copied`.

**Mint wallet sheet** (`MintWalletModal.jsx:84-95`, `MintWalletInput.jsx`)
```
Where should your Smudgie mint?
This is the address your Smudgie will be sent to. It cannot be changed later without a support
ticket, so use a wallet you control and intend to keep.

Wallet address
[ Paste your wallet address (0x…) ]            maxLength 64
[ Review ]
error: Not an Ethereum address. It should start with 0x and be 42 characters.
No sign in, no transaction, no gas.

— confirm —
Check this carefully.
[ Yes, lock it in ]   (busy: "Locking it in…")   [ Back ]

— receipt —
Mint wallet locked in
Your Smudgie will be sent here. To change it you will need to open a support ticket, so keep this
wallet.
[ Done ]
```
Attach toast: `Mint wallet locked in: 0xabcd…1234` (5 s).

**Mint reminder band**
```
REMIND ME BEFORE THE MINT
[ ] Email me when the Smudge mint goes live
[ you@example.com ]   [ Save | Update ]
✓ You're on the list, we'll email you before the mint.
```
Toasts: `You're on the list` / `Reminder turned off`.

**GTD unlock celebration**
```
seal:      PANEL HAUS / MINT / SPOT SECURED
headline:  Your mint spot is guaranteed
subline:   {points} points, you're past the line. Lock in the wallet your Smudgie should land in.
           The mint itself comes later.
cta:       Add your mint wallet
secondary: I'll add it later
```
aria-label: `You have earned a guaranteed mint spot`.

**Share caption** (`CardStudioModal.jsx:54-62`) — three lines; **lines 2 and 3 are built in code,
never inside the rotating hook**, so a new hook can never drop the handle, the points or the link:
```
<rotating hook>                                  ← 30 of them, src/data/creatorCardCaptions.js
@handle · 1,234 points and climbing.
Make yours → panelhaus.app/creators
```
Hook rules: no emoji, no em dashes, one line, **no promises about the mint**. Never repeats twice in
a row.

---

## 9. Open items and unverified facts

**Blocks end-to-end testing of the claim:**
- The **Discord developer portal** redirect allowlist must include the local callback
  (`http://localhost:5173/api/creator-program/discord/callback` already exists for PH dev) and,
  for a real mobile test, whatever `DISCORD_OAUTH_REDIRECT` production uses. That is dashboard
  access, not code.

**Unverified from either repo (do not assume):**
- Production values of `CREATOR_PROGRAM_BONUS_CREDITS` / `CREATOR_PROGRAM_PAID_BONUS_CREDITS`.
  `.env.example:805` claims both are 20 in production; `.env.local` omits them, so locally free
  falls back to `FREE_TIER_CREDIT_AMOUNT` (30) and paid to 20. Only affects the "+N ink" number in
  the join toast.
- Whether migrations 010 / 020 / 021 are actually applied to the shared **production** database.
  There is no migration-state table. This is not paranoia: changelog `1299` records that migration
  010's header comment contained semicolons, the `;`-splitting runner choked, and
  `user_credits.is_creator_program_member` **never existed in production** until it was caught.
- `BREVO_MINT_LIST_ID` in production (affects only the Brevo sync, not the stored consent — Postgres
  is written first and Brevo fails soft).

**Known PH-side gap, noted not fixed:** `api/creator-program/join.js` has **no rate limit and no
Discord requirement** — any authenticated account can join and take the ink bonus. The 2026-07-30
referral-farm post-mortem lists "rate-limit or gate the Creator Program join bonus at the endpoint"
as **not implemented**. Mobile adds a second door to the same unrated endpoint. Not a blocker, but
worth knowing before this ships.

---

## 10. Out of scope

- PH's `/creators` marketing page (`CreatorProgramV2/index.jsx`, 904 lines + 718 CSS).
- `api/creator-program/submit.js` (Phase B, dormant — `DISCORD_SUBMISSIONS_WEBHOOK` unset) and
  `api/creator-program/admin/grant.js`.
- The retired ship-claim: `api/creator-application.ts`, `src/services/shipClaim.ts`,
  `ShipClaim*.tsx`, and the `creator:application:*` / `creator:applications` Redis namespace.
- Any change to how points are awarded, verified or valued — that stays PH-owned.

---

## 11. Discrepancies found while reading (not fixed here)

1. `Comic-Pro2/documentation/guides/CREATOR_CARD_TESTING_GUIDE.md:275,351` says a first creation is
   **+30**. The code says **15** (`api/_lib/creatorCard.js:119`). The doc is stale; mobile follows
   the code.
2. `join.js:108` reports `bucket: 'subscription'` for free-tier joins, but `creator_program_bonus`
   is in `ROLLOVER_GRANT_TYPES` (`api/_lib/db.js:529`), so the credits actually land in the
   **booster** bucket. Cosmetic — mobile shows the amount, not the bucket.
3. The `/creators` FAQ references an **"Author tier"** that does not exist (tiers are Starter / Plus
   / OG), and the page's "joined this week" counter is **animated, not real**. The scratch-off
   promises "+100 bonus points on your first Smudge post"; no code path awards it. Three more
   reasons not to port that page as-is.

---

## 12. Source map — where to look in Comic-Pro2 if this doc is not enough

| Concern | Path |
|---|---|
| Action table, point values, the two gates | `api/_lib/creatorCard.js` |
| CP data access, `GTD_POINTS_REQUIRED` | `api/_lib/creatorProgram.js` |
| The one load call + the sweep | `api/creator-card/state.js` |
| Click endpoint + status codes | `api/creator-card/action.js` |
| Join + ink bonus | `api/creator-program/join.js` |
| Discord OAuth | `api/creator-program/discord/{start,callback}.js` |
| Wallet attach, three paths | `api/creator-program/attach-wallet.js` |
| Clerk auth + `authorizedParties` | `api/_lib/clerk.js` |
| The card face + tiers | `src/components/CreatorCard/CreatorCard.jsx`, `creatorCard.css` |
| The whole tasks UI | `src/components/CreatorCard/CreatorCardModal.jsx` (2055 lines) |
| Share studio, export, caption | `src/components/CreatorCard/CardStudioModal.jsx`, `src/data/creatorCardCaptions.js` |
| Wallet UI | `src/components/CreatorCard/MintWallet{Modal,Input}.jsx` |
| Celebration | `src/components/CreatorCard/GtdUnlockCelebration.jsx` |
| Schema | `scripts/migrations/{009_user_points,010_creator_program,020_creator_card_handle,021_mint_reminder_optin}.sql` |
| Allowlist derivation | `documentation/business/CREATOR_PROGRAM_GTD_FCFS_ALLOWLIST.md`, `scripts/dev/creator-card-report.js` |
| Testing + dev scripts | `documentation/guides/CREATOR_CARD_TESTING_GUIDE.md` |
| Operator runbooks | `CLAUDE.md:199-274` (GTD mint wallets), `CLAUDE.md:295-340` (applications ops) |
| Key changelogs | `1299` (card v1), `1300` (server sweep), `1317` (consent gate), `1340` (claim prerequisite), `1355`/`1366` (mint wallet, sign → paste), `1356` (celebration) |
