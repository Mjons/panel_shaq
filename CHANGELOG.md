# Changelog

## June 6, 2026 — Domain move groundwork (`m.panelhaus.app`)

- **Cross-origin data migration.** localStorage + IndexedDB are per-origin, so moving the canonical host from `shaq.panelhaus.app` to `m.panelhaus.app` would strand existing users' on-device projects. Added a one-time, same-site migration: `public/migrate-bridge.html` (a read-only exporter served on the old origin) + `src/services/originMigration.ts` (runs once on first load of `m.panelhaus.app`, pulls the old origin's storage via a hidden iframe + `postMessage`, writes it locally, then mounts). Self-gates to the new host and never clobbers existing data. **Requires the old host to keep serving `/migrate-bridge.html`** (don't blanket-redirect it).
- **TWA Digital Asset Links stub.** Added `public/.well-known/assetlinks.json` (package `app.panelhaus.mobile.twa`) so the rebuilt TWA verifies the new domain. Fingerprints are placeholders — fill before resubmit (see `public/.well-known/README.md`).

## June 6, 2026 — Rebrand: "Panel Shaq" → "Panel Haus Mobile"

- **Renamed the app's user-facing brand** from "Panel Shaq" to **Panel Haus Mobile** across the UI: the loading splash wordmark, the email gate, the API-key help text, the Settings hosted-service banner, the Web Share comic title, and `metadata.json`. The new home is **`m.panelhaus.app`** (replacing `shaq.panelhaus.app`).
- **Internal storage keys are intentionally unchanged.** Every `panelshaq_*` localStorage key and the `panelshaq` / `panelshaq_projects` IndexedDB databases keep their names — they're storage namespaces, and renaming them would wipe existing users' projects, vault, and settings. Likewise the `.comic` export `source: "panelshaq"` field is left as a cross-repo contract with the desktop importer.
- **TWA `packageId`** changes with the rename (app is being resubmitted to Google Play). Plan + full tier breakdown: `documents/rename-shaq-to-panelhaus-mobile-plan.md`.

## June 6, 2026 — Panel Haus cross-app switcher (`haus-switcher`)

### Nav integration

- **Mounted the shared `<haus-switcher current="shaq">` web component** in the top nav, in the far-left group, to the right of the hamburger menu. It's the cross-app launcher shared across Panel Haus properties (loaded from `panelhaus.app/embed/hausbar.js` via `index.html`). Replaces the old "PANEL SHAQ" text wordmark in that slot.
- **Removed the hardcoded "Panelhaus.app" cross-link** from the menu drawer — the switcher supersedes it. The Discord link and brand-attribution footer are left intact (community/brand, not sibling-app nav chrome).
- **React 19 typing:** added `src/global.d.ts` declaring `haus-switcher` under the `react` JSX namespace (React 19 moved it off the global `JSX` namespace).

### Dev-only

- **Local mock of the switcher** (`src/hausbar-mock.ts`, loaded only under `import.meta.env.DEV`) so it's visible while developing — the real embed isn't live yet. A ⊞ opens a full-screen sibling-app drawer; the logo links to `panelhaus.app/universe`. Tree-shaken out of prod builds; in prod the empty tag stays invisible until the real embed ships.

## June 3, 2026 — MemeGen → Panel Shaq Meme Handoff (mobile "add text")

### New: mobile meme text editor (`/c/from-meme`)

- **The mobile half of MemeGen's "add text" flow.** On a phone, generating a meme on MemeGen and tapping "add text" now lands in Panel Shaq's full meme editor (instead of dead-ending on the desktop site). No login, no AI, no credits — just finish the meme and share.
- **Caption editing:** tap a caption to edit text; pick from **5 fonts** (Impact / Wojak / Slab / Marker / Type); adjust size with `A− / A+`; **move, rotate, resize** each caption — drag anywhere on the caption box, or use the ✥ / ↻ / ⤡ handles.
- **Delete / restore:** remove a caption (clean preview, no clutter); a `＋` chip in the bar brings it back. Modern-Slab's box auto-hides when empty.
- **Share / Copy / Download:** flattened, watermarked PNG. Share uses the native share sheet; Copy puts the image on the clipboard (both need HTTPS — they fall back to Download otherwise).
- **Fits any screen:** the meme always fits the viewport (no scrolling), for any aspect ratio, and refits on rotate.
- **CTAs:** "Make another meme" (back to MemeGen) and "Make a comic" (saves the meme to your Vault and opens the comic studio).

### Impact font — classic meme look

- **Thicker black stroke on Impact**, applied to **all existing templates** by default (positions and sizes unchanged). Picking Impact in the editor, and new admin-added zones, also use the thick stroke. Other fonts are unaffected.

### Templates & admin

- **56 meme templates** with caption positions pre-calibrated (normalized, so they line up on any handoff image size). Admin calibrator + template gallery (`?admin=…&gallery=1`) to (re)position captions and Copy JSON back into the registry.

### Infrastructure

- Handoff token is consumed via a **same-origin serverless proxy** (`api/handoff-consume`) that calls PanelHaus server-to-server — avoids a cross-origin CORS failure. The payload is cached for refresh-safety (single-use token).
- Requires a one-line **guard in the desktop app** (Comic-Pro2 `FromMemeHandoff`) that forwards mobile traffic to Panel Shaq with the live token (see that repo's changelog 954).

## May 10, 2026 — BottomSheet Nav Clearance

- **BottomSheet bottom padding bumped to `pb-28`** so the floating BottomNav no longer visually overlaps the last form action (e.g. the "Create Vault Entry" button). Affects all BottomSheet uses; visible impact today is the Vault new-entry / edit-entry forms.

## May 10, 2026 — Vault Add Flow & Email Gate Hardening

### Workshop

- **Both `+` buttons now go to the Vault** — the larger dashed-border character slot used to open a file picker that created a placeholder character with default name and description. It now navigates to the Vault to create a real entry, matching the behavior of the smaller orange `+` button. Net: one consistent path for adding characters.
- **Tip text shows the actual icon** — the `style-ref` coach tip now renders the `PlusCircle` icon inline ("Tap the orange ⊕ to create a new character blueprint") instead of describing it in text, so the user sees what they're looking for.
- **React 19 prop casing fix** — `fetchpriority` → `fetchPriority` on character images.

### Email Gate

- **Surface the real `saveEmail` error** — when Supabase rejects the email save, the gate now shows the actual error message ("Couldn't save your email: {reason}") instead of a generic "Something went wrong." Keeps the generic fallback only for the localStorage save step.

## May 10, 2026 — Share Polish & Settings

### Sharing

- **Editor share buttons now include a real share message** — both "Share This Page" and "Share All Pages" pass `text: "Made this with panelhaus.app — AI comic creator"` so X (and other recipients) get usable tweet copy with the URL. Previously was just "Made with Panelhaus".
- **iOS fallback applied to editor share** — both buttons now fall through to download when `navigator.share()` rejects with anything other than user-cancel. Matches the same pattern applied to ShareScreen earlier today.
- **Page-numbered share titles** — "Share This Page" now uses `Comic Page N` as the share title instead of generic `My Comic`, so the page number travels with the share.
- **Share analytics in editor** — both buttons fire `share_completed` events (`surface: editor_current_page` / `editor_all_pages`, with `_download` suffix on fallback) so the funnel covers all share paths.

### Settings

- **"Signed in as: {email}" display** — hosted-mode users now see their saved email in Settings, below the existing hosted-service banner. Read from the `panelshaq_user_email` localStorage key set during email-gate signup. BYOK users see nothing extra (no email is collected in BYOK mode).

## May 10, 2026 — Spike Prep

### Observability

- **Vercel Web Analytics integrated** — `@vercel/analytics` v2 mounted in app root, custom-event wrapper at `src/services/analytics.ts`.
- **5 custom events wired** — `cold_landing` (with `first_visit` flag), `editor_first_open`, `generation_started`, `generation_failed`, `share_completed` (with `surface` tag). Funnel data for the upcoming traffic spike.
- **ErrorBoundary now reports client errors** — `componentDidCatch` fires `client_error` event with truncated message and retry count, instead of silently logging to console.

### Reliability

- **Anon-vs-BYOK throttling** — `checkUsage` now distinguishes BYOK users (50 text / 20 image / day, unchanged) from anon users (env-tunable via `ANON_LIMIT_TEXT` / `ANON_LIMIT_IMAGE`, defaults 10 / 5). Applied across `generate-image`, `generate-panels`, `insert-panel`, `final-render`, `polish-story`.
- **Share fallback on iOS rejection** — all three Share screen handlers (single export, batch, single panel) now fall through to download when `navigator.share()` rejects with anything other than user-cancel. Previously failed silently when iOS Safari rejected the share post-`canShare()`.
- **Crash fix in `.comic` file share fallback** — `URL.createObjectURL(file)` no longer crashes when no file config passed `canShare`; builds a fresh blob from the JSON instead.

### Documents

- **Traffic spike prep plan** — `documents/traffic-spike-prep.md` captures the spike strategy: image-first sharing, NFT/X audience profile, 3-day sequencing.
- **Analytics audit & plan** — `documents/analytics-audit-and-plan.md` covers Phase 1/2/3 instrumentation roadmap with status tracking.
- **Tooltip catalog** — `documents/tooltips-current.md` snapshot of all 17 tips (10 coach, 7 help) by screen.

## March 20–22, 2026

### Comic Creation

- **Custom panel image upload** — use your own artwork, photos, or images from other tools alongside AI-generated panels. Upload button on empty panels and existing panels.
- **Default aspect ratio changed to 3:4** (portrait) — better for comic panels than the old 16:9 wide default.
- **Character adherence restored** — switched back to `gemini-3.1-flash-image-preview`, reference images sent first in prompt, `imageSize: "1K"` restored, stronger style adherence prompt.
- **New unique pose enforcement** — AI generates fresh poses instead of copying the reference image pose.
- **Background/Environment support** — select a background from the Vault per panel. The AI uses it as the setting while ignoring any people in the reference.
- **Props and Vehicles** — Vault props and vehicles appear as collapsible pickers on each panel card. Selected items are included as references with descriptive prompts.
- **Art style simplified** — removed the confusing Art Style picker, Style Priority toggle, Match Char Style, and Style Notes. Character reference images now define both appearance AND style automatically.

### Dialogue & Editor

- **Dialogue UX overhaul** — merged INK TOOLS + EDIT BUBBLE into a single "DIALOGUE" section with step-by-step hints (1. Add → 2. Edit → 3. Drag → 4. Bake).
- **Inline bubble editing** — tap a bubble on the panel to edit text, change type (Speech/Thought/SFX), adjust font size, and delete. All in a floating toolbar right next to the bubble.
- **Smooth bubble dragging** — bubbles now move live during drag via direct DOM updates instead of snapping on release.
- **"Bake Panel Dialogue"** button added to the floating bubble toolbar — bake all bubbles on the selected panel without going to the sidebar.
- **Panel drag lock during bubble editing** — panel image can't accidentally move while editing bubbles. Tap the green ✓ to exit edit mode and unlock.
- **Renamed "Final Natural Render" to "Bake Dialogue Into Image"** — clearer name, disabled when no bubbles exist, includes warning about permanent replacement.
- **Removed tail direction square** — the small tail indicator was non-functional and confusing.

### Director & Layout

- **Camera lens modal** — full-width bottom sheet on mobile with thumbnail previews in a 2-column grid. Replaces the old tiny inline dropdown.
- **Lens images optimized** — PNG → WebP conversion, 5.4MB → 96KB (98% reduction).
- **Layout template picker** — compact 5-column grid, smaller thumbnails, no text labels. 10 options fit in 2 clean rows.
- **Per-page panel count controls** — change how many panels each page gets independently.
- **5-panel and 1-panel layout support** — new templates including Full Page, 2-over-3, Feature Top, Cross, Hero+5.
- **Regenerate button 60% opacity** — more visible on mobile (was 30%).
- **Download All + individual panel download** — download buttons on each panel card and a batch "Download All" in the header.

### Sharing & Export

- **Native share sheet** — share all panel images or individual panels via iMessage, WhatsApp, Twitter, etc. using the Web Share API. Fallback to download.
- **Export for Panelhaus** — `.comic` file export with full compatibility (layers wrapper, strokeWidth, dimension, blueprints).
- **Replace panels warning** — now includes a "Download X Images" button so you can save your work before replacing.

### Infrastructure & Reliability

- **Supabase usage tracking** — anonymous auth, daily usage counters (50 text/20 image generations per day), progress bars in Settings.
- **API routes fixed** — `@google/genai` SDK replaced with REST API calls (`fetch`), all helpers inlined per route (Vercel can't share files between serverless functions).
- **PWA service worker fix** — `/api/` routes excluded from navigation fallback, `skipWaiting` + `clientsClaim` for immediate updates.
- **Proxy fallback removed** — all generation calls go through API routes for proper usage tracking.
- **Request timeouts** — 90s for text, 180s for image generation.
- **Friendly error messages** — quota exceeded, invalid API key, and timeout errors shown as clean toasts instead of raw JSON.
- **Failed panel retry** — failed panels get a red "Failed — Retry" badge, batch retry button in header.
- **Stale chunk auto-reload** — `lazyWithReload` wrapper catches chunk load errors after deploys and refreshes the page.

### Settings & UX

- **BYOK (Bring Your Own Key)** — setup screen for first-time users to enter their Gemini API key. Link to get a free key at aistudio.google.com.
- **Warning toggles** — turn off regeneration warnings and data warnings independently in Settings.
- **Usage display** — "Today's Usage" section in Settings with progress bars for text and image generations.
- **Discord link** — added to hamburger menu.
- **Onboarding banners** — contextual help on Layout, Vault, and Editor screens (dismissible).
- **Branded confirmation dialogs** — replaced all `window.confirm` with themed modals.
- **File size validation** — 5MB limit on character/style uploads, 10MB on panel uploads.

### Bug Fixes

- Fixed panels losing images on refresh (IndexedDB persistence instead of localStorage).
- Fixed stale closure in panel generation queue (functional `setPanels` updater).
- Fixed export rendering orange selection border (deselect + `waitForPaint` before capture).
- Fixed body parser limits on API routes (was 100KB default, now 1-20MB per route).
- Fixed Supabase `service_role` key needing `{ auth: { autoRefreshToken: false, persistSession: false } }` to bypass RLS.
- Fixed `VITE_` env vars not baked into client bundle (must be set before build).
- Fixed ErrorBoundary wrapping Suspense for lazy screen crashes.
- Fixed word count label (was "Words", actually counts characters).
- Removed dead "Drafts" and "Help" buttons.
