# .comic Export: Panels Import Zoomed In

**Date:** 2026-03-22
**Status:** Investigation / Exploration
**Symptom:** All panels appear "super zoomed in" when a `.comic` file from Panel Shaq is opened in Panel Haus Desktop/Web.

---

## Root Cause

The `imageTransform` is passed through **as-is** from the Editor to the `.comic` file. But the transform values were captured relative to the Editor's browser container (which could be 360px wide on a phone, or 800px on a tablet), while Panel Haus Desktop interprets them relative to its own 490x700 canvas.

More critically, even when the user **hasn't touched** the image at all, the default transform is:

```js
{ x: 0, y: 0, scale: 1 }
```

This means **"display at 1:1 pixel scale, centered."** But Panel Shaq's Editor renders images with `object-contain` inside a CSS Grid cell — the browser automatically scales the image to fit the container. That `scale: 1` doesn't encode the fit-to-frame behavior; it's just "no user adjustment applied."

Panel Haus Desktop receives `scale: 1` and renders the image at its **native pixel dimensions** inside a panel that might be 232x337px. If the generated image is 1024x1024 (typical Gemini output), it renders at 1024px inside a 232px box — **4.4x zoom**.

### The Mismatch

| What happens                     | Panel Shaq Editor                              | Panel Haus Desktop                               |
| -------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| `scale: 1` means                 | "CSS `object-contain` fits image to container" | "Show image at 1:1 native pixels"                |
| Image 1024x1024 in 232x337 panel | Browser auto-shrinks to fit                    | Shows at 1024px = massively zoomed               |
| User pinches to 2x               | `scale: 2` = 2x bigger than fitted size        | `scale: 2` = 2x native pixels = even more zoomed |

The Editor relies on `object-contain` to do the initial fitting, and `scale` is a multiplier **on top of that**. Desktop doesn't have that implicit fit — it uses the raw scale value directly.

---

## What We Can Fix on Panel Shaq's Side

### Option A: Calculate a "fit scale" at export time (Recommended)

At export, compute what scale value would make the image fit inside the panel rectangle, and bake that into the exported transform.

```typescript
function fitScale(
  imageWidth: number,
  imageHeight: number,
  panelWidth: number,
  panelHeight: number,
): number {
  // Same math as CSS object-contain
  return Math.min(panelWidth / imageWidth, panelHeight / imageHeight);
}
```

Then in `exportAsComic`, multiply the user's scale by the fit scale:

```typescript
// Current code (line 170):
const transform = panel?.imageTransform || { x: 0, y: 0, scale: 1 };

// Fixed:
const userTransform = panel?.imageTransform || { x: 0, y: 0, scale: 1 };
const imageSize = getImageDimensions(panel?.image); // Need to decode image size
const fit = fitScale(
  imageSize.width,
  imageSize.height,
  rect.width,
  rect.height,
);

const exportTransform = {
  x: userTransform.x * fit, // Scale the pan offset too
  y: userTransform.y * fit,
  scale: userTransform.scale * fit,
  rotation: 0,
  flipH: false,
  flipV: false,
};
```

**For a 1024x1024 image in a 232x337 panel:**

- `fit = min(232/1024, 337/1024) = min(0.2265, 0.329) = 0.2265`
- Exported `scale = 1 * 0.2265 = 0.2265` → image shrinks to fit
- If user had zoomed to 2x: `scale = 2 * 0.2265 = 0.453` → still proportional

**Complexity:** Medium. Need to read image dimensions from base64 data at export time.

#### Getting image dimensions from base64

```typescript
function getImageDimensions(
  base64: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = base64;
  });
}
```

This makes `exportAsComic` async, but it already produces a large JSON string — the async overhead is negligible.

---

### Option B: Always export `scale: 0` or a sentinel value

Convention with Panel Haus Desktop: if `scale === 0` (or some sentinel like `-1`), Desktop should auto-fit the image to the panel frame on import.

```typescript
imageTransform: {
  x: 0,
  y: 0,
  scale: 0,  // Sentinel: "fit to frame"
  rotation: 0,
  flipH: false,
  flipV: false,
},
```

**Pros:** Dead simple on our side, one line change.
**Cons:** Requires Panel Haus Desktop to recognize and handle the sentinel. If it doesn't, panels would render at 0 scale (invisible). Would need coordination with the Desktop team.

---

### Option C: Hardcode a reasonable scale based on common image sizes

Gemini typically returns images around 1024x1024 or 1024x768. We can estimate:

```typescript
const TYPICAL_IMAGE_SIZE = 1024;
const estimatedFit = Math.min(rect.width, rect.height) / TYPICAL_IMAGE_SIZE;

imageTransform: {
  x: 0,
  y: 0,
  scale: userTransform.scale * estimatedFit,
  ...
}
```

**Pros:** No async image loading needed.
**Cons:** Breaks if image sizes change. Not accurate for non-square images or uploaded photos.

---

### Option D: Store actual image dimensions in PanelPrompt

When a panel image is generated or uploaded, record its natural dimensions:

```typescript
interface PanelPrompt {
  // ... existing fields
  imageNaturalSize?: { width: number; height: number };
}
```

Set it in DirectorScreen when generation completes (already loading the image). Then at export, the dimensions are available synchronously.

**Pros:** Clean, fast export. Useful metadata for other features too.
**Cons:** Requires changes to DirectorScreen, geminiService, and migration for existing projects.

---

## Recommendation

**Option A (fit scale at export) is the safest fix on our side.** It works regardless of what Desktop does, doesn't require format changes, and correctly handles user-adjusted transforms.

**Option D (store image dimensions)** is the cleanest long-term solution but requires more changes. Could be done alongside Option A — store dimensions when available, fall back to async decode at export when not.

**If we can coordinate with Desktop:** Option B (sentinel value) combined with Option A gives the best of both worlds — Desktop auto-fits when it sees the sentinel, and falls back to our pre-calculated scale otherwise.

---

## The x/y Offset Problem

The pan offsets (`x`, `y`) have a similar issue. In the Editor, drag deltas are divided by the current scale:

```typescript
// EditorScreen.tsx line 84
t.x += dx / t.scale;
t.y += dy / t.scale;
```

These pixel offsets are relative to the browser container's coordinate space. At export, they need to be scaled proportionally to the 490x700 page, but currently they're passed through raw.

**Fix:** When computing the fit scale, also scale the offsets:

```typescript
const exportX = userTransform.x * fit;
const exportY = userTransform.y * fit;
```

Or reset them to 0 (center the image) if we decide untouched panels should always be centered:

```typescript
const userHasAdjusted =
  userTransform.x !== 0 || userTransform.y !== 0 || userTransform.scale !== 1;

const exportTransform = userHasAdjusted
  ? {
      x: userTransform.x * fit,
      y: userTransform.y * fit,
      scale: userTransform.scale * fit,
    }
  : { x: 0, y: 0, scale: fit }; // Clean fit, no offset
```

---

## Files Involved

| File                                 | What needs to change                                            |
| ------------------------------------ | --------------------------------------------------------------- |
| `src/services/exportComicService.ts` | Add fit-scale calculation in `exportAsComic()`                  |
| `src/services/geminiService.ts`      | (Option D) Add `imageNaturalSize` to `PanelPrompt`              |
| `src/screens/DirectorScreen.tsx`     | (Option D) Store natural dimensions on generate/upload          |
| `src/screens/EditorScreen.tsx`       | No changes needed (it's a display concern, not an edit concern) |

---

## Quick Test

To verify the fix works before a full implementation, you can manually edit a `.comic` file:

1. Export a `.comic` from Panel Shaq
2. Open the JSON, find a panel's `imageTransform`
3. Change `"scale": 1` to `"scale": 0.23` (≈ 232/1024 for a 2-col layout)
4. Open in Panel Haus Desktop — panel should now fit in frame
5. If it does, the fit-scale calculation is the right fix
