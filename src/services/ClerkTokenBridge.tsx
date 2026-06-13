import { useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { registerClerkTokenGetter, clearClerkTokenGetter } from "./clerkToken";

// Bridges Clerk's useAuth().getToken into the module-level holder so non-React
// code (geminiService.apiPost) can mint a Bearer token per request. Renders
// nothing. Must be mounted INSIDE <ClerkProvider>.
export function ClerkTokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    registerClerkTokenGetter(() => getToken());
    return () => clearClerkTokenGetter();
  }, [getToken]);
  return null;
}
