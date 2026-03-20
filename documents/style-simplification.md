# Style Simplification

## Problem

The current style system is overengineered and confusing:

1. **Art Style picker on Workshop** (Cartoon, Manga, Pixel Art, etc.) — users pick a style name but it barely affects output
2. **Style Priority toggle on Director** (Character Look vs Art Style) — doesn't work reliably, adds cognitive load
3. **Style Reference toggle** — another checkbox that's unclear
4. **Match Char Style toggle** — yet another option
5. **Style Notes textarea** — rarely used

Too many levers, none of them work well. Users are confused about what controls what.

## The Simple Truth

The character reference image IS the style. If you upload a cartoon character, you get cartoon panels. If you upload a realistic photo, you get realistic panels. The model follows the visual style of whatever images you give it.

**We should lean into this instead of fighting it.**

## New Approach

### Remove:

- Art Style picker from Workshop (Cartoon, Manga, Pixel Art, etc.)
- Style Priority toggle from Director (Character Look vs Art Style)
- `styleReferenceImage` as a concept (it was overloaded — sometimes a style name string, sometimes a base64 image)
- Match Char Style toggle
- Style Notes textarea
- `artStyle`, `stylePriority`, `matchCharStyle`, `useStyleRef`, `styleNotes` fields

### Keep:

- Character reference images — these define BOTH appearance AND style
- Camera angle dropdown
- Camera lens dropdown
- Mood dropdown
- Aspect ratio dropdown
- Panel description (the main prompt)

### How It Works After Simplification

1. User uploads a character image in Workshop
2. That image's visual style becomes the comic's style automatically
3. In Director, each panel sends the character reference images to Gemini
4. Gemini matches both the character appearance AND the art style from the references
5. Camera angle, lens, and mood still modify the composition and lighting

**That's it.** No style dropdowns, no toggles, no priority system.

### What If User Wants a Different Style?

Upload a different character reference in that style. Want pixel art? Upload a pixel art version of your character. Want manga? Upload a manga-style reference. The reference image IS the style guide.

This is actually how professional artists work — they use reference sheets in the target style.

---

## Implementation

### Files to Change

| File                             | Changes                                                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/screens/WorkshopScreen.tsx` | Remove Art Style picker section entirely                                                                                                     |
| `src/screens/DirectorScreen.tsx` | Remove Style Priority toggle, remove matchCharStyle/useStyleRef/styleNotes from PanelCard state and handleGenerate. Simplify prompt builder. |
| `src/services/geminiService.ts`  | Clean up PanelPrompt interface — remove `artStyle`, `stylePriority`, `matchCharStyle`, `useStyleRef`                                         |
| `src/App.tsx`                    | Remove `styleReferenceImage` state (or repurpose as just the global art style image), remove `styleNotes` state                              |
| `api/generate-image.ts`          | Simplify prompt — no more style/artStyle logic, just send the prompt + reference images                                                      |

### Prompt After Simplification

```
A cinematic comic book panel.
Subject: {description}.
Characters present: {characterContext}.
Camera Angle: {cameraAngle}.
Camera Lens: {cameraLens}.
Mood: {mood}.
CRITICAL: Match the exact visual style, line work, and coloring of the attached character reference images.
CRITICAL: Do NOT include any speech bubbles or text in the image.
```

Clean, simple, effective. The reference images do the heavy lifting.

### Migration

- Existing panels with `artStyle` field: ignored (field becomes unused)
- No data migration needed — the prompt builder just stops reading those fields
- Old projects still load fine, they just won't have the removed UI options
