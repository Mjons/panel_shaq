# Rotation Mode: Double-Tap Second Finger to Activate

## Problem

Current approach (skip first pinch, cooldown timer) doesn't work well:

- The "skip first pinch" isn't reliably firing as expected
- The 500ms cooldown adds complexity without solving the core issue
- Counters and timers are fragile with touch gesture libraries

The fundamental tension: `onPinchStart` fires for both "I want to zoom" and "I want to rotate", and we're trying to guess which one the user means.

## Proposed Solution: Explicit Rotation Mode

Stop guessing. Make rotation an explicit mode the user enters:

1. **First finger is already on the screen** (dragging or holding)
2. **Double-tap with second finger** (two quick taps while first finger stays down)
3. **Rotation mode activates** — visual indicator appears
4. **Each subsequent second-finger tap** rotates by the step amount
5. **Lifting all fingers** exits rotation mode

This is unambiguous — you can't accidentally rotate while zooming because zoom is a pinch-and-hold, not a double-tap.

## How It Works Technically

`@use-gesture` doesn't have a built-in "double-tap second finger" event. But we can detect it:

### Detection Logic

Track the timing of `onPinchStart` events. Two `onPinchStart` events within 400ms = double-tap second finger (because the user lifted and re-placed the second finger quickly while keeping the first finger down).

```typescript
const lastPinchStartTime = useRef(0);
const isRotationMode = useRef(false);

onPinchStart: () => {
  const now = Date.now();
  const timeSinceLast = now - lastPinchStartTime.current;
  lastPinchStartTime.current = now;

  if (timeSinceLast < 400) {
    // Double-tap second finger — enter rotation mode
    isRotationMode.current = true;
    // Rotate immediately on activation
    rotate();
  }
  // Single tap — just zoom, no rotation
},

onPinch: ({ last }) => {
  // Zoom logic always runs
  ...
  if (isRotationMode.current) {
    // Could also rotate during pinch if desired
  }
  if (last) {
    // Pinch ended — exit rotation mode
    isRotationMode.current = false;
  }
},
```

Wait — this still has the problem that the first `onPinchStart` of the "double tap" would be a regular pinch start. Let me rethink.

### Better Detection: Track pinch end → pinch start timing

```
Timeline:
  Finger 1 down (holding)
  Finger 2 down  → onPinchStart #1 (zoom)
  Finger 2 up    → onPinch last=true
  Finger 2 down  → onPinchStart #2 — if <400ms since last pinch end → ROTATION MODE
  Finger 2 up    → rotate step
  Finger 2 down  → onPinchStart #3 — still in rotation mode → rotate step
  ...
  Finger 1 up    → exit rotation mode
```

```typescript
const lastPinchEndTime = useRef(0);
const rotationModeActive = useRef(false);

onPinchStart: () => {
  const timeSincePinchEnd = Date.now() - lastPinchEndTime.current;

  if (timeSincePinchEnd < 400 && timeSincePinchEnd > 50) {
    // Quick re-tap of second finger — enter/stay in rotation mode
    rotationModeActive.current = true;
    rotate();
  }
  // else: normal pinch start, just zoom
},

onPinch: ({ offset: [s], last }) => {
  // Zoom always works
  scale = s;

  if (last) {
    lastPinchEndTime.current = Date.now();
    // Don't exit rotation mode here — user might tap again
  }
},
```

Rotation mode exits when enough time passes (>400ms without another pinch start), or when all fingers lift. Since we can't detect "all fingers up" directly in pinch events, we use the 400ms gap — if the next `onPinchStart` is >400ms after last end, it's a new zoom, not a rotation continuation.

### Visual Indicator

When `rotationModeActive` is true, show a subtle indicator:

- Small rotation icon (↻) near the element
- Or a brief toast: "Rotation mode — tap to rotate"
- Or the element gets a subtle animated ring

Keep it minimal — the user who double-tapped with a second finger knows what they're doing.

## Implementation

### For Panel Images (PanelImage component)

```typescript
const lastPinchEndTime = useRef(0);
const rotationModeActive = useRef(false);

useEffect(() => {
  rotationModeActive.current = false;
}, [panel.id, isSelected]);

onPinchStart: () => {
  if (isExporting || locked) return;
  const timeSincePinchEnd = Date.now() - lastPinchEndTime.current;
  if (timeSincePinchEnd < 400 && timeSincePinchEnd > 50) {
    rotationModeActive.current = true;
    const newRotation = (tRef.current.rotation || 0) + rotationStep;
    tRef.current.rotation =
      Math.abs(newRotation % 360) < rotationStep / 2 ? 0 : newRotation;
    applyTransform();
    onTransform(panel.id, { ...tRef.current });
  }
},

onPinch: ({ offset: [s], event, last }) => {
  if (isExporting || locked) return;
  event?.preventDefault();
  tRef.current.scale = Math.min(4.2, Math.max(0.5, s));
  applyTransform();
  if (last) {
    onTransform(panel.id, { ...tRef.current });
    lastPinchEndTime.current = Date.now();
  }
},
```

### For Bubbles (EditorScreen comic pinch)

Same pattern — track `lastPinchEndTime`, detect quick re-tap as rotation mode.

## Why This Is Better

| Approach                     | Problem                                                  |
| ---------------------------- | -------------------------------------------------------- |
| Rotate on every pinchStart   | Accidental rotation during zoom                          |
| Skip first pinch + counter   | Doesn't reliably work, adds complexity                   |
| 500ms cooldown               | Feels laggy, arbitrary threshold                         |
| **Double-tap second finger** | **Explicit intent, no false positives, natural gesture** |

The double-tap-second-finger gesture is:

- **Impossible to trigger accidentally** during normal zoom (zoom is pinch-and-hold, not tap-tap)
- **Easy to discover** once told about it (the hint text already explains it)
- **Fast to use** once you know it — tap-tap-tap to rotate in steps
- **No state management complexity** — just one timestamp ref

## Files to Modify

| File                           | Change                                                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/screens/EditorScreen.tsx` | Replace pinchCount/cooldown with lastPinchEndTime detection in both PanelImage and bubble pinch handlers. Remove counter refs and useEffects. |
