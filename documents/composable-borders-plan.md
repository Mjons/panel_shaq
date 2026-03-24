# Composable Border Effects & Colors — Implementation Plan

## Context

Panel Haus Desktop has a composable border system with 4 stackable effect layers (round, wobble, jitter, ink) and 6 quick presets. The algorithms are pure math — no dependencies. This plan covers porting it to Panel Shaq's CSS/HTML rendering and adding border color controls.

Panel Shaq does NOT use Konva or canvas for panel rendering — it uses CSS grid cells with `overflow-hidden`. Border effects will be rendered as **SVG clip paths or overlaid SVG shapes** on each panel div.

---

## Phase 1: Border Color (Quick Win)

### What

Let users pick a border color per-panel or globally. Currently hardcoded to no visible border (panels are `bg-black` divs with no stroke).

### Data Model

Add to `PanelPrompt`:

```typescript
borderColor?: string;   // hex color, default "#000000"
borderWidth?: number;    // px, default 2
```

### UI

Add a small color picker to the Editor sidebar when a panel is selected. 8 preset swatches + a custom hex input:

```
Black  White  Red  Blue  Gold  Green  Purple  None
[ ● ]  [ ● ] [ ● ] [ ● ] [ ● ]  [ ● ]  [ ● ]  [ ○ ]
```

### Rendering

Simple CSS on the panel div:

```tsx
style={{
  border: panel.borderColor !== 'none'
    ? `${panel.borderWidth || 2}px solid ${panel.borderColor || '#000'}`
    : 'none',
}}
```

### Export

Include `strokeColor` and `strokeWidth` in `.comic` export (already has fields for these, just needs real values instead of hardcoded `#000000`).

### Effort: ~1 hour

---

## Phase 2: Border Effect Presets (Main Feature)

### What

6 quick presets that apply hand-drawn/organic border effects to panels. Users tap a preset button — one tap, done.

### Architecture

Since Panel Shaq uses HTML/CSS (not canvas), border effects are rendered as **SVG `<path>` overlays** on each panel:

```tsx
<div className="panel-cell" style={{ position: 'relative', overflow: 'hidden' }}>
  {/* Panel image */}
  <PanelImage ... />

  {/* Border effect overlay */}
  {panel.borderStyle && hasActiveBorderStyle(panel.borderStyle) && (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${panelWidth} ${panelHeight}`}
      preserveAspectRatio="none"
    >
      <path
        d={borderPathToSVG(getCachedPath(panelWidth, panelHeight, panel.borderStyle.layers, panel.borderStyle.seed))}
        fill="none"
        stroke={panel.borderColor || '#000'}
        strokeWidth={panel.borderWidth || 2}
      />
    </svg>
  )}

  {/* Bubbles */}
  ...
</div>
```

The SVG overlay approach means:

- No canvas dependency
- Works with the existing CSS layout
- Scales with the panel div
- Exports correctly with `html-to-image` (SVG is part of the DOM)

### Files to Add

**`src/utils/borderStyles.ts`** — Copy directly from Panel Haus Desktop:

- `AleaPRNG` class
- `createSimplexNoise()`
- Displacement functions (wobble, jitter, ink)
- `generateBorderPath()` — renamed from `generateComposedRectPath`
- `QUICK_PRESETS` array
- Path cache utilities
- `borderPathToSVG()` — convert points array to SVG path `d` attribute
- `hasActiveBorderStyle()` — check if borderStyle has any active layers

This file is **zero dependencies** — pure math, fully self-contained.

### Data Model

Add to `PanelPrompt`:

```typescript
borderStyle?: {
  seed: number;          // 0-999999
  layers: Array<{
    effect: 'round' | 'wobble' | 'jitter' | 'ink';
    intensity: number;   // 0-100
  }>;
} | null;
```

### UI — Presets Only (Mobile-First)

Add to the Editor panel controls (when a panel is selected):

```
┌─────────────────────────────────────┐
│ Border Effect                       │
│                                     │
│ [None] [Comic] [Sketch]            │
│ [Ink] [Express] [Pencil] [🎲]      │
└─────────────────────────────────────┘
```

- 6 preset buttons in a 3x2 grid
- Dice button randomizes the seed (re-rolls the random variation)
- Tapping a preset applies it to the selected panel
- Active preset highlighted with primary color
- No sliders on mobile (presets cover the main use cases)

### Rendering Sizes

The SVG `viewBox` needs the panel's pixel dimensions. Use a `ResizeObserver` or read from the panel div's `offsetWidth`/`offsetHeight`:

```typescript
const [panelSize, setPanelSize] = useState({ w: 0, h: 0 });
const panelRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!panelRef.current) return;
  const obs = new ResizeObserver(([entry]) => {
    setPanelSize({ w: entry.contentRect.width, h: entry.contentRect.height });
  });
  obs.observe(panelRef.current);
  return () => obs.disconnect();
}, []);
```

### Caching

The path cache from the handoff doc applies directly. Cache limit of 100 entries (mobile-friendly). Cache key is `seed-width-height-layers`.

### Export (.comic)

Include `borderStyle` on each panel in the `.comic` export:

```typescript
// In exportComicService.ts
borderStyle: panel.borderStyle || null,
```

Panel Haus reads this natively — same seed + layers = same visual.

### Effort: ~1 day

---

## Phase 3: Custom Sliders (Optional, Low Priority)

### What

For power users who want fine control: expandable section below the presets with 4 sliders (round, wobble, jitter, ink).

### UI

```
▼ Customize
┌─────────────────────────────────┐
│ Round   ═══●═══════  30        │
│ Wobble  ═════●═════  20        │
│ Jitter  ═══════════   0        │
│ Ink     ═══════════   0        │
└─────────────────────────────────┘
```

- Collapsed by default
- Each slider: 0-100 range, updates the corresponding layer intensity
- Moving any slider switches to "Custom" state (no preset highlighted)
- Uses native `<input type="range">` styled to match the app

### Effort: ~2-3 hours

---

## Implementation Order

| Step | What                                                             | Effort    | Depends On |
| ---- | ---------------------------------------------------------------- | --------- | ---------- |
| 1    | Copy `borderStyles.ts` from Panel Haus, adapt types              | 30 min    | —          |
| 2    | Add `borderColor`, `borderWidth`, `borderStyle` to `PanelPrompt` | 15 min    | —          |
| 3    | Border color picker in Editor sidebar                            | 1 hour    | Step 2     |
| 4    | SVG overlay component for border effects                         | 1-2 hours | Step 1, 2  |
| 5    | Preset buttons in Editor panel controls                          | 1 hour    | Step 4     |
| 6    | Wire up to `.comic` export                                       | 30 min    | Step 2     |
| 7    | (Optional) Custom sliders                                        | 2-3 hours | Step 5     |

**Total: ~half a day for Phase 1+2, or ~1 day including Phase 3.**

---

## Files to Change

| File                                 | Changes                                                             |
| ------------------------------------ | ------------------------------------------------------------------- |
| `src/utils/borderStyles.ts`          | **New** — copy from Panel Haus, add `borderPathToSVG()`             |
| `src/services/geminiService.ts`      | Add `borderColor`, `borderWidth`, `borderStyle` to `PanelPrompt`    |
| `src/screens/EditorScreen.tsx`       | SVG overlay on panels, preset buttons + color picker in sidebar     |
| `src/services/exportComicService.ts` | Include `borderStyle`, `strokeColor`, `strokeWidth` from panel data |

---

## Visual Parity with Panel Haus

Because the algorithms are pure math with seeded PRNG:

- Same `seed` + same `layers` = same border path on both platforms
- The SVG rendering will have slightly different anti-aliasing than Konva canvas, but the shape is identical
- `.comic` export round-trips perfectly — Panel Haus reads the `borderStyle` and renders with its own Konva implementation

---

## What This Does NOT Include

- Per-page borders (only per-panel)
- Animated borders
- Border effects on speech bubbles (could be a future enhancement)
- Gradient borders (could add later with SVG linearGradient)
