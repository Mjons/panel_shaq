import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveApiKey, createAI } from "./_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = resolveApiKey(req, res);
  if (!apiKey) return;

  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "Text is required" });

  const ai = createAI(apiKey);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Polish the following story segment to be more evocative and professional, maintaining a "Cyberpunk Noir" tone: \n\n${text}`,
      config: {
        systemInstruction:
          "You are a world-class comic book writer specializing in Cyberpunk Noir. Your writing is punchy, atmospheric, and visually descriptive.",
      },
    });
    return res.status(200).json({ text: response.text || text });
  } catch (error: any) {
    console.error("Polish story error:", error);
    return res.status(500).json({ error: error.message || "Polish failed" });
  }
}
