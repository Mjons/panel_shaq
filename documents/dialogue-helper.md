# Feature: Dialogue Helper

## Overview

A panel in the Editor sidebar (next to Critique Corner) that uses AI to suggest
dialogue for each panel on the current page. Each suggestion maps to a specific
panel and can be applied with one tap, which creates a speech bubble with the
suggested text.

## How it works

1. User clicks **"Suggest Dialogue"** in the sidebar
2. The app captures the current page image (same flow as Critique) and sends it
   along with the story text and panel descriptions to the API
3. AI returns structured JSON: an array of suggestions, each tied to a panel index
4. The sidebar renders a card per panel with the suggested dialogue
5. User taps **"Apply"** on a suggestion to create a speech bubble in that panel
   with the text pre-filled

## UI (sidebar section, above Critique Corner)

```
+---------------------------------------+
| [MessageSquare icon] DIALOGUE HELPER  |
|---------------------------------------|
|                                       |
| Suggest dialogue for your panels      |
| based on the story and visuals.       |
|                                       |
| [====== SUGGEST DIALOGUE ======]      |
+---------------------------------------+
```

After generation:

```
+---------------------------------------+
| [MessageSquare icon] DIALOGUE HELPER  |
|---------------------------------------|
|                                       |
| PANEL 01                              |
| "Watch out, the bridge is collapsing!"|
| Style: speech  [Apply]  [Edit]        |
|                                       |
| PANEL 01 (sfx)                        |
| "KRAAAK"                              |
| Style: sfx-impact  [Apply]  [Edit]    |
|                                       |
| PANEL 02                              |
| "I told you we should have taken the  |
|  other path..."                       |
| Style: thought  [Apply]  [Edit]       |
|                                       |
| [Try Again]                           |
+---------------------------------------+
```

- Each card shows the panel number, suggested text, and bubble style
- **Apply** creates a bubble in the target panel with the text and style
- **Edit** lets you tweak the text inline before applying
- Applied suggestions get a checkmark and dim out
- **Try Again** re-runs the generation

## API

### New endpoint: `suggest-dialogue`

**Request:**

```json
{
  "images": ["data:image/png;base64,..."],
  "story": "The original story text...",
  "panels": [
    { "index": 0, "description": "Hero stands on the crumbling bridge..." },
    { "index": 1, "description": "Wide shot of the canyon below..." }
  ],
  "characters": [{ "name": "Rex", "description": "Gruff mercenary..." }]
}
```

**Response:**

```json
{
  "suggestions": [
    {
      "panelIndex": 0,
      "text": "Watch out, the bridge is collapsing!",
      "speaker": "Rex",
      "style": "speech"
    },
    {
      "panelIndex": 0,
      "text": "KRAAAK",
      "speaker": null,
      "style": "sfx-impact"
    },
    {
      "panelIndex": 1,
      "text": "I told you we should have taken the other path...",
      "speaker": "Rex",
      "style": "thought"
    }
  ]
}
```

### Prompt strategy

The system prompt should instruct the model to:

- Look at each panel image and its description
- Consider the story context and characters
- Suggest 1-3 dialogue lines per panel (speech, thought, narration, or SFX)
- Return structured JSON matching the response schema
- Use character names as speakers when identifiable
- Keep dialogue concise and comic-appropriate (short lines, punchy)
- Not every panel needs dialogue — action panels can have just SFX or nothing

## Files to change

| File                                                   | What                                                              |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| `src/services/geminiService.ts`                        | Add `suggestDialogue()` function + types + prompt constant        |
| `api/suggest-dialogue.ts` (or equivalent server route) | New API endpoint mirroring `critique-comic` pattern               |
| `src/screens/EditorScreen.tsx`                         | Add props (`story`, `characters`), state, UI section, apply logic |
| `src/App.tsx`                                          | Pass `story` and `characters` props to `EditorScreen`             |

## Implementation steps

1. **Add types + API function** in `geminiService.ts`
   - `DialogueSuggestion` interface: `{ panelIndex, text, speaker, style }`
   - `suggestDialogue(images, story, panels, characters)` → `DialogueSuggestion[]`
   - Prompt constant `DIALOGUE_PROMPT`

2. **Create server endpoint** `api/suggest-dialogue`
   - Receives images + story context, calls Gemini with the prompt
   - Parses structured JSON response, returns suggestions array

3. **Wire props through App.tsx**
   - Add `story` and `characters` to `EditorProps`
   - Pass them from `App.tsx`

4. **Build the sidebar UI** in `EditorScreen.tsx`
   - New state: `dialogueSuggestions`, `isGeneratingDialogue`, `appliedSuggestions`
   - Section placed above Critique Corner
   - "Suggest Dialogue" button triggers capture + API call (same pattern as critique)
   - Render suggestion cards grouped by panel

5. **Apply logic**
   - On "Apply": find the target panel by index from `currentPage.panelIds`
   - Create a `Bubble` with the suggested text, style, and default positioning
   - Add to that panel's bubbles array
   - Mark suggestion as applied in local state

## Scope limits

- Single page at a time (no "suggest for all pages")
- No drag-and-drop from suggestion to panel — just an Apply button
- Editing is inline text only — style/position adjustments happen after apply
- Speaker name is shown for context but not baked into the bubble text
