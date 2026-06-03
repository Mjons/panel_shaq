# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Panel Shaq** (PWA name: **Panelhaus**) is a mobile-first, AI-powered comic creation studio. Users write a story, generate comic panels with Gemini, manage reusable assets (characters/environments/props/vehicles), lay panels out into pages, add speech bubbles, and export. There is a companion **desktop** app at panelhaus.app — this repo is the mobile/tablet half and exports `.comic` packages the desktop app can import.

Frontend: React 19 + Vite 6 + Tailwind CSS v4 (config-in-CSS via `@theme`). Backend: Vercel serverless functions in `api/`. AI: Google Gemini via REST. Usage metering + email capture: Supabase. Product analytics: Vercel Analytics.

## Commands

```bash
npm run dev          # Vite dev server on :3000 (frontend only — /api routes won't work)
npm run dev:full     # vercel dev — runs frontend + api/ serverless functions together
npm run build        # vite build → dist/
npm run preview      # preview the production build
npm run lint         # tsc --noEmit — this is the ONLY check; there is no test suite or ESLint
npm run clean        # rm -rf dist
```

- **There are no tests.** "Lint" means TypeScript type-checking (`tsc --noEmit`). Run it before considering work done.
- To exercise anything that calls `/api/*` (panel/image generation, polish, critique), you must use `npm run dev:full` (vercel dev), not `npm run dev`.

## Environment variables

Client (must be `VITE_`-prefixed and present **at build time** — they're baked into the bundle):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — anonymous auth, usage display, email capture. Optional; app degrades gracefully if absent.
- `VITE_MEMEGEN_URL` (default `https://memegen.panelhaus.app`) — "make another meme" target for the MemeGen meme-handoff receiver (`src/from-meme/`); optional.
- `VITE_MEME_ADMIN_SECRET` — unlocks the admin calibrator. In **prod**, set a private value to enable it, or **leave empty to disable admin entirely** (no public fallback). In **dev** it defaults to `panelshaq-admin`.

Server (Vercel env, runtime):
- `PANELHAUS_API_BASE` (default `https://panelhaus.app`) — upstream the `api/handoff-consume` proxy calls server-to-server. Optional.
- `GEMINI_API_KEY` — the shared key used by "hosted" mode, and the fallback when a BYOK user hasn't supplied their own.
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — service-role client for usage enforcement. The service-role client **must** be created with `{ auth: { autoRefreshToken: false, persistSession: false } }` to bypass RLS correctly.

Dev: `DISABLE_HMR=true` disables Vite HMR/file-watching (used in AI Studio to prevent flicker during agent edits — see `vite.config.ts`).

## Architecture

### State lives in the browser; the server is stateless

There is no app database for user content. `src/App.tsx` (`AppInner`) is the single source of truth and owns all top-level state, persisting it two ways:
- **`usePersistedState`** (`src/hooks/`) — localStorage, for small data (story text, active tab, page layout, settings).
- **`useIndexedDBState`** (`src/hooks/`) — IndexedDB, for large data that would blow localStorage's ~5MB quota: **`panels` (base64 images), `vaultEntries`, `styleReferenceImage`**. Use IndexedDB for anything holding image data.

Named/saved projects are a separate IndexedDB store managed by `src/services/projectStorage.ts` (full projects in IndexedDB `panelshaq_projects`; a lightweight meta index in localStorage). App auto-saves the working project on an interval and on `beforeunload`.

### Auth gate: two modes (hosted vs BYOK)

On first launch `App.tsx` shows `EmailGate` (`src/components/EmailGate.tsx`) when `authMode === null` (`showAuthGate`). The user picks one of two modes, persisted in `localStorage.panelshaq_auth_mode`:
- **`"hosted"`** — user submits an email (upserted to the Supabase `emails` table via `saveEmail` in `src/services/supabase.ts`) and then uses the server's shared `GEMINI_API_KEY`, rate-limited by the daily usage counters ("anon throttle").
- **`"byok"`** — user supplies their own Gemini key, stored in `panelshaq_settings` and sent as the `x-api-key` header.

`SettingsScreen` receives the chosen mode as `appMode`. (This replaced an older BYOK-only setup screen.)

### MemeGen meme-handoff receiver (`/c/from-meme`) — a second root

This SPA has **no router**, so `src/main.tsx` branches on `window.location.pathname`: when it's `/c/from-meme` it renders `src/from-meme/FromMemeRoot.tsx` **instead of** `<App/>`, bypassing `EmailGate` entirely. This is the mobile half of MemeGen's "add text" handoff (desktop half is Panelhaus). Flow + reasoning: `documents/MEMEGEN_HANDOFF_AND_DESKTOP_UPSELL_STRATEGY.md`.

- **Consume:** `useHandoffPayload.ts` reads `?h=<token>` and POSTs same-origin to `api/handoff-consume`, a serverless proxy that calls `${PANELHAUS_API_BASE}/api/handoff/consume` server-to-server (the upstream 405s the cross-origin OPTIONS preflight, so a direct browser call fails — the proxy sidesteps CORS). Single-use → it caches the payload to `sessionStorage` and ref-guards against StrictMode double-consume. Dev stub: `?stub=1&template=<id>&img=&w=&h=`.
- **Editor (`MemeEditor.tsx`):** the meme image full-bleed, fitted to the viewport via `useFit.ts` (no scroll, aspect from the loaded image), with `TextZonesOverlay.tsx` captions on top. Users edit text, pick one of 5 fonts (`memeFontPresets.ts`), resize, move/rotate/resize (handles on the selected zone), and delete/restore. Export = a manual canvas flatten (`memeFlatten.ts` + `memeWatermark.ts`), then Share/Copy/Download (`memeShare.ts`). **Copy/Share need a secure context** (HTTPS/localhost) — they fall back to download on plain-HTTP LAN.
- **Caption positions** live in the generated, committed registry `src/data/memeTextZones.ts` (56 templates, normalized 0–1, keyed by `templateId`). Generated once by `scripts/generateMemeTextZones.mjs` from the desktop repo — **do not re-run it after hand-calibrating; it overwrites everything.** Template images for the admin tools live in `public/templates/`.
- **Admin calibrator/gallery:** `?admin=<VITE_MEME_ADMIN_SECRET>` (+ `&gallery=1`) opens `AdminCalibrator.tsx` / `AdminGallery.tsx` to position zones and "Copy JSON" back into the registry. See `documents/MEME_TEMPLATE_CALIBRATION_GUIDE.md`.
- **Cross-repo dependency:** the real mobile handoff requires the guard in `Comic-Pro2/src/pages/FromMemeHandoff.jsx` (forwards the live token to Shaq before the desktop consumes it) — documented in that repo's changelog `954`.

### Screens are tabs, not routes

`App.tsx` renders one of several screens via an `activeTab` switch (no router). The creation flow is `workshop → director → layout → editor`, with `vault`, `settings`, `share` as side tabs. All screens are lazy-loaded through `lazyWithReload` (`App.tsx`), which auto-`window.location.reload()`s on stale-chunk errors after a deploy. Screens are large, self-contained files in `src/screens/` (DirectorScreen and EditorScreen are ~2k–2.7k lines each — the bulk of the logic).

`GifEditorScreen` is **not** a tab — it's a full-screen overlay opened from the Editor via the `onOpenGifEditor` callback (drives `gifEditorImages` state in `App.tsx`) and dismissed with `onBack`.

### The Vault is the unified asset model

`Character` is just a `VaultEntry` with `type: "Character"` (see `App.tsx`). All assets — Character / Environment / Prop / Vehicle — are one `vaultEntries` array; `characters` and the per-type lists are `useMemo`/`filter` derivations. When adding asset-related features, work against `VaultEntry`, not a separate character type.

### Frontend ↔ API contract

`src/services/geminiService.ts` is the **only** client gateway to the backend. Every call goes through `apiPost()`, which:
- attaches the user's BYOK key as `x-api-key` (from `panelshaq_settings` in localStorage) and the anonymous Supabase user id as `x-user-id` (for usage tracking),
- enforces timeouts (90s text / 180s image),
- strips base64 image data out of payloads before sending where the server only needs text (e.g. panel generation sends only `{name, description}`).

This module also exposes `onApiError`/`notifyError`, a global error bus that `App.tsx` wires into the toast system. API helpers return `null`/empty on failure rather than throwing to the UI.

### API routes are deliberately self-contained (do not refactor into shared imports)

Each file in `api/` is an independent Vercel serverless function. **Vercel cannot share local files between functions**, so every route inlines its own copies of `getApiKey`, `geminiImage`/`geminiText`, and `checkUsage`. `lib/api-utils.ts` exists as a reference/canonical copy but is **imported by nothing** — do not "DRY up" the routes by importing it; that breaks the deployment. If you change a helper, change it in each route.

Per-route specifics that matter:
- `export const config` sets `bodyParser.sizeLimit` per route (1mb–20mb) because base64 images are large; the Vercel default (100KB) is too small. Match the limit to the payload.
- Image/critique routes set `maxDuration: 60`.
- Image generation uses model `gemini-3.1-flash-image-preview` with `imageSize: "1K"`. **Reference images are placed in the `parts` array BEFORE the text prompt** — Gemini weights earlier content more heavily for style/character adherence (see comment in `api/generate-image.ts`).
- Usage limits are enforced server-side per anonymous user per UTC day in `checkUsage` (50 text / 20 image). The client `getUsageToday` (`src/services/supabase.ts`) only reads for display.

Current routes: `generate-panels`, `generate-image`, `final-render`, `insert-panel`, `polish-story`, `suggest-dialogue`, `analyze-character`, `critique-comic`, `health`. Each has a matching client function in `geminiService.ts` (e.g. `suggestDialogue` → `suggest-dialogue`, which proposes bubble text for a rendered page).

### GIF export

`src/services/gifAnimationService.ts` (+ types in `src/types/gif.ts`, components `GifPanelEditor`/`GifPreview`/`GifTimeline`, screen `GifEditorScreen`) renders per-panel Ken-Burns-style animations to a canvas (`generateFrames`, `drawFrameAtTime`) and assembles an animated GIF entirely client-side — no API call. This is independent of the Gemini pipeline.

### Analytics

`@vercel/analytics` is mounted via `<Analytics/>` in `src/main.tsx`, and `trackColdLanding()` fires once at startup. `src/services/analytics.ts` wraps it with `track` / `trackOnce` (session-deduped). Screens call `track(...)` directly (e.g. `"share_completed"`) or lazy-import `trackOnce`. Adding analytics is fire-and-forget; don't block UX on it.

### Export / desktop bridge

`src/services/exportComicService.ts` converts a project into a `.comic` package compatible with the desktop Panelhaus app: it maps the grid layout templates (from `LayoutScreen`) to pixel rects, maps bubble style names to the desktop's bubble types (`BUBBLE_TYPE_MAP`), and wraps everything in the desktop's expected schema (layers, strokeWidth, dimension, blueprints). The `documents/` folder holds the handoff/compatibility specs — consult `PANEL_SHAQ_EXPORT_COMPATIBILITY.md` and the bridge handoff docs before changing export format.

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
