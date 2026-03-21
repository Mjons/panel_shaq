# Panel Shaq → Panel Haus Export Compatibility Guide

## Why `testroject.comic` Fails to Load in Panel Haus

This file was exported from **Panel Shaq v1.0.0** (`"source": "panelshaq"`). Panel Haus's `saveLoadService.js` expects a different data structure. Here's every incompatibility found:

---

## Incompatibilities Found

### 1. Missing `layers` Wrapper (Critical — Breaks Load)

**Panel Shaq exports:**

```json
{
  "pages": [{
    "panels": [...],
    "textBubbles": [...],
    "stickers": [...],
    "background": null
  }]
}
```

**Panel Haus expects:**

```json
{
  "pages": [{
    "layers": {
      "panels": [...],
      "textBubbles": [...],
      "stickers": [...],
      "background": null
    }
  }]
}
```

Panel Haus's load code accesses `page.layers.panels`, `page.layers.textBubbles`, etc. Without the `layers` wrapper, every access returns `undefined` and the project loads as blank pages.

**This is the #1 reason the file is incompatible.**

---

### 2. Wrong Property Names on Panels (Silent Data Loss)

| Panel Shaq Property          | Panel Haus Property      | Effect If Not Mapped                                   |
| ---------------------------- | ------------------------ | ------------------------------------------------------ |
| `borderWidth: 2`             | `strokeWidth: 2`         | Borders default to 2px (happens to match, but by luck) |
| `borderColor: "#000000"`     | `strokeColor: "#333333"` | Color reverts to default gray instead of black         |
| `borderRadius: 0`            | _(not supported)_        | Ignored — no effect                                    |
| `backgroundColor: "#FFFFFF"` | _(not a panel prop)_     | Ignored — Panel Haus always fills white                |

Even if the `layers` wrapper issue is fixed, panels would load with **default stroke settings** instead of the exported values because the property names don't match.

---

### 3. Missing Panel Properties (Defaults Fill In)

These properties are absent from the Panel Shaq export but expected by Panel Haus:

| Missing Property                     | Panel Haus Default | Risk                                                                       |
| ------------------------------------ | ------------------ | -------------------------------------------------------------------------- |
| `showOutline`                        | `true`             | Low — borders show (probably intended)                                     |
| `visible`                            | `true`             | Low — panels visible (correct)                                             |
| `locked`                             | `false`            | Low — panels unlocked (correct)                                            |
| `zIndex`                             | `0`                | Medium — all panels stack at same z-index, order depends on array position |
| `globalZIndex` (on bubbles/stickers) | `0`                | Medium — all content stacks at z-index 0                                   |

These are mostly safe since the defaults are reasonable, but `zIndex` could cause layering surprises with overlapping panels.

---

### 4. Page 4 Has Only 22.8% Coverage

Page 4 has a single 232×337 panel on a 490×700 page — leaving 77% of the page empty. This isn't a format error, but it looks broken when loaded. Likely an incomplete page from Panel Shaq.

---

### 5. Panel IDs Are Simple Numbers

Panel Shaq uses simple IDs like `"1"`, `"2"`. Panel Haus generates UUIDs like `"panel-a7f3b2c1"`. Simple numeric IDs work but could collide if pages are merged or duplicated.

---

## What Panel Shaq Should Export

To produce a `.comic` file that Panel Haus loads cleanly, the export must match this structure:

```json
{
  "version": "2.0.0",
  "metadata": {
    "createdAt": "2026-03-21T00:24:11.986Z",
    "name": "My Project",
    "embeddedImages": true,
    "source": "panelshaq",
    "sourceVersion": "1.0.0"
  },
  "project": {
    "id": "unique-project-id",
    "name": "My Project",
    "pages": [
      {
        "id": "page-unique-id",
        "dimension": { "width": 490, "height": 700 },
        "layers": {
          "panels": [
            {
              "id": "panel-unique-id",
              "x": 10,
              "y": 10,
              "width": 470,
              "height": 337,
              "imageSrc": "data:image/jpeg;base64,...",
              "imageId": "img_1",
              "imageTransform": {
                "x": 0,
                "y": 0,
                "scale": 1.5,
                "rotation": 0,
                "flipH": false,
                "flipV": false
              },
              "strokeWidth": 2,
              "strokeColor": "#000000",
              "showOutline": true,
              "visible": true,
              "locked": false,
              "zIndex": 0
            }
          ],
          "textBubbles": [],
          "stickers": [],
          "background": null
        }
      }
    ],
    "generatedStories": [],
    "blueprints": []
  }
}
```

---

## Export Checklist for Panel Shaq

### Structure

- [ ] Wrap `panels`, `textBubbles`, `stickers`, `background` inside a `layers` object per page
- [ ] Set `version` to `"2.0.0"`
- [ ] Include `metadata` with `source`, `sourceVersion`, `embeddedImages`, `createdAt`, `name`

### Panel Properties — Rename These

- [ ] `borderWidth` → `strokeWidth`
- [ ] `borderColor` → `strokeColor`
- [ ] Drop `borderRadius` (Panel Haus doesn't support it yet)
- [ ] Drop `backgroundColor` (Panel Haus always uses white fill)

### Panel Properties — Add These

- [ ] `showOutline: true` (or `false` if border should be hidden)
- [ ] `visible: true`
- [ ] `locked: false`
- [ ] `zIndex: <index>` (0-based, ascending)

### Text Bubbles — Required Properties

If exporting text bubbles, ensure each has:

- [ ] `id`, `x`, `y`, `width`, `height`
- [ ] `type` or `bubbleType` (one of: `speech-bubble`, `thought-bubble`, `caption-box`, `shout-bubble`, `whisper-bubble`, `jagged-bubble`, `no-bubble`)
- [ ] `text` (string content)
- [ ] `rotation: 0`
- [ ] `globalZIndex` (integer, controls draw order relative to stickers)
- [ ] `style` object with `fontFamily`, `fontSize`, `fontColor`, `textAlign`, `bold`, `italic`
- [ ] `bubble` object with `backgroundColor`, `borderColor`, `borderWidth`, `opacity`
- [ ] `tailAngle` (degrees: 0=right, 90=bottom, 180=left, 270=top)

### Images

- [ ] Embed images as base64 `data:image/...` in `imageSrc` (this is correct in the current export)
- [ ] Use unique `imageId` values per image

### Pages

- [ ] Every page needs a `dimension` object: `{ "width": 490, "height": 700 }`
- [ ] Don't export incomplete pages (Page 4 in testroject.comic has only 1 small panel covering 22.8% of the page)

---

## Quick Fix: Conversion Script

If you have existing Panel Shaq `.comic` files that need converting, this Node script patches them:

```js
const fs = require("fs");

const data = JSON.parse(fs.readFileSync("input.comic", "utf8"));

// Fix each page
for (const page of data.project.pages) {
  // 1. Wrap in layers if needed
  if (!page.layers) {
    page.layers = {
      panels: page.panels || [],
      textBubbles: page.textBubbles || [],
      stickers: page.stickers || [],
      background: page.background || null,
    };
    delete page.panels;
    delete page.textBubbles;
    delete page.stickers;
    delete page.background;
  }

  // 2. Fix panel property names
  for (const panel of page.layers.panels) {
    if ("borderWidth" in panel) {
      panel.strokeWidth = panel.borderWidth;
      delete panel.borderWidth;
    }
    if ("borderColor" in panel) {
      panel.strokeColor = panel.borderColor;
      delete panel.borderColor;
    }
    delete panel.borderRadius;
    delete panel.backgroundColor;

    // 3. Add missing properties
    if (!("showOutline" in panel)) panel.showOutline = true;
    if (!("visible" in panel)) panel.visible = true;
    if (!("locked" in panel)) panel.locked = false;
  }
}

fs.writeFileSync("output.comic", JSON.stringify(data));
console.log("Converted successfully.");
```

Usage: `node convert.js` (edit input/output filenames as needed)

---

## Long-Term Fix: Import Adapter in Panel Haus

Rather than requiring Panel Shaq to change its export, Panel Haus could detect `"source": "panelshaq"` in the metadata and auto-convert on load. The conversion logic is the same as the script above — ~20 lines in `saveLoadService.js` before the existing load path runs. This is documented in `documentation/exploration/PANELHAUS_PACKAGE_IMPORT_PLAN.md`.
