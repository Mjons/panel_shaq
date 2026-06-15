import { Wallet } from "lucide-react";
import { shouldDeepLinkToWallet, metaMaskDappLink } from "../services/wallet";

// Plain mobile browsers have no injected wallet provider, so Clerk's native
// MetaMask button (shown in the modal only when a provider exists) is absent
// there. This button bounces those users into MetaMask's in-app browser, where a
// provider exists and the native sign-in works. Renders nothing in any context
// that already has a provider (in-app browser / desktop extension).
//
// `compact` = icon-only pill for the tight top nav (matches the ⊞ switcher's
// footprint); default = full-text button for roomier surfaces like Settings.
export function WalletDeepLinkButton({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  if (!shouldDeepLinkToWallet()) return null;

  const go = () => {
    window.location.href = metaMaskDappLink();
  };

  if (compact) {
    return (
      <button
        onClick={go}
        title="Open in MetaMask"
        aria-label="Open in MetaMask to connect a wallet"
        className={`w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-lg border border-primary/40 text-primary hover:bg-primary/10 hover:border-primary/60 active:scale-90 transition-colors ${className}`}
      >
        <Wallet size={18} />
      </button>
    );
  }

  return (
    <button
      onClick={go}
      aria-label="Open in MetaMask to connect a wallet"
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold text-primary hover:bg-primary/10 active:scale-95 transition-colors px-3 py-1.5 rounded-lg border border-primary/40 ${className}`}
    >
      <Wallet size={15} />
      Open in MetaMask
    </button>
  );
}
