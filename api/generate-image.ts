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

  const {
    prompt,
    style,
    referenceImages,
    styleReferenceImage,
    aspectRatio = "16:9",
    styleNotes,
  } = req.body;
  if (!prompt?.trim())
    return res.status(400).json({ error: "Prompt is required" });

  try {
    const parts: any[] = [
      {
        text: `${styleReferenceImage ? "A comic panel. MANDATORY STYLE ADHERENCE: The FIRST attached image is a style reference. You MUST strictly replicate its exact artistic style — line work, coloring, shading, proportions, level of detail, and overall aesthetic. If the reference is cartoony, the output MUST be cartoony. If it is realistic, the output MUST be realistic. Do NOT default to any other style. The output MUST look like it was drawn by the same artist as the reference." : `A cinematic comic book panel. Style: ${style}.`}
        ${styleNotes ? `Style notes: ${styleNotes}.` : ""}
        ${prompt.includes("Subject:") ? prompt : `Subject: ${prompt}.`}
        CRITICAL: Do NOT include any speech bubbles, text, or dialogue balloons in the image. The image should be pure artwork.
        ${referenceImages && referenceImages.length > 0 ? "CRITICAL: The character(s) in this panel MUST closely match the appearance shown in the provided character reference image(s). Match their face, body type, clothing, and distinguishing features exactly." : ""}`,
      },
    ];

    if (styleReferenceImage) {
      const match = styleReferenceImage.match(
        /^data:(image\/\w+);base64,(.+)$/,
      );
      if (match) {
        parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }

    if (referenceImages && referenceImages.length > 0) {
      for (const ref of referenceImages) {
        const match = ref.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        }
      }
    }

    // Try gemini-2.0-flash-preview-image-generation first, fall back to other models
    const models = ["gemini-3-pro-image-preview"];

    let lastError = "";
    for (const model of models) {
      try {
        const image = await geminiImage(apiKey, model, parts, { aspectRatio });
        if (image) return res.status(200).json({ image });
        lastError = `${model}: no image in response`;
      } catch (e: any) {
        lastError = `${model}: ${e.message}`;
        continue;
      }
    }

    return res
      .status(500)
      .json({ error: `Image generation failed. ${lastError}` });
  } catch (error: any) {
    console.error("Generate image error:", error);
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
