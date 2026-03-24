/**
 * Composable Border Effects — ported from Panel Haus Desktop
 * Pure math, zero dependencies. Deterministic via seeded PRNG.
 */

// ── Types ──

export interface BorderLayer {
  effect: string;
  intensity: number; // 0-100
}

export interface BorderStyle {
  seed: number;
  layers: BorderLayer[];
}

export interface BorderPreset {
  id: string;
  label: string;
  layers: BorderLayer[];
}

// ── Presets ──

export const BORDER_PRESETS: BorderPreset[] = [
  { id: "none", label: "None", layers: [] },
  {
    id: "rounded",
    label: "Rounded",
    layers: [{ effect: "round", intensity: 50 }],
  },
  {
    id: "indie-sketch",
    label: "Sketch",
    layers: [
      { effect: "round", intensity: 15 },
      { effect: "wobble", intensity: 15 },
      { effect: "jitter", intensity: 25 },
    ],
  },
  {
    id: "brush-ink",
    label: "Ink",
    layers: [
      { effect: "round", intensity: 10 },
      { effect: "wobble", intensity: 10 },
      { effect: "ink", intensity: 45 },
    ],
  },
  {
    id: "expressive",
    label: "Express",
    layers: [
      { effect: "round", intensity: 20 },
      { effect: "wobble", intensity: 40 },
      { effect: "ink", intensity: 30 },
    ],
  },
  {
    id: "pencil-rough",
    label: "Pencil",
    layers: [
      { effect: "round", intensity: 15 },
      { effect: "wobble", intensity: 35 },
      { effect: "jitter", intensity: 30 },
      { effect: "ink", intensity: 20 },
    ],
  },
];

// ── Seeded PRNG (Alea) ──

class AleaPRNG {
  private c: number;
  private s0: number;
  private s1: number;
  private s2: number;

  constructor(seed: number | string) {
    let e = 4022871197;
    function mash(str: string) {
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
    this.s0 -= mash(String(seed));
    if (this.s0 < 0) this.s0 += 1;
    this.s1 -= mash(String(seed));
    if (this.s1 < 0) this.s1 += 1;
    this.s2 -= mash(String(seed));
    if (this.s2 < 0) this.s2 += 1;
  }

  next(): number {
    const t = 2091639 * this.s0 + 2.3283064365386963e-10 * this.c;
    this.s0 = this.s1;
    this.s1 = this.s2;
    this.s2 = t - (this.c = t | 0);
    return this.s2;
  }

  range(min = 0, max = 1): number {
    return min + this.next() * (max - min);
  }
}

// ── 2D Simplex Noise (Seeded) ──

function createSimplexNoise(randomFn: () => number) {
  const SQRT3 = Math.sqrt(3);
  const F2 = 0.5 * (SQRT3 - 1);
  const G2 = (3 - SQRT3) / 6;

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

  return function noise(x: number, y: number): number {
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
    return 70 * n;
  };
}

// ── Displacement Functions ──

function wobbleDisplacement(
  pos: number,
  edgeIdx: number,
  intensity: number,
  noiseFn: (x: number, y: number) => number,
): number {
  if (intensity === 0) return 0;
  const freq = 0.012 + intensity * 0.0003;
  const amp = intensity * 0.03;
  return noiseFn(pos * freq, edgeIdx * 73.7) * amp;
}

function jitterDisplacement(intensity: number, rng: AleaPRNG): number {
  if (intensity === 0) return 0;
  const amt = intensity * 0.02;
  return rng.range(-amt, amt);
}

function inkDisplacement(
  pos: number,
  edgeIdx: number,
  intensity: number,
  noiseFn: (x: number, y: number) => number,
): number {
  if (intensity === 0) return 0;
  const freq = 0.015 + intensity * 0.0005;
  const amp = intensity * 0.05;
  const octave1 = noiseFn(pos * freq, edgeIdx * 91) * amp;
  const octave2 = noiseFn(pos * freq * 2.5, edgeIdx * 91 + 333) * amp * 0.3;
  return octave1 + octave2;
}

// ── Path Generation ──

interface Point {
  x: number;
  y: number;
}

function generateBorderPath(
  width: number,
  height: number,
  layers: BorderLayer[],
  seed: number,
): Point[] {
  const rng = new AleaPRNG(seed);
  const noise = createSimplexNoise(() => rng.next());

  const roundInt = layers.find((l) => l.effect === "round")?.intensity || 0;
  const wobbleInt = layers.find((l) => l.effect === "wobble")?.intensity || 0;
  const jitterInt = layers.find((l) => l.effect === "jitter")?.intensity || 0;
  const inkInt = layers.find((l) => l.effect === "ink")?.intensity || 0;

  const hasDisplacement = wobbleInt > 0 || jitterInt > 0 || inkInt > 0;

  let cr = Math.min(roundInt * 0.25, width / 4, height / 4);
  if (hasDisplacement && cr < 4) cr = 4;

  const edges = [
    { x1: cr, y1: 0, x2: width - cr, y2: 0, px: 0, py: -1 },
    { x1: width, y1: cr, x2: width, y2: height - cr, px: 1, py: 0 },
    { x1: width - cr, y1: height, x2: cr, y2: height, px: 0, py: 1 },
    { x1: 0, y1: height - cr, x2: 0, y2: cr, px: -1, py: 0 },
  ];

  const points: Point[] = [];

  edges.forEach((edge, edgeIdx) => {
    const dx = edge.x2 - edge.x1;
    const dy = edge.y2 - edge.y1;
    const edgeLen = Math.hypot(dx, dy);
    const steps = Math.max(4, Math.ceil(edgeLen / 2.5));

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const pos = t * edgeLen;
      let disp = 0;
      disp += wobbleDisplacement(pos, edgeIdx, wobbleInt, noise);
      disp += jitterDisplacement(jitterInt, rng);
      disp += inkDisplacement(pos, edgeIdx, inkInt, noise);
      points.push({
        x: edge.x1 + dx * t + edge.px * disp,
        y: edge.y1 + dy * t + edge.py * disp,
      });
    }

    if (cr > 0) {
      const cornerCenters = [
        { cx: width - cr, cy: cr },
        { cx: width - cr, cy: height - cr },
        { cx: cr, cy: height - cr },
        { cx: cr, cy: cr },
      ];
      const startAngles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
      const c = cornerCenters[edgeIdx];
      const sa = startAngles[edgeIdx];
      for (let i = 1; i <= 6; i++) {
        const angle = sa + (Math.PI / 2) * (i / 6);
        let px = c.cx + Math.cos(angle) * cr;
        let py = c.cy + Math.sin(angle) * cr;
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

// ── SVG Path Conversion ──

export function borderPathToSVG(points: Point[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
  }
  d += " Z";
  return d;
}

// ── Path Cache ──

const pathCache = new Map<string, Point[]>();
const MAX_CACHE = 100;

export function getCachedBorderPath(
  width: number,
  height: number,
  layers: BorderLayer[],
  seed: number,
): Point[] {
  const key = `${seed}-${Math.round(width)}-${Math.round(height)}-${layers.map((l) => l.effect + ":" + l.intensity).join(",")}`;

  if (pathCache.has(key)) return pathCache.get(key)!;

  const points = generateBorderPath(width, height, layers, seed);

  if (pathCache.size >= MAX_CACHE) {
    const firstKey = pathCache.keys().next().value;
    if (firstKey) pathCache.delete(firstKey);
  }

  pathCache.set(key, points);
  return points;
}

// ── Helpers ──

export function hasActiveBorderStyle(
  bs: BorderStyle | null | undefined,
): boolean {
  return (
    !!bs && Array.isArray(bs.layers) && bs.layers.some((l) => l.intensity > 0)
  );
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 1000000);
}
