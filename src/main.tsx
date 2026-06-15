import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App.tsx";
import { FromMemeRoot } from "./from-meme/FromMemeRoot";
import { ClerkTokenBridge } from "./services/ClerkTokenBridge";
import { ReferralLinker } from "./components/ReferralLinker";
import { clerkAppearance } from "./clerkAppearance";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { trackColdLanding } from "./services/analytics";
import { maybeMigrateFromOldOrigin } from "./services/originMigration";
import "./index.css";

// Shared Clerk auth (same instance as Panel Haus). Optional: if the publishable
// key isn't set, the app runs exactly as before (no auth, no shared credits):
// graceful degradation like Supabase. The meme-receiver branch is always
// Clerk-free.
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

// DEV-ONLY: the real <haus-switcher> embed (panelhaus.app/embed/hausbar.js) isn't
// live yet, so register a local mock so the switcher is visible while developing.
// Tree-shaken out of prod builds by the import.meta.env.DEV guard.
if (import.meta.env.DEV) {
  import("./hausbar-mock");
}

// MemeGen → Panel Haus Mobile handoff lands at /c/from-meme. Render a self-contained
// guest meme editor (no router, no EmailGate) instead of the main tab app.
const isMemeReceiver = window.location.pathname === "/c/from-meme";

function mount() {
  trackColdLanding();
  // The main tab app, optionally wrapped in Clerk. Meme receiver stays Clerk-free.
  const mainApp =
    !isMemeReceiver && clerkKey ? (
      <ClerkProvider publishableKey={clerkKey} appearance={clerkAppearance}>
        <ClerkTokenBridge />
        <ReferralLinker />
        <App />
      </ClerkProvider>
    ) : isMemeReceiver ? (
      <FromMemeRoot />
    ) : (
      <App />
    );
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        {mainApp}
        <Analytics />
      </ErrorBoundary>
    </StrictMode>,
  );
}

// On the new canonical host, pull any data stranded on the old origin before the
// app mounts (the static splash in index.html stays visible meanwhile).
// maybeMigrateFromOldOrigin self-gates to m.panelhaus.app and runs at most once;
// it's a fast no-op everywhere else, so awaiting it costs nothing in the common
// case. Skipped for the transient meme-receiver guest flow.
if (isMemeReceiver) {
  mount();
} else {
  maybeMigrateFromOldOrigin().finally(mount);
}
