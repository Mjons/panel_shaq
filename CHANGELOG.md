# Changelog

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
