# Vault Asset Generation — Style Picker

## Problem

When generating reference images for vault assets (characters, environments, props, vehicles), the prompt always defaults to "comic book art style." Users have no control over the visual style of generated references, even though their comic might be manga, pixel art, watercolor, etc.

The character reference image defines the style of the entire comic (per our style simplification). If the generated reference doesn't match the user's intended style, every panel generated from it will be off.

## Solution

Add a **style picker** to the vault entry creation/edit modal. The user selects a style before hitting "Generate," and that style gets injected into the generation prompt.

---

## Style List

### Core Styles

| Style              | Prompt Fragment                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **American Comic** | Bold ink outlines, flat cel-shading, vibrant saturated colors, classic American comic book style (Marvel/DC)          |
| **Manga**          | Clean black ink lines, screentone shading, large expressive eyes, Japanese manga style                                |
| **European BD**    | Ligne claire, even line weight, flat colors with subtle shading, Franco-Belgian bande dessinée style (Tintin/Moebius) |
| **Cartoon**        | Rounded shapes, thick outlines, bright colors, exaggerated proportions, Saturday morning cartoon style                |
| **Pixel Art**      | Low-resolution pixel art, limited color palette, clean pixel edges, retro game sprite style                           |
| **Watercolor**     | Soft watercolor washes, visible paper texture, loose brushwork, muted natural palette                                 |
| **Noir**           | High contrast black and white, heavy shadows, minimal midtones, film noir ink wash style                              |
| **Realistic**      | Photorealistic rendering, accurate proportions, natural lighting, digital painting                                    |
| **Chibi**          | Super-deformed proportions, oversized head, tiny body, cute simplified features, chibi anime style                    |
| **Sketch**         | Loose pencil lines, visible construction marks, unfinished feel, concept art sketchbook style                         |
| **Pop Art**        | Bold primary colors, Ben-Day dots, thick black outlines, Roy Lichtenstein pop art style                               |
| **Woodcut**        | Bold black woodcut lines, stark contrast, rough texture, vintage printmaking style                                    |
| **Flat Vector**    | Clean vector shapes, no outlines, flat colors, geometric simplification, modern illustration style                    |
| **Storybook**      | Soft pastel colors, gentle shading, whimsical proportions, children's book illustration style                         |
| **Grunge**         | Rough textures, distressed edges, muted desaturated palette, underground comics aesthetic                             |

### How They Map to Prompts

Current prompt (Character example):

```
Character reference sheet — front-facing portrait of {name}. {description}.
Style: Clean character design reference, simple background, full color, detailed, comic book art style.
```

With style picker:

```
Character reference sheet — front-facing portrait of {name}. {description}.
Style: Clean character design reference, simple background. {SELECTED_STYLE_PROMPT}.
```

---

## UI Design

### In the Vault Entry Modal

Add a style selector between the name input and the Generate button.

```
┌─────────────────────────────────────┐
│  Name: [ Captain Nova            ]  │
│                                     │
│  Style:                             │
│  ┌─────────┐ ┌─────────┐ ┌──────┐  │
│  │ American│ │  Manga  │ │ Euro │  │
│  │  Comic  │ │         │ │  BD  │  │
│  └─────────┘ └─────────┘ └──────┘  │
│  ┌─────────┐ ┌─────────┐ ┌──────┐  │
│  │ Cartoon │ │  Pixel  │ │Water │  │
│  │         │ │   Art   │ │color │  │
│  └─────────┘ └─────────┘ └──────┘  │
│  ...                                │
│                                     │
│  [ Upload ]  [ Generate ]           │
└─────────────────────────────────────┘
```

- **Grid of pill buttons** — 3 columns, scrollable if needed
- Selected style highlighted with primary color
- Defaults to **American Comic** (matches current behavior)
- Style selection is **required** for Generate, not for Upload (uploaded images carry their own style)

### Persistence

- Store `style` on `VaultEntry` interface (optional field for backward compat)
- When generating panels, the selected style from the character reference naturally carries through (the reference image IS the style)
- Style is informational metadata — not sent to panel generation (the image does that job)

---

## Implementation

### 1. Add style constant

```typescript
export const VAULT_STYLES = [
  {
    id: "american-comic",
    name: "American Comic",
    prompt:
      "Bold ink outlines, flat cel-shading, vibrant saturated colors, classic American comic book style",
  },
  {
    id: "manga",
    name: "Manga",
    prompt:
      "Clean black ink lines, screentone shading, large expressive eyes, Japanese manga style",
  },
  {
    id: "european-bd",
    name: "European BD",
    prompt:
      "Ligne claire, even line weight, flat colors with subtle shading, Franco-Belgian bande dessinée style",
  },
  {
    id: "cartoon",
    name: "Cartoon",
    prompt:
      "Rounded shapes, thick outlines, bright colors, exaggerated proportions, cartoon style",
  },
  {
    id: "pixel-art",
    name: "Pixel Art",
    prompt:
      "Low-resolution pixel art, limited color palette, clean pixel edges, retro game sprite style",
  },
  {
    id: "watercolor",
    name: "Watercolor",
    prompt:
      "Soft watercolor washes, visible paper texture, loose brushwork, muted natural palette",
  },
  {
    id: "noir",
    name: "Noir",
    prompt:
      "High contrast black and white, heavy shadows, minimal midtones, film noir ink wash style",
  },
  {
    id: "realistic",
    name: "Realistic",
    prompt:
      "Photorealistic rendering, accurate proportions, natural lighting, digital painting",
  },
  {
    id: "chibi",
    name: "Chibi",
    prompt:
      "Super-deformed proportions, oversized head, tiny body, cute simplified features, chibi anime style",
  },
  {
    id: "sketch",
    name: "Sketch",
    prompt:
      "Loose pencil lines, visible construction marks, unfinished feel, concept art sketchbook style",
  },
  {
    id: "pop-art",
    name: "Pop Art",
    prompt:
      "Bold primary colors, Ben-Day dots, thick black outlines, pop art style",
  },
  {
    id: "woodcut",
    name: "Woodcut",
    prompt:
      "Bold black woodcut lines, stark contrast, rough texture, vintage printmaking style",
  },
  {
    id: "flat-vector",
    name: "Flat Vector",
    prompt:
      "Clean vector shapes, no outlines, flat colors, geometric simplification, modern illustration style",
  },
  {
    id: "storybook",
    name: "Storybook",
    prompt:
      "Soft pastel colors, gentle shading, whimsical proportions, children's book illustration style",
  },
  {
    id: "grunge",
    name: "Grunge",
    prompt:
      "Rough textures, distressed edges, muted desaturated palette, underground comics aesthetic",
  },
] as const;
```

### 2. Update `VaultEntry` interface

```typescript
export interface VaultEntry {
  id: string;
  type: VaultCategory;
  name: string;
  image: string;
  description: string;
  personality?: string;
  visualLook?: string;
  style?: string; // id from VAULT_STYLES
}
```

### 3. Update `generateReferenceImage`

```typescript
export const generateReferenceImage = async (
  name: string,
  description: string,
  visualLook: string,
  type: VaultCategory,
  stylePrompt: string,  // new param
  existingStyleRef?: string,
): Promise<string | null> => {
  // Replace hardcoded "comic book art style" with stylePrompt
  ...
};
```

### 4. Add style picker UI to VaultScreen modal

- Grid of selectable pills
- State: `const [selectedStyle, setSelectedStyle] = useState("american-comic")`
- Pass style prompt to `generateReferenceImage`
- Save style id on the vault entry

---

## Files to Change

| File                                    | Changes                                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/screens/VaultScreen.tsx`           | Add style picker grid to entry modal, pass style to generate call, save style on entry |
| `src/services/geminiService.ts`         | Update `generateReferenceImage` to accept style prompt parameter                       |
| Constants file or inline in VaultScreen | Add `VAULT_STYLES` array                                                               |

---

## What This Does NOT Do

- Does not affect panel generation prompts (the reference image carries the style visually)
- Does not retroactively change existing vault entries (they just won't have a `style` field)
- Does not add style preview thumbnails (could be a future enhancement — show a tiny sample image per style)
- Does not force a style on uploaded images (upload bypasses the style picker)
