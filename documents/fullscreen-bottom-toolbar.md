# Full-Screen Panel Mode: Bottom Nav → Editing Toolbar

## Problem

When in full-screen panel editing mode, the bottom navigation bar still shows the 5 app tabs (Workshop, Director, Layout, Editor, Vault). These are useless in this context — the user is focused on editing one panel's bubbles and image. The bottom nav is wasted space that could be editing tools.

## Proposed Solution

When `fullscreenPanelId` is set, replace the bottom nav with a contextual editing toolbar for the panel and its dialogue.

## Design

### Normal Bottom Nav (default)

```
┌─────────────────────────────────────┐
│  🏠    📖    📋    ⊞    🌐         │
└─────────────────────────────────────┘
```

### Full-Screen Editing Toolbar (replaces bottom nav)

```
┌─────────────────────────────────────┐
│  [+Bubble] [Type] [🔒] [Bake] [✓]  │
└─────────────────────────────────────┘
```

**Buttons:**

| Button       | Icon          | Action                                                                                    |
| ------------ | ------------- | ----------------------------------------------------------------------------------------- |
| **+ Bubble** | Plus          | Add a new speech bubble to this panel                                                     |
| **Type**     | MessageSquare | Cycle bubble type (Speech → Thought → SFX → etc.) — only active when a bubble is selected |
| **Lock**     | Lock/Unlock   | Toggle panel lock (image moveable vs locked for bubble editing)                           |
| **Bake**     | Wand2         | Bake dialogue into image (with confirmation)                                              |
| **Done**     | Check         | Exit full-screen mode, return to composed page view                                       |

### Visual Treatment

Same frosted glass bar as the normal bottom nav (`bg-[#31394D]/60 backdrop-blur-xl rounded-2xl`), just different buttons. The active button glows orange like the current active tab.

## Implementation

### Option A: Prop-driven Bottom Nav (Recommended)

Pass a `mode` prop to `BottomNav`. When mode is `"fullscreen-edit"`, render the editing toolbar instead of the tab bar.

```typescript
// Navigation.tsx
export const BottomNav = ({
  activeTab,
  onTabChange,
  mode,
  onToolAction,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  mode?: "nav" | "fullscreen-edit";
  onToolAction?: (action: string) => void;
}) => {
  if (mode === "fullscreen-edit") {
    return (
      <nav className="bottom-nav fixed ..." style={{ bottom: "..." }}>
        <div className="bg-[#31394D]/60 backdrop-blur-xl rounded-2xl ...">
          <button onClick={() => onToolAction?.("add-bubble")}>
            <Plus />
          </button>
          <button onClick={() => onToolAction?.("cycle-type")}>
            <MessageSquare />
          </button>
          <button onClick={() => onToolAction?.("toggle-lock")}>
            <Lock /> or <Unlock />
          </button>
          <button onClick={() => onToolAction?.("bake")}>
            <Wand2 />
          </button>
          <button onClick={() => onToolAction?.("done")}>
            <Check />
          </button>
        </div>
      </nav>
    );
  }

  // ... existing tab nav
};
```

### Option B: Separate Component in EditorScreen

Render a separate fixed toolbar in the EditorScreen when in fullscreen mode, positioned to overlay the bottom nav's location. Simpler — doesn't touch Navigation.tsx.

```tsx
// Inside the fullscreen overlay in EditorScreen.tsx
// The bottom toolbar already exists — just enhance it to cover the bottom nav
<div
  className="fixed left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-[95]"
  style={{ bottom: "calc(var(--sab, 0px) + 1.5rem)" }}
>
  <div className="bg-[#31394D]/60 backdrop-blur-xl rounded-2xl shadow-[0_20px_40px_rgba(6,14,32,0.4)] flex justify-around items-center py-2 px-2">
    {/* Tool buttons */}
  </div>
</div>
```

**Recommendation: Option B** — it's self-contained in EditorScreen, doesn't require changing the Navigation component's interface, and the fullscreen overlay already has z-[90] which covers the bottom nav.

## Double-Tap to Exit

The user also wants double-tap while in full-screen to exit back to normal view. This mirrors the entry gesture — double-tap to enter, double-tap to exit.

```typescript
// In the fullscreen panel container's onClick:
onClick={() => {
  const now = Date.now();
  if (lastTapRef.current?.id === "fullscreen-exit" && now - lastTapRef.current.time < 400) {
    setFullscreenPanelId(null);
    lastTapRef.current = null;
  } else {
    lastTapRef.current = { id: "fullscreen-exit", time: now };
  }
}}
```

Note: Need to be careful this doesn't conflict with bubble tap/drag. The double-tap-to-exit should only trigger when tapping the panel background (not a bubble).

## State Flow

```
Normal view → double-tap panel → Full-screen mode
  Bottom nav: [Workshop] [Director] [Layout] [Editor] [Vault]
  ↓
Full-screen mode
  Bottom toolbar: [+Bubble] [Type] [Lock] [Bake] [Done ✓]
  ↓
Double-tap background OR tap Done → Normal view
```

## Files to Modify

| File                           | Change                                                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/screens/EditorScreen.tsx` | Replace the current fullscreen bottom bar with a fixed toolbar matching bottom nav styling. Add double-tap-to-exit on panel background. |

No changes to Navigation.tsx needed with Option B.
