// Theme for Clerk's prebuilt components (the sign-in / sign-up modal), mapped to
// Panel Haus Mobile's design tokens in src/index.css @theme:
//   primary #ff9100 · accent/text #f5f5dc · background #0f172a · surface-container
//   #131b2e · input #0f172a · outline #475569 · Space Grotesk headings / Inter body.
// `variables` do the heavy lifting (Clerk applies them in its own CSS, so they're
// specificity-safe); `elements` add the headline font + button polish.
//
// ⚠️ METAMASK IS INTENTIONALLY HIDDEN HERE. If you're wondering why the MetaMask /
// wallet sign-in button doesn't show up on m.panelhaus.app (sign-in OR sign-up),
// it's the `socialButtonsBlockButton__metamask` / `socialButtonsIconButton__metamask`
// rules near the bottom of `elements` (NOT a Clerk dashboard setting). See the note
// there for why.
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
    // ── MetaMask / web3 wallet button: INTENTIONALLY HIDDEN on m.panelhaus.app ──
    // We share ONE Clerk instance with Panel Haus (panelhaus.app), and enabled
    // sign-in methods (email / google / web3) are configured at the INSTANCE level,
    // i.e. shared by both apps. There is no Clerk dashboard toggle to turn MetaMask
    // off for only this app, so we hide the button here instead (this `appearance`
    // is panel_shaq-only; panelhaus has its own and still shows MetaMask).
    // Why hide it: MetaMask needs an injected window.ethereum provider that normal
    // mobile browsers don't have, so the button is a dead end on mobile; Email +
    // Google cover sign-in. This is cosmetic (the strategy stays enabled instance-
    // wide), which is fine for a sign-in UI: no button = nothing to click. It applies
    // to BOTH sign-in and sign-up because the appearance is set on <ClerkProvider>.
    // Clerk renders the block OR icon button variant by provider count, so hide both.
    // To RE-ENABLE: delete these two lines (or comment them out).
    socialButtonsBlockButton__metamask: { display: "none" },
    socialButtonsIconButton__metamask: { display: "none" },
  },
};
