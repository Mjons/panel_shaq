# Dynamic Panel Insertion Plan

## Goal

Let users freely insert panels between existing ones or append to the end of their comic, with AI-generated visual descriptions based on surrounding context. Zero friction — the comic grows as long as the creator wants.

---

## How It Works

### 1. Insert Points — The "+" Buttons

Add visible `+` insertion points in the **DirectorScreen** panel list:

- **Between every two panels** — a `+` button sits in the gap
- **After the last panel** — a `+` button labeled "Continue Story"
- **Before the first panel** — a `+` button labeled "Add Prelude" (optional, lower priority)

Clicking any `+` opens a lightweight inline insertion flow (not a modal — keep it fast).

### 2. Context Detection

When the user clicks `+`, gather context from the neighbors:

| Insert Position              | Context Gathered                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Between Panel A and Panel B  | `story` text, Panel A description + image + mood + characters, Panel B description + image + mood + characters |
| After last panel (Panel N)   | `story` text, Panel N description + image + mood + characters, plus narrative hint that the story continues    |
| Before first panel (Panel 1) | `story` text, Panel 1 description + image + mood + characters, plus hint this is a new opening                 |

Context payload shape:

```ts
interface InsertionContext {
  story: string;
  previousPanel: PanelPrompt | null;
  nextPanel: PanelPrompt | null;
  allCharacters: Character[];
  insertIndex: number; // where in the panels array this goes
}
```

### 3. AI Description Generation

Send the context to Gemini to generate the new panel's visual description. The prompt instructs the AI to:

- **Bridge the narrative gap** between the previous and next panel (if inserting between)
- **Continue the story** if appending to the end
- **Set up the opening** if prepending before the first panel
- **Maintain visual consistency** — match the mood/camera style of neighbors
- Pick the right `characterFocus`, `cameraAngle`, and `mood` to fit naturally
- Keep the description cinematic and specific (same quality as batch-generated panels)

New Gemini service function:

```ts
async function generateInsertedPanelPrompt(
  context: InsertionContext,
): Promise<PanelPrompt>;
```

This returns a single `PanelPrompt` with `description`, `characterFocus`, `cameraAngle`, `mood`, and empty `bubbles[]` — same shape as batch-generated panels. No image yet (that happens in the normal Director flow).

### 4. User Can Edit Before Confirming

After AI generates the description, show it inline in an editable card at the insertion point:

- **Description** — editable text area (user can tweak the AI suggestion)
- **Character Focus** — dropdown, pre-filled by AI
- **Camera Angle** — dropdown, pre-filled by AI
- **Mood** — dropdown, pre-filled by AI
- **Confirm** button → inserts the panel into the array
- **Cancel** button → removes the draft, no changes

This gives the user full control while still providing a smart starting point.

### 5. Array Insertion

On confirm:

1. Generate a new `crypto.randomUUID()` for the panel ID
2. Splice the new `PanelPrompt` into the `panels` array at `insertIndex`
3. Update `pages` — the new panel ID needs to land on the right page:
   - If inserting between two panels on the same page, add the ID between them in that page's `panelIds`
   - If appending at the end, add to the last page (or create a new page if the last page is full based on current partition size)
4. State persists automatically via `usePersistedState`

### 6. Image Generation

The new panel appears in the Director grid with no image (same as freshly generated panels). User clicks "Generate" on that panel card to create the image — same flow as existing panels. No special handling needed.

---

## UX Flow Summary

```
User sees panel list in Director
        ↓
Clicks "+" between Panel 3 and Panel 4
        ↓
AI reads story + Panel 3 context + Panel 4 context
        ↓
AI generates description: "Close-up of Shaq's hand catching
the falling artifact mid-air, neon reflections on his skin,
rain streaking across the frame"
        ↓
User sees editable draft card at position 3.5
        ↓
User tweaks description → clicks Confirm
        ↓
New panel inserted at index 3, old Panel 4 shifts to index 4
        ↓
User clicks Generate on new panel → image created
        ↓
Comic now has one more panel, seamlessly integrated
```

---

## Implementation Scope

### Files to Modify

| File                             | Changes                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `src/services/geminiService.ts`  | Add `generateInsertedPanelPrompt()` function                                 |
| `src/screens/DirectorScreen.tsx` | Add `+` insertion buttons between panels, inline draft card UI, insert logic |
| `src/screens/LayoutScreen.tsx`   | Update `repartitionPages()` to handle mid-array inserts gracefully           |
| `src/App.tsx`                    | No changes needed — `setPanels` and `setPages` already passed down           |

### New Components (optional, could be inline)

| Component           | Purpose                                                      |
| ------------------- | ------------------------------------------------------------ |
| `InsertPanelButton` | The `+` button with animation/hover state                    |
| `PanelDraftCard`    | Editable preview of the AI-generated panel before confirming |

### Gemini Prompt Design

The insertion prompt should follow this structure:

```
You are a comic book director. Given a story and the surrounding panels,
create a single new panel that fits naturally between them.

STORY: {story}

PREVIOUS PANEL (Panel {n}):
- Description: {prev.description}
- Character Focus: {prev.characterFocus}
- Camera Angle: {prev.cameraAngle}
- Mood: {prev.mood}

NEXT PANEL (Panel {n+1}):
- Description: {next.description}
- Character Focus: {next.characterFocus}
- Camera Angle: {next.cameraAngle}
- Mood: {next.mood}

AVAILABLE CHARACTERS: {characters list}

Create a panel that bridges the narrative gap. Vary the camera angle
from the neighbors for visual rhythm. Return JSON with:
description, characterFocus, cameraAngle, mood.
```

For **append** (no next panel): replace the next panel section with:

```
The story continues beyond the last panel. Create the next
narrative beat that advances the plot.
```

For **prepend** (no previous panel): replace the previous panel section with:

```
This panel will open the comic. Set the scene and draw the
reader in before the action of Panel 1 begins.
```

---

## Edge Cases

- **Empty comic (no panels yet):** The `+` button acts as "Create First Panel" — context is just the story text and characters
- **Single panel comic:** Both before and after `+` buttons available, each with one neighbor for context
- **User spams inserts:** Each insert is independent, works fine — array just grows
- **Page overflow after insert:** `repartitionPages()` already handles arbitrary panel counts — just re-run it or let user manually adjust in Layout screen
- **Undo:** No built-in undo, but panel can be deleted from Director (existing delete flow). Could add undo as future enhancement.

---

## Priority Order

1. **"+" buttons in DirectorScreen** — the trigger UI
2. **`generateInsertedPanelPrompt()` in geminiService** — the AI brain
3. **Draft card with edit + confirm** — user control
4. **Array splice + page update logic** — state management
5. **"Continue Story" append variant** — most common use case, polish this
6. **"Add Prelude" prepend variant** — nice to have
