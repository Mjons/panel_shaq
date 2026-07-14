import { useEffect, useState } from "react";
import { onShipClaim } from "../services/shipClaim";
import { track } from "../services/analytics";
import { ShipClaimSheet } from "./ShipClaimSheet";

// Subscribes to the ship-claim bus and hosts the one sheet. Mounted in
// App.tsx only: the claim is signed-in only (gated inside fireShipClaimOnce
// on the Clerk identity holder), so the Clerk-free meme root never fires it.
export function ShipClaimHost() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");

  useEffect(
    () =>
      onShipClaim((s) => {
        setSource(s);
        setOpen(true);
      }),
    [],
  );

  return (
    <ShipClaimSheet
      isOpen={open}
      source={source}
      onClose={(view) => {
        track("ship_claim_dismissed", { source, view });
        setOpen(false);
      }}
    />
  );
}
