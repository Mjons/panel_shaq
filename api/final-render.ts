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
      { aspectRatio: "16:9", imageSize: "1K" },
    );

    if (!image) {
      return res.status(500).json({ error: "No image generated" });
    }
    return res.status(200).json({ image });
  } catch (error: any) {
    console.error("Final render error:", error);
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
