# Export Page Exploration

## The Problem

Export currently lives in the **Editor sidebar** — a cramped column sharing space with critique, panel controls, and history. As we add the GIF Editor (per-panel animation tagging, timeline, preview), there's no room for it here. The sidebar is already doing too much.

At the same time, there's a separate **Share screen** that handles .comic file export and individual panel sharing. So export logic is split across two places, neither of which has enough space to do the job well.

The GIF Editor needs room for a timeline strip, a panel config editor, a live preview canvas, and eventually a scrub bar. That's a full screen, not a sidebar widget.

---

## Current Flow

```
Workshop → Director → Layout → Editor → (export buried in sidebar)
                                           ↓
                                     Share tab (separate, partial)
```

**What lives where today:**

| EditorScreen sidebar           | ShareScreen             |
| ------------------------------ | ----------------------- |
| PNG download (this page / all) | Share individual panels |
| PNG share buttons              | .comic file export      |
| GIF export (5 mode buttons)    | Export history          |
| Export progress bar            |                         |
| Export history (last 5)        |                         |

---

## Proposal: Export as the 5th Tab

Add **Export** as a new tab after Editor in the main flow:

```
Workshop → Director → Layout → Editor → Export
```

This makes export a deliberate destination rather than a sidebar afterthought. It also mirrors real creative workflows — you finish editing, then you move to the output stage.

### What moves to the Export page

**Everything export-related, consolidated:**

- PNG export (single page, all pages, download, share)
- GIF export — now with the full GIF Editor (timeline, per-panel tags, preview)
- .comic file export (currently on ShareScreen)
- PDF export (function exists but is hidden — now has a home)
- Individual panel image sharing (currently on ShareScreen)
- Export history
- Format/quality settings (GIF frame rate, PNG scale, etc.)

### What stays in the Editor

- The editing tools, panel positioning, dialogue, critique
- Maybe a quick "Export PNG" shortcut button that still works without leaving, for fast iteration

### ShareScreen

Gets absorbed into the Export page. One less screen to maintain.

---

## Export Page Layout Concept

### Top: Format Picker

```
┌─────────────────────────────────────────────────────────┐
│  [PNG]    [GIF]    [.COMIC]    [PDF]                    │
└─────────────────────────────────────────────────────────┘
```

Selecting a format shows its options below.

### PNG Mode

Simple — scope selector + download/share buttons.

```
┌─────────────────────────────────────────────────────────┐
│  Scope:  [This Page]  [All Pages]  [Individual Panels]  │
│                                                         │
│  ┌──────────────────────┐                               │
│  │                      │                               │
│  │    Page Preview       │    Scale: [1x] [2x] [3x]    │
│  │                      │                               │
│  └──────────────────────┘    [Download]  [Share]        │
└─────────────────────────────────────────────────────────┘
```

### GIF Mode — The Big One

This is where the GIF Editor vision doc comes alive. The full Export page gives it space.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌──────────────────────────────────────┐  ┌─────────┐ │
│  │                                      │  │ Panel 3 │ │
│  │          Live GIF Preview            │  │         │ │
│  │          (canvas playback)           │  │ Move:   │ │
│  │                                      │  │ [Pan→]  │ │
│  └──────────────────────────────────────┘  │         │ │
│                                            │ Time:   │ │
│  Preset: [Story] [Cine] [Drama] [Custom]   │ 2.0s    │ │
│                                            │         │ │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐     │ Trans:  │ │
│  │ 1 │→│ 2 │→│ 3 │→│ 4 │→│ 5 │→│ 6 │     │ [Fade]  │ │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘     │         │ │
│  Zoom  Hold  Pan→  Shake  KenB  Hold      └─────────┘ │
│  ─cut─ ─cut─ fade  flash  ─cut─ fade                   │
│                                                         │
│  Total: 8.5s  |  ~2.1 MB     [▶ Play] [Export GIF]    │
└─────────────────────────────────────────────────────────┘
```

Key point: the preview canvas, timeline, and panel editor all have room to breathe. This layout is impossible in a sidebar.

### .COMIC Mode

Clean and simple — project metadata + download.

### PDF Mode

Page selection + layout options. Finally surfaces the hidden PDF function.

---

## Navigation Considerations

### Tab Bar Update

Current: `Workshop | Director | Layout | Editor`
New: `Workshop | Director | Layout | Editor | Export`

5 tabs is fine. The flow reads left-to-right as a creative pipeline: write → generate → arrange → polish → output.

### Entry Points

1. **Tab bar** — click Export tab directly
2. **Editor shortcut** — "Export" button in Editor that navigates to the Export tab (replaces current sidebar export)
3. **After GIF Editor work** — already on the Export page, just hit Export

### Back Navigation

From Export, swiping right goes back to Editor. Natural.

---

## What This Enables

1. **GIF Editor has a home** — the vision doc's timeline, panel editor, and preview all fit without compromise
2. **All export in one place** — no more split between Editor sidebar and ShareScreen
3. **Room for future formats** — video export, APNG, WebP, whatever comes next, just add a tab
4. **Cleaner Editor** — the Editor sidebar loses its most bloated section and can focus on editing
5. **PDF finally ships** — the function is already written, it just needs UI

---

## What We Lose / Risks

- **One more tap to export PNG** — users who just want a quick PNG now have to switch tabs. Mitigation: keep a small "Quick Export" button in the Editor that does PNG download without leaving.
- **ShareScreen deprecation** — need to migrate its unique features (individual panel sharing, .comic export) cleanly.
- **Tab bar crowding on small screens** — 5 tabs on a phone is tight. Could use icons instead of text, or collapse to 4 with Export nested under Editor as a sub-screen (though this defeats the purpose).
- **State coordination** — the Export page needs access to the same canvas/page data as the Editor. Already shared via app state, but the GIF Editor adds new state (panel animation configs) that needs a home in the data model.

---

## Migration Path

### Step 1: Create the Export tab shell

- New `ExportScreen.tsx` component
- Add to tab bar and navigation
- Move PNG export from EditorScreen sidebar → ExportScreen
- Move .comic export from ShareScreen → ExportScreen

### Step 2: Surface PDF

- Wire up the existing `handleExportPDF()` to UI buttons on ExportScreen

### Step 3: GIF Editor (Phase 1 from vision doc)

- Build timeline + panel config editor on ExportScreen
- Replace the 5-button GIF mode picker with the full GIF Editor
- Existing modes become presets

### Step 4: Retire ShareScreen

- Anything left on ShareScreen moves to Export
- Remove ShareScreen from navigation

---

## Open Questions

- Should the Editor keep a minimal "Quick Export" for PNG, or should everything go through the Export tab?
- Does the GIF Editor state (per-panel animation configs) persist with the project, or is it session-only?
- On mobile, do we use icons for the 5-tab bar or find another pattern?
