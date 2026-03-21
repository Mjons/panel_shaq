# Panel Haus Package Import — Full Exploration Plan

> Bridging Panel Shaq (mobile) → Panel Haus Desktop (Comic-ProV2)

---

## TL;DR

Panel Haus Desktop already has a robust `.comic` JSON import pipeline with automatic image extraction. Instead of inventing a new `.panelhaus` ZIP format, **Panel Shaq should export a `.comic` file** (or we support both). The Desktop side needs ~200 lines of mapping code to translate Panel Shaq's simpler data model into Desktop's richer one. Most of the plumbing already exists.

---

## 1. What Desktop Already Has (No Work Needed)

| Capability                      | Location                                               | Notes                                                     |
| ------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| File picker + load              | `SaveLoadModal.jsx` → `saveLoadService.loadFromFile()` | Reads file, parses JSON, returns project                  |
| Image extraction to IndexedDB   | `saveLoadService.extractImagesToLibrary()`             | Auto-creates folder "Extracted from [name]", dedupes      |
| Project state hydration         | `projectStore.actions.loadProject()`                   | Replaces state, migrates stickers/bubbles                 |
| Version migration               | `migrationService.migrateProject()`                    | v1 → v2 already works                                     |
| World Vault (character storage) | `worldVaultStore` + `storageService`                   | Blueprints with reference images, descriptions, vibe tags |
| 100+ panel layouts              | `panelLayouts.js` (9063 lines)                         | Keyed by dimension + name                                 |
| 13 bubble types + 80 styles     | `storageService.PREDEFINED_STYLES`                     | Rich text, tails, shadows, etc.                           |

**Bottom line:** Desktop can already open a `.comic` JSON file and fully hydrate a project. We just need to make Panel Shaq speak that format — or write a thin translator.

---

## 2. Data Model Mapping: Panel Shaq → Desktop

### 2a. Pages

| Panel Shaq                                  | Desktop                                    | Translation                                                 |
| ------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| `Page.id`                                   | `page.id`                                  | Preserve or regenerate UUID                                 |
| `Page.panelIds[]`                           | `page.panels[]`                            | Expand references into full panel objects                   |
| `Page.layoutId` (string like "3-top-heavy") | `page.panels[]` with absolute pixel coords | **Must resolve** layout template → pixel positions (see §3) |
| _(no dimension)_                            | `page.dimension` (`{width, height}`)       | Default to portrait `490×700` or let user pick on import    |

### 2b. Panels

| Panel Shaq (`PanelPrompt`)            | Desktop (`panel`)                                 | Translation                                             |
| ------------------------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| `id`                                  | `id`                                              | Preserve                                                |
| `image` (base64)                      | `imageSrc` (data URL) + `imageId` (stored ref)    | Store image in IndexedDB, set both fields               |
| `imageTransform.{x,y,scale}`          | `imageTransform.{x,y,scale,rotation,flipH,flipV}` | Add defaults: `rotation:0, flipH:false, flipV:false`    |
| `description`                         | _(not stored on panel)_                           | Could save as panel metadata or discard                 |
| `characterFocus`, `cameraAngle`, etc. | _(not stored)_                                    | Generation metadata — store in project notes or discard |
| `notes`                               | _(not stored)_                                    | Same as above                                           |
| `bubbles[]`                           | `page.textBubbles[]`                              | Map bubble format (see §2d)                             |
| `aspectRatio`                         | Panel dimensions (absolute px)                    | Derived from layout slot, not stored separately         |

### 2c. Characters (Vault Entries → Blueprints)

| Panel Shaq (`VaultEntry`)                           | Desktop (`Blueprint`)                        | Translation                                                 |
| --------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------- |
| `id`                                                | `id` (format: `bp_timestamp_random`)         | Regenerate in Desktop format                                |
| `type` ("Character"/"Environment"/"Prop"/"Vehicle") | `type` ("character"/"environment"/"vehicle") | Lowercase + merge "Prop" → "character" or add prop type     |
| `name`                                              | `name`                                       | Direct                                                      |
| `image` (base64)                                    | `referenceImageId` + `thumbnailDataUrl`      | Store image via `storeBlueprintImage()`, generate thumbnail |
| `description`                                       | `description`                                | Direct                                                      |
| `personality`                                       | `personalityTraits` or `description` append  | Map to traits object or concat                              |
| `visualLook`                                        | `description` append or `analysisResults`    | Enrich description                                          |
| _(no vibeTags)_                                     | `vibeTags: null`                             | Default null                                                |
| _(no avoidDescription)_                             | `avoidDescription: ""`                       | Default empty                                               |

### 2d. Text Bubbles

| Panel Shaq (`Bubble`)                          | Desktop (`textBubble`)                       | Translation                                                                                      |
| ---------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `id`                                           | `id`                                         | Preserve                                                                                         |
| `text`                                         | `text`                                       | Direct                                                                                           |
| `pos.{x,y}`                                    | `x`, `y`                                     | Direct (need to scale if dimensions differ)                                                      |
| `style` ("speech"/"thought"/"action"/"effect") | `bubbleType`                                 | Map: speech→"oblong-wide", thought→"thought-bubble", action→"shout-bubble", effect→"caption-box" |
| `fontSize`                                     | `style.fontSize`                             | Direct                                                                                           |
| `fontWeight`                                   | `style.bold`                                 | `"bold" → true`, else `false`                                                                    |
| `fontStyle`                                    | `style.italic`                               | `"italic" → true`, else `false`                                                                  |
| `tailPos.{x,y}`                                | `tailAngle` (0-360)                          | **Calculate angle** from bubble center to tail tip                                               |
| _(no width/height)_                            | `width`, `height`                            | Auto-size or use defaults (200×80)                                                               |
| _(no bubble colors)_                           | `bubble.{backgroundColor, borderColor, ...}` | Use predefined style defaults per type                                                           |

### 2e. Story

| Panel Shaq           | Desktop                      | Translation                                                                |
| -------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| `story` (plain text) | `project.generatedStories[]` | Wrap in story object: `{id, title: "Imported Story", content: story, ...}` |

---

## 3. The Layout Problem (Biggest Gap)

Panel Shaq uses **named layout templates** with CSS grid slots:

```
{ id: "3-top-heavy", cols: 2, rows: 2, slots: [{colStart:1, colEnd:3, rowStart:1, rowEnd:2}, ...] }
```

Desktop uses **absolute pixel coordinates** per panel:

```
{ x: 10, y: 10, width: 680, height: 340 }
```

### Options (pick one):

#### Option A: Shared Layout Registry (Recommended)

- Define a mapping table: Panel Shaq `layoutId` → Desktop `layoutKey`
- Desktop already has 100+ layouts. Most of Panel Shaq's templates have Desktop equivalents.
- On import, look up the Desktop layout key and apply it via `PanelLayoutManager.applyLayout()`
- **Effort:** ~30 lines (a mapping object)
- **Risk:** Some Panel Shaq layouts may not have exact Desktop matches

#### Option B: Grid-to-Pixel Converter

- Take Panel Shaq's `{cols, rows, slots[]}` grid definition
- Convert to absolute pixel positions given a target dimension (e.g., 490×700)
- Formula: `x = margin + (colStart-1) * cellWidth`, etc.
- **Effort:** ~50 lines
- **Risk:** Gaps/margins may differ slightly

#### Option C: Include Full Slot Definitions in Package

- Panel Shaq exports the grid slot definitions alongside the `layoutId`
- Desktop converts slots → pixels on import using Option B logic
- **Effort:** Same as B, but more robust (no registry needed)
- **Recommendation:** Use this as fallback when Option A has no match

**Best approach: A + C combined.** Try the registry first, fall back to grid conversion.

---

## 4. Two Import Strategies

### Strategy 1: Native `.comic` Export from Panel Shaq (Simplest)

Panel Shaq exports directly in Desktop's `.comic` JSON format:

```json
{
  "version": "2.0.0",
  "metadata": {
    "createdAt": "...",
    "name": "My Comic",
    "embeddedImages": true,
    "source": "panelshaq",
    "sourceVersion": "0.1.0"
  },
  "project": {
    "id": "...",
    "name": "My Comic",
    "pages": [
      {
        "id": "...",
        "dimension": { "width": 490, "height": 700 },
        "panels": [
          {
            "id": "...",
            "x": 10, "y": 10, "width": 470, "height": 340,
            "imageSrc": "data:image/png;base64,...",
            "imageId": "img_001",
            "imageTransform": { "x": 0, "y": 0, "scale": 1, "rotation": 0, "flipH": false, "flipV": false }
          }
        ],
        "textBubbles": [
          {
            "id": "...",
            "bubbleType": "oblong-wide",
            "text": "Hello!",
            "x": 100, "y": 50,
            "width": 200, "height": 80,
            "style": { "fontFamily": "Comic Sans MS", "fontSize": 16, "fontColor": "#000000", "bold": false, "italic": false, ... },
            "bubble": { "backgroundColor": "#FFFFFF", "borderColor": "#000000", "borderWidth": 2, "opacity": 1 },
            "tailAngle": 270, "tailLength": 1.5, "tailWidth": 1
          }
        ],
        "background": null,
        "stickers": []
      }
    ]
  }
}
```

**Pros:**

- Zero Desktop code changes — `loadFromFile()` handles it today
- Images auto-extracted to library
- Project loads immediately with full editing capability

**Cons:**

- Panel Shaq needs to understand Desktop's exact data format
- Layout resolution must happen on Panel Shaq side
- Tighter coupling between the two apps

**Effort:** ~150 lines on Panel Shaq side (format conversion + layout resolution)

### Strategy 2: `.panelhaus` ZIP with Desktop Converter (Original Proposal)

Keep the ZIP format from the SKILL.md spec. Add a converter on Desktop side.

**Pros:**

- Clean separation — each app owns its own format
- Images stored as real files (easier to inspect/debug)
- Extensible for future apps

**Cons:**

- Need JSZip on Desktop side (or native ZIP reading)
- Need full conversion pipeline on Desktop (~200 lines)
- Two code paths to maintain

**Effort:** ~200 lines on Desktop side + ~50 lines on Panel Shaq side

### Recommendation: **Strategy 1 for MVP, Strategy 2 later if needed**

The `.comic` format already works. Shipping faster > architectural purity.

---

## 5. Implementation Plan

### Phase 1: Panel Shaq Export (Panel Shaq team)

```
[ ] 1. Add layout mapping table (Panel Shaq layoutId → pixel coordinates)
       - Use 490×700 (portrait) as default target dimension
       - Convert grid slots to absolute pixel positions
       - Or hardcode the ~15 common layouts as pixel arrays

[ ] 2. Write `exportAsComic()` function
       - Build Desktop-compatible JSON structure (see Strategy 1 format above)
       - Embed images as base64 data URLs
       - Map bubbles to Desktop text bubble format
       - Map vault entries to Desktop blueprint format
       - Include story as generatedStories[] entry

[ ] 3. Add export button + file download trigger
       - "Export for Panel Haus" on share/project screen
       - Download as `{project-name}.comic`
```

### Phase 2: Desktop Enhancements (This Repo)

```
[ ] 4. Add source detection on import
       - In saveLoadService.loadFromFile(), detect metadata.source === "panelshaq"
       - Log import source for analytics
       - Show "Imported from Panel Shaq" badge in project info

[ ] 5. Auto-import vault entries as World Vault blueprints
       - After loadFromFile(), check for embedded vault data
       - Create blueprints in worldVaultStore for each character/environment
       - Store reference images via storeBlueprintImage()
       - Show import summary: "Imported 3 characters, 2 environments"

[ ] 6. Import polish
       - Welcome toast: "Project imported from Panel Shaq — all features unlocked"
       - Auto-navigate to first page
       - Highlight areas that may need Desktop refinement (e.g., basic bubble styles → suggest style upgrade)
```

### Phase 3: Nice-to-Haves (Future)

```
[ ] 7. Cloud sync bridge (if Panel Shaq gets cloud storage)
       - Skip file export/import entirely
       - Panel Shaq saves to cloud → Desktop pulls from cloud
       - Real-time sync via shared project ID

[ ] 8. .panelhaus ZIP support (if multi-app ecosystem grows)
       - Add JSZip to Desktop dependencies
       - Write converter: unzip → build .comic JSON → feed to existing pipeline
       - Support drag-drop of .panelhaus files

[ ] 9. Round-trip support
       - Desktop exports simplified .comic for Panel Shaq
       - Strips Desktop-only features (polygon panels, complex tails, stickers)
       - Preserves panel images and basic bubbles
```

---

## 6. Answering the SKILL.md Open Questions

| Question                    | Answer from Desktop Exploration                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Image format preference** | PNG for characters (transparency needed for blueprints). JPEG fine for panel images. Desktop handles both. Max 10MB per image.                      |
| **Panel ID mapping**        | Desktop uses simple string IDs. Preserve Panel Shaq IDs — no conflict.                                                                              |
| **Layout compatibility**    | Use mapping table (§3 Option A+C). Desktop has 100+ layouts. Most Panel Shaq templates have equivalents.                                            |
| **Bubble/text layer**       | Desktop has 13 bubble types vs Panel Shaq's 4. Map the 4 types, Desktop users can upgrade. All Desktop styles available immediately after import.   |
| **Character references**    | Import as **World Vault Blueprints**. Desktop already has character, environment, vehicle types with reference images, descriptions, and vibe tags. |
| **Round-trip support**      | Not needed for MVP. Desktop is the destination. Panel Shaq is quick-capture. If needed later, Desktop can export a simplified format.               |
| **File extension**          | `.comic` for interop simplicity. `.panelhaus` only if ecosystem grows to 3+ apps.                                                                   |
| **Package size limit**      | Desktop handles base64 images fine. Warn at 50MB (practical browser limit).                                                                         |
| **Dependency**              | No new dependency needed if using `.comic` JSON. JSZip only if ZIP format added later.                                                              |

---

## 7. Size Estimates

| Component                     | Lines of Code  | Where                        |
| ----------------------------- | -------------- | ---------------------------- |
| Layout mapping table          | ~30            | Panel Shaq                   |
| `exportAsComic()` function    | ~120           | Panel Shaq                   |
| Bubble format mapper          | ~40            | Panel Shaq                   |
| Vault → Blueprint mapper      | ~40            | Panel Shaq                   |
| Export UI (button + download) | ~20            | Panel Shaq                   |
| **Panel Shaq total**          | **~250**       |                              |
| Source detection + badge      | ~15            | Desktop `saveLoadService.js` |
| Vault auto-import on load     | ~60            | Desktop `saveLoadService.js` |
| Import summary toast          | ~10            | Desktop `SaveLoadModal.jsx`  |
| **Desktop total**             | **~85**        |                              |
| **Grand total**               | **~335 lines** |                              |

---

## 8. What Makes This "More Automatic"

Instead of the user manually exporting a ZIP, downloading it, then importing it:

### Near-term (file-based but smoother):

1. Panel Shaq "Send to Desktop" button → exports `.comic` and opens system share sheet
2. Desktop registers as `.comic` file handler (Electron/Tauri `file-associations`)
3. User taps share → picks Panel Haus → Desktop opens with project loaded
4. **One tap, zero file management**

### Medium-term (cloud bridge):

1. Panel Shaq saves project to shared cloud bucket (S3/R2/Supabase)
2. Desktop shows "Panel Shaq Projects" section in open dialog
3. User clicks project → Desktop pulls and imports automatically
4. **Zero file management, near-instant**

### Long-term (real-time sync):

1. Both apps share a project format and sync engine
2. Edit on mobile → see changes on Desktop in seconds
3. This is the Figma model — ambitious but possible with CRDTs

---

## 9. Risk Assessment

| Risk                                                | Likelihood | Impact                                                 | Mitigation                                                  |
| --------------------------------------------------- | ---------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| Panel Shaq layout doesn't match any Desktop layout  | Medium     | Low — panels still import, just positioned differently | Grid-to-pixel fallback (Option C)                           |
| Large projects (50+ panels) create huge JSON files  | Low        | Medium — slow download/parse                           | Warn at 50MB, suggest reducing image quality                |
| Desktop format changes break Panel Shaq export      | Low        | High — imports fail silently                           | Version field in manifest, migration path                   |
| Bubble positions don't align after dimension change | Medium     | Low — visual only, easily adjusted                     | Scale positions proportionally during import                |
| Panel Shaq adds new data types Desktop doesn't know | Medium     | None — unknown fields ignored by `loadProject()`       | Desktop gracefully ignores unknown keys (already does this) |

---

## 10. Next Steps

1. **Align on Strategy 1 vs 2** — `.comic` JSON (simple) or `.panelhaus` ZIP (clean)?
2. **Share Desktop's page/panel schema** with Panel Shaq team (this document covers it)
3. **Build layout mapping table** — list Panel Shaq's layout templates, find Desktop equivalents
4. **Prototype export** on Panel Shaq side — generate a `.comic` file, try opening in Desktop
5. **Add vault auto-import** on Desktop side — the only net-new Desktop feature needed
