import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

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

const LIMITS = { text: 50, image: 20 };

async function checkUsage(
  req: any,
  type: "text" | "image",
): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  const userId = (req.headers["x-user-id"] as string) || "";
  if (!userId) return null;

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const today = new Date().toISOString().split("T")[0];
  const col = type === "image" ? "image_generations" : "text_generations";
  const limit = type === "image" ? LIMITS.image : LIMITS.text;

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = getApiKey(req);
  if (!apiKey) return res.status(401).json({ error: "No API key configured." });

  const usageError = await checkUsage(req, "text");
  if (usageError) return res.status(429).json({ error: usageError });

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
    return res.status(200).json({ text: result || text });
  } catch (error: any) {
    console.error("Polish story error:", error);
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
