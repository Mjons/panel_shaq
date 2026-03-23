# Rotation Step Setting

## Problem

Rotation on 2-finger tap is hardcoded:

- **Panel images:** 10° per tap (`EditorScreen.tsx:96`)
- **Bubbles:** 5° per tap (`EditorScreen.tsx:538`)

Some users want fine control (1-2° steps for precise alignment), others want fast rotation (15-45° for quick comic effects). There's no way to change this without editing code.

## Solution

Add a **"Rotation Step"** setting to the Settings screen. One global value that controls both panel image and bubble rotation per tap.

---

## UI Design

Add to the Settings screen under a new "Editor" section:

```
┌──────────────────────────────────────┐
│  EDITOR                              │
│                                      │
│  Rotation per tap                    │
│  [ 1° ][ 5° ][ 10° ][ 15° ][ 45° ] │
│                                      │
│  How many degrees each 2-finger tap  │
│  rotates images and bubbles.         │
└──────────────────────────────────────┘
```

- **Segmented button group** (like the existing panels-per-page selector)
- Preset options: **1°, 5°, 10°, 15°, 45°**
- Default: **10°** (matches current behavior)
- Helper text below explaining the control

### Why presets instead of a slider?

- Slider is fiddly on mobile
- These 5 values cover the real use cases:
  - **1°** — precision alignment
  - **5°** — fine tuning (current bubble default)
  - **10°** — general use (current image default)
  - **15°** — quick adjustments
  - **45°** — snappy comic angles (0°, 45°, 90°, etc.)

---

## Implementation

### 1. Add to AppSettings

```typescript
export interface AppSettings {
  // ... existing fields
  rotationStep: number; // degrees per 2-finger tap
}

const DEFAULT_SETTINGS: AppSettings = {
  // ... existing defaults
  rotationStep: 10,
};
```

### 2. Read in EditorScreen

Both rotation handlers already live in `EditorScreen.tsx`. Read the setting once:

```typescript
const rotationStep = useMemo(() => {
  try {
    const s = localStorage.getItem("panelshaq_settings");
    return s ? JSON.parse(s).rotationStep || 10 : 10;
  } catch {
    return 10;
  }
}, []);
```

### 3. Replace hardcoded values

**Panel image rotation** (line ~96):

```typescript
// Before
const newRotation = (tRef.current.rotation || 0) + 10;

// After
const newRotation = (tRef.current.rotation || 0) + rotationStep;
```

**Bubble rotation** (line ~538):

```typescript
// Before
const newRotation = (b.rotation || 0) + 5;

// After
const newRotation = (b.rotation || 0) + rotationStep;
```

### 4. Add UI to SettingsScreen

```tsx
{
  /* Rotation Step */
}
<div className="space-y-2">
  <label className="font-label text-[10px] text-accent/60 uppercase tracking-widest font-bold">
    Rotation per tap
  </label>
  <div className="bg-surface-container p-1 rounded-lg flex gap-1 border border-outline/10">
    {[1, 5, 10, 15, 45].map((deg) => (
      <button
        key={deg}
        onClick={() => updateSetting("rotationStep", deg)}
        className={`flex-1 px-2 py-2 rounded-md text-[10px] font-bold transition-all ${
          settings.rotationStep === deg
            ? "bg-primary text-background"
            : "text-accent/50 hover:text-accent"
        }`}
      >
        {deg}°
      </button>
    ))}
  </div>
  <p className="text-[9px] text-accent/30">
    Degrees per 2-finger tap on images and bubbles
  </p>
</div>;
```

### 5. Update help text

In the Navigation help panel, the gesture description currently says:

> "2-finger tap: rotate (10° images, 5° bubbles)"

Change to:

> "2-finger tap: rotate (configurable in Settings)"

---

## Files to Change

| File                             | Changes                                                           |
| -------------------------------- | ----------------------------------------------------------------- |
| `src/screens/SettingsScreen.tsx` | Add `rotationStep` to interface/defaults, add segmented picker UI |
| `src/screens/EditorScreen.tsx`   | Read `rotationStep` from settings, replace hardcoded 10 and 5     |
| `src/components/Navigation.tsx`  | Update help text for rotation gesture                             |

---

## Scope

- Single setting controls both image and bubble rotation (simpler, no reason to separate)
- No per-panel or per-bubble override — this is a global preference
- Backward compatible — missing `rotationStep` falls back to 10°
- The snap-to-zero behavior (`Math.abs(newRotation % 360) < 5 ? 0 : newRotation`) should adapt: snap when within half a step of 0°
