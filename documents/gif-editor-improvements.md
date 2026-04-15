# GIF Editor Improvements: Text Bubbles & Panel Cropping

## Two Issues

### 1. Text/Bubbles Not Included in GIF

The GIF Editor receives `panelImages` as raw `panel.image` strings — the base panel artwork without speech bubbles, emoji stickers, or any overlays. The text the user carefully positioned in the Editor is missing from the GIF.

**Current flow:**

```
EditorScreen → filters panels with images → sends p.image (raw) → GifEditorScreen
```

**Where bubbles live:** On the `PanelPrompt` object as `panel.bubbles[]`. They're rendered as DOM overlays in the Editor, not baked into the image (unless the user explicitly "Bakes" them).

### 2. Full Image vs Panel-in-Layout

The GIF uses the full source image, not the cropped/transformed version visible in the layout slot. If the user zoomed/panned the image within a panel, the GIF shows the original uncropped image.

## Approaches for Including Bubbles

### Option A: Capture Panel Slots from DOM Before Opening GIF Editor (Recommended)

Same approach as the inline GIF export fix — capture each panel's DOM slot (which includes the image, transform, and bubble overlays) as a PNG, then pass those captures to the GIF Editor.

```typescript
// In EditorScreen, when opening GIF Editor:
onClick={async () => {
  const slotElements = Array.from(
    comicRef.current!.querySelectorAll("[data-panel-slot]")
  ) as HTMLElement[];

  const images = [];
  // Capture full page once
  const fullPage = await captureRef(comicRef, "png");
  const fullImg = await loadImg(fullPage);
  const comicRect = comicRef.current!.getBoundingClientRect();
  const scale = fullImg.width / comicRect.width;

  for (const slot of slotElements) {
    const rect = slot.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    const sw = rect.width * scale;
    const sh = rect.height * scale;
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(fullImg,
      (rect.left - comicRect.left) * scale,
      (rect.top - comicRect.top) * scale,
      sw, sh, 0, 0, sw, sh
    );
    images.push({
      id: slot.getAttribute("data-panel-slot") || String(images.length),
      imageData: canvas.toDataURL("image/png"),
    });
  }

  if (images.length > 0) onOpenGifEditor(images);
}}
```

**Pros:** Captures exactly what the user sees — cropped, transformed, with bubbles and stickers. Single full-page capture, then crop per slot. Proven reliable (same approach as inline GIF).

**Cons:** Slightly slower to open GIF Editor (capture step). Images are flattened — bubbles can't be separately animated in the GIF Editor.

### Option B: Pass Both Raw Image + Bubbles Data

Send both `panel.image` and `panel.bubbles` to the GIF Editor. The GIF Editor renders bubbles as overlays on each frame.

**Pros:** Bubbles could be animated (e.g., appear one at a time, typewriter effect).
**Cons:** Major complexity. The GIF Editor would need to render bubble styles (speech, thought, SFX, emoji, narration). Duplicates all the DraggableBubble rendering logic.

### Option C: Require Bake Before GIF

Prompt the user to bake all dialogue before opening the GIF Editor. Then `panel.image` already includes the text.

**Pros:** Zero code changes to GIF Editor.
**Cons:** Destructive — baking is permanent. Bad UX to force it.

**Recommendation: Option A.** Capture DOM slots. It's the same proven approach, includes everything, and requires no changes to the GIF Editor itself.

## Toggle: Full Image vs Panel Crop

Some users might want the full uncropped image in the GIF (e.g., to show art that's hidden by the layout crop). This could be a toggle.

### UI

Add a toggle in the GIF Editor or in the "Open GIF Editor" flow:

```
Source:  [As Composed ✓] [Full Images]
```

- **As Composed** (default): Captures panel slots from DOM — cropped, transformed, with bubbles
- **Full Images**: Uses raw `panel.image` — the full source art, no crop, no bubbles

### Implementation

The EditorScreen already has both:

- `panel.image` — raw source image
- DOM slot capture — composed version

Pass a flag or let the user choose before opening the GIF Editor:

```typescript
const openGifEditor = async (useComposed: boolean) => {
  if (useComposed) {
    // Capture DOM slots (Option A above)
  } else {
    // Current behavior — raw panel.image
    const images = panels
      .filter((p) => p.image)
      .map((p) => ({ id: p.id, imageData: p.image! }));
    onOpenGifEditor(images);
  }
};
```

### Recommendation

Default to **As Composed** (captures with bubbles and crop). Don't add a toggle for now — if users ask for full images, add it later. The composed version is what they expect since it matches what they see in the Editor.

## Files to Modify

| File                           | Change                                                              |
| ------------------------------ | ------------------------------------------------------------------- |
| `src/screens/EditorScreen.tsx` | Change GIF Editor button to capture DOM slots instead of raw images |

No changes needed to GifEditorScreen, gifAnimationService, or gif types — the images are just base64 PNGs regardless of source.
