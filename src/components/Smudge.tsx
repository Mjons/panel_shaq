import React from "react";

const BASE = "/Smudge_the_dirty_sponge";

// All available poses, keyed by short name for explicit selection.
export const SMUDGE_POSES = {
  "dancing-b": `${BASE}/01-dancing_b.webp`,
  standing: `${BASE}/02-standing.webp`,
  "falling-b": `${BASE}/03-falling_b.webp`,
  hiding: `${BASE}/04-hiding.webp`,
  "stretching-b": `${BASE}/05-stretching_b.webp`,
  spinning: `${BASE}/06-spinning.webp`,
  "lying-down": `${BASE}/07-lying_down.webp`,
  walking: `${BASE}/08-walking.webp`,
  sitting: `${BASE}/09-sitting.webp`,
  waving: `${BASE}/10-waving.webp`,
  jumping: `${BASE}/11-jumping.webp`,
  thinking: `${BASE}/12-thinking.webp`,
  dancing: `${BASE}/13-dancing.webp`,
  falling: `${BASE}/14-falling.webp`,
  cheering: `${BASE}/15-cheering.webp`,
  hiding2: `${BASE}/16-hiding.webp`,
  stretching: `${BASE}/17-stretching.webp`,
  balancing: `${BASE}/18-balancing.webp`,
} as const;

export type SmudgePose = keyof typeof SMUDGE_POSES;

// Subset used as the random fallback (neutral, cheerful, helpful poses)
const FALLBACK_POSES: SmudgePose[] = [
  "standing",
  "walking",
  "sitting",
  "waving",
  "thinking",
  "cheering",
  "balancing",
];

function poseForSeed(seed: string): SmudgePose {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return FALLBACK_POSES[Math.abs(hash) % FALLBACK_POSES.length];
}

export const Smudge: React.FC<{
  size?: number;
  seed?: string;
  pose?: SmudgePose;
}> = ({ size = 18, seed = "", pose }) => {
  const chosen = pose || poseForSeed(seed);
  return (
    <img
      src={SMUDGE_POSES[chosen]}
      alt=""
      aria-hidden="true"
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
};
