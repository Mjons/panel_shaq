# Panel Shaq: Composable Border Effects — Handoff

**Date:** 2026-03-24
**From:** Panel Haus Desktop
**To:** Panel Shaq Mobile

---

## What This Is

Panel Haus has a composable border effects system — 4 independent effect layers that stack on top of each other to create hand-drawn, inky, sketchy, and organic panel borders. Users mix and match layers via sliders or pick from 6 quick presets.

This doc gives you everything you need to port it to Panel Shaq's mobile canvas.

---

## The 4 Effect Layers

Each layer is independent. Users can enable any combination. Displacements add together per-pixel along the border path.

| Layer      | What It Does                           | Max Displacement | Algorithm                    |
| ---------- | -------------------------------------- | ---------------- | ---------------------------- |
| **Round**  | Rounds panel corners                   | 0-25px radius    | Simple `cornerRadius` math   |
| **Wobble** | Slow organic waviness, like hand-drawn | 0-3px            | 2D Simplex noise             |
| **Jitter** | High-frequency pencil scratches        | 0-2px            | Seeded uniform random        |
| **Ink**    | Rich, expressive, two-octave wobble    | 0-5px            | Two octaves of simplex noise |

### Layer Parameter

Each layer has one parameter: **intensity** (0-100 integer). That's it. One slider per layer.

```
intensity: 0   → effect is off
intensity: 50  → moderate
intensity: 100 → maximum
```

---

## Data Model

### On Each Panel

```js
panel.borderStyle = {
  seed: 472831, // integer 0-999999, deterministic PRNG seed
  layers: [
    { effect: "round", intensity: 30 },
    { effect: "wobble", intensity: 20 },
    // only include layers with intensity > 0
  ],
};
```

- `seed` ensures the same border renders identically every frame and every export
- `layers` is an array of active effects (skip layers with intensity 0)
- `null` or `{ seed, layers: [] }` = no effects (solid border)

### Quick Presets (Copy These Exactly)

```js
const QUICK_PRESETS = [
  { id: "none", label: "None", layers: [] },
  {
    id: "comic-classic",
    label: "Comic Classic",
    layers: [
      { effect: "round", intensity: 30 },
      { effect: "wobble", intensity: 20 },
    ],
  },
  {
    id: "indie-sketch",
    label: "Indie Sketch",
    layers: [
      { effect: "round", intensity: 15 },
      { effect: "wobble", intensity: 15 },
      { effect: "jitter", intensity: 25 },
    ],
  },
  {
    id: "clean-ink",
    label: "Clean Ink",
    layers: [
      { effect: "round", intensity: 40 },
      { effect: "ink", intensity: 15 },
    ],
  },
  {
    id: "expressive",
    label: "Expressive",
    layers: [
      { effect: "round", intensity: 20 },
      { effect: "wobble", intensity: 40 },
      { effect: "ink", intensity: 30 },
    ],
  },
  {
    id: "pencil-rough",
    label: "Pencil Rough",
    layers: [
      { effect: "round", intensity: 15 },
      { effect: "wobble", intensity: 35 },
      { effect: "jitter", intensity: 30 },
      { effect: "ink", intensity: 20 },
    ],
  },
];
```

---

## The Algorithms (Portable — No Dependencies)

Everything below is pure math. No external libraries. Works in any JS environment (browser, React Native, Node).

### 1. Seeded PRNG (Alea)

Every border needs deterministic randomness so the same seed always draws the same border. Copy this class:

```js
class AleaPRNG {
  constructor(seed) {
    let e = 4022871197;
    function mash(str) {
      str = String(str);
      for (let i = 0; i < str.length; i++) {
        e += str.charCodeAt(i);
        let h = 0.02519603282416938 * e;
        e = h >>> 0;
        h -= e;
        h *= e;
        e = h >>> 0;
        h -= e;
        e += 4294967296 * h;
      }
      return 2.3283064365386963e-10 * (e >>> 0);
    }
    this.c = 1;
    this.s0 = mash(" ");
    this.s1 = mash(" ");
    this.s2 = mash(" ");
    this.s0 -= mash(seed);
    if (this.s0 < 0) this.s0 += 1;
    this.s1 -= mash(seed);
    if (this.s1 < 0) this.s1 += 1;
    this.s2 -= mash(seed);
    if (this.s2 < 0) this.s2 += 1;
  }
  next() {
    const t = 2091639 * this.s0 + 2.3283064365386963e-10 * this.c;
    this.s0 = this.s1;
    this.s1 = this.s2;
    this.s2 = t - (this.c = t | 0);
    return this.s2; // [0, 1)
  }
  range(min = 0, max = 1) {
    return min + this.next() * (max - min);
  }
}
```

### 2. 2D Simplex Noise (Seeded)

Used by wobble and ink layers. Creates smooth, organic displacement. Seeded via the Alea PRNG:

```js
function createSimplexNoise(randomFn) {
  const SQRT3 = Math.sqrt(3);
  const F2 = 0.5 * (SQRT3 - 1);
  const G2 = (3 - SQRT3) / 6;

  // Build seeded permutation table
  const perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 0; i < 255; i++) {
    const j = i + ~~(randomFn() * (256 - i));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 256; i < 512; i++) perm[i] = perm[i - 256];

  const GRAD = [
    1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 1, 0, -1, 0, 0, 1, 0, -1, 0, 1, 0,
    -1,
  ];
  const gx = Array.from(perm, (p) => GRAD[(p % 12) * 2]);
  const gy = Array.from(perm, (p) => GRAD[(p % 12) * 2 + 1]);

  return function noise(x, y) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s),
      j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t),
      y0 = y - (j - t);
    const [i1, j1] = x0 > y0 ? [1, 0] : [0, 1];
    const x1 = x0 - i1 + G2,
      y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2,
      y2 = y0 - 1 + 2 * G2;
    const ii = i & 255,
      jj = j & 255;
    let n = 0;
    let d = 0.5 - x0 * x0 - y0 * y0;
    if (d > 0) {
      d *= d;
      n +=
        d * d * (gx[perm[ii + perm[jj]]] * x0 + gy[perm[ii + perm[jj]]] * y0);
    }
    d = 0.5 - x1 * x1 - y1 * y1;
    if (d > 0) {
      d *= d;
      n +=
        d *
        d *
        (gx[perm[ii + i1 + perm[jj + j1]]] * x1 +
          gy[perm[ii + i1 + perm[jj + j1]]] * y1);
    }
    d = 0.5 - x2 * x2 - y2 * y2;
    if (d > 0) {
      d *= d;
      n +=
        d *
        d *
        (gx[perm[ii + 1 + perm[jj + 1]]] * x2 +
          gy[perm[ii + 1 + perm[jj + 1]]] * y2);
    }
    return 70 * n; // [-1, 1]
  };
}
```

### 3. Per-Layer Displacement Functions

```js
function wobbleDisplacement(pos, edgeIdx, intensity, noiseFn) {
  if (intensity === 0) return 0;
  const freq = 0.012 + intensity * 0.0003;
  const amp = intensity * 0.03;
  return noiseFn(pos * freq, edgeIdx * 73.7) * amp;
}

function jitterDisplacement(intensity, rng) {
  if (intensity === 0) return 0;
  const amt = intensity * 0.02;
  return rng.range(-amt, amt);
}

function inkDisplacement(pos, edgeIdx, intensity, noiseFn) {
  if (intensity === 0) return 0;
  const freq = 0.015 + intensity * 0.0005;
  const amp = intensity * 0.05;
  const octave1 = noiseFn(pos * freq, edgeIdx * 91) * amp;
  const octave2 = noiseFn(pos * freq * 2.5, edgeIdx * 91 + 333) * amp * 0.3;
  return octave1 + octave2;
}
```

---

## Path Generation (The Core Function)

This generates the border path for a rectangular panel. Walk each edge in 2.5px steps, sum displacement from all active layers, apply perpendicular to the edge:

```js
function generateBorderPath(width, height, layers, seed) {
  const rng = new AleaPRNG(seed);
  const noise = createSimplexNoise(() => rng.next());

  // Extract intensities
  const roundInt = layers.find((l) => l.effect === "round")?.intensity || 0;
  const wobbleInt = layers.find((l) => l.effect === "wobble")?.intensity || 0;
  const jitterInt = layers.find((l) => l.effect === "jitter")?.intensity || 0;
  const inkInt = layers.find((l) => l.effect === "ink")?.intensity || 0;

  const hasDisplacement = wobbleInt > 0 || jitterInt > 0 || inkInt > 0;

  // Corner radius
  let cr = Math.min(roundInt * 0.25, width / 4, height / 4);
  if (hasDisplacement && cr < 4) cr = 4; // min rounding when displacement active

  // Define the 4 edges (after corner radius inset)
  // Each edge: start point, end point, perpendicular direction
  const edges = [
    { x1: cr, y1: 0, x2: width - cr, y2: 0, px: 0, py: -1 }, // top
    { x1: width, y1: cr, x2: width, y2: height - cr, px: 1, py: 0 }, // right
    { x1: width - cr, y1: height, x2: cr, y2: height, px: 0, py: 1 }, // bottom
    { x1: 0, y1: height - cr, x2: 0, y2: cr, px: -1, py: 0 }, // left
  ];

  const points = [];

  edges.forEach((edge, edgeIdx) => {
    const dx = edge.x2 - edge.x1;
    const dy = edge.y2 - edge.y1;
    const edgeLen = Math.hypot(dx, dy);
    const steps = Math.max(4, Math.ceil(edgeLen / 2.5));

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const pos = t * edgeLen;

      // Sum displacement from all active layers
      let disp = 0;
      disp += wobbleDisplacement(pos, edgeIdx, wobbleInt, noise);
      disp += jitterDisplacement(jitterInt, rng);
      disp += inkDisplacement(pos, edgeIdx, inkInt, noise);

      points.push({
        x: edge.x1 + dx * t + edge.px * disp,
        y: edge.y1 + dy * t + edge.py * disp,
      });
    }

    // Add rounded corner arc (6 sample points)
    if (cr > 0) {
      const cornerCenters = [
        { cx: width - cr, cy: cr }, // top-right
        { cx: width - cr, cy: height - cr }, // bottom-right
        { cx: cr, cy: height - cr }, // bottom-left
        { cx: cr, cy: cr }, // top-left
      ];
      const startAngles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
      const c = cornerCenters[edgeIdx];
      const sa = startAngles[edgeIdx];
      for (let i = 1; i <= 6; i++) {
        const angle = sa + (Math.PI / 2) * (i / 6);
        let px = c.cx + Math.cos(angle) * cr;
        let py = c.cy + Math.sin(angle) * cr;
        // Apply displacement to corner points too
        const cornerDisp =
          wobbleDisplacement(i * 5, edgeIdx + 4, wobbleInt, noise) +
          jitterDisplacement(jitterInt, rng) +
          inkDisplacement(i * 5, edgeIdx + 4, inkInt, noise);
        const nx = Math.cos(angle),
          ny = Math.sin(angle);
        px += nx * cornerDisp;
        py += ny * cornerDisp;
        points.push({ x: px, y: py });
      }
    }
  });

  return points;
}
```

---

## Rendering the Path

Once you have the points array, draw it as a closed path on your canvas:

### Canvas 2D (works with Konva sceneFunc, React Native Canvas, etc.)

```js
function drawBorderPath(ctx, points, strokeColor, strokeWidth) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.stroke();
}
```

### For Konva (if Panel Shaq uses Konva)

```js
const borderShape = new Konva.Shape({
  x: panel.x,
  y: panel.y,
  stroke: panel.strokeColor || "#000",
  strokeWidth: panel.strokeWidth || 2,
  fill: "transparent",
  sceneFunc: (ctx, shape) => {
    const points = generateBorderPath(panel.width, panel.height, layers, seed);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++)
      ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStrokeShape(shape);
  },
});
```

### For SVG (if Panel Shaq uses SVG for panels)

```js
function borderPathToSVG(points) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  d += " Z";
  return d;
}
// <path d={borderPathToSVG(points)} stroke="#000" stroke-width="2" fill="none" />
```

---

## Caching (Important for Performance)

Generating the path is not free — a 400px panel has ~640 sample points with noise calculations. Cache the result:

```js
const pathCache = new Map();
const MAX_CACHE = 100; // mobile: keep smaller than desktop's 200

function getCachedPath(width, height, layers, seed) {
  const key = `${seed}-${width}-${height}-${layers.map((l) => l.effect + ":" + l.intensity).join(",")}`;

  if (pathCache.has(key)) return pathCache.get(key);

  const points = generateBorderPath(width, height, layers, seed);

  if (pathCache.size >= MAX_CACHE) {
    // Evict oldest entry
    const firstKey = pathCache.keys().next().value;
    pathCache.delete(firstKey);
  }

  pathCache.set(key, points);
  return points;
}

// Call when seed changes (randomize button)
function invalidateCache(seed) {
  for (const key of pathCache.keys()) {
    if (key.startsWith(String(seed))) pathCache.delete(key);
  }
}
```

---

## Mobile UI Suggestion

On mobile, 4 sliders + 6 preset buttons is a lot of UI. Recommended approach:

### Option A: Presets Only (Simplest)

Just show the 6 preset buttons. One tap, done. No sliders.

```
┌──────────────────────────────────┐
│ Border Style                     │
│                                  │
│ [None] [Comic] [Sketch] [Ink]   │
│ [Expressive] [Pencil] [🎲]      │
│                                  │
│ 🎲 = randomize seed             │
└──────────────────────────────────┘
```

### Option B: Presets + Expandable Sliders

Presets at the top, "Customize" expander reveals the 4 sliders.

```
┌──────────────────────────────────┐
│ Border Style                     │
│                                  │
│ [None] [Comic] [Sketch] [Ink]   │
│ [Expressive] [Pencil] [🎲]      │
│                                  │
│ ▼ Customize                     │
│ ┌──────────────────────────────┐ │
│ │ Round   ═══●═══════  [30]   │ │
│ │ Wobble  ═════●═════  [20]   │ │
│ │ Jitter  ═══════════  [ 0]   │ │
│ │ Ink     ═══════════  [ 0]   │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

---

## Export Compatibility

When Panel Shaq exports a `.comic` file, include `borderStyle` on each panel:

```json
{
  "id": "panel-1",
  "x": 10,
  "y": 10,
  "width": 470,
  "height": 337,
  "strokeWidth": 2,
  "strokeColor": "#000000",
  "borderStyle": {
    "seed": 472831,
    "layers": [
      { "effect": "round", "intensity": 30 },
      { "effect": "wobble", "intensity": 20 }
    ]
  }
}
```

Panel Haus reads this natively — no conversion needed. The same seed + layers produce the same visual on both platforms because the algorithms are deterministic.

If `borderStyle` is `null` or absent, Panel Haus renders a standard solid border (existing behavior).

---

## What to Copy from Panel Haus

You can literally copy one file:

**`src/utils/borderStyles.js`** — contains everything:

- `AleaPRNG` class
- `createSimplexNoise()` function
- Displacement functions (wobble, jitter, ink)
- `generateComposedRectPath()` — the main path generator
- `QUICK_PRESETS` array
- `EFFECT_LAYERS` definitions
- Path cache utilities

This file has **zero imports** — it's fully self-contained. Drop it into Panel Shaq's codebase and call `generateComposedRectPath(w, h, layers, seed)`.

If Panel Shaq uses Konva (it does), also grab:

- `getBorderSceneFunc()` — returns a Konva-compatible sceneFunc
- `hasActiveBorderStyle()` — checks if a borderStyle has any active layers
- `getBorderCornerRadius()` — returns the corner radius for image clipping

---

## Checklist

- [ ] Copy `borderStyles.js` into Panel Shaq
- [ ] Add `borderStyle` to panel data model (`{ seed, layers }`)
- [ ] Replace solid `Konva.Rect` stroke with `Konva.Shape` + `getBorderSceneFunc()` when `borderStyle` has active layers
- [ ] Add preset buttons to panel controls UI
- [ ] (Optional) Add customization sliders behind an expander
- [ ] Add randomize seed button (🎲)
- [ ] Include `borderStyle` in `.comic` export
- [ ] Test: apply each preset, verify visual matches Panel Haus
- [ ] Test: export `.comic` with borders, import in Panel Haus, verify identical rendering
