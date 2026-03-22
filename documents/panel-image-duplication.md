# Panel Image Duplication

## Problem

Users sometimes want the same image on multiple panels — for example:

- Using a generated panel as a template to create variations
- Copying a good result to another panel before tweaking the description and regenerating
- Repeating a background shot across panels (establishing shot reuse)
- Splitting a single image across multiple panels for a cinematic spread effect

Currently the only way is to download the image and re-upload it to another panel. That's 4+ taps and friction.

## Options

### Option A: "Copy Image" → "Paste Image" on Panel Cards (Director)

Add a "Copy" action to each panel card. When copied, a "Paste" button appears on empty panels (or as a third option alongside Generate/Upload).

**Flow:**

1. Long-press or tap menu on a panel → "Copy Image"
2. App stores the copied image reference in state
3. Other panels show a "Paste" button
4. Tap Paste → image appears on that panel

**Pros:**

- Familiar copy/paste mental model
- Works across pages
- Minimal UI — just two buttons

**Cons:**

- Two-step process
- Need to show "Paste available" state somehow
- Copy state needs to persist while scrolling between panels

---

### Option B: "Duplicate to..." Dropdown

Tap a button on a panel → shows a dropdown/modal listing all other panels. Pick one → image is copied there.

**Flow:**

1. Tap duplicate icon on panel with image
2. Modal shows: "Copy to Panel 2 / Panel 3 / Panel 4..."
3. Tap target → done

**Pros:**

- One-step after tapping the button
- Clear about where the image goes
- Can preview target panels

**Cons:**

- Modal/dropdown adds UI complexity
- Listing all panels could be long for 6+ panel comics

---

### Option C: Drag-and-Drop Between Panels

Drag an image from one panel to another. The source keeps its image, the target gets a copy.

**Pros:**

- Most intuitive gesture
- Visual and direct

**Cons:**

- Hard to implement on mobile (drag between elements)
- Conflicts with existing panel drag-to-reposition
- Complex touch handling

---

### Option D: Simple "Copy to Next Empty" Button

One button per panel: "Copy to next empty panel." Finds the first panel without an image and copies there.

**Pros:**

- One tap
- Zero decisions
- Simplest implementation

**Cons:**

- No control over which panel gets the copy
- Doesn't work if all panels have images
- Not useful for specific panel targeting

---

## Recommendation: Option A (Copy/Paste)

Simplest UX with most flexibility:

1. Add a **copy icon** (clipboard) next to the existing download/upload icons on each panel card that has an image
2. Tapping it stores the image in a `copiedImage` state
3. A subtle toast: "Image copied — tap Paste on any panel"
4. Empty panels show **[Generate] [Upload] [Paste]** buttons
5. Panels with images show a small **paste icon** in the top-right (alongside download/upload) when a copied image is available
6. Pasting clears the copied state

### Implementation

```tsx
// In DirectorScreen
const [copiedImage, setCopiedImage] = useState<string | null>(null);
```

**Copy button** (on panels with images, next to download/upload):

```tsx
<button onClick={() => setCopiedImage(panel.image)} title="Copy image">
  <Copy size={14} />
</button>
```

**Paste button** (on empty panels, alongside Generate/Upload):

```tsx
{
  copiedImage && (
    <button onClick={() => onUpdatePanel({ ...panel, image: copiedImage })}>
      Paste
    </button>
  );
}
```

**Paste icon** (on panels with images, when copiedImage exists):

```tsx
{
  copiedImage && (
    <button
      onClick={() => onUpdatePanel({ ...panel, image: copiedImage })}
      title="Paste copied image"
    >
      <Clipboard size={14} />
    </button>
  );
}
```

### Files to Change

| File                 | Change                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `DirectorScreen.tsx` | Add `copiedImage` state, copy button on panels with images, paste button on empty panels and as icon on existing panels |

One state variable, three small UI additions. No new components.
