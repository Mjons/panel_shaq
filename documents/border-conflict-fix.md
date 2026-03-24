# Border Conflict: Two Borders at Once

## The Bug

When a user sets a **border color** and then picks a **border effect style**, two separate borders appear:

1. **CSS `border`** on the panel div (from border color picker) — a solid flat line
2. **SVG `<path>` stroke** inside `PanelBorderWrapper` (from border effect preset) — the organic/wobbly line

The guard `!hasActiveBorderStyle(panel.borderStyle)` on the CSS border (line ~1581) is supposed to hide the CSS border when an effect is active. But it only works one way: if you pick an effect _first_, the CSS border is suppressed. If you pick a color _first_ and then add an effect, the CSS border was already applied and the SVG stroke appears on top of it.

Actually, re-reading the code — the guard _does_ work correctly in theory. The real issue is:

**The CSS border is on the outer div. The SVG stroke is inside `PanelBorderWrapper` (an inner div).** They render at different positions — the CSS border is _outside_ the content box, the SVG path is _inside_ the clip-path. So they don't overlap perfectly, creating a visible double border.

## The Fix

**One border system, not two.** The SVG path should be the _only_ border, always. The CSS `border` property should never be used for panel borders.

When a user picks a border color but no effect:

- Apply a "solid" border via SVG with `round: 0` (sharp corners) — effectively a rectangle path
- Or simply use `round` at low intensity for a subtle rounding

When a user picks both color + effect:

- SVG path uses the effect shape + the chosen color — already works

When no color and no effect:

- No border at all — already works

### Implementation

1. **Remove the CSS `border` from the panel div entirely** — delete the `panel.borderColor && !hasActiveBorderStyle(...)` block
2. **Always use `PanelBorderWrapper`** when `borderColor` is set (even without an effect)
3. When `borderColor` is set but no `borderStyle` effect is active, render a simple rectangle SVG path (sharp corners, no displacement)
4. `PanelBorderWrapper` already handles both the clip-path and the SVG stroke — just let it do its job

### Code Changes

**EditorScreen.tsx — panel div style:** Remove the CSS border block entirely:

```diff
- ...(panel.borderColor && panel.borderColor !== "none" && !hasActiveBorderStyle(panel.borderStyle)
-   ? { border: `${panel.borderWidth || 2}px solid ${panel.borderColor}` }
-   : {}),
```

**EditorScreen.tsx — PanelBorderWrapper:** Make it active whenever there's a border color OR an effect:

```diff
- active={hasActiveBorderStyle(panel.borderStyle)}
+ active={hasActiveBorderStyle(panel.borderStyle) || (!!panel.borderColor && panel.borderColor !== "none")}
```

**borderStyles.ts — getCachedBorderPath:** Already handles empty layers (returns a rectangle). When no effect layers but `active` is true, the path is a simple rectangle → SVG renders a clean stroke.

### Result

- One border system (SVG) for everything
- Color picker sets the stroke color
- Effect preset sets the path shape
- Both work independently and together without conflict
- Clip-path always matches the stroke

## Files to Change

| File                           | Change                                                        |
| ------------------------------ | ------------------------------------------------------------- |
| `src/screens/EditorScreen.tsx` | Remove CSS border, expand PanelBorderWrapper active condition |

**Effort: ~15 minutes**
