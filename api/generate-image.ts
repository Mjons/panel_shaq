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
// share local files between functions (see CLAUDE.md). Mirror these edits in
// final-render.ts. ---
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
  "http://localhost:3002",
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
      // opaque redirect — PH bounced us cross-origin (auth would be lost)
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
    /* best-effort — a stuck reserve is recoverable via the idempotency key */
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

  // Credit gate. BYOK users bypass (their own key). When Clerk is configured we
  // charge shared ink via Panel Haus (reserve now, refund on failure); otherwise
  // fall back to the legacy anonymous daily limiter so nothing breaks pre-Clerk.
  // Image model from the user's Settings: "pro" costs more ink + uses the better
  // Gemini model; anything else is "flash".
  const isPro = req.body?.model === "pro";
  const geminiModel = isPro
    ? process.env.GEMINI_IMAGE_MODEL_PRO || "gemini-3.1-flash-image-preview"
    : process.env.GEMINI_IMAGE_MODEL_FLASH || "gemini-2.5-flash-image";

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
      inkAmount = isPro
        ? parseInt(process.env.INK_COST_IMAGE_PRO || "2", 10)
        : parseInt(process.env.INK_COST_IMAGE_FLASH || "1", 10);
      inkKey = randomUUID();
      const r = await reserveInk(bearer, inkAmount, "mobile_image", inkKey);
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

  const { prompt, referenceImages, aspectRatio = "16:9" } = req.body;
  if (!prompt?.trim())
    return res.status(400).json({ error: "Prompt is required" });

  try {
    // Reference images FIRST — models weight earlier content more heavily
    const parts: any[] = [];

    if (referenceImages && referenceImages.length > 0) {
      for (const ref of referenceImages) {
        const match = ref.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        }
      }
    }

    // Text prompt AFTER images
    const hasRefs = referenceImages && referenceImages.length > 0;
    parts.push({
      text: `A cinematic comic book panel.
${hasRefs ? "STYLE & CHARACTER ADHERENCE: Replicate the artistic style, color palette, line work, and character appearance from the attached reference images. The output should look like it belongs in the same comic series. Use a NEW UNIQUE POSE and composition — do NOT copy the pose or framing from the reference images." : ""}
${prompt}
CRITICAL: Do NOT include any speech bubbles, text, or dialogue balloons in the image.`,
    });

    const image = await geminiImage(
      apiKey,
      geminiModel,
      parts,
      { aspectRatio, imageSize: "1K" },
    );

    if (image) return res.status(200).json({ image, newBalance });
    if (inkKey) await refundInk(bearer, inkAmount, inkKey, "no image generated");
    return res.status(500).json({ error: "No image generated" });
  } catch (error: any) {
    console.error("Generate image error:", error);
    if (inkKey) await refundInk(bearer, inkAmount, inkKey, "gemini failed");
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
