# GIF Should Show Panel As It Appears in the Layout, Not the Full Image

## Problem

The current GIF renders each panel's raw source image (`panel.image`) filling the GIF frame. But in the actual comic layout, the panel image is:

1. **Cropped by the grid slot** — only the portion visible inside the slot's rectangle is shown
2. **Transformed** — the user may have panned/zoomed the image within the slot via `imageTransform` (x, y, scale)
3. **Styled** — `object-contain` fitting within the slot, not the raw image dimensions

So the GIF shows the full uncropped image, while the user expects to see exactly what they see in the Editor — the image as framed within its panel slot, with their positioning applied.

## What the User Sees in the Editor

```
┌──────────────────┐  ← panel slot (grid cell)
│  ┌────────────┐  │
│  │ visible    │  │  ← image, potentially zoomed/panned
│  │ portion    │  │     only this part should appear in the GIF
│  └────────────┘  │
└──────────────────┘
```

The rest of the image is clipped by `overflow: hidden` on the slot div.

## Solution: Capture Each Panel's DOM Element

Instead of drawing from `panel.image` directly, capture each panel's DOM element — the actual rendered slot with the image inside it, cropped and transformed exactly as the user sees it.

### Approach: Use html-to-image on Individual Panel Slots

Each panel slot in the Editor is a `<div>` with the image, transform, and overflow clipping. We can capture each one individually.

```typescript
// Get all panel slot elements from the comic ref
const panelSlots = comicRef.current.querySelectorAll("[data-panel-slot]");

for (let i = 0; i < panelSlots.length; i++) {
  const slotEl = panelSlots[i] as HTMLElement;
  const slotPng = await toPng(slotEl, { pixelRatio: 1.5, cacheBust: true });
  const img = await loadImg(slotPng);
  // Draw to GIF frame with fill/pan logic
}
```

This captures exactly what the user sees — the image within its slot, with transforms applied, overflow clipped.

### Implementation

1. **Mark panel slots with a data attribute** — add `data-panel-slot` to the panel container div in the Editor render loop

2. **Capture each slot** — use `toPng` from `html-to-image` on each slot element individually

3. **Draw to GIF frame** — same fill/pan logic as before, but now the source image is the cropped panel, not the raw image

```typescript
// In the panel render loop, add data attribute:
<div
  key={pid}
  data-panel-slot={idx}
  className={...}
  style={...}
>

// In handleCreateGif:
const slotElements = Array.from(
  comicRef.current!.querySelectorAll("[data-panel-slot]")
) as HTMLElement[];

for (let i = 0; i < slotElements.length; i++) {
  const slotPng = await toPng(slotElements[i], {
    pixelRatio: 1.5,
    skipFonts: true,
    cacheBust: true,
  });
  const img = await loadImg(slotPng);

  // Now img is the panel AS IT APPEARS — cropped, transformed, styled
  const panelRatio = img.width / img.height;
  const isWide = panelRatio > frameRatio * 1.5;

  if (isWide) {
    // Pan across
  } else {
    // Fill frame
  }
}
```

### Why This Is Better

| Aspect          | Current (raw image)   | Fixed (DOM capture)             |
| --------------- | --------------------- | ------------------------------- |
| Image crop      | Full uncropped image  | Cropped to slot boundaries      |
| Image transform | Ignored               | Applied (pan, zoom, rotation)   |
| Speech bubbles  | Not visible           | Captured if present             |
| Aspect ratio    | Raw image ratio       | Slot's actual ratio from layout |
| What you see    | Different from Editor | Exactly matches Editor          |

### Bonus: Speech Bubbles in GIF

Because we're capturing the DOM slot, speech bubbles that are on the panel will also appear in the GIF frames — the user sees the complete panel with dialogue, not just the raw image.

### Performance Note

`toPng` on a small DOM element is fast (50-100ms per panel). For a 4-panel page, that's 200-400ms total capture time — well within acceptable range.

## Files to Modify

| File                           | Change                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `src/screens/EditorScreen.tsx` | Add `data-panel-slot` to panel divs. Rewrite GIF frame capture to use `toPng` on slot elements instead of `panel.image`. |
