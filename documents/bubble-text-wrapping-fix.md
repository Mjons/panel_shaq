# Bubble Text Wrapping When Dragged to Edge

## Problem

When dragging a speech bubble toward the right (or bottom) edge of a panel, the text wraps onto multiple lines even though there's plenty of space for it to stay on one line. "Hello World" becomes:

```
Hello
World
```

This happens because the bubble's outer container is positioned with `left: X%` inside the panel. As X approaches 100%, the remaining space to the right of the container shrinks, and the browser wraps the text to fit within the panel boundary — even though the bubble visually overflows via `translate(-50%, -50%)`.

## Root Cause

**File:** `EditorScreen.tsx`, line ~260-270

```tsx
<div
  ref={containerRef}
  className="absolute z-20 touch-none"
  style={{
    left: `${bubble.pos.x}%`,
    top: `${bubble.pos.y}%`,
    transform: `translate(-50%, -50%) rotate(${...}deg)`,
    padding: "40px",
    margin: "-40px",
  }}
>
```

The container is `position: absolute` inside the panel. The browser calculates its available width as `parentWidth - left`, which shrinks as `left` increases. Even though `transform: translate(-50%)` visually shifts it left, CSS layout doesn't account for transforms when calculating available width — so the text wraps based on the untransformed position.

The inner div has `width: "fit-content"` which tells the browser "make me as wide as my content" — but the browser constrains "as wide as" by the containing block's available space.

## Possible Fixes

### Option A: `white-space: nowrap` on short text (Recommended)

For bubbles with short text (under ~40 characters), prevent wrapping entirely:

```tsx
style={{
  whiteSpace: bubble.text.length < 40 ? "nowrap" : "normal",
  width: "fit-content",
  maxWidth: bubble.text.length < 40 ? "none" : "200px",
}}
```

**Pros:** Simple, handles the common case (short dialogue). Long text still wraps naturally.
**Cons:** Arbitrary character threshold. Very long single words could extend outside the panel.

### Option B: `max-content` width + `overflow: visible`

Use `width: max-content` instead of `fit-content`, and ensure `overflow: visible` on the panel:

```tsx
style={{
  width: "max-content",
  maxWidth: "80vw", // safety cap
}}
```

`max-content` tells the browser "make me as wide as my content needs, ignore container constraints." Combined with `overflow: visible` on the panel container (which already exists for selected panels), the bubble can extend beyond the panel edge.

**Pros:** Natural behavior — text never wraps unless it hits the safety cap. Works for all bubble positions.
**Cons:** Long dialogue could extend way outside the panel. Needs a reasonable `maxWidth` cap.

### Option C: Fixed width based on font size

Give bubbles a fixed minimum width calculated from their font size and text length:

```tsx
const charWidth = bubble.fontSize * 0.55;
const minWidth = Math.min(bubble.text.length * charWidth, 300);

style={{
  width: "fit-content",
  minWidth: `${minWidth}px`,
}}
```

**Pros:** Width stays stable regardless of position. Text only wraps when genuinely long.
**Cons:** Monospace assumption doesn't work perfectly for proportional fonts. Needs tuning.

### Option D: Use `position: fixed` or portal for bubbles

Render bubbles in a portal (outside the panel DOM) and position them absolutely relative to the page. This completely decouples them from the panel's layout constraints.

**Pros:** Perfect fix — no wrapping issues ever. Bubbles are truly floating.
**Cons:** Significant refactor. Coordinate mapping between panel-relative percentages and page-absolute positions. Export/capture would need to re-inject bubbles into the panel DOM.

### Option E: `contain: none` + `overflow: visible` chain

Ensure every ancestor up to the panel has `overflow: visible` and no containment that would clip the bubble's intrinsic size calculation:

```tsx
// On the panel container:
style={{ overflow: isExporting ? "hidden" : "visible" }}

// On the bubble outer div:
style={{ width: "max-content" }}
```

**Pros:** Minimal change. Bubbles naturally overflow the panel boundary.
**Cons:** May conflict with panel image clipping. Need to only set `overflow: visible` when not exporting.

## Recommendation

**Start with Option A + B combined:**

1. Use `white-space: nowrap` for short text (under ~40 chars) — this covers 90% of speech bubbles
2. Use `width: max-content` instead of `fit-content` — this prevents the container constraint from causing wrapping
3. Add `maxWidth: "min(80vw, 300px)"` as a safety cap for long dialogue
4. Keep `overflow: visible` on selected panels (already exists)

```tsx
// Replace the current width/style on the inner bubble div:
style={{
  width: "max-content",
  maxWidth: "min(80vw, 300px)",
  whiteSpace: bubble.text.length < 40 ? "nowrap" : "normal",
  // ...rest of existing styles
}}
```

This is ~3 lines changed and handles the common case without any structural refactor.

## Testing

1. Create a speech bubble with "Hello World"
2. Drag it to the far right edge of a panel — should stay on one line
3. Create a long dialogue bubble — should still wrap at a reasonable width
4. Export as PNG — verify bubbles render correctly even when positioned near edges
5. Test on mobile — ensure `80vw` cap works on narrow viewports
