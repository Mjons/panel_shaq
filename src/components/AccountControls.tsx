import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";

// Top-nav account cluster. Only rendered when Clerk is enabled (a publishable key
// is set) — so it always runs inside <ClerkProvider>. Signed out → a "Sign in"
// button that opens Clerk's modal (Google / Email / MetaMask, ordered in the
// Clerk dashboard). Signed in → Clerk's avatar menu (profile + sign out).
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
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </>
  );
}
