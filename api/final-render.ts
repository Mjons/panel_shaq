import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveApiKey, createAI, friendlyError } from "../lib/api-utils";

export const config = {
  api: { bodyParser: { sizeLimit: "20mb" } },
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = resolveApiKey(req, res);
  if (!apiKey) return;

  const { panelImage, bubbles } = req.body;
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
      };
      return `Bubble ${i + 1}: ${styleDesc[b.style] || styleDesc.speech} containing the text: "${b.text}". Positioned at approximately ${b.pos.x}% from the left and ${b.pos.y}% from the top. Font size: ${b.fontSize}px, Style: ${b.fontWeight} ${b.fontStyle}.`;
    })
    .join("\n");

  const ai = createAI(apiKey);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: match[1], data: match[2] } },
          {
            text: `Regenerate this comic panel image. Integrate the following bubbles naturally into the scene:
            ${bubblesDesc}
            The bubbles and text should look like they are part of the original hand-drawn or painted comic art, not a digital overlay.
            Maintain the original character likeness and scene composition.`,
          },
        ],
      },
      config: {
        imageConfig: { aspectRatio: "16:9", imageSize: "1K" },
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
    console.error("Final render error:", error);
    return res.status(500).json({ error: friendlyError(error) });
  }
}
