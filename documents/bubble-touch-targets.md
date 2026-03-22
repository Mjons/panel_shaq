# Bubble Touch Targets — The Problem

## What's Happening

When a user tries to interact with a speech bubble on a panel:

1. **Dragging a bubble** — finger often lands on the panel image instead of the bubble, moving the panel background
2. **Pinching to resize bubble text** — two fingers land partly on the bubble and partly on the panel, triggering a panel zoom instead of a bubble font size change
3. **Tapping to edit** — small bubble is hard to hit, tap lands on panel instead

The bubble's visual size is tiny (max-width 100px, often smaller). The actual touch target is only as big as the rendered bubble — there's no invisible padding around it to catch nearby touches.

## Why It's Hard

The bubble sits INSIDE the panel div. Both have gesture handlers:

- Panel: drag to reposition image, pinch to zoom
- Bubble: drag to move, tap to edit

When a touch lands near but not exactly on the bubble, the panel's gesture wins. On mobile, fingers are ~44px wide but bubbles can be 60-80px — leaving almost no margin.

## What We Want

When a bubble is **selected** (editing mode), touches near the bubble should be captured by the bubble, not the panel. The bubble's interactive area should be much larger than its visual size.

## Options

### Option A: Invisible Hit Area Expansion

Add an invisible padding layer around the bubble that captures touches but doesn't render visually:

```
Visual bubble: 80px wide
Touch target: 140px wide (30px invisible padding on each side)
```

```tsx
<div style={{ padding: "30px", margin: "-30px" }}>
  {/* actual visible bubble */}
</div>
```

The negative margin keeps the visual position correct while the padding expands the touch area.

**Pros:** Simple CSS trick, no gesture logic changes
**Cons:** Might overlap other bubbles' hit areas

### Option B: Panel Gestures Fully Disabled When Bubble Selected

We already lock panel drag when a bubble is selected. But pinch still works on the panel. Fully disable ALL panel gestures (drag + pinch) when any bubble is selected.

The user already has the sidebar slider for panel scale, or can deselect the bubble first (green ✓) to unlock panel gestures.

**Pros:** Zero touch conflicts, simple logic change
**Cons:** Can't adjust panel while editing bubbles (but that's already mostly true)

### Option C: Dedicated Resize Handles on Bubble

Instead of pinch-to-resize (which conflicts with panel pinch), add A+/A- buttons directly on the bubble when selected (these already exist in the floating toolbar).

Remove pinch-to-resize from bubbles entirely — it's the source of the conflict.

**Pros:** Eliminates the gesture conflict completely
**Cons:** No pinch gesture on bubbles (but A+/A- in toolbar already works)

## Recommendation: Option A + B

1. **Expand bubble touch targets** (Option A) — 30px invisible padding around each bubble so nearby taps/drags are captured
2. **Fully lock panel gestures when bubble selected** (Option B) — panel pinch is already mostly useless during bubble editing

This combination means:

- Taps near a bubble will hit the bubble, not the panel
- Dragging near a bubble will move the bubble, not the panel image
- Panel can't accidentally zoom while editing bubbles
- User taps green ✓ to exit bubble mode and unlock panel gestures
