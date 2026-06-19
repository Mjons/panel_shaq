# Export Renderer Extraction — Move All Export Actions onto the Export Tab

**Date:** 2026-06-19
**Goal:** Make the **Export tab** the single home for every export action (PNG/PDF page export, Share Page(s), and all GIF modes) — not just `.comic`, panel images, and the GIF editor. After this, the Editor's EXPORT panel collapses to a single **"Export / Next"** CTA.
**Status:** Plan only — no code yet.
**Parent:** [[mobile-export-discoverability]] (this is the "extract a shared page-renderer" follow-up flagged there).
**Related:** [[export-ux-simplification]], [[export-ux-inconsistency]].

---

## Why this is non-trivial (the coupling)

Every export action in the Editor rasterizes the **live composed page** via a single ref, `comicRef` ([EditorScreen.tsx:1611](../src/screens/EditorScreen.tsx#L1611)). There is no data-only path that produces a page image — the pixels come from the on-screen DOM.

Consumers of `comicRef`:

| Action                      | Function                                                                                                                     | Mechanism                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| This Page / All Pages (PNG) | `handleExportPNG` ([~1004](../src/screens/EditorScreen.tsx#L1004))                                                           | `captureRef(comicRef,"png")`; for all-pages steps `setSelectedPageIdx(i)` + `waitForPaint()`              |
| This Page / All Pages (PDF) | `handleExportPDF` ([~919](../src/screens/EditorScreen.tsx#L919))                                                             | same, into `jsPDF`                                                                                        |
| Share This Page / All Pages | inline ([~2196](../src/screens/EditorScreen.tsx#L2196), [~2253](../src/screens/EditorScreen.tsx#L2253))                      | `captureRef` → `navigator.share`                                                                          |
| All 5 GIF modes             | `handleCreateGif` ([~1063](../src/screens/EditorScreen.tsx#L1063))                                                           | reads `comicRef.current.querySelectorAll("[data-panel-slot]")`, drives `gifVisibleCount`, captures frames |
| Critique / dialogue vision  | `handleCritique` / dialogue ([~1228](../src/screens/EditorScreen.tsx#L1228), [~1260](../src/screens/EditorScreen.tsx#L1260)) | `captureRef(comicRef,"png")` — **stays in Editor**, not an export                                         |

The `comicRef` subtree (lines ~1609–1830) interleaves two concerns:

- **Presentation (what gets captured):** the page background, the CSS-grid layout from `getTemplate(currentPage.layoutId)`, each panel positioned into its slot, `PanelImage` (applies `imageTransform`, borders via `PanelBorderWrapper`), and `DraggableBubble` overlays. Plus `data-panel-slot={idx}` (the GIF service's hook) and `gifVisibleCount` opacity gating.
- **Interaction (suppressed during capture):** `selectedPanelId`/`selectedBubbleId` rings, `lockedPanelIds` lock toggles, the add-bubble FAB, `Tip` coach marks, `bindComicPinch`, double-tap→`fullscreenPanelId`. Every one of these is already gated behind `!isExporting`.

**Key insight:** export already renders a "clean" version of this subtree (interaction chrome off). The extraction just makes that clean render a **standalone component** that can be mounted anywhere — including offscreen on the Export tab — and feeds it to the same capture/GIF algorithms.

Two more invariants the current code relies on, which the plan must preserve:

1. The **export progress overlay is deliberately outside `comicRef`** ([~1582](../src/screens/EditorScreen.tsx#L1582)) so it isn't captured. Keep that separation.
2. When `pageBackgroundColor === "transparent"`, the **checkerboard is only shown when `!isExporting`** ([~1621](../src/screens/EditorScreen.tsx#L1621)); exports must stay transparent. The extracted component must reproduce this exactly.

---

## Target architecture

Three new units; the Editor and the Export tab both consume them.

```
                         ┌─────────────────────────────┐
                         │  <ComicPageCanvas/>          │  presentation only
                         │  page + grid + panels +      │  (no interaction in
                         │  transforms + borders +      │   export mode)
                         │  bubbles + data-panel-slot   │
                         └──────────────┬──────────────┘
                  interactive={...}     │     forExport (no interaction)
              ┌───────────────────────┘     └────────────────────────┐
              ▼                                                       ▼
      EditorScreen (comicRef)                          ExportTab offscreen host
      live, on-canvas editing                          hidden, one page at a time
              │                                                       │
              └──────────────┬────────────────────────────┬─────────┘
                             ▼                             ▼
                 ┌─────────────────────────────────────────────┐
                 │  src/services/comicPageExport.ts             │
                 │  exportPagesPNG / exportPagesPDF /           │
                 │  sharePages / createGif                      │
                 │  — generic over { getNode, pageCount,        │
                 │    setPageIndex, setGifVisibleCount,         │
                 │    onProgress, signal }                      │
                 └─────────────────────────────────────────────┘
```

### 1. `src/components/ComicPageCanvas.tsx` (new) — the presentational page

Extracted verbatim from the `comicRef` subtree, parameterized so interaction is optional.

```ts
interface ComicPageCanvasProps {
  page: Page;
  panels: PanelPrompt[];
  pageFormat: PageFormatKey;
  pageBackgroundColor: string;          // "transparent" handled inside
  gifVisibleCount?: number | null;      // panel-reveal animation
  forExport?: boolean;                  // true → no interaction chrome, no checkerboard
  interaction?: {                       // omitted entirely when forExport
    selectedPanelId: string | null;
    selectedBubbleId: string | null;
    lockedPanelIds: Set<string>;
    rotationStep: number;
    isBubbleEditing: boolean;
    onSelectPanel(id: string): void;
    onSelectBubble(id: string | null): void;
    onToggleLock(id: string): void;
    onTransform(id: string, t: ImageTransform): void;
    onMoveBubble(id: string, pos: ...): void;
    onUpdateBubble(id: string, updates: ...): void;
    onRemoveBubble(id: string): void;
    onBakeAll(): void;
    onFullscreen(id: string): void;
    bindPinch(): any;                   // @use-gesture bind
    isRendering: boolean;
  };
}
```

- `forExport === true` ⇒ behaves exactly like today's `isExporting` branch: no rings, no lock buttons, no FAB, no Tips, no pinch, no checkerboard; bubbles/PanelImage receive their `isExporting`-equivalent flag.
- Renders the **same** markup, classNames, and `data-panel-slot` attributes as today (fidelity depends on this).
- `PanelImage`, `PanelBorderWrapper`, `DraggableBubble` move with it or are imported by it — they already accept `isExporting`.

The Editor keeps `comicRef` but points it at `<ComicPageCanvas interaction={...}/>`. **No visual/behavioral change in the Editor** — that's the Phase 1 acceptance bar.

### 2. `src/services/comicPageExport.ts` (new) — export algorithms, decoupled

Lift `captureRef`, `handleExportPNG`, `handleExportPDF`, the two share handlers, and `handleCreateGif` out of EditorScreen into pure functions driven by a small driver interface, so they don't care _which_ DOM they capture:

```ts
interface PageExportDriver {
  getNode(): HTMLElement | null;          // the ComicPageCanvas root to capture
  pageCount: number;
  setPageIndex(i: number): Promise<void>; // switch rendered page + waitForPaint
  setGifVisibleCount(n: number | null): Promise<void>;
  onProgress?(pct: number): void;
  signal?: AbortSignal;                   // replaces shouldCancelExport
}

export async function exportPagesPDF(d: PageExportDriver, opts: {allPages: boolean; currentIndex: number}): Promise<{fileName: string; dataUri: string}>;
export async function exportPagesPNG(d: PageExportDriver, opts: {...}): Promise<...>;
export async function sharePages(d: PageExportDriver, opts: {...}): Promise<...>;
export async function createGif(d: PageExportDriver, mode: GifMode, ctx: {...}): Promise<Blob>;
```

- `waitForPaint` (double-rAF, [~890](../src/screens/EditorScreen.tsx#L890)) moves here.
- Cancellation switches from `shouldCancelExport` state to an `AbortSignal` (cleaner across screens).
- Export-history writing (`addToHistory`) is returned as data; **callers** persist it (so both Editor and Export tab record history the same way). History lives in `comic_export_history` localStorage today — keep that key.
- GIF assembly still delegates to `src/services/gifAnimationService.ts`; only the DOM-stepping/`querySelectorAll("[data-panel-slot]")` capture loop relocates here.

The Editor builds a driver from `comicRef` + `setSelectedPageIdx` + `setGifVisibleCount`. The Export tab builds one from its offscreen ref + an offscreen page index.

### 3. Offscreen host on the Export tab

The Export tab must render pages to capture them. `display:none` won't work — `html-to-image` needs real layout. Use the standard offscreen technique:

```tsx
// rendered once, position fixed off-viewport, real pixel size matching the editor page
<div
  aria-hidden
  style={{
    position: "fixed",
    left: -99999,
    top: 0,
    width: EXPORT_W,
    height: EXPORT_W / aspect,
    pointerEvents: "none",
  }}
>
  <ComicPageCanvas
    forExport
    page={pages[offscreenIdx]}
    panels={panels}
    pageFormat={pageFormat}
    pageBackgroundColor={bg}
    gifVisibleCount={gifCount}
  />
</div>
```

- A hook `useOffscreenPageExport(pages, panels, pageFormat, bg)` owns `offscreenIdx`/`gifCount` state and the ref, builds the `PageExportDriver`, and returns `{ exportPNG, exportPDF, sharePages, createGif, busy, progress, cancel }`.
- `setPageIndex(i)` sets `offscreenIdx` then `waitForPaint()`.
- Size: derive `EXPORT_W` from the current Editor capture size so output resolution matches (today `pixelRatio:1.5` on the editor node — replicate effective px).
- Export the Export tab's PNG/PDF/Share/GIF buttons (currently disabled placeholders / the pointer card) to call these.

---

## Phased plan (each phase ships independently)

**Phase 0 — Safety net.** Capture baseline exports (PNG single, PNG all, PDF all, each GIF mode) for a fixed sample project. These are the pixel-diff oracle for "no regression."

**Phase 1 — Extract `<ComicPageCanvas>` (highest risk, contained). ✅ DONE (2026-06-19).** Moved the `comicRef` subtree (245 lines) + the three shared parts (`PanelImage`/`PanelBorderWrapper`/`DraggableBubble`, 555 lines) into `src/components/ComicPageCanvas.tsx`. Done as a **verbatim slice** with flat required props matching the Editor's existing variable names (the tidy `interaction` bundle + optional/`forExport` handling is deferred to Phase 3). The Editor renders `<ComicPageCanvas/>` inside the unchanged `ref={comicRef}` div — **capture node identical** — and still imports `PanelImage`/`DraggableBubble` for its fullscreen overlay. `tsc` clean. **Still needs on-device verification** that exports are pixel-identical (no static pixel-diff available here).

**Phase 2 — Extract `comicPageExport.ts`. ✅ DONE (2026-06-19).** Moved `waitForPaint`, `captureNode`, `exportPagesPDF`, `exportPagesPNG`, `createGif` (+ `GifMode`/`PageExportDriver` types) into `src/services/comicPageExport.ts`, parameterized by a `PageExportDriver`. The Editor's `handleExportPDF/PNG/CreateGif` now build a `comicRef`-backed driver and delegate; capture options (pixelRatio 1.5, skipFonts, bg) are byte-identical. Cancellation switched from `shouldCancelExport` **state** to a `cancelExportRef` (read via `driver.isCancelled()`), which also fixes the prior stale-closure cancel bug. Editor keeps a thin `captureRef` wrapper (→ `captureNode`) for the still-inline critique/dialogue/share capture; the inline **Share** handlers stay in the Editor and fold into Phase 3. Removed now-dead imports (`toPng`/`toJpeg`/`jsPDF`/`encodeGif`) and a dead `frameRatio` var. `tsc` clean. **Still needs on-device verification** alongside Phase 1.

**Phase 3 — Export-tab offscreen render + wiring. ✅ DONE (2026-06-19).** `ComicPageCanvas`'s interaction props are now optional (inert no-op defaults), so the Export tab mounts it offscreen (`position:fixed; left:-99999px`, fixed `1080×ratio` size, the same `bg-surface-container-highest p-1 …` capture frame as the Editor) with just `{currentPage, panels, pageBackgroundColor, isExporting:true}`. ShareScreen builds a `PageExportDriver` over that node + an `offscreenIdx` page-stepper and wires real controls: **Download All Pages (PNG)**, **Share All Pages** (new `sharePages` service fn), and **quick GIF renders** (Story Flow / Page Reveal / Slideshow / Cinematic) — plus the existing Open GIF Editor. Exports record to the same `comic_export_history`. `pageBackgroundColor` is read from `panelshaq_settings` (matching the Editor); `pageFormat` is now passed from `App`. The pointer card is replaced. `tsc` clean. **Scope notes:** Export-tab uses **all-pages** semantics (no current-page selector there), so "This Page" / "this-page" GIF aren't offered; **PDF** isn't wired (the Editor never exposed it). **Caveat:** offscreen capture renders at a fixed 1080-wide size, so output is consistent but **not guaranteed byte-identical to the Editor's viewport-dependent capture** — needs the on-device check, especially the low-end-Android offscreen-capture path.

**Phase 4 — Slim the Editor.** Remove This/All Pages, Share, and GIF-mode buttons from the Editor EXPORT panel; leave **"Export / Next"** (already renamed) as the sole CTA there. Keep the on-canvas GIF-editor entry only if desired (it's panel-only and already mirrored). `comicRef`/`ComicPageCanvas` stay in the Editor for _editing_ (and for critique/dialogue capture, which are not exports).

**Phase 5 — Cleanup & docs.** Remove now-dead Editor state (`isExporting`/`exportProgress`/`shouldCancelExport`) if fully relocated, dedupe `track("share_completed", …)` surfaces, update [[mobile-export-discoverability]] status, refresh `CHANGELOG.md`.

---

## Fidelity risks & mitigations

| Risk                                                                                | Mitigation                                                                                                                                      |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Offscreen render rasterizes at a different size → different output than Editor      | Pin offscreen `width/height` to the same effective px the Editor captures (account for `pixelRatio:1.5`); pixel-diff in Phase 3.                |
| Fonts: capture uses `skipFonts:true` ([~907](../src/screens/EditorScreen.tsx#L907)) | Keep `skipFonts:true`; ensure the same web fonts are loaded on the Export route (they are — same SPA). Verify bubble text renders identically.  |
| Transparent page bg accidentally captures checkerboard                              | `forExport` must omit the checkerboard branch entirely (mirror [~1621](../src/screens/EditorScreen.tsx#L1621)). Add a transparent-bg test case. |
| GIF `[data-panel-slot]` query finds nothing offscreen                               | Keep the exact `data-panel-slot={idx}` attributes in `ComicPageCanvas`; the service queries the driver's node, not `document`.                  |
| `html-to-image` on a `position:fixed,left:-99999px` node                            | Known-good pattern, but verify on a low-end Android (the bug reporter's Tecno Pop 10). Fall back to a visible-but-covered host if needed.       |
| Two pages of state drift (Editor `selectedPageIdx` vs offscreen `offscreenIdx`)     | Offscreen index is fully owned by the hook; never coupled to the Editor's.                                                                      |
| Bubble positions are normalized                                                     | Confirm `DraggableBubble` positions from a 0–1 `pos` (scale-independent); if any px-based, normalize before extraction.                         |

---

## File-by-file

| File                                         | Change                                                                                                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ComicPageCanvas.tsx`         | **New.** Presentational page (extracted from `comicRef` subtree).                                                                                                                       |
| `src/services/comicPageExport.ts`            | **New.** PNG/PDF/Share/GIF algorithms + `waitForPaint`, driver-based.                                                                                                                   |
| `src/screens/EditorScreen.tsx`               | Replace `comicRef` subtree with `<ComicPageCanvas interaction=…/>`; call shared service via a `comicRef` driver; remove moved export buttons (Phase 4); keep critique/dialogue capture. |
| `src/screens/ShareScreen.tsx`                | Add offscreen host + `useOffscreenPageExport`; replace the "Download Comic Pages" pointer card with real PNG/PDF/Share/GIF controls; keep `.comic`, panel images, GIF editor, history.  |
| `src/services/gifAnimationService.ts`        | No change (still assembles frames); only its caller relocates.                                                                                                                          |
| `src/App.tsx`                                | `ShareScreen` no longer needs `onNavigate` for the pointer (can keep); pass `pageBackgroundColor`/`pageFormat` if not already.                                                          |
| `documents/mobile-export-discoverability.md` | Flip the page-export row from "pointer card" to "moved (renderer extracted)" when done.                                                                                                 |

---

## Verification checklist

- [ ] Phase-0 baseline exports are **pixel-identical** from the Editor after Phases 1–2 (no-regression).
- [ ] Export-tab PNG (this page / all pages) matches Editor output for the same project.
- [ ] Export-tab PDF (all pages) matches (page count, aspect, centering — cf. [~950](../src/screens/EditorScreen.tsx#L950)).
- [ ] Share This/All Pages opens the share sheet with correctly-named PNGs; downloads on fallback.
- [ ] All 5 GIF modes produce equivalent GIFs from the Export tab (panel reveal timing, this-page, slideshow, cinematic).
- [ ] Transparent page background exports transparent (no checkerboard) from both paths.
- [ ] Cancel mid-export works via `AbortController` on both paths.
- [ ] Export history records from the Export tab (same `comic_export_history` shape).
- [ ] Editor EXPORT panel shows only **Export / Next**; on-canvas editing, critique, and dialogue still work.
- [ ] Verified on a low-end Android browser (offscreen capture is the risk surface).
- [ ] `npm run lint` clean.

---

## Effort & sequencing

Phases 1–2 are the bulk (extracting from a 2.7k-line file) and ship with **zero user-visible change** — they're pure de-risking. Phase 3 is the payoff (Export tab gains the controls). Phase 4 is a small deletion. Recommend landing 1→2→3 across separate commits/PRs so each is independently verifiable against the pixel-diff oracle, and gating Phase 3's new UI behind a flag until the Android capture check passes.
