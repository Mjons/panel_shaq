# Image Masking to Border Shapes

## The Question

When a border effect is active (wobble, jitter, ink), the panel's outer edge clips to the organic shape via `clip-path: path()`. But does the panel **image** actually get masked to that shape, or does it poke out?

## Current State

`PanelBorderWrapper` applies `clipPath` on a `div` that wraps all panel content:

```tsx
<div style={{ clipPath: `path('${svgPath}')` }}>
  {children}  <!-- PanelImage, bubbles, lock button, etc. -->
  <svg>...</svg>  <!-- border stroke -->
</div>
```

This **should** clip the image. `clip-path: path()` on a div clips all its children — images, SVGs, everything. The image can't extend beyond the clip boundary.

## Does It Actually Work?

### Yes, in most cases

CSS `clip-path: path()` is well-supported:

- Chrome 88+ (2021)
- Safari 13.1+ (2020)
- Firefox 97+ (2022)
- All modern mobile browsers

The clip applies to the entire element and its children, including:

- `<img>` tags (panel images)
- Absolutely positioned children (bubbles, lock icon)
- The SVG border overlay itself
- Overflow content

### Potential Issues

| Issue                                         | Status    | Notes                                                                                                                                                                |
| --------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clip-path: path()` with fixed px coordinates | Works     | Path is recalculated via ResizeObserver on every size change                                                                                                         |
| Image transform (drag/pinch/scale)            | Works     | The image moves within the clipped area — overflow is hidden by the clip                                                                                             |
| Bubbles extending beyond panel                | Clipped   | Bubbles are already `overflow-hidden` on the parent, clip-path reinforces this                                                                                       |
| `html-to-image` export                        | Works     | CSS clip-path is captured in DOM-to-image conversion                                                                                                                 |
| Very high displacement (ink 100)              | Minor gap | At extreme intensities, the path indents far enough that a sliver of the parent background shows at the panel edges. This is by design — it's the "hand-drawn" look. |
| Rounded preset with no displacement           | Works     | Clean rounded rectangle clip, no issues                                                                                                                              |

### The One Real Problem: `preserveAspectRatio="none"` on the SVG

The SVG overlay uses `preserveAspectRatio="none"` which stretches the viewBox to fill the div. But the `clip-path: path()` uses the **same pixel coordinates** as the SVG viewBox because both come from `getCachedBorderPath()` with the same width/height. So they match exactly.

If the panel resizes (e.g., window resize, layout change), the ResizeObserver fires, both the clip-path and SVG are regenerated with new dimensions, and they stay in sync.

## What About the Gap Between Panels?

When the border wobbles inward, the clip-path cuts into the image. The space between adjacent panels is the grid `gap` (currently `gap-2` = 8px). The wobble displacement is max ~3px for most presets, so it fits within the gap. The page background color shows through the wobble indentations — this is intentional and looks good, like hand-drawn panel gutters.

## Verdict

**It works as-is.** The `clip-path: path()` on the wrapper div properly masks the image, bubbles, and everything else to the border shape. No additional work needed.

If you're seeing the image poke out somewhere, it's likely one of:

1. The `PanelBorderWrapper` `active` prop is `false` (no clip applied) — check that color or effect is set
2. The panel div has `overflow-hidden` which clips to a rectangle _before_ the clip-path applies — these don't conflict, both clip
3. The ResizeObserver hasn't fired yet on first render (size is 0,0) — the clip-path is empty until the first measurement. This is a ~1 frame flash. Could fix with `useLayoutEffect` instead of `useEffect` if noticeable.

## Optional Enhancement: useLayoutEffect

If there's a visible flash of unclipped content on first render, switch the ResizeObserver setup from `useEffect` to `useLayoutEffect`. This runs synchronously before the browser paints:

```diff
- useEffect(() => {
+ useLayoutEffect(() => {
    if (!ref.current || !active) return;
    const obs = new ResizeObserver(([entry]) => {
```

This is a one-line change. Only needed if the flash is visible.
