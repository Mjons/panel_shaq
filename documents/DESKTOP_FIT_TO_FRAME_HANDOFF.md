# Panel Shaq → Panel Haus Desktop: Fit-to-Frame Handoff

**Date:** 2026-03-22
**Status:** Needs Desktop-side implementation
**Priority:** High — panels currently import zoomed in

---

## The Problem

When a `.comic` file exported from Panel Shaq is opened in Panel Haus Desktop (or web), all panel images appear zoomed in / cropped. The images should fit inside their panel frames.

### Why It Happens

Panel Shaq's Editor uses CSS `object-contain` to display images — the browser automatically shrinks a 1024x1024 image to fit a 300px panel. The `imageTransform.scale` value stored is relative to that _already-fitted_ view (1 = no user adjustment, 2 = user zoomed in 2x).

Panel Haus Desktop interprets `scale: 1` as "render at native pixel dimensions." A 1024px image in a 232px panel = **4.4x zoom**.

---

## The Fix: Sentinel Value `scale: -1`

Panel Shaq now exports `imageTransform.scale: -1` as a sentinel meaning **"fit this image to the panel frame."**

### What Panel Shaq sends (already deployed):

```json
{
  "imageTransform": {
    "x": 0,
    "y": 0,
    "scale": -1,
    "rotation": 0,
    "flipH": false,
    "flipV": false
  }
}
```

### What Desktop needs to do:

When loading a panel's `imageTransform`, check for the sentinel:

```javascript
function getEffectiveTransform(panel) {
  const t = panel.imageTransform || { x: 0, y: 0, scale: 1 };

  // Sentinel from Panel Shaq: fit image to panel frame
  if (t.scale === -1 && panel.imageSrc) {
    const img = getLoadedImage(panel.imageSrc); // however you access the decoded image
    const fitScale = Math.min(
      panel.width / img.naturalWidth,
      panel.height / img.naturalHeight,
    );
    return { ...t, x: 0, y: 0, scale: fitScale };
  }

  return t;
}
```

The math is the same as CSS `object-contain`:

- `fitScale = min(panelWidth / imageWidth, panelHeight / imageHeight)`
- Image is centered at (0, 0) with no offset

### Where to add this

Wherever Desktop reads `panel.imageTransform` and applies it to rendering. This could be:

- The canvas render function that draws panel images
- The import/load path that hydrates `.comic` JSON into project state
- An adapter in the Panel Shaq format converter (if one already exists)

**Option A — Fix at render time:** Check for `-1` every time you draw a panel. Most flexible, handles future imports too.

**Option B — Fix at import time:** Convert `-1` to the actual fit scale when the `.comic` file is first loaded. Simpler rendering code, but the scale becomes a fixed number tied to the panel dimensions at import time.

Either works. Option A is probably cleaner since panel dimensions might change after import.

---

## Detection: How to Know It's a Panel Shaq File

The `.comic` file includes source identification:

```json
{
  "metadata": {
    "source": "panelshaq",
    "sourceVersion": "1.0.0"
  }
}
```

But you don't need to check this — the sentinel `scale: -1` is self-describing. Any file with `scale: -1` means "fit to frame" regardless of source.

---

## Edge Cases

| Scenario                                       | What happens                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `scale: -1` but no `imageSrc`                  | No image to fit — treat as `scale: 1` or skip                                  |
| `scale: -1` with very small image (e.g. 50x50) | `fitScale` will be > 1, which is correct — it scales up to fill                |
| `scale: 0`                                     | Not used as sentinel. `0` should be treated as invalid → default to fit or `1` |
| Normal positive `scale` values                 | No change — render as before                                                   |
| Panel resized after import                     | If using Option A (render-time), recalculates automatically                    |

---

## Test Plan

1. Export a `.comic` from Panel Shaq (deployed at panel-shaq.vercel.app)
2. Open in Panel Haus Desktop
3. **Before fix:** panels are zoomed in ~4x, images cropped
4. **After fix:** images should fit inside panel frames, fully visible, centered
5. Verify with different layouts (2-panel, 4-panel grid, 6-panel) since panel sizes vary

---

## What Panel Shaq Sends (Full Panel Example)

```json
{
  "id": "panel-abc123",
  "x": 10,
  "y": 10,
  "width": 232,
  "height": 337,
  "imageSrc": "data:image/jpeg;base64,/9j/4AAQ...",
  "imageId": "img_abc123",
  "imageTransform": {
    "x": 0,
    "y": 0,
    "scale": -1,
    "rotation": 0,
    "flipH": false,
    "flipV": false
  },
  "strokeWidth": 2,
  "strokeColor": "#000000",
  "showOutline": true,
  "visible": true,
  "locked": false,
  "zIndex": 0
}
```

The `imageSrc` contains the full base64 image (typically 1024x1024 or similar from Gemini). The `width`/`height` are the panel frame dimensions in the 490x700 page coordinate system.

---

## Summary

- **Panel Shaq side:** Done. Exports `scale: -1` sentinel. No further changes needed.
- **Desktop side:** Need to detect `scale: -1` and compute `min(panelW/imgW, panelH/imgH)` as the actual scale. ~5-10 lines of code wherever panel images are rendered or imported.
