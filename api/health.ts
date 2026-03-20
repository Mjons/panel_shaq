import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    // Minimal test — just check we can load the SDK
    const { GoogleGenAI } = await import("@google/genai");

    const userKey = (req.headers["x-api-key"] as string) || "";
    const envKey = process.env.GEMINI_API_KEY || "";
    const apiKey = userKey || envKey;

    if (!apiKey) {
      return res.status(401).json({ error: "No API key" });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: "Say OK",
    });

    return res.status(200).json({ status: "ok", text: response.text });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Unknown error",
      stack: error.stack?.split("\n").slice(0, 3),
    });
  }
}
