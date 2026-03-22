# Editor Panel Size & Discoverability Issues

## Problem 1: Panels Too Small to Edit

In the Editor, the comic page renders at the layout's aspect ratio with all panels visible. On mobile, a 4-panel or 6-panel layout means each panel is tiny — maybe 150x100px on a phone screen. Trying to:

- Pinch a specific panel without touching neighboring panels
- Drag a bubble inside a cramped panel
- Tap precisely on a small bubble

...is nearly impossible. Fingers are ~44px wide, panels can be as small as 80px.

### Options

#### A: Tap-to-Zoom Panel (Focus Mode)

When user taps a panel, zoom into JUST that panel filling most of the screen. All editing happens in the zoomed view. Tap outside or a back button to zoom out.

```
Normal view:          Focused view:
┌────┬────┐          ┌──────────────────┐
│ 1  │ 2  │   tap    │                  │
├────┼────┤  ───►    │    Panel 2       │
│ 3  │ 4  │          │    (full width)  │
└────┴────┘          │                  │
                     └──────────────────┘
```

**Pros:** Tons of room to edit, pinch, drag bubbles. Clean UX.
**Cons:** Lose context of surrounding panels. Need a way to navigate between panels.

#### B: Horizontal Panel Carousel

Instead of showing the layout grid, show panels in a swipeable horizontal carousel — one panel at a time, full width.

```
◄ [  Panel 2 of 6  ] ►
┌──────────────────────┐
│                      │
│   (full screen)      │
│                      │
└──────────────────────┘
```

**Pros:** Each panel gets the full screen. Swipe between panels.
**Cons:** Can't see the layout. Completely different view from what's exported.

#### C: Two Views — Layout Preview + Panel Editor

Split the editor into two modes:

- **Layout view** (current) — shows the page with all panels, read-only overview
- **Panel view** — tap any panel in layout view → opens it full-screen for editing

A toggle or tab switches between them: `[Layout] [Panel]`

**Pros:** Best of both worlds. Layout for overview, Panel for editing.
**Cons:** More UI to manage. Two modes might confuse users.

#### D: Pinch-to-Zoom the Entire Page

Let users pinch-zoom the entire comic page (like zooming a photo). They zoom into the area they want to edit, edit at the zoomed level, then zoom back out.

**Pros:** Natural mobile gesture. No mode switching.
**Cons:** Conflicts with bubble pinch-to-resize. Complex gesture disambiguation. Scrolling becomes two-dimensional.

---

## Problem 2: Dialogue Not Discoverable

Users don't realize they can add speech bubbles until they look closely at the sidebar. The "+" button and "DIALOGUE" section are easy to miss, especially on mobile where the sidebar is below the fold.

### Options

#### E: Floating Action Button (FAB)

A floating "+" button overlaid on the selected panel. Prominent, always visible, mobile-friendly.

```
┌──────────────┐
│              │
│   Panel 2    │
│         [+]  │  ← floating button, bottom-right of selected panel
└──────────────┘
```

Tap it → adds a speech bubble at the center of the panel.

**Pros:** Immediately visible when a panel is selected. Standard mobile pattern.
**Cons:** Could overlap panel content. Needs to not interfere with gestures.

#### F: Empty State Prompt

When a panel is selected and has no bubbles, show a centered prompt:

```
┌──────────────────┐
│                  │
│  Tap + to add    │
│  dialogue        │
│       [+]        │
│                  │
└──────────────────┘
```

**Pros:** Teaches the user exactly what to do. Self-documenting.
**Cons:** Only shows once (when no bubbles). Disappears after first bubble.

#### G: Bottom Action Bar (Mobile)

On mobile, show a sticky bottom bar when a panel is selected:

```
┌──────────────────────────┐
│  [+ Bubble] [Bake] [⚙]  │
└──────────────────────────┘
```

**Pros:** Always visible, always accessible. Standard mobile pattern.
**Cons:** Takes screen space. Another bar competing with the nav.

---

## Recommendation

### For panel size: Option A (Tap-to-Zoom) + C (Two Views)

When user taps a panel in the layout view, animate-zoom into that panel filling ~80% of the screen width. Show a small "back to layout" button in the corner. All editing (bubbles, pinch, drag) happens in this zoomed view.

This is the minimal viable fix:

- Layout view stays as-is for overview
- Tapping a panel zooms in for editing
- Zoomed view has plenty of room for gestures
- Back button or swipe down to return to layout

### For discoverability: Option E (FAB) + F (Empty State)

- Floating "+" button on the selected panel (always visible)
- If panel has no bubbles, also show "Tap + to add dialogue" text
- FAB disappears during export

### Implementation

| File                     | Change                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `EditorScreen.tsx`       | Add "focused panel" state. When set, render just that panel at full width instead of the grid. Add FAB on selected panel. |
| No new components needed | The zoomed view is just a conditional render of one panel instead of the grid                                             |

### Focused Panel View

```tsx
const [focusedPanelId, setFocusedPanelId] = useState<string | null>(null);

// In render:
{focusedPanelId ? (
  // Single panel, full width, with all editing controls
  <FocusedPanelEditor panel={...} onBack={() => setFocusedPanelId(null)} />
) : (
  // Normal layout grid (existing code)
  <div className="grid ...">{...}</div>
)}
```

The focused view renders ONE panel at full width with:

- The panel image (with pinch/drag transform)
- Bubble overlay (drag, tap to edit)
- FAB for adding bubbles
- "Back to layout" button
- Bake dialogue button
