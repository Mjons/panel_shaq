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

---

## WebSocket Bridge: Seamless Panel Shaq → Panel Haus Desktop Connection

Panel Haus Desktop runs a WebSocket server on `ws://127.0.0.1:9876` (see `panelhaus-desktop-ws-instructions.md`). Panel Shaq can send projects directly to it without the user downloading a `.comic` file. But the WS bridge passes data straight to the same import logic as `.comic` files — so the **same format rules apply**.

The WS bridge doc currently shows a Panel Shaq format that has **additional incompatibilities** beyond the `.comic` file issues above. Here's everything Panel Shaq needs to transform before sending over the bridge.

### Additional WS Format Issues (Beyond `.comic` File Issues)

#### 1. `meta` vs `metadata` + Missing Top-Level `version`

**Panel Shaq WS sends:**

```json
{
  "meta": { "version": "1.0", "name": "...", "source": "panelshaq" },
  "project": { ... }
}
```

**Panel Haus expects:**

```json
{
  "version": "2.0.0",
  "metadata": { "name": "...", "source": "panelshaq", "embeddedImages": true, "createdAt": "..." },
  "project": { ... }
}
```

- Rename `meta` → `metadata`
- Move `version` out of metadata to top level and set to `"2.0.0"`
- Add `embeddedImages: true` and `createdAt` (ISO-8601 timestamp)

#### 2. Page Dimensions: Flat vs Object

**Panel Shaq WS sends:**

```json
{ "width": 490, "height": 700, "backgroundColor": "#FFFFFF", "panels": [...] }
```

**Panel Haus expects:**

```json
{ "dimension": { "width": 490, "height": 700 }, "layers": { "panels": [...] } }
```

- Wrap `width`/`height` in a `dimension` object
- Drop `backgroundColor` (page-level background color not used)

#### 3. `imageData` vs `imageSrc`

Panel Shaq uses `imageData` for base64 image content. Panel Haus uses `imageSrc`. Rename the field.

#### 4. `imageTransform` Missing Fields

**Panel Shaq sends:**

```json
{ "x": 0, "y": 0, "scale": 1 }
```

**Panel Haus expects:**

```json
{ "x": 0, "y": 0, "scale": 1, "rotation": 0, "flipH": false, "flipV": false }
```

Add the missing `rotation`, `flipH`, `flipV` defaults.

#### 5. Bubbles Nested Inside Panels (Critical Restructure)

This is the biggest structural difference in the WS format. Panel Shaq nests bubbles inside each panel. Panel Haus stores them as a flat page-level array with absolute coordinates.

**Panel Shaq WS sends:**

```json
{
  "panels": [
    {
      "id": "1",
      "x": 10,
      "y": 10,
      "width": 225,
      "height": 340,
      "bubbles": [
        {
          "id": "b1",
          "text": "Hello!",
          "x": 120,
          "y": 50,
          "style": "speech",
          "fontSize": 12
        }
      ]
    }
  ]
}
```

**Panel Haus expects:**

```json
{
  "layers": {
    "panels": [
      { "id": "panel-1", "x": 10, "y": 10, "width": 225, "height": 340 }
    ],
    "textBubbles": [
      {
        "id": "bubble-b1",
        "type": "speech-bubble",
        "text": "Hello!",
        "x": 130,
        "y": 60,
        "width": 150,
        "height": 60,
        "rotation": 0,
        "globalZIndex": 0,
        "style": {
          "fontFamily": "Bangers",
          "fontSize": 12,
          "fontColor": "#000000",
          "textAlign": "center",
          "bold": true,
          "italic": false
        },
        "bubble": {
          "backgroundColor": "#FFFFFF",
          "borderColor": "#000000",
          "borderWidth": 2,
          "opacity": 1
        },
        "tailAngle": 270
      }
    ]
  }
}
```

**Transformation required:**

1. Extract `bubbles[]` from every panel
2. Convert bubble `x`/`y` from panel-relative to page-absolute: `absoluteX = panel.x + bubble.x`, `absoluteY = panel.y + bubble.y`
3. Map `style: "speech"` → `type: "speech-bubble"` (append `-bubble` suffix)
4. Move `fontSize`, `fontWeight`, `fontStyle` into a nested `style` object
5. Add default `width` (150), `height` (60), `rotation` (0), `globalZIndex` (incrementing)
6. Add default `bubble` appearance object and `tailAngle`
7. Collect all extracted bubbles into a flat `textBubbles[]` array at page level
8. Remove `bubbles` from each panel object

#### 6. Blueprint `imageData` and Capitalized `type`

**Panel Shaq sends:**

```json
{ "type": "Character", "imageData": "data:image/..." }
```

**Panel Haus expects:**

```json
{
  "type": "character",
  "thumbnailDataUrl": "data:image/...",
  "referenceImageId": null
}
```

- Lowercase `type` value
- Rename `imageData` → `thumbnailDataUrl`
- Add `referenceImageId: null`

---

### Full Transformation Function for Panel Shaq

This function converts Panel Shaq's WS/export format into Panel Haus format. Run it **before** sending over the WebSocket or before saving as a `.comic` file — both paths feed into the same import logic.

```js
function convertPanelShaqToHaus(shaqData) {
  const haus = {
    version: "2.0.0",
    metadata: {
      createdAt: shaqData.meta?.createdAt || new Date().toISOString(),
      name: shaqData.meta?.name || shaqData.project?.name || "Imported Project",
      embeddedImages: true,
      source: "panelshaq",
      sourceVersion: shaqData.meta?.sourceVersion || "1.0.0",
    },
    project: {
      id: shaqData.project?.id || crypto.randomUUID(),
      name: shaqData.project?.name || "Imported Project",
      pages: [],
      generatedStories: shaqData.project?.generatedStories || [],
      blueprints: [],
    },
  };

  // Convert blueprints
  for (const bp of shaqData.project?.blueprints || []) {
    haus.project.blueprints.push({
      ...bp,
      type: (bp.type || "character").toLowerCase(),
      thumbnailDataUrl: bp.imageData || bp.thumbnailDataUrl || null,
      referenceImageId: bp.referenceImageId || null,
    });
    delete haus.project.blueprints.at(-1).imageData;
  }

  // Convert pages
  for (const page of shaqData.project?.pages || []) {
    const panels = page.panels || page.layers?.panels || [];
    const textBubbles = [];
    let globalZIndex = 0;

    // Build panels + extract bubbles
    const hausPanels = panels.map((panel, idx) => {
      // Extract nested bubbles → page-level textBubbles
      for (const bubble of panel.bubbles || []) {
        textBubbles.push({
          id: `bubble-${bubble.id || crypto.randomUUID()}`,
          type: bubble.style ? `${bubble.style}-bubble` : "speech-bubble",
          text: bubble.text || "",
          x: (panel.x || 0) + (bubble.x || 0), // panel-relative → absolute
          y: (panel.y || 0) + (bubble.y || 0),
          width: bubble.width || 150,
          height: bubble.height || 60,
          rotation: bubble.rotation || 0,
          globalZIndex: globalZIndex++,
          style: {
            fontFamily: bubble.fontFamily || "Bangers",
            fontSize: bubble.fontSize || 16,
            fontColor: bubble.fontColor || "#000000",
            textAlign: bubble.textAlign || "center",
            bold: bubble.fontWeight === "bold",
            italic: bubble.fontStyle === "italic",
          },
          bubble: {
            backgroundColor: "#FFFFFF",
            borderColor: "#000000",
            borderWidth: 2,
            opacity: 1,
          },
          tailAngle: bubble.tailAngle ?? 270,
        });
      }

      // Build Panel Haus panel
      const hausPanel = {
        id: `panel-${panel.id || crypto.randomUUID()}`,
        x: panel.x,
        y: panel.y,
        width: panel.width,
        height: panel.height,
        imageSrc: panel.imageData || panel.imageSrc || null,
        imageId: panel.imageId || `img_${idx}`,
        imageTransform: {
          x: panel.imageTransform?.x || 0,
          y: panel.imageTransform?.y || 0,
          scale: panel.imageTransform?.scale || 1,
          rotation: panel.imageTransform?.rotation || 0,
          flipH: panel.imageTransform?.flipH || false,
          flipV: panel.imageTransform?.flipV || false,
        },
        strokeWidth: panel.borderWidth ?? panel.strokeWidth ?? 2,
        strokeColor: panel.borderColor || panel.strokeColor || "#000000",
        showOutline: true,
        visible: true,
        locked: false,
        zIndex: idx,
      };
      return hausPanel;
    });

    // Also grab any page-level textBubbles/stickers (from .comic file format)
    const existingBubbles = page.textBubbles || page.layers?.textBubbles || [];
    const stickers = page.stickers || page.layers?.stickers || [];

    haus.project.pages.push({
      id: page.id || `page-${crypto.randomUUID()}`,
      dimension: {
        width: page.width || page.dimension?.width || 490,
        height: page.height || page.dimension?.height || 700,
      },
      layers: {
        panels: hausPanels,
        textBubbles: [...existingBubbles, ...textBubbles],
        stickers: stickers,
        background: page.background || page.layers?.background || null,
      },
    });
  }

  return haus;
}
```

### How Panel Shaq Should Use This

#### Option A: Transform Before Sending Over WebSocket (Recommended)

Panel Shaq transforms the data client-side before sending. Panel Haus Desktop receives clean data and uses its existing import logic unchanged.

```js
// In Panel Shaq's "Send to Desktop" handler:
const ws = new WebSocket("ws://localhost:9876");
ws.onopen = () => {
  const shaqData = getCurrentProjectData(); // Panel Shaq's native format
  const hausData = convertPanelShaqToHaus(shaqData); // Transform
  ws.send(JSON.stringify(hausData)); // Send clean data
};
ws.onmessage = (e) => {
  const response = JSON.parse(e.data);
  if (response.status === "ok") showToast("Sent to Panel Haus Desktop!");
};
```

#### Option B: Transform Before Saving `.comic` File

Same function, applied when the user exports a `.comic` file for manual import:

```js
function exportAsComicFile(shaqData) {
  const hausData = convertPanelShaqToHaus(shaqData);
  const blob = new Blob([JSON.stringify(hausData)], {
    type: "application/json",
  });
  downloadBlob(blob, `${hausData.metadata.name}.comic`);
}
```

#### Option C: Panel Haus Detects and Auto-Converts on Import

Add an adapter in Panel Haus Desktop's renderer before the existing import logic:

```js
ipcRenderer.on("import-comic-from-bridge", (_event, jsonString) => {
  let comicData = JSON.parse(jsonString);

  // Auto-detect Panel Shaq format and convert
  if (
    comicData.meta?.source === "panelshaq" ||
    comicData.metadata?.source === "panelshaq"
  ) {
    comicData = convertPanelShaqToHaus(comicData);
  }

  importComicProject(comicData);
});
```

**Recommendation:** Do both Option A and Option C. Panel Shaq sends clean data (A), and Panel Haus has a safety net adapter (C) for older Panel Shaq versions that haven't updated yet.

---

### Complete Property Mapping Reference

| Panel Shaq (WS/Export)            | Panel Haus (Expected)               | Transform                                 |
| --------------------------------- | ----------------------------------- | ----------------------------------------- |
| `meta`                            | `metadata`                          | Rename key                                |
| `meta.version: "1.0"`             | Top-level `version: "2.0.0"`        | Move + update value                       |
| `page.width` / `page.height`      | `page.dimension: { width, height }` | Wrap in object                            |
| `page.backgroundColor`            | _(drop)_                            | Delete                                    |
| `page.panels`                     | `page.layers.panels`                | Wrap in `layers`                          |
| `page.textBubbles`                | `page.layers.textBubbles`           | Wrap in `layers`                          |
| `page.stickers`                   | `page.layers.stickers`              | Wrap in `layers`                          |
| `panel.bubbles[]`                 | `page.layers.textBubbles[]`         | Extract, convert coords to absolute       |
| `panel.borderWidth`               | `panel.strokeWidth`                 | Rename                                    |
| `panel.borderColor`               | `panel.strokeColor`                 | Rename                                    |
| `panel.borderRadius`              | _(drop)_                            | Delete                                    |
| `panel.backgroundColor`           | _(drop)_                            | Delete                                    |
| `panel.imageData`                 | `panel.imageSrc`                    | Rename                                    |
| `panel.imageTransform` (3 fields) | `panel.imageTransform` (6 fields)   | Add `rotation`, `flipH`, `flipV` defaults |
| `bubble.style: "speech"`          | `bubble.type: "speech-bubble"`      | Append `-bubble`                          |
| `bubble.fontSize` (flat)          | `bubble.style.fontSize` (nested)    | Restructure into `style` object           |
| `bubble.fontWeight` (flat)        | `bubble.style.bold` (boolean)       | Convert `"bold"` → `true`                 |
| `blueprint.imageData`             | `blueprint.thumbnailDataUrl`        | Rename                                    |
| `blueprint.type: "Character"`     | `blueprint.type: "character"`       | Lowercase                                 |
