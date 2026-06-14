// Tiny event bus to open the Buy Ink sheet from anywhere (Settings, the nav ink
// chip, the out-of-ink 402 path). The single <BuyCreditsSheet> is hosted in
// AppInner, which subscribes via onOpenBuyCredits. Mirrors the listener pattern
// in credits.ts.
//
// The optional reason lets the sheet show a contextual banner — "out_of_ink" is
// passed when a generation was blocked for insufficient credits.

export type BuyReason = "out_of_ink" | null;

type Fn = (reason: BuyReason) => void;
const listeners = new Set<Fn>();

export function onOpenBuyCredits(fn: Fn): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function openBuyCredits(reason: BuyReason = null): void {
  for (const fn of listeners) fn(reason);
}
