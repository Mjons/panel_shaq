import type { VercelRequest, VercelResponse } from "@vercel/node";

// Read proxy to Panel Haus's Creator Card state — the card's ONE load call.
// Forwards the caller's Clerk Bearer; PH's requireAuth is the authority.
//
// ⚠️ THIS GET MUTATES, and that is by design upstream. Before answering, PH runs
// its server sweep: any verified step whose evidence now exists (the Discord
// claim, two real referrals, a contest entry, a first generation) is recorded
// and paid out, and comes back in `awarded[]`. Every award is evidence-gated and
// idempotent — `point_transactions` carries a partial UNIQUE on
// (type, reference_id) and card actions use the userId as the reference — so a
// repeat call is a pure read. Do NOT "optimise" this into a cached read that
// skips the round trip: the sweep is how steps completed outside the app ever
// tick. Mirrors api/referral-code.ts.
//
// Normalize to the non-redirecting origin (apex panelhaus.app 307s to www, which
// strips the Authorization header on the cross-origin hop). Force www.
const PH_BASE = (
  process.env.PANELHAUS_API_BASE || "https://www.panelhaus.app"
).trim().replace("://panelhaus.app", "://www.panelhaus.app").replace(/\/+$/, "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const auth = (req.headers["authorization"] as string) || "";
  if (!auth) return res.status(401).json({ error: "Authentication required" });

  try {
    const r = await fetch(`${PH_BASE}/api/creator-card/state`, {
      headers: { Authorization: auth },
      redirect: "manual",
    });
    if (r.status === 0)
      return res.status(502).json({
        error:
          "Upstream redirect. Set PANELHAUS_API_BASE to the non-redirecting origin (https://www.panelhaus.app)",
      });
    return res.status(r.status).json(await r.json().catch(() => ({})));
  } catch {
    return res.status(502).json({ error: "Failed to load card state" });
  }
}
