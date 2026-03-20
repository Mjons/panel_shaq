# Panel Shaq — Project Audit

**Date:** 2026-03-20
**Scope:** Full codebase audit for risks, gaps, and refactoring opportunities

---

## Summary

| Category         | Critical | High   | Medium | Low    |
| ---------------- | -------- | ------ | ------ | ------ |
| Security         | 1        | 3      | 1      | -      |
| Code Quality     | -        | 1      | 4      | 1      |
| State Management | -        | 2      | 2      | 1      |
| Performance      | -        | 2      | 3      | 1      |
| Data Integrity   | -        | 1      | 3      | 1      |
| UX Gaps          | -        | 1      | 5      | 1      |
| Architecture     | -        | -      | 4      | 1      |
| Missing Features | -        | 1      | 5      | -      |
| DevOps           | -        | 1      | 4      | 1      |
| Mobile           | -        | -      | 3      | 3      |
| **Total: 57**    | **1**    | **12** | **34** | **10** |

### Top 5 Priorities

1. **API Key in client localStorage** — remove the settings API key field, all calls go through serverless proxy now
2. **Storage quota management** — images in localStorage will crash the app, need full IndexedDB migration
3. **Request timeouts** — API calls hang forever if Gemini is slow, need timeout wrapper
4. **Export race conditions** — PDF export loop uses setTimeout chains, needs proper async queue
5. **Image generation error recovery** — failed panels in queue have no retry, user is stuck

---

## Security

### CRITICAL: API Key Stored in Client localStorage

**File:** `src/screens/SettingsScreen.tsx`
**Problem:** The Settings screen lets users paste their Gemini API key into localStorage. Even though API calls now go through serverless functions, the key field is still there and exposes keys to any JS on the page.
**Fix:** Remove the `geminiApiKey` field from Settings entirely. All Gemini calls already go through `/api/` endpoints where the key lives in Vercel env vars. The Settings "Test Connection" should call `/api/health` instead.

### HIGH: Unvalidated File Upload Sizes

**File:** `src/screens/WorkshopScreen.tsx` (line ~74)
**Problem:** File size check is 5MB, but base64 encoding inflates it ~33%. A 5MB image becomes ~6.7MB in state. Multiple character images can quickly exceed storage limits.
**Fix:** Lower limit to 2MB. Compress images after upload (resize to max 1024px, JPEG 0.7).

### HIGH: localStorage Quota Overflow

**File:** `src/hooks/usePersistedState.ts`
**Problem:** `localStorage.setItem()` silently fails when quota (~5-10MB) is exceeded. The `catch` logs a warning but the user loses data.
**Fix:** Check quota before writing. Show a user-facing warning. Move large data to IndexedDB (characters, panels already partially migrated via `useIndexedDBState`).

### HIGH: No Rate Limiting on API Routes

**File:** `api/*.ts`
**Problem:** No rate limiting. A user (or bot) can spam image generation and burn through Gemini API quota.
**Fix:** Add simple in-memory rate limiting (5 requests/minute per IP) or use Vercel KV.

### MEDIUM: Missing Input Sanitization

**File:** `src/screens/VaultScreen.tsx`, `EditorScreen.tsx`
**Problem:** User text (vault names, bubble dialogue) rendered directly. Low XSS risk since it's all client-side React (auto-escapes), but exported HTML could carry payloads.
**Fix:** Validate max lengths. Sanitize before export.

---

## State Management

### HIGH: Export Loop Race Conditions

**File:** `src/screens/EditorScreen.tsx` (lines ~182-273)
**Problem:** PDF export uses `setTimeout` chains with `setSelectedPageIdx()` to cycle through pages. State updates and DOM rendering race against each other. Can produce blank or wrong pages in export.
**Fix:** Refactor to use a ref-based approach — pre-render each page to canvas without changing visible state. Or use `requestAnimationFrame` to ensure DOM is settled.

### HIGH: Stale Closure in Generation Queue

**File:** `src/screens/DirectorScreen.tsx` (lines ~746-800)
**Problem:** The `useEffect` that processes the queue captures `panels` from the closure. If a panel is updated while another is generating, the next generation uses stale panel data. Partially fixed with `panelSnapshot` but the `panels.find()` call still reads from the closure.
**Fix:** Use `setPanels` functional updater to read latest state. Or use a ref for the panels array.

### MEDIUM: Mixed Storage Backends

**Files:** `usePersistedState.ts`, `useIndexedDBState.ts`, `App.tsx`
**Problem:** Some state uses localStorage (`activeTab`, `story`, `pages`, `projectName`), some uses IndexedDB (`characters`, `panels`, `styleReferenceImage`). This split is correct for size reasons but creates migration complexity.
**Fix:** Document which hook to use where. Add a comment in App.tsx explaining the split.

### MEDIUM: No Debounce on State Persistence

**File:** `src/hooks/usePersistedState.ts`
**Problem:** Every keystroke in the story textarea triggers a localStorage write. On large stories this can cause jank.
**Fix:** Add 500ms debounce to the useEffect that writes to storage.

### LOW: beforeunload Save is Fire-and-Forget

**File:** `src/App.tsx` (line ~222)
**Problem:** `saveCurrentProject()` is async but `beforeunload` doesn't wait for promises. Data might not save on browser close.
**Fix:** Use `navigator.sendBeacon()` for critical data, or save synchronously to localStorage as backup.

---

## Performance

### HIGH: Base64 Image Bloat in State

**Files:** `WorkshopScreen.tsx`, `App.tsx`
**Problem:** Character images, style references, and generated panel images are all stored as full base64 data URLs in React state. A project with 6 panels + 3 characters can easily hold 20-30MB in memory.
**Fix:** Store image blobs in IndexedDB. Use `URL.createObjectURL()` for display. Only convert to base64 when needed for API calls.

### HIGH: Export Blocks Main Thread

**File:** `src/screens/EditorScreen.tsx`
**Problem:** `html-to-image` and `jsPDF` run on the main thread. Multi-page export with 600ms delays per page freezes the entire UI.
**Fix:** Move export to a Web Worker. Or at minimum, use `requestIdleCallback` between pages.

### MEDIUM: PanelCard Re-renders on Every Panel Update

**File:** `src/screens/DirectorScreen.tsx`
**Problem:** When any panel updates (e.g., image generated), ALL PanelCards re-render because `panels` array reference changes.
**Fix:** Wrap `PanelCard` in `React.memo()`. Pass only the specific panel by ID instead of the whole array.

### MEDIUM: No Image Lazy Loading

**File:** `src/screens/VaultScreen.tsx`
**Problem:** All vault entry images load immediately.
**Fix:** Add `loading="lazy"` to `<img>` tags.

### MEDIUM: Thumbnail Truncation Breaks Display

**File:** `src/App.tsx` (line ~186)
**Problem:** Project thumbnail is `base64.substring(0, 200) + "..."` which is an invalid image data URL. Project Manager shows broken thumbnails.
**Fix:** Either store a proper compressed thumbnail (resize to 100x75 canvas, toDataURL), or don't show thumbnails and use a placeholder icon.

### LOW: Font Loading Not Optimized

**File:** `index.html`
**Problem:** Google Fonts (Space Grotesk, Inter, Material Symbols) are render-blocking.
**Fix:** Add `font-display: swap` or preload critical fonts.

---

## Data Integrity

### HIGH: No Schema Validation on Loaded Projects

**File:** `src/App.tsx` (lines ~230-239)
**Problem:** `handleLoadProject` directly assigns project data to state with no validation. Old projects missing `artStyle`, `aspectRatio`, or `bubbles` fields will cause runtime errors.
**Fix:** Run `hydratePanel()` on all panels when loading. Validate all required fields exist with defaults.

### MEDIUM: Metadata Index Can Desync from IndexedDB

**File:** `src/services/projectStorage.ts`
**Problem:** Project metadata (localStorage) and full data (IndexedDB) are updated separately. If one write fails, they're out of sync.
**Fix:** Write to IndexedDB first, then update metadata only on success. Add a `verifyProjects()` function that checks for orphaned entries.

### MEDIUM: Auto-save Overwrites `createdAt`

**File:** `src/App.tsx` (line ~181)
**Problem:** `saveCurrentProject` sets `createdAt: new Date().toISOString()` every time. Should only be set on first save.
**Fix:** Check if project exists first, preserve original `createdAt`.

### MEDIUM: No Export History Persistence

**File:** `src/screens/EditorScreen.tsx` (line ~86)
**Problem:** The linter changed export history to session-only (removed localStorage). Exports disappear on refresh.
**Fix:** Store export metadata (name, date, size, type) in localStorage. Store actual data in IndexedDB or don't persist it.

### LOW: Vault "View Portfolio" is Dead

**File:** `src/screens/VaultScreen.tsx` (line ~290)
**Problem:** "View Portfolio" button exists but does nothing.
**Fix:** Remove the button or implement a detail view.

---

## UX Gaps

### HIGH: No Error Recovery for Failed Image Generation

**File:** `src/screens/DirectorScreen.tsx`
**Problem:** If image generation fails mid-queue, error is logged to console but the panel just stays empty. User can't retry.
**Fix:** Show error badge on failed panel with "Retry" button. Keep failed panels in a "failed" state distinct from "not generated".

### MEDIUM: No Auto-Save Indicator

**File:** `src/App.tsx`
**Problem:** Auto-save runs silently. User has no confidence their work is being saved.
**Fix:** Add a small indicator in the TopNav — dot that briefly pulses on save, or "Saved" text.

### MEDIUM: No Undo/Redo

**Problem:** Accidental deletions (panels, characters, vault entries) are permanent. `confirm()` dialogs are the only protection.
**Fix:** Implement undo stack. At minimum, add "Recently Deleted" with 30-second recovery.

### MEDIUM: Help Screen Not Implemented

**File:** `src/components/Navigation.tsx` (line ~121)
**Problem:** Help button in sidebar does nothing.
**Fix:** Add a simple help screen with workflow overview, keyboard shortcuts, and tips.

### MEDIUM: No Onboarding

**Problem:** New users land on Workshop with no guidance. The multi-screen workflow (Workshop → Director → Layout → Editor) isn't explained.
**Fix:** First-time tooltip tour or a brief animated walkthrough.

### MEDIUM: Drafts Button in Workshop is Placeholder

**File:** `src/screens/WorkshopScreen.tsx`
**Problem:** "Drafts" button visible but non-functional.
**Fix:** Remove the button or wire it to the Project Manager.

### LOW: Missing Form Validation Messages

**File:** `src/screens/VaultScreen.tsx`
**Problem:** Submit button is disabled when name/image missing but no explanation shown.
**Fix:** Show inline validation: "Name is required", "Image is required".

---

## Architecture

### MEDIUM: App.tsx Does Too Much

**File:** `src/App.tsx` (300+ lines)
**Problem:** Contains all app state, auto-save logic, project load/save, screen routing, and swipe gestures.
**Fix:** Extract into hooks: `useProject()` for state + persistence, `useAutoSave()` for save logic, `useSwipeNavigation()` for gestures.

### MEDIUM: Types Scattered Across Files

**Problem:** `Character` is defined in `App.tsx`, `PanelPrompt` in `geminiService.ts`, `Page` in `LayoutScreen.tsx`. Other files import from these creating implicit coupling.
**Fix:** Create `src/types.ts` with all shared interfaces.

### MEDIUM: DirectorScreen is 900+ Lines

**File:** `src/screens/DirectorScreen.tsx`
**Problem:** Contains `PanelCard`, `InsertPanelButton`, `PanelDraftCard`, `DirectorScreen`, generation queue logic, and 3 helper functions.
**Fix:** Extract `PanelCard` to its own file. Extract queue logic to `useGenerationQueue` hook.

### MEDIUM: No Shared Constants

**Problem:** Art style names, camera angles, moods, and localStorage keys are hardcoded as string literals throughout.
**Fix:** Create `src/constants.ts` with all shared values.

### LOW: Circular Import Risk

**Problem:** `projectStorage.ts` imports types from `App.tsx` and `LayoutScreen.tsx`. If those files ever import from `projectStorage`, circular dependency.
**Fix:** Move shared types to `src/types.ts`.

---

## DevOps

### HIGH: No Request Timeout on API Calls

**File:** `src/services/geminiService.ts`
**Problem:** `fetch()` calls have no timeout. If Gemini API is slow (common with image generation), requests hang forever with no user feedback.
**Fix:** Add `AbortController` with 60-second timeout. Show "Taking longer than expected..." after 15 seconds.

### MEDIUM: Vercel Function Timeout Risk

**File:** `api/generate-image.ts`
**Problem:** Image generation can take 30-60 seconds. Vercel Hobby plan has a 10-second limit (Pro has 60s). Could timeout on free tier.
**Fix:** Check Vercel plan. Consider streaming response or polling pattern for long operations.

### MEDIUM: No CI/CD Pipeline

**Problem:** No GitHub Actions. Lint/type check only runs manually.
**Fix:** Add `.github/workflows/ci.yml` with `npm run lint` and `npm run build` on PRs.

### MEDIUM: Missing .env.example for API Routes

**Problem:** `.env.example` exists but doesn't document that `GEMINI_API_KEY` is now used by serverless functions, not the client.
**Fix:** Update `.env.example` with comments explaining the server-side usage.

### LOW: Build Chunk Size Warning

**Problem:** EditorScreen chunk is 429KB. Vite warns about chunks > 500KB.
**Fix:** Further split: extract export logic into separate lazy-loaded module.

---

## Mobile

### MEDIUM: Editor Sidebar Not Mobile-Friendly

**File:** `src/screens/EditorScreen.tsx`
**Problem:** Editor uses a 3-column layout (`lg:grid-cols-12`) that collapses to single column on mobile. The left sidebar (Panel Transform + Ink Tools + Edit Bubble) stacks above the canvas, pushing it below the fold.
**Fix:** Move sidebar tools to a collapsible bottom panel or floating toolbar on mobile.

### MEDIUM: Swipe Navigation Not Discoverable

**File:** `src/App.tsx`
**Problem:** Swipe between tabs works but users don't know about it.
**Fix:** Show a one-time onboarding hint on first visit.

### MEDIUM: No Landscape Support

**Problem:** PWA manifest sets `orientation: portrait` but app doesn't adapt if user rotates.
**Fix:** Add landscape-specific layouts for Editor (side-by-side canvas + tools).

### LOW: Hover States Don't Work on Touch

**File:** Multiple components
**Problem:** `.group-hover:opacity-100` for edit/delete buttons on vault cards are invisible on touch devices.
**Fix:** Make edit/delete buttons always visible on mobile, or add long-press handler.

### LOW: Material Icons Render Late

**File:** `src/components/Navigation.tsx`
**Problem:** Bottom nav uses Material Symbols font — can flash unstyled text on slow connections.
**Fix:** Preload the font or use inline SVG icons for the nav.

### LOW: No Pull-to-Refresh

**Problem:** PWA users expect pull-to-refresh but it's not implemented.
**Fix:** Add pull-to-refresh that reloads project data from IndexedDB.

---

## Recommended Refactoring Order

### Phase 1: Critical Fixes (1-2 days)

1. Remove API key field from Settings screen
2. Fix thumbnail truncation (broken project manager images)
3. Add request timeout to all API calls
4. Add `hydratePanel()` validation on project load
5. Fix `createdAt` being overwritten on auto-save

### Phase 2: Storage & Performance (2-3 days)

1. Compress uploaded images on intake (resize to 1024px max)
2. Add debounce to `usePersistedState`
3. Fix export history persistence (metadata in localStorage, data in IndexedDB)
4. Add `React.memo` to PanelCard
5. Add `loading="lazy"` to all `<img>` tags

### Phase 3: UX Polish (2-3 days)

1. Auto-save indicator in TopNav
2. Error badges + retry on failed panel generation
3. Remove placeholder buttons (Drafts, View Portfolio, Help)
4. Add form validation messages to Vault
5. First-time onboarding tooltip

### Phase 4: Architecture (3-5 days)

1. Create `src/types.ts` for shared interfaces
2. Create `src/constants.ts` for shared values
3. Extract `useProject()` hook from App.tsx
4. Extract PanelCard to its own file
5. Extract generation queue to `useGenerationQueue` hook
6. Add CI/CD pipeline
