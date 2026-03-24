# GIF Export — Animated Comics

## Concept

Turn comic pages into animated GIFs that reveal panels one at a time — like a slideshow or a "panel-by-panel" reveal. Perfect for sharing on social media, Discord, iMessage, etc. where GIFs auto-play and loop.

Two modes:

1. **Page GIF** — animate one page, revealing panels sequentially
2. **Story GIF** — animate across all pages, like a flipbook

## What It Would Look Like

### Page GIF (panel-by-panel reveal)

```
Frame 1: Panel 1 visible, rest dark/empty
Frame 2: Panel 1 + Panel 2 visible
Frame 3: Panel 1 + Panel 2 + Panel 3 visible
Frame 4: All panels visible (hold longer)
```

Each frame adds one panel. This mimics how you read a comic — your eye moves from panel to panel. The final frame (all panels) holds for longer before looping.

### Story GIF (page flipbook)

```
Frame 1: Page 1 (all panels visible)
Frame 2: Page 2
Frame 3: Page 3
...
Loop
```

Just flipping through pages. Simpler to implement but less interesting visually.

### Single Panel GIF (Ken Burns effect)

```
Frame 1: Full panel, zoomed out
Frame 2-10: Slowly zoom into a focal point
Frame 11-20: Pan across the panel
```

Gives static images a cinematic feel. More complex — requires knowing where to zoom/pan.

## Technical Approaches

### Option A: Client-Side GIF Encoding (Recommended)

Use a JavaScript GIF encoder library. Capture each frame as a canvas image, encode to GIF.

**Libraries:**

- **gif.js** — Web Worker-based, handles large GIFs. ~50KB gzipped. Well-established.
- **modern-gif** — Newer, WASM-based, faster encoding. ~30KB.
- **gifenc** — Tiny (~5KB), pure JS, good for simple use cases.

**Flow:**

```typescript
import GIF from "gif.js";

const createPageGif = async () => {
  const gif = new GIF({ workers: 2, quality: 10, width: 800, height: 1067 });

  // For each panel reveal state:
  for (let visibleCount = 1; visibleCount <= panelCount; visibleCount++) {
    // Set which panels are visible (hide panels > visibleCount)
    setVisiblePanels(visibleCount);
    await waitForPaint();

    // Capture the DOM as a canvas
    const canvas = await html2canvas(comicRef.current);
    const delay = visibleCount === panelCount ? 2000 : 800; // Hold last frame longer
    gif.addFrame(canvas, { delay });
  }

  gif.on("finished", (blob) => {
    // Share or download the GIF
    const url = URL.createObjectURL(blob);
    // ...
  });

  gif.render();
};
```

**Pros:** Runs entirely client-side. No server needed. Works offline.
**Cons:** Encoding is CPU-intensive (1-5 seconds for a simple GIF). Large GIFs (many frames, high res) can be slow. GIF format is limited to 256 colors per frame.

### Option B: Capture Frames as PNGs, Encode Server-Side

Capture frames client-side, send to a server endpoint that uses `ffmpeg` or `sharp` to create the GIF.

**Pros:** Higher quality, faster encoding, can also create MP4/WebM.
**Cons:** Requires server infrastructure. Large upload (multiple full-res images). API costs.

### Option C: CSS Animation → Screen Record Prompt

Instead of generating a GIF, play a CSS animation that reveals panels and prompt the user to screen-record.

**Pros:** Zero implementation. Native quality.
**Cons:** Terrible UX. Users won't do it.

### Option D: APNG (Animated PNG)

Like GIF but with full 24-bit color and alpha transparency. Supported in all modern browsers.

**Pros:** Much better quality than GIF (no 256 color limit).
**Cons:** Larger file size. Not universally supported for sharing (iMessage, Discord handle it fine, but some older platforms don't).

**Recommendation:** Option A for MVP (client-side GIF), consider APNG as a quality upgrade later.

## Animation Styles

### 1. Panel Reveal (Recommended Default)

Panels appear one at a time in reading order. Simple, effective, universal.

```
Timing: 800ms per panel, 2000ms hold on final frame
Transition: Instant appear (no fade)
```

### 2. Panel Reveal with Fade

Same as above but each panel fades in over 300ms.

```
Timing: 300ms fade + 500ms hold per panel, 2000ms final
Requires: More frames per transition (e.g., 5 frames for fade = 60ms each)
```

### 3. Panel Spotlight

Only the current panel is bright, others are dimmed. Spotlight moves through the sequence.

```
Frame 1: Panel 1 bright, rest at 20% opacity
Frame 2: Panel 2 bright, rest at 20% opacity
...
Final: All panels bright
```

### 4. Typewriter (With Dialogue)

Panels reveal AND speech bubbles type out character by character. Very engaging but complex.

### 5. Zoom Walk

Camera starts zoomed into panel 1, then "walks" across the page zooming into each panel in sequence. Most cinematic but requires canvas manipulation.

**Recommendation:** Start with Style 1 (instant reveal). It's the simplest, works for all layouts, and is immediately shareable.

## Implementation Plan

### Phase 1: Basic Page GIF

1. Add `gif.js` or `gifenc` dependency
2. Add "Create GIF" button in the Export section
3. Implement panel reveal animation by toggling panel visibility
4. Capture each state as a canvas frame
5. Encode to GIF, offer download/share

### Phase 2: Polish

6. Add progress bar during encoding
7. Story GIF (page flipbook) mode
8. Adjustable timing (speed slider: slow/medium/fast)
9. Resolution options (low for sharing, high for quality)

### Phase 3: Advanced

10. Fade transitions between panels
11. Panel spotlight mode
12. APNG export option
13. MP4/WebM export (much better compression, video quality)

## UI

### In the Export Section

```
EXPORT
┌────────────┐ ┌────────────┐
│ This Page  │ │ All Pages  │
│    PNG     │ │    PNG     │
└────────────┘ └────────────┘

┌─────────────────────────────┐
│  🎬  Create GIF             │
│  Animated panel-by-panel    │
└─────────────────────────────┘
```

### GIF Settings (optional, Phase 2)

```
Speed:  [Slow] [Medium] [Fast]
Style:  [Reveal] [Spotlight] [Fade]
```

## Challenges

### File Size

GIFs are notoriously large. A 4-panel page at 800x1067 with 5 frames could be 2-5MB. Mitigations:

- Reduce resolution (400px wide for social sharing is fine)
- Limit color palette aggressively (128 colors instead of 256)
- Use lossy GIF optimization (giflossy)

### 256 Color Limit

GIF format supports max 256 colors per frame. Comic art with gradients will show banding. Mitigations:

- Dithering (gif.js supports this)
- APNG as alternative for quality-conscious users

### Encoding Speed

Client-side GIF encoding takes 1-5 seconds. Show a progress indicator. Use Web Workers (gif.js does this automatically).

### Panel Visibility Toggle

Need a way to render the composed page with only N panels visible. Options:

- Set `opacity: 0` on hidden panels (they still take space in the grid)
- Set `visibility: hidden` (same — takes space, invisible)
- Render a black/dark overlay on hidden panels

`opacity: 0` is simplest — panels stay in position, grid doesn't reflow.

## Files to Modify

| File                           | Change                                                  |
| ------------------------------ | ------------------------------------------------------- |
| `package.json`                 | Add `gif.js` or `gifenc` dependency                     |
| `src/screens/EditorScreen.tsx` | "Create GIF" button, frame capture loop, encoding logic |
| `src/screens/EditorScreen.tsx` | Panel visibility state for animation frames             |

## Sharing

GIFs are universally shareable:

- `navigator.share({ files: [gifFile] })` works on mobile
- Discord, iMessage, WhatsApp, Twitter all auto-play GIFs
- Small enough to email
- No player needed — just an image that moves
