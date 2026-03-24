# GIF Panel Focus Mode — Each Panel Fills the Frame

## Current Behavior

The GIF reveals panels on the composed page one at a time. The frame is always the full page — panels appear in their grid positions. This works but each panel is small within the frame.

## Desired Behavior

Each frame shows ONE panel filling the entire GIF frame — like a slideshow of individual panels. The viewer sees each panel up close before moving to the next.

```
Frame 1: Panel 1 fills the frame
Frame 2: Panel 2 fills the frame
Frame 3: Panel 3 fills the frame
Frame 4: Full composed page (all panels in layout)
```

## The Aspect Ratio Problem

Panels have different aspect ratios depending on their layout slot:

- A full-width panel in a 3:4 page might be ~3:1 (very wide)
- A tall sidebar panel might be ~1:3
- A 2x2 grid panel is roughly square

If the GIF frame is fixed (say 480x640), a wide panel letterboxed vertically looks tiny. A tall panel pillarboxed horizontally wastes space.

## Approaches

### Option A: Fixed Frame, Fit Each Panel (Simple)

GIF frame stays one fixed size (e.g., 480x640 portrait). Each panel is scaled to fit within that frame with letterboxing.

```
Wide panel:
┌─────────────────┐
│     (black)      │
│ ┌─────────────┐  │
│ │  panel img   │  │
│ └─────────────┘  │
│     (black)      │
└─────────────────┘

Tall panel:
┌─────────────────┐
│  ┌───┐          │
│  │   │ (black)  │
│  │   │          │
│  │   │          │
│  └───┘          │
└─────────────────┘
```

**Pros:** Simple. All frames same size. GIF format requires constant frame dimensions.
**Cons:** Lots of wasted space for non-matching panels. Wide panels look tiny.

### Option B: Frame Matches Page Format, Crop/Fill Panels (Recommended)

GIF frame matches the page format (portrait 3:4, square 1:1, or webtoon). Each panel is scaled with `object-cover` logic — fills the frame, crops the overflow.

```
Wide panel in portrait frame:
┌──────────┐
│ ╔════════╗│  ← panel is zoomed to fill height
│ ║ visible ║│     sides are cropped
│ ╚════════╝│
└──────────┘
```

For most panels (especially in portrait/square layouts) the aspect ratios are close enough that cropping is minimal.

**Pros:** Every frame looks full and punchy. No letterboxing.
**Cons:** Crops edges of panels that don't match the frame aspect.

### Option C: Pan Across Wide Panels (Cinematic)

For panels significantly wider than the frame, don't just crop — animate a pan across:

```
Wide panel (3:1 ratio) in portrait frame:

Frame 1a: Show left third
┌──────────┐
│ ┌────┐   │
│ │LEFT│   │
│ └────┘   │
└──────────┘

Frame 1b: Show middle third
┌──────────┐
│  ┌────┐  │
│  │MID │  │
│  └────┘  │
└──────────┘

Frame 1c: Show right third
┌──────────┐
│   ┌────┐ │
│   │RGHT│ │
│   └────┘ │
└──────────┘
```

The "camera" pans from left to right across the panel over 3-5 sub-frames, then cuts to the next panel.

**Detection:** If `panelWidth / panelHeight > frameWidth / frameHeight * 1.5`, it's "significantly wider" — trigger pan mode.

**Pros:** Cinematic. Wide establishing shots get the attention they deserve. Feels like a real animation.
**Cons:** More frames = larger GIF. More complex implementation. Encoding time increases.

### Option D: Adapt Frame Size Per Panel (Variable)

Each frame resizes to match the panel's aspect ratio. The GIF dimensions change per frame.

**Not possible** — GIF format requires all frames to be the same dimensions. This approach doesn't work.

### Option E: Hybrid — Fill + Pan for Wide Panels

Combine B and C:

- **Portrait/square panels:** Scale to fill the frame (Option B)
- **Wide panels (>1.5x frame aspect):** Pan across in sub-frames (Option C)
- **Final frame:** Show the full composed page

This gives the best of both worlds.

## Recommended: Option E (Hybrid)

```
Panel 1 (portrait): Fills frame, 800ms
Panel 2 (wide):     Pan left→right in 3 sub-frames, 400ms each
Panel 3 (square):   Fills frame, 800ms
Panel 4 (portrait): Fills frame, 800ms
Final:              Full composed page, 2000ms
```

## Implementation

### Capturing Individual Panels

Currently we capture the composed page via `captureRef(comicRef)`. For individual panels, we need to capture each panel separately.

**Option 1: Capture from panel image data directly**

Each panel already has `panel.image` as a base64 string. We can draw it directly to a canvas — no DOM capture needed.

```typescript
const img = new Image();
img.src = panel.image;
await img.decode();

// For fill mode: scale to cover frame
const frameW = 480,
  frameH = 640;
const scale = Math.max(frameW / img.width, frameH / img.height);
const drawW = img.width * scale;
const drawH = img.height * scale;
const offsetX = (frameW - drawW) / 2;
const offsetY = (frameH - drawH) / 2;
ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
```

**Option 2: For panning**

```typescript
const panSteps = 3;
for (let step = 0; step < panSteps; step++) {
  const progress = step / (panSteps - 1); // 0 → 1
  // Source rect pans across the image
  const srcW = img.width * (frameH / img.height); // visible width at frame height
  const maxOffsetX = img.width - srcW;
  const srcX = maxOffsetX * progress;
  ctx.drawImage(img, srcX, 0, srcW, img.height, 0, 0, frameW, frameH);
}
```

### Detecting Wide Panels

```typescript
const img = new Image();
img.src = panel.image;
await img.decode();

const panelRatio = img.width / img.height;
const frameRatio = frameW / frameH;
const isWide = panelRatio > frameRatio * 1.5;
```

### Frame Generation

```typescript
const frames = [];

for (const panel of orderedPanels) {
  const img = await loadImage(panel.image);
  const panelRatio = img.width / img.height;
  const isWide = panelRatio > frameRatio * 1.5;

  if (isWide) {
    // Pan in 3 sub-frames
    for (let step = 0; step < 3; step++) {
      const canvas = renderPanFrame(img, frameW, frameH, step / 2);
      frames.push({ data: canvas, delay: 400 });
    }
  } else {
    // Single fill frame
    const canvas = renderFillFrame(img, frameW, frameH);
    frames.push({ data: canvas, delay: 800 });
  }
}

// Final frame: full composed page
const pageCapture = await captureRef(comicRef, "png");
frames.push({ data: pageCapture, delay: 2000 });
```

## Frame Dimensions

Match the page format:

- **Portrait:** 480x640 (3:4)
- **Square:** 480x480 (1:1)
- **Webtoon:** 480x1067 (9:20) — though this makes a very tall GIF

## Transition Options

Between panels, options:

1. **Hard cut** — instant switch (simplest, default)
2. **Brief black frame** — 50ms black between panels (adds rhythm)
3. **Cross-fade** — blend two panels over 3 frames (more frames, larger GIF)

Start with hard cut. Add black frame as an option later.

## Files to Modify

| File                           | Change                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `src/screens/EditorScreen.tsx` | Rewrite `handleCreateGif` to capture individual panels, detect wide panels, add pan frames |
