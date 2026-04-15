# Feature: Smudge the Dirty Sponge — New App Mascot

## Overview

Add **Smudge the Dirty Sponge** as a second mascot to the app. Smudge appears in
tooltips (rotating with Woodpecker) and ships as a default Character in the
Vault so new users see him when they open the app for the first time.

## Assets

18 pre-rendered webp images live at `public/Smudge_the_dirty_sponge/`:

```
01-dancing_b.webp   02-standing.webp    03-falling_b.webp   04-hiding.webp
05-stretching_b.webp 06-spinning.webp    07-lying_down.webp  08-walking.webp
09-sitting.webp     10-waving.webp      11-jumping.webp     12-thinking.webp
13-dancing.webp     14-falling.webp     15-cheering.webp    16-hiding.webp
17-stretching.webp  18-balancing.webp
```

Original PNGs (5.6MB total) converted to webp (792KB total, 86% smaller),
originals deleted. Images are 470×611 with alpha channel.

## Where Smudge appears

### 1. Tooltip mascot (rotating with Woodpecker)

Currently every Tip shows the `Woodpecker` SVG. We'll swap the mascot per tip
between Woodpecker (SVG) and Smudge (webp image).

**Mascot selection is deterministic per tip ID** — a stable hash of `id` picks
the mascot so a given tip always shows the same one (no flickering on re-mount).

**Which Smudge pose per tip?** Also deterministic by id — hash into the 18 poses
so Tip A always shows Smudge standing, Tip B always shows Smudge thinking, etc.
We could narrow to a subset of "tooltip-friendly" poses (waving, thinking,
cheering, standing) to keep the vibe appropriate for hints.

### 2. Default Vault character

Add a second entry to `DEFAULT_VAULT_ENTRIES` in `src/App.tsx` so new users have
Smudge available as a character. Use the `02-standing.webp` pose as his
reference image (clean, neutral front-facing pose).

### 3. First-run coach tip signed by Smudge

The very first coach tip a new user sees should introduce Smudge by name so he
becomes a recognizable personality from the start. Example:

> "Hey, I'm Smudge — the dirty sponge. I'll pop up now and then with tips.
> Tap 'Got it' to dismiss me. You can also turn these off in Settings."

**Implementation:** the first tip (tracked by a dedicated `panelshaq_met_smudge`
flag) always uses Smudge as the mascot regardless of the hash, and shows a
longer intro string instead of the normal tip copy. After it's dismissed, the
flag is set and subsequent tips fall back to the normal hash-based rotation.

Good candidates for the "first tip" slot: the Workshop onboarding tip, or a
brand-new standalone coach tip that shows on first app load.

## Files to create / change

| File                              | What                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/Smudge.tsx`       | **NEW** — component that picks a webp pose and renders it as an `<img>` at the given size. API mirrors `<Woodpecker size={18} />` |
| `src/components/Tip.tsx`          | Import Smudge, hash tip id to pick mascot (Woodpecker or Smudge)                                                                  |
| `src/App.tsx`                     | Add Smudge entry to `DEFAULT_VAULT_ENTRIES` using `/Smudge_the_dirty_sponge/02-standing.webp`                                     |
| `documents/smudge-mascot-plan.md` | This plan                                                                                                                         |

## Smudge component sketch

```tsx
import standingImg from "/Smudge_the_dirty_sponge/02-standing.webp"; // etc.

const POSES = [
  "/Smudge_the_dirty_sponge/02-standing.webp",
  "/Smudge_the_dirty_sponge/10-waving.webp",
  "/Smudge_the_dirty_sponge/12-thinking.webp",
  "/Smudge_the_dirty_sponge/15-cheering.webp",
  // ... subset of tooltip-friendly poses
];

function poseForSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return POSES[Math.abs(hash) % POSES.length];
}

export const Smudge: React.FC<{ size?: number; seed?: string }> = ({
  size = 18,
  seed = "",
}) => (
  <img
    src={poseForSeed(seed)}
    alt=""
    aria-hidden="true"
    className="shrink-0 object-contain"
    style={{ width: size, height: size }}
  />
);
```

## Mascot selection in Tip.tsx

```ts
function pickMascot(id: string): "woodpecker" | "smudge" {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return hash % 2 === 0 ? "woodpecker" : "smudge";
}
```

In render:

```tsx
{
  pickMascot(id) === "woodpecker" ? (
    <Woodpecker size={18} />
  ) : (
    <Smudge size={18} seed={id} />
  );
}
```

The same `id` is passed as `seed` so the pose is also stable per tip.

## Default vault entry

```ts
{
  id: "2",
  type: "Character",
  name: "Smudge",
  image: "/Smudge_the_dirty_sponge/02-standing.webp",
  description: "A grimy yellow kitchen sponge with bulging cartoon eyes and tiny brown boots. Pores and stains cover his body. Cartoon style with bold outlines.",
  personality: "Wise-cracking, sarcastic veteran. Tired but sharp-witted.",
  visualLook: "Rectangular yellow sponge body with darker brown grime patches. Small pores dotting the surface. Small brown boots. Cartoon proportions with oversized eyes.",
}
```

The image at `/Smudge_the_dirty_sponge/02-standing.webp` works directly as a
character reference — same flow as `/sample-304.webp` for Dev Guy.

## Scope limits

- Smudge in tooltips is a static image per tip (no animation between poses)
- Deterministic selection only — no user setting to pick favorite mascot
- Tooltip pose subset is small (4-6 poses) to keep vibe coherent
- No signature change to first-run coach tips

## Verification

1. Open any tooltip — should show either Woodpecker or a specific Smudge pose
2. Reload page — same tip shows the same mascot and pose as before
3. Open the app fresh — Smudge appears in the Vault alongside Dev Guy
4. Drop Smudge into a story — his description and image feed into panel generation
5. Toggle "disable tips" in Settings — both mascots hide
