/**
 * mintWalletCollection — the one switch that hides mint-wallet collection.
 *
 * MIRRORS the desktop app's `src/utils/mintWalletCollection.js` (Comic-Pro2).
 * The two Creator Card implementations are deliberate mirrors of each other, so
 * this flag exists twice on purpose: one repo cannot import the other, and a
 * single flag flipped in one place would leave the other product still asking
 * people for a mint address. Flip BOTH together.
 *
 * WHAT IS HIDDEN here:
 *   1. `MintWalletRow` on the Creator Card
 *   2. `MintWalletSheet`, the paste-and-confirm sheet
 *   3. `GtdUnlockCelebration`, whose only call to action is "add wallet"
 *
 * ⚠️ WHAT IS DELIBERATELY *NOT* HIDDEN: the "Remind me before the mint" email
 * opt-in that shares the same band. It is a separate feature that captures an
 * email for a mint notification, it collects no wallet address, and it keeps
 * working on its own. Only its top divider is dropped, since with the wallet row
 * gone it would otherwise draw a rule under nothing.
 *
 * 🔴 NOTHING IS DELETED AND NO ENDPOINT IS DISABLED.
 * `api/creator-attach-wallet.ts` stays live and every address already collected
 * is untouched. Flip this back to `true` and every surface returns as it was.
 *
 * ⚠️ ANNOTATED `: boolean` ON PURPOSE, not decoration. Left to infer, TypeScript
 * types this as the literal `false`, narrows every `FLAG && <X/>` guard to
 * permanently false, and treats the JSX behind it as unreachable: greyed out in
 * editors and an outright error under `allowUnreachableCode: false`. The widened
 * type keeps those bodies live so re-enabling is genuinely one word. The same
 * lesson, learned the same way, is recorded for `SHIP_CLAIM_ENABLED` in
 * `src/services/shipClaim.ts` (CHANGELOG, July 28 2026).
 */
export const MINT_WALLET_COLLECTION_ENABLED: boolean = false;
