# AI Character Reference Generation

## Problem

Creating a new vault entry (character, prop, vehicle, environment) currently requires uploading a reference image. But many users don't have artwork ready — they have a description in their head and want the AI to create the reference for them.

This is especially painful for new users on the Workshop screen. They write a story, describe characters in text, but have no images. They either:

- Skip adding references (hurting generation consistency)
- Leave the app to generate images elsewhere
- Use random photos that don't match their vision

## Current State

- **VaultScreen**: New entry form requires `name` + `image` (submit disabled without image)
- **WorkshopScreen**: Has a basic `handleAddCharacter` that accepts a file upload, creates entry with default name/description
- **geminiService.ts**: Has `generatePanelImage()` which can generate any image from a prompt + references
- **geminiService.ts**: Has `analyzeCharacterImage()` which describes a character from an image (useful for the reverse — getting a description from a generated image)
- **API**: `/api/generate-image` accepts prompt + referenceImages + aspectRatio

## Proposed Solution

Add a "Generate with AI" button alongside "Upload Image" in two places:

1. **VaultScreen** — in the new entry modal, next to the image upload area
2. **WorkshopScreen** — when adding a new character (optional, lower priority)

When tapped, the AI generates a reference image from the entry's name, description, and visualLook fields.

## Design

### Vault Modal — Generate Reference Image

```
┌──────────────────────────────────────┐
│  ┌──────────────────────────────┐    │
│  │                              │    │
│  │     [character image         │    │
│  │      or placeholder]         │    │
│  │                              │    │
│  │  ┌──────────┐ ┌───────────┐  │    │
│  │  │ UPLOAD   │ │ GENERATE  │  │    │
│  │  └──────────┘ └───────────┘  │    │
│  └──────────────────────────────┘    │
│                                      │
│  Name: [____________________]        │
│  Type: [Character ▼]                 │
│  Description: [______________]       │
│  Visual Look: [______________]       │
│                                      │
│        [CREATE VAULT ENTRY]          │
└──────────────────────────────────────┘
```

### Generation Prompt Construction

Build a prompt from the form fields, tailored to the asset type:

**Character:**

```
Character reference sheet — front-facing portrait of [name].
[description]
Visual details: [visualLook]
Style: Clean character design reference, white/simple background,
full color, detailed, comic book art style.
Do NOT include any text, labels, or speech bubbles.
```

**Environment:**

```
Environment concept art — [name].
[description]
Visual details: [visualLook]
Style: Wide establishing shot, detailed background art, comic book style.
No characters or figures. No text.
```

**Prop:**

```
Object reference — [name].
[description]
Visual details: [visualLook]
Style: Clean product-shot style, simple background, detailed,
comic book art style. No people, no hands. No text.
```

**Vehicle:**

```
Vehicle reference — [name].
[description]
Visual details: [visualLook]
Style: Three-quarter view, clean background, detailed mechanical design,
comic book art style. No people, no drivers. No text.
```

### Aspect Ratio by Type

- **Character**: `3:4` (portrait orientation)
- **Environment**: `16:9` (wide landscape)
- **Prop**: `1:1` (square, product-shot style)
- **Vehicle**: `4:3` (landscape, showing full vehicle)

## Implementation

### Files to Modify

1. **`src/screens/VaultScreen.tsx`** — Add generate button + handler in the entry modal
2. **`src/services/geminiService.ts`** — Add `generateReferenceImage()` function (thin wrapper around `generatePanelImage` with type-specific prompts)

### New Service Function

```typescript
// geminiService.ts
export const generateReferenceImage = async (
  name: string,
  description: string,
  visualLook: string,
  type: "Character" | "Environment" | "Prop" | "Vehicle",
  existingStyleRef?: string, // optional: style reference from another vault entry
): Promise<string | null> => {
  const prompts: Record<string, string> = {
    Character: `Character reference sheet — front-facing portrait of ${name}. ${description}. ${visualLook ? `Visual details: ${visualLook}.` : ""} Style: Clean character design reference, simple background, full color, detailed, comic book art style. Do NOT include any text, labels, or speech bubbles.`,
    Environment: `Environment concept art — ${name}. ${description}. ${visualLook ? `Visual details: ${visualLook}.` : ""} Style: Wide establishing shot, detailed background art, comic book style. No characters or figures. No text.`,
    Prop: `Object reference — ${name}. ${description}. ${visualLook ? `Visual details: ${visualLook}.` : ""} Style: Clean product-shot, simple background, detailed, comic book art style. No people, no hands. No text.`,
    Vehicle: `Vehicle reference — ${name}. ${description}. ${visualLook ? `Visual details: ${visualLook}.` : ""} Style: Three-quarter view, clean background, detailed mechanical design, comic book art style. No people, no drivers. No text.`,
  };

  const aspectRatios: Record<string, string> = {
    Character: "3:4",
    Environment: "16:9",
    Prop: "1:1",
    Vehicle: "4:3",
  };

  const refs = existingStyleRef ? [existingStyleRef] : undefined;
  return generatePanelImage(prompts[type], refs, aspectRatios[type]);
};
```

### Vault Modal Changes

```tsx
const [isGenerating, setIsGenerating] = useState(false);

const handleGenerateImage = async () => {
  if (!formData.name || !formData.description) {
    alert("Add a name and description first so the AI knows what to generate.");
    return;
  }
  setIsGenerating(true);
  try {
    const image = await generateReferenceImage(
      formData.name,
      formData.description || "",
      formData.visualLook || "",
      formData.type as VaultCategory,
    );
    if (image) {
      setFormData((prev) => ({ ...prev, image }));
    }
  } catch {
    alert("Generation failed. Check your API key in Settings.");
  }
  setIsGenerating(false);
};
```

**Button in the image area** (next to or below the upload trigger):

```tsx
<button
  onClick={handleGenerateImage}
  disabled={isGenerating || !formData.name}
  className="...primary button styles..."
>
  {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
  {isGenerating ? "Generating..." : "Generate with AI"}
</button>
```

### Workshop Screen (Lower Priority)

The Workshop already has `handleAddCharacter` for file upload. A parallel "Generate Character" flow would:

1. Show a small modal/bottom sheet asking for name + description
2. Call `generateReferenceImage(name, description, "", "Character")`
3. Create the vault entry with the generated image
4. Auto-select it for the story

This is lower priority since users can do this from the Vault screen. But having it inline on Workshop reduces friction for first-time users.

## UX Flow

1. User taps "+" in World Vault
2. Fills in name, type, description, visual look
3. Taps "Generate with AI" in the image area
4. Loading spinner shows (takes ~5-15 seconds)
5. Generated image appears in the preview
6. User can regenerate (tap again) or upload their own instead
7. User taps "Create Vault Entry" to save

## What This Does NOT Do

- No multi-view generation (front/side/back turnaround sheets)
- No style transfer from existing vault entries (future enhancement — pass a style ref)
- No editing the generated image (crop, adjust, etc.)
- No automatic character consistency (each generation is independent)

## Edge Cases

| Scenario                            | Behavior                                                              |
| ----------------------------------- | --------------------------------------------------------------------- |
| Generate without name               | Button disabled, tooltip: "Add a name first"                          |
| Generate without description        | Works but results may be generic — name alone gives some direction    |
| Generate fails (API error)          | Alert with "check API key" message, image area unchanged              |
| Generate then upload                | Upload replaces generated image — last action wins                    |
| Regenerate (tap again)              | New image replaces previous — no undo                                 |
| Style reference from existing entry | Future: pass another vault entry's image as style ref for consistency |

## Future Enhancements

- **Style consistency**: Pass the style reference image from another vault entry so all characters match the same art style
- **Turnaround sheets**: Generate multiple views (front, side, back) in a single image
- **Auto-describe**: After generating, run `analyzeCharacterImage()` to auto-fill the description field from the generated image (useful when user provides minimal description)
- **Workshop inline generation**: Quick character creation flow on the first screen
