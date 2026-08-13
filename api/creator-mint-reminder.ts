import type { VercelRequest, VercelResponse } from "@vercel/node";

// Server-to-server proxy to Panel Haus's pre-mint reminder opt-in.
// Body is { optIn: boolean, email? }.
//
// The email is accepted in the body because wallet-only accounts have no email
// anywhere in the system, and they are exactly the crypto-native users the mint
// targets — so the opt-in cannot be a bare boolean. PH stores it in its own
// column and never writes it back over the account address.
//
// PH writes Postgres FIRST and syncs Brevo after, failing soft on the sync, so a
// 200 with `synced: false` still means the consent is recorded. Surface it as
// success. Mirrors api/referral-link.ts.
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
    const r = await fetch(`${PH_BASE}/api/creator-card/mint-reminder`, {
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
    return res.status(502).json({ error: "Could not save that" });
  }
}
