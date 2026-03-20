# Style Adherence Exploration

## The Problem

When a user selects "Pixel Art" as the art style but has a cartoon-style character reference image attached, the generated image comes out in the cartoon style of the reference — not pixel art. The text instruction "Art Style: Pixel Art" gets overridden by the visual weight of the reference image.

This is a fundamental behavior of image generation models: **visual references dominate text instructions**. The model sees a cartoon image and thinks "this is the style they want" regardless of what the text says.

## Why It Happens

The current prompt structure sends:

```
The art style should be Pixel Art — use this as guidance alongside the style reference image.
Subject: A bald bearded man at his desk...
CRITICAL: Match the exact artistic style of the character reference images.
```

Plus an inline cartoon image of the character.

The model receives two conflicting signals:

1. **Text:** "Pixel Art"
2. **Image:** A bold-outline cartoon character

The image always wins because the model treats attached images as the strongest signal for visual style.

## The Core Tension

Users want TWO things simultaneously:

1. **Character consistency** — the character should look like their reference
2. **Style freedom** — they should be able to change the art style

These are fundamentally at odds when using a single generation call with both the character ref and a style instruction.

---

## Approach Options

### Option A: Two-Pass Generation

**How:** Generate in two steps:

1. **Pass 1:** Generate the scene in the chosen art style (Pixel Art) WITHOUT any character reference images. Just describe the character in text.
2. **Pass 2:** (Optional) Use the result from Pass 1 as a style reference, and regenerate with character details reinforced.

**Pros:**

- Pass 1 has no visual reference to override the style
- The text description of the character (from the character's description field) guides likeness
- Style is guaranteed since there's no competing image

**Cons:**

- Character likeness depends entirely on the text description quality
- Two API calls = 2x cost and time
- Pass 2 might drift the style back toward the reference

**Verdict:** Good for style adherence, weak for character consistency.

---

### Option B: Separate Style from Character in the Prompt

**How:** When the user picks a non-matching style (e.g., Pixel Art but cartoon reference), adjust the prompt to explicitly tell the model to **only use the reference for character features, NOT style**:

```
IMPORTANT: The attached character reference image is ONLY for facial features,
body type, clothing, and distinguishing marks. Do NOT copy the art style of
the reference image. Instead, render everything in [Pixel Art] style:
blocky pixels, limited color palette, retro 8-bit aesthetic.
```

**Pros:**

- Single pass, no extra cost
- Explicit instruction separation
- May work well enough with strong models

**Cons:**

- Models don't always obey this — visual signals still leak through
- Effectiveness varies by model and prompt complexity
- "Don't copy the style" is a negative instruction (models are worse at negatives)

**Verdict:** Cheapest to implement, works ~60-70% of the time.

---

### Option C: Style Reference Image Library

**How:** For each art style option (Pixel Art, Manga, Watercolor, etc.), include a pre-made example image in that style. Send BOTH the style example AND the character reference, with clear instructions:

```
Two reference images are attached:
1. STYLE REFERENCE (first image): Copy THIS art style exactly — pixel art, blocky,
   limited palette, retro aesthetic.
2. CHARACTER REFERENCE (second image): Copy THIS character's face, body, clothing.
   But render them in the style of image 1, NOT image 2.
```

**Pros:**

- Visual style reference competes with character reference (stronger signal than text alone)
- User gets both style and character consistency
- Pre-made style samples can be high quality and curated

**Cons:**

- Need to create/curate style reference images for each option
- Three images in context = higher token cost
- Model might blend the two styles instead of picking one
- More storage/bandwidth for the style library

**Verdict:** Best quality, medium effort. Worth it.

---

### Option D: Describe, Don't Show (Text-Only Characters)

**How:** When the user picks a style that differs from their reference image style, DON'T send the character reference image at all. Instead, send only the character's text description:

```
Art Style: Pixel Art — blocky pixels, limited color palette, retro 8-bit aesthetic.
Character: A bald man with thick scruffy brown beard, light skin, intense scowl,
light blue t-shirt, blue tattoos on both forearms, big ears, heavy brow, stocky build.
```

**Pros:**

- No visual reference to override the style
- Text descriptions are already stored for each character
- Zero extra cost
- Style is guaranteed

**Cons:**

- Character likeness depends on description quality
- Subtle features (exact face shape, specific tattoo patterns) are hard to describe in text
- Less consistent than image references

**Verdict:** Simple, effective for style adherence, trades off character precision.

---

### Option E: "Style Lock" Toggle (User Controls the Tradeoff)

**How:** Give the user explicit control over what they're prioritizing:

- **"Match Reference Style"** (default) — sends character ref images, style follows the reference
- **"Override Style"** — sends ONLY text descriptions of characters, applies the chosen art style fully

UI: A toggle or segmented control in the panel card:

```
Style Priority: [Reference] [Art Style]
```

When set to "Art Style":

- Character references are NOT sent as images
- Character text descriptions ARE sent in the prompt
- The chosen art style (Pixel Art, Manga, etc.) fully controls the output

When set to "Reference":

- Character reference images ARE sent
- Art style dropdown is dimmed/ignored
- Output matches the reference image's visual style

**Pros:**

- User understands the tradeoff and makes the choice
- No magic — transparent behavior
- Works 100% of the time because there's no conflict
- Zero extra cost or complexity

**Cons:**

- Adds UI complexity
- Users might not understand why they can't have both
- Feels like a limitation (even though it IS one)

**Verdict:** Most honest and reliable approach.

---

## Recommendation

**Implement Option E (Style Lock toggle) + Option B (prompt separation) as a fallback.**

### Why:

1. **Option E** is the honest answer. The user decides: "Do I want my characters to look exactly like the reference, or do I want full control over art style?" This is a real tradeoff that exists in all image generation — we shouldn't pretend it doesn't.

2. **Option B** as the default when both are active — try to instruct the model to separate style from character features. It works often enough to be the default, and when it doesn't, the user can flip the toggle.

### Implementation:

Add a `stylePriority` field to `PanelPrompt`: `"reference" | "artStyle"`

- Default: `"reference"` (current behavior — reference images sent, style follows them)
- When `"artStyle"`: character images are excluded, only text descriptions sent, art style fully controls output

UI: In the panel card, below the art style dropdown:

```
[Character Look] ←→ [Art Style]
```

A simple toggle/slider showing what's being prioritized.

### Files to change:

| File                                 | Change                                                             |
| ------------------------------------ | ------------------------------------------------------------------ |
| `PanelPrompt` interface              | Add `stylePriority?: "reference" \| "artStyle"`                    |
| `DirectorScreen.tsx` PanelCard       | Add toggle UI, wire to state                                       |
| `DirectorScreen.tsx` queue processor | Conditionally exclude charRefs when `stylePriority === "artStyle"` |
| `api/generate-image.ts`              | No changes needed — it already handles empty referenceImages       |
