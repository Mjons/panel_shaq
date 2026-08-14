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

/**
 * MORE WAYS TO EARN — read-only, and deliberately NOT steps.
 *
 * Every one of these is awarded server-side from evidence Panel Haus already
 * holds (a credit ledger row, a project, a blueprint, a print order), so there
 * is nothing to press: the next card load pays them. They are listed because an
 * incentive nobody can see is not an incentive — without this section your
 * points climb with no visible explanation of where from.
 *
 * ⚠️ KEPT OUT OF `STEPS` ON PURPOSE. STEPS drives the numbering, the four pips
 * and `tierFor`, and the tier is what the mint allowlist is built from. Adding
 * rows there would change the ranking input for the actual drop; adding them
 * here cannot.
 *
 * ⚠️ VALUES MIRROR THE SERVER (Comic-Pro2 api/_lib/creatorCard.js), which is
 * what actually awards. These are display only, so a mismatch is not a bug that
 * self-corrects — it is a number we told someone that was never true.
 *
 * ⚠️ ONLY `creation` IS EARNABLE FROM THIS APP. Verified against the server's
 * verify queries — most of these read Panel Haus's OWN tables, which mobile
 * activity never writes:
 *
 *   creation        credit_transactions (amount < 0, non-grant/refund)
 *                   → ✅ mobile generations spend through PH's credit reserve
 *   comic_finished  projects.page_count + assets  → ❌ mobile comics live in
 *   comic_3_pages   (same)                        ❌  browser IndexedDB, and
 *   comic_10_pages  (same)                        ❌  never create a PH project
 *   blueprint_saved user_documents doc_type=blueprint → ❌ our vault is local
 *   meme_shipped    assets.source='memegen_handoff'   → ❌ our /c/from-meme
 *                   receiver is Clerk-free and never runs PH's asset ingest
 *   print_order     print_orders                      → ❌ no print flow here
 *
 * They are still listed, because the BALANCE is shared: doing any of them on
 * panelhaus.app pays into the same ledger this card renders, and hiding them
 * would leave a member's points climbing with no explanation. That is why the
 * section carries a line saying where they are earned — without it, "Finish a
 * comic +50" reads as a promise this app cannot keep.
 *
 * If mobile ever gains one of these paths, delete the corresponding ❌ here
 * rather than assuming it started working.
 *
 * `id` is the ledger type, not a step id, so it can be looked up directly in the
 * `breakdown` map to show what has already been earned.
 */
export interface Earner {
  id: string;
  label: string;
  points: number;
  suffix?: string;
}

export const EARNERS: Earner[] = [
  {
    id: "creation",
    label: "Every credit you spend",
    points: 1,
    suffix: "per credit",
  },
  { id: "card_action_comic_finished", label: "Finish a comic", points: 50 },
  { id: "card_action_comic_3_pages", label: "Complete a 3 page comic", points: 75 },
  { id: "card_action_comic_10_pages", label: "Complete a 10 page comic", points: 150 },
  { id: "card_action_blueprint_saved", label: "Save a blueprint", points: 50 },
  { id: "card_action_meme_shipped", label: "Ship a meme", points: 25 },
  { id: "card_action_print_order", label: "Order a printed comic", points: 200 },
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
