# Changelog — Session 2026-03-20

## Navigation & Layout

- **Bottom nav reordered** to match workflow: Workshop → Director → Layout → Editor → World Vault (globe icon)
- **3rd tab** changed from Vault to Layout (layout selection page)
- **5th tab** changed from Share to World Vault with `public` (globe) icon
- **Hamburger menu** updated with all pages: Workshop, Director, Layout, Editor, World Vault, Share
- **"CREATE" button** → "NEW / LOAD"
- **"PANELHAUS.app" branding** → "PANEL SHAQ" in top nav

## Workshop (Step 1) — Reordered for Mobile

- **Flow reordered**: Characters (1) → Art Style (2) → Story (3) → AI Polish (4) → Generate (5)
- **Numbered steps** with instruction text added for new users
- **Project name field** replaces static "Story Workshop" header — editable inline input
- **Character delete (X) button** always visible on mobile (was hover-only)
- **Style reference (palette) icon** always visible on mobile
- **Art style grid** compacted to 3 columns on mobile
- **Style Notes** labeled as "(optional)"
- **AI Polish** button + explanation enclosed side-by-side in a bordered box, explaining it's optional and considers the cast

## Character & Style System

- **Characters auto-selected** on all panels by default — prevents forgetting to select refs before generation
- **"Match character art style" toggle** added per panel — uses character ref image as style reference
- **Art style text always included** in prompt even when custom style ref image is present (was being stripped, causing model to ignore style)
- **"Heavy Inks, High Contrast"** removed from hardcoded style defaults
- **Style Notes textarea** added to Workshop — free-form descriptors injected into generation prompts
- **Style adherence prompts** strengthened: "If the reference is cartoony, the output MUST be cartoony"
- **"cinematic comic book panel"** changed to "comic panel" when style ref is active (was biasing toward realism)

## Characters ↔ World Vault Sync

- **Single source of truth**: `VaultEntry` is now the canonical type, `Character` is a type alias
- **Characters derived** from vault entries (`type === "Character"`)
- **VaultScreen** accepts props from App instead of managing own state
- **Creating a character** in Workshop creates a vault entry visible in World Vault, and vice versa
- **Backward compatibility**: old projects auto-convert characters on load
- **One-time migration** merges old localStorage vault into IndexedDB

## Auto-Describe Characters

- **"Auto-Describe" button** on character edit modal — uses Gemini to analyze uploaded image and fill description with visual appearance only (no poses/emotions/background)
- **`/api/analyze-character`** serverless endpoint created

## Panel Preview Mode (Carousel)

- **Preview button** added to Director header
- **Fullscreen carousel** with swipe navigation between panels
- **Per-panel notes textarea** — "Regeneration Notes" feed into generation prompts
- **Regenerate button** per panel in preview mode
- **Dot indicators** show panel positions and which have images
- **Clicking panel image** in grid opens preview at that panel
- **Fully opaque background** (was 95% transparent, bottom nav bled through)
- **Safe-area padding** at bottom for mobile gesture bars

## Bubble / Text Balloon Editor

- **Draggable bubbles** — drag to reposition directly on the panel image (replaces slider-only positioning)
- **Tap-to-edit floating toolbar** pops up above tapped bubble with:
  - Type pills: Speech | Thought | SFX
  - Inline text input
  - Font size A-/A+ buttons
  - Delete and Done buttons
- **SFX visual treatment** — bold yellow text with black stroke, no bubble border, slight rotation
- **Bubble types mapped**: Dialogue → `speech`, Thought → `thought`, SFX → `effect`

## AI Polish

- **Output-only mode** — now returns only the polished story text, no tips/explanations/commentary
- Prompt and system instruction both enforce "output ONLY the polished story text"

## Bug Fixes

- **Infinite re-render loop fixed** — `characters` derivation wrapped in `useMemo`, `setCharacters` stabilized with `useCallback`
- **Dead `getDirectAI` fallback** removed from `analyzeCharacterImage` (was causing TS error)
- **Character refs not passed in queue generation** — defaulted to all characters when `selectedCharacterIds` is undefined
