import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: { bodyParser: { sizeLimit: "20mb" } },
  maxDuration: 60,
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

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

  const usageError = await checkUsage(req, "image");
  if (usageError) return res.status(429).json({ error: usageError });

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
${hasRefs ? "STYLE & CHARACTER ADHERENCE: Replicate the artistic style, color palette, line work, and character appearance from the attached reference images. The output should look like it belongs in the same comic series." : ""}
${prompt}
CRITICAL: Do NOT include any speech bubbles, text, or dialogue balloons in the image.`,
    });

    const image = await geminiImage(
      apiKey,
      "gemini-3.1-flash-image-preview",
      parts,
      { aspectRatio, imageSize: "1K" },
    );

    if (image) return res.status(200).json({ image });
    return res.status(500).json({ error: "No image generated" });
  } catch (error: any) {
    console.error("Generate image error:", error);
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
