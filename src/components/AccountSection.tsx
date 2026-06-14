import {
  useAuth,
  useUser,
  SignInButton,
  SignedIn,
  SignedOut,
} from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { onBalanceChange } from "../services/credits";

// Settings "Account" panel. Only rendered when Clerk is enabled (so it's always
// inside <ClerkProvider>). Shows the shared Panel Haus account + ink balance and a
// link to buy more. Replaces the legacy anonymous "Today's Usage" meter.

// Friendly plan names. creator_plus is branded "Founder Pass" (the one-time
// lifetime purchase grants that tier); free → "Free Tier".
const TIER_LABELS: Record<string, string> = {
  free: "Free Tier",
  creator_lite: "Creator Lite",
  creator_plus: "Founder Pass",
  brand_starter: "Brand Starter",
  brand_pro: "Brand Pro",
  brand_managed: "Brand Managed",
};
function tierLabel(tier: string | null): string {
  if (!tier) return "Free Tier";
  return TIER_LABELS[tier] || tier.replace(/_/g, " ");
}

export function AccountSection() {
  const { user } = useUser();
  const { getToken, isSignedIn } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [tier, setTier] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let alive = true;
    getToken().then(async (t) => {
      if (!t || !alive) return;
      try {
        const r = await fetch("/api/credits-balance", {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (!r.ok || !alive) return;
        const d = await r.json();
        if (typeof d?.credits === "number") setCredits(d.credits);
        if (typeof d?.tier === "string") setTier(d.tier);
      } catch {
        /* ignore */
      }
    });
    const off = onBalanceChange((c) => {
      if (alive) setCredits(c);
    });
    return () => {
      alive = false;
      off();
    };
  }, [isSignedIn, getToken]);

  return (
    <section className="bg-surface-container rounded-xl p-6 border border-outline/10 space-y-4">
      <h3 className="font-headline text-lg font-bold text-accent">Account</h3>

      <SignedOut>
        <p className="text-sm text-accent/60">
          Sign in to sync your account and ink balance across Panel Haus.
        </p>
        <SignInButton mode="modal">
          <button className="px-4 py-2 rounded-lg bg-primary text-background font-headline font-bold active:scale-95 transition-transform">
            Sign in
          </button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        <div className="flex items-center gap-3">
          {user?.imageUrl && (
            <img
              src={user.imageUrl}
              alt=""
              className="w-10 h-10 rounded-full shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm text-accent/80 break-all">
              {user?.primaryEmailAddress?.emailAddress ||
                user?.username ||
                "Signed in"}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-accent/40">
              {tierLabel(tier)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-outline/10 pt-3">
          <span className="text-sm text-accent/60">Ink balance</span>
          <span className="font-bold text-accent">
            {credits === null ? "…" : `⚡ ${credits}`}
          </span>
        </div>

        <a
          href="https://www.panelhaus.app/pricing"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center px-4 py-2 rounded-lg border border-primary/40 text-primary font-semibold text-sm active:scale-95 transition-transform"
        >
          Get more ink
        </a>
      </SignedIn>
    </section>
  );
}
