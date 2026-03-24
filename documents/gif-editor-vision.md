# GIF Editor Vision

## The Idea

A dedicated GIF editing screen where you tag each panel with animation behaviors, preview the sequence in real-time, then export. Instead of picking a global mode, you compose the animation panel-by-panel — like a storyboard for the GIF itself.

---

## Per-Panel Animation Tags

Each panel gets one or more animation tags that control how it appears in the GIF:

### Movement Tags

| Tag                | What It Does                         | Params                          |
| ------------------ | ------------------------------------ | ------------------------------- |
| **Hold**           | Static frame, just display the panel | Duration (0.5-5s)               |
| **Pan Left→Right** | Slowly pan across a wide panel       | Duration, direction             |
| **Pan Right→Left** | Reverse pan                          | Duration                        |
| **Pan Up→Down**    | Vertical pan for tall panels         | Duration                        |
| **Zoom In**        | Start wide, zoom into center         | Duration, zoom amount (1.2x-2x) |
| **Zoom Out**       | Start zoomed, pull back to full      | Duration, zoom amount           |
| **Ken Burns**      | Slow zoom + drift (diagonal)         | Duration, start/end points      |
| **Fade In**        | Fade from black                      | Duration                        |
| **Fade Out**       | Fade to black                        | Duration                        |

### Transition Tags (between panels)

| Tag            | What It Does                        | Params            |
| -------------- | ----------------------------------- | ----------------- |
| **Cut**        | Instant switch (default)            | —                 |
| **Cross-fade** | Blend between two panels            | Duration (0.3-1s) |
| **Wipe Left**  | Slide new panel in from right       | Duration          |
| **Wipe Up**    | Slide new panel in from bottom      | Duration          |
| **Flash**      | White flash between panels (impact) | Duration          |

### Special Tags

| Tag           | What It Does                                       | Params              |
| ------------- | -------------------------------------------------- | ------------------- |
| **Shake**     | Screen shake effect (impact moments)               | Intensity, duration |
| **Pulse**     | Quick scale up then back (emphasis)                | Amount (1.05x-1.2x) |
| **Spotlight** | Vignette focus on center                           | Intensity           |
| **Skip**      | Don't include this panel in the GIF                | —                   |
| **Full Page** | Show the composed page instead of individual panel | Duration            |

---

## UI Concept

### The Timeline

A horizontal strip at the bottom showing each panel as a thumbnail, with its tags visualized:

```
┌─────────────────────────────────────────────────────┐
│ 🎬 GIF Timeline                              [▶ ☰] │
│                                                     │
│  ┌───┐  ┌───┐  ┌───┐  ┌───┐  ┌───┐  ┌───┐        │
│  │ 1 │→│ 2 │→│ 3 │→│ 4 │→│ 5 │→│ 6 │        │
│  │   │  │   │  │   │  │   │  │   │  │   │        │
│  └───┘  └───┘  └───┘  └───┘  └───┘  └───┘        │
│  Zoom   Hold   Pan→   Shake  Ken B  Hold          │
│  1.5s   1.2s   2.0s   0.8s   1.8s   1.2s          │
│  ─cut─  ─cut─  fade─  flash  ─cut─  fade─          │
│                                                     │
│  Total: 8.5s  │  Frames: 42  │  ~2.1 MB            │
└─────────────────────────────────────────────────────┘
```

### Panel Editor (tap a panel in the timeline)

```
┌──────────────────────────────────┐
│ Panel 3 — "Hero dodges blast"    │
│                                  │
│ Movement:                        │
│ [Hold] [Pan→] [Zoom] [Ken Burns]│
│                                  │
│ Duration: ═══●═════  2.0s        │
│                                  │
│ Transition out:                  │
│ [Cut] [Fade] [Wipe] [Flash]     │
│                                  │
│ Special:                         │
│ [ ] Shake  [ ] Pulse  [ ] Skip  │
└──────────────────────────────────┘
```

### Preview

Live preview plays the GIF sequence in a loop using the canvas. No encoding needed for preview — just draw frames in real-time with `requestAnimationFrame`. User can scrub the timeline, play/pause, adjust timing.

---

## Data Model

```typescript
interface GifPanelConfig {
  panelId: string;
  movement:
    | "hold"
    | "pan-lr"
    | "pan-rl"
    | "pan-ud"
    | "zoom-in"
    | "zoom-out"
    | "ken-burns"
    | "fade-in"
    | "fade-out";
  duration: number; // seconds
  transitionOut: "cut" | "cross-fade" | "wipe-left" | "wipe-up" | "flash";
  transitionDuration: number; // seconds
  shake?: boolean;
  pulse?: boolean;
  skip?: boolean;
  zoomAmount?: number; // 1.0-2.0
}

interface GifProject {
  panels: GifPanelConfig[];
  width: number;
  height: number;
  loop: boolean;
}
```

---

## How It Fits in Panel Shaq

### Entry Point

New tab or sub-screen accessible from the Editor export section: **"Edit GIF"** button opens the GIF editor with all panels pre-loaded.

### Defaults

When opening the GIF editor, each panel gets sensible defaults based on its shape:

- Wide panels → Pan Left→Right
- Tall panels → Pan Up→Down
- Square panels → Hold
- First panel → Fade In
- Last panel → Fade Out
- All others → Cut transition

User can override any of these.

### Quick Presets (Still Available)

The existing 5 modes (Story Flow, Page Reveal, etc.) become presets that auto-tag all panels:

- **Story Flow** → all Hold, all Cut
- **Cinematic** → alternating Zoom In/Ken Burns, Cross-fade transitions
- **Dramatic** → Shake on action panels, Flash transitions, Zoom on close-ups

User picks a preset, then tweaks individual panels.

---

## Implementation Phases

### Phase 1: Basic Timeline + Hold/Pan/Zoom (MVP)

- Timeline strip with panel thumbnails
- Tap to edit: movement type + duration
- Live preview with play/pause
- Export uses the tag config instead of hardcoded modes
- **Effort: 3-4 days**

### Phase 2: Transitions + Special Effects

- Cross-fade, wipe, flash between panels
- Shake and pulse effects
- Skip tag
- **Effort: 2-3 days**

### Phase 3: Advanced

- Ken Burns with draggable start/end points
- Scrub timeline (drag to seek)
- Per-panel speed curves (ease in/out)
- Audio track sync (stretch goal)
- **Effort: 1-2 weeks**

---

## Why This Is Cool

Right now, GIF export is a one-click operation with a fixed formula. The GIF editor turns it into a **creative tool** — the user is directing a movie trailer for their comic. Same panels, completely different energy depending on how you tag them.

A dramatic scene with zoom + shake + flash feels like an action movie. The same scene with hold + fade feels like a drama. The user becomes the director of the animation, not just the comic.

This is also shareable content gold — a well-composed animated GIF of a comic is way more engaging on social media than a static image.
