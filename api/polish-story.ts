import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveApiKey, geminiText, friendlyError } from "../lib/api-utils";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

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

  try {
    const result = await geminiText(
      apiKey,
      "gemini-3.1-flash-lite-preview",
      `Polish the following story segment to be more evocative and professional, maintaining a cinematic tone.${charNote}\n\nSTORY:\n${text}`,
      {
        systemInstruction:
          "You are a world-class comic book writer. Your writing is punchy, atmospheric, and visually descriptive. Keep all character names and references intact — never rename or remove characters from the story.",
      },
    );
    return res.status(200).json({ text: result || text });
  } catch (error: any) {
    console.error("Polish story error:", error);
    return res.status(500).json({ error: friendlyError(error) });
  }
}
