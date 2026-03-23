# Warn User Before Switching Tabs During Generation

## Problem

When the user is generating panels (single or "Generate All") and switches to a different tab (Layout, Vault, Workshop, etc.), the generation state is lost:

1. The `generationQueue` and `currentlyGenerating` state lives in `DirectorScreen` — when the component unmounts on tab switch, the state is destroyed
2. The API call is already in flight — the Gemini API still processes and charges for the request
3. The response arrives but there's no component to receive it — the generated image is lost
4. When the user switches back to Director, the queue is empty and the panel still has no image

**Result:** User loses their generation, wastes an API call (counted against daily limits), and has to regenerate.

## Solution

Two complementary fixes:

### 1. Confirm dialog before switching away during generation

Intercept tab changes when `queueActive` is true and warn the user:

```
"Panels are still generating. Switching tabs will cancel the queue and any in-progress generations will be lost. Continue?"
```

### 2. Browser `beforeunload` warning

Also warn if the user tries to close the tab or navigate away from the entire app:

```typescript
useEffect(() => {
  if (!queueActive) return;
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = "";
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}, [queueActive]);
```

## Implementation

### Where the tab switch happens

Tab changes flow through `setActiveTab` in `App.tsx`. The Director doesn't control navigation — it's the BottomNav, TopNav sidebar, and various "Continue to..." buttons.

### Approach A: Guard in App.tsx (Recommended)

Wrap `setActiveTab` in a guard that checks if the Director is active and generating:

```typescript
// App.tsx
const [isGenerating, setIsGenerating] = useState(false);

const guardedSetActiveTab = (tab: string) => {
  if (activeTab === "director" && isGenerating && tab !== "director") {
    if (
      !window.confirm(
        "Panels are still generating. Switching tabs will cancel the queue. Continue?",
      )
    ) {
      return; // Stay on Director
    }
  }
  setActiveTab(tab);
};
```

Pass `guardedSetActiveTab` to BottomNav, TopNav, and any other navigation callsites instead of raw `setActiveTab`.

Pass `setIsGenerating` to DirectorScreen so it can report its generation state up:

```typescript
<DirectorScreen
  ...
  onGeneratingChange={setIsGenerating}
/>
```

In DirectorScreen:

```typescript
useEffect(() => {
  onGeneratingChange?.(queueActive);
}, [queueActive]);
```

### Approach B: Use `useConfirm` from existing dialog system

Instead of `window.confirm`, use the app's existing `useConfirm` hook for a styled dialog:

```typescript
const confirmed = await confirm(
  "Panels are still generating. Switching tabs will cancel the queue and waste API credits. Stay on this page?",
);
if (!confirmed) setActiveTab(tab);
```

This gives a nicer UI than the browser's native confirm dialog.

### What gets guarded

| Navigation source            | File                             | How to guard                                           |
| ---------------------------- | -------------------------------- | ------------------------------------------------------ |
| Bottom nav tabs              | `Navigation.tsx` → `onTabChange` | Pass guarded setter                                    |
| Top nav sidebar items        | `Navigation.tsx` → `onTabChange` | Same guarded setter                                    |
| "Continue to Layouts" button | `DirectorScreen.tsx`             | Already on Director, going to Layout — guard           |
| "Continue to Editor" button  | `LayoutScreen.tsx`               | Not relevant (Director isn't active)                   |
| Workshop "Generate Success"  | `App.tsx`                        | Navigates TO Director, not away — no guard needed      |
| Project Manager load/new     | `App.tsx`                        | Should also warn — loading a project during generation |

### beforeunload (browser close/refresh)

```typescript
// In DirectorScreen or App.tsx
useEffect(() => {
  if (!isGenerating) return;
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = "";
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}, [isGenerating]);
```

This shows the browser's native "Leave page?" dialog when the user tries to close or refresh during generation.

## UX Details

### Warning message

Keep it short and mention the consequence:

> **Generating in progress**
> Switching tabs will cancel the queue. Any in-progress panel will be lost and still count toward your daily limit.
>
> [Stay] [Leave anyway]

### Don't warn for safe navigations

- Switching to Settings should be fine (it's a modal-like overlay, not a real tab switch that unmounts Director)
- Opening the Project Manager should warn (loading a project resets everything)

## Future: Background generation

The ideal long-term fix is to move generation state out of DirectorScreen into App.tsx or a context, so it persists across tab switches. The API call would continue in the background and the result would be written to panel state regardless of which tab is active.

This is a bigger refactor but would eliminate the problem entirely. For now, the warning dialog is the right quick fix.

## Files to Modify

| File                             | Change                                                                     |
| -------------------------------- | -------------------------------------------------------------------------- |
| `src/App.tsx`                    | Add `isGenerating` state, `guardedSetActiveTab`, pass to navs and Director |
| `src/screens/DirectorScreen.tsx` | Add `onGeneratingChange` prop, `beforeunload` listener                     |
| `src/components/Navigation.tsx`  | No change — already receives `onTabChange` as prop                         |
