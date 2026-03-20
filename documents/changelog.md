# Panelhaus — Session Changelog

**Date:** 2026-03-19 → 2026-03-20
**Scope:** Full build session from project review through deployment and iteration

---

## Project Assessment & Strategy

- **Reviewed the existing AI Studio codebase** — found a ~95% complete React 19 + Vite + Tailwind web app with Gemini AI integration, 5-screen comic creation workflow
- **Decided against Expo/React Native rewrite** — the app is already mobile-responsive, Expo would mean rebuilding every screen from scratch (3-5 weeks)
- **Chose web-first strategy** — ship as PWA now, wrap as TWA for Play Store later, Capacitor if native APIs needed
- **Created execution plan** spanning 4 phases: persistence + PWA (now), deploy (week 1), mobile polish (week 2), settings/share/projects (week 3)

## Phase: NOW — Foundation (Tasks 1-4)

- **Added localStorage persistence** — created `usePersistedState` hook, wired into App.tsx (6 state variables) and VaultScreen. Refreshing no longer loses work.
- **Created ErrorBoundary** — wraps the app so a crash in one screen doesn't nuke everything. Shows "Try Again" recovery UI.
- **Set up PWA** — installed `vite-plugin-pwa`, configured manifest (name, icons, theme, service worker), added meta tags for installable mobile web experience.
- **Cleaned up package.json** — removed unused `express`, `@types/express`, `dotenv`. Added `@types/react`, `@types/react-dom`. Renamed package from `react-example` to `panel-shaq` v0.1.0. Fixed a pre-existing TypeScript error (missing props in default switch case).

## Phase: Week 1 — Deployment (Tasks 5-7)

- **Initialized git repo** and pushed to GitHub at `Mjons/panel_shaq`
- **Deployed to Vercel** — zero-config Vite deploy, live at `panel-shaq.vercel.app`
- **Serverless API proxy** — the linter created 6 Vercel serverless functions (`api/*.ts`) that proxy all Gemini calls server-side, keeping the API key out of the browser bundle. Later added direct BYOK fallback for local dev.

## Phase: Bug Fixes & Feature Requests

### Image Handling

- **Fixed image cutoff in Editor** — removed "Framing Mode" toggle, selected panels auto-show overflow for transform sliders. Later reverted to `overflow-hidden` on all containers after images bled over UI elements.
- **Added aspect ratio selector** — per-panel dropdown in Director (1:1, 16:9, 9:16, 4:3, 3:4). Panel preview and Gemini API both respect the chosen ratio.
- **Changed to `object-contain`** — images display at original aspect ratio without cropping. Black background fills letterboxed areas.
- **Fixed character reference images not being sent** — URL images (like `/sample.png`) were silently dropped by the base64 regex. Added `toBase64()` helper that fetches and converts URL images. Added explicit prompt instruction for character appearance matching.

### Generation Queue

- **Added "Generate All" button** in Director header — queues all panels and generates sequentially
- **Individual generate clicks now queue** — clicking generate on multiple panels queues them instead of running in parallel. Each panel shows Queued/Generating badges.
- **Moved regenerate button** to bottom-right corner, 30% opacity by default (full on hover), smaller on mobile

### Export

- **Hidden panel selection highlight during export** — `setSelectedPanelId(null)` called before capture, plus `!isExporting` guards on all selection borders, overlays, and dimming
- **Bubble selection ring** already excluded from export

## Phase: Week 3 — Settings, Share, Projects (Tasks 13-16)

- **Settings screen** — Gemini API key config with show/hide toggle and test connection, export format/quality preferences, auto-save interval (off/30s/1m/5m), clear data options, image model selector (Flash vs Pro)
- **Share screen** — Web Share API integration for native Android share sheet, export history with per-item share/download/delete, copy app link button
- **Project Save/Load** — IndexedDB for full project data, localStorage for metadata index. Project Manager bottom sheet with grid of saved projects, thumbnails, new project card, delete with confirmation.
- **Auto-save** — configurable interval (default 30s), saves to IndexedDB, fires on `beforeunload`
- **CREATE button** now opens Project Manager instead of wiping state

## Phase: Week 2 — Mobile UX Polish (Tasks 8-12)

- **Viewport safe areas** — `viewport-fit=cover`, safe area CSS variables, TopNav gets notch padding, BottomNav clears home indicator, keyboard hides bottom nav via CSS media query
- **Code splitting** — `React.lazy` on all 7 screens with `LoadingSkeleton` fallback. Main chunk dropped from 1127KB to 396KB (65% reduction).
- **Image compression** — `compressImage()` utility converts generated images to JPEG 0.8 quality before storing
- **Swipe navigation** — `@use-gesture/react` for horizontal swipe between tabs (Workshop → Director → Layout → Editor)
- **Bottom sheet modals** — reusable `BottomSheet` component with drag-to-dismiss, migrated VaultScreen modal

## Art Style & Character System

- **Art style presets in Workshop** — Cartoon (default), Manga, Comic Book, Realistic, Watercolor, Pixel Art as selectable buttons, plus custom image upload. 2-column grid on mobile with 48px touch targets.
- **Removed redundant art style selector from Director** — style is chosen once in Workshop, not per-panel
- **Camera angle and mood default to "None"** — omitted from prompt when not selected (previously hardcoded to "Cinematic 35mm" and "Cyberpunk Neon")
- **Character Tag Bar** — above story textarea, shows which characters are mentioned (green pill) vs not (gray, tap to insert). Before Gemini call, character names get replaced with `[CHARACTER: Name — Description]` anchors for unambiguous identity.
- **AI Auto-Describe** — button in character edit modal that analyzes the character image and generates an appearance-only description. Works on both base64 and URL images, with direct Gemini fallback.

## Monetization & API Key Strategy

- **Explored three models** — BYOK (user's own key), Freemium (credits), Hybrid (BYOK free + credit packs). Documented in `monetization-model.md`.
- **Decided on BYOK first** — users provide their own Gemini API key. Google offers free tier credits. Zero cost to us.
- **BYOK onboarding screen** — first-time users see API key setup with link to Google AI Studio
- **Image model selector in Settings** — Flash ($0.067/image, default) vs Pro ($0.134/image)
- **Direct Gemini fallback** — when serverless proxy returns 404 (local dev), all functions fall back to direct API calls using the user's BYOK key

## Model Selection

- **Text operations** — `gemini-3.1-flash-lite-preview` (cheapest: $0.25/$1.50 per 1M tokens)
- **Image generation** — `gemini-3.1-flash-image-preview` (best value: $0.067/image) with Pro option `gemini-3-pro-image-preview` ($0.134/image)
- **Went through several model name iterations** — started with gemini-3.1-pro-preview, tried gemini-2.5-flash-preview (didn't exist), settled on flash-lite for text and flash-image for images

## Branding

- **Rebranded to Panelhaus.app** — top nav logo links to panelhaus.app, sidebar header and footer show branding, page title "Panelhaus — AI Comic Studio", PWA manifest name updated, meta description updated
- **"Continue to Dialogue" renamed to "Continue to Layouts"** — matches the actual workflow

## UI Polish

- **Panel labels** — smaller on mobile (`text-[8px]`, `px-2 py-0.5`)
- **Regenerate button** — bottom-right corner, 30% opacity, compact labels (REGEN/GEN)
- **Dev Guy description** — updated to "A cute bald man with a brown beard, light skin. Wears a light blue t-shirt. Heavy brows. Cartoon round style with bold outlines."

## Documents Created

| Document                           | Purpose                                                        |
| ---------------------------------- | -------------------------------------------------------------- |
| `project-review.md`                | Initial codebase assessment and Expo migration analysis        |
| `web-first-strategy.md`            | Web-first approach with Android as stretch goal                |
| `execution-plan.md`                | Detailed 4-phase implementation plan with code snippets        |
| `bugfix-plan.md`                   | Image cutoff, aspect ratio, generate queue fixes               |
| `mobile-ux-plan.md`                | Viewport, gestures, bottom sheets, compression, code splitting |
| `project-audit.md`                 | 57-issue audit across 10 categories with severity ratings      |
| `monetization-model.md`            | BYOK vs Freemium vs Hybrid analysis with pricing research      |
| `character-tagging-exploration.md` | @Mentions vs Tag Bar vs Rich Text for character references     |
| `changelog.md`                     | This document                                                  |

## Architecture Decisions

| Decision                                                               | Rationale                                                 |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| `usePersistedState` for small data, `useIndexedDBState` for large data | localStorage has 5-10MB limit, images need IndexedDB      |
| Serverless proxy + BYOK fallback                                       | Security on deployed, convenience on local dev            |
| Code splitting with `React.lazy`                                       | 65% main chunk reduction, faster first paint              |
| `@use-gesture/react` for swipe                                         | Lightweight, works with React state, axis-locked          |
| Bottom sheets over center modals                                       | Mobile-native feel, drag-to-dismiss                       |
| BYOK over hosted API key                                               | Zero cost to operate, users control their spending        |
| Character anchors in prompts                                           | Dramatically improves character consistency across panels |
| Flash-lite for text, flash-image for images                            | Cheapest models that still deliver quality                |
