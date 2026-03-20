# Image Download & Data Safety Plan

## Problem

1. **No way to download individual panel images.** Users generate images panel by panel but can only export full pages (PDF/PNG of the layout). If they want a single panel's raw image, they have no option.

2. **No "download all" for generated images.** A user who generated 6 panels has to export page-by-page. There's no way to get all raw panel images at once.

3. **Work disappears without warning.** Multiple actions silently destroy generated images with no confirmation and no way to recover them.

---

## Part A: Image Downloads

### 1. Individual Panel Download

**Where:** DirectorScreen — each panel card gets a download button when it has a generated image.

**How:** The image is already base64 in `panel.image`. Download via:

```ts
const link = document.createElement("a");
link.download = `panel-${index + 1}.png`;
link.href = panel.image;
link.click();
```

**UI:** Small download icon in the top-right of each panel card (only when image exists). Sits alongside the queue/failed badges.

### 2. Download All Images

**Where:** DirectorScreen header — a "Download All" button next to "Generate All".

**How:** Sequential file downloads:

```ts
panels
  .filter((p) => p.image)
  .forEach((panel, i) => {
    const link = document.createElement("a");
    link.download = `panel-${String(i + 1).padStart(2, "0")}.png`;
    link.href = panel.image;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
```

**UI:** Only visible when at least one panel has an image. Secondary styling.

### 3. EditorScreen Panel Download

**Where:** EditorScreen left sidebar — when a panel is selected, show a "Download Panel" button in the Panel Transform section.

---

## Part B: Data Safety Warnings

Every place a user's generated images can be destroyed, listed by severity.

### B1. "Generate Panels" in Workshop (CRITICAL)

**What happens:** `setPanels(generatedPanels)` replaces the entire panels array. All existing panel images are gone instantly.

**When it's dangerous:** User already has panels with generated images, goes back to Workshop, edits the story, and hits "Generate Panels" again.

**Fix:** If panels with images exist, show:

```
"You have X panels with generated images. Generating new panels will replace them all. Download your images first or continue?"
```

With buttons: **"Download & Continue"** | **"Continue Anyway"** | **"Cancel"**

"Download & Continue" triggers a batch download of all current images before generating.

**File:** `src/screens/WorkshopScreen.tsx` — `handleGeneratePanels`

### B2. Panel Regeneration in Director (HIGH)

**What happens:** Clicking "Generate" or "Regenerate" on a panel that already has an image overwrites it.

**When it's dangerous:** User likes their current image but accidentally hits regenerate, or wants to try a different style but forgets to download first.

**Fix:** If the panel already has an image, show:

```
"Regenerate this panel? The current image will be replaced."
```

**File:** `src/screens/DirectorScreen.tsx` — `handleGenerate` in PanelCard, and the queue processor

### B3. "Generate All" in Director (HIGH)

**What happens:** Queues regeneration for all panels (or all without images). Panels that already have images get overwritten as each one completes.

**When it's dangerous:** User has 4/6 panels generated, hits "Generate All" thinking it'll only do the 2 missing ones — but if all have images, it regenerates everything.

**Fix:** If some panels already have images, show:

```
"X of Y panels already have images. Generate only the X missing panels, or regenerate all?"
```

With buttons: **"Missing Only"** | **"Regenerate All"** | **"Cancel"**

**File:** `src/screens/DirectorScreen.tsx` — `handleGenerateAll`

### B4. "Create New" Project (MEDIUM)

**What happens:** `saveCurrentProject()` is called first (good), then all state is wiped. Work is saved to IndexedDB but disappears from screen.

**When it's dangerous:** User doesn't realize their work was saved and thinks it's gone. Or the auto-save failed silently.

**Fix:** If there are panels with images, show:

```
"Start a new project? Your current work will be saved and you can reload it from the project manager."
```

**File:** `src/App.tsx` — `handleCreateNew`

### B5. Load Different Project (MEDIUM)

**What happens:** Current state is replaced with the loaded project's data. Current work is NOT auto-saved first (only `handleCreateNew` saves).

**When it's dangerous:** User opens project manager and taps a different project. Current unsaved work is just gone.

**Fix:** Save current project before loading, and show:

```
"Load this project? Your current work will be saved first."
```

**File:** `src/components/ProjectManager.tsx` or `src/App.tsx` — `handleLoadProject`

### B6. "Final Render" in Editor (LOW)

**What happens:** `finalNaturalRender` takes the panel image + bubbles and generates a new image with bubbles baked in. The original image is overwritten and bubbles array is cleared.

**When it's dangerous:** The original clean image (without bubbles) is lost. User can't undo.

**Fix:** This one is lower priority since the user explicitly chose to render. But a note in the UI: "This will permanently bake bubbles into the image."

**File:** `src/screens/EditorScreen.tsx` — `handleFinalRender`

---

## Implementation Scope

| File                                | Changes                                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/screens/DirectorScreen.tsx`    | Download button per panel, "Download All" in header, regenerate confirmation (B2), generate-all dialog (B3) |
| `src/screens/EditorScreen.tsx`      | Download button for selected panel in sidebar                                                               |
| `src/screens/WorkshopScreen.tsx`    | Warning before re-generating panels when images exist (B1)                                                  |
| `src/App.tsx`                       | Confirmation on create new (B4), save-before-load on load project (B5)                                      |
| `src/components/ProjectManager.tsx` | Trigger save before loading different project                                                               |

### No New Dependencies

Everything uses browser's native download via `<a>` elements and base64 data URLs.

---

## Execution Order

1. **Download buttons** (A1, A2, A3) — give users the ability to save their work first
2. **Workshop re-generate warning** (B1) — most destructive, highest priority warning
3. **Regenerate/Generate All confirmations** (B2, B3) — prevent accidental credit spend
4. **Create New / Load Project safety** (B4, B5) — save before switching
5. **Final Render note** (B6) — informational only
