# Custom Panel Image Upload

## Problem

Users can only get panel images through AI generation. There's no way to use your own artwork, photos, or images from other tools as panel images. This is a blocker for:

- Artists who want to draw some panels by hand and generate others
- Users who want to use photos or screenshots as panels
- Users who generated an image externally (Midjourney, DALL-E, etc.) and want to use it
- Users who want to replace a generated image with a hand-drawn version

## Current State

- Panel images (`PanelPrompt.image`) are base64 strings stored in IndexedDB
- The only way to set a panel image is via `generatePanelImage()` in `geminiService.ts`
- The Director screen has an existing file upload pattern for **custom reference images** (`handleFileChange`, `fileInputRef`) but these are references only — they don't become the panel image itself
- The Vault screen has a mature upload flow with FileReader → base64 → preview

## Proposed Solution

Add an "Upload Image" button on each panel card in the Director screen, alongside the Generate button. Tapping it opens a file picker, and the selected image becomes the panel's image.

### UI Changes — DirectorScreen.tsx

**On each PanelCard**, add an upload button next to the Generate button:

```
┌─────────────────────────────────┐
│  [panel image or placeholder]   │
│                                 │
│  [GENERATE]  [UPLOAD]           │
└─────────────────────────────────┘
```

- **Upload button**: Small icon button (Upload icon from lucide) next to Generate
- When clicked: opens `<input type="file" accept="image/*" capture="environment">`
- `capture="environment"` lets mobile users take a photo directly from camera
- On file select: read as base64, compress via the existing `compressImage` utility, set as `panel.image`

### Implementation

**New handler in PanelCard** (inside the `React.memo` component, ~line 448):

```tsx
const uploadInputRef = useRef<HTMLInputElement>(null);

const handleUploadPanelImage = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    alert("Image too large. Please use an image under 10MB.");
    return;
  }
  const reader = new FileReader();
  reader.onloadend = () => {
    onUpdatePanel(index, { ...panel, image: reader.result as string });
  };
  reader.readAsDataURL(file);
};
```

**Upload button in the card UI** (near the Generate button):

```tsx
<button
  onClick={() => uploadInputRef.current?.click()}
  className="...secondary button styles..."
  title="Upload your own image"
>
  <Upload size={14} />
</button>
<input
  type="file"
  ref={uploadInputRef}
  onChange={handleUploadPanelImage}
  className="hidden"
  accept="image/*"
/>
```

### Where to Place It

The Generate button currently lives in the panel card's image area (the placeholder or overlay). The Upload button should sit next to it as a secondary action:

- **No image yet**: Show both `[GENERATE]` and `[UPLOAD]` buttons in the empty state
- **Image exists**: Show the upload button in the hover overlay alongside Regenerate

### File Size Handling

- Max 10MB (generous for photos, PNGs)
- Compress via existing `compressImage()` to JPEG at 0.8 quality before storing
- This keeps IndexedDB storage reasonable

### What This Does NOT Do

- No image editing (crop, resize, filters) — just raw upload
- No drag-and-drop (could be added later, but tap/click is sufficient for mobile-first)
- No URL import (paste a link) — file picker only
- No changes to the Layout or Editor screens — they already display whatever `panel.image` contains

## Edge Cases

| Scenario                        | Behavior                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Upload replaces generated image | Works like regeneration — new image replaces old                                      |
| Upload + existing bubbles       | Bubbles are preserved (they're separate from the image)                               |
| Very large image (8000x8000)    | Compressed to JPEG, but DOM may be slow — consider adding canvas resize to max 2048px |
| Non-image file selected         | `accept="image/*"` prevents this at the OS level                                      |
| Upload during generation queue  | Should work — upload sets image directly, doesn't go through queue                    |

## Future Enhancements

- **Drag and drop** on desktop
- **Paste from clipboard** (Ctrl+V)
- **Camera capture** button (separate from file picker, uses `capture="camera"`)
- **Crop/resize** before setting as panel image
