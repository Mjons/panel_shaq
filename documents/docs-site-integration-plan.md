# Panel Shaq Docs Integration Plan

## Goal

Add a "Panel Shaq" section to the existing Panel Haus docs site (`Comic-ProV2/docs-site/`) so both apps share one documentation hub. Panel Shaq gets its own sidebar section and pages, visually distinct but using the same design system.

---

## Current Docs Architecture

The docs site is a single-page app with hash routing:

- **`index.html`** — shell with sidebar nav + content area
- **`pages.js`** — all page content as a `PAGES` object + `PAGE_ORDER` array
- **`docs.js`** — router, TOC builder, search, keyboard shortcuts
- **`styles.css`** — full design system with "learning vehicle" box types

Content is injected via `navigateTo(pageKey)` which reads from `PAGES[key]`. Sidebar links have `data-page` attributes. Search indexes page titles + content.

---

## What Needs to Change

### 1. `index.html` — Add Sidebar Section

Add a new sidebar section after "Workflow & Craft":

```html
<div class="sidebar-section" data-section="Panel Shaq">
  <div class="sidebar-heading shaq-heading">📱 Panel Shaq</div>
  <a href="#" class="sidebar-link" data-page="shaq-overview"
    >What is Panel Shaq?</a
  >
  <a href="#" class="sidebar-link" data-page="shaq-getting-started"
    >Getting Started</a
  >
  <a href="#" class="sidebar-link" data-page="shaq-workshop">Workshop</a>
  <a href="#" class="sidebar-link" data-page="shaq-director">Panel Director</a>
  <a href="#" class="sidebar-link" data-page="shaq-vault">World Vault</a>
  <a href="#" class="sidebar-link" data-page="shaq-layout">Layout Architect</a>
  <a href="#" class="sidebar-link" data-page="shaq-editor">Editor & Bubbles</a>
  <a href="#" class="sidebar-link" data-page="shaq-export">Export & Share</a>
  <a href="#" class="sidebar-link" data-page="shaq-to-panelhaus"
    >Panel Shaq → Panel Haus</a
  >
</div>
```

### 2. `pages.js` — Add Page Content

Add Panel Shaq pages to the `PAGES` object and `PAGE_ORDER` array. Each page follows the same structure:

```javascript
'shaq-overview': {
  title: 'What is Panel Shaq?',
  subtitle: 'AI comic creation on your phone — the mobile companion to Panel Haus.',
  section: 'Panel Shaq',
  content: `...`
},
```

#### Pages to Write

| Page Key               | Title                   | Content                                                                                |
| ---------------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| `shaq-overview`        | What is Panel Shaq?     | Mobile-first AI comic creator, relationship to Panel Haus, PWA install instructions    |
| `shaq-getting-started` | Getting Started         | API key setup, creating first project, the 4-step workflow                             |
| `shaq-workshop`        | Workshop                | Writing stories, generating panel descriptions, character setup                        |
| `shaq-director`        | Panel Director          | Editing descriptions, camera angles/lenses, moods, generating images, inserting panels |
| `shaq-vault`           | World Vault             | Characters, environments, props, vehicles, art style picker, AI reference generation   |
| `shaq-layout`          | Layout Architect        | Page templates, panels-per-page, repartitioning                                        |
| `shaq-editor`          | Editor & Bubbles        | Speech bubbles, image positioning (drag/pinch/rotate), panel locks, SFX types          |
| `shaq-export`          | Export & Share          | PDF/PNG export, Web Share, .comic file for Panel Haus Desktop                          |
| `shaq-to-panelhaus`    | Panel Shaq → Panel Haus | The handoff workflow — export .comic from Shaq, import in Haus, what carries over      |

### 3. `PAGE_ORDER` — Append Shaq Pages

```javascript
const PAGE_ORDER = [
  // ...existing Panel Haus pages...
  "shaq-overview",
  "shaq-getting-started",
  "shaq-workshop",
  "shaq-director",
  "shaq-vault",
  "shaq-layout",
  "shaq-editor",
  "shaq-export",
  "shaq-to-panelhaus",
];
```

### 4. `styles.css` — Optional Visual Distinction

Add a subtle accent color for Panel Shaq section (orange to match the app's primary color):

```css
/* Panel Shaq accent */
--shaq-accent: #ff9100;
--shaq-dim: rgba(255, 145, 0, 0.12);
--shaq-border: rgba(255, 145, 0, 0.25);

.shaq-heading {
  color: var(--shaq-accent);
}

.sidebar-link[data-page^="shaq-"].active {
  color: var(--shaq-accent);
  border-left-color: var(--shaq-accent);
  background: var(--shaq-dim);
}
```

### 5. `docs.js` — No Changes Needed

The router, search, and TOC all work generically off `PAGES` and `data-page` attributes. Adding new pages to `pages.js` is all that's needed. Search automatically indexes the new content.

### 6. Top Nav — Add Panel Shaq Link

Add alongside "Open App" and "Community":

```html
<a href="https://panelshaq.vercel.app" class="topnav-link" target="_blank"
  >Panel Shaq</a
>
```

---

## Content Outline Per Page

### shaq-overview

- What it is (mobile-first AI comic creator)
- How it relates to Panel Haus (quick capture → full studio)
- Feature comparison card grid (Shaq vs Haus)
- Install as PWA (Add to Home Screen steps)
- Link to Play Store (when TWA is live)

### shaq-getting-started

- Steps: get API key → open app → write story → generate panels
- Box-info: BYOK explained
- Box-warning: save your API key, browser storage limitations
- Box-try: make your first 4-panel comic

### shaq-workshop

- Writing or pasting a story
- "Generate Panels" button — what happens behind the scenes
- Character setup in the vault
- Box-craft: writing good comic scripts (short, visual, action-oriented)

### shaq-director

- Panel card anatomy (description, camera, lens, mood, characters)
- Generating images (single vs all)
- Camera lens reference images
- Inserting panels between existing ones
- Box-try: change a lens to Fish-eye and regenerate

### shaq-vault

- 4 asset types (Character, Environment, Prop, Vehicle)
- Upload vs Generate
- Art style picker (15 styles)
- Auto-describe feature
- Box-info: reference images ARE the style

### shaq-layout

- Templates (2-6 panels, 20+ layouts)
- Per-page panel count
- Repartitioning
- Box-craft: when to use splash pages vs grids

### shaq-editor

- Drag to pan, pinch to zoom, 2-finger tap to rotate
- Speech bubbles (5 types: speech, thought, SFX, impact, ambient)
- Panel position lock
- Bake dialogue into image
- Scroll-to-zoom on desktop
- Box-warning: bake is permanent — save first

### shaq-export

- PDF and PNG export
- Web Share API (native share sheet)
- .comic file for Panel Haus Desktop
- Download individual panels or all at once

### shaq-to-panelhaus

- Why hand off (full layer editor, advanced tools)
- Export .comic from Shaq
- Import in Panel Haus
- What carries over (panels, bubbles, layouts, characters)
- What you gain in Haus (layer editing, effects, print export)
- Box-steps: the 3-step handoff

---

## Files to Change (in Comic-ProV2/docs-site/)

| File         | Changes                                           |
| ------------ | ------------------------------------------------- |
| `index.html` | Add Panel Shaq sidebar section + topnav link      |
| `pages.js`   | Add 9 new page entries + update `PAGE_ORDER`      |
| `styles.css` | Add `.shaq-heading` + `.shaq-` active link styles |
| `docs.js`    | No changes needed                                 |

---

## Effort Estimate

| Task                                       | Time           |
| ------------------------------------------ | -------------- |
| Write 9 page content entries in `pages.js` | 2-3 hours      |
| Update `index.html` sidebar                | 15 min         |
| Add CSS accent styles                      | 15 min         |
| Review and polish                          | 30 min         |
| **Total**                                  | **~3-4 hours** |

---

## Notes for Panel Haus Agent

- All content goes in `pages.js` using the existing helper functions (`info()`, `steps()`, `craft()`, `tryit()`, `warn()`, `voice()`, `compare()`)
- Page keys must be prefixed with `shaq-` to avoid collisions
- The breadcrumb section will automatically show "Panel Shaq" from the `section` field
- Search will index Panel Shaq content automatically
- Prev/next navigation will flow from the last Haus page into the first Shaq page — this is fine, it creates a natural bridge
