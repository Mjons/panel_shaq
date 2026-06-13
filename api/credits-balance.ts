import type { VercelRequest, VercelResponse } from "@vercel/node";

// Read-only proxy to Panel Haus's shared credit balance. Forwards the caller's
// Clerk Bearer server-to-server (PH is the single source of truth). Must target
// the non-redirecting origin (apex 307s to www and strips Authorization).
// Normalize to the non-redirecting origin (apex panelhaus.app 307s to www, which
// strips the Authorization header on the cross-origin hop). Force www.
const PH_BASE = (
  process.env.PANELHAUS_API_BASE || "https://www.panelhaus.app"
).replace("://panelhaus.app", "://www.panelhaus.app");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const auth = (req.headers["authorization"] as string) || "";
  if (!auth) return res.status(401).json({ error: "Authentication required" });

  try {
    const r = await fetch(`${PH_BASE}/api/credits/balance`, {
      headers: { Authorization: auth },
      redirect: "manual",
    });
    if (r.status === 0)
      return res.status(502).json({
        error:
          "Upstream redirect — set PANELHAUS_API_BASE to the non-redirecting origin (https://www.panelhaus.app)",
      });
    return res.status(r.status).json(await r.json().catch(() => ({})));
  } catch {
    return res.status(502).json({ error: "Failed to fetch balance" });
  }
}
