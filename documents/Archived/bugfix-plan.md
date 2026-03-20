# Panel Shaq — Quick Fixes Plan

**Date:** 2026-03-19
**Scope:** 3 targeted fixes before continuing with the weekly roadmap

---

## Fix 1: Image Cutoff in Editor Panel Transform

**Problem:** When using Scale, Offset X, or Offset Y sliders in the Editor's "Panel Transform" section, the image gets clipped by the panel's `overflow-hidden`. Users can't see what they're framing outside the visible area unless they toggle "Framing Mode" — and even then the behavior is inconsistent because the parent containers also clip.

**Root Cause:** In `EditorScreen.tsx`, the panel `<div>` and its parent both use `overflow-hidden` by default. The `isFraming` toggle only applies to the currently selected panel, but the image transform uses CSS `translate()` which moves the image outside the clipped bounds.

**Fix:**

**File:** `src/screens/EditorScreen.tsx`

1. **When a panel is selected and transform sliders are being used, the selected panel should show overflow.** Change the panel container so that `overflow-visible` applies whenever the panel is selected (not just in framing mode):
   - Line ~779: Change the panel div's overflow logic:
     ```
     Current:  isFraming && selectedPanelId === pid ? "overflow-visible z-50" : "overflow-hidden"
     New:      selectedPanelId === pid ? "overflow-visible z-50" : "overflow-hidden"
     ```
   - Same change on line ~783 for the inner image wrapper div.

2. **Add a dimming overlay on neighboring panels** when a panel is selected for transform, so the overflow content is visually distinct from adjacent panels:
   - Add an overlay div inside non-selected panels when any panel is selected:
     ```tsx
     {
       selectedPanelId && selectedPanelId !== pid && (
         <div className="absolute inset-0 bg-black/30 z-10 pointer-events-none" />
       );
     }
     ```

3. **Remove the separate "Framing Mode" button** — it's now redundant since selecting a panel automatically allows overflow. Remove the `isFraming` state variable and all references to it.

**Test:**

- Select a panel in the Editor
- Move Scale slider to 200%+ → image should visibly overflow the panel boundary
- Move Offset X/Y → image should slide visibly beyond the border
- Non-selected panels should be dimmed
- Export PDF/PNG → overflow should NOT appear in export (verify `overflow-hidden` is restored during export)

---

## Fix 2: Aspect Ratio Selection for Panel Generation

**Problem:** All panels are generated at a hardcoded `16:9` aspect ratio (in `geminiService.ts` line 173). Users can't choose aspect ratios — the Director screen layout alternates between `aspect-[21/9]` (wide) and `aspect-square` based on index, but the generated image is always 16:9 regardless.

**Root Cause:**

- `generatePanelImage()` in `geminiService.ts` hardcodes `aspectRatio: "16:9"`
- `PanelPrompt` interface has no `aspectRatio` field
- `PanelCard` in `DirectorScreen.tsx` has no aspect ratio selector UI

**Fix:**

### Step 1: Add aspect ratio to the data model

**File:** `src/services/geminiService.ts`

- Add `aspectRatio?: string` to the `PanelPrompt` interface (line ~19-31)
- Update `generatePanelImage()` to accept an `aspectRatio` parameter:
  ```typescript
  export const generatePanelImage = async (
    prompt: string,
    style: string,
    referenceImages?: string[],
    styleReferenceImage?: string,
    aspectRatio: string = "16:9",    // new param with default
  ): Promise<string | null> => {
  ```
- Use the passed `aspectRatio` in the config instead of the hardcoded value (line 173)

### Step 2: Add aspect ratio selector UI to Director

**File:** `src/screens/DirectorScreen.tsx`

- Add `aspectRatio` state to `PanelCard` (default from `panel.aspectRatio || "16:9"`):

  ```typescript
  const [aspectRatio, setAspectRatio] = useState(panel.aspectRatio || "16:9");
  ```

- Add a dropdown in the settings grid (next to Camera Angle and Mood — make it a 3-column grid or add a new row):

  ```tsx
  <div className="space-y-1">
    <label className="font-label text-[9px] text-accent/50 uppercase tracking-widest font-bold">
      Aspect Ratio
    </label>
    <select
      value={aspectRatio}
      onChange={(e) => setAspectRatio(e.target.value)}
      className="w-full bg-background text-accent text-xs py-2 px-3 rounded-lg border border-outline/20 outline-none focus:border-primary appearance-none"
    >
      <option value="1:1">1:1 Square</option>
      <option value="16:9">16:9 Wide</option>
      <option value="9:16">9:16 Portrait</option>
      <option value="4:3">4:3 Standard</option>
      <option value="3:4">3:4 Tall</option>
    </select>
  </div>
  ```

- Update the panel image display container to reflect the chosen aspect ratio instead of the hardcoded `isWide` logic:

  ```typescript
  // Replace the isWide-based aspect class:
  const aspectClass =
    {
      "1:1": "aspect-square",
      "16:9": "aspect-video",
      "9:16": "aspect-[9/16]",
      "4:3": "aspect-[4/3]",
      "3:4": "aspect-[3/4]",
    }[aspectRatio] || "aspect-video";
  ```

- Pass `aspectRatio` to `generatePanelImage()` in `handleGenerate`
- Include `aspectRatio` in the `onUpdatePanel` call so it persists

### Step 3: Update grid layout for variable aspect ratios

**File:** `src/screens/DirectorScreen.tsx`

- Replace the `isWide` column span logic with aspect-ratio-aware spans:
  ```typescript
  const colSpan = ["16:9", "21:9"].includes(aspectRatio)
    ? "lg:col-span-8"
    : "lg:col-span-4";
  ```

**Test:**

- Open Director, select "1:1 Square" on a panel → generate → image should be square
- Select "9:16 Portrait" → generate → image should be tall
- Aspect ratio should persist when switching tabs and coming back
- Verify the panel card layout adjusts to show tall panels properly

---

## Fix 3: Generate All Panels in Queue

**Problem:** Users must click "Generate" on each panel individually and wait for it to finish before starting the next. There's no way to queue up all panels and let them generate in succession.

**Root Cause:** Each `PanelCard` manages its own `isGenerating` state independently. There's no coordination between cards and no "Generate All" action.

**Fix:**

### Step 1: Add generation queue to DirectorScreen

**File:** `src/screens/DirectorScreen.tsx`

- Add queue state to the parent `DirectorScreen` component:

  ```typescript
  const [generationQueue, setGenerationQueue] = useState<string[]>([]); // panel IDs
  const [currentlyGenerating, setCurrentlyGenerating] = useState<string | null>(
    null,
  );
  ```

- Add a "Generate All" button in the Director header (next to "Continue to Dialogue"):

  ```tsx
  <button
    onClick={handleGenerateAll}
    disabled={generationQueue.length > 0}
    className="flex items-center justify-center gap-2 bg-primary text-background px-6 py-4 rounded-lg font-headline font-bold tracking-tight hover:opacity-90 active:scale-95 transition-all"
  >
    <Sparkles size={18} />
    {generationQueue.length > 0
      ? `GENERATING ${panels.length - generationQueue.length}/${panels.length}...`
      : "GENERATE ALL"}
  </button>
  ```

- Implement `handleGenerateAll`:
  ```typescript
  const handleGenerateAll = () => {
    // Queue all panels that don't have images yet (or all panels if user wants to regenerate)
    const panelIds = panels
      .filter((p) => !p.image) // only panels without images
      .map((p) => p.id);
    if (panelIds.length === 0) {
      // If all have images, regenerate all
      setGenerationQueue(panels.map((p) => p.id));
    } else {
      setGenerationQueue(panelIds);
    }
  };
  ```

### Step 2: Process the queue sequentially

**File:** `src/screens/DirectorScreen.tsx`

- Add a `useEffect` that processes the queue one at a time:

  ```typescript
  useEffect(() => {
    if (generationQueue.length === 0 || currentlyGenerating) return;

    const nextId = generationQueue[0];
    setCurrentlyGenerating(nextId);

    const panel = panels.find((p) => p.id === nextId);
    if (!panel) {
      // Skip invalid panel, move to next
      setGenerationQueue((prev) => prev.slice(1));
      setCurrentlyGenerating(null);
      return;
    }

    // Trigger generation for this panel
    const generate = async () => {
      try {
        const imageUrl = await generatePanelImage(
          panel.description,
          `${panel.cameraAngle || "Cinematic 35mm"}, ${panel.mood || "Cyberpunk Neon"}, Heavy Inks, High Contrast`,
          // ... character refs, style ref (same logic as PanelCard.handleGenerate)
        );
        if (imageUrl) {
          handleUpdatePanel(panels.indexOf(panel), {
            ...panel,
            image: imageUrl,
          });
        }
      } catch (err) {
        console.error(`Failed to generate panel ${nextId}:`, err);
      } finally {
        setGenerationQueue((prev) => prev.slice(1));
        setCurrentlyGenerating(null);
      }
    };

    generate();
  }, [generationQueue, currentlyGenerating]);
  ```

### Step 3: Show queue status on individual PanelCards

**File:** `src/screens/DirectorScreen.tsx`

- Pass `isQueued` and `isQueueGenerating` props to PanelCard:

  ```typescript
  <PanelCard
    ...
    isQueued={generationQueue.includes(panel.id)}
    isQueueGenerating={currentlyGenerating === panel.id}
  />
  ```

- In PanelCard, show a queue indicator badge:

  ```tsx
  {
    isQueued && !isQueueGenerating && (
      <div className="absolute top-4 right-4 bg-secondary/90 text-background px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">
        Queued
      </div>
    );
  }
  {
    isQueueGenerating && (
      <div className="absolute top-4 right-4 bg-primary/90 text-background px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
        <Loader2 size={10} className="animate-spin" /> Generating...
      </div>
    );
  }
  ```

- Disable the individual "Generate" button when the panel is queued

### Step 4: Cancel queue

- Add a cancel button that appears when queue is active:
  ```tsx
  {
    generationQueue.length > 0 && (
      <button
        onClick={() => {
          setGenerationQueue([]);
          setCurrentlyGenerating(null);
        }}
        className="text-red-500 text-xs font-bold uppercase tracking-widest"
      >
        Cancel Queue
      </button>
    );
  }
  ```

**Test:**

- Click "Generate All" with 4-6 panels → panels should generate one by one
- Progress indicator should update as each panel completes
- Individual panels should show "Queued" → "Generating..." → image appears
- Cancel mid-queue → remaining panels should stop
- Individual generate buttons should still work when no queue is active
- Verify state persists (generated images saved to localStorage via usePersistedState)

---

## Execution Order

| #   | Fix                    | Files Modified                           | Complexity |
| --- | ---------------------- | ---------------------------------------- | ---------- |
| 1   | Image cutoff in editor | `EditorScreen.tsx`                       | Low        |
| 2   | Aspect ratio selection | `geminiService.ts`, `DirectorScreen.tsx` | Medium     |
| 3   | Generate all queue     | `DirectorScreen.tsx`                     | Medium     |

Do these in order — Fix 1 is standalone, Fix 2 changes the data model that Fix 3 uses.
