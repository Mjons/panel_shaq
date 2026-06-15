// Theme for Clerk's prebuilt components (the sign-in / sign-up modal), mapped to
// Panel Haus Mobile's design tokens in src/index.css @theme:
//   primary #ff9100 · accent/text #f5f5dc · background #0f172a · surface-container
//   #131b2e · input #0f172a · outline #475569 · Space Grotesk headings / Inter body.
// `variables` do the heavy lifting (Clerk applies them in its own CSS, so they're
// specificity-safe); `elements` add the headline font + button polish.
//
// ⚠️ METAMASK VISIBILITY IS CONDITIONAL. Clerk's native MetaMask button only works
// where an injected `window.ethereum` provider exists (MetaMask's in-app browser or
// a desktop extension); in a plain mobile browser it's a dead end. So we SHOW it
// when a provider is present and HIDE it otherwise (see `hideMetamask` below). For
// plain mobile browsers, a separate "Open in MetaMask" deep-link button
// (src/components/WalletDeepLinkButton.tsx) bounces users into MetaMask's in-app
// browser, where this native button then appears and works. Auth stays 100% Clerk,
// so the account + shared ink balance match panelhaus.app. We share ONE Clerk
// instance with PH, so there's no dashboard toggle to change methods per app; this
// appearance is panel_shaq-only; panelhaus has its own and always shows MetaMask.

// Evaluated once at module load (client bundle). In-app browsers inject the provider
// before this runs; plain mobile browsers never have it.
const hasInjectedProvider =
  typeof window !== "undefined" && !!(window as Window).ethereum;

// When there's no provider, hide the native MetaMask button (block + icon variants)
// so users don't tap a dead end. When a provider exists, show it (empty object = no
// override). To force-hide everywhere, set both to { display: "none" }.
const hideMetamask = hasInjectedProvider
  ? {}
  : {
      socialButtonsBlockButton__metamask: { display: "none" },
      socialButtonsIconButton__metamask: { display: "none" },
    };

export const clerkAppearance = {
  variables: {
    colorPrimary: "#ff9100",
    colorBackground: "#131b2e",
    colorText: "#f5f5dc",
    colorTextSecondary: "rgba(245, 245, 220, 0.6)",
    // Neutral drives social-button labels/icons, borders, and secondary UI. Its
    // default is dark (invisible on our dark card), so set it light (beige).
    colorNeutral: "#f5f5dc",
    colorInputBackground: "#0f172a",
    colorInputText: "#f5f5dc",
    colorTextOnPrimaryBackground: "#0f172a",
    colorDanger: "#f87171",
    colorSuccess: "#34d399",
    colorWarning: "#ffd600",
    colorShimmer: "rgba(255, 145, 0, 0.15)",
    borderRadius: "0.75rem",
    fontFamily: '"Inter", sans-serif',
    fontFamilyButtons: '"Space Grotesk", sans-serif',
  },
  elements: {
    card: "border border-outline/20 shadow-2xl",
    headerTitle: "font-headline",
    headerSubtitle: "text-accent/50",
    formButtonPrimary:
      "font-headline font-bold tracking-tight normal-case hover:opacity-90 active:scale-[0.98] transition",
    footerActionLink: "text-primary hover:opacity-80",
    socialButtonsBlockButton:
      "border border-outline/30 hover:border-primary/40 transition-colors",
    ...hideMetamask,
  },
};
