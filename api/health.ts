import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    return res.status(500).json({ error: "API key not configured on server" });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: "Say OK",
    });
    if (response.text) {
      return res.status(200).json({ status: "ok" });
    }
    return res.status(500).json({ error: "No response from Gemini" });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error.message || "Connection failed" });
  }
}
