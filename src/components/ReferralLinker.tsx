import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import { captureReferralFromUrl, linkPendingReferral } from "../services/referral";

// Renders nothing. Mounted inside <ClerkProvider> (next to <ClerkTokenBridge/>),
// so it never runs on the Clerk-free meme branch. Captures an incoming ?ref= code
// on mount, then links it to the account once the user is signed in (PH's endpoint
// is idempotent; the ref guard just avoids redundant calls under StrictMode).
export function ReferralLinker() {
  const { isSignedIn } = useAuth();
  const linkedRef = useRef(false);

  // Capture as early as possible; runs for signed-out visitors too.
  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  // Link when signed in (and on sign-in transitions).
  useEffect(() => {
    if (!isSignedIn || linkedRef.current) return;
    linkedRef.current = true;
    linkPendingReferral();
  }, [isSignedIn]);

  return null;
}
