import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyToken } from "@clerk/backend";
import { randomUUID } from "crypto";

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
  maxDuration: 30,
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function getApiKey(req: any): string | null {
  return (
    (req.headers["x-api-key"] as string) || process.env.GEMINI_API_KEY || ""
  );
}

// Sign-in gate (Panel Haus shared auth). Inlined per route — Vercel can't share
// local files between functions (see CLAUDE.md). BYOK + pre-Clerk both bypass.
const AUTHORIZED_PARTIES = [
  "https://m.panelhaus.app",
  "https://shaq.panelhaus.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:3002",
];

async function requireSignInWhenClerk(req: any): Promise<boolean> {
  if (req.headers["x-api-key"]) return true; // BYOK bypass
  if (!process.env.CLERK_SECRET_KEY) return true; // Clerk not configured → legacy
  const h = (req.headers["authorization"] as string) || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return false;
  try {
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: AUTHORIZED_PARTIES,
    });
    return !!claims?.sub;
  } catch {
    return false;
  }
}

// Charge ink via PH (admins + insufficient handled PH-side). Normalize apex->www
// so the Authorization header survives (apex 307s and strips it).
const PH_BASE = (
  process.env.PANELHAUS_API_BASE || "https://www.panelhaus.app"
).replace("://panelhaus.app", "://www.panelhaus.app");

async function reserveInk(
  bearer: string,
  amount: number,
  action: string,
  idempotencyKey: string,
): Promise<{ status: number; body: any }> {
  try {
    const r = await fetch(`${PH_BASE}/api/credits/reserve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ amount, action, idempotencyKey }),
      redirect: "manual",
    });
    if (r.status === 0) return { status: 502, body: {} };
    return { status: r.status, body: await r.json().catch(() => ({})) };
  } catch {
    return { status: 502, body: {} };
  }
}

async function refundInk(
  bearer: string,
  amount: number,
  idempotencyKey: string,
  reason: string,
): Promise<void> {
  try {
    await fetch(`${PH_BASE}/api/credits/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ amount, idempotencyKey, reason }),
      redirect: "manual",
    });
  } catch {
    /* best-effort */
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = getApiKey(req);
  if (!apiKey) return res.status(401).json({ error: "No API key configured." });

  if (!(await requireSignInWhenClerk(req)))
    return res.status(401).json({ error: "Please sign in to generate." });

  // Charge ink for the AI call. BYOK + admins (handled PH-side) bypass.
  const byok = !!(req.headers["x-api-key"] as string);
  const bearer = ((req.headers["authorization"] as string) || "").replace(
    /^Bearer /,
    "",
  );
  let inkAmount = 0;
  let inkKey: string | null = null;
  let newBalance: number | undefined;
  if (process.env.CLERK_SECRET_KEY && !byok) {
    inkAmount = parseInt(process.env.INK_COST_TEXT || "1", 10);
    inkKey = randomUUID();
    const r = await reserveInk(bearer, inkAmount, "mobile_text", inkKey);
    if (r.status === 402)
      return res
        .status(402)
        .json({ error: "out_of_ink", code: "INSUFFICIENT_CREDITS", required: r.body?.required });
    if (r.status === 429)
      return res
        .status(429)
        .json({ error: "weekly_limit_reached", code: "WEEKLY_LIMIT_REACHED" });
    if (r.status !== 200)
      return res.status(502).json({ error: "Credit reserve failed" });
    newBalance = r.body?.newBalance;
  }

  const { image, prompt } = req.body;
  if (!image) return res.status(400).json({ error: "Image is required" });

  try {
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: "Invalid image data" });

    const parts = [
      { inlineData: { mimeType: match[1], data: match[2] } },
      { text: prompt || "Describe this character's visual appearance." },
    ];

    const body = {
      contents: [{ parts }],
    };

    const response = await fetch(
      `${GEMINI_BASE}/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text)
        .filter(Boolean)
        .join("") || "";

    return res.status(200).json({ text, newBalance });
  } catch (error: any) {
    if (inkKey) await refundInk(bearer, inkAmount, inkKey, "gemini failed");
    console.error("Analyze character error:", error);
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
