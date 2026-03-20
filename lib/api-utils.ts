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

/** Extract a user-friendly error message from Gemini API errors */
export function friendlyError(error: any): string {
  const msg = error?.message || String(error);
  if (
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("429") ||
    msg.includes("quota")
  ) {
    if (msg.includes("free_tier")) {
      return "Free tier quota exceeded. Image generation requires a paid API key with billing enabled. Visit console.cloud.google.com to enable billing — new accounts get $300 free credits.";
    }
    // Extract retry delay if present
    const retryMatch = msg.match(/retry in ([\d.]+)/i);
    const retryHint = retryMatch
      ? ` Try again in ${Math.ceil(Number(retryMatch[1]))}s.`
      : "";
    return `Rate limit exceeded.${retryHint} Wait a moment and try again, or check your quota at ai.dev/rate-limit.`;
  }
  if (
    msg.includes("API_KEY_INVALID") ||
    msg.includes("401") ||
    msg.includes("403")
  ) {
    return "Invalid API key. Check your key in Settings.";
  }
  return error?.message || "An unexpected error occurred.";
}
