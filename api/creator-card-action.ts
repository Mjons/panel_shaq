import type { VercelRequest, VercelResponse } from "@vercel/node";

// Server-to-server proxy to Panel Haus's Creator Card action recorder. Body is
// { action }; PH allowlists it against its own CARD_ACTIONS table, so the point
// values live upstream and nothing here can mint points.
//
// ⚠️ FORWARD PH'S STATUS AND BODY VERBATIM. The client branches on the `code`
// field, and the three failures mean different things to the user:
//   403 NOT_MEMBER     -> hasn't joined the program
//   409 CLAIM_REQUIRED -> joined, but hasn't claimed the card yet (the claim is
//                         a prerequisite for every other action)
//   409 NOT_VERIFIED   -> the evidence PH checks for isn't there yet
// Collapsing these into a generic error would tell an honour-ask user "not
// completed yet" when their real problem is that they never claimed.
// Mirrors api/referral-link.ts.
//
// Normalize to the non-redirecting origin (apex panelhaus.app 307s to www, which
// strips the Authorization header on the cross-origin hop). Force www.
const PH_BASE = (
  process.env.PANELHAUS_API_BASE || "https://www.panelhaus.app"
).trim().replace("://panelhaus.app", "://www.panelhaus.app").replace(/\/+$/, "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const auth = (req.headers["authorization"] as string) || "";
  if (!auth) return res.status(401).json({ error: "Authentication required" });

  try {
    const r = await fetch(`${PH_BASE}/api/creator-card/action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
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
    return res.status(502).json({ error: "Could not record that" });
  }
}
