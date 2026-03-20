import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

/**
 * Resolve the API key: user-provided header > server env var.
 * Returns null and sends 401 if no key found anywhere.
 */
export function resolveApiKey(
  req: VercelRequest,
  res: VercelResponse,
): string | null {
  const userKey = (req.headers["x-api-key"] as string) || "";
  const envKey = process.env.GEMINI_API_KEY || "";
  const key = userKey || envKey;

  if (!key) {
    res.status(401).json({
      error: "No API key configured. Add your Gemini API key in Settings.",
    });
    return null;
  }
  return key;
}

export function createAI(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}
