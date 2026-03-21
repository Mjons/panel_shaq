# Watermark Options for Free Users

## Why Watermark

Free users consume Gemini API credits (either ours or BYOK). If we ever offer a hosted tier where we pay for generation, watermarking free-tier output is a standard way to:

- Encourage upgrades to a paid plan
- Get brand visibility when comics are shared
- Differentiate free vs paid output quality perception

The watermark should be **noticeable but not obnoxious** — the goal is branding, not punishment.

---

## Options

### 1. Corner Badge

A small semi-transparent logo/text in one corner of each exported panel or page.

```
┌──────────────────────────┐
│                          │
│       (panel image)      │
│                          │
│              PANEL SHAQ  │
└──────────────────────────┘
```

**Pros:** Minimal, industry standard, easy to implement
**Cons:** Trivially croppable
**Implementation:** Overlay on canvas during export (PNG/PDF), ~10 lines

### 2. Bottom Strip

A thin branded bar at the bottom of each exported page (not individual panels).

```
┌──────────────────────────┐
│                          │
│       (comic page)       │
│                          │
├──────────────────────────┤
│  Made with PANEL SHAQ    │
└──────────────────────────┘
```

**Pros:** Doesn't obscure the art at all, feels like a credit rather than a watermark
**Cons:** Adds height to the image, easy to crop
**Implementation:** Extend canvas height by ~30px during export, draw strip

### 3. Diagonal Overlay

Faint repeating text across the entire image at an angle.

**Pros:** Very hard to remove
**Cons:** Aggressive, makes free output look bad, discourages sharing (hurts brand)
**Do not use** — this is the Shutterstock approach and feels hostile for a creative tool

### 4. First/Last Page Only

Watermark only on the first or last page of a multi-page export, not on individual panels.

**Pros:** Minimal friction, doesn't ruin every panel
**Cons:** Easy to remove (just delete the page)
**Implementation:** Only apply during PDF/full-comic export

### 5. Metadata Watermark (Invisible)

Embed branding in image EXIF/metadata or use steganography.

**Pros:** Invisible to the user, doesn't affect the art
**Cons:** Doesn't drive upgrades (users don't see it), easily stripped
**Use case:** Attribution tracking, not monetization

### 6. Export Resolution Cap

Not a visual watermark — free users export at lower resolution (e.g., 720p), paid users get full resolution (1024px+).

**Pros:** No visual branding on the art itself, clean output for everyone
**Cons:** Users notice quality difference only when printing or zooming
**Implementation:** Resize canvas during export based on user tier

---

## Recommendation

**Combine options 2 + 6:**

- **Bottom strip on exported pages** — "Made with Panel Shaq" in a thin bar. Feels like a credit, not a watermark. Users can share their comics and it looks intentional, like a "powered by" footer.
- **Resolution cap on free tier** — free exports at 720p, paid at full resolution. This is the real differentiator for anyone who wants to print or publish.

### Why not corner badge?

It's the most common approach but it feels cheap. The bottom strip is classier and actually works as free advertising when comics are shared — people see "Made with Panel Shaq" and look it up.

### Why not diagonal overlay?

It makes the free output look terrible. Users won't share bad-looking comics, which kills organic growth. The watermark should make people _want_ to share, not hide it.

---

## Implementation Sketch

### Bottom Strip (during export)

```typescript
function addWatermarkStrip(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const stripHeight = 28;
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height + stripHeight;
  const ctx = out.getContext("2d")!;

  // Draw original image
  ctx.drawImage(canvas, 0, 0);

  // Draw strip
  ctx.fillStyle = "#0B1326";
  ctx.fillRect(0, canvas.height, out.width, stripHeight);

  // Draw text
  ctx.fillStyle = "rgba(255, 145, 0, 0.6)";
  ctx.font = "bold 11px 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Made with PANEL SHAQ", out.width / 2, canvas.height + 18);

  return out;
}
```

### Resolution Cap (during export)

```typescript
function capResolution(
  canvas: HTMLCanvasElement,
  maxWidth: number,
): HTMLCanvasElement {
  if (canvas.width <= maxWidth) return canvas;
  const scale = maxWidth / canvas.width;
  const out = document.createElement("canvas");
  out.width = maxWidth;
  out.height = canvas.height * scale;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

// In export flow:
const maxWidth = isPaidUser ? Infinity : 720;
const finalCanvas = capResolution(addWatermarkStrip(pageCanvas), maxWidth);
```

---

## When to Add This

**Not yet.** Watermarking only matters when:

1. There are free users on a hosted tier (we're paying for their generations)
2. There's a paid tier to upgrade to

Right now everyone is BYOK — they're paying for their own API usage. Watermarking BYOK users would feel punitive. Add this when/if a hosted free tier launches alongside credit packs or subscriptions.

---

## Open Questions

| Question                                     | Notes                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| Watermark on individual panel downloads too? | Probably yes for hosted free tier, no for BYOK                                 |
| Should BYOK users ever see a watermark?      | No — they're paying for their own API                                          |
| Removable via one-time purchase?             | Could offer a "remove watermark" $5 one-time option separate from subscription |
| Different watermark for .comic export?       | No — Desktop import is a power user flow, don't watermark the working file     |
