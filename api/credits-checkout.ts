import type { VercelRequest, VercelResponse } from "@vercel/node";

// Server-to-server proxy to Panel Haus's Stripe checkout. PH's endpoint has no
// CORS, so the browser can't call it directly; we forward the caller's Clerk
// Bearer and set Origin so PH builds the success/cancel URLs back to OUR host.
// No Stripe secrets or price IDs live here; PH's requireAuth is the authority and
// binds the purchase to the token's userId. Mirrors api/credits-balance.ts.
//
// Normalize to the non-redirecting origin (apex panelhaus.app 307s to www, which
// strips the Authorization header on the cross-origin hop). Force www.
const PH_BASE = (
  process.env.PANELHAUS_API_BASE || "https://www.panelhaus.app"
).replace("://panelhaus.app", "://www.panelhaus.app");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const auth = (req.headers["authorization"] as string) || "";
  if (!auth) return res.status(401).json({ error: "Authentication required" });

  // The incoming browser Origin (same-origin call to this proxy) auto-resolves
  // prod (m.panelhaus.app) vs dev (localhost:3002) so PH returns the user to the
  // right host; PUBLIC_APP_ORIGIN is just an override fallback.
  const origin =
    (req.headers.origin as string) ||
    process.env.PUBLIC_APP_ORIGIN ||
    "https://m.panelhaus.app";

  try {
    const r = await fetch(`${PH_BASE}/api/stripe-create-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
        Origin: origin,
      },
      body: JSON.stringify(req.body || {}),
      redirect: "manual",
    });
    if (r.status === 0)
      return res.status(502).json({
        error:
          "Upstream redirect. Set PANELHAUS_API_BASE to the non-redirecting origin (https://www.panelhaus.app)",
      });
    return res.status(r.status).json(await r.json().catch(() => ({})));
  } catch {
    return res.status(502).json({ error: "Checkout creation failed" });
  }
}
