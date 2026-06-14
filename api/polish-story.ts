import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "@clerk/backend";
import { randomUUID } from "crypto";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function getApiKey(req: any): string | null {
  return (
    (req.headers["x-api-key"] as string) || process.env.GEMINI_API_KEY || ""
  );
}

async function geminiText(
  apiKey: string,
  model: string,
  contents: string,
  opts?: {
    systemInstruction?: string;
    responseMimeType?: string;
    responseSchema?: any;
  },
): Promise<string> {
  const body: any = { contents: [{ parts: [{ text: contents }] }] };
  if (opts?.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }
  if (opts?.responseMimeType) {
    body.generationConfig = {
      responseMimeType: opts.responseMimeType,
      ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
    };
  }
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
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
    const { error } = await supabase
      .from("usage")
      .update({ [col]: count + 1 })
      .eq("user_id", userId)
      .eq("date", today);
    if (error) console.error("Usage update error:", error);
  } else {
    const { error } = await supabase
      .from("usage")
      .insert({ user_id: userId, date: today, [col]: 1 });
    if (error) console.error("Usage insert error:", error);
  }
  return null;
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
).replace("://panelhaus.app", "://www.panelhaus.app").replace(/\/+$/, "");

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

  // Charge ink for the AI call. BYOK + admins (handled PH-side) bypass; legacy
  // daily limiter applies only when Clerk/shared credits are off.
  const byok = !!(req.headers["x-api-key"] as string);
  const bearer = ((req.headers["authorization"] as string) || "").replace(
    /^Bearer /,
    "",
  );
  let inkAmount = 0;
  let inkKey: string | null = null;
  let newBalance: number | undefined;
  if (process.env.CLERK_SECRET_KEY) {
    if (!byok) {
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
  } else {
    const usageError = await checkUsage(req, "text");
    if (usageError) return res.status(429).json({ error: usageError });
  }

  const { text, characters } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "Text is required" });

  const charContext = (characters || [])
    .map((c: any) => `${c.name}: ${c.description || "A character"}`)
    .join("\n");
  const charNote = charContext
    ? `\n\nCAST (preserve these character names and references exactly — do not rename or remove them):\n${charContext}`
    : "";

  try {
    const result = await geminiText(
      apiKey,
      "gemini-3.1-flash-lite-preview",
      `Polish the following story segment to be more evocative and professional, maintaining a cinematic tone.${charNote}\n\nSTORY:\n${text}\n\nRespond with ONLY the polished story text. No tips, no explanations, no commentary, no preamble, no closing remarks.`,
      {
        systemInstruction:
          "You are a world-class comic book writer. Your writing is punchy, atmospheric, and visually descriptive. Keep all character names and references intact — never rename or remove characters from the story. Output ONLY the polished story text — nothing else. No introductions, no tips, no suggestions, no meta-commentary.",
      },
    );
    return res.status(200).json({ text: result || text, newBalance });
  } catch (error: any) {
    if (inkKey) await refundInk(bearer, inkAmount, inkKey, "gemini failed");
    console.error("Polish story error:", error);
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
