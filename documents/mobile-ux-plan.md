# Panel Shaq — Mobile UX Polish Plan

**Date:** 2026-03-19
**Scope:** 5 tasks to make the app feel native on mobile

---

## Task 8: Viewport + Safe Areas

Ensure the app respects notches, rounded corners, and home indicators on modern phones.

**File: `index.html`**

- Update viewport meta:
  ```html
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1, user-scalable=no"
  />
  ```
- `viewport-fit=cover` extends the app behind the notch/home indicator
- `maximum-scale=1, user-scalable=no` prevents accidental zoom on form focus (we handle zoom ourselves)

**File: `src/index.css`**

- Add safe area CSS variables:
  ```css
  :root {
    --sat: env(safe-area-inset-top);
    --sab: env(safe-area-inset-bottom);
  }
  ```

**File: `src/components/Navigation.tsx`**

- TopNav header: add `pt-[var(--sat)]` padding so content clears the notch/status bar
- BottomNav: change `bottom-6` to `bottom-[calc(var(--sab)+1.5rem)]` so it sits above the home indicator
- Alternatively: add `pb-[var(--sab)]` inside the bottom nav container

**File: `src/screens/WorkshopScreen.tsx` and `EditorScreen.tsx`**

- Handle virtual keyboard: when the keyboard opens on mobile, the bottom nav rides up and covers content
- Fix: detect keyboard open via `visualViewport.resize` event, hide bottom nav when keyboard is visible
- Pass a `setKeyboardOpen` callback from App.tsx, or use a simple CSS approach:
  ```css
  @media (max-height: 500px) {
    .bottom-nav {
      display: none;
    }
  }
  ```

**Test:**

- iPhone with notch (Safari) — top content not hidden behind status bar
- Android with gesture nav — bottom nav not overlapping home indicator
- Open a text input — keyboard doesn't push bottom nav into the content area

---

## Task 9: Touch Gestures

Add mobile-native interactions: swipe between tabs and pinch-to-zoom on panels.

**Install:**

```bash
npm install @use-gesture/react
```

### Swipe between tabs (App.tsx)

- Wrap `<main>` content in a gesture handler
- Detect horizontal swipe (threshold: 50px, velocity: 0.3)
- Ignore vertical scrolling (only trigger when deltaX > deltaY)
- Tab order: `["workshop", "director", "layout", "editor"]`
- Swipe left → next tab, swipe right → previous tab
- Add a subtle slide animation on tab change using Motion

```typescript
import { useDrag } from "@use-gesture/react";

const TAB_ORDER = ["workshop", "director", "layout", "editor"];

const bind = useDrag(
  ({ swipe: [swipeX], direction: [dx] }) => {
    if (swipeX === 0) return;
    const currentIdx = TAB_ORDER.indexOf(activeTab);
    if (currentIdx === -1) return;
    const nextIdx = currentIdx - swipeX; // swipe left = +1, right = -1
    if (nextIdx >= 0 && nextIdx < TAB_ORDER.length) {
      setActiveTab(TAB_ORDER[nextIdx]);
    }
  },
  { axis: "x", swipe: { distance: 50, velocity: 0.3 } },
);
```

**File: `src/App.tsx`**

- Add `useDrag` from `@use-gesture/react`
- Wrap `<main>` with `{...bind()}` spread
- Set `touch-action: pan-y` on the main element to prevent browser swipe-back

### Pinch-to-zoom on Editor panels (EditorScreen.tsx)

- Currently uses range sliders for scale/offset
- Add pinch gesture as an alternative input method on the selected panel
- When a panel is selected, pinch updates `imageTransform.scale`
- Two-finger drag updates `imageTransform.x` and `imageTransform.y`

```typescript
import { useGesture } from "@use-gesture/react";

const bind = useGesture({
  onPinch: ({ offset: [scale] }) => {
    updatePanel(selectedPanelId, {
      imageTransform: {
        ...transform,
        scale: Math.max(0.5, Math.min(3, scale)),
      },
    });
  },
  onDrag: ({ offset: [x, y], touches }) => {
    if (touches < 2) return; // only pan with 2 fingers
    updatePanel(selectedPanelId, {
      imageTransform: { ...transform, x, y },
    });
  },
});
```

**Files to modify:**

- `src/App.tsx` — swipe tab navigation
- `src/screens/EditorScreen.tsx` — pinch-to-zoom on selected panels

**Test:**

- Swipe left/right on any screen → tabs change smoothly
- Swipe doesn't trigger during vertical scroll
- Pinch on a selected panel in Editor → zoom in/out
- Two-finger drag → pan the image

---

## Task 10: Bottom Sheet Component + Modal Migration

Replace fixed-center overlay modals with mobile-friendly bottom sheets.

### Create `src/components/BottomSheet.tsx`

Reusable bottom sheet component:

- Slides up from bottom with spring animation (Motion library)
- Drag handle at top — drag down to dismiss (threshold: 100px)
- Backdrop with blur + dark overlay, tap to dismiss
- Max height `85vh`, scrollable content area
- Props: `isOpen`, `onClose`, `title`, `children`

```typescript
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}
```

Note: we already have a similar pattern in `ProjectManager.tsx` — extract the shared bottom sheet logic into this reusable component, then refactor ProjectManager to use it.

### Migrate WorkshopScreen character editor modal

**File: `src/screens/WorkshopScreen.tsx`** (line ~342)

- Currently: `<div className="fixed inset-0 z-50 flex items-center justify-center ...">`
- Replace with: `<BottomSheet isOpen={!!editingCharacter} onClose={...} title="Edit Character">`
- Move the form content inside the BottomSheet children

### Migrate VaultScreen create/edit modal

**File: `src/screens/VaultScreen.tsx`** (line ~378)

- Currently: `<div className="fixed inset-0 z-[100] flex items-center justify-center ...">`
- Replace with: `<BottomSheet isOpen={isModalOpen} onClose={handleCloseModal} title={editingEntry ? "Edit Entry" : "New Vault Entry"}>`
- Move the form content inside

### Refactor ProjectManager to use BottomSheet

**File: `src/components/ProjectManager.tsx`**

- Already has a bottom sheet pattern — refactor to use the shared `BottomSheet` component
- Keeps the project grid as children

**Files to create:**

- `src/components/BottomSheet.tsx`

**Files to modify:**

- `src/screens/WorkshopScreen.tsx` — character editor → BottomSheet
- `src/screens/VaultScreen.tsx` — entry editor → BottomSheet
- `src/components/ProjectManager.tsx` — use shared BottomSheet

**Test:**

- Open character editor on mobile → slides up from bottom
- Drag handle down → dismisses
- Tap backdrop → dismisses
- Content scrolls inside sheet if taller than viewport
- Works on both desktop and mobile (desktop can keep the same bottom sheet, it's fine)

---

## Task 11: Image Compression

Compress generated panel images before storing them to reduce localStorage/IndexedDB usage and improve performance on mobile.

**File: `src/services/geminiService.ts`**

Add a compression utility:

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

Apply after `generatePanelImage` returns and after `finalNaturalRender` returns — compress the base64 result before passing it back to the caller.

Note: The linter has refactored geminiService to use an API proxy (`apiPost`). The compression should be applied to the `result.image` return value in both `generatePanelImage` and `finalNaturalRender`.

**Test:**

- Generate a panel → check the base64 size in DevTools (should be smaller than before)
- Image quality should still look good at 0.8 JPEG quality
- Export PDF/PNG should still work correctly with compressed images

---

## Task 12: Code Splitting

Lazy-load screen components so the initial bundle is smaller and first paint is faster.

**File: `src/App.tsx`**

Replace static imports with `React.lazy`:

```typescript
const WorkshopScreen = React.lazy(() =>
  import("./screens/WorkshopScreen").then((m) => ({
    default: m.WorkshopScreen,
  })),
);
const DirectorScreen = React.lazy(() =>
  import("./screens/DirectorScreen").then((m) => ({
    default: m.DirectorScreen,
  })),
);
// ... same for LayoutScreen, EditorScreen, VaultScreen, SettingsScreen, ShareScreen
```

Note: since screens use named exports, we need the `.then(m => ({ default: m.X }))` wrapper. Alternatively, add `export default` to each screen file.

**Create `src/components/LoadingSkeleton.tsx`:**

```tsx
export const LoadingSkeleton = () => (
  <div className="pt-24 px-6 flex items-center justify-center min-h-[60vh]">
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
      <p className="text-[10px] text-accent/40 uppercase tracking-widest font-bold">
        Loading...
      </p>
    </div>
  </div>
);
```

Wrap `renderScreen()` output:

```tsx
<Suspense fallback={<LoadingSkeleton />}>{renderScreen()}</Suspense>
```

**Files to create:**

- `src/components/LoadingSkeleton.tsx`

**Files to modify:**

- `src/App.tsx` — lazy imports + Suspense wrapper

**Test:**

- Initial page load should be faster (check Network tab — main chunk should be smaller)
- Navigating to a new tab for the first time should briefly show the spinner, then load
- All screens should still work correctly after lazy loading

---

## Execution Order

| #   | Task                  | Files                                                                                | Complexity | Dependencies |
| --- | --------------------- | ------------------------------------------------------------------------------------ | ---------- | ------------ |
| 8   | Viewport + Safe Areas | `index.html`, `index.css`, `Navigation.tsx`                                          | Low        | None         |
| 9   | Touch Gestures        | `App.tsx`, `EditorScreen.tsx`                                                        | Medium     | npm install  |
| 10  | Bottom Sheet Modals   | New `BottomSheet.tsx`, `WorkshopScreen.tsx`, `VaultScreen.tsx`, `ProjectManager.tsx` | Medium     | None         |
| 11  | Image Compression     | `geminiService.ts`                                                                   | Low        | None         |
| 12  | Code Splitting        | `App.tsx`, new `LoadingSkeleton.tsx`                                                 | Low        | None         |

Tasks 8, 11, and 12 are independent and quick. Task 9 requires an npm install. Task 10 is the most UI-heavy but straightforward.

Recommended order: **8 → 12 → 11 → 9 → 10** (quick wins first, then the npm install and modal migration).
