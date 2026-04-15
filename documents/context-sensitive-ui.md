# Context-Sensitive UI — Philosophy & Opportunities

## What We Already Do

Panel Shaq already has a lot of context-aware behavior. These are the moments where the app "knows" what you're doing and adapts:

| Where                 | What Happens                                                   | Trigger                         |
| --------------------- | -------------------------------------------------------------- | ------------------------------- |
| Border "Page" swatch  | Matches current page background color                          | `pageBackgroundColor` setting   |
| Style picker          | Hidden when image already uploaded                             | `formData.image` exists         |
| Onboarding banners    | Auto-dismiss when images generated                             | `panels.some(p => p.image)`     |
| Share All Pages       | Only shows with 2+ pages                                       | `pages.length > 1`              |
| Lock icon             | Primary color when locked, faint when unlocked                 | `lockedPanelIds.has(pid)`       |
| Lens dropdown         | Shows selected lens thumbnail                                  | `cameraLens` value              |
| Delete panel          | Only warns when generated image exists                         | `panel.image` exists            |
| GIF All Pages         | Disabled with 1 page                                           | `pages.length < 2`              |
| Director onboarding   | Hidden once you know the flow                                  | localStorage flag + image check |
| Desktop redirect      | Only for mouse+wide viewport                                   | `pointer: fine` + width >= 1024 |
| Generate All          | Changes to "Regenerate Everything" when all panels have images | `missing.length === 0`          |
| Border effect presets | Dice button disabled when no effect active                     | `!hasActiveBorderStyle()`       |
| Borderless shape      | Clip-path applies but no stroke when color is "none"           | `strokeColor === "none"`        |

## The Principle

**Show what's relevant, hide what's not. Adapt labels, not just visibility.**

Three levels:

1. **Visibility** — show/hide elements (simplest)
2. **Labels** — change text based on state ("Generate" → "Regenerate")
3. **Behavior** — same button does different things depending on context

---

## Opportunities We're Missing

### Director Screen

| Opportunity                   | Trigger                           | What Changes                                                                                                                                        |
| ----------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Generate" button label       | Panel has image                   | "GEN" → "REGEN" (already done)                                                                                                                      |
| Panel card border glow        | Image is generating               | Pulsing primary border during generation                                                                                                            |
| "All images done" celebration | Last panel finishes generating    | Brief confetti/flash + "Continue to Layouts" pulses                                                                                                 |
| Smart insert label            | Position in story                 | "Add Prelude" / "Insert Panel" / "Continue Story" (already done) — could also say "Add Reaction Shot" or "Add Close-Up" based on surrounding panels |
| Camera suggestion             | Panel description mentions action | Auto-suggest "Low Angle" for power shots, "Dutch Angle" for tension                                                                                 |

### Editor Screen

| Opportunity                         | Trigger                  | What Changes                                                                      |
| ----------------------------------- | ------------------------ | --------------------------------------------------------------------------------- |
| Bubble type suggestion              | Panel mood               | Action panels suggest SFX Impact, quiet panels suggest Thought                    |
| "Panel is zoomed/rotated" indicator | Transform is not default | Small badge showing current zoom % and rotation °                                 |
| Border preset labels                | Panel content            | If panel is dark/noir, highlight the "Ink" preset. If cartoon, highlight "Sketch" |
| Export quality hint                 | Number of panels/pages   | "This will be ~3MB" estimate before exporting                                     |
| "Bake" warning severity             | Number of bubbles        | "Bake 1 bubble?" vs "Bake 7 bubbles into this panel? This is permanent."          |
| Empty panel prompt                  | Panel has no image       | "This panel has no image yet — go to Director to generate one" with a link        |

### Workshop Screen

| Opportunity             | Trigger             | What Changes                                                           |
| ----------------------- | ------------------- | ---------------------------------------------------------------------- |
| Story length hint       | Character count     | "~4 panels" / "~8 panels" / "~12 panels" estimate                      |
| Character count badge   | Characters in vault | "3 characters ready" next to Generate Panels button                    |
| "Story looks short" tip | < 100 chars         | Suggest adding more detail for better panel generation                 |
| Genre detection         | Story keywords      | If story mentions "spaceship" → suggest sci-fi camera lenses and moods |

### Layout Screen

| Opportunity               | Trigger                             | What Changes                                                                                           |
| ------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Template recommendation   | Panel count on page                 | Highlight the "best" template for the content (e.g., if one panel is a close-up, suggest Feature Left) |
| "Odd panel out" indicator | Page has fewer panels than template | Show which slots will be empty                                                                         |
| Page count summary        | Total pages                         | "3 pages, 11 panels — about a short story"                                                             |

### Vault Screen

| Opportunity              | Trigger                               | What Changes                                                                |
| ------------------------ | ------------------------------------- | --------------------------------------------------------------------------- |
| "Used in X panels" badge | Character appears in panels           | Shows how many panels reference this character                              |
| "No description" warning | Entry has image but no description    | "Add a description to help AI generate consistent panels"                   |
| Style consistency hint   | Mixed styles in vault                 | "Your characters use 3 different art styles — panels may look inconsistent" |
| "Unused" indicator       | Character not referenced in any panel | Subtle dimming or badge                                                     |

### Settings Screen

| Opportunity             | Trigger            | What Changes                                                    |
| ----------------------- | ------------------ | --------------------------------------------------------------- |
| API key status          | Key present/tested | Green dot when verified, amber when untested                    |
| Usage approaching limit | > 80% daily usage  | Warning banner at top                                           |
| Storage usage           | Large project      | "Your project is ~15MB. Consider exporting and starting fresh." |

### Global

| Opportunity                 | Trigger                 | What Changes                                                                    |
| --------------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| Tab badges                  | Unfinished work         | Red dot on Director if panels have no images, dot on Editor if no bubbles added |
| Smart tab order suggestion  | Current workflow stage  | After generating all panels, bottom nav pulses on Layout tab                    |
| "Unsaved changes" indicator | Changes since last save | Tiny dot next to project name                                                   |
| Time-of-day greeting        | Clock                   | "Good morning" / "Late night session?" in onboarding                            |

---

## Implementation Approach

Don't add all of these at once. Instead:

1. **Pick the ones that reduce confusion** — empty panel prompts, transform indicators, storage warnings
2. **Then the ones that feel delightful** — celebration on last panel, tab badges, smart suggestions
3. **Last the fancy ones** — genre detection, camera suggestions, template recommendations (these need AI or heuristics)

Most of these are 5-30 lines of code each — a conditional render or a label swap. The data is already in state. It's just a matter of surfacing it at the right moment.

---

## Anti-Patterns to Avoid

- **Don't flash/animate context changes** — if a label changes, just change it. No attention-grabbing animation.
- **Don't block** — suggestions should be hints, not gates. User can always ignore them.
- **Don't add tooltips on mobile** — they don't work. Use inline text instead.
- **Don't be clever at the expense of predictability** — if a button sometimes says "Generate" and sometimes says "Regenerate," that's fine. If it sometimes generates and sometimes opens a modal, that's confusing.
