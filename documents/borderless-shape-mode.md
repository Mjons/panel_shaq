# Borderless Shape Mode

## The Insight

The border effects (wobble, ink, sketch, etc.) look great as **image masks** — the organic clip-path shapes the panel beautifully. But the visible stroke line on top isn't always wanted. Sometimes you just want the shape without the border.

Right now, to get the clip-path shape, you must also have a visible colored border. There's no way to say "shape my panel with this effect but don't draw a line."

## What Users Want

Three distinct use cases:

| Use Case                      | Color    | Effect     | Visible Stroke  | Clip Shape        |
| ----------------------------- | -------- | ---------- | --------------- | ----------------- |
| No border                     | None     | None       | No              | No                |
| Solid color border            | Black    | None       | Yes (rectangle) | Yes (rectangle)   |
| Shaped + colored border       | Gold     | Sketch     | Yes (organic)   | Yes (organic)     |
| **Shaped, no visible border** | **None** | **Sketch** | **No**          | **Yes (organic)** |

That fourth case is what's missing. The effect shapes the image but no stroke is drawn.

## The Fix

When `borderColor` is "none" but a `borderStyle` effect is active:

- **Apply the clip-path** (organic shape) — this is the part users like
- **Don't render the SVG stroke** — no visible border line
- The image just has an organic edge that bleeds into the page background

### Implementation

In `PanelBorderWrapper`, the SVG stroke is already conditional. Just add a check: skip the stroke when color is "none":

```tsx
{svgPath && strokeColor !== "none" && (
  <svg ...>
    <path d={svgPath} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />
  </svg>
)}
```

The clip-path stays regardless — it's on the wrapper div, not the SVG.

### UI Change

The border effect presets should be selectable even when border color is "None." Currently the `PanelBorderWrapper` `active` condition is:

```tsx
active={hasActiveBorderStyle(panel.borderStyle) || (!!panel.borderColor && panel.borderColor !== "none")}
```

Change to:

```tsx
active={hasActiveBorderStyle(panel.borderStyle)}
```

And keep the color-only case working by also activating when color is set:

```tsx
active={hasActiveBorderStyle(panel.borderStyle) || (!!panel.borderColor && panel.borderColor !== "none")}
```

Wait — this already works. The issue is just that when color is "none," `active` depends only on `hasActiveBorderStyle`. If the user picks an effect preset, `active` is true, clip-path applies. We just need to not draw the stroke.

### Summary

One change in `PanelBorderWrapper`: conditionally hide the SVG stroke when `strokeColor` is "none" or unset. The clip-path always applies when an effect is active.

## Files to Change

| File                           | Change                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `src/screens/EditorScreen.tsx` | Add `strokeColor !== "none"` guard on SVG stroke render in `PanelBorderWrapper` |

**Effort: ~5 minutes**
