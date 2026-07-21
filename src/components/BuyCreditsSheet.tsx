import { useEffect, useState } from "react";
import {
  Loader2,
  Zap,
  Monitor,
  AlertTriangle,
  CreditCard,
  Bitcoin,
} from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { useToast } from "./Toast";
import {
  startBoosterCheckout,
  startCryptoBoosterCheckout,
  type BoosterSize,
} from "../services/checkout";
import { fetchAccount, getCachedCryptoEnabled } from "../services/credits";
import { getClerkToken } from "../services/clerkToken";
import type { BuyReason } from "../services/buyCredits";

type PayMethod = "card" | "crypto";

// Booster packs mirror Panel Haus (Comic-Pro2 BoosterPackModal.jsx). Prices are
// DISPLAY-ONLY (the real charge is set by Stripe at checkout). Credit amounts are
// what PH actually grants (CREDITS_BOOSTER_SMALL/MEDIUM/LARGE).
const PACKS: {
  size: BoosterSize;
  name: string;
  credits: number;
  price: string;
  badge?: string;
}[] = [
  { size: "small", name: "Starter", credits: 75, price: "$6.99" },
  {
    size: "medium",
    name: "Popular",
    credits: 150,
    price: "$12.99",
    badge: "Most Popular",
  },
  {
    size: "large",
    name: "Best Value",
    credits: 300,
    price: "$24.99",
    badge: "Best Value",
  },
];

export function BuyCreditsSheet({
  isOpen,
  reason = null,
  onClose,
}: {
  isOpen: boolean;
  reason?: BuyReason;
  onClose: () => void;
}) {
  const { addToast } = useToast();
  const [busy, setBusy] = useState<BoosterSize | null>(null);
  const [method, setMethod] = useState<PayMethod>("card");
  const [cryptoEnabled, setCryptoEnabled] = useState(
    () => getCachedCryptoEnabled() === true,
  );

  // Crypto availability is server-driven (PH reports it on the balance payload), so
  // a half-configured or crypto-off deploy never renders a dead button. The nav ink
  // chip usually primes the cache at sign-in; fetch only if it's still unknown.
  useEffect(() => {
    if (!isOpen) return;
    setMethod("card");
    const cached = getCachedCryptoEnabled();
    if (cached !== null) {
      setCryptoEnabled(cached);
      return;
    }
    let alive = true;
    getClerkToken().then(async (t) => {
      if (!t || !alive) return;
      const { cryptoEnabled: enabled } = await fetchAccount(t);
      if (alive) setCryptoEnabled(enabled);
    });
    return () => {
      alive = false;
    };
  }, [isOpen]);

  const buy = async (size: BoosterSize) => {
    if (busy) return;
    setBusy(size);
    try {
      // Both redirect to a hosted page on success (Stripe / OxaPay).
      if (method === "crypto") await startCryptoBoosterCheckout(size);
      else await startBoosterCheckout(size);
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Couldn't start checkout.",
        "error",
      );
      setBusy(null);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Buy Ink">
      <div className="space-y-5">
        {reason === "out_of_ink" && (
          <div className="flex items-start gap-2.5 rounded-lg border border-primary/40 bg-primary/10 p-3">
            <AlertTriangle size={16} className="text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-accent/90">
              <span className="font-bold text-primary">You're out of ink.</span>{" "}
              Grab a booster below to keep creating.
            </p>
          </div>
        )}

        <p className="text-sm text-accent/60">
          Top up your ink balance, instantly available across Panel Haus. Final
          price is shown securely at checkout.
        </p>

        {cryptoEnabled && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-accent/40">
              Pay with
            </span>
            <div className="flex items-center gap-2">
              {(["card", "crypto"] as PayMethod[]).map((m) => {
                const Icon = m === "card" ? CreditCard : Bitcoin;
                const isActive = method === m;
                return (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    disabled={!!busy}
                    aria-pressed={isActive}
                    className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-6 py-2.5 text-sm font-headline font-bold transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 ${
                      isActive
                        ? "border-primary bg-primary text-background"
                        : "border-outline/25 bg-surface text-accent/70"
                    }`}
                  >
                    <Icon size={16} className="shrink-0" aria-hidden="true" />
                    {m === "card" ? "Card" : "Crypto"}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {PACKS.map((p) => {
            const isBusy = busy === p.size;
            return (
              <button
                key={p.size}
                onClick={() => buy(p.size)}
                disabled={!!busy}
                className={`w-full flex items-center justify-between gap-4 rounded-xl border p-4 text-left transition-all active:scale-[0.98] disabled:opacity-50 ${
                  p.badge === "Most Popular"
                    ? "border-primary/60 bg-primary/10"
                    : "border-outline/15 bg-surface hover:border-primary/30"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-headline font-bold text-accent">
                      {p.name}
                    </span>
                    {p.badge && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/15 px-1.5 py-0.5 rounded">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-primary">
                    <Zap size={14} className="fill-primary" />
                    <span className="font-bold tabular-nums">{p.credits}</span>
                    <span className="text-accent/50 text-sm">credits</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-headline font-bold text-accent text-lg tabular-nums">
                    {p.price}
                  </span>
                  {isBusy && (
                    <Loader2 size={18} className="text-primary animate-spin" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-outline/10 pt-4">
          <p className="flex items-start gap-2 text-xs text-accent/50">
            <Monitor size={14} className="text-accent/40 shrink-0 mt-0.5" />
            <span>
              The full studio (bigger canvas, more tools) is even better on
              desktop at{" "}
              <a
                href="https://www.panelhaus.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-semibold"
              >
                panelhaus.app
              </a>
              .
            </span>
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}
