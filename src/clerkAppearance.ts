// Theme for Clerk's prebuilt components (the sign-in / sign-up modal), mapped to
// Panel Haus Mobile's design tokens in src/index.css @theme:
//   primary #ff9100 · accent/text #f5f5dc · background #0f172a · surface-container
//   #131b2e · input #0f172a · outline #475569 · Space Grotesk headings / Inter body.
// `variables` do the heavy lifting (Clerk applies them in its own CSS, so they're
// specificity-safe); `elements` add the headline font + button polish.
export const clerkAppearance = {
  variables: {
    colorPrimary: "#ff9100",
    colorBackground: "#131b2e",
    colorText: "#f5f5dc",
    colorTextSecondary: "rgba(245, 245, 220, 0.6)",
    // Neutral drives social-button labels/icons, borders, and secondary UI. Its
    // default is dark — invisible on our dark card — so set it light (beige).
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
  },
};
