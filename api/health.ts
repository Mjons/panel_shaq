import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveApiKey, createAI, friendlyError } from "./_utils";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = resolveApiKey(req, res);
  if (!apiKey) return;

  try {
    const ai = createAI(apiKey);
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: "Say OK",
    });
    if (response.text) {
      return res.status(200).json({ status: "ok" });
    }
    return res.status(500).json({ error: "No response from Gemini" });
  } catch (error: any) {
    return res.status(500).json({ error: friendlyError(error) });
  }
}
