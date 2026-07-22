import { useEffect, useRef } from "react";
import { useUser } from "@clerk/clerk-react";
import { identifyUser, resetUser, track } from "../services/analytics";

// Links PostHog events to the signed-in Clerk user (so case studies can see who
// did what) and clears identity on sign-out. Renders nothing. Mounted inside
// <ClerkProvider>; no-op when PostHog isn't configured (the analytics wrappers
// guard on that). Tier is added separately by credits.ts once the balance loads.
function authMethod(user: ReturnType<typeof useUser>["user"]): string {
  if (!user) return "unknown";
  if (!user.primaryEmailAddress && user.web3Wallets?.[0]) return "wallet";
  if (user.externalAccounts?.some((a) => a.provider?.includes("google")))
    return "google";
  return "email";
}

export function PosthogIdentifyBridge() {
  const { isSignedIn, user } = useUser();
  const wasSignedIn = useRef(false);

  useEffect(() => {
    if (isSignedIn && user) {
      const email = user.primaryEmailAddress?.emailAddress;
      const wallet = user.web3Wallets?.[0]?.web3Wallet;
      // The `clerk:` prefix is REQUIRED, not cosmetic: we share one PostHog
      // project with MemeGen, which identifies as `clerk:${useAuth().userId}`
      // (MemeGen src/lib/AuthContext.jsx). Same Clerk instance → same user id, so
      // matching the format makes one human ONE person across both apps. It also
      // avoids a real conflict: PostHog's cookie is cross-subdomain on
      // .panelhaus.app, so a MemeGen-identified visitor arrives here already
      // carrying `clerk:<id>` as their distinct_id, and PostHog refuses to merge
      // two *identified* ids — calling identify() with a bare id would be
      // rejected. Do not drop the prefix.
      identifyUser(`clerk:${user.id}`, {
        ...(email ? { email } : {}),
        ...(wallet ? { wallet } : {}),
        auth_method: authMethod(user),
        signup_date: user.createdAt ? user.createdAt.toISOString() : "",
      });

      // Fire signed_up once per user on this device (best-effort funnel signal;
      // unique identified users is the authoritative signup count).
      const key = `panelshaq_ph_signedup_${user.id}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, "1");
        track("signed_up", { auth_method: authMethod(user) });
      }
      wasSignedIn.current = true;
    } else if (!isSignedIn && wasSignedIn.current) {
      // true → false transition = real sign-out (not the initial signed-out mount)
      resetUser();
      wasSignedIn.current = false;
    }
  }, [isSignedIn, user]);

  return null;
}
