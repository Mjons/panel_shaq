# Double-Tap Panel → Full-Screen Editing Mode

## Problem

On mobile, panels in the Editor are small — especially in multi-panel layouts (4-6 panels on a 3:4 page). Positioning speech bubbles, reading text, and fine-tuning placement is difficult at that scale. Users need to pinch-zoom the whole page just to work on one panel, then zoom back out.

## Proposed Solution

Double-tap (or long-press) a panel to enter a full-screen editing mode for that panel. The panel fills the screen, text bubbles are easier to see and drag, and tapping a "done" button returns to the composed page view.

## Design

### Full-Screen Panel View

```
┌─────────────────────────────────────┐
│  ← Back to Page       Panel 3 of 6 │
│─────────────────────────────────────│
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │     [panel image fills     │    │
│  │      most of the screen]    │    │
│  │                             │    │
│  │   ┌──────────┐              │    │
│  │   │ "Hello!" │              │    │
│  │   └──────────┘              │    │
│  │                             │    │
│  │            ┌───────────┐    │    │
│  │            │  *BOOM*   │    │    │
│  │            └───────────┘    │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  [+ Add Bubble]   [Lock/Unlock]     │
│                                     │
└─────────────────────────────────────┘
```

### Key Behaviors

- **Entry:** Double-tap a panel in the composed page view
- **Exit:** "← Back to Page" button at top, or swipe down
- **Panel fills screen:** The panel image takes up the full viewport width with its natural aspect ratio — much larger than in the grid
- **Bubbles are interactive:** Same drag/pinch/rotate behavior as in the grid view, just bigger and easier to manipulate
- **Bubble positions are percentage-based:** Already stored as `{ x: %, y: % }` so they map correctly between grid view and full-screen — no coordinate conversion needed
- **Lock/Unlock toggle visible:** Same lock button, just more accessible
- **Changes are live:** Moving a bubble in full-screen mode immediately updates the composed page — no "save" step

## Implementation

### State

```typescript
const [fullscreenPanelId, setFullscreenPanelId] = useState<string | null>(null);
```

### Double-Tap Detection

The panel `onClick` currently does `setSelectedPanelId(pid)`. Add double-tap detection:

```typescript
const lastTapRef = useRef<{ id: string; time: number } | null>(null);

const handlePanelTap = (pid: string) => {
  const now = Date.now();
  if (lastTapRef.current?.id === pid && now - lastTapRef.current.time < 300) {
    // Double tap — go fullscreen
    setFullscreenPanelId(pid);
    setSelectedPanelId(pid);
    lastTapRef.current = null;
  } else {
    // Single tap — select
    setSelectedPanelId(pid);
    lastTapRef.current = { id: pid, time: now };
  }
};
```

### Full-Screen Overlay

Render as a fixed overlay when `fullscreenPanelId` is set:

```tsx
{fullscreenPanelId && (() => {
  const panel = panels.find(p => p.id === fullscreenPanelId);
  if (!panel) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-outline/10">
        <button onClick={() => setFullscreenPanelId(null)}>
          ← Back to Page
        </button>
        <span>Panel {panels.indexOf(panel) + 1} of {currentPage.panelIds.length}</span>
      </div>

      {/* Panel — full width, natural aspect */}
      <div className="flex-1 relative overflow-hidden">
        <PanelImage panel={panel} ... />
        {/* Bubbles rendered at same percentage positions */}
        {panel.bubbles.map(bubble => (
          <DraggableBubble ... />
        ))}
      </div>

      {/* Bottom toolbar */}
      <div className="p-4 flex gap-3">
        <button onClick={addBubble}>+ Add Bubble</button>
        <button onClick={toggleLock}>Lock/Unlock</button>
      </div>
    </div>
  );
})()}
```

### What Stays the Same

- **Bubble positions:** Already `{ x: %, y: % }` — works at any panel size
- **Bubble interactions:** Same `DraggableBubble` component, same drag/pinch/rotate
- **Panel image transform:** Same `PanelImage` component with drag/pinch
- **State management:** Same `updateBubble`, `addBubble`, `removeBubble` — changes reflect in both views

### What Changes

- **Panel container size:** Grid cell → full viewport width
- **Touch targets:** Much larger — easier to tap and drag bubbles
- **Visibility:** Text is readable, bubble borders are clear, overlap is obvious

## Edge Cases

| Scenario                         | Behavior                                                                 |
| -------------------------------- | ------------------------------------------------------------------------ |
| Double-tap with no image         | Still opens full-screen (can add bubbles to empty panel)                 |
| Rotate device in full-screen     | Panel re-renders at new width, bubbles stay at same % positions          |
| Switch page while in full-screen | Exit full-screen, show new page                                          |
| Export while in full-screen      | Exit full-screen first, then export from composed view                   |
| Bake while in full-screen        | Could work — the panel image is the same object. But safer to exit first |

## Alternative Entry Methods

- **Long-press** instead of double-tap (avoids conflict with single-tap select)
- **"Expand" button** on each panel (small icon in the corner, like the lock button)
- **Pinch-to-zoom past a threshold** snaps to full-screen mode

Double-tap is the most natural for mobile users who are used to double-tapping images to zoom in.

## Future: Swipe Between Panels

Once in full-screen mode, swiping left/right could navigate between panels on the same page — editing them one by one without returning to the composed view. This would make the flow: double-tap → edit bubbles → swipe to next panel → edit → swipe → done → back to page.

## Files to Modify

| File                           | Change                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `src/screens/EditorScreen.tsx` | Add `fullscreenPanelId` state, double-tap detection, full-screen overlay rendering |

## Priority

Medium — this is a quality-of-life improvement. The app works without it, but it would significantly improve the mobile bubble-editing experience. Most impactful for pages with 4+ panels.
