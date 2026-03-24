# Stickers

## Concept

Draggable image overlays that sit on top of panels — like speech bubbles but visual instead of text. Think comic book staples: speed lines, impact stars, sweat drops, hearts, skulls, fire, sparkles, exclamation marks, arrows, etc.

Stickers are the visual equivalent of SFX bubbles — they communicate emotion, action, and emphasis without words.

## How They Fit Into the Existing System

Stickers are structurally very similar to bubbles:

- Positioned with `{ x: %, y: % }` (percentage-based, just like bubbles)
- Draggable (same gesture system)
- Pinch to resize (like bubble font size, but scales the image)
- 2-finger tap to rotate (same rotation system)
- Live on a panel (stored in the panel's data)
- Rendered as overlays on top of the panel image
- Captured in exports (they render in the DOM)

The key difference: bubbles have text + a style (speech, thought, etc.). Stickers have an image + a scale.

## Data Model

### Option A: Extend the Bubble interface (Recommended)

Add a `"sticker"` style to the existing Bubble type. This means stickers flow through all existing bubble infrastructure — add, remove, select, drag, pinch, rotate, bake, export.

```typescript
export interface Bubble {
  id: string;
  text: string; // For stickers: the sticker ID/name
  pos: { x: number; y: number };
  style:
    | "speech"
    | "thought"
    | "action"
    | "effect"
    | "sfx-impact"
    | "sfx-ambient"
    | "narration"
    | "pop-text"
    | "sticker"; // NEW
  fontSize: number; // For stickers: used as scale (reuse the field)
  fontWeight: string;
  fontStyle: string;
  rotation?: number;
  tailPos?: { x: number; y: number };
  stickerSrc?: string; // NEW — base64 or URL of the sticker image
}
```

**Pros:** Zero infrastructure changes. All existing bubble logic (add, remove, drag, pinch, rotate, select, bake, export) works automatically. The fullscreen toolbar, bubble list, and sidebar all handle stickers for free.

**Cons:** Slightly overloaded interface — `fontSize` means "scale" for stickers, `text` means "sticker name". But this is an internal detail, not user-facing.

### Option B: Separate Sticker interface

Create a parallel `stickers: Sticker[]` array on PanelPrompt, separate from bubbles.

**Pros:** Clean separation of concerns.
**Cons:** Duplicates all the infrastructure — drag, pinch, rotate, select, render, export, fullscreen toolbar, sidebar list. Massive effort for minimal benefit.

**Recommendation: Option A.** Stickers are just bubbles with images instead of text.

## Sticker Library

### Built-in Stickers

Ship a set of ~20-30 common comic stickers as static assets (SVG or PNG):

**Emotions:**

- Heart, broken heart, sweat drop, anger vein, sparkle eyes, blush, tears, skull

**Action:**

- Speed lines, impact star, explosion burst, lightning bolt, dust cloud, motion blur

**Symbols:**

- Exclamation mark (❗), question mark (❓), ellipsis (…), light bulb (💡), music notes (♪)

**Decorative:**

- Stars, sparkles, flowers, fire, ice crystals, arrows (pointing), halos

### Custom Stickers (Future)

Users upload their own sticker images. Same flow as custom character references — file picker, base64, stored on the bubble object.

### Storage

Built-in stickers are small SVGs/PNGs bundled with the app (in `src/images/stickers/` or `public/stickers/`). Custom stickers are base64 strings on the bubble object.

## UI — Adding a Sticker

### In the Fullscreen Toolbar

Add a "Sticker" button next to "Bubble":

```
[+Bubble] [+Sticker] [Lock] [Bake] [Done]
```

Tapping "+Sticker" opens a sticker picker — a small grid of thumbnails:

```
┌──────────────────────────────────┐
│  Pick a Sticker                  │
│                                  │
│  ❤️  💔  💧  💢  ✨  😳  💀  🔥  │
│  ⚡  💥  💨  ❗  ❓  💡  ♪  ⭐  │
│  🌸  🎯  ➡️  😇  ❄️  ...        │
│                                  │
│             [Cancel]             │
└──────────────────────────────────┘
```

Tapping a sticker adds it to the center of the panel (same as addBubble), then the user drags it into position.

### In the Sidebar (non-fullscreen)

Same "+Sticker" button in the Dialogue section header, next to the existing "+" bubble button.

### In the Bubble List

Stickers appear in the bubble list alongside text bubbles:

```
[speech 1] [thought 2] [🔥 sticker 3]
```

Tapping a sticker in the list selects it for dragging/resizing. The editing toolbar for stickers would show: resize buttons + delete + checkmark (no text input, no type toggle).

## Rendering

### In the Panel

```tsx
{bubble.style === "sticker" && bubble.stickerSrc ? (
  <img
    src={bubble.stickerSrc}
    alt={bubble.text}
    style={{
      width: `${bubble.fontSize * 3}px`,  // fontSize as scale factor
      height: "auto",
      transform: `rotate(${bubble.rotation || 0}deg)`,
      pointerEvents: "none",
    }}
  />
) : (
  // existing bubble text rendering
)}
```

### In Export / Bake

Stickers are DOM elements inside the panel div — `captureRef` captures them automatically in PNG exports. For "Bake Dialogue", the final-render prompt would need to mention stickers as visual elements to integrate.

## Implementation Steps

### Phase 1: Core (MVP)

1. Add `"sticker"` to Bubble style union + `stickerSrc` field
2. Bundle 15-20 sticker images as static assets
3. Add sticker picker modal (grid of thumbnails)
4. Add "+Sticker" button to fullscreen toolbar + sidebar
5. Render sticker images in the panel overlay (same position as bubbles)
6. Sticker editing toolbar: resize + delete + checkmark (no text input)

### Phase 2: Polish

7. Custom sticker upload
8. Sticker search/filter in the picker
9. Recently used stickers section
10. Sticker opacity control
11. Sticker flip (horizontal/vertical mirror)

## Files to Modify

| File                            | Change                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/services/geminiService.ts` | Add `"sticker"` to Bubble style union, add `stickerSrc` field                                                 |
| `src/screens/EditorScreen.tsx`  | Sticker picker modal, "+Sticker" button, sticker rendering in panel overlay, sticker-specific editing toolbar |
| `src/images/stickers/`          | New directory with bundled sticker assets                                                                     |
| `api/final-render.ts`           | Update bake prompt to mention sticker overlays                                                                |

## What This Does NOT Cover

- Animated stickers (GIFs) — static images only
- Sticker packs / marketplace
- AI-generated stickers (could combine with `generateReferenceImage` later)
- Sticker layers / z-ordering (all stickers render at the same z-level as bubbles)
