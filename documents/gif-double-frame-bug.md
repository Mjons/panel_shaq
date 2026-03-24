# GIF Double Frame Bug

## The Bug

When exporting a GIF, each panel appears twice:

1. First: the panel image **without** border effects (raw rectangular image)
2. Then: the same panel **with** border effects (clipped + stroke)

Expected: only the final composed panel (with border effects) should appear as one frame.

## Root Cause Investigation

### Theory 1: `querySelectorAll("[data-panel-slot]")` finds duplicate elements

The GIF export crops panels by finding all elements with `data-panel-slot` attribute and using their bounding rects. If `PanelBorderWrapper` or any child also has this attribute, we'd get double the elements.

**Check:** Only one element per panel has `data-panel-slot` (the outer grid cell div). This is NOT the cause.

### Theory 2: `PanelBorderWrapper` clip-path not applied during capture

`PanelBorderWrapper` uses `ResizeObserver` inside `useEffect` to measure its size. On first render:

- Size is `{w: 0, h: 0}` → no clip-path, no SVG border
- `captureRef` takes a screenshot → captures panels WITHOUT border effects
- ResizeObserver fires → size updates → re-render with clip-path + SVG border

But the GIF only calls `captureRef` once, so this wouldn't cause double frames.

### Theory 3: Wide panel pan creates extra frames

The GIF code has special handling for wide panels (`panelRatio > frameRatio * 1.5`). It creates 3 pan frames for wide panels. If the border SVG overlay is slightly wider or different ratio than the image, it might trigger the "wide panel" path for what should be a normal panel — creating extra frames.

### Theory 4 (Most Likely): The panel div includes the border overlay as a separate visual layer

The `captureRef` captures the full page as one image, then crops each panel by its bounding rect. The outer panel div (`data-panel-slot`) contains:

1. The `PanelBorderWrapper` div (with clip-path)
2. Inside that: `PanelImage` + SVG border overlay

When cropping from the full-page capture, each panel's bounding rect captures the composed result — image + border + clip-path — as a single frame. This should work correctly.

**But:** if the `PanelBorderWrapper`'s clip-path causes the panel to visually shrink (the inset path), the DOM bounding rect might not match the visual boundary. The crop area could include the panel image bleeding outside the clip area in the captured PNG (since `html-to-image` may or may not respect clip-path perfectly).

### Theory 5: `gifVisibleCount` progressive reveal

The GIF code has a `gifVisibleCount` state that progressively shows panels. Looking at the code — this was removed/unused in the current version (panels are cropped from a single full-page capture, not revealed one by one).

## The Fix

The simplest reliable fix: **capture each panel individually** instead of cropping from the full page.

### Option A: Capture each panel slot directly

Instead of one `captureRef(comicRef)` and cropping, capture each `[data-panel-slot]` element individually with `html-to-image`. This guarantees the capture includes clip-path, border effects, and nothing else.

```tsx
for (const slotEl of slotElements) {
  const panelPng = await toPng(slotEl, { pixelRatio: 2 });
  const panelImg = await loadImg(panelPng);
  // Draw panelImg scaled to fit gifWidth x gifHeight
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, gifWidth, gifHeight);
  const scale = Math.max(
    gifWidth / panelImg.width,
    gifHeight / panelImg.height,
  );
  const dw = panelImg.width * scale,
    dh = panelImg.height * scale;
  ctx.drawImage(panelImg, (gifWidth - dw) / 2, (gifHeight - dh) / 2, dw, dh);
  frames.push({
    data: ctx.getImageData(0, 0, gifWidth, gifHeight),
    delay: 800,
  });
}
```

**Pros:** Each frame is exactly what the user sees — border effects, clip-path, bubbles, everything composed.
**Cons:** Slightly slower (multiple captures instead of one crop). But panels are small, so capture is fast.

### Option B: Debug the crop approach

Add logging to count `slotElements.length` vs expected panel count. If they match, the issue is in the crop math or the capture timing. If they don't match, something is adding extra `data-panel-slot` elements.

## Recommendation

**Option A.** Per-panel capture is more reliable and eliminates any crop-math / clip-path / timing issues. The current crop approach was an optimization that's now causing visual bugs.

## Files to Change

| File                           | Change                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| `src/screens/EditorScreen.tsx` | Refactor `handleCreateGif` (and `handleCreateGifAllPages`) to capture each panel slot individually |

**Effort: ~1 hour**
