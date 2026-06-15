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
    track("checkout_started", { pack: boosterSize });
  } catch {
    /* ignore */
  }
  window.location.href = d.url; // Stripe-hosted checkout
}
