// Wallet-connect helpers. Auth itself is Clerk's native web3 button (shown in the
// sign-in modal only when a provider exists; see clerkAppearance.ts). These only
// decide HOW the user reaches a wallet:
//   - injected provider present (MetaMask in-app browser / desktop extension) →
//     Clerk's native MetaMask button connects in place.
//   - plain mobile browser (no provider) → WalletDeepLinkButton bounces the user
//     into MetaMask's in-app browser, where a provider exists. Mirrors MemeGen's
//     src/lib/mobileWallet.js.

declare global {
  interface Window {
    ethereum?: unknown;
  }
}

/** True when an injected EIP-1193 provider exists (MetaMask in-app browser, or a
 *  desktop extension). Absent in a normal mobile browser. */
export function hasInjectedProvider(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}

export function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** A plain mobile browser with no injected provider → we should bounce the user
 *  into MetaMask's in-app browser. Skip on http/localhost (deep links + the wallet
 *  flow need a real https origin). */
export function shouldDeepLinkToWallet(): boolean {
  if (typeof window === "undefined") return false;
  const { protocol, hostname } = window.location;
  const isHttps = protocol === "https:";
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
  return isMobileBrowser() && !hasInjectedProvider() && isHttps && !isLocal;
}

/** Deep link that reopens THIS page inside MetaMask's in-app browser. We append
 *  ?signin=wallet so the app can auto-open the sign-in sheet on return. */
export function metaMaskDappLink(): string {
  const { host, pathname } = window.location;
  const sep = pathname.includes("?") ? "&" : "?";
  return `https://metamask.app.link/dapp/${host}${pathname}${sep}signin=wallet`;
}
