# Panel Shaq — Product Documentation

**AI-Powered Comic Book Creation Studio**
**Version:** 0.1.0 | **Last Updated:** 2026-03-22

---

## What Is Panel Shaq?

Panel Shaq is a mobile-first web app that lets you create complete comic books using AI. You write a story, define characters, generate panel artwork with Google Gemini AI, arrange pages, add dialogue bubbles, and export finished comics as PDF, PNG, or `.comic` files compatible with Panel Haus Desktop.

The entire workflow runs in the browser. No downloads, no installs. Bring your own Gemini API key and start creating.

---

## The 5-Screen Workflow

Panel Shaq is built around a linear creative pipeline. Each screen handles one phase of comic creation.

### 1. Workshop — Write Your Story

The Workshop is where your comic begins. It handles story writing, character management, and AI-assisted polishing.

**What you can do:**

- **Write or paste your story** in a freeform text area
- **Create characters** with names, descriptions, and reference images
  - Upload your own character art (any image format)
  - Use **AI Auto-Describe** to analyze an uploaded image and generate an appearance-only description automatically
  - Use **AI Generate** to create a character reference image from a name and description
- **Character Tag Bar** — shows which characters are mentioned in your story (green = mentioned, gray = not). Tap a gray tag to insert the character name at your cursor
- **AI Polish** — sends your story to Gemini for rewriting. Returns only polished text with no commentary
- **Generate Panels** — AI breaks your story into individual comic panel descriptions with camera angles, moods, and character assignments
- **Set the art style implicitly** — your character reference images define the comic's visual style. Upload cartoon characters for a cartoon comic, manga characters for manga, etc. No style dropdowns needed
- **Name your project** with an editable inline field
- **Numbered step flow** (Characters → Style → Story → Polish → Generate) with instructional text for new users

**Character system details:**

- Characters are shared with the World Vault (single source of truth)
- Max 5 reference images per panel across all asset types
- Character names in the story get replaced with `[CHARACTER: Name — Description]` anchors before AI generation, ensuring consistent character identity across panels

---

### 2. Director — Generate Panel Art

The Director is the visual engine. Each panel from the Workshop appears as a card with generation controls.

**What you can do:**

- **Edit panel descriptions** — refine what each panel should depict
- **Select characters per panel** — toggle which characters appear (max 5 references total including other assets)
- **Choose camera angle** — options like Close-Up, Wide Shot, Bird's Eye, Low Angle, Dutch Angle, Over-the-Shoulder, etc.
- **Choose camera lens** — 12 options with thumbnail previews: Default, Fish-eye 8mm, Ultra Wide 14mm, Wide 24mm, Cinematic 35mm, Standard 50mm, Portrait 85mm, Telephoto 135mm, Extreme Telephoto 200mm, Macro, Tilt-Shift, Anamorphic
- **Choose mood** — Dramatic, Peaceful, Tense, Comedic, Mysterious, Romantic, Action, Horror, etc.
- **Set aspect ratio** — Square (1:1), Landscape (16:9), Portrait (9:16), Classic (4:3), Tall (3:4), Poster (2:3), Photo (3:2), Ultra Wide (21:9). Default is 3:4
- **Generate individual panels** — click Generate on any panel card
- **Generate All** — queues all panels for sequential generation (no parallel API calls)
- **Upload your own panel art** — use photos, hand-drawn scans, or images from other tools (10MB limit)
- **Regeneration notes** — add per-panel notes that feed into the next generation prompt
- **Insert panels** — AI suggests cinematically paced insert panels (reaction shots, detail inserts, atmospheric beats, transitions) that complement neighboring panels
- **Preview carousel** — fullscreen swipeable view of all generated panels with per-panel regeneration
- **Download All** — batch download all generated images

**Generation queue:** Clicking generate on multiple panels queues them sequentially. Each panel shows Queued/Generating status badges.

**Onboarding banner:** First-time users see a dismissible "Step 2 of 4 — Plan Your Panels" guide explaining available actions. Auto-hides once images are generated.

---

### 3. Layout Architect — Arrange Pages

The Layout screen lets you arrange panels into comic book pages using templates.

**What you can do:**

- **Choose a global layout template** — applies to all pages at once
- **Choose per-page templates** — each page can have its own layout independently
- **Set panels per page** — 1 to 6 panels per page, adjustable globally or per-page
- **Template library:**
  - 1-panel: Full Page
  - 2-panel: Equal Split, Top Heavy
  - 3-panel: Classic, Action Strip, T-Shape
  - 4-panel: Grid, Cinematic, 1+3 Top, Z-Shape
  - 5-panel: Feature Top, Cross
  - 6-panel: Classic Grid, Hero + 5
- **Repartition panels** — when you change panel count per page, panels automatically redistribute
- **Template picker** — 5-column grid with visual thumbnails

**Onboarding banner:** "Step 3 of 4 — Arrange Your Pages"

---

### 4. Editor — Dialogue & Export

The Editor is where you add speech bubbles, position them, and export your finished comic.

**What you can do:**

- **Add speech bubbles** to any panel — tap to place, drag to reposition
- **5 bubble types:**
  - **Speech** — standard white bubble with border
  - **Thought** — cloud-style thought bubble
  - **SFX** — bold yellow text with black stroke, no bubble border
  - **SFX Impact** — large bold red text with heavy black stroke + red glow, aggressive tilt, wide letter spacing (CRASH, BOOM, WHAM)
  - **SFX Ambient** — soft blue italic text with subtle shadow, wide letter spacing (drip, hummm, tick)
- **Floating toolbar** — appears when a bubble is selected. Toggle bubble type, edit text, adjust font size (A-/A+), delete. Fixed to bottom-center of screen for mobile reachability
- **Pan and zoom** — drag to pan, pinch to zoom (mobile), scroll-wheel to zoom (desktop, 0.5x–4.2x range)
- **Reset Position** — snap back to default view
- **Download individual pages** as images
- **Share This Page** — native share sheet on mobile, download fallback on desktop
- **Navigate to Share tab** via "Export & Share" button

**Comic Critique Corner:**

- AI-powered feedback on your composed comic pages
- Two modes: "Critique This Page" (single) or "Critique All Pages" (full comic)
- Captures live composed pages (panels + bubbles + layout) for analysis
- Structured feedback: Composition, Pacing, Dialogue, Visual Storytelling, Overall score out of 10
- "Get Another Critique" to re-run

**Onboarding banner:** "Step 4 of 4 — Final Touches"

---

### 5. World Vault — Reusable Asset Library

The World Vault is your persistent library of reusable creative assets shared across all projects.

**What you can do:**

- **Create and manage assets** in four categories:
  - **Characters** — people, creatures, heroes, villains
  - **Environments** — locations, settings, backdrops
  - **Props** — objects, weapons, items
  - **Vehicles** — cars, ships, mechs
- **Upload reference images** for any asset
- **AI Generate reference images** — type-specific prompts and aspect ratios:
  - Character: front-facing portrait (3:4)
  - Environment: wide establishing shot (16:9)
  - Prop: clean product shot (1:1)
  - Vehicle: three-quarter view (4:3)
- **Characters sync with Workshop** — create a character here and it appears in the Workshop, and vice versa
- **Select assets as panel references** in the Director — environments, props, and vehicles can influence generation alongside characters

**Onboarding banner:** "Your World Bible"

---

## Sharing & Export

### Share Screen

- **Web Share API** integration — triggers native Android/iOS share sheet
- **Export history** — list of previous exports with per-item share, download, and delete
- **Copy app link** button
- **Export for Panel Haus Desktop** — generates a `.comic` file with:
  - Grid-to-pixel coordinate conversion (490x700 page dimensions)
  - Bubble type mapping (speech→speech-bubble, thought→thought-bubble, etc.)
  - Vault entries as Desktop Blueprints
  - Story wrapped as `generatedStories[]`
  - Summary showing panel, vault, and page counts

### Panel Haus Desktop Bridge

Panel Shaq can send projects directly to Panel Haus Desktop via WebSocket:

- **Auto-detection** — probes `ws://127.0.0.1:9876` to check if Desktop is running
- **One-click transfer** — converts Panel Shaq format to Panel Haus format and sends over WebSocket
- **Data transformation** — full property mapping between formats (page dimensions, panel coordinates, bubble styles, blueprint assets)
- Desktop imports the project and opens it on canvas immediately

---

## Settings

- **Gemini API Key** — enter your key with show/hide toggle, test connection button
- **Image model selector:**
  - Flash ($0.067/image) — default, best value
  - Pro ($0.134/image) — higher quality
- **Export preferences** — format (PDF/PNG) and quality settings
- **Auto-save interval** — Off / 30 seconds / 1 minute / 5 minutes
- **Clear data** — wipe project data or export history

---

## Project Management

- **Multiple projects** — save, name, and switch between comic projects
- **IndexedDB storage** — full project data stored in IndexedDB (handles large base64 images), metadata index in localStorage
- **Project Manager** — bottom sheet grid showing saved projects with thumbnails
- **Auto-save** — configurable interval (default 30s), saves to IndexedDB, fires on browser close
- **Real thumbnails** — 120px-wide JPEG thumbnails generated via canvas (not truncated base64)
- **New/Load button** — opens Project Manager instead of wiping state
- **Persistent state** — refreshing the browser preserves all work (story, characters, panels, pages, vault)

---

## AI Models & API

Panel Shaq uses Google Gemini AI for all generative features:

| Function                     | Model                          | Cost                      |
| ---------------------------- | ------------------------------ | ------------------------- |
| Story polishing              | gemini-3.1-flash-lite-preview  | $0.25/$1.50 per 1M tokens |
| Panel description generation | gemini-3.1-flash-lite-preview  | $0.25/$1.50 per 1M tokens |
| Panel image generation       | gemini-3.1-flash-image-preview | ~$0.067/image             |
| Panel image generation (Pro) | gemini-3-pro-image-preview     | ~$0.134/image             |
| Character auto-describe      | gemini-3.1-flash-lite-preview  | Minimal cost              |
| Reference image generation   | gemini-3.1-flash-image-preview | ~$0.067/image             |
| Comic critique               | gemini-3.1-flash-lite-preview  | Minimal cost              |

**API key strategy:** BYOK (Bring Your Own Key). Users provide their own Gemini API key via Settings. Google offers free tier credits. The deployed version uses Vercel serverless functions to proxy API calls (keeping keys server-side), with direct BYOK fallback for local development.

---

## Technical Architecture

| Layer      | Technology                                     |
| ---------- | ---------------------------------------------- |
| Framework  | React 19 + TypeScript                          |
| Build      | Vite 6.2                                       |
| Styling    | Tailwind CSS 4.1                               |
| Animations | Motion (Framer Motion) v12                     |
| AI         | Google Gemini API (@google/genai)              |
| Icons      | Lucide React                                   |
| Export     | html-to-image + jsPDF                          |
| Gestures   | @use-gesture/react                             |
| Storage    | localStorage + IndexedDB                       |
| Deployment | Vercel (serverless functions)                  |
| PWA        | vite-plugin-pwa (installable, offline-capable) |

**Key architectural decisions:**

- **`usePersistedState`** for small data, **IndexedDB** for large data (images) — localStorage has 5-10MB limit
- **Serverless proxy + BYOK fallback** — security on deployed, convenience on local dev
- **Code splitting** with `React.lazy` — 65% main chunk reduction (1127KB → 396KB)
- **Image compression** — generated images converted to JPEG 0.8 quality before storing
- **Character anchors in prompts** — dramatically improves character consistency across panels
- **Single source of truth** — VaultEntry is the canonical type, Character is an alias. Workshop and Vault share the same data

---

## Mobile-First UX

Panel Shaq is designed for phones first:

- **Touch-friendly** — 48px+ button targets throughout
- **Bottom sheet modals** — drag-to-dismiss, mobile-native feel
- **Swipe navigation** — horizontal swipe between tabs (Workshop → Director → Layout → Editor)
- **Viewport safe areas** — notch padding, home indicator clearance, keyboard-aware layout
- **Bottom navigation** — 5 tabs matching the workflow order
- **Hamburger menu** — quick access to all screens + settings
- **Floating bubble toolbar** — fixed to bottom-center, never clipped by overflow

**Desktop handling:**

- Desktop visitors (viewport >= 1024px, no touch) see a redirect gate suggesting Panel Haus Desktop at panelhaus.app
- 16-second countdown auto-redirects; "Stay on mobile version anyway" dismisses permanently
- Scroll-to-zoom in Editor on desktop (0.5x–4.2x)

---

## Onboarding

- **First-time API key setup** — BYOK onboarding screen with link to Google AI Studio
- **Step-by-step banners** on each screen:
  - Workshop: numbered steps with instruction text
  - Director: "Step 2 of 4 — Plan Your Panels"
  - Layout: "Step 3 of 4 — Arrange Your Pages"
  - Editor: "Step 4 of 4 — Final Touches"
  - Vault: "Your World Bible"
- **First-time generate tip** — modal warning about missing character descriptions, mentions Auto-Describe
- All banners are dismissible and persist dismissal in localStorage

---

## Help Panel

Inline help accessible from the sidebar:

- **Sections:** Workflow overview, World Vault tips, Director guide, Editor guide, Layout guide, API key setup
- Scrollable (max 50vh), no external navigation required

---

## Performance

- **Code splitting** — all 7 screens lazy-loaded with skeleton fallbacks
- **React.memo** on PanelCard — only re-renders when own props change
- **Stable callbacks** — `useCallback` wrappers prevent unnecessary re-renders
- **Image compression** — JPEG 0.8 quality reduces storage footprint
- **Service worker** — skipWaiting + clientsClaim for immediate updates on deploy
- **ErrorBoundary** — auto-retries twice before showing error UI (handles IndexedDB race conditions)

---

## Deployment

- **Hosted on Vercel** at panel-shaq.vercel.app
- **6 serverless API endpoints** proxy all Gemini calls server-side:
  - `/api/generate-image` — panel art generation
  - `/api/generate-panels` — story-to-panel breakdown
  - `/api/polish-story` — AI story polishing
  - `/api/analyze-character` — auto-describe character images
  - `/api/critique-comic` — comic page critique
  - `/api/generate-reference` — vault asset image generation
- **PWA installable** — add to home screen on Android/iOS for full-screen, app-like experience
- **Offline-capable** — service worker caches app shell; generated content stored in IndexedDB

---

## Relationship to Panel Haus Desktop

Panel Shaq is the **mobile companion** to Panel Haus Desktop (an Electron app at panelhaus.app). They share a creative ecosystem:

- **Export `.comic` files** from Panel Shaq that open natively in Desktop
- **WebSocket bridge** for live transfer when Desktop is running locally
- **Format compatibility** — Panel Haus Desktop has a built-in adapter that auto-detects Panel Shaq format
- Panel Shaq focuses on **mobile creation** (write stories, generate art, quick edits)
- Panel Haus Desktop focuses on **professional editing** (canvas editor, advanced layouts, full export suite)

---

## Future Roadmap

| Feature            | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| Cloud sync         | Supabase backend — save projects across devices                 |
| User accounts      | Google auth (pairs with Gemini ecosystem)                       |
| TWA for Play Store | Wrap PWA as Android app via Trusted Web Activity                |
| Capacitor          | Native APIs (camera, file system, push notifications) if needed |
| Community gallery  | Share finished comics publicly                                  |
| Template library   | Pre-built story templates                                       |
| Collaboration      | Share projects, co-edit comics                                  |
