# Page Background Color

## Problem

The comic page background is hardcoded to `bg-background` (dark, ~#111827). When exported, the page always has this dark background between panels. Users can't change it to white (traditional comics), colored, or transparent.

Additionally, the border color picker has 7 colors + "none" but no option to match the page background — which is the most natural border color for panels.

## Solution

Two changes:

1. **Global page background color** in Settings — applies to the export canvas and the Editor preview
2. **"Page" swatch** in the border color picker — automatically matches whatever the page background is set to

---

## UI

### Settings Screen — New Option

Add under the "Editor" section (next to rotation step):

```
Page Background
[ ● ] [ ● ] [ ● ] [ ● ] [ ● ] [ ● ] [ #___ ]
White  Black  Cream  Gray   Blue  Trans  Custom
```

- 6 preset swatches + custom hex input
- Default: **White** (`#FFFFFF`) — matches traditional comic pages
- "Trans" = transparent (checkerboard preview, exports as PNG with alpha)

Presets:
| Label | Color | Use Case |
|---|---|---|
| White | `#FFFFFF` | Traditional comics, print |
| Black | `#000000` | Dark/noir comics |
| Cream | `#FFF8E7` | Vintage/aged paper feel |
| Gray | `#E5E7EB` | Neutral, modern |
| Blue | `#DBEAFE` | Manga tone paper |
| Transparent | `transparent` | Overlay/compositing |

### Border Color Picker — Add "Page" Swatch

Add one more swatch to the existing border color picker in the Editor sidebar:

```
Black  White  Red  Blue  Gold  Green  Purple  Page  None
```

"Page" dynamically uses whatever `pageBackgroundColor` is set to. If the page is white, the "Page" swatch is white. If cream, it's cream. This lets users make panel borders blend with the page.

---

## Data Model

### AppSettings

```typescript
export interface AppSettings {
  // ...existing
  pageBackgroundColor: string; // hex color or "transparent", default "#FFFFFF"
}
```

### No change to PanelPrompt

Border color already supports any hex string. When user picks "Page" swatch, it just sets `borderColor` to the current `pageBackgroundColor` value.

---

## Implementation

### 1. Add to AppSettings

In `SettingsScreen.tsx`:

```typescript
pageBackgroundColor: string;
// default: "#FFFFFF"
```

Add a color picker section in the Editor settings area (same pattern as rotation step).

### 2. Read in EditorScreen

```typescript
const pageBackgroundColor = useMemo(() => {
  try {
    const s = localStorage.getItem("panelshaq_settings");
    return s ? JSON.parse(s).pageBackgroundColor || "#FFFFFF" : "#FFFFFF";
  } catch {
    return "#FFFFFF";
  }
}, []);
```

### 3. Apply to Comic Canvas

Replace the hardcoded `bg-background` on the comic page div:

```tsx
// Line ~1484 in EditorScreen.tsx
<div
  className={`w-full h-full relative overflow-hidden ${isExporting ? "pointer-events-none" : ""}`}
  style={{ backgroundColor: pageBackgroundColor }}
>
```

For transparent, render a checkerboard pattern in the editor preview (CSS background-image) but export with actual transparency.

### 4. Add "Page" Swatch to Border Picker

Add between "Purple" and "None" in the border color swatches array:

```typescript
{ color: pageBackgroundColor, label: "Page" },
```

The swatch shows the current page color and, when tapped, sets the panel's `borderColor` to that value.

### 5. Export Handling

- **PNG export:** Honors the background color. Transparent = alpha channel.
- **PDF export:** Fills the page rect with the background color before drawing panels. Transparent = white fallback (PDF doesn't support transparency).
- **JPEG export:** Transparent falls back to white (JPEG has no alpha).

---

## Files to Change

| File                             | Changes                                                                 |
| -------------------------------- | ----------------------------------------------------------------------- |
| `src/screens/SettingsScreen.tsx` | Add `pageBackgroundColor` to interface/defaults, add color picker UI    |
| `src/screens/EditorScreen.tsx`   | Read setting, apply to comic canvas, add "Page" swatch to border picker |
| Export functions in EditorScreen | Use `pageBackgroundColor` for PDF page fill                             |

---

## Effort

| Task                               | Time         |
| ---------------------------------- | ------------ |
| Add to AppSettings + Settings UI   | 30 min       |
| Read and apply in EditorScreen     | 30 min       |
| Add "Page" swatch to border picker | 15 min       |
| Handle in PDF/PNG export           | 30 min       |
| **Total**                          | **~2 hours** |
