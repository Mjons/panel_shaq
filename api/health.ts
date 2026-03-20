import type { VercelRequest, VercelResponse } from "@vercel/node";

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
    // Use REST API directly to avoid SDK bundling issues
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Say OK" }] }],
        }),
      },
    );
    const data = await response.json();
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return res.status(200).json({ status: "ok" });
    }
    return res
      .status(500)
      .json({ error: data.error?.message || "No response" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
