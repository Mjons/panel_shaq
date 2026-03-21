# How Panel Insert Works

## Overview

When you tap "Insert Panel" between two existing panels, the app asks Gemini to generate a new panel description that bridges the narrative gap. It then shows you a draft card you can edit before confirming.

## The Flow

```
User taps "Insert Panel" (between panel 3 and 4)
    ↓
DirectorScreen builds InsertionContext:
  - story: the full story text from Workshop
  - previousPanel: panel 3 (description, characterFocus, cameraAngle, mood)
  - nextPanel: panel 4 (same fields)
  - allCharacters: names + descriptions from vault
  - insertIndex: 3
    ↓
Client strips image data (only sends text metadata to save bandwidth)
    ↓
POST /api/insert-panel
    ↓
Server builds prompt for Gemini with:
  - Full story text
  - Previous panel details (description, character focus, camera angle, mood)
  - Next panel details (same)
  - All available characters with descriptions
  - Instruction: "Create a panel that bridges the narrative gap"
    ↓
Gemini returns JSON: { description, characterFocus, cameraAngle, mood }
    ↓
Draft card appears in the Director grid → user can edit → confirm to insert
```

## What the AI Receives

The prompt sent to Gemini (`api/insert-panel.ts`) includes:

1. **The full story** — so the AI understands the overall narrative
2. **Previous panel** (if any) — description, character focus, camera angle, mood
3. **Next panel** (if any) — same fields
4. **All characters** — names and descriptions so it can reference the right people
5. **Insert index** — so it knows where in the sequence this panel sits

### Special cases:

- **Inserting at the start** (no previous panel): prompt says "This panel will OPEN the comic. Set the scene and draw the reader in."
- **Inserting at the end** (no next panel): prompt says "Create the next narrative beat that advances the plot."

## The Prompt

```
You are a comic book director. Given a story and the surrounding panels,
create a single new panel that fits naturally between them.

STORY: [full story text]

PREVIOUS PANEL (Panel 3):
- Description: [panel 3 description]
- Character Focus: [character name]
- Camera Angle: [angle]
- Mood: [mood]

NEXT PANEL (Panel 4):
- Description: [panel 4 description]
- ...

AVAILABLE CHARACTERS:
Dev Guy: A bald man with a thick scruffy brown beard...

Create a panel that bridges the narrative gap. Vary the camera angle
from the neighbors for visual rhythm.
```

System instruction: "You are an expert comic book storyboard artist. You create compelling single panels that bridge narrative gaps seamlessly."

## What It Returns

Gemini responds with structured JSON (enforced via `responseMimeType: "application/json"` + schema):

```json
{
  "description": "Close-up on Dev Guy's hands gripping the control panel...",
  "characterFocus": "Dev Guy",
  "cameraAngle": "Extreme Close-up",
  "mood": "Tense"
}
```

## Panel Type Guidance (Updated)

The prompt now explicitly tells the AI to pick from these cinematic panel types:

1. **Reaction shot** — character's face/body reacting to what just happened
2. **Detail insert** — close-up on a hand, object, weapon, clock, or environmental detail
3. **Atmospheric filler** — wide establishing shot, weather, skyline, environment mood
4. **Transition beat** — time passing, location change, or pacing breath

The prompt also enforces:

- "Do NOT just create another action panel"
- Camera angle must vary from neighbors ("if both are medium shots, use extreme close-up or wide")
- System instruction emphasizes "cinematic pacing" and "filler panels that make comics feel like films"

### Remaining gaps:

- **No style context** — the insert prompt doesn't know about the art style, style notes, or style reference image
- **No tone matching** — if the story is comedic vs dark, the AI doesn't get explicit guidance on tone

## Files Involved

| File                             | Role                                                                |
| -------------------------------- | ------------------------------------------------------------------- |
| `src/screens/DirectorScreen.tsx` | Builds `InsertionContext`, shows draft card, handles confirm/cancel |
| `src/services/geminiService.ts`  | `generateInsertedPanelPrompt()` — strips images, posts to API       |
| `api/insert-panel.ts`            | Server endpoint — builds Gemini prompt, returns structured JSON     |
