import type { VercelRequest, VercelResponse } from "@vercel/node";

// Server-to-server proxy to Panel Haus's mint-wallet attach. Body is { address }
// — the PASTED path, which PH accepts unsigned by deliberate product decision
// (its own header explains why, and warns against "tightening" it).
//
// EVERY GUARD LIVES UPSTREAM and every failure code means something distinct to
// the user, so forward PH's status and body verbatim:
//   400 ADDRESS_INVALID    -> failed viem's strict EIP-55 check
//   403 NOT_A_MEMBER       -> hasn't joined
//   403 POINTS_TOO_LOW     -> under the GTD threshold PH owns
//   409 WALLET_IS_ACCOUNT  -> that address is someone else's login wallet
//   409 WALLET_TAKEN       -> already attached elsewhere (ux_cp_wallet)
//
// ⚠️ Do NOT add a client-side address check here as a "fast path". PH's is
// EIP-55 aware and ours would not be, so a stricter-looking local regex would
// reject valid addresses, and a looser one would give false confidence about an
// address an unrecoverable NFT gets sent to. Mirrors api/referral-link.ts.
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
    const r = await fetch(`${PH_BASE}/api/creator-program/attach-wallet`, {
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
    return res.status(502).json({ error: "Could not attach that wallet" });
  }
}
