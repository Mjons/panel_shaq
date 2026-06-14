import { useEffect, useState } from "react";
import { Gift, Share2, Copy, Check, Loader2 } from "lucide-react";
import { useToast } from "./Toast";
import {
  fetchMyReferral,
  fetchReferralCount,
  getCachedMyReferral,
  getCachedReferralCount,
  type MyReferral,
} from "../services/referral";

// "Refer a friend" card for the Settings Account panel. Fetches the user's own PH
// referral code/URL and lets them share or copy it. The shared URL is PH's
// canonical link (https://www.panelhaus.app/?ref=…), which works for recipients on
// both desktop (PH native) and mobile (redirect → our capture).
export function ReferralCard() {
  const { addToast } = useToast();
  // Seed from the session cache so reopening Settings is instant (the code/URL
  // never change; the count shows last-known immediately, then refreshes).
  const [ref, setRef] = useState<MyReferral | null>(getCachedMyReferral);
  const [count, setCount] = useState<number | null>(getCachedReferralCount);
  const [loading, setLoading] = useState(() => !getCachedMyReferral());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    // Code/URL: cached after first fetch, so this is a no-op on later opens.
    fetchMyReferral().then((r) => {
      if (!alive) return;
      setRef(r);
      setLoading(false);
    });
    // Count can change, so always refresh it (shows cached value meanwhile).
    fetchReferralCount().then((c) => {
      if (alive && c !== null) setCount(c);
    });
    return () => {
      alive = false;
    };
  }, []);

  const share = async () => {
    if (!ref) return;
    const shareData = {
      title: "Panel Haus",
      text: "Make AI comics with me on Panel Haus. Here's my invite:",
      url: ref.referralUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      return; // user cancelled the share sheet
    }
    // No Web Share API → fall back to copy.
    copy();
  };

  const copy = async () => {
    if (!ref) return;
    try {
      await navigator.clipboard.writeText(ref.referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast("Referral link copied.", "success");
    } catch {
      addToast("Couldn't copy. Long-press the link to copy it.", "error");
    }
  };

  if (loading) {
    return (
      <div className="border-t border-outline/10 pt-3 flex items-center gap-2 text-sm text-accent/50">
        <Loader2 size={14} className="animate-spin" /> Loading your invite…
      </div>
    );
  }

  if (!ref) return null; // referral unavailable; hide silently

  return (
    <div className="border-t border-outline/10 pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-accent/40">
          <Gift size={12} className="text-primary" /> Refer a friend
        </p>
        {count !== null && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            {count} referred
          </span>
        )}
      </div>
      <p className="text-xs text-accent/60">
        Share your link and you both get bonus credits when a friend signs up.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate text-xs text-accent/80 bg-background/50 border border-outline/10 rounded-lg px-3 py-2">
          {ref.referralUrl}
        </code>
        <button
          onClick={copy}
          className="shrink-0 p-2 rounded-lg border border-outline/20 text-accent/70 hover:text-primary hover:border-primary/40 active:scale-95 transition-all"
          aria-label="Copy referral link"
          title="Copy"
        >
          {copied ? (
            <Check size={16} className="text-primary" />
          ) : (
            <Copy size={16} />
          )}
        </button>
      </div>
      <button
        onClick={share}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-background font-bold text-sm active:scale-95 transition-transform"
      >
        <Share2 size={15} /> Share invite
      </button>
    </div>
  );
}
