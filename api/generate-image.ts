import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveApiKey, createAI } from "./_utils";

export const config = {
  api: { bodyParser: { sizeLimit: "20mb" } },
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = resolveApiKey(req, res);
  if (!apiKey) return;

  const {
    prompt,
    style,
    referenceImages,
    styleReferenceImage,
    aspectRatio = "16:9",
  } = req.body;
  if (!prompt?.trim())
    return res.status(400).json({ error: "Prompt is required" });

  const ai = createAI(apiKey);

  try {
    const parts: any[] = [
      {
        text: `A cinematic comic book panel.
        ${styleReferenceImage ? "MANDATORY STYLE ADHERENCE: You MUST strictly replicate the exact artistic style, brushwork, color palette, and line weight of the provided style reference image. The output should look like it was drawn by the same artist as the reference." : `Style: ${style}.`}
        ${prompt.includes("Subject:") ? prompt : `Subject: ${prompt}.`}
        CRITICAL: Do NOT include any speech bubbles, text, or dialogue balloons in the image. The image should be pure artwork.
        ${referenceImages && referenceImages.length > 0 ? "Ensure the characters in the panel match the provided character reference images." : ""}`,
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

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: { parts },
      config: {
        imageConfig: { aspectRatio, imageSize: "1K" },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return res.status(200).json({
          image: `data:image/png;base64,${part.inlineData.data}`,
        });
      }
    }
    return res.status(500).json({ error: "No image generated" });
  } catch (error: any) {
    console.error("Generate image error:", error);
    return res
      .status(500)
      .json({ error: error.message || "Image generation failed" });
  }
}
