import { getClerkToken } from "./clerkToken";

// Starts a Panel Haus Stripe checkout for a booster pack via our same-origin
// proxy (api/credits-checkout → PH /api/stripe-create-checkout), then redirects
// the browser to Stripe's hosted page. PH grants the credits to the shared
// balance via its webhook; the return URL brings the user back to our origin.

export type BoosterSize = "small" | "medium" | "large";

export async function startBoosterCheckout(
  boosterSize: BoosterSize,
): Promise<void> {
  const token = await getClerkToken();
  if (!token) throw new Error("Please sign in first.");

  const r = await fetch("/api/credits-checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type: "booster", boosterSize }),
  });

  const d = await r.json().catch(() => ({}) as { url?: string; error?: string });
  if (r.status === 503)
    throw new Error("Payments are temporarily unavailable.");
  if (!r.ok || !d?.url)
    throw new Error(d?.error || "Couldn't start checkout.");

  try {
    const { track } = await import("./analytics");
    track("checkout_started", { pack: boosterSize, method: "card" });
  } catch {
    /* ignore */
  }
  window.location.href = d.url; // Stripe-hosted checkout
}

/**
 * The crypto twin of startBoosterCheckout (api/crypto-create-invoice → PH
 * /api/crypto/create-invoice → OxaPay's hosted page). PH creates the invoice,
 * receives OxaPay's callback and grants the credits; we only start the flow.
 *
 * Only `type: "booster"` is ever sent — panel_shaq sells boosters only, and PH
 * deliberately rejects `subscription` (crypto has no stored method to auto-renew).
 */
export async function startCryptoBoosterCheckout(
  boosterSize: BoosterSize,
): Promise<void> {
  const token = await getClerkToken();
  if (!token) throw new Error("Please sign in first.");

  const r = await fetch("/api/crypto-create-invoice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type: "booster", boosterSize }),
  });

  const d = await r.json().catch(() => ({}) as { url?: string; error?: string });
  // 503 covers both OXAPAY_DISABLED and PRICE_UNAVAILABLE (PH can't reach Stripe
  // for the live price); 429 is PH's 5-invoices-per-minute-per-user limit.
  if (r.status === 503)
    throw new Error("Crypto payments are temporarily unavailable.");
  if (r.status === 429)
    throw new Error("Too many attempts. Please wait a minute.");
  if (!r.ok || !d?.url)
    throw new Error(d?.error || "Couldn't start crypto checkout.");

  try {
    const { track } = await import("./analytics");
    track("checkout_started", { pack: boosterSize, method: "crypto" });
  } catch {
    /* ignore */
  }
  window.location.href = d.url; // OxaPay-hosted checkout
}
