# GIF Editor Implementation Plan

Existing export stays exactly where it is — Editor sidebar keeps PNG, GIF quick modes, share buttons. The GIF Editor is a **new, separate screen** for users who want to craft their animation. Think of it as the advanced mode.

```
Workshop → Director → Layout → Editor → GIF Editor (optional)
                                  │
                                  └─ existing export stays here
                                       (PNG, quick GIF, .comic, share)
```

**Entry point:** "Edit GIF" button in the Editor's GIF export section. Opens the GIF Editor with all panels pre-loaded. The GIF Editor has its own canvas, its own preview, and its own export button — completely independent from Editor's DOM.

---

## Architecture: Why This Is Safe

The GIF Editor does **not** need EditorScreen's `comicRef` or `gifVisibleCount`. It works differently:

- On entry, it receives the panel image data (already-generated images from the panels array)
- It renders everything on its own canvas — no DOM capture, no html-to-image
- Preview and export both work from the same canvas-based pipeline
- Zero coupling to EditorScreen's rendering. Editor doesn't change at all.

---

## Phase 1: GIF Editor Screen + Timeline

**Goal:** New screen with a timeline strip, per-panel config, and canvas-based preview. Users can set movement and duration per panel, preview the result, and export.

### Data Model

```typescript
// src/types/gif.ts

interface GifPanelConfig {
  panelId: string;
  imageData: string; // base64 or blob URL — panel image
  movement:
    | "hold"
    | "pan-lr"
    | "pan-rl"
    | "pan-ud"
    | "zoom-in"
    | "zoom-out"
    | "fade-in"
    | "fade-out";
  duration: number; // seconds (0.5-5.0)
  transitionOut: "cut"; // only Cut in this phase
  transitionDuration: number;
  skip?: boolean;
  zoomAmount?: number; // 1.0-2.0
  aspectRatio: number; // width/height of source panel
}

interface GifProject {
  panels: GifPanelConfig[];
  width: number;
  height: number;
  fps: number;
  loop: boolean;
}
```

### Tasks

1. **Create `GifEditorScreen.tsx`**
   - New screen component, full-page layout
   - Add `"gif-editor"` to navigation (not in the main tab bar — accessed via button from Editor)
   - Receives panels with their image data as input
   - Back button returns to Editor

2. **Load panel images on entry**
   - When the user taps "Edit GIF" in Editor, gather all panel images from app state
   - Build initial `GifProject` with smart defaults based on panel shape:
     - Wide panels (aspect ratio > 1.5) → Pan Left→Right
     - Tall panels (aspect ratio < 0.67) → Pan Up→Down
     - Square-ish panels → Hold
     - First panel → Fade In
     - Last panel → Fade Out
     - All transitions → Cut
     - Default duration: 1.2s

3. **Build the timeline strip**
   - Horizontal scrollable strip at the bottom
   - Each panel: thumbnail, movement label, duration
   - Tap to select → opens panel editor
   - Show totals: total duration, estimated frame count, estimated file size
   - Visual indicator for selected panel

4. **Build the panel config editor**
   - Side panel or bottom sheet when a panel is tapped
   - Movement picker: `[Hold] [Pan→] [Pan←] [Pan↓] [Zoom In] [Zoom Out]`
   - Duration slider (0.5s–5.0s)
   - Skip checkbox
   - Zoom amount slider (visible when Zoom selected, 1.2x–2.0x)

5. **Preset buttons**
   - Row above the timeline: `[Story Flow] [Cinematic] [Dramatic] [Slideshow] [Custom]`
   - Each preset auto-tags all panels:
     - **Story Flow** → all Hold, all Cut, 1.2s
     - **Cinematic** → alternating Zoom In / Pan, Cross-fade (Cut for now), 1.5s
     - **Dramatic** → Zoom on close-ups, Hold on wide shots, 1.0s
     - **Slideshow** → all Hold, 3.0s
   - Editing any panel switches to Custom
   - User picks a preset as starting point, then tweaks

6. **Live preview canvas**
   - Canvas element in the main area above the timeline
   - Draws panel images directly (no DOM capture — works from image data)
   - Implements Hold (static), Pan (translate), Zoom (scale) animations
   - Play/pause button
   - Loops continuously
   - Uses `requestAnimationFrame` for smooth playback

7. **GIF export from the editor**
   - "Export GIF" button
   - Canvas-based frame generation — renders each frame by drawing the panel image with the configured animation transform
   - Encodes with `modern-gif` (same library already in use)
   - Progress bar + cancel support
   - Share via `navigator.share()` or direct download
   - Completely independent from EditorScreen's export

8. **Add "Edit GIF" entry point in Editor**
   - New button in the Editor sidebar's GIF section: "Edit GIF" or "GIF Editor"
   - Navigates to GIF Editor screen
   - Sits alongside the existing quick GIF mode buttons (which stay unchanged)

### Done when

- "Edit GIF" button in Editor opens the GIF Editor screen
- Timeline shows all panels with thumbnails, movement labels, durations
- Tapping a panel opens config editor
- Presets auto-configure all panels
- Live preview plays Hold, Pan, Zoom animations correctly
- Export produces a GIF that matches the preview
- Back button returns to Editor
- Existing Editor export is untouched — no regressions

---

## Phase 2: Transitions + Effects

**Goal:** Add transitions between panels and special effects.

### Data Model Update

```typescript
interface GifPanelConfig {
  // ... existing fields from Phase 1
  transitionOut: "cut" | "cross-fade" | "wipe-left" | "wipe-up" | "flash";
  shake?: boolean;
  shakeIntensity?: number; // 1-10
  pulse?: boolean;
  pulseAmount?: number; // 1.05-1.2
}
```

### Tasks

1. **Transition picker in panel editor**
   - New row: `[Cut] [Fade] [Wipe→] [Wipe↑] [Flash]`
   - Transition duration slider (0.2s–1.0s)
   - Timeline strip shows transition type between panels

2. **Implement cross-fade**
   - Canvas: draw outgoing panel at decreasing opacity, incoming at increasing
   - Generate blended intermediate frames

3. **Implement wipe transitions**
   - Wipe Left: clip new panel sliding in from right
   - Wipe Up: clip new panel sliding in from bottom

4. **Implement flash transition**
   - 2-3 white frames between panels

5. **Implement shake effect**
   - Random x/y offset per frame, intensity controls max offset
   - Checkbox + intensity slider in panel editor

6. **Implement pulse effect**
   - Quick scale up then back to 1.0x at panel start
   - Checkbox + amount slider in panel editor

7. **Update preview and export**
   - Preview renders transitions smoothly between panels
   - Export generates intermediate frames for transitions
   - Update file size estimate (more frames = larger)

### Done when

- All 5 transition types work in preview and export
- Shake and pulse effects work in preview and export
- Timeline shows transition indicators between panels

---

## Phase 3: Polish + Advanced Features

**Goal:** Power-user features. Each is independent — ship individually.

### Tasks (pick and choose)

1. **Ken Burns effect**
   - Slow zoom + diagonal drift
   - Simple: predefined diagonal paths
   - Stretch: draggable start/end focus points on the panel

2. **Timeline scrubbing**
   - Draggable playhead to seek to any point
   - Preview updates in real-time while scrubbing

3. **Spotlight / vignette**
   - Radial gradient overlay, intensity slider

4. **Full Page frame**
   - Insert the composed full-page image into the sequence
   - Show panels one by one, then the full page as a reveal

5. **Undo/redo**
   - Config change history stack
   - Essential for experimentation

6. **Frame rate and quality controls**
   - FPS selector (5, 10, 15, 20)
   - Output width (320, 480, 640, 800)
   - Live file size estimate updates

7. **Per-panel speed curves**
   - Ease-in, ease-out, linear for each movement

8. **Page scope selector**
   - All pages, current page, or custom page selection

### Done when

- Each feature works in preview and export
- No regressions to Phase 1/2

---

## File Map

New files:

| File                                  | Purpose                                           |
| ------------------------------------- | ------------------------------------------------- |
| `src/screens/GifEditorScreen.tsx`     | Main GIF Editor screen                            |
| `src/components/GifTimeline.tsx`      | Timeline strip component                          |
| `src/components/GifPanelEditor.tsx`   | Per-panel config editor                           |
| `src/components/GifPreview.tsx`       | Live canvas preview                               |
| `src/services/gifAnimationService.ts` | Frame generation — movement, transitions, effects |
| `src/types/gif.ts`                    | `GifPanelConfig`, `GifProject` interfaces         |

Existing files that change:

| File                           | Change                                             |
| ------------------------------ | -------------------------------------------------- |
| `src/screens/EditorScreen.tsx` | Add "Edit GIF" button (existing export unchanged)  |
| `src/App.tsx`                  | Add `"gif-editor"` route, render `GifEditorScreen` |

Files that do NOT change:

- `Navigation.tsx` — GIF Editor is not a main tab, just a route
- `ShareScreen.tsx` — stays as-is
- Editor export logic — untouched

---

## Phase Summary

| Phase | What Ships                                                         | Builds On | Risk to Existing Code                                |
| ----- | ------------------------------------------------------------------ | --------- | ---------------------------------------------------- |
| **1** | GIF Editor screen with timeline, basic animations, preview, export | —         | **None** — additive only, one button added to Editor |
| **2** | Transitions + effects (fade, wipe, flash, shake, pulse)            | Phase 1   | **None** — changes only within GIF Editor            |
| **3** | Ken Burns, scrubbing, undo/redo, quality controls                  | Phase 2   | **None** — changes only within GIF Editor            |

Every phase is purely additive. The existing Editor export keeps working exactly as it does today. The GIF Editor is a self-contained screen with its own canvas pipeline — no shared refs, no shared DOM, no coupling.
