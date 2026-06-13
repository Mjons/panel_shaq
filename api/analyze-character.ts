import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyToken } from "@clerk/backend";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = getApiKey(req);
  if (!apiKey) return res.status(401).json({ error: "No API key configured." });

  if (!(await requireSignInWhenClerk(req)))
    return res.status(401).json({ error: "Please sign in to generate." });

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

    return res.status(200).json({ text });
  } catch (error: any) {
    console.error("Analyze character error:", error);
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
