# Fix: Pinch-to-zoom accidentally triggering rotation

## Problem

On Wacom Cintiq (and likely other pen+touch screens), the user:

1. Taps/drags with one finger (pen) to reposition an image
2. Adds a second finger to begin a pinch-to-zoom
3. Zoom works briefly, then the image **snaps to a rotation** unexpectedly

The rotation is too easy to trigger during normal zoom gestures.

## Root cause

Rotation uses a **double-tap-of-pinch** gesture: it fires on `onPinchStart` if the
time since the last `onPinchEnd` is between 50ms and 400ms. This is in two places:

- **`PanelImage`** (line ~113-122) — rotates the panel image
- **`bindComicPinch`** (line ~671-688) — rotates speech bubbles

```ts
// PanelImage — onPinchStart
const timeSinceEnd = Date.now() - lastPinchEndTime.current;
if (timeSinceEnd < 400 && timeSinceEnd > 50) {
  const newRotation = (tRef.current.rotation || 0) + rotationStep;
  tRef.current.rotation = ...;
}
```

The problem: on Wacom/touch screens, a pinch gesture can **briefly break and
re-establish** as fingers adjust grip. The library fires `onPinchEnd` then
`onPinchStart` in rapid succession (~100-300ms), which falls inside the
50-400ms window and is misinterpreted as a deliberate "two-finger double tap to
rotate."

## Proposed fix

### 1. Add a movement guard to distinguish zoom-continuation from intentional rotate tap

Track whether the previous pinch gesture involved significant scale change. If the
user was actively zooming (scale delta > threshold) right before the pinch ended,
the next quick `onPinchStart` is a grip adjustment, not a rotation intent.

**In `PanelImage`:**

```ts
// Add ref to track whether previous pinch was a real zoom
const lastPinchWasZoom = useRef(false);

// In onPinch — track whether meaningful zoom occurred
onPinch: ({ offset: [s], movement: [ms], event, last }) => {
  ...
  if (last) {
    lastPinchWasZoom.current = Math.abs(ms) > 0.05; // meaningful scale change
    lastPinchEndTime.current = Date.now();
  }
}

// In onPinchStart — skip rotation if previous pinch was a zoom
onPinchStart: () => {
  const timeSinceEnd = Date.now() - lastPinchEndTime.current;
  if (timeSinceEnd < 400 && timeSinceEnd > 50 && !lastPinchWasZoom.current) {
    // Only rotate if previous pinch was a tap (no zoom movement)
    ...
  }
}
```

### 2. Tighten the timing window

Reduce the upper bound from 400ms to 300ms. A deliberate double-tap is fast; a
grip re-adjustment during zoom tends to be slower.

```ts
if (timeSinceEnd < 300 && timeSinceEnd > 50 && !lastPinchWasZoom.current) {
```

### 3. Apply the same fix to bubble rotation in `bindComicPinch`

Same pattern — add `bubbleLastPinchWasZoom` ref, set it in `onPinch` on `last`,
check it in `onPinchStart`.

## Files to change

| File                           | Location                              | What                                   |
| ------------------------------ | ------------------------------------- | -------------------------------------- |
| `src/screens/EditorScreen.tsx` | `PanelImage` component (~line 83-133) | Add zoom-guard to panel image rotation |
| `src/screens/EditorScreen.tsx` | `bindComicPinch` (~line 669-711)      | Add zoom-guard to bubble rotation      |

## Verification

1. Pinch to zoom a panel image — should zoom without triggering rotation
2. Quick two-finger tap (no zoom movement) — should still rotate by step
3. Pinch to resize a bubble — should resize without rotating
4. Quick two-finger tap on bubble — should still rotate by step
5. Test on both touch screen and trackpad

## Scope

- Two refs added per gesture handler (`lastPinchWasZoom`)
- One condition added to each rotation gate
- Timing constant change (400 → 300)
- No new dependencies, no UI changes
