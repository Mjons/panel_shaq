// Smudge availability gate.
//
// 🛑 GATED 2026-08-14 — flip to true to bring the agent back.
//
// Smudge (the agentic chat comic builder) is hidden behind a "coming soon"
// screen. NOTHING ELSE WAS REMOVED: the agent services (src/services/agent/*),
// the chat hook (useSmudgeChat), the SmudgeScreen itself and the api/board-agent
// relay are all intact and unmodified. Re-enabling is this one constant.
//
// ⚠️ THE `: boolean` ANNOTATION IS LOAD-BEARING, not noise. Left to infer,
// TypeScript types this as the literal `false`, narrows every `if (SMUDGE_ENABLED)`
// to always-false, and treats the real Smudge branches as unreachable code —
// greyed out in editors, and an outright error under `allowUnreachableCode:
// false`. The widened type keeps those branches live so re-enabling is genuinely
// one word. Same reasoning as SHIP_CLAIM_ENABLED in src/services/shipClaim.ts.
export const SMUDGE_ENABLED: boolean = false;

/** The tab to land on when Smudge is gated. Smudge is normally the default
 *  landing screen, so without this a new install would open straight onto the
 *  coming-soon page — and a returning user whose last tab was Smudge would be
 *  stuck there too. */
export const FALLBACK_TAB = "workshop";
