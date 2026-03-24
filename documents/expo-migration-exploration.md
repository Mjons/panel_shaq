# Expo Go Migration Exploration

## Why

Get Panel Shaq into the Google Play Store for discoverability. The PWA works but doesn't show up in app store searches, which is where most casual users find apps.

## Current Stack

| Layer                | Web (Now)                              | Expo Equivalent                             |
| -------------------- | -------------------------------------- | ------------------------------------------- |
| UI                   | Tailwind CSS, `clsx`, `tailwind-merge` | NativeWind (Tailwind for RN) or StyleSheet  |
| Animations           | `motion` (Framer Motion)               | `react-native-reanimated`                   |
| Gestures             | `@use-gesture/react`                   | `react-native-gesture-handler`              |
| Icons                | `lucide-react`                         | `lucide-react-native` (exists)              |
| Image export         | `html-to-image`                        | `react-native-view-shot`                    |
| PDF export           | `jsPDF`                                | `expo-print` + `expo-sharing`               |
| Storage (small)      | `localStorage`                         | `@react-native-async-storage/async-storage` |
| Storage (large)      | IndexedDB (`useIndexedDBState`)        | `expo-sqlite` or `expo-file-system`         |
| API calls            | `fetch` to Vercel functions            | Same — `fetch` works in RN                  |
| Supabase             | `@supabase/supabase-js`                | Same package (has RN support)               |
| Gemini SDK           | `@google/genai`                        | Same — JS SDK works in RN                   |
| PWA / Service Worker | `vite-plugin-pwa`                      | Not needed — it's a native app              |
| Web Share            | `navigator.share()`                    | `expo-sharing` / `react-native-share`       |
| File downloads       | Blob + `<a>` click trick               | `expo-file-system` + `expo-sharing`         |
| Routing              | Tab state in React (`activeTab`)       | `expo-router` or keep manual                |

## Effort Breakdown

### Easy Ports (1-2 days)

These work with minimal changes:

- **API layer** — Vercel functions stay as-is. Mobile just calls the same endpoints. Zero changes.
- **Supabase** — Same JS SDK, same usage tracking.
- **Gemini SDK** — Works in RN out of the box.
- **State management** — `useState`, `useCallback`, `useMemo` all work. Just swap persistence layer.
- **Business logic** — All generation, prompt building, panel management logic is pure JS. Copy-paste.

### Medium Effort (1-2 weeks)

Requires finding equivalent libraries and adapting code:

- **Gestures** — `@use-gesture/react` → `react-native-gesture-handler`. The drag/pinch/rotate interactions in EditorScreen are the most complex part. Same concepts, different API surface. ~3-5 days.
- **Animations** — `motion` → `react-native-reanimated`. Most animations are simple (fade, slide, scale). The PreviewCarousel swipe animation is the trickiest. ~2-3 days.
- **Storage** — `localStorage` → AsyncStorage (small data). IndexedDB → `expo-sqlite` or write images to filesystem via `expo-file-system`. The `usePersistedState` and `useIndexedDBState` hooks need rewriting. ~2 days.
- **Icons** — `lucide-react` → `lucide-react-native`. Drop-in replacement, just change imports. ~1 day.

### Hard Rewrites (2-4 weeks)

These have no direct equivalent and need rethinking:

- **All UI/styling** — Every `className` string in every component needs to become either NativeWind classes or `StyleSheet` objects. There are 7 screens + ~10 components, all heavily styled with Tailwind. This is the bulk of the work. ~2-3 weeks.
- **Image export pipeline** — `html-to-image` captures DOM nodes as images. RN has no DOM. Replace with `react-native-view-shot` to capture View components. The multi-page PDF export loop (`EditorScreen`) needs complete rewriting. ~3-5 days.
- **Canvas operations** — Thumbnail generation, image compression, and the image transform (translate/scale/rotate) all use `<canvas>`. In RN, use `expo-image-manipulator` for resize/compress, and `react-native-reanimated` + `react-native-gesture-handler` for transforms. ~3 days.
- **Bottom sheets / modals** — `BottomSheet` component uses DOM positioning. Replace with `@gorhom/bottom-sheet` (standard RN library). ~1-2 days.
- **Custom dropdowns** — Lens picker, aspect ratio picker are custom DOM dropdowns. Need RN equivalents (Modal + FlatList). ~1-2 days.

## Total Estimate

| Category                                            | Effort        |
| --------------------------------------------------- | ------------- |
| Project setup (Expo init, config, navigation)       | 2-3 days      |
| Easy ports (API, Supabase, Gemini, logic)           | 1-2 days      |
| Medium ports (gestures, animations, storage, icons) | 1-2 weeks     |
| Hard rewrites (all UI, image export, canvas)        | 2-4 weeks     |
| Testing + polish                                    | 1 week        |
| **Total**                                           | **5-8 weeks** |

## Alternative: TWA (Trusted Web Activity)

Before committing to a full rewrite, consider wrapping the existing PWA as an Android app:

**What:** A TWA is a Chrome browser tab running fullscreen, packaged as an APK. Your web app appears in the Play Store as a native app.

**Pros:**

- Zero code changes — ship the exact same web app
- Takes 1-2 days to set up (Bubblewrap CLI or PWABuilder)
- Automatic updates — deploy to Vercel, users get new version instantly
- Full Play Store listing, screenshots, ratings

**Cons:**

- Requires Chrome on the device (98%+ of Android users have it)
- Slightly less "native feel" than true RN (no native transitions, slightly different scroll physics)
- Google Play review may flag it as a "webview app" if it's too thin
- No access to native APIs beyond what the web platform offers

**Verdict:** If the goal is purely Play Store exposure, TWA gets you there in days, not months. You can always do the full Expo rewrite later if TWA limitations become a problem.

## Alternative: Capacitor

**What:** A thin native shell that runs your existing web code inside a WebView, with plugins for native APIs.

**Pros:**

- Keep 95% of your existing code — it's still a web app
- Add native plugins for camera, filesystem, sharing, push notifications
- Takes ~1 week to set up and configure
- Full Play Store distribution

**Cons:**

- Still a WebView under the hood — not true native rendering
- Gesture performance slightly worse than native (but fine for most use cases)
- Larger APK than a true RN app

**Verdict:** Middle ground between TWA (zero effort) and Expo (full rewrite). You get native API access without rewriting your UI.

## Recommendation

**Ship a TWA first** (1-2 days). Get into the Play Store immediately with zero code changes. Measure whether Play Store presence actually drives downloads. If it does and users complain about the web feel, then invest in Capacitor or Expo.

The full Expo rewrite is 5-8 weeks of work to achieve the same functionality you already have. That time is better spent on features unless there's a specific native capability you need (push notifications, background processing, etc.) — and you don't.

---

## If You Do Go Expo

### Project Structure

```
panel-shaq-mobile/
├── app/                    # expo-router screens
│   ├── (tabs)/
│   │   ├── workshop.tsx
│   │   ├── director.tsx
│   │   ├── layout.tsx
│   │   ├── editor.tsx
│   │   └── vault.tsx
│   ├── settings.tsx
│   └── share.tsx
├── components/             # shared components
├── services/               # API, Gemini, Supabase (mostly copy-paste)
├── hooks/                  # adapted hooks
└── assets/                 # lens images, icons
```

### Key Dependencies

```json
{
  "expo": "~52.0.0",
  "expo-router": "~4.0.0",
  "react-native-reanimated": "~3.16.0",
  "react-native-gesture-handler": "~2.20.0",
  "@gorhom/bottom-sheet": "^5.0.0",
  "react-native-view-shot": "^4.0.0",
  "expo-sharing": "~12.0.0",
  "expo-file-system": "~18.0.0",
  "expo-print": "~13.0.0",
  "expo-image-manipulator": "~12.0.0",
  "@react-native-async-storage/async-storage": "^2.0.0",
  "nativewind": "^4.0.0",
  "lucide-react-native": "^0.400.0",
  "@supabase/supabase-js": "^2.99.0",
  "@google/genai": "^1.29.0"
}
```

### What You Keep As-Is

- All Vercel API endpoints (mobile calls the same URLs)
- All prompt building logic in `geminiService.ts`
- All data interfaces (`PanelPrompt`, `VaultEntry`, `Page`, `Bubble`, etc.)
- Supabase usage tracking
- Layout template definitions (`LAYOUT_TEMPLATES`)
- Style constants (`VAULT_STYLES`, `LENS_OPTIONS`, etc.)

### What Gets Rewritten

- Every `.tsx` component (new UI layer)
- `usePersistedState` → AsyncStorage wrapper
- `useIndexedDBState` → expo-sqlite or expo-file-system wrapper
- Image export pipeline
- Gesture handlers
- All CSS → NativeWind or StyleSheet
