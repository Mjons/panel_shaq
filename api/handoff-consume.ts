import type { VercelRequest, VercelResponse } from "@vercel/node";

// Same-origin proxy for the PanelHaus handoff consume. The browser POSTs here
// (same origin → no CORS), and we call panelhaus.app server-to-server (also no
// CORS). This avoids the cross-origin preflight that fails when the upstream
// endpoint answers OPTIONS with 405. Status + body are passed through so the
// client still sees 200 (payload) / 410 (used or expired).

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

const PANELHAUS_API_BASE =
  process.env.PANELHAUS_API_BASE || "https://panelhaus.app";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token =
    typeof req.body === "object" && req.body ? req.body.token : undefined;
  if (!token) {
    return res.status(400).json({ error: "Missing token" });
  }

  try {
    const upstream = await fetch(`${PANELHAUS_API_BASE}/api/handoff/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(data);
  } catch (err: any) {
    console.error("handoff-consume proxy failed:", err?.message || err);
    return res.status(502).json({ error: "Upstream consume failed" });
  }
}
