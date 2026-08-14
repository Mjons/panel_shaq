import { Smudge } from "../components/Smudge";

/**
 * Shown in Smudge's place while the agent is gated (see services/smudgeGate.ts).
 *
 * Deliberately a real screen rather than a hidden tab: the entry point stays
 * where people have learned it is and says what it will be, instead of the
 * feature silently vanishing between releases.
 *
 * Kept to the headline on purpose. There is no explanatory paragraph and no CTA
 * — the bottom nav is already on screen, so this is not a dead end, and anything
 * more would be writing copy about a feature nobody can use yet.
 */
export function SmudgeComingSoon() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-8 text-center">
      <div className="opacity-70">
        <Smudge size={112} />
      </div>
      <h2 className="mt-6 font-headline text-2xl font-bold text-accent">
        Coming soon
      </h2>
    </div>
  );
}
