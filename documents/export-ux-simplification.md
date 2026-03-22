# Export UX Simplification

**Date:** 2026-03-22
**Problem:** The export flow is scattered and confusing. Users see "Share Comic," "Share All Panels," individual panel shares, "Export PDF PAGE/FULL," "Export PNG PAGE/FULL," "Share This Page," "Export for Panelhaus," and "Export & Share" — all in different places with overlapping labels.

---

## Current State (What the User Sees)

### Editor Sidebar

```
EXPORT section:
  [Bake Dialogue Into Image]

  Export PDF
    [PAGE]  [FULL]

  Export PNG
    [PAGE]  [FULL]

  Share
    [SHARE THIS PAGE]

  Export Settings
    Format: PDF (HQ)
    Resolution: 300 DPI
```

### Share Screen (separate tab)

```
Share Comic
  [SHARE ALL 6 PANELS]
  [panel thumbnails — tap to share individually]

Export for Panelhaus
  [EXPORT .COMIC FILE]

Export History
  [list of previous exports]
```

### Problems

1. **"PAGE" vs "FULL"** — unclear what these mean without context. "Page" = current page, "Full" = all pages? Not obvious.
2. **PDF and PNG side by side** — most users just want "download my comic." They don't care about format choices up front.
3. **"Share This Page"** is redundant with the PNG PAGE button — both produce an image of the current page, one shares, one downloads.
4. **Share screen** shares raw panel images (without layout/bubbles), which is different from the Editor's "Share This Page" (composed page with bubbles). This distinction isn't explained.
5. **"Export for Panelhaus"** is buried on a separate screen from the other export options.
6. **Export Settings** (format, resolution) are static display — they don't actually change anything.

---

## Proposed Redesign

### Principle: One Export Section, Three Clear Actions

Instead of format-first organization (PDF section, PNG section, Share section), organize by **what the user wants to do**:

### Editor Sidebar — Simplified

```
EXPORT

  [↓ Download This Page]        ← saves current page as PNG
  [↓ Download Full Comic]       ← saves all pages as PDF

  [↗ Share This Page]           ← native share sheet, current page as image
  [↗ Share Full Comic]          ← native share sheet, all pages as PDF

  ────────────────────

  [⚙ Export for Panelhaus]      ← .comic file (move here from Share screen)
```

**Key changes:**

- **Two rows, two actions each:** Download vs Share, This Page vs Full Comic
- **Labels say what happens:** "Download This Page" not "PAGE"
- **Format is implicit:** Single page = PNG, Full comic = PDF. No format picker needed.
- **Panelhaus export** moves here from the Share screen — it's an export, not a share.
- **Remove** the static Export Settings display (format/resolution) — it doesn't do anything.

### Share Screen — Simplified to Social Sharing

The Share screen becomes purely about **sharing your work with people**, not file exports:

```
SHARE YOUR COMIC

  [Share Panel Images]          ← all panels via share sheet
  [panel thumbnail grid]        ← tap individual panel to share

  [Copy Link]                   ← copy app URL

  ────────────────────

  Export History
  [previous exports list]
```

**Key changes:**

- **Remove "Export for Panelhaus"** from here (moved to Editor sidebar)
- **Rename** from "Share & Export" to just "Share"
- **Keep** individual panel sharing — this is useful for social media posts
- **Keep** export history — acts as a "Downloads" folder

---

## Alternative: Single Unified Export Modal

Instead of splitting between Editor sidebar and Share screen, use a **bottom sheet modal** triggered by one "Export" button:

```
──────────────────────────────
  EXPORT

  What do you want to export?

  ○ This Page          ○ Full Comic

  How?

  [↓ Download]   [↗ Share]   [⚙ Panelhaus]

  Format: PNG / PDF (only show for Full Comic)
──────────────────────────────
```

**Pros:** Everything in one place. Zero navigation.
**Cons:** More complex modal. May feel heavy on mobile.

---

## Recommendation

**Go with the Editor Sidebar simplification** (first option). Reasons:

1. **Minimal code change** — reorganize existing buttons, rename labels, move .comic export
2. **No new components** needed
3. **Mobile-friendly** — the sidebar scrolls naturally on mobile
4. **Clear mental model:** Editor = export your work, Share = show it to people
5. The unified modal is elegant but adds complexity for a problem that better labels mostly solve

### Quick Wins (Can Ship Now)

1. Rename "PAGE" → "This Page" and "FULL" → "All Pages"
2. Merge PDF and PNG sections into one with a small format toggle
3. Move "Export for Panelhaus" to Editor sidebar
4. Remove the static Export Settings that don't do anything

### Later

- Add "Download All Pages as PNGs" (zip) for users who want images not PDF
- Add format picker if users actually ask for it (they probably won't)

---

## Button Labels — Before and After

| Before                  | After                | Why                           |
| ----------------------- | -------------------- | ----------------------------- |
| PAGE                    | This Page            | Clarifies scope               |
| FULL                    | All Pages            | "Full" is ambiguous           |
| SHARE THIS PAGE         | Share Page           | Shorter, obvious              |
| SHARE ALL 6 PANELS      | Share Panels         | Cleaner                       |
| EXPORT .COMIC FILE      | Export for Panelhaus | Already says this above       |
| Export PDF / Export PNG | Download             | Users don't care about format |

---

## File Changes Needed

| File                                 | Change                                                       |
| ------------------------------------ | ------------------------------------------------------------ |
| `src/screens/EditorScreen.tsx`       | Reorganize export sidebar, rename buttons, add .comic export |
| `src/screens/ShareScreen.tsx`        | Remove .comic export section, simplify header                |
| `src/services/exportComicService.ts` | No changes                                                   |
