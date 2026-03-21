# Character Adherence Regression — What Changed

## The Problem

Early versions of the app produced images that closely matched character reference images. Later versions lost some of that adherence. The characters are "pretty good" but not as tight as they were.

## What Was Different (Original vs Now)

### 1. Model Changed

| When     | Model                            | Notes                          |
| -------- | -------------------------------- | ------------------------------ |
| Original | `gemini-3.1-flash-image-preview` | SDK call, direct               |
| Now      | `gemini-3-pro-image-preview`     | REST API, via serverless proxy |

The original used `gemini-3.1-flash-image-preview` which may have had better reference image adherence than `gemini-3-pro-image-preview`. Different models, different strengths.

### 2. SDK vs REST API

| When     | Method                                            | imageConfig                                                                                |
| -------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Original | `@google/genai` SDK `ai.models.generateContent()` | `imageConfig: { aspectRatio, imageSize: "1K" }`                                            |
| Now      | REST API `fetch()` to `/v1beta/models/...`        | `generationConfig: { responseModalities: ["IMAGE","TEXT"], imageConfig: { aspectRatio } }` |

Key differences:

- The SDK handled `imageConfig` as a top-level config field
- The REST API puts it inside `generationConfig`
- We lost `imageSize: "1K"` in the transition — images might be generating at different resolutions
- The SDK may have handled the reference images differently internally

### 3. Prompt Got Weaker

**Original prompt (SDK era):**

```
A cinematic comic book panel.
MANDATORY STYLE ADHERENCE: You MUST strictly replicate the exact artistic style,
brushwork, color palette, and line weight of the provided style reference image.
The output should look like it was drawn by the same artist as the reference.
Subject: [description].
CRITICAL: Do NOT include any speech bubbles, text, or dialogue balloons.
Ensure the characters in the panel match the provided character reference images.
```

The original had:

- "MANDATORY STYLE ADHERENCE" with detailed instructions about brushwork, color palette, line weight
- Style reference image sent FIRST (before character refs)
- "Ensure the characters match the provided character reference images"

**Current prompt (REST era):**

```
A cinematic comic book panel.
Subject: [description].
Characters present: [names and descriptions].
Camera Angle: [angle]. Camera Lens: [lens]. Mood: [mood].
CRITICAL: Match the exact visual style, line work, and coloring of the
attached character reference images.
CRITICAL: Do NOT include any speech bubbles or text in the image.
```

The current version:

- No "MANDATORY STYLE ADHERENCE" — just a single CRITICAL line
- Character TEXT descriptions added (good for identity, but dilutes the visual reference signal)
- Camera/lens/mood instructions compete for attention in the prompt
- Less emphasis on matching the reference images specifically

### 4. Reference Image Order May Matter

The original SDK code explicitly added the style reference image FIRST, then character references:

```ts
// Add style reference first if provided
if (styleReferenceImage) { parts.push(...) }
// Add character references
if (referenceImages) { referenceImages.forEach(...) }
```

The current code just adds character references in order. The model may weight the first image more heavily.

### 5. Added Proxy Latency + Compression

Images now go through:

1. Client → Vercel serverless → Gemini REST API → back to serverless → back to client
2. Then `compressImage()` converts to JPEG at 0.8 quality

The compression shouldn't affect adherence (it's post-generation), but the proxy adds latency which could cause timeouts on complex prompts.

---

## Likely Root Causes (Ranked)

1. **Model change** (`flash-image-preview` → `pro-image-preview`) — different model, different behavior
2. **Weaker prompt** — the original was MUCH more aggressive about style adherence
3. **Lost `imageSize: "1K"`** — might affect how the model processes reference images
4. **Text descriptions competing** — character text descriptions are good for identity but the model may rely on them instead of the images

## Recommended Fixes

### Fix 1: Restore the aggressive reference adherence prompt

Replace the current prompt in `api/generate-image.ts` with stronger language:

```
A cinematic comic book panel.
MANDATORY REFERENCE ADHERENCE: The attached reference images define the
character appearance AND art style. You MUST:
- Replicate the exact artistic style, line work, color palette, and shading
- Match each character's face, body type, clothing, and distinguishing features exactly
- The output MUST look like it was drawn by the same artist as the references

Subject: [description].
Characters present: [context].
[camera/lens/mood]

CRITICAL: Do NOT include any speech bubbles or text.
```

### Fix 2: Add `imageSize: "1K"` back to the REST API call

In `geminiImage()` function in each API route, the `imageConfig` should include `imageSize`:

```ts
generationConfig: {
  responseModalities: ["IMAGE", "TEXT"],
  imageConfig: { aspectRatio, imageSize: "1K" }
}
```

### Fix 3: Try the original model

Test with `gemini-3.1-flash-image-preview` again — it might have been the better model for reference adherence. The reason we switched was quota issues, not quality.

### Fix 4: Put reference images FIRST in the parts array

Move character reference images before the text prompt. Models tend to weight earlier parts more heavily:

```ts
const parts = [
  ...referenceImageParts, // images FIRST
  { text: promptText }, // text SECOND
];
```

### Implementation Priority

1. Fix 4 (image order) — free, immediate
2. Fix 1 (stronger prompt) — free, immediate
3. Fix 2 (imageSize) — free, immediate
4. Fix 3 (model) — test both, pick the better one
