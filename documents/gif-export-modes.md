# GIF Export Modes

## Current State

Two buttons: "GIF Page" (current page panels + full page frame) and "GIF All" (all pages, same pattern). Both always show individual panels then a full-page composite at the end of each page.

## Proposed: GIF Export Menu

Replace the two buttons with a single "Export GIF" button that opens a menu with these mode options:

---

### Mode 1: Story Flow

Each panel in order across all pages. No page composites, no pauses. Just panel → panel → panel through the entire comic like reading the story.

- Frame order: `panel1 → panel2 → panel3 → ... → panelN`
- Delay: 1.2s per frame
- Best for: sharing the story on social media, quick previews

### Mode 2: Page Reveal

Current behavior. Each page shows panels one by one, then the full composed page. Moves to next page and repeats.

- Frame order: `p1-panel1 → p1-panel2 → p1-full → p2-panel1 → p2-panel2 → p2-full`
- Delay: 0.8s panels, 2s full page
- Best for: showing off layout composition

### Mode 3: Slideshow

Just the full composed pages, one after another. No individual panels.

- Frame order: `page1 → page2 → page3`
- Delay: 3s per page
- Best for: quick overview of a multi-page comic

### Mode 4: Cinematic Pan

Each panel gets a slow zoom/pan effect (Ken Burns style). Panels with faces zoom into center, wide panels pan left-to-right.

- Frame order: multiple sub-frames per panel (zoom steps)
- Delay: 0.5s per sub-frame, 3-4 sub-frames per panel
- Best for: dramatic presentation, video-like feel

### Mode 5: This Page Only

Same as Story Flow but just the current page's panels.

- Frame order: `panel1 → panel2 → panel3 → panel4`
- Delay: 1.2s per frame
- Best for: sharing a single page highlight

### Mode 6: Loop Preview

Story Flow but the last frame transitions back to the first (seamless loop). Good for social media autoplay.

- Same as Story Flow + first frame repeated at end with short delay
- Best for: Instagram stories, Discord embeds

---

## UI

Replace the current two GIF buttons with:

```
┌──────────────────────────────────┐
│ 🎬 Export GIF                    │
│                                  │
│  ○ Story Flow    — panels only   │
│  ○ Page Reveal   — panels + page │
│  ○ Slideshow     — pages only    │
│  ○ Cinematic     — zoom & pan    │
│  ○ This Page     — current page  │
│  ○ Loop          — seamless loop │
│                                  │
│  [ Create GIF ]                  │
└──────────────────────────────────┘
```

Radio buttons, one selection, single export button. Default: Story Flow.

---

## Implementation Priority

| Mode        | Effort       | Recommendation                              |
| ----------- | ------------ | ------------------------------------------- |
| Story Flow  | 30 min       | **Do first** — simplest, most useful        |
| This Page   | 15 min       | Trivial — Story Flow scoped to current page |
| Slideshow   | 30 min       | Easy — just capture full pages              |
| Page Reveal | Already done | Current behavior, keep it                   |
| Loop        | 10 min       | Story Flow + duplicate first frame          |
| Cinematic   | 2-3 hrs      | Fancy — zoom/pan sub-frames, do last        |

**Ship with 4 modes first:** Story Flow, Page Reveal, Slideshow, This Page. Add Loop and Cinematic later.

---

## Files to Change

| File                           | Change                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `src/screens/EditorScreen.tsx` | Replace two GIF buttons with mode selector + single export, add mode-specific logic |
