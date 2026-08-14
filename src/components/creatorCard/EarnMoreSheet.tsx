import { Monitor, Smartphone } from "lucide-react";
import { BottomSheet } from "../BottomSheet";
import { EARNERS } from "./steps";

/**
 * "How to earn more points" — the explainer behind the ? on the earners header.
 *
 * WHY THIS EXISTS. Six of the seven earners can only be completed on
 * panelhaus.app, because the server verifies them against its own projects,
 * vault, assets and orders — none of which mobile writes (our comics live in the
 * browser). Listing them unexplained turns "Finish a comic +50" into a promise
 * this app cannot keep; hiding them leaves a member's points climbing with no
 * explanation. Naming the split is the only honest option.
 *
 * ⚠️ DO NOT ADD A TAP-TO-OPEN BUTTON FOR panelhaus.app. Panel Haus's own
 * MobileBlocker redirects phone visitors straight back to m.panelhaus.app, so a
 * CTA here would appear to do nothing — worse than no button. The domain is
 * given as text with "on a computer" attached, deliberately.
 */
export function EarnMoreSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const here = EARNERS.filter((e) => !e.desktopOnly);
  const desktop = EARNERS.filter((e) => e.desktopOnly);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="How to earn more points">
      <div className="space-y-6">
        <p className="text-sm leading-relaxed text-accent/70">
          Your points are one balance shared with panelhaus.app. Whatever you earn
          on either one shows up on this card.
        </p>

        {/* The reassurance is not filler: without it, a list of things you cannot
            do here reads as "mobile users are second class". The tier genuinely
            is fully earnable on a phone, and the tier is what the drop ranks on. */}
        <p className="rounded-lg border border-primary/25 bg-primary/10 p-3 text-sm leading-relaxed text-accent/80">
          Your card tier, and your place in the queue, comes only from the four
          asks on the card, and all four work right here. The rest are bonus
          points.
        </p>

        <section>
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent/60">
            <Smartphone size={14} className="text-primary" />
            Earn these here
          </h3>
          <ul className="mt-2.5 space-y-2">
            {here.map((e) => (
              <li
                key={e.id}
                className="flex items-baseline justify-between gap-3 text-[13px] leading-snug text-accent/70"
              >
                <span>{e.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-accent/70">
                  +{e.points}
                  {e.suffix && (
                    <span className="font-normal text-accent/40"> {e.suffix}</span>
                  )}
                </span>
              </li>
            ))}
            <li className="flex items-baseline justify-between gap-3 text-[13px] leading-snug text-accent/70">
              <span>The four asks on your card</span>
              <span className="shrink-0 font-semibold tabular-nums text-accent/70">
                +80
              </span>
            </li>
          </ul>
          <p className="mt-2 text-xs leading-snug text-accent/40">
            Every image you generate pays a point. No cap, no expiry.
          </p>
        </section>

        <section>
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent/60">
            <Monitor size={14} className="text-primary" />
            Only on panelhaus.app
          </h3>
          <ul className="mt-2.5 space-y-2">
            {desktop.map((e) => (
              <li
                key={e.id}
                className="flex items-baseline justify-between gap-3 text-[13px] leading-snug text-accent/70"
              >
                <span>{e.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-accent/70">
                  +{e.points}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-accent/50">
            These are checked against work saved to your Panel Haus account. Comics
            you make on your phone stay on your phone, so they don&apos;t count
            here yet. Open{" "}
            <span className="font-semibold text-accent/70">panelhaus.app</span> on a
            computer, signed in with this same account, and the points land on this
            card automatically.
          </p>
        </section>
      </div>
    </BottomSheet>
  );
}
