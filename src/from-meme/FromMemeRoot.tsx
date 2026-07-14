import { Loader2 } from "lucide-react";
import { ToastProvider } from "../components/Toast";
import { useHandoffPayload } from "./useHandoffPayload";
import type { HandoffState } from "./useHandoffPayload";
import { MemeEditor } from "./MemeEditor";
import { AdminCalibrator } from "./AdminCalibrator";
import { AdminGallery } from "./AdminGallery";
import { isAdmin } from "./adminGate";

const MEMEGEN_URL =
  import.meta.env.VITE_MEMEGEN_URL || "https://memegen.panelhaus.app";

// Root rendered (from main.tsx) for the /c/from-meme path — a self-contained
// guest meme editor that bypasses the main app's EmailGate entirely.
export function FromMemeRoot() {
  return (
    <ToastProvider>
      <FromMemeInner />
      {/* No ShipClaimHost here: the GTD claim is signed-in only, and this root
          is Clerk-free (identity always null → the invite can never fire).
          memeShare's markShipped calls still record share analytics. */}
    </ToastProvider>
  );
}

function FromMemeInner() {
  const state: HandoffState = useHandoffPayload();

  // Admin can open the full template gallery without a handoff token:
  // /c/from-meme?admin=<secret>&gallery=1
  const adminGallery =
    isAdmin() && new URLSearchParams(window.location.search).has("gallery");
  if (adminGallery) return <AdminGallery />;

  if (state.status === "loading") return <Splash />;
  if (state.status === "error") return <ErrorView state={state} />;

  return isAdmin() ? (
    <AdminCalibrator payload={state.payload} />
  ) : (
    <MemeEditor payload={state.payload} token={state.token} />
  );
}

function Splash() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-accent">
      <Loader2 size={32} className="animate-spin text-primary" />
      <p className="text-xs uppercase tracking-[0.15em] text-accent/40">
        Loading your meme…
      </p>
    </div>
  );
}

function ErrorView({
  state,
}: {
  state: Extract<HandoffState, { status: "error" }>;
}) {
  const canRetry = state.kind === "network";
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center text-accent">
      <div className="max-w-sm space-y-5">
        <h1 className="font-headline text-2xl font-bold">Hmm, no meme here</h1>
        <p className="text-sm text-accent/60 leading-relaxed">
          {state.message}
        </p>
        <div className="space-y-3">
          {canRetry && (
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3.5 bg-primary text-background font-headline font-bold rounded-xl active:scale-95 transition-transform"
            >
              Try again
            </button>
          )}
          <a
            href={MEMEGEN_URL}
            className="block w-full py-3.5 bg-surface-container-high border border-outline/20 rounded-xl font-medium active:scale-95 transition-transform"
          >
            Make a meme
          </a>
        </div>
      </div>
    </div>
  );
}
