# Panel Haus Package Export

## Concept

Users create panels, characters, and layouts in Panel Shaq (mobile/web). They should be able to export their work as a `.panelhaus` package that Panel Haus Desktop can import and continue editing with the full editor.

Panel Shaq is the quick-capture tool. Panel Haus Desktop is the full studio. The package is the bridge.

---

## What Panel Shaq Produces

These are the data structures that exist today in Panel Shaq and would need to travel into the package:

### Story

- Plain text (the full story/script)

### Vault Entries (Characters, Environments, etc.)

```
VaultEntry {
  id: string
  type: "Character" | "Environment" | "Prop" | "Vehicle"
  name: string
  image: string          // base64 data URL (PNG/JPEG)
  description: string    // AI-generated or user-written
  personality?: string
  visualLook?: string
}
```

### Panels

```
PanelPrompt {
  id: string
  description: string           // the prompt / scene description
  characterFocus?: string
  cameraAngle?: string
  cameraLens?: string
  mood?: string
  aspectRatio?: string
  image?: string                 // base64 generated image (PNG/JPEG)
  selectedCharacterIds?: string[]
  customReferenceImages?: string[]  // base64
  notes?: string
  bubbles: Bubble[]
  imageTransform?: { x: number, y: number, scale: number }
}

Bubble {
  id: string
  text: string
  pos: { x: number, y: number }
  style: "speech" | "thought" | "action" | "effect"
  fontSize: number
  fontWeight: string
  fontStyle: string
  tailPos?: { x: number, y: number }
}
```

### Pages (Layout)

```
Page {
  id: string
  panelIds: string[]    // ordered references to PanelPrompt.id
  layoutId: string      // e.g. "2-split", "3-top-heavy", "4-grid"
}
```

### Layout Templates

Panel Shaq uses named layout templates with CSS grid slot definitions:

```
LayoutTemplate {
  id: string            // e.g. "3-top-heavy"
  name: string          // e.g. "Top Heavy"
  panelCount: number
  cols: number
  rows: number
  slots: { colStart, colEnd, rowStart, rowEnd }[]
}
```

---

## Proposed Package Format: `.panelhaus`

A `.panelhaus` file is a **ZIP archive** with a known internal structure:

```
my-comic.panelhaus
├── manifest.json
├── story.txt
├── characters/
│   ├── char_abc123.json
│   ├── char_abc123.png
│   ├── char_def456.json
│   └── char_def456.png
├── panels/
│   ├── panel_001.json       // metadata, bubbles, transform
│   ├── panel_001.png        // generated image
│   ├── panel_002.json
│   └── panel_002.png
└── pages/
    ├── page_001.json        // panelIds + layoutId
    └── page_002.json
```

### manifest.json

```json
{
  "format": "panelhaus",
  "version": 1,
  "name": "My Comic",
  "createdAt": "2026-03-20T...",
  "source": "panelshaq",
  "sourceVersion": "0.1.0",
  "characterCount": 2,
  "panelCount": 8,
  "pageCount": 2
}
```

### Why ZIP?

- Single file download — easy to share, email, AirDrop, upload
- Images stay as actual image files (not base64 blobs in JSON)
- Standard format — every platform can read it
- JSZip library is tiny (~13KB gzipped), works in browser
- Desktop app (Electron/Tauri) can read ZIPs natively

---

## Export Flow (Panel Shaq side)

1. User taps "Export for Panel Haus" button (share screen or project manager)
2. App gathers current project data from state/IndexedDB
3. Converts base64 images to binary blobs
4. Builds ZIP structure using JSZip
5. Triggers browser download of `{project-name}.panelhaus`

### Implementation sketch (Panel Shaq)

```typescript
import JSZip from "jszip";

async function exportPackage(project: SavedProject): Promise<Blob> {
  const zip = new JSZip();

  // Manifest
  zip.file(
    "manifest.json",
    JSON.stringify({
      format: "panelhaus",
      version: 1,
      name: project.name,
      createdAt: project.createdAt,
      source: "panelshaq",
      sourceVersion: "0.1.0",
      characterCount: project.vaultEntries?.length ?? 0,
      panelCount: project.panels.length,
      pageCount: project.pages.length,
    }),
  );

  // Story
  zip.file("story.txt", project.story);

  // Characters
  const chars = zip.folder("characters")!;
  for (const entry of project.vaultEntries ?? []) {
    const { image, ...meta } = entry;
    chars.file(`${entry.id}.json`, JSON.stringify(meta));
    if (image) {
      chars.file(`${entry.id}.png`, base64ToBlob(image));
    }
  }

  // Panels
  const panels = zip.folder("panels")!;
  for (let i = 0; i < project.panels.length; i++) {
    const panel = project.panels[i];
    const { image, customReferenceImages, ...meta } = panel;
    const order = String(i + 1).padStart(3, "0");
    panels.file(`panel_${order}.json`, JSON.stringify(meta));
    if (image) {
      panels.file(`panel_${order}.png`, base64ToBlob(image));
    }
  }

  // Pages
  const pages = zip.folder("pages")!;
  for (let i = 0; i < project.pages.length; i++) {
    const order = String(i + 1).padStart(3, "0");
    pages.file(`page_${order}.json`, JSON.stringify(project.pages[i]));
  }

  return zip.generateAsync({ type: "blob" });
}
```

---

## Import Flow (Panel Haus Desktop side)

> **This section is intentionally sparse — for the Desktop team to fill in.**

### What Desktop receives:

- A `.panelhaus` ZIP file with the structure above
- All images are standard PNG/JPEG files
- All metadata is JSON
- Layout templates referenced by `layoutId` string — Desktop needs to map these to its own layout system or define a shared template registry

### Questions for Desktop team:

1. **Image format preference** — PNG? JPEG? WebP? Should Panel Shaq export at a specific resolution?
2. **Panel ID mapping** — Desktop likely has its own ID scheme. Should the package use UUIDs that Desktop preserves, or does Desktop reassign IDs on import?
3. **Layout compatibility** — Panel Shaq's layout templates (grid slots) may not match Desktop's layout system. Options:
   - Share a layout template spec between both apps
   - Package includes the full grid slot definitions so Desktop can reconstruct
   - Desktop ignores layout and lets user re-layout
4. **Bubble/text layer** — Desktop probably has richer text editing. Should Panel Shaq's bubble data be treated as a starting point that Desktop upgrades?
5. **Character references** — Panel Shaq stores character images as reference art. Does Desktop want these as "reference layers" or as project assets?
6. **Round-trip support?** — Should Desktop be able to export `.panelhaus` back for Panel Shaq? Probably not needed — Panel Shaq is the simple tool, Desktop is the destination.

---

## Open Decisions

| Decision                | Options                                     | Recommendation                                               |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| File extension          | `.panelhaus`, `.phx`, `.comic`              | `.panelhaus` — clear, branded, no collisions                 |
| Image format in package | PNG, JPEG, or original                      | PNG for characters (transparency), JPEG for panels (smaller) |
| Package size limit      | None, or warn at threshold                  | Warn if > 50MB, block if > 200MB                             |
| Compression level       | ZIP store vs deflate                        | Deflate — images are already compressed but JSON benefits    |
| Dependency              | JSZip, fflate, or browser CompressionStream | JSZip — mature, tiny, works everywhere                       |

---

## Scope for Panel Shaq

The Panel Shaq side is straightforward:

1. Add `jszip` dependency
2. Write `exportPackage()` function (~50 lines)
3. Add "Export for Panel Haus" button on share/project screen
4. Trigger file download

That's it. No import needed on the Panel Shaq side. The heavy lifting is on Desktop to interpret the package.
