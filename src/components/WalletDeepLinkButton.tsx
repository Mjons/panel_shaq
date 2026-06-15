import { Wallet } from "lucide-react";
import { shouldDeepLinkToWallet, metaMaskDappLink } from "../services/wallet";

// Plain mobile browsers have no injected wallet provider, so Clerk's native
// MetaMask button (shown in the modal only when a provider exists) is absent
// there. This button bounces those users into MetaMask's in-app browser, where a
// provider exists and the native sign-in works. Renders nothing in any context
// that already has a provider (in-app browser / desktop extension).
export function WalletDeepLinkButton({
  className = "",
}: {
  className?: string;
}) {
  if (!shouldDeepLinkToWallet()) return null;
  return (
    <button
      onClick={() => {
        window.location.href = metaMaskDappLink();
      }}
      className={`inline-flex items-center justify-center gap-2 text-sm font-semibold text-primary hover:opacity-80 active:scale-95 transition px-3 py-1.5 rounded-lg border border-primary/40 ${className}`}
      aria-label="Open in MetaMask to connect a wallet"
    >
      <Wallet size={15} />
      Open in MetaMask
    </button>
  );
}
