# Changelog — Session 2026-03-22

## Director: Move Generate All to Bottom

- Removed **Generate All**, **Preview**, **Download All**, **Cancel**, and **Retry** buttons from the top header
- All action buttons now live at the **bottom of the Director page** — reachable after scrolling through panels
- Top header only keeps "Continue to Layouts" for quick navigation
- Bottom layout: Generate All → Preview + Download All → Continue to Layouts

## Editor: Scroll-to-Zoom on Desktop

- **Mouse wheel zooms** the panel image in the Editor (scale 0.5x–4.2x)
- Only activates on desktop-sized screens (viewport >= 1024px)
- **Page scroll is blocked** while hovering a panel — prevents the page from scrolling while zooming
- Uses native `addEventListener` with `{ passive: false }` to properly call `preventDefault()`
- Works alongside existing drag-to-pan and pinch-to-zoom

## Comic Critique Corner (NEW)

- **AI-powered critique** in the Editor sidebar — analyzes your composed comic pages
- Two modes: **"Critique This Page"** (single page) or **"Critique All Pages"** (full comic)
- Captures the live composed page (panels + bubbles + layout) without exporting
- Structured feedback: Composition, Pacing, Dialogue, Visual Storytelling, Overall (score out of 10)
- **Panelhaus.app CTA** after every critique nudges users toward the desktop app
- New `/api/critique-comic` endpoint accepts multiple page images
- "Get Another Critique" button to re-run

## AI Reference Image Generation (NEW)

- **"Generate" button** in the World Vault entry modal alongside Upload
- Type-specific prompts and aspect ratios:
  - Character: front-facing portrait (3:4)
  - Environment: wide establishing shot (16:9)
  - Prop: clean product shot (1:1)
  - Vehicle: three-quarter view (4:3)
- Disabled until a name is entered; shows spinner during generation
- New `generateReferenceImage()` service function

## Custom Panel Image Upload (NEW)

- **Upload your own images** as panel art in the Director screen
- Upload button on each panel card next to Generate
- Supports photos, hand-drawn art, or images from other tools
- 10MB limit, accepts any image format

## Desktop Redirect Gate (NEW)

- Full-screen interstitial for desktop visitors (viewport >= 1024px, fine pointer)
- 16-second countdown auto-redirects to `panelhaus.app`
- "Stay on mobile version anyway" dismisses permanently (localStorage)
- Synchronous detection — shows on first paint, no flash

## Layout Architect Improvements

- **1-panel "Full Page"** option for both global and per-page selectors
- **5-panel support** in global repartition and per-page picker
- **Per-page panel count** — each page can independently have 1–6 panels
- Panels redistribute across pages when changing individual page counts
- **New templates**: 2-panel Top Heavy, 3-panel T-Shape, 4-panel 1+3 Top and Z-Shape, 5-panel Feature Top and Cross, 6-panel Hero + 5
- Template picker: 5-column grid with smaller thumbnails

## Aspect Ratio Picker

- **Modal picker** replacing native dropdown — matches camera lens modal pattern
- 2-column grid with proportional **shape rectangle thumbnails**
- Positioned near top of screen to avoid bottom nav clipping
- **3 new ratios**: Poster (2:3), Photo (3:2), Ultra Wide (21:9)
- Labels: name first, ratio in parens — "Square (1:1)"
- Default changed from 16:9 to **3:4**

## Max 5 References Per Panel

- **Global limit** across all vault asset types (characters + custom uploads + background + props + vehicles)
- Selection blocked when at limit; deselecting always works
- **"References: 3/5" counter** above character section, highlights at limit

## Onboarding Banners

- **Layout Architect**: "Step 3 of 4 — Arrange Your Pages"
- **World Vault**: "Your World Bible"
- **Editor**: "Step 4 of 4 — Final Touches" (replaced panel transform sliders)
- All dismissible with localStorage persistence

## Editor UX

- Panel transform section replaced with compact **Reset Position + Download** buttons
- **"Share This Page"** — native share sheet on mobile, download fallback on desktop
- **"Export & Share"** button navigates to Share tab

## Help Panel (NEW)

- Help button opens **inline tips panel** in sidebar (no longer external link)
- Sections: Workflow, World Vault, Director, Editor, Layout, API key
- Scrollable (max 50vh)

## Bug Fixes

- **DirectorScreen upload handler** missing index argument — fixed
- **Desktop redirect gate** not showing — switched to `(pointer: fine)` media query, synchronous init

## Documentation

- [desktop-redirect-gate.md](desktop-redirect-gate.md)
- [contextual-reference-prompting.md](contextual-reference-prompting.md)
- [custom-panel-image-upload.md](custom-panel-image-upload.md)
- [ai-character-reference-generation.md](ai-character-reference-generation.md)
- [comic-critique-corner.md](comic-critique-corner.md)
