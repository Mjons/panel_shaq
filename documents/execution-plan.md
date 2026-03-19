# Panel Shaq — Execution Plan

**Date:** 2026-03-19
**Goal:** Ship Panel Shaq as a polished mobile web app

---

## NOW — Persistence + PWA Manifest

### Task 1: Project State Persistence (localStorage)

Currently, all state lives in `App.tsx` and is lost on refresh. Only `comic_export_history` in `EditorScreen.tsx` uses localStorage.

**State that needs saving:**

| State Variable        | Location        | Type           | Storage Key            |
| --------------------- | --------------- | -------------- | ---------------------- |
| `story`               | App.tsx         | string         | `panelshaq_story`      |
| `characters`          | App.tsx         | Character[]    | `panelshaq_characters` |
| `panels`              | App.tsx         | PanelPrompt[]  | `panelshaq_panels`     |
| `pages`               | App.tsx         | Page[]         | `panelshaq_pages`      |
| `styleReferenceImage` | App.tsx         | string \| null | `panelshaq_style_ref`  |
| `activeTab`           | App.tsx         | string         | `panelshaq_active_tab` |
| Vault entries         | VaultScreen.tsx | VaultEntry[]   | `panelshaq_vault`      |

**Implementation — create `src/hooks/usePersistedState.ts`:**

```typescript
import { useState, useEffect } from "react";

export function usePersistedState<T>(key: string, defaultValue: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.warn(`Failed to save ${key} to localStorage`, e);
    }
  }, [key, state]);

  return [state, setState] as const;
}
```

**Changes to `App.tsx`:**

- Replace every `useState` with `usePersistedState` using the keys above
- Keep `hasApiKey` as regular useState (session-only)

**Changes to `VaultScreen.tsx`:**

- Replace the hardcoded `INITIAL_ENTRIES` useState with `usePersistedState("panelshaq_vault", INITIAL_ENTRIES)`

**Warning — base64 images in state:**

- `panels[].image` and `styleReferenceImage` contain base64 data URLs
- These can be large (several MB per image)
- localStorage has a ~5-10MB limit per origin
- **If this becomes a problem:** migrate image storage to IndexedDB using a small helper, keep metadata in localStorage

**Files to create:**

- `src/hooks/usePersistedState.ts`

**Files to modify:**

- `src/App.tsx` — swap useState → usePersistedState for 6 state variables
- `src/screens/VaultScreen.tsx` — swap useState for entries

---

### Task 2: Error Boundary

Create a top-level error boundary so a crash in one screen doesn't nuke the whole app.

**Create `src/components/ErrorBoundary.tsx`:**

```typescript
import React from "react";

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-headline font-bold text-primary">
              Something went wrong
            </h1>
            <p className="text-accent/60 text-sm">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-6 py-3 bg-primary text-background font-bold rounded-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Wrap in `main.tsx`:**

```tsx
<StrictMode>
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
</StrictMode>
```

**Files to create:**

- `src/components/ErrorBoundary.tsx`

**Files to modify:**

- `src/main.tsx` — wrap App in ErrorBoundary

---

### Task 3: PWA Manifest + Service Worker

**Install vite-plugin-pwa:**

```bash
npm install -D vite-plugin-pwa
```

**Update `vite.config.ts`** — add the PWA plugin:

```typescript
import { VitePWA } from "vite-plugin-pwa";

// inside plugins array:
VitePWA({
  registerType: "autoUpdate",
  manifest: {
    name: "Panel Shaq",
    short_name: "Panel Shaq",
    description: "AI-powered comic book creation studio",
    theme_color: "#0F172A",
    background_color: "#0F172A",
    display: "standalone",
    orientation: "portrait",
    start_url: "/",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  },
  workbox: {
    globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts",
          expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },
    ],
  },
});
```

**Update `index.html`** — add meta tags in `<head>`:

```html
<meta name="theme-color" content="#0F172A" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta
  name="apple-mobile-web-app-status-bar-style"
  content="black-translucent"
/>
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

**Create app icons:**

- `public/icons/icon-192.png` — 192x192
- `public/icons/icon-512.png` — 512x512
- Use your Panel Shaq logo/branding; placeholder solid orange squares work for now

**Files to create:**

- `public/icons/icon-192.png`
- `public/icons/icon-512.png`

**Files to modify:**

- `vite.config.ts` — add VitePWA plugin
- `index.html` — add PWA meta tags

---

### Task 4: Cleanup

- Remove `express` and `@types/express` from package.json (unused)
- Remove `dotenv` from dependencies (Vite handles env natively via `loadEnv`)
- Update package name from `"react-example"` to `"panel-shaq"`

```bash
npm uninstall express @types/express dotenv
```

**Files to modify:**

- `package.json` — name field + removed deps

---

### NOW — Deliverables Checklist

- [ ] `usePersistedState` hook created and wired into App.tsx + VaultScreen
- [ ] ErrorBoundary component created and wrapping App
- [ ] vite-plugin-pwa installed and configured
- [ ] PWA meta tags in index.html
- [ ] Placeholder app icons in public/icons/
- [ ] Dead dependencies removed
- [ ] Test: refresh browser → all state preserved
- [ ] Test: Chrome DevTools → Application → Manifest shows correctly
- [ ] Test: "Add to Home Screen" prompt works on Android Chrome

---

## Week 1 — Deploy + Domain

### Task 5: Vercel Deployment

**Why Vercel:** Zero-config Vite support, free tier, preview deploys per branch, instant rollbacks.

**Steps:**

1. Push repo to GitHub (fix the permissions issue first — or create manually via github.com)
2. Go to vercel.com → Import Project → select the repo
3. Framework preset: **Vite** (auto-detected)
4. Add environment variable: `GEMINI_API_KEY` = your key
5. Deploy

**Post-deploy:**

- Verify PWA manifest at `https://your-app.vercel.app/manifest.webmanifest`
- Test on real Android device via Chrome
- Test "Add to Home Screen"

### Task 6: Custom Domain (Optional)

- Buy a domain (Namecheap, Cloudflare, Google Domains)
- Add to Vercel project → Settings → Domains
- Vercel handles SSL automatically
- Update PWA `start_url` if needed

### Task 7: Environment & Security

**CRITICAL:** The Gemini API key is currently bundled into the client-side JavaScript via Vite's `define`. Anyone can extract it from the browser.

**Options (pick one):**

1. **Vercel Serverless Function (recommended):** Create `api/gemini.ts` that proxies requests to Gemini. Client calls your API, key stays server-side.
2. **Rate limiting + key restrictions:** In Google Cloud Console, restrict the API key to your domain. Not bulletproof but limits abuse.
3. **Accept the risk for now:** If this is a personal/demo project, ship it and fix later.

If going with option 1:

- Create `api/gemini.ts` (Vercel serverless function)
- Move all Gemini API calls to go through `/api/gemini`
- Update `geminiService.ts` to call your API endpoint instead of Google directly
- Key lives in Vercel env vars, never reaches the browser

### Week 1 — Deliverables Checklist

- [ ] Repo on GitHub
- [ ] Vercel project created and deployed
- [ ] Environment variable set on Vercel
- [ ] Test full workflow on deployed URL
- [ ] Test on Android Chrome (real device)
- [ ] Decide on API key strategy (option 1, 2, or 3 above)
- [ ] (Optional) Custom domain configured

---

## Week 2 — Mobile UX Polish

### Task 8: Viewport + Safe Areas

**Update `index.html`:**

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1"
/>
```

**Add safe area padding in `index.css`:**

```css
:root {
  --sat: env(safe-area-inset-top);
  --sab: env(safe-area-inset-bottom);
  --sal: env(safe-area-inset-left);
  --sar: env(safe-area-inset-right);
}
```

**Update Navigation.tsx:**

- TopNav: add `pt-[var(--sat)]` for notch/status bar
- BottomNav: add `pb-[var(--sab)]` for home indicator

**Handle virtual keyboard:**

- Add `visualViewport` listener in screens with text inputs (Workshop, Editor)
- When keyboard opens, scroll the active input into view
- Prevent bottom nav from riding up with the keyboard

**Files to modify:**

- `index.html`
- `src/index.css`
- `src/components/Navigation.tsx`
- `src/screens/WorkshopScreen.tsx` (keyboard handling)
- `src/screens/EditorScreen.tsx` (keyboard handling)

---

### Task 9: Touch Gestures

**Install:**

```bash
npm install @use-gesture/react
```

**Pinch-to-zoom on panels (DirectorScreen + EditorScreen):**

```typescript
import { useGesture } from "@use-gesture/react";

// On panel image containers:
const bind = useGesture({
  onPinch: ({ offset: [scale] }) => {
    /* update panel zoom */
  },
  onDrag: ({ offset: [x, y] }) => {
    /* pan the panel */
  },
});
```

**Swipe between screens:**

- Add horizontal swipe detection on the main content area in App.tsx
- Swipe left → next tab, swipe right → previous tab
- Tab order: workshop → director → layout → editor
- Only trigger on horizontal swipes (ignore vertical scrolling)

**Files to modify:**

- `src/App.tsx` — swipe navigation
- `src/screens/DirectorScreen.tsx` — pinch-to-zoom on panels
- `src/screens/EditorScreen.tsx` — pinch-to-zoom on panels

---

### Task 10: Bottom Sheet Modals

Replace overlay modals with mobile-native bottom sheets that slide up from the bottom.

**Create `src/components/BottomSheet.tsx`:**

- Slides up from bottom with spring animation (Motion)
- Drag handle at top — drag down to dismiss
- Backdrop blur + dark overlay
- Max height 85vh, scrollable content

**Replace these modals with bottom sheets:**

- WorkshopScreen character editor modal
- VaultScreen create/edit entry modal
- EditorScreen bubble editor (currently inline — move to bottom sheet for mobile)

**Files to create:**

- `src/components/BottomSheet.tsx`

**Files to modify:**

- `src/screens/WorkshopScreen.tsx`
- `src/screens/VaultScreen.tsx`
- `src/screens/EditorScreen.tsx`

---

### Task 11: Image Optimization

Generated panel images come back as uncompressed base64 from Gemini. On mobile networks this matters.

**Add compression before storing:**

```typescript
async function compressImage(base64: string, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = base64;
  });
}
```

**Add to `geminiService.ts`** — compress after generating, before returning.

**Files to modify:**

- `src/services/geminiService.ts`

---

### Task 12: Performance — Code Splitting

Lazy-load screens so the initial bundle is smaller.

**Update `App.tsx`:**

```typescript
const WorkshopScreen = React.lazy(() => import("./screens/WorkshopScreen"));
const DirectorScreen = React.lazy(() => import("./screens/DirectorScreen"));
const LayoutScreen = React.lazy(() => import("./screens/LayoutScreen"));
const EditorScreen = React.lazy(() => import("./screens/EditorScreen"));
const VaultScreen = React.lazy(() => import("./screens/VaultScreen"));
```

Wrap `renderScreen()` output in `<Suspense fallback={<LoadingSkeleton />}>`.

**Files to create:**

- `src/components/LoadingSkeleton.tsx` (simple spinner/skeleton)

**Files to modify:**

- `src/App.tsx` — lazy imports + Suspense
- Each screen file — change to default exports if not already

---

### Week 2 — Deliverables Checklist

- [ ] Viewport meta updated, safe areas handled
- [ ] Virtual keyboard doesn't break layout
- [ ] Pinch-to-zoom works on panel images
- [ ] Swipe between tabs works
- [ ] Bottom sheet component created
- [ ] Character editor uses bottom sheet
- [ ] Vault editor uses bottom sheet
- [ ] Image compression added to Gemini service
- [ ] Screens lazy-loaded with code splitting
- [ ] Test on slow 3G (Chrome DevTools throttling)
- [ ] Test on at least 2 real Android devices

---

## Week 3 — Settings, Share, Project Save/Load

### Task 13: Settings Screen

**Create `src/screens/SettingsScreen.tsx`:**

Sections:

1. **API Configuration**
   - Gemini API key input (masked, with show/hide toggle)
   - "Test Connection" button — calls a lightweight Gemini API endpoint
   - Status indicator (connected / not connected / error)

2. **Export Preferences**
   - Default export format (PDF / PNG)
   - Export quality (Standard / High / Maximum)
   - Auto-include page numbers (toggle)

3. **App Preferences**
   - Auto-save interval (Off / 30s / 1m / 5m)
   - Clear all project data (with confirmation dialog)
   - Clear export history

4. **About**
   - App version
   - Credits / links

**Store settings in localStorage:**

```typescript
interface AppSettings {
  geminiApiKey: string;
  defaultExportFormat: "pdf" | "png";
  exportQuality: "standard" | "high" | "maximum";
  autoSaveInterval: number; // ms, 0 = off
  includePageNumbers: boolean;
}
```

**Wire up navigation:**

- Add "settings" case to `renderScreen()` in App.tsx
- Make the Settings button in sidebar menu functional (Navigation.tsx)

**Files to create:**

- `src/screens/SettingsScreen.tsx`

**Files to modify:**

- `src/App.tsx` — add settings tab/screen, settings state
- `src/components/Navigation.tsx` — wire Settings button
- `src/services/geminiService.ts` — read API key from settings if not in env

---

### Task 14: Share Functionality

The "share" tab exists in BottomNav but has no screen.

**Create `src/screens/ShareScreen.tsx`:**

Features:

1. **Quick Share**
   - Uses Web Share API (`navigator.share()`) — native share sheet on mobile
   - Share current comic as PNG image
   - Share as PDF attachment
   - Fallback: copy image to clipboard if Web Share not supported

2. **Export History** (move from EditorScreen)
   - List of previous exports with download buttons
   - Delete individual exports
   - "Clear All" button

3. **Share Preview**
   - Thumbnail grid of all pages
   - Select which pages to include
   - Add title/watermark before sharing

**Web Share API usage:**

```typescript
async function shareComic(blob: Blob, title: string) {
  if (navigator.canShare?.({ files: [new File([blob], "comic.png")] })) {
    await navigator.share({
      title,
      files: [new File([blob], `${title}.png`, { type: "image/png" })],
    });
  } else {
    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.png`;
    a.click();
  }
}
```

**Files to create:**

- `src/screens/ShareScreen.tsx`

**Files to modify:**

- `src/App.tsx` — add share tab/screen
- `src/screens/EditorScreen.tsx` — remove export history (moved to Share), keep export buttons

---

### Task 15: Project Save/Load (Multiple Projects)

Let users save, name, and switch between comic projects.

**Data structure:**

```typescript
interface SavedProject {
  id: string;
  name: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  thumbnail: string; // first panel image, compressed
  story: string;
  characters: Character[];
  panels: PanelPrompt[];
  pages: Page[];
  styleReferenceImage: string | null;
}
```

**Storage strategy:**

- Project metadata (id, name, dates, thumbnail) → localStorage as index
- Full project data → IndexedDB (handles large base64 images better than localStorage)
- Use a small IndexedDB wrapper — create `src/services/projectStorage.ts`

**UI — Add project management to Workshop screen or a new modal:**

1. **"My Projects" button** in TopNav (replace or augment CREATE button)
2. **Project list bottom sheet:**
   - Grid of saved projects with thumbnails
   - Tap to load
   - Long-press or swipe for delete
   - "New Project" card at the beginning
3. **Auto-save indicator** in TopNav — small dot that shows save status
4. **"Save As" option** — name and save current project

**The CREATE button behavior changes:**

- Currently: wipes all state to defaults
- New: opens "My Projects" sheet, with "New Project" as the first option
- Old project is auto-saved before switching

**Files to create:**

- `src/services/projectStorage.ts` — IndexedDB wrapper for projects
- `src/components/ProjectManager.tsx` — project list bottom sheet

**Files to modify:**

- `src/App.tsx` — integrate project load/save, auto-save timer
- `src/components/Navigation.tsx` — update CREATE button, add save indicator
- `src/hooks/usePersistedState.ts` — may need to coordinate with project system

---

### Task 16: Auto-Save

Implement auto-save based on the interval set in Settings.

**Logic in `App.tsx`:**

```typescript
useEffect(() => {
  if (settings.autoSaveInterval === 0 || !currentProjectId) return;

  const timer = setInterval(() => {
    saveCurrentProject(); // writes to IndexedDB
  }, settings.autoSaveInterval);

  return () => clearInterval(timer);
}, [settings.autoSaveInterval, currentProjectId]);
```

**Also save on:**

- Tab/screen change
- Before `handleCreateNew`
- On `beforeunload` event (browser close/refresh)

**Files to modify:**

- `src/App.tsx` — auto-save logic

---

### Week 3 — Deliverables Checklist

- [ ] Settings screen created with API key config + preferences
- [ ] Settings accessible from sidebar menu
- [ ] Gemini service reads API key from settings (fallback to env var)
- [ ] Share screen created with Web Share API integration
- [ ] Export history moved to Share screen
- [ ] Share works on Android Chrome (native share sheet)
- [ ] IndexedDB project storage service created
- [ ] Project Manager bottom sheet (save, load, delete projects)
- [ ] Auto-save working at configured intervals
- [ ] Save indicator in TopNav
- [ ] CREATE button opens project manager
- [ ] Test: create project → add content → switch projects → switch back → content preserved
- [ ] Test: close browser → reopen → last project auto-loaded
- [ ] Test: 5+ projects saved without hitting storage limits

---

## File Change Summary

### New Files (10)

| File                                 | Phase  |
| ------------------------------------ | ------ |
| `src/hooks/usePersistedState.ts`     | NOW    |
| `src/components/ErrorBoundary.tsx`   | NOW    |
| `public/icons/icon-192.png`          | NOW    |
| `public/icons/icon-512.png`          | NOW    |
| `src/components/BottomSheet.tsx`     | Week 2 |
| `src/components/LoadingSkeleton.tsx` | Week 2 |
| `src/screens/SettingsScreen.tsx`     | Week 3 |
| `src/screens/ShareScreen.tsx`        | Week 3 |
| `src/services/projectStorage.ts`     | Week 3 |
| `src/components/ProjectManager.tsx`  | Week 3 |

### Modified Files (10)

| File                             | Phases              |
| -------------------------------- | ------------------- |
| `src/App.tsx`                    | NOW, Week 2, Week 3 |
| `src/main.tsx`                   | NOW                 |
| `src/screens/VaultScreen.tsx`    | NOW, Week 2         |
| `src/screens/WorkshopScreen.tsx` | Week 2              |
| `src/screens/EditorScreen.tsx`   | Week 2, Week 3      |
| `src/screens/DirectorScreen.tsx` | Week 2              |
| `src/components/Navigation.tsx`  | Week 2, Week 3      |
| `src/services/geminiService.ts`  | Week 2, Week 3      |
| `src/index.css`                  | Week 2              |
| `index.html`                     | NOW, Week 2         |
| `vite.config.ts`                 | NOW                 |
| `package.json`                   | NOW                 |
