import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
  maxDuration: 30,
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function getApiKey(req: any): string | null {
  return (
    (req.headers["x-api-key"] as string) || process.env.GEMINI_API_KEY || ""
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = getApiKey(req);
  if (!apiKey) return res.status(401).json({ error: "No API key configured." });

  const { image, prompt } = req.body;
  if (!image) return res.status(400).json({ error: "Image is required" });

  try {
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: "Invalid image data" });

    const parts = [
      { inlineData: { mimeType: match[1], data: match[2] } },
      { text: prompt || "Describe this character's visual appearance." },
    ];

    const body = {
      contents: [{ parts }],
    };

    const response = await fetch(
      `${GEMINI_BASE}/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text)
        .filter(Boolean)
        .join("") || "";

    return res.status(200).json({ text });
  } catch (error: any) {
    console.error("Analyze character error:", error);
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
