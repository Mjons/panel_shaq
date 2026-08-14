import { toBlob } from "html-to-image";
import { shareImage, type ShareResult } from "../../from-meme/memeShare";
import { CARD_ART } from "./cardArt";

/**
 * Rasterise the Creator Card and hand it to the OS share sheet.
 *
 * WHY A PNG AT ALL: X never renders our live page — no tilt, no foil, no
 * animation on a timeline — and you cannot pre-attach an image to a share
 * intent. So the postable artefact has to be a flat image the user actually
 * holds.
 *
 * WHY THE SHARE SHEET RATHER THAN DESKTOP'S CLIPBOARD+INTENT: desktop copies the
 * PNG then opens the X composer, and credits the ask when `window.open` returns
 * non-null. Both halves are unreliable on mobile — image-to-clipboard is poorly
 * supported on mobile Safari and Android webviews, and a popup-blocked
 * `window.open` returning null (or a wrapper returning a truthy stub) makes that
 * credit either impossible or free. The native sheet is the mobile-correct
 * surface and already handles X, Discord and Instagram.
 */

/** Let the browser paint the swapped-in art before we rasterise it. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

/**
 * Inline a card-art URL as a data URI.
 *
 * THIS IS NOT OPTIONAL. The art is painted by `background-image: var(--art)` on
 * the `.ph-card__art` PSEUDO-element, and DOM rasterisers have to re-fetch and
 * re-embed such backgrounds themselves — that is exactly the step that shipped
 * cards "with everything except the picture" upstream. Fetching it ourselves and
 * handing the export node a `data:` URL removes the fetch from html-to-image's
 * job entirely, so there is nothing left to fail.
 *
 * Works because the scenes are served same-origin from public/cards (see
 * cardArt.ts). A user upload is already a data URL and short-circuits.
 */
export async function inlineArt(src: string | null): Promise<string | null> {
  if (!src || src.startsWith("data:")) return src;
  const res = await fetch(src, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Could not load the card art (${res.status})`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("Could not read the card art"));
    fr.readAsDataURL(blob);
  });
}

/** True when this art path is one of ours (so inlining it can succeed). */
export function isBundledArt(src: string | null): boolean {
  return !!src && CARD_ART.includes(src);
}

/**
 * Render `node` to a PNG blob at 2x.
 *
 * `skipFonts` is deliberately NOT set: the card's numerals and mono labels are
 * the whole look, and dropping the webfonts would rasterise it in a fallback
 * face.
 *
 * ⚠️ THIS DEPENDS ON crossorigin="anonymous" ON THE FONT <link> IN index.html.
 * html-to-image finds @font-face rules by walking document.styleSheets and
 * reading .cssRules, which throws SecurityError on a sheet fetched in no-cors
 * mode — and it swallows that error, so the only symptom is an exported card in
 * the wrong typeface. Removing that attribute breaks this function silently.
 *
 * Expect SecurityError warnings in the console for the app's OTHER Google Fonts
 * sheets (Material Symbols, the comic display faces). Those are intentional:
 * the card does not use them, and embedding them would bloat every PNG.
 */
export async function renderCardToBlob(node: HTMLElement): Promise<Blob> {
  await nextPaint();
  const blob = await toBlob(node, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#0b0b12",
  });
  if (!blob) throw new Error("Could not render your card");
  return blob;
}

/**
 * Share the rendered card. Returns the share sheet's outcome so the caller can
 * decide whether the ask was earned — "cancelled" must NOT credit.
 */
export async function shareCard(blob: Blob): Promise<ShareResult> {
  return shareImage(blob, "panel-haus-creator-card.png", "creator_card");
}

/**
 * The post caption. Shape ported from desktop so a card posted from either app
 * reads the same.
 *
 * ⚠️ LINES 2 AND 3 ARE BUILT HERE, NOT IN THE HOOK LIST, and that is the whole
 * safeguard: the handle, the point count and the link are the only things the
 * post must carry, so keeping them out of the rotating string makes it
 * impossible for a new hook to drop one.
 */
export function buildCaption({
  handle,
  points,
}: {
  handle?: string | null;
  points?: number;
}): string {
  const at = handle ? `@${String(handle).replace(/^@/, "")}` : "";
  const pts = Number(points || 0).toLocaleString();
  return [
    pickCaptionHook(),
    `${at ? at + " · " : ""}${pts} points and climbing.`,
    "Make yours → panelhaus.app/creators",
  ].join("\n");
}

/**
 * Caption hooks. Four rules, and they are why this list is curated rather than
 * generated: one line, no emoji, no em dashes, and NO PROMISES ABOUT THE MINT —
 * a hook that implies a guaranteed allocation is a claim we would have to honour.
 */
const CAPTION_HOOKS = [
  "Dealt my Panel Haus Creator Card.",
  "Got my Creator Card. The number only goes up.",
  "Panel Haus Creator Card, claimed.",
  "New card, who dis.",
  "My Creator Card is looking healthy.",
  "Points go brrr.",
  "Claimed my card at Panel Haus.",
  "This is my Creator Card. There are many like it, but this one is mine.",
  "Card claimed. Foil earned.",
  "Been making comics. Here is the receipt.",
  "Creator Card secured.",
  "Panel Haus dealt me this one.",
  "Every ask done. Look at it.",
  "Collecting points like it is my job.",
  "My card levels up every time I ship.",
];

let lastHookIndex = -1;

/** Never the same hook twice in a row. */
export function pickCaptionHook(): string {
  if (CAPTION_HOOKS.length < 2) return CAPTION_HOOKS[0] ?? "";
  let i = Math.floor(Math.random() * CAPTION_HOOKS.length);
  if (i === lastHookIndex) i = (i + 1) % CAPTION_HOOKS.length;
  lastHookIndex = i;
  return CAPTION_HOOKS[i];
}

/** X composer with the caption pre-filled. Used by the download fallback, where
 *  the user pastes the image themselves. */
export function buildXIntentUrl(caption: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(caption)}`;
}
