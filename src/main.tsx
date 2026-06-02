import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.tsx";
import { FromMemeRoot } from "./from-meme/FromMemeRoot";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { trackColdLanding } from "./services/analytics";
import "./index.css";

trackColdLanding();

// MemeGen → Panel Shaq handoff lands at /c/from-meme. Render a self-contained
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
