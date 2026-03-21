# Bubble Interaction — Tail Direction & Positioning

## Current State

The floating toolbar (DraggableBubble) already handles:

- Type selection (Speech / Thought / SFX)
- Text input
- Font size (A- / A+)
- Delete
- Dismiss (✓)
- Drag to reposition

**Missing:**

- Tail direction control (which way the speech bubble tail points)
- No visual indicator of where the tail is pointing
- Tail position is stored in `tailPos` but there's no UI to set it

## The Tail Problem

Speech bubbles have a small triangle "tail" that points toward the speaker. Currently:

- `bubble.tailPos` stores `{ x, y }` in percentage coordinates
- The tail renders as a tiny rotated square (line 196-205 in EditorScreen)
- There's NO way for users to control it — it just defaults or stays wherever it was

Users need to point the tail at their character. This needs to be intuitive — not a slider, not coordinates.

---

## Option A: Directional Pad (8-Way)

Add a small 8-direction pad to the floating toolbar. User taps a direction, tail points that way.

```
        ↑
    ↖  ↑  ↗
    ← [●] →
    ↙  ↓  ↘
        ↓
```

Each tap sets `tailPos` to a fixed offset from the bubble center in that direction.

**Mapping:**
| Direction | tailPos offset |
|---|---|
| ↑ Top | `{ x: pos.x, y: pos.y - 15 }` |
| ↗ Top-right | `{ x: pos.x + 15, y: pos.y - 15 }` |
| → Right | `{ x: pos.x + 15, y: pos.y }` |
| ↘ Bottom-right | `{ x: pos.x + 15, y: pos.y + 15 }` |
| ↓ Bottom | `{ x: pos.x, y: pos.y + 15 }` |
| ↙ Bottom-left | `{ x: pos.x - 15, y: pos.y + 15 }` |
| ← Left | `{ x: pos.x - 15, y: pos.y }` |
| ↖ Top-left | `{ x: pos.x - 15, y: pos.y - 15 }` |
| ● Center (none) | `null` (no tail) |

**UI in the floating toolbar:**

```
┌─────────────────────────────┐
│ [Speech] [Thought] [SFX]   │
│ ┌─────────────────────────┐ │
│ │ Type text here...       │ │
│ └─────────────────────────┘ │
│                             │
│  Tail: ↖ ↑ ↗               │
│         ← ● →               │
│         ↙ ↓ ↘               │
│                             │
│ [A-] 14px [A+]  [🗑] [✓]   │
└─────────────────────────────┘
```

**Pros:**

- Dead simple, fits in the existing toolbar
- 9 options is enough for any direction
- No extra gestures, just tap
- Works great on mobile (big touch targets)
- Only shows for Speech type (not Thought/SFX)

**Cons:**

- Fixed offsets — can't fine-tune exact position
- 8 directions might not be enough for precise pointing

---

## Option B: Draggable Tail Handle

Show a small draggable handle at the end of the tail. User drags it to point at the speaker.

```
    ┌──────────┐
    │  Hello!  │
    └────┬─────┘
         │
         ◯ ← drag this handle
```

**How:**

- When bubble is selected, render a small circle at `tailPos`
- The circle is draggable (separate drag handler from bubble drag)
- Dragging updates `tailPos` in real-time
- The tail triangle follows the handle

**Pros:**

- Most intuitive — "drag the tail where you want it"
- Pixel-perfect positioning
- Visual feedback in real-time

**Cons:**

- Two drag targets on the same element (bubble body vs tail handle) can conflict on mobile
- Small handle is hard to tap on phone
- More complex implementation

---

## Option C: Tap-to-Point (Tap on Panel)

When editing a speech bubble, the next tap on the panel sets the tail direction.

**How:**

1. User taps bubble → toolbar opens
2. User taps "Point tail" button in toolbar
3. UI enters "pointing mode" — cursor changes, hint shows "Tap where the speaker is"
4. User taps somewhere on the panel
5. Tail now points toward that spot
6. Mode exits automatically

**Pros:**

- Most natural — "tap where the character is"
- Extremely precise
- No small handles to miss

**Cons:**

- Extra mode/state to manage
- "Point tail" button might not be obvious
- Conflicts with panel selection taps

---

## Recommendation: Option A (Directional Pad)

**Why:**

- Fits cleanly in the existing floating toolbar
- Zero new gestures or modes to learn
- 8 directions covers 99% of use cases (you're pointing at a character above, below, left, or right)
- Tiny implementation — just 9 buttons and a `tailPos` setter
- Mobile-friendly (big tap targets in a grid)
- Only shows for speech bubbles (thought and SFX don't have tails)

**Implementation:**

Add to the floating toolbar in DraggableBubble, between the text input and the font size row:

```tsx
{
  /* Tail direction — only for speech bubbles */
}
{
  bubble.style === "speech" && (
    <div className="space-y-1">
      <p className="text-[8px] text-accent/40 text-center">Tail Direction</p>
      <div className="grid grid-cols-3 gap-0.5 w-16 mx-auto">
        {[
          { label: "↖", dx: -15, dy: -15 },
          { label: "↑", dx: 0, dy: -15 },
          { label: "↗", dx: 15, dy: -15 },
          { label: "←", dx: -15, dy: 0 },
          { label: "×", dx: 0, dy: 0 }, // no tail
          { label: "→", dx: 15, dy: 0 },
          { label: "↙", dx: -15, dy: 15 },
          { label: "↓", dx: 0, dy: 15 },
          { label: "↘", dx: 15, dy: 15 },
        ].map(({ label, dx, dy }) => (
          <button
            key={label}
            onClick={() => {
              if (dx === 0 && dy === 0) {
                onUpdateBubble({ tailPos: undefined });
              } else {
                onUpdateBubble({
                  tailPos: {
                    x: bubble.pos.x + dx,
                    y: bubble.pos.y + dy,
                  },
                });
              }
            }}
            className="w-5 h-5 flex items-center justify-center rounded
            text-[10px] bg-background border border-outline/20
            hover:bg-primary hover:text-background transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Files to Change

| File                                             | Change                                      |
| ------------------------------------------------ | ------------------------------------------- |
| `src/screens/EditorScreen.tsx` (DraggableBubble) | Add tail direction grid to floating toolbar |

That's it. One component, ~30 lines.
