# Panel Shaq — Character Tagging in Story Scripts

**Date:** 2026-03-20
**Problem:** Users write stories with vague references like "the man", "she", "the hero" — Gemini generates new random characters instead of using the ones defined in the Characters panel. There's no link between story text and character definitions.

---

## The Current Flow

1. User adds characters in the sidebar (image + name + description)
2. User writes a story in the textarea (free text, no structure)
3. "Generate Panels" sends the story + character list to Gemini
4. Gemini tries to match names but often invents new characters or misinterprets vague references

**The gap:** Nothing in the UI encourages the user to reference characters by their exact name. The story and characters are disconnected.

---

## Proposed Solution: @Mentions (Tag Characters in Story)

### How it works:

The story textarea becomes a rich text input where typing `@` triggers a character picker dropdown — similar to @mentions in Slack, GitHub, or Discord.

```
The sun blazed over the wasteland. @Dev Guy wiped sweat from his brow
and squinted at the horizon. In the distance, @Nova-7 approached on
a rusted hoverbike, kicking up clouds of red dust.
```

### What the user sees:

1. **Typing `@` in the story textarea** opens a floating dropdown of available characters
2. Each character shows their **thumbnail + name**
3. **Arrow keys or tap** to select, **Enter** to insert
4. Inserted tag renders as a **styled pill/chip** inline in the text:
   - Orange background, character name in bold
   - Clicking the pill highlights the character in the sidebar
5. **Character names without @** still work — they're just not guaranteed
6. Tags are **removable** by backspacing through them

### What the AI sees:

Before sending to Gemini, the tags are expanded into explicit character anchors:

```
The sun blazed over the wasteland. [CHARACTER: Dev Guy — A bald man
with a thick scruffy brown beard, light skin, and an intense scowl.
Wears a light blue t-shirt.] wiped sweat from his brow and squinted
at the horizon. In the distance, [CHARACTER: Nova-7 — A cybernetic
pilot with a glowing blue eye.] approached on a rusted hoverbike,
kicking up clouds of red dust.
```

This gives Gemini **explicit, unambiguous character anchors** with full descriptions inline. No guessing.

---

## Implementation Options

### Option A: Lightweight @Mention (Recommended)

Keep the textarea as plain text but intercept `@` keystrokes:

**How:**

- Listen for `@` keypress in the textarea
- Show a floating dropdown positioned at the cursor
- On select, insert `@CharacterName` as plain text
- Before sending to Gemini, regex-replace `@CharacterName` with the full `[CHARACTER: Name — Description]` block
- Render `@CharacterName` portions with a subtle highlight via an overlay or by switching to a `contentEditable` div

**Pros:**

- Simple — story is still a plain string in state
- No rich text library needed
- `@tags` are human-readable even without rendering
- Easy to persist (it's just text)

**Cons:**

- If user renames a character, tags in the story become stale
- Can't show thumbnails inline (it's plain text)
- Highlighting requires a transparent overlay or contentEditable

**Effort:** 1-2 days

### Option B: Rich Text with Inline Chips

Replace the textarea with a `contentEditable` div or a lightweight rich text editor:

**How:**

- Use a library like `@tiptap/react` or build a simple contentEditable wrapper
- `@` triggers an autocomplete popup
- Selected characters insert as non-editable inline nodes (chips/pills)
- Chips show: colored background + character name (optionally tiny thumbnail)
- The underlying data model stores text + character references:
  ```typescript
  interface StorySegment {
    type: "text" | "character";
    value: string; // text content or character ID
  }
  type Story = StorySegment[];
  ```

**Pros:**

- True inline chips that look great
- Can show thumbnails in the chip
- Character renames automatically update (referenced by ID, not name)
- Clear visual distinction between narrative and character references

**Cons:**

- Significantly more complex
- ContentEditable is notoriously buggy on mobile
- Need to serialize/deserialize for storage and API calls
- Rich text libraries add bundle size (~50-100KB)
- Breaks the simple `story: string` state model

**Effort:** 3-5 days

### Option C: Tag Bar + Smart Detection (Simplest)

Don't change the textarea at all. Instead, add a "tag bar" above the textarea that shows which characters are referenced in the current text, and auto-detect names.

**How:**

- Scan the story text for exact character name matches
- Show matched characters as pills above the textarea: "Characters in story: [Dev Guy] [Nova-7]"
- Unmatched characters show as grayed out: "Not referenced: [The Drifter]"
- Clicking a grayed-out character inserts their name at the cursor position
- Before sending to Gemini, inject character descriptions for all matched names

**Pros:**

- Zero changes to the textarea itself
- No contentEditable headaches
- Story stays a simple string
- Works on mobile without issues
- Gives visual feedback about which characters Gemini will "know about"

**Cons:**

- No autocomplete while typing
- Relies on exact name matching (case-insensitive)
- User must type the exact name — "Dev" won't match "Dev Guy"
- Less discoverable than @mentions

**Effort:** Half day

---

## Recommendation

### Start with Option C (Tag Bar), upgrade to Option A (@Mentions) later

**Phase 1: Tag Bar (half day)**

- Add character detection bar above textarea
- Click-to-insert for unmatched characters
- Auto-inject descriptions into Gemini prompt
- Zero risk, zero complexity increase

**Phase 2: @Mentions (1-2 days)**

- Add `@` keystroke listener to textarea
- Floating dropdown with character thumbnails
- Insert `@CharacterName` as plain text
- Highlight `@tags` with a CSS overlay
- Expand tags before API call

Skip Option B (rich text) — it's overkill and mobile contentEditable is a pain.

---

## Phase 1: Tag Bar Implementation

### UI Design

Above the story textarea, add:

```
┌─────────────────────────────────────────────┐
│ CHARACTERS IN STORY                         │
│ [🟢 Dev Guy] [🟢 Nova-7] [⚪ The Drifter]  │
│                              ↑ tap to insert │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ A neon-drenched city breathes in the rain.  │
│ Dev Guy adjusts his metallic mask while     │
│ Nova-7 surveys the rooftop...               │
└─────────────────────────────────────────────┘
```

- Green dot = character name found in story text
- Gray dot = not referenced (tap to insert at cursor)
- Pill shows character name, maybe tiny avatar

### Files to modify:

**`src/screens/WorkshopScreen.tsx`**

- Add a `CharacterTagBar` component above the textarea
- Scan `story` for character name matches (case-insensitive)
- On click of unmatched character, insert name at textarea cursor position
- Use `textareaRef.selectionStart` to find cursor position

### Gemini prompt enhancement:

**`src/services/geminiService.ts`** (or the `api/generate-panels.ts` serverless function)

Currently the prompt sends:

```
Characters:
Dev Guy: A bald man with...
Nova-7: A cybernetic pilot with...
```

Change to inject matched characters directly into the story text:

```
Story (with character anchors):
A neon-drenched city breathes in the rain.
[CHARACTER: Dev Guy — A bald man with a thick scruffy brown beard...]
adjusts his metallic mask while
[CHARACTER: Nova-7 — A cybernetic pilot with a glowing blue eye]
surveys the rooftop...
```

This makes character identity unambiguous in the prompt.

---

## Phase 2: @Mentions Implementation

### Autocomplete dropdown:

```typescript
// In WorkshopScreen, track cursor state
const [showMentionDropdown, setShowMentionDropdown] = useState(false);
const [mentionFilter, setMentionFilter] = useState("");
const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });

const handleStoryKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  const textarea = e.currentTarget;
  const text = textarea.value;
  const cursor = textarea.selectionStart;

  // Find the @ symbol before the cursor
  const beforeCursor = text.substring(0, cursor);
  const atIndex = beforeCursor.lastIndexOf("@");

  if (atIndex >= 0 && !beforeCursor.substring(atIndex).includes(" ")) {
    // User is typing a mention
    const filter = beforeCursor.substring(atIndex + 1);
    setMentionFilter(filter);
    setShowMentionDropdown(true);
    // Position dropdown near cursor (use textarea.getBoundingClientRect + line height calc)
  } else {
    setShowMentionDropdown(false);
  }
};

const insertMention = (character: Character) => {
  const textarea = textareaRef.current;
  if (!textarea) return;
  const text = story;
  const cursor = textarea.selectionStart;
  const beforeCursor = text.substring(0, cursor);
  const atIndex = beforeCursor.lastIndexOf("@");

  const newText =
    text.substring(0, atIndex) + `@${character.name} ` + text.substring(cursor);

  setStory(newText);
  setShowMentionDropdown(false);
};
```

### Highlighting @tags:

Since we can't style parts of a `<textarea>`, use a **transparent overlay div** that sits on top of the textarea with the same font/size/padding. The overlay renders the text with `@CharacterName` portions wrapped in `<span>` tags with a highlight style. The textarea remains the input source, the overlay is purely visual.

```tsx
<div className="relative">
  {/* Invisible overlay for highlighting */}
  <div
    className="absolute inset-0 pointer-events-none p-6 text-lg leading-relaxed whitespace-pre-wrap break-words"
    aria-hidden="true"
  >
    {story.split(/(@\w[\w\s]*?)(?=\s|$)/g).map((part, i) =>
      part.startsWith("@") &&
      characters.some((c) => `@${c.name}` === part.trim()) ? (
        <span key={i} className="bg-primary/20 text-primary rounded px-0.5">
          {part}
        </span>
      ) : (
        <span key={i} className="text-transparent">
          {part}
        </span>
      ),
    )}
  </div>

  {/* Actual textarea */}
  <textarea
    ref={textareaRef}
    className="relative z-10 bg-transparent ..."
    value={story}
    onChange={(e) => setStory(e.target.value)}
    onKeyUp={handleStoryKeyUp}
  />
</div>
```

---

## Edge Cases to Handle

| Case                                   | Solution                                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Character renamed after being tagged   | Tag bar rescans on every character change. @Mentions use name strings, so rename breaks them — show warning "Update story references?" |
| Character deleted after being tagged   | Tag bar shows "Unknown character" in red. Offer to remove references.                                                                  |
| Multiple characters with similar names | Dropdown shows full name + thumbnail to disambiguate                                                                                   |
| Very long character names              | Truncate in pill display, full name in tooltip                                                                                         |
| Story pasted from external source      | Tag bar auto-detects any existing character names                                                                                      |
| @ used for non-character text (email)  | Only match against known character names, ignore unrecognized @words                                                                   |

---

## Impact on AI Quality

### Without tagging:

- Story: "The man walked through the rain"
- Gemini: generates a random man, ignoring Dev Guy's description

### With tagging:

- Story: "Dev Guy walked through the rain"
- Gemini receives: "[CHARACTER: Dev Guy — A bald man with a thick scruffy brown beard...] walked through the rain"
- Gemini: generates Dev Guy accurately

### Expected improvement:

- Character consistency across panels: **significantly better**
- Fewer wasted generations (wrong character appeared): **50-70% reduction**
- User satisfaction: **higher** (less "that's not my character" frustration)

This is probably the highest-impact UX improvement for comic quality.
