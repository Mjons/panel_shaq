import type { VercelRequest, VercelResponse } from "@vercel/node";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = getApiKey(req);
  if (!apiKey) return res.status(401).json({ error: "No API key configured." });

  const {
    prompt,
    style,
    referenceImages,
    styleReferenceImage,
    aspectRatio = "16:9",
  } = req.body;
  if (!prompt?.trim())
    return res.status(400).json({ error: "Prompt is required" });

  try {
    const parts: any[] = [
      {
        text: `A cinematic comic book panel.
        ${styleReferenceImage ? "MANDATORY STYLE ADHERENCE: The FIRST attached image is a style reference. You MUST strictly replicate its exact artistic style, brushwork, color palette, line weight, shading technique, and overall visual aesthetic. The output MUST look like it was drawn by the same artist. Do NOT deviate from this style under any circumstances — ignore any art style mentioned in the text prompt." : `Style: ${style}.`}
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

    const image = await geminiImage(
      apiKey,
      "gemini-3.1-flash-image-preview",
      parts,
      { aspectRatio, imageSize: "1K" },
    );

    if (!image) {
      return res.status(500).json({ error: "No image generated" });
    }
    return res.status(200).json({ image });
  } catch (error: any) {
    console.error("Generate image error:", error);
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
