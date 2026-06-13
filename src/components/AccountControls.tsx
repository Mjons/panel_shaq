import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { onBalanceChange, fetchBalance } from "../services/credits";

// Live ink-balance chip. Fetches once when signed in, then updates instantly when
// a generation pushes a new balance (apiPost -> emitBalance). Hidden until known.
function InkChip() {
  const { getToken, isSignedIn } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let alive = true;
    getToken().then((t) => {
      if (t && alive) fetchBalance(t).then((c) => {
        if (alive && c !== null) setCredits(c);
      });
    });
    const off = onBalanceChange((c) => {
      if (alive) setCredits(c);
    });
    return () => {
      alive = false;
      off();
    };
  }, [isSignedIn, getToken]);

  if (credits === null) return null;
  return (
    <span
      className="text-sm font-semibold text-accent/80 px-2 py-1 rounded-lg bg-surface-container border border-outline/10"
      title="Ink balance"
    >
      ⚡ {credits}
    </span>
  );
}

// Top-nav account cluster. Only rendered when Clerk is enabled (a publishable key
// is set) — so it always runs inside <ClerkProvider>. Signed out → a "Sign in"
// button that opens Clerk's modal (Google / Email / MetaMask, ordered in the
// Clerk dashboard). Signed in → ink chip + Clerk's avatar menu (profile + sign out).
export function AccountControls() {
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button
            className="text-sm font-semibold text-primary hover:opacity-80 active:scale-90 transition px-3 py-1.5 rounded-lg border border-primary/40"
            aria-label="Sign in"
          >
            Sign in
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <InkChip />
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </>
  );
}
