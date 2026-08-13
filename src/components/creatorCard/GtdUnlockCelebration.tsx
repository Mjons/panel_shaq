import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Wallet } from "lucide-react";

/**
 * The unlock moment — crossing the GTD points threshold.
 *
 * This is the single most consequential thing that happens on the card (it is
 * the step that puts someone on the mint list), so it gets a beat rather than a
 * row quietly changing colour.
 *
 * ONCE PER ACCOUNT. The caller owns the flag; see useGtdCelebration below for
 * why it lives in localStorage rather than state.
 *
 * `prefers-reduced-motion` is a real BRANCH, not a dimmer: same composed scene,
 * same seal, zero movement and no confetti. The value is read once at mount,
 * matching desktop.
 */

const CONFETTI_COLORS = ["#ffcf4d", "#ff7bd8", "#8be0ff", "#ffe08a", "#ff9100"];

export function GtdUnlockCelebration({
  open,
  points,
  onAddWallet,
  onDismiss,
}: {
  open: boolean;
  points: number;
  onAddWallet: () => void;
  onDismiss: () => void;
}) {
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const confetti = useMemo(
    () =>
      reduced
        ? []
        : Array.from({ length: 28 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            delay: Math.random() * 0.5,
            duration: 1.8 + Math.random() * 1.4,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            rotate: Math.random() * 360,
          })),
    [reduced],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="You have earned a guaranteed mint spot"
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center
                     bg-background/95 backdrop-blur-sm px-6"
        >
          {/* Confetti */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {confetti.map((c) => (
              <motion.span
                key={c.id}
                initial={{ y: "-10%", opacity: 1, rotate: 0 }}
                animate={{ y: "110%", opacity: 0, rotate: c.rotate }}
                transition={{
                  duration: c.duration,
                  delay: c.delay,
                  ease: "linear",
                }}
                style={{ left: `${c.x}%`, background: c.color }}
                className="absolute top-0 h-2 w-1.5 rounded-sm"
              />
            ))}
          </div>

          {/* The seal */}
          <motion.div
            initial={reduced ? false : { scale: 2.4, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: -8 }}
            transition={{ type: "spring", damping: 12, stiffness: 180 }}
            className="relative mb-8 flex h-36 w-36 flex-col items-center justify-center
                       rounded-full border-4 border-primary text-center"
          >
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-primary/70">
              Panel Haus
            </span>
            <span className="font-headline text-2xl font-bold leading-none text-primary">
              MINT
            </span>
            <span className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-primary/70">
              Spot Secured
            </span>
          </motion.div>

          <motion.h2
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : 0.35 }}
            className="text-center font-headline text-2xl font-bold text-accent"
          >
            Your mint spot is guaranteed
          </motion.h2>

          <motion.p
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : 0.45 }}
            className="mt-3 max-w-sm text-center text-sm leading-relaxed text-accent/70"
          >
            {points.toLocaleString()} points, you&apos;re past the line. Lock in the
            wallet your Smudgie should land in. The mint itself comes later.
          </motion.p>

          <motion.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : 0.55 }}
            className="mt-8 w-full max-w-sm space-y-3"
          >
            <button
              type="button"
              onClick={onAddWallet}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3
                         font-headline font-bold text-background"
            >
              <Wallet size={18} />
              Add your mint wallet
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="w-full py-2 text-sm text-accent/50"
            >
              I&apos;ll add it later
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Decide whether the scene should play, and burn the once-ever flag.
 *
 * THE FLAG IS localStorage, NOT STATE, and that is deliberate: `points` reloads
 * on every open, so a state-only guard would replay the scene every single time
 * an already-qualified member opened the card. Keyed per seed so two accounts on
 * one device each get their own.
 *
 * ⚠️ It CANNOT be shared with panelhaus.app — localStorage is origin-scoped, so
 * a member who watched this on desktop can see it once more here. That is
 * accepted and benign: the `walletAddress` bail-out below means the only person
 * who sees it twice is someone who crossed the line and did NOT attach a wallet,
 * which is precisely who the scene exists to nudge.
 */
export function useGtdCelebration({
  open,
  unlocked,
  joinReady,
  walletAddress,
  seed,
}: {
  open: boolean;
  unlocked: boolean;
  joinReady: boolean;
  walletAddress: string | null;
  seed: string | null;
}): [boolean, () => void] {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // walletAddress is a deliberate bail-out: nobody should be congratulated for
    // unlocking a step they have already completed.
    if (!open || !unlocked || !joinReady || walletAddress || !seed) return;
    const key = `creator_card_gtd_celebrated:${seed}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, String(Date.now()));
    } catch {
      // Private mode — celebrate anyway rather than swallowing the moment. The
      // cost of a repeat is a second burst; the cost of skipping is the user
      // never learning the wallet step exists.
    }
    setShow(true);
  }, [open, unlocked, joinReady, walletAddress, seed]);

  return [show, () => setShow(false)];
}
