# Tooltip Plan

Tooltips for touch-first users along the comic creation journey. Grouped by priority.

## Implementation note

These should be tap-dismissable overlays (not hover-only). Consider a small `?` icon or a first-time-only pulse to make them discoverable. Long-press or tap-and-hold is another option for power-user hints.

---

## Critical — users get stuck without these

| # | Screen | Element | Tooltip text | Why |
|---|--------|---------|-------------|-----|
| 1 | Workshop | Palette icon on style selector | "Tap a character to use their art style for all panels" | Icon-only; users don't know what "style reference" means |
| 2 | Workshop | Polish button | "AI rewrites your story with cinematic flair. Original is replaced." | "Polish" is vague; users fear losing their text |
| 3 | Director | Camera lens picker | "Changes the virtual camera — try Portrait for close-ups, Fish-eye for drama" | Photography jargon; most users won't touch it |
| 4 | Director | Aspect ratio button | "Change panel shape: square, portrait, widescreen" | Tiny icon, unclear purpose |
| 5 | Editor | First time selecting a panel | "Drag to move image. Pinch to zoom. Two-finger tap to rotate." | Gestures are invisible |
| 6 | Editor | Lock icon on panel | "Lock prevents accidental dragging. Bubbles still move freely." | Users lock a panel and think everything is frozen |
| 7 | Editor | Bake button | "Permanently burns text into the image. Can't be undone." | "Bake" means nothing to non-technical users |
| 8 | Layout | Comic vs Webtoon toggle | "Comic: grid pages. Webtoon: vertical scroll strip." | "Webtoon" is niche jargon |

## High — users miss powerful features

| # | Screen | Element | Tooltip text | Why |
|---|--------|---------|-------------|-----|
| 9 | Workshop | Character tag bar below story | "Tap a name to insert it into your story" | Dual-state (display vs. action) isn't obvious |
| 10 | Workshop | Auto-Describe in character modal | "Analyzes the image to write a description for you" | Buried in a modal; easy to miss |
| 11 | Director | Insert panel (+) buttons | "Add a new panel here to expand the story" | Small icons between panels, easy to overlook |
| 12 | Director | Collapsed reference sections | "Tap to see your backgrounds, props, and vehicles" | Collapsed by default; users don't know they exist |
| 13 | Director | Reference count "X/5" | "Max 5 references per panel. Deselect one to add more." | Silently stops working at limit |
| 14 | Editor | Wand/AI critique button | "Get AI feedback on pacing and dialogue" | Wand icon suggests transformation, not critique |
| 15 | Vault | Generate Image button | "AI creates a reference image from your description" | Only appears conditionally; users may not discover it |
| 16 | Vault | Personality vs Description fields | "Description = how they look. Personality = how they act (optional)." | Confusingly similar fields |

## Nice to have — builds confidence

| # | Screen | Element | Tooltip text | Why |
|---|--------|---------|-------------|-----|
| 17 | Nav | INK button | "Start a new project" | Creative label, unclear to new users |
| 18 | Director | Mood dropdown | "Sets lighting and color palette for this panel" | No visual preview of moods |
| 19 | Director | Copy/Paste image buttons | "Copy this panel's image to reuse in another panel" | Non-obvious workflow |
| 20 | Editor | Export format buttons | "PNG: single image. PDF: full comic. GIF: animated." | Users don't know the difference |
| 21 | Layout | Repartition All Pages | "Applies this layout to every page. Can't be undone." | Destructive action, easy to hit by accident |
| 22 | Workshop | PlusCircle in characters header | "Browse World Vault to add characters" | Users expect direct upload, but it navigates away |

## Delivery approach options

**A. First-time coach marks** — show once per feature on first visit, dismiss with tap. Store in localStorage. Low friction, high discovery.

**B. Persistent `?` icon** — small help icon next to complex elements. Tap to show/dismiss. Always available but adds visual noise.

**C. Long-press hints** — long-press any element to see its tooltip. Zero visual clutter but completely undiscoverable.

**Recommendation:** Use (A) for Critical tier, (B) for High tier on the elements that have space for it, skip (C).
