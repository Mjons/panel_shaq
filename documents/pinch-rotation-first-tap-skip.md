# Skip Rotation on First Pinch Tap

## Problem

When you place a second finger to start a pinch (zoom/resize), the `onPinchStart` fires and immediately rotates the element. This means every zoom attempt also rotates — the user has to undo the rotation or accept it.

The user wants:

- **1st second-finger tap** → start pinch (zoom/resize only, no rotation)
- **2nd second-finger tap** → rotate by step amount
- **3rd tap** → rotate again, etc.

## Current Code

Both panel images and bubbles rotate in `onPinchStart`:

```typescript
// Panel image
onPinchStart: () => {
  if (!isExporting && !locked) {
    const newRotation = (tRef.current.rotation || 0) + rotationStep;
    tRef.current.rotation = ...;
  }
},

// Bubble
onPinchStart: () => {
  ...
  const newRotation = (b.rotation || 0) + rotationStep;
  updateBubble(selectedBubbleId, { rotation: ... });
},
```

`onPinchStart` fires every time a pinch gesture begins — including the very first one.

## The Challenge

`@use-gesture` fires `onPinchStart` once per pinch gesture. A pinch gesture starts when the second finger touches and ends when it lifts. So "first tap" vs "second tap" means tracking across separate pinch gestures.

## Proposed Fix: Track Pinch Count Per Session

Use a ref to count how many times `onPinchStart` fires since the element was selected. Skip rotation on the first one.

### For Panel Images (PanelImage component)

```typescript
const pinchCount = useRef(0);

// Reset when panel selection changes
useEffect(() => {
  pinchCount.current = 0;
}, [panel.id, isSelected]);

onPinchStart: () => {
  pinchCount.current += 1;
  if (!isExporting && !locked && pinchCount.current > 1) {
    // Rotate only on 2nd+ pinch
    const newRotation = (tRef.current.rotation || 0) + rotationStep;
    ...
  }
},
```

### For Bubbles (EditorScreen comic pinch)

```typescript
const bubblePinchCount = useRef(0);

// Reset when bubble selection changes
useEffect(() => {
  bubblePinchCount.current = 0;
}, [selectedBubbleId]);

onPinchStart: () => {
  if (!selectedBubbleId || !selectedPanel) return;
  ...
  bubblePinchCount.current += 1;
  if (b && bubblePinchCount.current > 1) {
    // Rotate only on 2nd+ pinch
    const newRotation = (b.rotation || 0) + rotationStep;
    ...
  }
},
```

## Why This Works

1. User taps panel → `pinchCount` resets to 0
2. User places second finger → `onPinchStart` fires, `pinchCount` becomes 1 → **skip rotation**, just zoom
3. User lifts second finger, places it again → `onPinchStart` fires, `pinchCount` becomes 2 → **rotate**
4. Repeat → each subsequent pinch start rotates

The natural flow: first pinch = "I want to zoom", subsequent pinches on the same element = "I want to rotate too".

## Edge Case: Rapid Pinch-Zoom Without Rotation

If the user keeps lifting and re-placing the second finger to do multiple zooms (without wanting rotation), they'll get unwanted rotation on the 2nd+ pinch.

**Mitigation:** Add a time window. If the second pinch starts within 500ms of the previous pinch ending, treat it as a continuation (zoom only). Only rotate if there's a deliberate pause between pinch gestures.

```typescript
const lastPinchEnd = useRef(0);

onPinchStart: () => {
  pinchCount.current += 1;
  const timeSinceLast = Date.now() - lastPinchEnd.current;
  if (!isExporting && !locked && pinchCount.current > 1 && timeSinceLast > 500) {
    // Rotate
  }
},
onPinch: ({ last }) => {
  ...
  if (last) lastPinchEnd.current = Date.now();
},
```

This way rapid pinch-zoom doesn't trigger rotation. Only a deliberate "lift, pause, tap again" rotates.

## Recommendation

**Simple version first:** Just skip the first pinch. The time window is a nice-to-have if users report accidental rotation during rapid zoom.

## Files to Modify

| File                           | Change                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/screens/EditorScreen.tsx` | Add `pinchCount` ref to PanelImage, `bubblePinchCount` ref to EditorScreen. Skip rotation when count is 1. Reset on selection change. |
