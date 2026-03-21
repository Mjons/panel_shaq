# Dialogue System UX Improvement Plan

## Current Problem

The dialogue/bubble system works but is confusing and ugly:

- Users don't know the workflow: select panel → add bubble → type text → position → final render
- The sidebar has three separate sections (INK TOOLS, EDIT BUBBLE, FINISH LINE) that feel disconnected
- Bubble positioning on mobile uses the sidebar sliders (not visible at same time as the panel)
- "Final Natural Render" is a confusing name — users don't know what it does
- No visual guide or onboarding for the flow

## The Ideal Flow

```
1. Select a panel (tap it)
2. Tap "+" to add a speech bubble
3. Tap the bubble on the panel to edit text (inline)
4. Drag the bubble to position it
5. Tap "Bake Dialogue" to permanently render bubbles into the image
```

---

## Options

### Option A: Guided Steps (Numbered Flow)

Replace the three sidebar sections with a single guided flow:

```
┌──────────────────────────────┐
│  DIALOGUE                    │
│                              │
│  ① Select a panel            │  ← grey when no panel selected
│  ② Add bubbles    [+]        │  ← enabled after panel selected
│  ③ Tap bubbles to edit       │  ← shows bubble list
│  ④ Drag to position          │  ← hint text
│  ⑤ Bake into image   [🪄]   │  ← the render button
│                              │
│  ┌────────────────────────┐  │
│  │ Bubbles on this panel: │  │
│  │ [Speech 1] [Thought 2] │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

Each step highlights when active. Steps grey out when not yet applicable.

**Pros:** Clear linear flow, hard to get lost
**Cons:** Takes up sidebar space, might feel patronizing for repeat users

---

### Option B: Inline Bubble Editing Only (No Sidebar)

Remove the sidebar bubble editing entirely. Everything happens directly on the panel:

- Tap panel → floating "+" button appears
- Tap "+" → bubble appears at center
- Tap bubble → inline floating toolbar (already built with DraggableBubble)
- Drag bubble to position
- "Bake" button floats at bottom of the panel when bubbles exist

The sidebar only shows the "Bake Dialogue" button and a bubble count.

**Pros:** All interaction is on the panel itself, no context switching, works great on mobile
**Cons:** Less discoverable for first-time users, floating UI can overlap

---

### Option C: Bottom Sheet on Mobile, Sidebar on Desktop

Mobile: Bubble editing happens in a bottom sheet that slides up when a bubble is selected. Shows text input, type selector, delete button. Panel stays visible above.

Desktop: Current sidebar approach but cleaned up into one unified section.

**Pros:** Best of both worlds, optimized per device
**Cons:** Two UIs to maintain

---

### Option D: Simplify + Rename + Add Hints (Minimum Viable)

Keep the current structure but:

1. **Merge** INK TOOLS + EDIT BUBBLE into one section called "DIALOGUE"
2. **Rename** "Final Natural Render" → "Bake Dialogue Into Image"
3. **Add step hints** — small numbered indicators showing the flow
4. **Add a first-time tooltip** that walks through the 4 steps
5. **Better empty state** — instead of "Select a panel first", show the flow visually

**Pros:** Smallest change, biggest clarity improvement
**Cons:** Doesn't solve the mobile sidebar visibility issue

---

## Recommendation: Option B + D hybrid

**Primary:** Option B — inline editing on the panel (DraggableBubble already does this). The tap-to-edit floating toolbar is already built and working. Just need to:

1. Add a floating "+" button on selected panels
2. Remove the sidebar bubble type/text/formatting (it's all in the floating toolbar now)
3. Keep only "Bake Dialogue" button in the sidebar

**Polish:** Option D — rename, add hints, better empty states for when users look at the sidebar.

### Resulting Sidebar

```
┌──────────────────────────────┐
│  DIALOGUE                    │
│                              │
│  How it works:               │
│  1. Select a panel           │
│  2. Tap + to add bubbles     │
│  3. Tap a bubble to edit     │
│  4. Drag to reposition       │
│                              │
│  Bubbles: 3 on this panel    │
│  [Speech] [Thought] [SFX]    │
│                              │
│  ┌────────────────────────┐  │
│  │  🪄 BAKE DIALOGUE      │  │
│  │  Permanently renders    │  │
│  │  bubbles into the image │  │
│  └────────────────────────┘  │
│                              │
│  ⚠️ This replaces the       │
│  original image. Download    │
│  first if you want to keep   │
│  the clean version.          │
└──────────────────────────────┘
```

### Resulting Panel Interaction

- Selected panel shows a floating "+" button (top-right or bottom-right)
- Tapping "+" adds a speech bubble at center
- Tapping a bubble opens the inline floating toolbar (type, text, size, delete)
- Dragging moves the bubble
- No sidebar editing needed — everything on the panel

---

## Implementation

| File                                              | Changes                                                                                                                                             |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/screens/EditorScreen.tsx`                    | Merge INK TOOLS + EDIT BUBBLE sections, add floating "+" on selected panels, rename "Final Natural Render", add step hints, add warning before bake |
| `src/components/DraggableBubble` (already exists) | Already handles tap-to-edit, drag, inline toolbar — no changes needed                                                                               |

### What to Remove from Sidebar

- Bubble type grid (speech/thought/action/effect) — already in floating toolbar
- Dialog text textarea — already in floating toolbar
- Font size buttons — already in floating toolbar
- Bold/Italic buttons — already in floating toolbar

### What to Keep in Sidebar

- Bubble list (clickable pills to select)
- "Bake Dialogue" button with warning
- Step-by-step hints
- Bubble count
