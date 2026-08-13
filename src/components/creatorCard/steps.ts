import type { CardActionId } from "../../services/creatorCard";

/**
 * The Creator Card's rows — port of the STEPS array in
 * Comic-Pro2/src/components/CreatorCard/CreatorCardModal.jsx:58-150.
 *
 * ORDER MATTERS: claim is FIRST. It is the only ask that unlocks the card itself
 * (everything else renders behind a padlock until it lands), so it has to be the
 * first thing asked — a list that opens with "follow us" in front of a card you
 * cannot see yet buries the one action that makes the rest mean anything.
 * Reordering is otherwise safe: pips only COUNT completed asks and the tier
 * reads that count, so neither depends on position.
 *
 * ⚠️ `points` MUST MATCH api/_lib/creatorCard.js UPSTREAM. The honour asks add
 * their value optimistically on tap and then reconcile against the server's
 * `balance`, so a mismatch shows up as the number visibly jumping. That table is
 * the one that actually awards; this is display + optimism only.
 *
 * ⚠️ Do NOT `.slice()` or filter this list to "clean it up". `mint` looks
 * inert but is a deliberate teaser row, and the two `go` rows pay points even
 * though they light no pip.
 */

export type StepKind = "ask" | "go" | "soon";

export interface Step {
  n: number;
  /** `mint` has no server action — it is display-only, hence the wider type. */
  id: CardActionId | "mint";
  kind: StepKind;
  /** Honour system: no server-side evidence exists, we award on the tap. */
  honor?: boolean;
  label: string;
  hint: string;
  /** Shown in place of `hint` when Discord OAuth isn't configured upstream. */
  hintOff?: string;
  subHint?: string;
  points?: number;
  /** What to advertise when it differs from what the server awards. */
  displayPoints?: number;
  href?: string;
}

export const STEPS: Step[] = [
  {
    n: 1,
    id: "claim_card",
    kind: "ask",
    label: "Claim your card",
    hint: "Connect Discord, your name goes on it",
    hintOff: "Discord isn't configured yet",
    points: 20,
  },
  {
    n: 2,
    id: "follow_x",
    kind: "ask",
    honor: true,
    label: "Follow @panelhausapp",
    hint: "Honor system, opens X",
    // Shows the destination, so the row isn't a button that goes somewhere
    // unstated.
    subHint: "x.com/panelhausapp",
    points: 20,
    href: "https://x.com/intent/follow?screen_name=panelhausapp",
  },
  {
    n: 3,
    id: "share_card",
    kind: "ask",
    honor: true,
    label: "Post your card",
    hint: "Quote-post it with your referral link",
    points: 15,
  },
  {
    n: 4,
    id: "refer_friends",
    kind: "ask",
    label: "Refer two friends",
    // This row IS the referral link — tapping copies it. There is no separate
    // referral panel: the code alone is useless, it only works as a link.
    hint: "Click to copy your link",
    // 25 is what the SERVER awards for the ask itself. Each signup separately
    // pays the referrer 10, so finishing this ask is really 25 + 2x10 = 45. We
    // advertise the true total: it is honest and it is the bigger number.
    // `points` must stay 25 — the optimistic path and the server contract read it.
    points: 25,
    displayPoints: 45,
  },
  {
    n: 5,
    id: "contest",
    kind: "go",
    label: "Enter a contest",
    // Opens Discord, NOT an in-app entry flow. The "read the rules" wording is
    // load-bearing rather than boilerplate: this row sends people to Discord
    // precisely SO they read the brief before entering, and entries are judged
    // against per-contest rules.
    hint: "Opens Discord. Read the contest rules there before entering. Ticks once you actually enter one",
    points: 20,
  },
  {
    n: 6,
    id: "first_creation",
    kind: "go",
    label: "Make something",
    hint: "Counts once you generate art",
    points: 15,
  },
  {
    n: 7,
    id: "mint",
    kind: "soon",
    label: "Mint Smudge",
    hint: "official OpenSea page coming soon",
  },
];

/** The four rows that drive the pips and the tier. The two `go` rows award
 *  points but move nothing. */
export const ASK_STEPS = STEPS.filter((s) => s.kind === "ask");

/** Where contests are announced. */
export const DISCORD_INVITE_URL = "https://discord.gg/panelhaus";

/**
 * FALLBACK ONLY — the real number arrives as `gtdPointsRequired` on the card
 * state, which is what attach-wallet actually enforces. Used before the first
 * response lands, so the card can never render a threshold different from the
 * one it will be judged against.
 *
 * ⚠️ DELIBERATELY ABOVE "COMPLETE THE CARD". The four asks sum to 80
 * (claim 20 + follow 20 + post 15 + refer 25), so 100 also requires a contest
 * (+20) or a first creation (+15). The bar proves real product use, not just
 * card completion — which means a user with every pip lit, at OG, still sees a
 * locked wallet row. The locked copy MUST name the shortfall or that padlock
 * reads as a bug.
 */
export const GTD_POINTS_REQUIRED_FALLBACK = 100;
