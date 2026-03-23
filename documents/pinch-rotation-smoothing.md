# Pinch Rotation Smoothing

## Problem

When pinch-zooming a panel image, the image sometimes snaps to 180° rotation aggressively. The rotation feels jarring and uncontrollable — a small finger twist during zoom causes a massive rotation jump.

This affects **panel images** (PanelImage component) primarily. Bubble rotation has a 35° deadzone that helps, but the panel image pinch has no such protection.

## Current Code

### Panel Image Pinch (PanelImage component, ~line 96)

```typescript
onPinch: ({ offset: [s], da: [, a], event, last }) => {
  if (isExporting || locked) return;
  event?.preventDefault();
  tRef.current.scale = Math.min(4.2, Math.max(0.5, s));
  const rawAngle = baseRotation.current + a;
  tRef.current.rotation =
    Math.abs(rawAngle % 360) < 10 || Math.abs(rawAngle % 360) > 350
      ? 0
      : Math.round(rawAngle);
  applyTransform();
  if (last) onTransform(panel.id, { ...tRef.current });
},
```

**Problems:**

1. **No deadzone** — any finger twist immediately rotates. The `a` (angle) value from `@use-gesture` represents the cumulative angle change since pinch start, so even small involuntary finger movements during zoom add up
2. **Snap to 0 only at ±10°** — the snap window is too narrow, so the image often ends up at random small angles
3. **No rotation speed limit** — if `a` jumps (common with imprecise touch), rotation follows instantly
4. **`rawAngle` is cumulative** — `baseRotation.current + a` means every pinch gesture adds to the previous rotation, so errors compound

### Bubble Pinch (~line 537)

```typescript
bubbleRotAccum.current = a;
const absAccum = Math.abs(bubbleRotAccum.current);
if (absAccum > 35) {
  newRotation = Math.round(bubblePinchRotBase.current + bubbleRotAccum.current);
  // Snap to 0 near 0°/360°
}
```

The 35° deadzone helps but the rotation still jumps once the threshold is crossed.

## Root Cause

`@use-gesture`'s pinch `da` (delta angle) reports the cumulative angle between the two touch points since gesture start. On mobile, fingers naturally twist during zoom — even when the user only intends to zoom, not rotate. The library reports this twist faithfully, but the user didn't mean it.

## Proposed Fixes

### Fix 1: Large Deadzone for Panel Images (Recommended)

Add the same deadzone approach as bubbles, but bigger — 45°+ before rotation kicks in:

```typescript
onPinchStart: () => {
  baseRotation.current = tRef.current.rotation || 0;
  rotAccum.current = 0;
},
onPinch: ({ offset: [s], da: [, a], event, last }) => {
  if (isExporting || locked) return;
  event?.preventDefault();
  tRef.current.scale = Math.min(4.2, Math.max(0.5, s));

  // Only rotate after 45°+ intentional twist
  rotAccum.current = a;
  if (Math.abs(rotAccum.current) > 45) {
    const rawAngle = baseRotation.current + a;
    tRef.current.rotation =
      Math.abs(rawAngle % 360) < 15 || Math.abs(rawAngle % 360) > 345
        ? 0
        : Math.round(rawAngle);
  }
  // else: don't touch rotation at all

  applyTransform();
  if (last) onTransform(panel.id, { ...tRef.current });
},
```

**Pros:** Simple, matches bubble pattern, eliminates accidental rotation during zoom.
**Cons:** Intentional rotation requires a bigger twist.

### Fix 2: Disable Panel Image Rotation Entirely

Most users don't need to rotate panel images — they just want to zoom and pan. Remove rotation from the panel pinch handler:

```typescript
onPinch: ({ offset: [s], event, last }) => {
  if (isExporting || locked) return;
  event?.preventDefault();
  tRef.current.scale = Math.min(4.2, Math.max(0.5, s));
  // No rotation at all
  applyTransform();
  if (last) onTransform(panel.id, { ...tRef.current });
},
```

**Pros:** Eliminates the problem completely. Simpler code.
**Cons:** Users who want rotated panels can't do it via pinch. (Could add a rotation control in the UI instead.)

### Fix 3: Rotation Rate Limiter

Clamp how fast rotation can change per frame — smooth out jumps:

```typescript
const maxRotPerFrame = 3; // degrees
const targetRotation = baseRotation.current + a;
const currentRotation = tRef.current.rotation || 0;
const diff = targetRotation - currentRotation;
const clampedDiff = Math.max(-maxRotPerFrame, Math.min(maxRotPerFrame, diff));
tRef.current.rotation = currentRotation + clampedDiff;
```

**Pros:** Rotation feels smooth and intentional.
**Cons:** Laggy if user actually wants fast rotation. More complex.

### Fix 4: Snap to 90° Increments Only

Only allow 0°, 90°, 180°, 270° — snap to nearest:

```typescript
const rawAngle = baseRotation.current + a;
if (Math.abs(a) > 30) {
  tRef.current.rotation = Math.round(rawAngle / 90) * 90;
}
```

**Pros:** Clean, predictable results. Comics often want 0° or 90° anyway.
**Cons:** No free rotation.

## Recommendation

**Fix 1 (deadzone) + Fix 2 as default:**

- **Panel images: disable rotation by default.** Panel images almost never need to be rotated — they're already generated at the right orientation. Remove rotation from the panel pinch handler entirely.
- **Bubbles: keep the 35° deadzone** (already implemented). This works well enough.

If we ever need panel rotation, add it as an explicit UI control (a rotation slider or rotate button) rather than a gesture — gestures are too imprecise for this.

## Files to Modify

| File                           | Change                                                     |
| ------------------------------ | ---------------------------------------------------------- |
| `src/screens/EditorScreen.tsx` | PanelImage onPinch: remove rotation logic, keep scale only |
