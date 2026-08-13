import { useEffect, useState } from "react";
import { ChevronRight, IdCard } from "lucide-react";
import {
  fetchCardState,
  getCachedCardState,
  type CardState,
} from "../services/creatorCard";
import { TIERS, tierFor } from "./creatorCard/CreatorCard";
import { ASK_STEPS } from "./creatorCard/steps";
import { openCreatorCard } from "../services/creatorCardUi";

/**
 * The Settings → Account entry point for the Creator Card.
 *
 * ⚠️ RENDERS IMMEDIATELY, AND THAT IS THE POINT. The obvious version returns
 * null until the fetch lands, which made the row visibly pop into Settings
 * seconds after the rest of the panel. The wait is not a slow network — the card
 * state endpoint runs Panel Haus's server SWEEP (it verifies and records any
 * newly-satisfied step before answering), and our own client retries a cold-boot
 * 401 up to three times, 1.5s apart. So "wait for data, then show the row" is
 * structurally slow and always will be.
 *
 * Instead the row is present from first paint and only its subtitle resolves.
 * The trade is that a deployment with the feature flagged OFF shows the row for
 * one round trip before hiding it — a brief flash for a few, versus a
 * multi-second gap for everyone. `unavailable` is only set on a definitive null
 * (Clerk off, signed out, or upstream 404), never on "not answered yet".
 *
 * Seeds from the session cache, so every open after the first is instant.
 */
export function CreatorCardRow() {
  const cached = getCachedCardState();
  const [state, setState] = useState<CardState | null>(cached);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    // Already have it: render the cached figures and DON'T refetch. This is a
    // navigation row, not a live meter — a slightly stale point count here is
    // worth far more than re-running the server sweep (several queries, plus
    // writes the first time evidence lands) on every single open of Settings.
    // The screen itself refreshes when you actually tap through.
    if (cached) return;

    let alive = true;
    void fetchCardState().then((s) => {
      if (!alive) return;
      if (s) setState(s);
      // Only a definitive null hides the row — see the header note.
      else setUnavailable(true);
    });
    return () => {
      alive = false;
    };
    // `cached` is a module-level snapshot read once at mount, not reactive
    // state; listing it would re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (unavailable) return null;

  const subtitle = !state
    ? "Loading…"
    : state.member
      ? `${TIERS[tierFor(ASK_STEPS.filter((s) => (state.breakdown[`card_action_${s.id}`] ?? 0) > 0).length, ASK_STEPS.length)].name} · ${state.balance.toLocaleString()} pts`
      : "Join the Creator Program";

  return (
    <button
      onClick={openCreatorCard}
      className="flex w-full items-center gap-3 border-t border-outline/10 pt-3 text-left"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <IdCard size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-accent">Creator Card</span>
        <span
          className={`block text-sm ${state ? "text-accent/60" : "text-accent/30"}`}
        >
          {subtitle}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-accent/30" />
    </button>
  );
}
