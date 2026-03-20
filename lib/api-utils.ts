import type { VercelRequest, VercelResponse } from "@vercel/node";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

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

export function friendlyError(error: any): string {
  const msg = error?.message || String(error);
  if (
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("429") ||
    msg.includes("quota")
  ) {
    if (msg.includes("free_tier")) {
      return "Free tier quota exceeded. Image generation requires billing enabled. New Google Cloud accounts get $300 free credits.";
    }
    const retryMatch = msg.match(/retry in ([\d.]+)/i);
    const retryHint = retryMatch
      ? ` Try again in ${Math.ceil(Number(retryMatch[1]))}s.`
      : "";
    return `Rate limit exceeded.${retryHint} Wait a moment and try again.`;
  }
  if (
    msg.includes("API_KEY_INVALID") ||
    msg.includes("API key not valid") ||
    msg.includes("401") ||
    msg.includes("403")
  ) {
    return "Invalid API key. Check your key in Settings.";
  }
  return error?.message || "An unexpected error occurred.";
}

/** Call Gemini text generation via REST */
export async function geminiText(
  apiKey: string,
  model: string,
  contents: string,
  opts?: {
    systemInstruction?: string;
    responseMimeType?: string;
    responseSchema?: any;
  },
): Promise<string> {
  const body: any = {
    contents: [{ parts: [{ text: contents }] }],
  };
  if (opts?.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }
  if (opts?.responseMimeType) {
    body.generationConfig = {
      responseMimeType: opts.responseMimeType,
      ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
    };
  }

  const res = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

/** Call Gemini image generation via REST */
export async function geminiImage(
  apiKey: string,
  model: string,
  parts: any[],
  imageConfig?: { aspectRatio?: string; imageSize?: string },
): Promise<string | null> {
  const body: any = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
      ...(imageConfig ? { imageConfig } : {}),
    },
  };

  const res = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  for (const part of data.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
}
