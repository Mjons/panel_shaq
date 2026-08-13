import type { VercelRequest, VercelResponse } from "@vercel/node";

// Server-to-server proxy that begins the Discord OAuth claim. PH signs a short
// state JWT carrying the userId and the return destination, and hands back the
// Discord authorize URL; the client navigates to it itself.
//
// TWO THINGS ARE LOAD-BEARING HERE.
//
// 1. `Accept: application/json`. PH's start endpoint has a fetch-first contract:
//    with this header it returns 200 { url }, without it a 302. A 302 would be
//    followed by our own fetch (or refused by `redirect: "manual"` below as a
//    status-0 opaque response), and the client would never get the URL.
//
// 2. `from=mobile` is PINNED SERVER-SIDE, never read from req.query. It rides
//    inside PH's SIGNED state token and selects which hardcoded origin the
//    callback returns to. Letting the client choose it would hand a caller
//    influence over a post-OAuth redirect target — the exact thing the signed
//    state exists to prevent. It is a constant because this app has exactly one
//    correct answer.
//
// Mirrors api/referral-code.ts.
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
    const r = await fetch(
      `${PH_BASE}/api/creator-program/discord/start?from=mobile`,
      {
        headers: { Authorization: auth, Accept: "application/json" },
        redirect: "manual",
      },
    );
    if (r.status === 0)
      return res.status(502).json({
        error:
          "Upstream redirect. Set PANELHAUS_API_BASE to the non-redirecting origin (https://www.panelhaus.app)",
      });
    return res.status(r.status).json(await r.json().catch(() => ({})));
  } catch {
    return res.status(502).json({ error: "Could not start Discord connect" });
  }
}
