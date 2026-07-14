import { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { registerShipIdentity } from "../services/shipClaim";

// Feeds the Clerk identity into the shipClaim module holder. This is the ONLY
// Clerk-touching piece of the ship-claim feature: the sheet/service must stay
// Clerk-free because they also run under the Clerk-free /c/from-meme root
// (same holder pattern as clerkToken.ts / ClerkTokenBridge).
export function ShipIdentityBridge() {
  const { isSignedIn, user } = useUser();

  useEffect(() => {
    if (isSignedIn && user) {
      registerShipIdentity({
        clerkUserId: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        wallet: user.web3Wallets?.[0]?.web3Wallet,
      });
    } else {
      registerShipIdentity(null);
    }
  }, [isSignedIn, user]);

  return null;
}
