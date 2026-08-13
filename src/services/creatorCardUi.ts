// Tiny event bus to open the Creator Card overlay from anywhere (the Settings →
// Account row, and the ?creatorCard=1 return from the Discord claim). The single
// <CreatorCardScreen> is hosted in AppInner, which subscribes via
// onOpenCreatorCard. Mirrors buyCredits.ts.
//
// A bus rather than a prop because the trigger lives four levels down
// (SettingsScreen -> AccountSection -> CreatorCardRow) and the overlay has to
// render at the app root to sit above the bottom nav. Threading a callback
// through two intermediate screens that otherwise know nothing about the Creator
// Program would couple them to it for no gain.

type Fn = () => void;
const listeners = new Set<Fn>();

export function onOpenCreatorCard(fn: Fn): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function openCreatorCard(): void {
  for (const fn of listeners) fn();
}
