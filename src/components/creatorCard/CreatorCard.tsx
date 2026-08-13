import { useCallback, useRef } from "react";
import "./creatorCard.css";

/**
 * CreatorCard — the card face. Port of
 * Comic-Pro2/src/components/CreatorCard/CreatorCard.jsx.
 *
 * Deliberately dumb: renders whatever tier/points/handle it is handed and owns
 * no fetching.
 *
 * TILT WORKS ON TOUCH — it is Pointer Events, not hover. Dragging a finger
 * across the card tilts it and drags the holo highlight with it, which is the
 * whole reason the card reads as foil rather than a picture of foil. We do NOT
 * preventDefault, so a scroll that happens to start on the card still scrolls
 * the page; it just tilts on the way past.
 *
 * Font and colour are intentionally NOT configurable ("curate, don't configure"
 * — recolouring is what breaks the coordinated look when a feed of these should
 * read as a card pack, not clip art).
 */

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Characters that can terminate the `url('…')` context and let the rest of the
 *  value be read as new CSS declarations. */
const CSS_URL_ESCAPES: Record<string, string> = {
  "'": "%27",
  '"': "%22",
  "(": "%28",
  ")": "%29",
  "\\": "%5C",
};

/**
 * Make a value safe to interpolate into `url('…')`.
 *
 * This guards a REAL boundary here, not a theoretical one: `artUrl` carries the
 * user's own uploaded image as a data URL (see CardArtEditor), so a
 * user-controlled string reaches a CSS value on every render.
 *
 * We escape rather than swap to an <img>: `--art` is the stylesheet's hook and
 * the scrim/holo/ring layers stack on top of it as a background, so the variable
 * has to stay.
 *
 * @returns safe to interpolate, or null if it must not be used
 */
function safeCssUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value === "") return null;
  // Reject control characters (newlines especially) by code point rather than a
  // regex literal: writing raw control bytes into a character class is how this
  // line silently became a NEGATED class on the first attempt upstream.
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return null;
  }
  return value.replace(/['"()\\]/g, (c) => CSS_URL_ESCAPES[c]);
}

/**
 * Art crop, as a percentage on top of `background-size: cover`.
 *
 * THIS IS DELIBERATE AND LOAD-BEARING — do not "fix" it back to 0. The card
 * scenes were generated with wordmark/overlay text baked into the artwork.
 * Cropping in ~20% pushes that text outside the card, which is why the scenes
 * never had to be regenerated. It is the FLOOR as well as the default: the
 * framing slider only ever crops further in, because anything below this value
 * puts the baked-in wordmark back on screen.
 */
export const CARD_ZOOM = 20;

/**
 * Upper bound for the framing slider. 60 = scale(1.60). Past roughly this point
 * a 1200px-longest-side upload starts visibly softening, and the crop is tight
 * enough that most subjects fall outside the frame.
 */
export const CARD_ZOOM_MAX = 60;

export type TierKey = "STARTER" | "PLUS" | "OG";

export const TIERS: Record<TierKey, { name: string; blurb: string; mod: string }> = {
  STARTER: {
    name: "Starter",
    blurb: "Handle claimed. Cool steel foil. The entry card.",
    mod: "",
  },
  PLUS: { name: "Plus", blurb: "Cyan foil. Most of the asks done.", mod: "ph-card--plus" },
  OG: {
    name: "OG",
    blurb: "Animated gold foil. Every ask done. The flex card.",
    mod: "ph-card--og",
  },
};

/** Tier from how many distinct asks are complete: 1 = Starter, 2-3 = Plus,
 *  all = OG. Only the four `ask` steps count — the funnel steps pay points but
 *  move no pip. */
export function tierFor(completedCount: number, totalActions: number): TierKey {
  if (totalActions > 0 && completedCount >= totalActions) return "OG";
  if (completedCount >= 2) return "PLUS";
  return "STARTER";
}

interface CreatorCardProps {
  tier?: TierKey;
  points?: number;
  handle?: string | null;
  artUrl?: string | null;
  memberId?: number | null;
  completed?: number;
  totalSteps?: number;
  /** Art crop percentage. Must be clamped to [CARD_ZOOM, CARD_ZOOM_MAX] by the
   *  caller — every render path has to pass the same value or the preview and
   *  the exported PNG diverge. */
  zoom?: number;
  /** Not claimed yet. Renders a mystery silhouette instead of the face. Callers
   *  should ALSO pass artUrl={null} so the scene is not even fetched before the
   *  claim — the reveal is the point, and fetching it early spoils it via the
   *  network tab. */
  locked?: boolean;
  /** The PNG-export node must be FLAT. html-to-image rasterises the live
   *  transform, so a card mid-tilt would be captured skewed. */
  disableTilt?: boolean;
}

export function CreatorCard({
  tier = "STARTER",
  points = 0,
  handle,
  artUrl,
  memberId,
  completed = 0,
  totalSteps = 4,
  zoom = CARD_ZOOM,
  locked = false,
  disableTilt = false,
}: CreatorCardProps) {
  const t = TIERS[tier] || TIERS.STARTER;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const holoRef = useRef<HTMLDivElement | null>(null);
  // Rejected art falls back to the gradient rather than rendering unsafely.
  const safeArt = safeCssUrl(artUrl);

  /**
   * Pointer tilt + holo tracking — the same constants as desktop: perspective
   * 900px, ±16deg on each axis from the pointer's position within the card,
   * lifted 6px toward the viewer. The holographic layer's gradient origin
   * follows the pointer, which is what sells it as foil catching light rather
   * than a static overlay.
   */
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const card = cardRef.current;
    if (!card || prefersReducedMotion()) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    card.style.transform =
      `perspective(900px) rotateY(${(px - 0.5) * 16}deg) ` +
      `rotateX(${-(py - 0.5) * 16}deg) translateZ(6px)`;
    if (holoRef.current) {
      holoRef.current.style.setProperty("--hx", `${px * 100}%`);
      holoRef.current.style.setProperty("--hy", `${py * 100}%`);
    }
  }, []);

  /**
   * Reset to a NEUTRAL 3D transform, not '' — visually identical (perspective
   * with no rotation is the identity), but it keeps the card inside its 3D
   * compositing layer. Clearing the transform outright demotes the layer once
   * the transition ends, and the resulting re-rasterise nudges raster children
   * by a subpixel — visible as the brand mark jittering on settle.
   *
   * ⚠️ BOUND TO pointerup/pointercancel AS WELL AS pointerleave, which desktop
   * does not need. A touch pointer ceases to exist on lift, and while browsers
   * do fire pointerleave for it, pointercancel is also reachable — the browser
   * fires it when it takes the gesture over for scrolling, and no pointerleave
   * follows. Without that binding the card would keep the tilt it had at the
   * moment a scroll was recognised, which is exactly the stuck-tilt failure
   * this component was (wrongly) assumed to have on touch.
   */
  const resetTilt = useCallback(() => {
    if (cardRef.current) {
      cardRef.current.style.transform =
        "perspective(900px) rotateY(0deg) rotateX(0deg)";
    }
  }, []);

  const styleVars = {
    ...(safeArt ? { "--art": `url('${safeArt}')` } : {}),
    "--ph-card-zoom": (1 + zoom / 100).toFixed(2),
  } as React.CSSProperties;

  return (
    <div
      ref={cardRef}
      className={`ph-card ${t.mod} ${locked ? "ph-card--locked" : ""}`}
      style={styleVars}
      onPointerMove={disableTilt ? undefined : handlePointerMove}
      onPointerLeave={disableTilt ? undefined : resetTilt}
      onPointerUp={disableTilt ? undefined : resetTilt}
      onPointerCancel={disableTilt ? undefined : resetTilt}
    >
      <div
        className={`ph-card__art ${safeArt ? "" : "ph-card__art--empty"}`}
        aria-hidden="true"
      />
      <div className="ph-card__scrim" aria-hidden="true" />
      <div ref={holoRef} className="ph-card__holo" aria-hidden="true" />
      <div className="ph-card__ring" aria-hidden="true" />

      {/* Unclaimed: a sealed card. Returns EARLY so no real value can leak into
          the DOM while locked. */}
      {locked ? (
        <div
          className="ph-card__locked"
          role="img"
          aria-label="Card locked, claim it to reveal your scene"
        >
          <span className="ph-card__locked-mark" aria-hidden="true">
            ?
          </span>
          <span className="ph-card__locked-text">Claim to reveal</span>
        </div>
      ) : (
        <div className="ph-card__face">
          <div className="flex items-start justify-between gap-2">
            <span className="ph-card__brand">
              {/* An <img> rather than a CSS background because that is the path
                  DOM rasterisers embed most reliably — a background on a
                  pseudo-element is what silently dropped the card art from
                  exports upstream. */}
              <img
                src="/images/ph-mark.png"
                alt=""
                aria-hidden="true"
                className="ph-card__brand-dot"
              />
              PANEL HAUS
            </span>
            <span className="ph-card__tier">{t.name}</span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="ph-card__points">{points.toLocaleString()}</span>
              <span className="ph-card__points-label">points</span>
            </div>

            <div className="ph-card__handle truncate mt-1">
              {handle ? `@${String(handle).replace(/^@/, "")}` : "unclaimed"}
            </div>

            <div className="ph-card__idrow">
              <span className="ph-card__member">
                {Number.isFinite(memberId as number)
                  ? `MEMBER #${String(memberId).padStart(4, "0")}`
                  : ""}
              </span>
              <span
                className="ph-card__pips"
                role="img"
                aria-label={`${completed} of ${totalSteps} steps complete`}
              >
                {Array.from({ length: totalSteps }, (_, i) => (
                  <span
                    key={i}
                    className={`ph-card__pip ${i < completed ? "ph-card__pip--on" : ""}`}
                  />
                ))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
