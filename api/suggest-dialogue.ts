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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = getApiKey(req);
  if (!apiKey) return res.status(401).json({ error: "No API key configured." });

  const { images, prompt, story, panels, characters } = req.body;
  if (!images || !Array.isArray(images) || images.length === 0)
    return res.status(400).json({ error: "At least one image is required" });

  try {
    const parts: any[] = [];

    for (const image of images) {
      const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) continue;
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }

    if (parts.length === 0)
      return res.status(400).json({ error: "No valid images" });

    // Build context text
    let contextText = prompt || "Suggest dialogue for this comic page.";

    if (story) {
      contextText += `\n\nSTORY CONTEXT:\n${story}`;
    }

    if (panels && Array.isArray(panels) && panels.length > 0) {
      contextText += "\n\nPANEL DESCRIPTIONS:";
      for (const p of panels) {
        contextText += `\nPanel ${p.index}: ${p.description}`;
      }
    }

    if (characters && Array.isArray(characters) && characters.length > 0) {
      contextText += "\n\nCHARACTERS:";
      for (const c of characters) {
        contextText += `\n- ${c.name}${c.description ? `: ${c.description}` : ""}`;
      }
    }

    parts.push({ text: contextText });

    const body = {
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json",
      },
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

    const rawText =
      data.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text)
        .filter(Boolean)
        .join("") || "[]";

    // Parse JSON — strip markdown fences if present
    const cleaned = rawText.replace(/```json\s*|```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const suggestions = Array.isArray(parsed)
      ? parsed
      : parsed.suggestions || [];

    return res.status(200).json({ suggestions });
  } catch (error: any) {
    console.error("Suggest dialogue error:", error);
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
