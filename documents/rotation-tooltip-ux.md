# Rotation Tooltip UX

## Problem

Rotation is a hidden gesture — users don't know that tapping with a second finger rotates things. There's no visual cue, no onboarding, nothing. They either discover it by accident (and get confused) or never find it at all.

Two rotation behaviors exist:

- **Panel images**: 10° per second-finger tap (when panel is unlocked)
- **Bubbles**: 5° per second-finger tap (when in edit mode or panel locked)

## Where to Show Hints

### Option A: Inline hint on the lock/unlock button area

When the panel is unlocked (image moveable), show a tiny hint near the lock icon:

```
🔓  Drag to move • 2-finger tap to rotate
```

When locked:

```
🔒  Locked — tap bubbles to edit
```

**Pros:** Always visible, contextual.
**Cons:** Clutters the panel.

### Option B: First-time tooltip (one-shot)

Show a floating tooltip the first time the user unlocks a panel:

```
┌─────────────────────────────────┐
│ Tip: Tap with a second finger   │
│ to rotate the image 10° at     │
│ a time.                         │
│                        [Got it] │
└─────────────────────────────────┘
```

Dismiss stores a localStorage flag. Never shows again.

**Pros:** Non-intrusive after first time.
**Cons:** Easy to miss or dismiss without reading.

### Option C: Hint in the fullscreen toolbar (Recommended)

In fullscreen panel editing mode, the toolbar already has Bubble / Lock / Bake / Done. Add a subtle hint text above the toolbar (like the existing "Lock the panel to freely move dialogue" hint):

**When panel is unlocked:**

```
Drag to reposition • 2-finger tap to rotate 10°
```

**When panel is locked:**

```
Tap bubbles to edit • 2-finger tap to rotate 5°
```

**When no bubble selected and panel locked:**

```
Lock the panel to freely move dialogue
```

This reuses the existing hint area and changes based on context.

### Option D: Add rotation info to the Help panel

Add a "Gestures" section to the Help panel in the sidebar menu:

```
GESTURES
• Drag: move panel image or bubble
• Pinch: zoom panel image or resize bubble text
• 2-finger tap: rotate (10° for images, 5° for bubbles)
• Double-tap: fullscreen panel editing
```

**Pros:** Always accessible, comprehensive.
**Cons:** Users have to go find it.

## Recommendation

**Option C + D combined:**

1. **Contextual hint above the fullscreen toolbar** — changes based on state (unlock/lock, what's selected). Users see it exactly when they need it.
2. **Gestures section in the Help panel** — comprehensive reference for all touch interactions.

### Implementation for Option C

Replace the current single hint with context-aware text:

```tsx
// Above the fullscreen toolbar
{
  !isLocked && !selectedBubbleId && (
    <p className="text-center text-[9px] text-accent/30 mb-1.5">
      Drag to reposition • 2-finger tap to rotate
    </p>
  );
}
{
  !isLocked && selectedBubbleId && (
    <p className="text-center text-[9px] text-accent/30 mb-1.5">
      Lock panel to freely move bubbles
    </p>
  );
}
{
  isLocked && !selectedBubbleId && (
    <p className="text-center text-[9px] text-accent/30 mb-1.5">
      Tap a bubble to edit • 2-finger tap to rotate
    </p>
  );
}
{
  isLocked && selectedBubbleId && (
    <p className="text-center text-[9px] text-accent/30 mb-1.5">
      Drag to move bubble • 2-finger tap to rotate
    </p>
  );
}
```

Or simplified as one dynamic line:

```tsx
<p className="text-center text-[9px] text-accent/30 mb-1.5">
  {isLocked
    ? selectedBubbleId
      ? "Drag to move • 2-finger tap to rotate 5°"
      : "Tap a bubble to edit • 2-finger tap rotates 5°"
    : "Drag to reposition • 2-finger tap to rotate 10°"}
</p>
```

### Implementation for Option D

Add to the Help panel in Navigation.tsx:

```tsx
<div>
  <p className="font-label text-primary ...">Gestures</p>
  <ul className="space-y-1 list-disc list-inside">
    <li>Drag: move panel image or bubble</li>
    <li>Pinch: zoom image or resize bubble text</li>
    <li>2-finger tap: rotate (10° images, 5° bubbles)</li>
    <li>Double-tap panel: fullscreen editing</li>
  </ul>
</div>
```

## Files to Modify

| File                            | Change                                                                |
| ------------------------------- | --------------------------------------------------------------------- |
| `src/screens/EditorScreen.tsx`  | Replace static hint with context-aware rotation tooltip in fullscreen |
| `src/components/Navigation.tsx` | Add Gestures section to Help panel                                    |
