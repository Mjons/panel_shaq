# Changelog: Style Simplification

## What Changed

The entire art style system was removed. Character reference images now define both the character appearance AND the art style automatically.

## Removed

- **Art Style picker** from Workshop (Cartoon, Manga, Pixel Art, etc. buttons)
- **Style Priority toggle** from Director ("Character Look" vs "Art Style")
- **Match Character Art Style** checkbox
- **Use Style Reference** checkbox
- **Style Notes** textarea
- **Style Reference Image** concept (was overloaded as both a style name and a base64 image)
- **Custom style upload** button in Workshop
- **Palette/style-ref buttons** on character cards
- **Grayscale effect** on non-style-ref characters
- **ART_STYLE_ENFORCE** object with 10 style descriptions
- Fields from PanelPrompt: `artStyle`, `stylePriority`, `matchCharStyle`, `useStyleRef`
- Props: `styleReferenceImage`, `setStyleReferenceImage`, `styleNotes`, `setStyleNotes`
- Server-side: `style`, `styleReferenceImage`, `styleNotes` from generate-image API request body

## Simplified

**Before (generate-image prompt):**

```
MANDATORY STYLE ADHERENCE: The FIRST attached image is a style reference...
Art style should be Cartoon — use this as guidance alongside the style reference...
Style notes: cute, round shapes...
CRITICAL: Match the exact artistic style, line work, coloring...
```

**After (generate-image prompt):**

```
A cinematic comic book panel.
Subject: [description].
Characters present: [names + descriptions].
Camera Angle: [angle]. Camera Lens: [lens]. Mood: [mood].
CRITICAL: Match the exact visual style, line work, and coloring
of the attached character reference images.
```

## How Style Works Now

1. Upload a character in whatever art style you want
2. That style IS your comic's style
3. Want pixel art? Upload a pixel art character
4. Want manga? Upload a manga-style character
5. The reference images do the heavy lifting — no dropdowns needed

## Files Changed

- `src/services/geminiService.ts` — cleaned PanelPrompt interface, simplified generatePanelImage signature
- `src/screens/DirectorScreen.tsx` — removed all style state, toggles, and prompt complexity
- `src/screens/WorkshopScreen.tsx` — removed Art Style picker, style notes, palette buttons
- `src/App.tsx` — removed styleReferenceImage and styleNotes state + props
- `src/services/projectStorage.ts` — made styleReferenceImage optional (backward compat)
- `api/generate-image.ts` — simplified prompt, removed style/styleReferenceImage/styleNotes from request
