# Outer Border Effect — Exploration

## The Problem

The composable border effects (wobble, jitter, ink) currently only affect the **inner stroke** — an SVG `<path>` drawn inside the panel div. But the panel div itself is a CSS rectangle with hard edges. So you get organic wobble on the inside, and a flat box on the outside.

The visual mismatch is most obvious with high-intensity effects: the inner border is expressive and hand-drawn, but the outer silhouette of the panel is a crisp rectangle.

**Goal:** Make the panel's outer edge match the same organic shape as the border effect.

---

## Why It's Tricky

Panel divs are CSS grid cells. Their shape is defined by the CSS box model — always a rectangle. CSS doesn't natively support arbitrary path-based clipping that also affects layout. The grid gap between panels is a flat, predictable space.

There are three possible approaches, each with tradeoffs:

---

## Option A: CSS `clip-path` with SVG Path

Use the same generated border path as a `clip-path` on the panel div. This clips the entire panel (image + bubbles + overlays) to the organic shape.

```tsx
<div
  className="panel-cell"
  style={{
    clipPath: `path('${borderPathToSVG(points)}')`,
  }}
>
```

**Pros:**

- Clips everything — image, bubbles, border overlay all conform to the shape
- Truly organic outer edge
- Pure CSS, no extra DOM elements
- `html-to-image` captures it correctly for export

**Cons:**

- `clip-path: path()` uses **fixed pixel coordinates**, not percentages. The path must match the exact rendered pixel size of the panel div. This means recalculating the clip path on every resize (already done via `ResizeObserver` in `BorderEffectOverlay`).
- Clip path removes overflow — bubbles that extend beyond the panel will be clipped. This is already the case (`overflow-hidden` on panels), so no change in behavior.
- Very slight gap between adjacent panels where the wobble indents — the page background color shows through. This actually looks _good_ — like hand-drawn panels with breathing room.

**Verdict: This is the best approach.** It's the simplest, most correct, and the tradeoffs are either neutral or positive.

### Implementation

1. Move the path generation **up** from `BorderEffectOverlay` into the panel cell itself
2. Apply `clipPath` to the panel div's style
3. Keep the SVG stroke overlay on top for the visible border line
4. Both use the same cached path (same seed, same size)

```tsx
const panelRef = useRef<HTMLDivElement>(null);
const [panelSize, setPanelSize] = useState({ w: 0, h: 0 });

// ResizeObserver to track panel size
useEffect(() => { ... }, []);

const hasEffect = hasActiveBorderStyle(panel.borderStyle);
const clipPath = hasEffect && panelSize.w > 0
  ? `path('${borderPathToSVG(getCachedBorderPath(panelSize.w, panelSize.h, panel.borderStyle!.layers, panel.borderStyle!.seed))}')`
  : undefined;

return (
  <div
    ref={panelRef}
    style={{
      clipPath,
      ...gridSlotStyles,
    }}
  >
    <PanelImage ... />
    <BorderEffectOverlay ... />  {/* stroke line */}
    <BubbleOverlay ... />
  </div>
);
```

**Effort:** ~1-2 hours. The path generation and ResizeObserver already exist in `BorderEffectOverlay` — just hoist them up one level and share the path.

---

## Option B: SVG `<clipPath>` Element

Instead of CSS `clip-path: path()`, use an inline SVG `<clipPath>` definition and reference it via `clip-path: url(#id)`.

```tsx
<svg width="0" height="0" style={{ position: 'absolute' }}>
  <defs>
    <clipPath id={`border-clip-${pid}`} clipPathUnits="objectBoundingBox">
      <path d={normalizedPath} />
    </clipPath>
  </defs>
</svg>
<div style={{ clipPath: `url(#border-clip-${pid})` }}>
```

**Pros:**

- Can use `clipPathUnits="objectBoundingBox"` to normalize coordinates to 0-1 range (no pixel recalculation needed)
- Better browser support for complex paths

**Cons:**

- Normalizing the path coordinates (dividing all x by width, y by height) adds complexity
- Hidden SVG elements in the DOM
- Slightly more complex than Option A
- `html-to-image` may not capture SVG `<clipPath>` references correctly

**Verdict:** More complex than Option A for marginal benefit. Not recommended unless `clip-path: path()` has browser issues.

---

## Option C: Canvas-Based Rendering

Render the entire panel (image + borders) on a `<canvas>` element, using the border path as both clip mask and stroke.

**Pros:**

- Complete control over rendering
- Matches Panel Haus Desktop's approach (Konva canvas)

**Cons:**

- Massive rewrite — speech bubbles, drag gestures, pinch-to-zoom all need canvas equivalents
- Loses DOM accessibility
- Breaks `html-to-image` export pipeline
- Essentially rewriting the entire Editor screen

**Verdict:** Way too much work. Not worth it.

---

## Recommendation

**Go with Option A: CSS `clip-path: path()`.**

- Simplest implementation
- Already have all the pieces (path generation, ResizeObserver, cache)
- Just need to hoist the path up from the SVG overlay to the panel div's style
- Organic outer edges with zero extra DOM complexity
- The "gap" between panels where wobble indents actually enhances the hand-drawn feel

---

## Edge Cases to Handle

| Case                                        | Handling                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| No border effect active                     | No `clipPath` applied — standard rectangle                              |
| Panel resize (window resize, layout change) | ResizeObserver triggers recalculation                                   |
| Export via `html-to-image`                  | CSS `clip-path: path()` is captured correctly                           |
| Fullscreen panel editing                    | Recalculate path at fullscreen dimensions                               |
| Very small panels                           | Reduce path sample density (already handled — `Math.max(4, ...)` steps) |

---

## Files to Change

| File                           | Changes                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `src/screens/EditorScreen.tsx` | Hoist path generation to panel cell, apply `clipPath` style, keep SVG stroke overlay |
| `src/utils/borderStyles.ts`    | No changes — already has everything needed                                           |

**Effort: ~1-2 hours**
