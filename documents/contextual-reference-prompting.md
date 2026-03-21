# Contextual Reference Prompting for Props & Vehicles

## Problem

Background references already have smart contextual prompting — the generation prompt tells the AI to use the background image for the **environment only** and to **ignore any people/characters** visible in it. This prevents the AI from accidentally reproducing background figures as panel characters.

Props and vehicles don't have this treatment. Their current prompts are generic:

```
Props in scene: Sword (A glowing blue longsword). Include these objects as shown in their reference images.
```

```
Vehicles in scene: Motorcycle (Sleek black cyberpunk bike). Include these vehicles as shown in their reference images.
```

This means if a prop reference image shows a person holding the prop, the AI may reproduce that person. If a vehicle reference shows a driver, the AI may copy the driver's appearance instead of using the panel's assigned characters.

## How Backgrounds Handle This (Reference Pattern)

**Line 1345-1346 in `DirectorScreen.tsx`:**

```typescript
const bgContext = selectedBg
  ? `Background/Setting: ${selectedBg.name}${selectedBg.description ? ` — ${selectedBg.description}` : ""}. Use this environment consistently. IMPORTANT: The background reference image is for the ENVIRONMENT ONLY — ignore any people, characters, or figures visible in it.`
  : "";
```

Key elements:

1. Names the asset and its description
2. Tells the AI what role it plays ("Use this environment consistently")
3. **Explicitly tells the AI what to ignore** ("ignore any people, characters, or figures")

## Proposed Changes

### Props Context (Line 1356-1358)

**Before:**

```typescript
const propContext =
  selectedProps.length > 0
    ? `Props in scene: ${selectedProps.map((p) => `${p.name}${p.description ? ` (${p.description})` : ""}`).join(", ")}. Include these objects as shown in their reference images.`
    : "";
```

**After:**

```typescript
const propContext =
  selectedProps.length > 0
    ? `Props/Objects in scene: ${selectedProps.map((p) => `${p.name}${p.description ? ` — ${p.description}` : ""}`).join("; ")}. Reproduce these objects with the exact visual style, shape, and details shown in their reference images. IMPORTANT: The prop reference images are for the OBJECTS ONLY — ignore any people, characters, hands, or figures holding/using the props. Only reproduce the object itself.`
    : "";
```

**What changed:**

- Switched to `—` and `;` separators for consistency with background pattern
- Added explicit instruction to match "visual style, shape, and details" (not just "as shown")
- Added the ignore clause: "ignore any people, characters, hands, or figures holding/using the props"
- Added "Only reproduce the object itself" for extra clarity
- Mentions "hands" specifically since prop photos often show someone gripping/holding the item

### Vehicles Context (Line 1368-1370)

**Before:**

```typescript
const vehicleContext =
  selectedVehicles.length > 0
    ? `Vehicles in scene: ${selectedVehicles.map((v) => `${v.name}${v.description ? ` (${v.description})` : ""}`).join(", ")}. Include these vehicles as shown in their reference images.`
    : "";
```

**After:**

```typescript
const vehicleContext =
  selectedVehicles.length > 0
    ? `Vehicles in scene: ${selectedVehicles.map((v) => `${v.name}${v.description ? ` — ${v.description}` : ""}`).join("; ")}. Reproduce these vehicles with the exact visual style, shape, color, and details shown in their reference images. IMPORTANT: The vehicle reference images are for the VEHICLES ONLY — ignore any drivers, passengers, people, or figures visible in or around the vehicles. Only reproduce the vehicle itself. Characters from the panel's character list should be shown operating the vehicle instead.`
    : "";
```

**What changed:**

- Same formatting consistency (`—`, `;`)
- Added "color" to the match list (vehicles are very color-identifiable)
- Added the ignore clause: "ignore any drivers, passengers, people, or figures visible in or around the vehicles"
- Added redirection: "Characters from the panel's character list should be shown operating the vehicle instead" — this explicitly tells the AI to swap in the correct characters

## Why This Matters

| Scenario                                | Without fix                   | With fix                                      |
| --------------------------------------- | ----------------------------- | --------------------------------------------- |
| Prop ref: sword held by a knight        | AI might reproduce the knight | AI reproduces only the sword                  |
| Prop ref: phone on a table with hands   | AI might reproduce the hands  | AI reproduces only the phone                  |
| Vehicle ref: car with driver visible    | AI might reproduce the driver | AI uses panel's assigned characters as driver |
| Vehicle ref: bike parked next to person | AI might include that person  | AI only reproduces the bike                   |

## Implementation

### Files to modify

Only one file: `src/screens/DirectorScreen.tsx`

### Changes

Two string replacements — the `propContext` and `vehicleContext` template literals. No new state, no UI changes, no API changes.

### Testing

1. Create a prop entry with a reference image that includes a person (e.g., someone holding a weapon)
2. Assign that prop to a panel with a different character
3. Generate — verify the prop appears but the person from the ref image does not
4. Repeat for vehicles with a driver visible in the reference

## Global Reference Limit (Implemented)

Maximum **5 reference images** per panel across all vault asset types combined:

- Characters (selected from vault)
- Custom uploaded references
- Background (0 or 1)
- Props
- Vehicles

**Behavior:**

- A `References: 3/5` counter is shown above the character section
- When at the limit, selecting additional assets in any category is silently blocked
- Deselecting always works regardless of limit
- Custom ref uploads show an alert when at limit
- Counter turns primary-colored when at the limit

**Why 5:** Gemini image generation quality degrades with too many reference images. Five gives enough for a character or two, a background, and a prop/vehicle without overwhelming the model.

## Consistency Summary

After this change, all four vault asset types follow the same prompting pattern:

| Asset Type     | Role instruction                                               | Ignore clause                                                                          |
| -------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Character**  | "Characters present: [names]"                                  | N/A (characters are meant to be reproduced)                                            |
| **Background** | "Use this environment consistently"                            | "ignore any people, characters, or figures visible in it"                              |
| **Prop**       | "Reproduce with exact visual style, shape, and details"        | "ignore any people, characters, hands, or figures holding/using the props"             |
| **Vehicle**    | "Reproduce with exact visual style, shape, color, and details" | "ignore any drivers, passengers, people, or figures visible in or around the vehicles" |
