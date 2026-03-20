# Layout System Overhaul

## Problem

The current layout system has 3 options (grid, vertical, dynamic) applied per-page, with rigid CSS grid rules. Panels can't span interesting shapes. Every page with the same panel count looks identical. Real comics have wild, expressive layouts — the grid is a creative constraint, not a feature.

---

## Goal

A template-based layout picker where each page gets a **layout template** that defines exactly how panels are sized and positioned within a CSS grid. Users pick from a visual gallery of templates. Panels auto-fill into the slots. No manual dragging needed — just pick a template and the panels snap in.

---

## How It Works

### 1. Layout Templates

Each template is a named configuration that defines a CSS grid and how panels map to cells:

```ts
interface LayoutTemplate {
  id: string;
  name: string;
  // How many panels this template expects
  panelCount: number;
  // CSS grid definition
  cols: number;
  rows: number;
  // How each panel maps to grid cells
  slots: {
    colStart: number;
    colEnd: number;
    rowStart: number;
    rowEnd: number;
  }[];
}
```

### 2. Template Gallery

Organized by panel count. When a page has N panels, show all templates that fit N panels. User clicks a thumbnail → page layout updates instantly.

**2-Panel Templates:**

```
┌──────┬──────┐   ┌──────────────┐   ┌────┬─────────┐
│      │      │   │              │   │    │         │
│  1   │  2   │   │      1       │   │ 1  │         │
│      │      │   │              │   │    │    2    │
│      │      │   ├──────────────┤   │    │         │
│      │      │   │              │   ├────┤         │
│      │      │   │      2       │   │    │         │
└──────┴──────┘   └──────────────┘   └────┴─────────┘
  50/50 Split        Vertical Stack     Sidebar Left
```

**3-Panel Templates:**

```
┌──────┬──────┐   ┌──────────────┐   ┌──────┬──────┐   ┌────┬─────────┐
│      │      │   │              │   │      │  2   │   │    │         │
│  1   │  2   │   │      1       │   │      ├──────┤   │ 1  │    2    │
│      │      │   │              │   │  1   │      │   │    │         │
├──────┴──────┤   ├──────┬──────┤   │      │  3   │   ├────┼─────────┤
│             │   │      │      │   │      │      │   │    3         │
│      3      │   │  2   │  3   │   └──────┴──────┘   └──────────────┘
└─────────────┘   └──────┴──────┘     Feature Left      L-Shape
  Top Heavy         Bottom Split
```

**4-Panel Templates:**

```
┌──────┬──────┐   ┌──────────────┐   ┌────┬────┬────┐   ┌──────┬──────┐
│  1   │  2   │   │      1       │   │    │    │    │   │      │  2   │
│      │      │   ├──────┬───────┤   │ 1  │ 2  │ 3  │   │  1   ├──────┤
├──────┼──────┤   │  2   │       │   │    │    │    │   │      │  3   │
│  3   │  4   │   ├──────┤   3   │   ├────┴────┴────┤   ├──────┼──────┤
│      │      │   │  4   │       │   │      4       │   │      4      │
└──────┴──────┘   └──────┴───────┘   └──────────────┘   └─────────────┘
  Classic Grid     Staggered Right     3+1 Bottom       Feature + Stack
```

**5-Panel Templates:**

```
┌──────┬──────┐   ┌──────────────┐   ┌────┬────┬────┐
│  1   │  2   │   │      1       │   │ 1  │ 2  │ 3  │
├──┬───┼───┬──┤   ├──┬─────┬────┤   ├────┼────┼────┤
│  │   │   │  │   │  │     │    │   │    │         │
│3 │ 4 │ 5 │  │   │2 │  3  │ 4  │   │ 4  │    5    │
│  │   │   │  │   │  │     │    │   │    │         │
└──┴───┴───┴──┘   ├──┴─────┴────┤   └────┴─────────┘
  2-over-3         │      5      │     3+2 Asymmetric
                   └─────────────┘
                     Manga Flow
```

**6-Panel Templates:**

```
┌────┬────┬────┐   ┌──────┬──────┐   ┌──────────────┐
│ 1  │ 2  │ 3  │   │  1   │  2   │   │      1       │
├────┼────┼────┤   ├──┬───┼───┬──┤   ├──────┬───────┤
│ 4  │ 5  │ 6  │   │3 │ 4 │ 5 │6 │   │  2   │   3   │
└────┴────┴────┘   └──┴───┴───┴──┘   ├──┬───┼───┬───┤
  Classic 3x2       Wide + Narrow     │4 │ 5 │   6   │
                                      └──┴───┴───────┘
                                        Pyramid
```

### 3. Page Data Model Update

```ts
// Before
interface Page {
  id: string;
  panelIds: string[];
  layout: "grid" | "vertical" | "dynamic";
}

// After
interface Page {
  id: string;
  panelIds: string[];
  layoutId: string; // references a LayoutTemplate.id
}
```

### 4. Rendering

Each template's `slots` array maps directly to CSS grid properties:

```tsx
<div
  style={{
    display: "grid",
    gridTemplateColumns: `repeat(${template.cols}, 1fr)`,
    gridTemplateRows: `repeat(${template.rows}, 1fr)`,
    gap: "4px",
  }}
>
  {page.panelIds.map((pid, idx) => {
    const slot = template.slots[idx];
    if (!slot) return null;
    return (
      <div
        style={{
          gridColumn: `${slot.colStart} / ${slot.colEnd}`,
          gridRow: `${slot.rowStart} / ${slot.rowEnd}`,
        }}
      >
        {/* panel image */}
      </div>
    );
  })}
</div>
```

### 5. Template Picker UI

Replace the current 3-icon layout toggle with a visual template gallery:

- Appears as a grid of small thumbnails below the page header
- Each thumbnail is a miniature wireframe of the template (colored rectangles)
- Active template has a primary border glow
- Templates are filtered to match the page's panel count
- If a page has more panels than the template supports, extra panels overflow into a "+" indicator
- If fewer, empty slots show as dashed outlines

### 6. Smart Auto-Select

When panels are first distributed to pages, auto-select a template:

- 2 panels → "50/50 Split"
- 3 panels → "Top Heavy"
- 4 panels → "Classic Grid"
- 5 panels → "2-over-3"
- 6 panels → "Classic 3x2"

User can override at any time.

---

## Template Definitions (Starter Set)

```ts
const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  // ── 2-Panel ──
  {
    id: "2-split",
    name: "50/50 Split",
    panelCount: 2,
    cols: 2,
    rows: 1,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
    ],
  },
  {
    id: "2-stack",
    name: "Vertical Stack",
    panelCount: 2,
    cols: 1,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "2-sidebar",
    name: "Sidebar Left",
    panelCount: 2,
    cols: 3,
    rows: 1,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 4, rowStart: 1, rowEnd: 2 },
    ],
  },

  // ── 3-Panel ──
  {
    id: "3-top-heavy",
    name: "Top Heavy",
    panelCount: 3,
    cols: 2,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 3, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "3-bottom-split",
    name: "Bottom Split",
    panelCount: 3,
    cols: 2,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "3-feature-left",
    name: "Feature Left",
    panelCount: 3,
    cols: 2,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "3-l-shape",
    name: "L-Shape",
    panelCount: 3,
    cols: 3,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 4, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 4, rowStart: 2, rowEnd: 3 },
    ],
  },

  // ── 4-Panel ──
  {
    id: "4-grid",
    name: "Classic Grid",
    panelCount: 4,
    cols: 2,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "4-staggered",
    name: "Staggered Right",
    panelCount: 4,
    cols: 2,
    rows: 3,
    slots: [
      { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 4 },
      { colStart: 1, colEnd: 2, rowStart: 3, rowEnd: 4 },
    ],
  },
  {
    id: "4-3plus1",
    name: "3+1 Bottom",
    panelCount: 4,
    cols: 3,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 3, colEnd: 4, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 4, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "4-feature-stack",
    name: "Feature + Stack",
    panelCount: 4,
    cols: 2,
    rows: 3,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 3, rowStart: 3, rowEnd: 4 },
    ],
  },

  // ── 5-Panel ──
  {
    id: "5-2over3",
    name: "2-over-3",
    panelCount: 5,
    cols: 6,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 4, rowStart: 1, rowEnd: 2 },
      { colStart: 4, colEnd: 7, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 3, colEnd: 5, rowStart: 2, rowEnd: 3 },
      { colStart: 5, colEnd: 7, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "5-manga",
    name: "Manga Flow",
    panelCount: 5,
    cols: 3,
    rows: 3,
    slots: [
      { colStart: 1, colEnd: 4, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 3, colEnd: 4, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 4, rowStart: 3, rowEnd: 4 },
    ],
  },

  // ── 6-Panel ──
  {
    id: "6-3x2",
    name: "Classic 3x2",
    panelCount: 6,
    cols: 3,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 3, colEnd: 4, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 3, colEnd: 4, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "6-wide-narrow",
    name: "Wide + Narrow",
    panelCount: 6,
    cols: 4,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 3, colEnd: 5, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 3, colEnd: 4, rowStart: 2, rowEnd: 3 },
      { colStart: 4, colEnd: 5, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "6-pyramid",
    name: "Pyramid",
    panelCount: 6,
    cols: 4,
    rows: 3,
    slots: [
      { colStart: 1, colEnd: 5, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 3, colEnd: 5, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 2, rowStart: 3, rowEnd: 4 },
      { colStart: 2, colEnd: 3, rowStart: 3, rowEnd: 4 },
      { colStart: 3, colEnd: 5, rowStart: 3, rowEnd: 4 },
    ],
  },
];
```

---

## Implementation Scope

| File                           | Changes                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `src/screens/LayoutScreen.tsx` | Replace layout toggle with template gallery, update rendering to use slot-based grid, update `Page` interface |
| `src/App.tsx`                  | Update `Page` type import (interface change)                                                                  |
| `src/screens/EditorScreen.tsx` | Update panel rendering to use template slots instead of hardcoded grid logic                                  |

### Migration

The `Page.layout` string field becomes `Page.layoutId` string field. Old values (`"grid"`, `"vertical"`, `"dynamic"`) map to:

- `"grid"` → `"4-grid"` (or best match for panel count)
- `"vertical"` → `"2-stack"`
- `"dynamic"` → `"4-feature-stack"`

A migration function runs once on load to convert old pages.

---

## What This Doesn't Do (Out of Scope)

- **Drag-and-drop panel reordering** — pick a template, panels auto-fill in order. Reorder panels in Director instead.
- **Custom freeform layouts** — no manual grid cell dragging. Templates cover the 80% case. Freeform is a future feature.
- **Per-panel aspect ratio override in layout** — panels fill their slot and `object-cover` handles the crop.
