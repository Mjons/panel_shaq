import { useAuth, useClerk } from "@clerk/clerk-react";
import { useEffect } from "react";
import {
  registerClerkTokenGetter,
  clearClerkTokenGetter,
  registerClerkGate,
  clearClerkGate,
} from "./clerkToken";

// Bridges Clerk's hooks into the module-level holders so non-React code
// (geminiService.apiPost) can mint a Bearer token, check sign-in state, and open
// the sign-in modal. Renders nothing. Must be mounted INSIDE <ClerkProvider>.
export function ClerkTokenBridge() {
  const { getToken, isSignedIn } = useAuth();
  const clerk = useClerk();
  useEffect(() => {
    registerClerkTokenGetter(() => getToken());
    registerClerkGate({
      isSignedIn: () => !!isSignedIn,
      openSignIn: () => clerk.openSignIn(),
    });
    return () => {
      clearClerkTokenGetter();
      clearClerkGate();
    };
  }, [getToken, isSignedIn, clerk]);
  return null;
}
