import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveApiKey, createAI, friendlyError } from "./_utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = resolveApiKey(req, res);
  if (!apiKey) return;

  const { text, characters } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "Text is required" });

  const charContext = (characters || [])
    .map((c: any) => `${c.name}: ${c.description || "A character"}`)
    .join("\n");
  const charNote = charContext
    ? `\n\nCAST (preserve these character names and references exactly — do not rename or remove them):\n${charContext}`
    : "";

  const ai = createAI(apiKey);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Polish the following story segment to be more evocative and professional, maintaining a cinematic tone.${charNote}\n\nSTORY:\n${text}`,
      config: {
        systemInstruction:
          "You are a world-class comic book writer. Your writing is punchy, atmospheric, and visually descriptive. Keep all character names and references intact — never rename or remove characters from the story.",
      },
    });
    return res.status(200).json({ text: response.text || text });
  } catch (error: any) {
    console.error("Polish story error:", error);
    return res.status(500).json({ error: friendlyError(error) });
  }
}
