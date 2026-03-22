# Layout Preview Fidelity & Page Aspect Ratio System

## The Problem

The Layout Architect preview and the Editor rendering look noticeably different. Users pick a layout expecting one thing, then see something else when they get to the Editor. The root causes:

| Difference        | Layout Preview                    | Editor Canvas                  |
| ----------------- | --------------------------------- | ------------------------------ |
| **Page shape**    | Flexible height (`min-h-[400px]`) | Locked to `aspect-[3/4]`       |
| **Image fit**     | `object-cover` (crops to fill)    | `object-contain` (letterboxes) |
| **Panel gap**     | `gap-3` (12px)                    | `gap-2` (8px)                  |
| **Outer padding** | `p-8` (32px)                      | `p-1` (4px)                    |

The biggest offenders are the page shape and image fit. The Layout preview lets panels stretch tall for multi-row layouts, while the Editor squeezes everything into a fixed 3:4 portrait rectangle. And `object-cover` in the preview hides empty space by cropping, while `object-contain` in the Editor shows the full image with letterboxing.

## The Bigger Idea: Page Aspect Ratio Selection

Instead of just fixing the mismatch, lean into it — let users **choose their page format** before picking layouts. Different comic formats need different page shapes:

| Format        | Aspect Ratio     | Use Case                                   |
| ------------- | ---------------- | ------------------------------------------ |
| **Portrait**  | 3:4              | Traditional comic book pages               |
| **Square**    | 1:1              | Instagram, social media comics             |
| **Webtoon**   | 9:16 (or taller) | Vertical scroll webcomics, mobile-first    |
| **Landscape** | 16:9             | Cinematic panels, desktop wallpaper comics |
| **Letter**    | 17:22            | US comic book standard (8.5x11)            |

### How This Changes the Flow

```
Layout Architect
┌─────────────────────────────────────────┐
│  PAGE FORMAT:  [Portrait] [Square]      │
│                [Webtoon]  [Landscape]   │
│                                         │
│  (existing panel count + layout picks)  │
│                                         │
│  Page 1                                 │
│  ┌─────────────┐                        │
│  │ layout      │  ← preview now         │
│  │ preview     │    matches the chosen  │
│  │ in chosen   │    page format         │
│  │ aspect      │                        │
│  └─────────────┘                        │
└─────────────────────────────────────────┘
```

Users pick their format once (global setting), and both the Layout preview and the Editor use the same aspect ratio. No more mismatch.

## Implementation Plan

### Phase 1: Fix the Mismatch (Quick Win)

Make the Layout preview match the Editor by using the same rendering constraints.

**LayoutScreen.tsx changes:**

```tsx
// Replace:
className = "gap-3 min-h-[400px]";

// With:
className = "gap-2 aspect-[3/4]";
```

And change panel images from `object-cover` to `object-contain` (or keep `object-cover` but also switch the Editor to `object-cover` — this is a design call, `object-cover` generally looks better for comics).

**Decision: Switch Editor to `object-cover`?**

Pros:

- Panels always look full and clean — no letterboxing
- Matches how printed comics work (images bleed to panel edges)
- Layout preview already uses it, so instant consistency

Cons:

- Crops parts of the generated image the user might want to see
- The existing drag/pinch-to-reposition feature exists specifically because `object-contain` leaves room — with `object-cover`, users would need drag/pinch to adjust what's visible in the crop
- Users who uploaded custom images might lose important parts

**Recommendation:** Keep `object-contain` in the Editor (users need to see their full image to position it), but switch the Layout preview to `object-contain` to match. The preview is just a rough guide — accuracy matters more than beauty there.

### Phase 2: Page Format Selection

#### New Data Model

Add `pageFormat` to the project state:

```typescript
type PageFormat = "portrait" | "square" | "webtoon" | "landscape" | "letter";

const PAGE_FORMATS: Record<
  PageFormat,
  { label: string; aspect: string; ratio: [number, number] }
> = {
  portrait: { label: "Portrait", aspect: "aspect-[3/4]", ratio: [3, 4] },
  square: { label: "Square", aspect: "aspect-square", ratio: [1, 1] },
  webtoon: { label: "Webtoon", aspect: "aspect-[9/20]", ratio: [9, 20] },
  landscape: { label: "Landscape", aspect: "aspect-[16/9]", ratio: [16, 9] },
  letter: { label: "Letter", aspect: "aspect-[17/22]", ratio: [17, 22] },
};
```

Store `pageFormat` in persisted state (like `panelsPerPage`):

```typescript
const [pageFormat, setPageFormat] = usePersistedState<PageFormat>(
  "panelshaq_page_format",
  "portrait",
);
```

Pass it through to both LayoutScreen and EditorScreen.

#### Format-Specific Layout Templates

Some layouts work better in certain formats. A 3-column layout makes sense in landscape but looks cramped in portrait. Two approaches:

**Option A — Filter existing templates by compatibility:**

Add a `compatibleFormats` field to `LayoutTemplate`:

```typescript
interface LayoutTemplate {
  // ...existing fields
  compatibleFormats?: PageFormat[]; // if undefined, works with all
}
```

Templates that are very wide (like 3-column layouts) get tagged as landscape/square only. Templates that are very tall (like quad stack) get tagged as portrait/webtoon only. Most templates work everywhere.

**Option B — Create format-specific templates:**

More work, better results. Each format gets its own curated set of layouts that are designed to look good in that shape. For example:

- **Webtoon** layouts: mostly vertical stacks and 2-column splits (readers scroll, not flip)
- **Landscape** layouts: wide cinematic panels, 3+ column grids
- **Square** layouts: tight grids, centered compositions

**Recommendation:** Start with Option A (filtering), upgrade to Option B later. Most existing templates already work across formats — just filter out the obviously bad fits.

#### Layout Preview Changes

The preview container switches from `min-h-[400px]` to the selected format's aspect class:

```tsx
<div
  className={`gap-2 ${PAGE_FORMATS[pageFormat].aspect}`}
  style={{
    display: "grid",
    gridTemplateColumns: `repeat(${template.cols}, 1fr)`,
    gridTemplateRows: `repeat(${template.rows}, 1fr)`,
  }}
>
```

#### Editor Canvas Changes

Replace the hardcoded `aspect-[3/4]` with the selected format:

```tsx
// Replace:
<div className="aspect-[3/4] relative">

// With:
<div className={`${PAGE_FORMATS[pageFormat].aspect} relative`}>
```

#### Format Picker UI

Add a row of format buttons at the top of the Layout Architect, above the panel count buttons:

```tsx
<div className="bg-surface-container p-1 rounded-lg flex gap-1 border border-outline/10">
  {Object.entries(PAGE_FORMATS).map(([key, fmt]) => (
    <button
      key={key}
      onClick={() => setPageFormat(key as PageFormat)}
      className={`px-3 py-2 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 ${
        pageFormat === key
          ? "bg-primary text-background"
          : "text-accent/50 hover:text-accent"
      }`}
    >
      {/* Tiny aspect ratio shape */}
      <span
        className={`rounded-[2px] border ${pageFormat === key ? "border-background/50 bg-background/20" : "border-accent/30"}`}
        style={{
          width: Math.round((fmt.ratio[0] / Math.max(...fmt.ratio)) * 12),
          height: Math.round((fmt.ratio[1] / Math.max(...fmt.ratio)) * 12),
        }}
      />
      {fmt.label}
    </button>
  ))}
</div>
```

### Phase 3: Export Awareness

The page format should influence export:

- **PDF page size** should match the format (portrait → 8.5x11, landscape → 11x8.5, square → 8.5x8.5)
- **PNG resolution** should respect the aspect ratio
- **Webtoon mode** could export as a single tall image (all pages stitched vertically) instead of separate pages — this is how webtoons are typically distributed

## Webtoon Mode — Special Consideration

Webtoon is fundamentally different from page-based comics:

- No "pages" — it's one continuous vertical scroll
- Panels are stacked, not arranged in grids
- Readers scroll, never flip
- Typical panel is full-width, variable height

For webtoon, the layout templates should be simplified:

- 1-panel full-width (most common)
- 2-panel horizontal split
- 2-panel vertical stack (with different heights)
- 3-panel vertical stack

The Editor would need a scrollable canvas instead of a fixed-aspect page. This is a larger change and could be Phase 4.

## Files to Modify

| File                           | Phase | Change                                            |
| ------------------------------ | ----- | ------------------------------------------------- |
| `src/screens/LayoutScreen.tsx` | 1     | Sync gap/padding/object-fit with Editor           |
| `src/screens/LayoutScreen.tsx` | 2     | Add format picker, apply format aspect to preview |
| `src/screens/EditorScreen.tsx` | 2     | Use dynamic aspect ratio from format              |
| `src/App.tsx`                  | 2     | Add `pageFormat` state, pass to Layout + Editor   |
| `LayoutScreen.tsx` types       | 2     | Add `compatibleFormats` to `LayoutTemplate`       |

## What This Does NOT Cover

- Webtoon continuous scroll mode (Phase 4)
- Per-page format overrides (all pages share one format for now)
- Custom aspect ratio input (users pick from presets only)
- Format-specific layout template creation (Option B — future)

## Priority

1. **Phase 1** — Fix the mismatch (30 min, high impact)
2. **Phase 2** — Page format selection (2-3 hours, medium impact, great UX)
3. **Phase 3** — Export awareness (1 hour, follows naturally from Phase 2)
4. **Phase 4** — Webtoon scroll mode (significant effort, separate initiative)
