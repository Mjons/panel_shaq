# Vault Reference Exploration

## Question

When a character or asset from the World Vault is mentioned, does the system actually use the full character card — image, description, traits — or just the name?

## Answer: Partially

The system does more than just pass names, but it's not using everything on the card. Here's what actually happens today versus what's available.

---

## What a Vault Entry Has

```typescript
interface VaultEntry {
  id: string;
  type: "Character" | "Environment" | "Prop" | "Vehicle";
  name: string;
  image: string; // base64 reference image
  description: string; // visual description
  personality?: string; // lore, behavior, traits
  visualLook?: string; // detailed visual breakdown
  style?: string; // art style (used for vault image generation only)
}
```

## What Actually Gets Sent to Image Generation

| Field           | Sent? | How                                                                             |
| --------------- | ----- | ------------------------------------------------------------------------------- |
| **name**        | Yes   | Included in text prompt: `"Characters present: Commander Vex: tall soldier..."` |
| **description** | Yes   | Appended after name in prompt text                                              |
| **image**       | Yes   | Sent as base64 reference image to Gemini (weighted heavily — images go first)   |
| **personality** | NO    | Never sent to image generation                                                  |
| **visualLook**  | NO    | Never sent to image generation                                                  |
| **style**       | NO    | Only used when generating the vault entry's own image                           |

### Characters

- Image sent as reference
- `"${name}: ${description}"` added to prompt
- **personality and visualLook are ignored** — Gemini never sees them

### Environments/Backgrounds

- Image sent as reference
- Description added with a note: `"IMPORTANT: The background reference image is for the ENVIRONMENT ONLY — ignore any people, characters, or figures visible in it."`

### Props

- Image sent as reference
- `"Props in scene: Coffee Cup (white ceramic), Desk (wooden)"`

### Vehicles

- Image sent as reference
- `"Vehicles in scene: Hovercar (sleek red sports vehicle)"`

---

## What Happens in the Story (Workshop)

When the user writes a story mentioning a character name, the system does something smart:

1. **Detects character mentions** by matching names (case-insensitive) in the story text
2. **Anchors them** — replaces `"Commander Vex"` with `"[CHARACTER: Commander Vex — tall soldier with cybernetic arm]"` in the story
3. **Sends anchored story** to the panel generation API, which uses descriptions to figure out which characters appear in which panels

But again — only `name` and `description` are used. Personality and visualLook are left on the table.

---

## The Gap

### What's Being Wasted

1. **`personality`** — Could inform character expression, body language, posture. A "nervous, fidgety" character should look different from a "confident, commanding" one even in a static panel.

2. **`visualLook`** — This is the most obvious miss. Users fill out detailed visual traits (scars, tattoos, specific clothing, eye color) and none of it reaches the image generator. It goes straight in the text prompt as part of the description, but `visualLook` as a separate field is ignored.

3. **Cross-panel consistency** — The reference image helps, but without sending `visualLook` details, Gemini doesn't know about specific features that might not be visible in the single reference image (e.g., a scar on the left cheek, but the reference shows the right side).

### What's Working Well

1. **Reference images are sent first** — Gemini weights earlier content more heavily, so the visual reference is the strongest signal. This is the right architecture.

2. **Story anchoring is clever** — Automatically detecting character mentions and enriching them with descriptions means the user doesn't have to manually specify which characters are in each panel from the story side.

3. **Background isolation instruction** — The prompt explicitly tells Gemini to ignore people in background reference images. Smart.

4. **5-image reference limit** — Reasonable constraint. Characters + background + props can share the budget.

---

## Recommendations

### Quick Win: Send visualLook and personality

In `DirectorScreen.tsx` where the character context is built:

**Current:**

```typescript
const characterContext = selectedChars
  .map((c) => `${c.name}: ${c.description || ""}`)
  .join(". ");
```

**Should be:**

```typescript
const characterContext = selectedChars
  .map((c) => {
    let ctx = `${c.name}: ${c.description || ""}`;
    if (c.visualLook) ctx += `. Visual details: ${c.visualLook}`;
    if (c.personality) ctx += `. Personality/demeanor: ${c.personality}`;
    return ctx;
  })
  .join(". ");
```

This is a one-line-ish change that immediately makes every character more detailed in generation.

### Medium: Richer prompt structure for characters

Instead of a flat string, structure character information in the prompt:

```
CHARACTER: Commander Vex
- Visual: Tall, cybernetic left arm, scar across right eye, wears dark military coat
- Personality: Cold, calculating — rarely smiles, stiff posture
- In this scene: Confronting the rebel leader
```

This gives Gemini clearer signals about what to emphasize.

### Longer Term: Per-panel character pose/expression hints

The panel description says what's happening, but adding explicit expression/pose hints from personality data could improve consistency:

- "nervous" personality → `"slightly hunched, eyes darting"`
- "confident" personality → `"standing tall, direct eye contact"`

This could be generated automatically as part of the panel prompt construction.

---

## Files Involved

| File                             | What it does                                                          |
| -------------------------------- | --------------------------------------------------------------------- |
| `src/screens/VaultScreen.tsx`    | VaultEntry type definition, card editor UI                            |
| `src/screens/DirectorScreen.tsx` | Resolves vault IDs → entries, builds prompt (lines 1482-1574)         |
| `src/screens/WorkshopScreen.tsx` | Story anchoring — detects character names, enriches with descriptions |
| `src/services/geminiService.ts`  | PanelPrompt type, API client                                          |
| `api/generate-image.ts`          | Sends reference images + prompt to Gemini                             |
| `api/generate-panels.ts`         | Story → panel breakdown (uses character names/descriptions)           |
