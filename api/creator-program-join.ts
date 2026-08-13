import type { VercelRequest, VercelResponse } from "@vercel/node";

// Server-to-server proxy to Panel Haus's Creator Program join. No body — PH's
// requireAuth binds membership to the token's userId. Joining also grants a
// one-time ink bonus into the SHARED balance, idempotent upstream via a
// `cp-bonus-<userId>` credit reference.
//
// ⚠️ 409 ALREADY_JOINED IS NOT AN ERROR and must be forwarded intact: it means
// the user joined from Panel Haus web, which is the whole point of a shared
// account. The client treats it as success and reloads the card. Swallowing it
// into a 500 would make joining on desktop look broken on mobile.
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
    const r = await fetch(`${PH_BASE}/api/creator-program/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      redirect: "manual",
    });
    if (r.status === 0)
      return res.status(502).json({
        error:
          "Upstream redirect. Set PANELHAUS_API_BASE to the non-redirecting origin (https://www.panelhaus.app)",
      });
    return res.status(r.status).json(await r.json().catch(() => ({})));
  } catch {
    return res.status(502).json({ error: "Could not join the Creator Program" });
  }
}
