import {
  useAuth,
  useUser,
  SignInButton,
  SignedIn,
  SignedOut,
} from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import {
  onBalanceChange,
  fetchAccount,
  getCachedBalance,
  getCachedTier,
} from "../services/credits";
import { useInkCosts } from "../services/inkCosts";
import { openBuyCredits } from "../services/buyCredits";
import { ReferralCard } from "./ReferralCard";

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

function truncateWallet(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export function AccountSection() {
  const { user } = useUser();
  const { getToken, isSignedIn } = useAuth();
  // Seed from the shared cache the nav chip primed at startup so the balance shows
  // instantly here instead of spinning while we re-fetch.
  const [credits, setCredits] = useState<number | null>(getCachedBalance);
  const [tier, setTier] = useState<string | null>(getCachedTier);
  const costs = useInkCosts();

  useEffect(() => {
    if (!isSignedIn) return;
    let alive = true;
    getToken().then(async (t) => {
      if (!t || !alive) return;
      const { credits: c, tier: tr } = await fetchAccount(t);
      if (!alive) return;
      if (c !== null) setCredits(c);
      if (tr !== null) setTier(tr);
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
            <p
              className={`text-sm text-accent/80 break-all ${
                !user?.primaryEmailAddress?.emailAddress &&
                user?.web3Wallets?.[0]?.web3Wallet
                  ? "font-mono"
                  : ""
              }`}
            >
              {user?.primaryEmailAddress?.emailAddress ||
                (user?.web3Wallets?.[0]?.web3Wallet
                  ? truncateWallet(user.web3Wallets[0].web3Wallet)
                  : user?.username || "Signed in")}
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

        <div className="border-t border-outline/10 pt-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent/40">
            Ink costs
          </p>
          <div className="text-xs text-accent/60 space-y-0.5">
            <div className="flex justify-between">
              <span>Text actions</span>
              <span className="text-accent/80">⚡{costs.text}</span>
            </div>
            <div className="flex justify-between">
              <span>Image · Flash</span>
              <span className="text-accent/80">⚡{costs.imageFlash}</span>
            </div>
            <div className="flex justify-between">
              <span>Image · Pro</span>
              <span className="text-accent/80">⚡{costs.imagePro}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => openBuyCredits()}
          className="block w-full text-center px-4 py-2 rounded-lg bg-primary text-background font-bold text-sm active:scale-95 transition-transform"
        >
          Get more ink
        </button>

        <ReferralCard />
      </SignedIn>
    </section>
  );
}
