/**
 * Creator Card art pool — port of Comic-Pro2/src/components/CreatorCard/cardArt.js.
 *
 * Served from public/cards/, matching the CSS hook (`--art: url('/cards/…')`).
 * Every scene is portrait ~5:7 with the character weighted to the upper
 * two-thirds, so the card's bottom-third scrim keeps points and handle legible.
 *
 * ⚠️ THESE MUST STAY SAME-ORIGIN. "Post your card" rasterises the card with
 * html-to-image, which requires fetching the art and inlining it as a data URL.
 * Pointing these at panelhaus.app would fail CORS and the shared card would come
 * out with a blank background.
 *
 * ASSIGNMENT IS DETERMINISTIC, not random: the same user must always get the
 * same scene, or their card would change under them between sessions and stop
 * feeling like a collectible they own. The list and the hash are byte-identical
 * to desktop's so one person gets ONE card across both apps.
 */

export const CARD_ART = [
  "/cards/blossom-monk.png",
  "/cards/jungle-ranger.png",
  "/cards/pirate-captain.png",
  "/cards/shadow-ninja.png",
  "/cards/sponge-archer.png",
  "/cards/sponge-hoverboard.png",
  "/cards/sponge-sakura-ninja.png",
  "/cards/sponge-steampunk-ronin.png",
  "/cards/sponge-tide-warden.png",
  "/cards/sponge-woodland.png",
  "/cards/street-tagger.png",
  "/cards/surfer.png",
  "/cards/vigilante-rooftop.png",
  "/cards/wolf-rider.png",
  "/cards/nx-01.png",
  "/cards/nx-02.png",
];

/**
 * Stable scene for a user. FNV-1a over the id — small, dependency-free, and well
 * distributed for short strings, which matters because the ids share long
 * prefixes ("web3:0x…", "email:…") that a naive sum would collide on.
 *
 * ⚠️ THE SEED IS THE PH-INTERNAL USER ID, not the Clerk id — it arrives as
 * `artSeed` on the card-state response. Hashing anything else (a Clerk id, an
 * email) deals a DIFFERENT scene than panelhaus.app deals the same person, and
 * the card stops being one object across the two apps. Returns null with no
 * seed, which renders the tier-coloured placeholder rather than a wrong card.
 */
export function artForUser(seed: string | null | undefined): string | null {
  if (!seed || !CARD_ART.length) return null;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return CARD_ART[hash % CARD_ART.length];
}
