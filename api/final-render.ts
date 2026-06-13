import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "@clerk/backend";
import { randomUUID } from "crypto";

export const config = {
  api: { bodyParser: { sizeLimit: "20mb" } },
  maxDuration: 60,
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

// --- Shared-credit gate (Panel Haus). Inlined per route on purpose — Vercel can't
// share local files between functions (see CLAUDE.md). Same block as generate-image.ts. ---
// Normalize to the non-redirecting origin. The apex panelhaus.app 307s to www, and
// a cross-origin redirect STRIPS the Authorization header (Fetch spec) → the credit
// call would 401. Force www even if the env was mistakenly set to the apex.
const PH_BASE = (
  process.env.PANELHAUS_API_BASE || "https://www.panelhaus.app"
).replace("://panelhaus.app", "://www.panelhaus.app");
const AUTHORIZED_PARTIES = [
  "https://m.panelhaus.app",
  "https://shaq.panelhaus.app",
  "http://localhost:3000",
  "http://localhost:5173",
];

function bearerToken(req: any): string {
  const h = (req.headers["authorization"] as string) || "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}

async function verifyClerkBearer(token: string): Promise<boolean> {
  if (!token || !process.env.CLERK_SECRET_KEY) return false;
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
      redirect: "manual", // never silently follow a redirect that drops the Bearer
    });
    if (r.status === 0) {
      console.error(
        "[reserve] PANELHAUS_API_BASE redirected; set it to the non-redirecting origin (https://www.panelhaus.app)",
      );
      return { status: 502, body: {} };
    }
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

function getApiKey(req: any): string | null {
  return (
    (req.headers["x-api-key"] as string) || process.env.GEMINI_API_KEY || ""
  );
}

async function geminiImage(
  apiKey: string,
  model: string,
  parts: any[],
  imageConfig?: {
    aspectRatio?: string;
    imageSize?: string;
  },
): Promise<string | null> {
  const body: any = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
      ...(imageConfig ? { imageConfig } : {}),
    },
  };
  const res = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  for (const part of data.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return null;
}

async function checkUsage(
  req: any,
  type: "text" | "image",
): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  const userId = (req.headers["x-user-id"] as string) || "";
  if (!userId) return null;

  // BYOK users spend their own quota; anon users spend ours — throttle harder.
  const isBYOK = !!(req.headers["x-api-key"] as string);
  const limits = isBYOK
    ? { text: 50, image: 20 }
    : {
        text: parseInt(process.env.ANON_LIMIT_TEXT || "10", 10),
        image: parseInt(process.env.ANON_LIMIT_IMAGE || "5", 10),
      };

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const today = new Date().toISOString().split("T")[0];
  const col = type === "image" ? "image_generations" : "text_generations";
  const limit = type === "image" ? limits.image : limits.text;

  const { data: existing } = await supabase
    .from("usage")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  const count = existing?.[col] || 0;
  if (count >= limit) {
    return `Daily ${type} limit reached (${count}/${limit}). Resets at midnight UTC.`;
  }

  if (existing) {
    await supabase
      .from("usage")
      .update({ [col]: count + 1 })
      .eq("user_id", userId)
      .eq("date", today);
  } else {
    await supabase
      .from("usage")
      .insert({ user_id: userId, date: today, [col]: 1 });
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = getApiKey(req);
  if (!apiKey) return res.status(401).json({ error: "No API key configured." });

  // Credit gate (see generate-image.ts). BYOK bypasses; Clerk path reserves ink;
  // otherwise legacy daily limiter.
  const byok = !!(req.headers["x-api-key"] as string);
  const clerkConfigured = !!process.env.CLERK_SECRET_KEY;
  const bearer = bearerToken(req);
  let inkAmount = 0;
  let inkKey: string | null = null;
  let newBalance: number | undefined;

  if (!byok) {
    if (clerkConfigured) {
      if (!(await verifyClerkBearer(bearer)))
        return res.status(401).json({ error: "Please sign in to generate." });
      inkAmount = parseInt(process.env.INK_COST_IMAGE || "1", 10);
      inkKey = randomUUID();
      const r = await reserveInk(bearer, inkAmount, "mobile_final_render", inkKey);
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
    } else {
      const usageError = await checkUsage(req, "image");
      if (usageError) return res.status(429).json({ error: usageError });
    }
  }

  const { panelImage, bubbles, aspectRatio } = req.body;
  if (!panelImage)
    return res.status(400).json({ error: "Panel image is required" });

  const match = panelImage.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return res.status(400).json({ error: "Invalid image format" });

  const bubblesDesc = (bubbles || [])
    .map((b: any, i: number) => {
      const styleDesc: Record<string, string> = {
        speech:
          "a standard rounded speech bubble with a tail pointing to the speaker",
        thought:
          "a cloud-like thought bubble with small circles leading to the character",
        action: "a jagged, explosive action bubble with bold, dynamic text",
        effect:
          "a stylized sound effect bubble integrated into the environment",
        "sfx-impact":
          "a large, bold, explosive impact sound effect with jagged edges and intense coloring — like CRASH, BOOM, WHAM — integrated dramatically into the scene",
        "sfx-ambient":
          "a soft, subtle ambient sound effect with gentle lettering — like drip, hummm, tick — blending naturally into the environment",
      };
      return `Bubble ${i + 1}: ${styleDesc[b.style] || styleDesc.speech} containing the text: "${b.text}". Positioned at approximately ${b.pos.x}% from the left and ${b.pos.y}% from the top. Font size: ${b.fontSize}px, Style: ${b.fontWeight} ${b.fontStyle}.`;
    })
    .join("\n");

  try {
    const parts: any[] = [
      { inlineData: { mimeType: match[1], data: match[2] } },
      {
        text: `Regenerate this comic panel image. Integrate the following bubbles naturally into the scene:
            ${bubblesDesc}
            The bubbles and text should look like they are part of the original hand-drawn or painted comic art, not a digital overlay.
            Maintain the original character likeness and scene composition.`,
      },
    ];

    const image = await geminiImage(
      apiKey,
      "gemini-3.1-flash-image-preview",
      parts,
      { aspectRatio: aspectRatio || "1:1", imageSize: "1K" },
    );

    if (image) return res.status(200).json({ image, newBalance });
    if (inkKey) await refundInk(bearer, inkAmount, inkKey, "no image generated");
    return res.status(500).json({ error: "No image generated" });
  } catch (error: any) {
    console.error("Final render error:", error);
    if (inkKey) await refundInk(bearer, inkAmount, inkKey, "gemini failed");
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
