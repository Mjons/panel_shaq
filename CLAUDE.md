# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Panel Haus Mobile** (formerly "Panel Shaq"; PWA name: **Panelhaus**) is a mobile-first, AI-powered comic creation studio. Users write a story, generate comic panels with Gemini, manage reusable assets (characters/environments/props/vehicles), lay panels out into pages, add speech bubbles, and export. There is a companion **desktop** app at panelhaus.app — this repo is the mobile/tablet half and exports `.comic` packages the desktop app can import.

Frontend: React 19 + Vite 6 + Tailwind CSS v4 (config-in-CSS via `@theme`). Backend: Vercel serverless functions in `api/`. AI: Google Gemini via REST. Usage metering + email capture: Supabase. Product analytics: Vercel Analytics + PostHog.

## Commands

```bash
./dev.ps1            # THE dev command — plain Vite on :3002, serves /api/* in-process, loads .env.local server vars
npm run dev          # Vite dev server on :3000 — serves /api too, but does NOT load .env.local server vars (so credit/Clerk routes 401)
npm run build        # vite build → dist/
npm run preview      # preview the production build
npm run lint         # tsc --noEmit — this is the ONLY check; there is no test suite or ESLint
npm run clean        # rm -rf dist
```

- **Use `./dev.ps1` for local dev.** panel_shaq serves its own `/api/*` **in-process** via the `vercelApiDev` plugin in `vite.config.ts`, so **`vercel dev` is NOT needed** (the old `npm run dev:full` script has been removed). `dev.ps1` runs plain Vite on **:3002** (an allowed Clerk `authorizedParty` on the PH side) and first loads `.env.local` into the process so the `api/` handlers see server vars (`CLERK_SECRET_KEY`, `PANELHAUS_API_BASE`, `GEMINI_API_KEY`). Plain `npm run dev` serves `/api` too but does **not** export those server vars, so anything hitting PH (credits/referral/auth) will fail; use it only for pure-frontend work.
- **There are no tests.** "Lint" means TypeScript type-checking (`tsc --noEmit`). Run it before considering work done.

## Environment variables

Client (must be `VITE_`-prefixed and present **at build time** — they're baked into the bundle):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — anonymous auth, usage display, email capture. Optional; app degrades gracefully if absent.
- `VITE_MEMEGEN_URL` (default `https://memegen.panelhaus.app`) — "make another meme" target for the MemeGen meme-handoff receiver (`src/from-meme/`); optional.
- `VITE_MEME_ADMIN_SECRET` — unlocks the admin calibrator. In **prod**, set a private value to enable it, or **leave empty to disable admin entirely** (no public fallback). In **dev** it defaults to `panelshaq-admin`.
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key (`pk_live_…`), the **same Clerk instance as Panel Haus** (panelhaus.app) so accounts are shared. Optional: if unset, auth + shared credits are **disabled** and the app runs on the legacy anon/BYOK path (graceful degradation). See `documents/CLERK_CREDITS_INTEGRATION_BUILD_PLAN.md`.

Server (Vercel env, runtime):

- `PANELHAUS_API_BASE` (default `https://www.panelhaus.app`) — upstream that **both** the `api/handoff-consume` proxy **and** the shared-credit calls (`/api/credits/reserve|refund|balance`) hit server-to-server. Must be the **non-redirecting** origin (`www`): the apex 307s to `www` and the `Authorization` header is stripped on cross-origin redirects.
- `CLERK_SECRET_KEY` — server-side Clerk key (`sk_live_…`) used by the `api/` routes to verify the Bearer token (`@clerk/backend verifyToken`). When unset, the routes fall back to the legacy daily limiter (no Clerk gate / no credits).
- `INK_COST_IMAGE_FLASH` / `INK_COST_IMAGE_PRO` (default `1` / `2`) — ink charged per image generation (`generate-image`, `final-render`), chosen by the user's Settings image model (`flash`/`pro`, sent in the request body). `INK_COST_TEXT` (default `1`) covers the text/vision routes.
- `GEMINI_IMAGE_MODEL_FLASH` / `GEMINI_IMAGE_MODEL_PRO` (default `gemini-2.5-flash-image` / `gemini-3.1-flash-image-preview`) — the Gemini model used per tier; mirror Panel Haus's `GEMINI_FLASH_MODEL` / `GEMINI_PRO_MODEL`.
- `GEMINI_API_KEY` — the shared key used for signed-in (shared-ink) and legacy "hosted" generation; also the fallback when a BYOK user hasn't supplied their own.
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — service-role client for the **legacy** anon usage limiter (used only when Clerk is unconfigured). Must be created with `{ auth: { autoRefreshToken: false, persistSession: false } }` to bypass RLS correctly.
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — the GTD ship-claim store (`api/creator-application`). Use the **same values as Panel Haus** so both apps share one dedupe namespace (`creator:application:<identity>`) and one admin list (`creator:applications`). **Required in prod:** unset → the write path **fails closed** (`503 STORAGE_UNAVAILABLE`) so a missing var is loud instead of silently dropping every claim (it did exactly that for ~2h on 2026-07-14; see `CHANGELOG.md`). Optional overrides (defaults match PH): `CREATOR_APP_RATE_LIMIT_PER_HOUR=10`, `CREATOR_APP_MAX_CHARS=4000`, `CREATOR_APP_LIST_MAX=20000`, `CREATOR_APP_KEY_TTL_DAYS=365`.

Dev: `DISABLE_HMR=true` disables Vite HMR/file-watching (used in AI Studio to prevent flicker during agent edits — see `vite.config.ts`).

## Architecture

### State lives in the browser; the server is stateless

There is no app database for user content. `src/App.tsx` (`AppInner`) is the single source of truth and owns all top-level state, persisting it two ways:

> **Storage keys keep the `panelshaq_*` prefix on purpose.** The app was renamed from "Panel Shaq" to "Panel Haus Mobile", but all localStorage keys (`panelshaq_*`) and the IndexedDB databases (`panelshaq`, `panelshaq_projects`) were deliberately left unrenamed — they're storage namespaces, and renaming them would orphan every existing user's projects, vault, and settings. Do not "fix" them.

- **`usePersistedState`** (`src/hooks/`) — localStorage, for small data (story text, active tab, page layout, settings).
- **`useIndexedDBState`** (`src/hooks/`) — IndexedDB, for large data that would blow localStorage's ~5MB quota: **`panels` (base64 images), `vaultEntries`, `styleReferenceImage`**. Use IndexedDB for anything holding image data.

Named/saved projects are a separate IndexedDB store managed by `src/services/projectStorage.ts` (full projects in IndexedDB `panelshaq_projects`; a lightweight meta index in localStorage). App auto-saves the working project on an interval and on `beforeunload`.

### Auth + credits: shared Clerk account + shared ink (with BYOK + legacy fallback)

panel_shaq shares **one Clerk account and one ink balance** with Panel Haus (panelhaus.app). The whole integration is **gated on `VITE_CLERK_PUBLISHABLE_KEY`** — when it's unset the app runs exactly as before (legacy anon/BYOK). Full build doc: `documents/CLERK_CREDITS_INTEGRATION_BUILD_PLAN.md`. There are effectively three paths at generation time:

- **Signed-in (shared ink)** — `main.tsx` wraps the app in `<ClerkProvider>` (same instance as PH → apex-cookie SSO across `*.panelhaus.app`). It's a **soft gate**: the app opens freely and `apiPost` prompts Clerk sign-in only when a non-BYOK user triggers a generation. `apiPost` sends `Authorization: Bearer <clerk token>` (via the `src/services/clerkToken.ts` holder + `<ClerkTokenBridge/>`). Image routes (`generate-image`, `final-render`) **reserve ink** at `${PANELHAUS_API_BASE}/api/credits/reserve` before calling Gemini and **refund** on failure; PH Postgres is the single source of truth. Balance is read via the `api/credits-balance` proxy and shown as a nav chip + Settings "Account" section.
- **BYOK** — user pastes their own Gemini key in Settings (`panelshaq_settings.geminiApiKey`, sent as `x-api-key`). This **bypasses Clerk + credits entirely** (they pay Google). Unlimited, no ink.
- **Legacy (no Clerk configured)** — falls back to the old anonymous Supabase UID + daily limiter (`checkUsage`). The startup `EmailGate` is **retired** (commented out in `src/components/EmailGate.tsx` as a reversion backup); `SettingsScreen` still takes a legacy `appMode` prop.

`@clerk/clerk-react` (frontend) + `@clerk/backend` (route `verifyToken`) are the deps. Sign-in methods (Email + Google + MetaMask) are configured at the **shared Clerk dashboard**, instance-level. The `/c/from-meme` meme receiver stays **Clerk-free**.

> **Wallet sign-in (panel_shaq only).** Sign-in methods are instance-level (shared with panelhaus), so there's no dashboard toggle to change MetaMask for just this app. Clerk's native MetaMask button only works where an injected `window.ethereum` exists (MetaMask's in-app browser / desktop extension), so `src/clerkAppearance.ts` **shows it when a provider is present and hides it otherwise** (`socialButtonsBlockButton__metamask`/`__icon` → `display:none`, computed at load from `window.ethereum`). For plain mobile browsers (no provider), `src/components/WalletDeepLinkButton.tsx` shows an "Open in MetaMask" button that deep-links into MetaMask's in-app browser (via `src/services/wallet.ts` → `https://metamask.app.link/dapp/…?signin=wallet`), where the native button then appears; `App.tsx` auto-opens the sign-in modal on the `?signin=wallet` return. Auth is 100% Clerk, so the account + shared ink balance match panelhaus.app. This appearance is panel_shaq-only; panelhaus always shows MetaMask.

### MemeGen meme-handoff receiver (`/c/from-meme`) — a second root

This SPA has **no router**, so `src/main.tsx` branches on `window.location.pathname`: when it's `/c/from-meme` it renders `src/from-meme/FromMemeRoot.tsx` **instead of** `<App/>`, bypassing `EmailGate` entirely. This is the mobile half of MemeGen's "add text" handoff (desktop half is Panelhaus). Flow + reasoning: `documents/MEMEGEN_HANDOFF_AND_DESKTOP_UPSELL_STRATEGY.md`.

- **Consume:** `useHandoffPayload.ts` reads `?h=<token>` and POSTs same-origin to `api/handoff-consume`, a serverless proxy that calls `${PANELHAUS_API_BASE}/api/handoff/consume` server-to-server (the upstream 405s the cross-origin OPTIONS preflight, so a direct browser call fails — the proxy sidesteps CORS). Single-use → it caches the payload to `sessionStorage` and ref-guards against StrictMode double-consume. Dev stub: `?stub=1&template=<id>&img=&w=&h=`.
- **Editor (`MemeEditor.tsx`):** the meme image full-bleed, fitted to the viewport via `useFit.ts` (no scroll, aspect from the loaded image), with `TextZonesOverlay.tsx` captions on top. Users edit text, pick one of 5 fonts (`memeFontPresets.ts`), resize, move/rotate/resize (handles on the selected zone), and delete/restore. Export = a manual canvas flatten (`memeFlatten.ts` + `memeWatermark.ts`), then Share/Copy/Download (`memeShare.ts`). **Copy/Share need a secure context** (HTTPS/localhost) — they fall back to download on plain-HTTP LAN.
- **Caption positions** live in the generated, committed registry `src/data/memeTextZones.ts` (56 templates, normalized 0–1, keyed by `templateId`). Generated once by `scripts/generateMemeTextZones.mjs` from the desktop repo — **do not re-run it after hand-calibrating; it overwrites everything.** Template images for the admin tools live in `public/templates/`.
- **Admin calibrator/gallery:** `?admin=<VITE_MEME_ADMIN_SECRET>` (+ `&gallery=1`) opens `AdminCalibrator.tsx` / `AdminGallery.tsx` to position zones and "Copy JSON" back into the registry. See `documents/MEME_TEMPLATE_CALIBRATION_GUIDE.md`.
- **Cross-repo dependency:** the real mobile handoff requires the guard in `Comic-Pro2/src/pages/FromMemeHandoff.jsx` (forwards the live token to Panel Haus Mobile before the desktop consumes it) — documented in that repo's changelog `954`.

### Screens are tabs, not routes

`App.tsx` renders one of several screens via an `activeTab` switch (no router). The creation flow is `workshop → director → layout → editor`, with `vault`, `settings`, `share` as side tabs. All screens are lazy-loaded through `lazyWithReload` (`App.tsx`), which auto-`window.location.reload()`s on stale-chunk errors after a deploy. Screens are large, self-contained files in `src/screens/` (DirectorScreen and EditorScreen are ~2k–2.7k lines each — the bulk of the logic).

`GifEditorScreen` is **not** a tab — it's a full-screen overlay opened from the Editor via the `onOpenGifEditor` callback (drives `gifEditorImages` state in `App.tsx`) and dismissed with `onBack`.

### The Vault is the unified asset model

`Character` is just a `VaultEntry` with `type: "Character"` (see `App.tsx`). All assets — Character / Environment / Prop / Vehicle — are one `vaultEntries` array; `characters` and the per-type lists are `useMemo`/`filter` derivations. When adding asset-related features, work against `VaultEntry`, not a separate character type.

### Frontend ↔ API contract

`src/services/geminiService.ts` is the **only** client gateway to the backend. Every call goes through `apiPost()`, which:

- attaches the user's BYOK key as `x-api-key` (from `panelshaq_settings`), a Clerk `Authorization: Bearer` token when signed in (for shared-account auth + credit reserve), and the anonymous Supabase user id as `x-user-id` (legacy usage tracking; ignored once Clerk is on). It also **soft-gates**: a non-BYOK call while signed out opens Clerk sign-in and aborts,
- enforces timeouts (90s text / 180s image),
- strips base64 image data out of payloads before sending where the server only needs text (e.g. panel generation sends only `{name, description}`).

This module also exposes `onApiError`/`notifyError`, a global error bus that `App.tsx` wires into the toast system. API helpers return `null`/empty on failure rather than throwing to the UI.

### API routes are deliberately self-contained (do not refactor into shared imports)

Each file in `api/` is an independent Vercel serverless function. **Vercel cannot share local files between functions**, so every route inlines its own copies of `getApiKey`, `geminiImage`/`geminiText`, and `checkUsage`. `lib/api-utils.ts` exists as a reference/canonical copy but is **imported by nothing** — do not "DRY up" the routes by importing it; that breaks the deployment. If you change a helper, change it in each route.

Per-route specifics that matter:

- `export const config` sets `bodyParser.sizeLimit` per route (1mb–20mb) because base64 images are large; the Vercel default (100KB) is too small. Match the limit to the payload.
- Image/critique routes set `maxDuration: 60`.
- Image generation uses model `gemini-3.1-flash-image-preview` with `imageSize: "1K"`. **Reference images are placed in the `parts` array BEFORE the text prompt** — Gemini weights earlier content more heavily for style/character adherence (see comment in `api/generate-image.ts`).
- **Metering depends on auth mode.** When Clerk is configured, **every AI route reserves ink** via `${PANELHAUS_API_BASE}/api/credits/*` (reserve before the Gemini call, refund on failure): image routes cost `INK_COST_IMAGE_FLASH`/`_PRO` by the selected model, text/vision routes cost `INK_COST_TEXT`. **BYOK** (`x-api-key`) bypasses auth + credits; **admins** bypass deduction PH-side (`reserve` honors `isAdminUser` + the `AI_ADMIN_RATE_LIMIT_BYPASS` toggle). When Clerk is **unconfigured**, the legacy `checkUsage` daily limiter applies (anon: `ANON_LIMIT_TEXT`/`ANON_LIMIT_IMAGE`, default 10/5; BYOK: 50/20). The credit gate is **inlined per route** (`verifyToken`/`requireSignInWhenClerk`, `reserveInk`/`refundInk`) — same self-contained pattern as `checkUsage`; do not DRY it across files.

Current routes: `generate-panels`, `generate-image`, `final-render`, `insert-panel`, `polish-story`, `suggest-dialogue`, `analyze-character`, `critique-comic`, `credits-balance` (Clerk-authed balance proxy → PH), `credits-checkout` (Clerk-authed proxy → PH `stripe-create-checkout` for booster purchases; forwards the Bearer + sets `Origin` so Stripe returns to our host), `referral-link` (Clerk-authed proxy → PH `referral/link-pending`), `referral-code` (Clerk-authed proxy → PH `referral/code`), `referral-stats` (Clerk-authed proxy → PH `referral/stats`, returns the referral count), `ink-costs` (public per-action ink costs from env), `health`. Each AI route has a matching client function in `geminiService.ts` (e.g. `suggestDialogue` → `suggest-dialogue`, which proposes bubble text for a rendered page).

**Referral (in-app):** `m.panelhaus.app` participates in PH's referral program (we store no referral data ourselves). `ReferralLinker` (mounted in `main.tsx` next to `ClerkTokenBridge`) captures an incoming `?ref=PH-XXXXXX` (+ optional `?comic=`) on load via `src/services/referral.ts` (`captureReferralFromUrl`, strict `/^PH-[A-Z0-9]{6}$/`), then on Clerk sign-in links it through `api/referral-link` → PH `/api/referral/link-pending` (idempotent; handles self/already-referred). `ReferralCard` (in Settings → Account) fetches the user's own code via `api/referral-code` → PH `/api/referral/code` and shares the canonical `https://www.panelhaus.app/?ref=…` link (works for recipients on desktop natively and mobile via redirect). See `documents/REFERRAL_INTEGRATION.md`.

**Buying ink (in-app):** booster packs (75/150/300) are sold via PH's existing Stripe. `BuyCreditsSheet` → `src/services/checkout.ts` → `api/credits-checkout` → PH `stripe-create-checkout` → Stripe hosted page → PH webhook grants to the shared balance. We hold no Stripe secrets/price IDs/webhook. The sheet opens from Settings "Get more ink", a tap on the nav ink chip, or automatically on an out-of-ink `402`, all via the `src/services/buyCredits.ts` event bus; `App.tsx` hosts the single sheet and handles the Stripe `/success`/`?checkout_canceled` return (polls the balance to absorb webhook lag). Founder Pass + subscriptions stay on the `panelhaus.app/pricing` link. See `documents/CREDIT_PURCHASE_INAPP_PLAN.md`.

### GIF export

`src/services/gifAnimationService.ts` (+ types in `src/types/gif.ts`, components `GifPanelEditor`/`GifPreview`/`GifTimeline`, screen `GifEditorScreen`) renders per-panel Ken-Burns-style animations to a canvas (`generateFrames`, `drawFrameAtTime`) and assembles an animated GIF entirely client-side — no API call. This is independent of the Gemini pipeline.

### Analytics

`src/services/analytics.ts` is the single funnel: `track()`/`trackOnce()` **fan out to BOTH Vercel Analytics and PostHog**. `@vercel/analytics` is mounted via `<Analytics/>` in `src/main.tsx` (always on); **PostHog** (`posthog-js`) is initialized by `initAnalytics()` in `main.tsx`, **gated on `VITE_POSTHOG_KEY`** (unset → PostHog is a no-op, Vercel still runs). Because every event flows through `track()`, existing events (`generation_started {type}`, `share_completed`, etc.) reach PostHog automatically. PostHog also gets: `identifyUser`/`resetUser` via `<PosthogIdentifyBridge/>` (Clerk sign-in → identify with email/wallet + auth_method; sign-out → reset), `setUserProps({tier})` from `credits.ts`, and targeted events (`signed_up`, `ink_spent`, `out_of_ink`, `checkout_started`, `purchase_completed`, `referral_shared`). Config: US host, `capture_pageview:'history_change'`, autocapture on, `person_profiles:'identified_only'`. Adding analytics is fire-and-forget; don't block UX on it. See `documents/POSTHOG_ANALYTICS.md`.

### GTD ship-claim (export/share → whitelist)

When a **signed-in** user **ships** (any export/share in the main app), a one-shot bottom sheet invites them to claim a GTD whitelist spot — the mobile port of Comic-Pro2's creator-invite (its changelogs `1139`/`1140`/`1141`; build doc: `documents/GTD_SHIP_CLAIM_BUILD_PLAN.md`). Every ship surface calls **`markShipped(surface, props?)`** (`src/services/shipClaim.ts`), which fires the existing `share_completed` analytics event AND arms the claim — the invariant is that `"share_completed"` appears only in `shipClaim.ts` (plus the deliberate `makeComic.ts` exclusion, which navigates away immediately). **The invite is signed-in only:** `fireShipClaimOnce` returns early (before any flag write, so the one shot isn't burned) when no Clerk identity is registered via the `registerShipIdentity` holder set by `<ShipIdentityBridge/>` in `main.tsx`. The sheet (`ShipClaimSheet` via `ShipClaimHost`) is mounted in `App.tsx` only — the Clerk-free `/c/from-meme` root has no host (its `markShipped` calls are analytics-only) — and the sheet/service stay **Clerk-free** (holder pattern, like `clerkToken.ts`). Four invariants: the claim **grants nothing** (whitelist spot only, auto-approved, drop mints at 0.03 ETH — copy stays verbatim with desktop), it costs/grants **zero ink**, the endpoint (`api/creator-application`) has **no auth/credit guard** (it's shared byte-for-byte with desktop's anonymous-capable endpoint — do NOT use `apiPost`, and don't add `requireSignInWhenClerk` server-side), and it is NOT `creator-program` (PH's separate Clerk-authed Postgres system). The route shares Panel Haus's Upstash DB (`UPSTASH_REDIS_REST_URL/TOKEN`, keys byte-identical: `creator:application:<identity>` / `creator:applications`), rate-limits 10 POST/hour/IP (rightmost-XFF), and validates enums server-side. **The write path fails CLOSED** (`503` when Upstash is unconfigured or the write throws) and returns `stored: true` on success; the client burns its one-shot flag **only** on that confirmation, and clears the shown-flag on failure so the next ship re-prompts (desktop changelog `1240` — the old flag-first/ignore-response order lost the lead twice: nothing stored AND never re-invited). The **GET** gate still fails open on purpose: re-showing the sheet to someone who already applied beats locking a real creator out. Client one-shot keys: `panelshaq_ship_claim_shown_v2`/`_applied_v2` (reset BOTH to re-test; dismissal consumes the shot by design). The `_v2` suffix is deliberate — the v1 keys are abandoned, not migrated, to hand a fresh shot to everyone burned during the outage.

### Export / desktop bridge

`src/services/exportComicService.ts` converts a project into a `.comic` package compatible with the desktop Panelhaus app: it maps the grid layout templates (from `LayoutScreen`) to pixel rects, maps bubble style names to the desktop's bubble types (`BUBBLE_TYPE_MAP`), and wraps everything in the desktop's expected schema (layers, strokeWidth, dimension, blueprints). The `documents/` folder holds the handoff/compatibility specs — consult `PANEL_HAUS_MOBILE_EXPORT_COMPATIBILITY.md` and the bridge handoff docs before changing export format.

### Mobile-only by design

`App.tsx`'s `DesktopRedirectGate` detects desktop (`width >= 1024` + `pointer: fine`) and redirects to panelhaus.app after a countdown (dismissible). Treat this as a phone/tablet UI: touch gestures (`@use-gesture/react` for tab-swipe and bubble dragging), safe-area insets, bottom nav.

## Conventions

- **Theme tokens are defined in `src/index.css` under `@theme`** (Tailwind v4 has no `tailwind.config.js`). Use the semantic classes — `bg-background` (#0f172a), `bg-surface`, `text-accent` (#f5f5dc), `text-primary`/`bg-primary` (orange #ff9100), `font-headline` (Space Grotesk), `font-body` (Inter). Don't hardcode hex.
- `@/*` path alias maps to the repo root (see `tsconfig.json` / `vite.config.ts`).
- New panels must pass through `hydratePanel()` (geminiService) so `bubbles[]` and `imageTransform` always exist — older saved panels predate these fields.
- `documents/` is a large archive of design/exploration/changelog notes (not shipped). It's a good place to understand the "why" behind a feature; `CHANGELOG.md` is the user-facing summary.

---

## General coding guidelines

Behavioral guidelines to reduce common LLM coding mistakes. For trivial tasks, use judgment.

### 1. Think before coding

State assumptions explicitly; if uncertain, ask. If multiple interpretations exist, present them — don't pick silently. If a simpler approach exists, say so.

### 2. Simplicity first

Minimum code that solves the problem. No speculative features, no abstractions for single-use code, no configurability that wasn't requested, no error handling for impossible scenarios.

### 3. Surgical changes

Touch only what you must. Don't "improve" adjacent code or refactor things that aren't broken. Match existing style. Remove only the imports/variables your own changes orphaned; flag pre-existing dead code rather than deleting it. Every changed line should trace to the request.

### 4. Goal-driven execution

Turn tasks into verifiable goals and loop until verified. For multi-step work, state a brief plan with a verification check per step.
