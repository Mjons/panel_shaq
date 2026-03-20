import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey =
    (req.headers["x-api-key"] as string) || process.env.GEMINI_API_KEY || "";

  if (!apiKey) return res.status(401).json({ error: "No API key configured." });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: "Say OK",
    });
    if (response.text) {
      return res.status(200).json({ status: "ok" });
    }
    return res.status(500).json({ error: "No response" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
