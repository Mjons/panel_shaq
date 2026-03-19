# Panel Shaq - Project Review & Expo Migration Assessment

**Date:** 2026-03-19
**Reviewer:** Claude (AI-assisted review)
**Purpose:** Evaluate current project state and assess feasibility of migrating to Expo Go for Android + Mobile Web targets

---

## 1. Current Project Overview

**Panel Shaq** is an AI-powered comic book creation tool with a 5-screen workflow:

| Screen       | Purpose                                                                         |
| ------------ | ------------------------------------------------------------------------------- |
| **Workshop** | Story writing, character management, AI story polishing                         |
| **Director** | AI panel image generation with camera angles, moods, style/character references |
| **Layout**   | Arrange panels into comic pages (grid, vertical, dynamic templates)             |
| **Editor**   | Speech bubbles, dialogue positioning, final AI render, PDF/PNG export           |
| **Vault**    | Reusable asset library (characters, environments, props, vehicles)              |

### Current Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Framework  | React 19 + TypeScript               |
| Build Tool | Vite 6.2                            |
| Styling    | Tailwind CSS 4.1                    |
| Animations | Motion (Framer Motion) v12          |
| AI         | Google Gemini API (`@google/genai`) |
| Icons      | Lucide React                        |
| Export     | html-to-image + jsPDF               |
| Deployment | Google AI Studio / Cloud Run        |

### Current Target: **Web only** (SPA served via Vite)

---

## 2. Code Quality Assessment

### Strengths

- Well-organized screen/component structure
- Proper TypeScript typing throughout
- Clean separation of concerns (screens, services, components, lib)
- Good loading states and error handling for async operations
- Polished UI with cyberpunk dark theme, animations, and micro-interactions
- Mobile-first responsive design already in place
- Touch-friendly button sizing (48px+)

### Weaknesses

- **No tests** - zero test files, no test runner configured
- **No persistence** - state lost on page refresh (only export history uses localStorage)
- **No backend** - all logic client-side, express dependency installed but unused
- **Props drilling** - all state lives in App.tsx and is passed down; no state management library
- Settings, Help, Share, and Drafts features are placeholder/unimplemented
- No error boundaries

### Completion: ~90-95%

The core workflow (story -> panels -> layout -> dialogue -> export) is fully functional. The gaps are secondary features and infrastructure (tests, persistence, error boundaries).

---

## 3. Expo Migration Assessment

### What Needs to Change

#### High Effort (significant rework)

| Area                 | Current                             | Expo Equivalent                                       | Effort                                                |
| -------------------- | ----------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| **Rendering**        | HTML/CSS DOM elements               | React Native `<View>`, `<Text>`, `<ScrollView>`, etc. | **HIGH** - every screen needs rewrite                 |
| **Styling**          | Tailwind CSS utility classes        | NativeWind (Tailwind for RN) or StyleSheet            | **HIGH** - hundreds of Tailwind classes to migrate    |
| **Export (PDF/PNG)** | html-to-image + jsPDF (DOM-based)   | react-native-view-shot + expo-print or rn-pdf-lib     | **HIGH** - completely different APIs                  |
| **Navigation**       | Custom tab state in App.tsx         | React Navigation (expo-router)                        | **MEDIUM** - rewrite nav but logic is straightforward |
| **Animations**       | Motion (Framer Motion)              | React Native Reanimated or Moti                       | **MEDIUM** - different API, similar concepts          |
| **Image handling**   | `<img>` tags, data URLs, FileReader | expo-image-picker, expo-file-system, `<Image>`        | **MEDIUM** - different file/image APIs                |

#### Low Effort (mostly portable)

| Area                  | Notes                                                                        |
| --------------------- | ---------------------------------------------------------------------------- |
| **Gemini AI service** | `geminiService.ts` is pure JS/API calls - works as-is                        |
| **Business logic**    | Panel generation, story processing, bubble data structures - all portable    |
| **State management**  | App.tsx state pattern works in RN (but should upgrade to Zustand or similar) |
| **Icons**             | Lucide React has a `lucide-react-native` package                             |
| **TypeScript config** | Minor adjustments needed                                                     |

#### Not Available / Needs Alternative

| Feature                      | Issue                  | Solution                                             |
| ---------------------------- | ---------------------- | ---------------------------------------------------- |
| **html-to-image**            | No DOM in React Native | `react-native-view-shot` for screenshots             |
| **jsPDF**                    | DOM-dependent          | `expo-print` or `react-native-pdf-lib`               |
| **Tailwind CSS**             | Not native             | NativeWind v4 (Tailwind for RN) or manual StyleSheet |
| **Motion library**           | Web-only               | `react-native-reanimated` + `moti`                   |
| **CSS custom properties**    | Not supported          | Theme constants file                                 |
| **CSS blur/backdrop-filter** | Limited in RN          | `expo-blur` for blur effects                         |

---

## 4. Recommendation

### Don't do a full Expo rewrite. Use Expo with expo-router web support instead.

Here's why:

#### Option A: Full Expo Go Rewrite (NOT recommended)

- **Effort:** 3-5 weeks for a solo developer
- **Risk:** High - you're rewriting working code
- **Every screen** needs to be rebuilt from scratch with React Native primitives
- **Every Tailwind class** needs conversion
- **Export system** needs complete replacement
- You lose the polished web animations and styling
- Gemini image generation returns base64 - handling this differs in RN

#### Option B: Expo Router with Web + Android (RECOMMENDED)

- Use **Expo SDK 52+** with `expo-router` which supports **web AND native** from one codebase
- Keep your existing web screens mostly intact for the **mobile web** target
- Build native Android screens incrementally using **React Native** components
- Share business logic and AI services between both
- **Effort:** 1-2 weeks for initial setup, then incremental

#### Option C: Progressive Web App / TWA (WORTH CONSIDERING)

- Your app is already mobile-responsive with touch-friendly UI
- Wrap it as a **TWA (Trusted Web Activity)** for the Play Store
- Or add a **PWA manifest** for installable mobile web
- **Effort:** 1-3 days
- **Tradeoff:** No native device APIs, but you may not need them

---

## 5. If You Go With Expo (Option B), Here's the Path

### Phase 1: Project Setup

1. Initialize new Expo project with `expo-router` and TypeScript
2. Configure NativeWind v4 for Tailwind-like styling
3. Set up shared theme constants (colors, typography) from your current CSS
4. Install expo equivalents: `expo-image-picker`, `expo-file-system`, `expo-print`

### Phase 2: Port Core Logic

1. Copy `geminiService.ts` as-is (it's pure API calls)
2. Port TypeScript interfaces and data types
3. Set up state management (recommend **Zustand** - lightweight, works in both web and native)
4. Set up React Navigation / expo-router tabs

### Phase 3: Rebuild Screens (one at a time)

1. **Workshop** - text input + character list (simplest screen)
2. **Vault** - CRUD list/grid (straightforward)
3. **Director** - image display + controls (medium complexity)
4. **Layout** - grid arrangement (needs custom layout work)
5. **Editor** - speech bubbles + export (hardest screen, save for last)

### Phase 4: Export System

1. Replace html-to-image with `react-native-view-shot`
2. Replace jsPDF with `expo-print` (HTML-to-PDF) or `react-native-pdf-lib`
3. Use `expo-sharing` for share functionality
4. Use `expo-file-system` for saving to device

---

## 6. Key Risks & Considerations

| Risk                                              | Mitigation                                                                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Gemini image generation may be slow on mobile** | Add progress indicators, consider caching generated images                                                                   |
| **Base64 image handling differs in RN**           | Use expo-file-system to write temp files instead of holding large base64 strings in memory                                   |
| **No persistence currently**                      | This is the perfect time to add it - use AsyncStorage or expo-sqlite                                                         |
| **Speech bubble positioning on canvas**           | React Native doesn't have CSS `position: absolute` in the same way - use `react-native-gesture-handler` for drag positioning |
| **PDF export quality**                            | Test early - expo-print renders HTML to PDF which may differ from jsPDF output                                               |
| **Large bundle size**                             | Gemini SDK + PDF + image libs add up - monitor with expo-doctor                                                              |

---

## 7. Quick Wins Before Migration

Before starting any migration, consider these improvements to the current codebase:

1. **Add localStorage persistence** - save project state so refreshes don't lose work
2. **Add a PWA manifest** - makes the web app installable on Android immediately
3. **Add error boundaries** - prevent full-app crashes
4. **Extract state to Zustand** - makes the eventual migration much easier since Zustand works identically in React and React Native
5. **Remove unused express dependency** - dead weight

---

## 8. Final Verdict

The app is **well-built and nearly complete** as a web app. The core creative workflow works, the AI integration is solid, and the UI is polished.

**For Android distribution**, my recommendation order:

1. **PWA/TWA first** (days, not weeks) - get it in users' hands fast
2. **Expo with web support** (if you need native APIs like camera, local file access, push notifications)
3. **Full RN rewrite** (only if the above options prove insufficient)

The Gemini service layer, all your TypeScript types, and business logic will transfer cleanly to Expo. The UI is where 80% of the migration effort lives. Don't rewrite what's working unless you have a concrete reason native APIs are needed.
