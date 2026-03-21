# Changelog — Session 2026-03-20

## Panel Haus Desktop Export (NEW)

- **`.comic` file export** — full pipeline to export projects for Panel Haus Desktop
- Grid-to-pixel converter transforms CSS grid layouts into absolute pixel coordinates (490x700)
- Bubble mapper: `speech→speech-bubble`, `thought→thought-bubble`, `action→shout-bubble`, `effect→caption-box`
- Vault entries mapped to Desktop Blueprint format with reference images
- Story wrapped as `generatedStories[]` entry
- Proper `layers{}` wrapper, `strokeWidth`/`strokeColor` property names, `showOutline`/`visible`/`locked`/`zIndex` fields
- **"Export for Panel Haus"** button on Share screen with panel/vault/page count summary
- Desktop opens the file natively with zero changes needed

## Navigation & Branding

- **Bottom nav reordered** to match workflow: Workshop → Director → Layout → Editor → World Vault (globe icon)
- **Hamburger menu** updated with all pages: Workshop, Director, Layout, Editor, World Vault, Share
- **"CREATE"** → **"NEW / LOAD"**
- **"PANELHAUS.app"** → **"PANEL SHAQ"** in top nav

## Workshop — Mobile-First Reorder

- **Flow reordered**: 1. Characters → 2. Style → 3. Story → 4. Polish → 5. Generate
- **Numbered steps** with instruction text for new users at each section
- **Step 2 Style** — tap a character image to set it as the art style reference (palette icon overlay)
- **Project name field** replaces static header — editable inline input
- **Art style grid** compacted to 3 columns on mobile
- **Style Notes** labeled as "(optional)"
- **AI Polish** button + explanation enclosed side-by-side in a bordered box
- **First-time generate tip** — modal warns about missing character descriptions, mentions Auto-Describe
- **Character delete (X)** and **style reference (palette)** icons always visible on mobile

## Character & Style System

- **Characters auto-selected** on all panels by default (max 5 per panel)
- **5 character ref cap** — UI prevents selecting more than 5, counter shows (2/5)
- **"Match character art style" toggle** per panel
- **Art style text always included** in prompt even with custom style ref image
- **"Heavy Inks, High Contrast"** removed from hardcoded defaults
- **Style Notes textarea** — free-form descriptors injected into generation prompts
- **Stronger style adherence prompts** — "If cartoony, output MUST be cartoony"
- **"cinematic comic book panel"** → "comic panel" when style ref active

## Characters & World Vault Sync

- **Single source of truth** — `VaultEntry` is canonical type, `Character` is alias
- **Characters derived** from vault entries (`type === "Character"`)
- **Create in one place, see in both** — Workshop and World Vault share the same data
- **Backward compat** — old projects auto-convert characters on load
- **One-time migration** merges old localStorage vault into IndexedDB

## Auto-Describe Characters

- **"Auto-Describe" button** on character edit modal — Gemini analyzes the image
- Fills description with visual appearance only (no poses/emotions/background)
- **`/api/analyze-character`** serverless endpoint

## Panel Preview Mode (Carousel)

- **Preview button** in Director header + click panel image to open
- **Fullscreen carousel** with swipe navigation
- **Per-panel regeneration notes** that feed into generation prompts
- **Regenerate button** per panel in preview
- **Fully opaque background** + safe-area bottom padding

## Bubble / Text Balloon Editor

- **Draggable bubbles** — drag to reposition directly on panel images
- **Tap-to-edit floating toolbar** with Speech/Thought/SFX type pills, text input, A-/A+ font size, delete
- **SFX visual** — bold yellow text with black stroke, no bubble border

## AI Polish

- Returns **only polished text** — no tips, explanations, or commentary

## Panel Insert — Improved Prompting

- **Cinematic panel types** — AI now explicitly picks from: reaction shot, detail insert, atmospheric filler, or transition beat
- **No more duplicate action panels** — prompt says "Do NOT just create another action panel"
- **Camera angle variation enforced** — "If the neighbors are both medium shots, use an extreme close-up or wide shot"
- **Better system instruction** — "specializing in cinematic pacing... reaction shots, detail inserts, atmospheric beats"

## Infrastructure

- **Infinite re-render loop fixed** — `useMemo` + `useCallback` for character derivation
- **ErrorBoundary auto-retry** — silently retries twice before showing error (handles IndexedDB race condition)
- **Service worker** — `skipWaiting` + `clientsClaim` for immediate CSS/JS updates on deploy
- **Dead `getDirectAI` fallback** removed (was causing TS error)
