import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.tsx";
import { FromMemeRoot } from "./from-meme/FromMemeRoot";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { trackColdLanding } from "./services/analytics";
import "./index.css";

// DEV-ONLY: the real <haus-switcher> embed (panelhaus.app/embed/hausbar.js) isn't
// live yet, so register a local mock so the switcher is visible while developing.
// Tree-shaken out of prod builds by the import.meta.env.DEV guard.
if (import.meta.env.DEV) {
  import("./hausbar-mock");
}

trackColdLanding();

// MemeGen → Panel Haus Mobile handoff lands at /c/from-meme. Render a self-contained
// guest meme editor (no router, no EmailGate) instead of the main tab app.
const isMemeReceiver = window.location.pathname === "/c/from-meme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      {isMemeReceiver ? <FromMemeRoot /> : <App />}
      <Analytics />
    </ErrorBoundary>
  </StrictMode>,
);
