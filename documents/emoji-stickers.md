# Emoji Stickers (Simplified)

## Concept

Instead of bundling sticker image assets, let users pick from the system emoji keyboard as draggable overlays. Every phone already has hundreds of emojis — they're free, zero bundle size, and users already know how to find them.

A single emoji rendered at large font size on a panel looks exactly like a sticker: ❤️ 💥 ⭐ 🔥 💀 😱 💧 ❗ ❓ 💡

## Why This Works on Mobile

- **Zero bundle size** — emojis are built into the OS
- **Huge library** — thousands of emojis, constantly updated by Apple/Google
- **Familiar UI** — users already know the emoji keyboard
- **Works like text** — it's literally a Bubble with style `"sticker"` and a single emoji as the `text` field. All existing drag/pinch/rotate/export just works.

## Implementation

### It's just a bubble

An emoji sticker is a Bubble where:

- `style: "sticker"`
- `text: "💥"` (the emoji)
- `fontSize: 48` (rendered big)
- No background, no border, no speech bubble shape — just the raw emoji

That's it. No new data model needed.

### Adding a Sticker

**Option A: Emoji picker button (Recommended)**

Add a "+Emoji" button next to "+Bubble". Tapping it opens the native emoji keyboard (via a hidden input) or a simple emoji grid with common picks:

```
Quick picks:  ❤️ 💥 ⭐ 🔥 💀 😱 💧 ❗ ❓ 💡 ⚡ 💢 ✨ 💬 🎵
              [More... → opens emoji keyboard]
```

The quick picks grid covers 90% of comic use cases. "More..." opens a text input that triggers the native emoji keyboard for the full catalog.

**Option B: Type toggle**

Add "Sticker" to the existing bubble type cycle (Speech → Thought → ... → Sticker). When in sticker mode, the text input accepts emoji only and renders without a bubble background.

Option A is better — it's faster to tap a heart emoji than cycle through 9 bubble types.

### Rendering

```tsx
{bubble.style === "sticker" ? (
  <span
    style={{
      fontSize: `${bubble.fontSize}px`,
      lineHeight: 1,
      userSelect: "none",
    }}
  >
    {bubble.text}
  </span>
) : (
  // existing bubble rendering
)}
```

No background, no border, no padding, no speech bubble shape. Just a big emoji floating on the panel.

### Editing Toolbar (when sticker is tapped)

Simplified — no text type toggle, no bold/italic:

```
[A-] [48px] [A+]  [🗑️] [✓]
```

Just resize + delete + done. The emoji itself is set when created and doesn't need a text input (though tapping could open the picker to swap it).

## UI Placement

### Fullscreen Toolbar

```
[+Bubble] [+😀] [Lock] [Bake] [Done]
```

The "+😀" button opens the quick picks grid above the toolbar:

```
┌──────────────────────────────────────┐
│ ❤️  💥  ⭐  🔥  💀  😱  💧  ❗     │
│ ❓  💡  ⚡  💢  ✨  💬  🎵  😂     │
│                         [More...]   │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ [+Bubble] [+😀] [Lock] [Bake] [Done]│
└──────────────────────────────────────┘
```

Tapping an emoji instantly adds it to the center of the panel at 48px. The picker closes. User drags it into position.

### Sidebar (non-fullscreen)

Add a small emoji button next to the "+" bubble button in the Dialogue section header:

```
DIALOGUE  [+] [😀]
```

### Bubble List

Emoji stickers show as their emoji in the list:

```
[speech 1] [thought 2] [❤️ 3] [💥 4]
```

## Quick Picks Selection

Curated for comic use cases:

**Row 1 — Emotions:**
❤️ 💔 😱 😂 😡 💀 😢 💧

**Row 2 — Action/Effects:**
💥 ⚡ 🔥 ✨ 💢 ⭐ 💨 💫

**Row 3 — Symbols:**
❗ ❓ 💡 🎵 💬 💭 ➡️ 👆

That's 24 quick picks — covers most comic situations. "More..." opens the full emoji keyboard for everything else.

## Implementation Details

### addSticker function

```typescript
const addSticker = (emoji: string) => {
  if (!selectedPanelId) return;
  const newBubble: Bubble = {
    id: crypto.randomUUID(),
    text: emoji,
    pos: { x: 50, y: 50 },
    style: "sticker",
    fontSize: 48,
    fontWeight: "normal",
    fontStyle: "normal",
  };
  setPanels((prev) =>
    prev.map((p) =>
      p.id === selectedPanelId
        ? { ...p, bubbles: [...(p.bubbles || []), newBubble] }
        : p,
    ),
  );
  setSelectedBubbleId(newBubble.id);
  setShowEmojiPicker(false);
};
```

### Sticker picker state

```typescript
const [showEmojiPicker, setShowEmojiPicker] = useState(false);
```

### DraggableBubble changes

In the render section, add a sticker branch:

```tsx
// Inside the inner bubble div, before the existing text rendering:
{bubble.style === "sticker" ? (
  <span style={{ fontSize: `${bubble.fontSize}px`, lineHeight: 1 }}>
    {bubble.text}
  </span>
) : isPopText ? (
  // ...existing
```

The outer div for stickers should have no background, no border, no padding:

```tsx
className={`cursor-grab active:cursor-grabbing ${
  isSelected && !isExporting ? "ring-2 ring-primary ..." : ""
} ${bubble.style === "sticker" ? "" : isSFX || isPopText ? "" : ...}`}
```

## Files to Modify

| File                            | Change                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/services/geminiService.ts` | Add `"sticker"` to Bubble style union                                                                    |
| `src/screens/EditorScreen.tsx`  | Emoji picker UI, `addSticker()`, "+😀" button in toolbar + sidebar, sticker rendering in DraggableBubble |

## What This Does NOT Do

- No custom image stickers (use emoji only)
- No sticker search (use "More..." for the native keyboard which has its own search)
- No sticker packs or marketplace
- No animated emoji
- No sticker-specific bake behavior (bake treats them like any other overlay)

## Why Not a Full Sticker System

- Zero bundle size vs 500KB+ of sticker PNGs
- The emoji catalog is bigger than any sticker pack we could ship
- Users already know how to find emoji
- Implementation is ~50 lines of new code vs a full asset pipeline
