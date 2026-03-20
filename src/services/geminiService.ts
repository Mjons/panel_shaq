async function compressImage(base64: string, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

export interface Bubble {
  id: string;
  text: string;
  pos: { x: number; y: number };
  style: "speech" | "thought" | "action" | "effect";
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  tailPos?: { x: number; y: number };
}

export interface PanelPrompt {
  id: string;
  description: string;
  characterFocus?: string;
  cameraAngle?: string;
  mood?: string;
  aspectRatio?: string;
  artStyle?: string;
  image?: string;
  selectedCharacterIds?: string[];
  customReferenceImages?: string[];
  useStyleRef?: boolean;
  bubbles: Bubble[];
  imageTransform?: { x: number; y: number; scale: number };
}

/** Ensure a panel always has valid bubbles and imageTransform fields */
export function hydratePanel(p: any): PanelPrompt {
  return {
    ...p,
    bubbles: Array.isArray(p.bubbles) ? p.bubbles : [],
    imageTransform: p.imageTransform || { x: 0, y: 0, scale: 1 },
  };
}

export interface InsertionContext {
  story: string;
  previousPanel: PanelPrompt | null;
  nextPanel: PanelPrompt | null;
  allCharacters: { name: string; description?: string }[];
  insertIndex: number;
}

// Global error listener — components subscribe via onApiError
type ErrorListener = (message: string) => void;
let _errorListener: ErrorListener | null = null;

export function onApiError(listener: ErrorListener) {
  _errorListener = listener;
  return () => {
    if (_errorListener === listener) _errorListener = null;
  };
}

function notifyError(context: string, error: unknown) {
  const msg = error instanceof Error ? error.message : "Unknown error";
  console.error(`${context}:`, error);
  _errorListener?.(`${context}: ${msg}`);
}

const DEFAULT_TIMEOUT = 90_000; // 90s for text endpoints
const IMAGE_TIMEOUT = 180_000; // 180s for image generation

function getUserApiKey(): string {
  try {
    const saved = localStorage.getItem("panelshaq_settings");
    if (saved) return JSON.parse(saved).geminiApiKey || "";
  } catch {
    /* ignore */
  }
  return "";
}

// Direct Gemini client for BYOK / local dev fallback
async function getDirectAI() {
  const { GoogleGenAI } = await import("@google/genai");
  const key = getUserApiKey();
  if (!key) throw new Error("No API key configured. Add one in Settings.");
  return new GoogleGenAI({ apiKey: key });
}

// Track whether the serverless proxy is available
let _proxyAvailable: boolean | null = null;

async function apiPost<T>(
  endpoint: string,
  body: any,
  timeoutMs: number = DEFAULT_TIMEOUT,
): Promise<T> {
  // If we already know proxy is down, skip it
  if (_proxyAvailable === false) {
    throw new Error("proxy-unavailable");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const userKey = getUserApiKey();
  if (userKey) headers["x-api-key"] = userKey;

  try {
    const res = await fetch(`/api/${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.status === 404) {
      _proxyAvailable = false;
      throw new Error("proxy-unavailable");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `API error ${res.status}`);
    }
    _proxyAvailable = true;
    return res.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        `Request timed out after ${Math.round(timeoutMs / 1000)}s`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const generatePanelPrompts = async (
  story: string,
  characters: any[],
): Promise<PanelPrompt[]> => {
  if (!story.trim()) return [];

  try {
    const { panels } = await apiPost<{ panels: any[] }>("generate-panels", {
      story,
      characters,
    });
    return panels.map(hydratePanel);
  } catch (error: any) {
    if (error?.message === "proxy-unavailable") {
      // Direct Gemini fallback
      try {
        const ai = await getDirectAI();
        const { Type } = await import("@google/genai");
        const charContext = (characters || [])
          .map(
            (c: any) =>
              `${c.name}: ${c.description || "A character in the story"}`,
          )
          .join("\n");
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-05-20",
          contents: `Break down the following story into 4-6 distinct comic book panels. For each panel, provide a visual description, which character is the focus (if any), a suggested camera angle, and a suggested mood.\n\nStory:\n${story}\n\nCharacters:\n${charContext}\n\nReturn the result as a JSON array of objects.`,
          config: {
            systemInstruction:
              "You are an expert comic book storyboard artist. You excel at breaking down narratives into compelling visual sequences.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  description: { type: Type.STRING },
                  characterFocus: { type: Type.STRING },
                  cameraAngle: { type: Type.STRING },
                  mood: { type: Type.STRING },
                },
                required: ["id", "description"],
              },
            },
          },
        });
        const panels = JSON.parse(response.text || "[]");
        return panels.map(hydratePanel);
      } catch (directError) {
        notifyError("Panel generation failed", directError);
        return [];
      }
    }
    notifyError("Panel generation failed", error);
    return [];
  }
};

export const polishStory = async (text: string): Promise<string> => {
  if (!text.trim()) return text;

  try {
    const result = await apiPost<{ text: string }>("polish-story", { text });
    return result.text || text;
  } catch (error: any) {
    if (error?.message === "proxy-unavailable") {
      try {
        const ai = await getDirectAI();
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-05-20",
          contents: `Polish the following story segment to be more evocative and professional, maintaining a cinematic tone:\n\n${text}`,
          config: {
            systemInstruction:
              "You are a world-class comic book writer. Your writing is punchy, atmospheric, and visually descriptive.",
          },
        });
        return response.text || text;
      } catch (directError) {
        notifyError("Story polish failed", directError);
        return text;
      }
    }
    notifyError("Story polish failed", error);
    return text;
  }
};

export const generatePanelImage = async (
  prompt: string,
  style: string,
  referenceImages?: string[],
  styleReferenceImage?: string,
  aspectRatio: string = "16:9",
): Promise<string | null> => {
  if (!prompt.trim()) return null;

  try {
    const result = await apiPost<{ image: string }>(
      "generate-image",
      { prompt, style, referenceImages, styleReferenceImage, aspectRatio },
      IMAGE_TIMEOUT,
    );
    return result.image ? await compressImage(result.image) : null;
  } catch (error: any) {
    if (error?.message === "proxy-unavailable") {
      try {
        const ai = await getDirectAI();
        const parts: any[] = [
          {
            text: `A cinematic comic book panel.\n${styleReferenceImage ? "MANDATORY STYLE ADHERENCE: Replicate the exact artistic style of the provided reference." : `Style: ${style}.`}\n${prompt}\nCRITICAL: Do NOT include any speech bubbles or text in the image.`,
          },
        ];
        if (styleReferenceImage) {
          const match = styleReferenceImage.match(
            /^data:(image\/\w+);base64,(.+)$/,
          );
          if (match)
            parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        }
        if (referenceImages) {
          for (const ref of referenceImages) {
            const match = ref.match(/^data:(image\/\w+);base64,(.+)$/);
            if (match)
              parts.push({
                inlineData: { mimeType: match[1], data: match[2] },
              });
          }
        }
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash-preview-image-generation",
          contents: { parts },
          config: { responseModalities: ["IMAGE", "TEXT"] },
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            const img = `data:image/png;base64,${part.inlineData.data}`;
            return await compressImage(img);
          }
        }
        return null;
      } catch (directError) {
        notifyError("Image generation failed", directError);
        return null;
      }
    }
    notifyError("Image generation failed", error);
    return null;
  }
};

export const generateInsertedPanelPrompt = async (
  context: InsertionContext,
): Promise<PanelPrompt | null> => {
  try {
    const { panel } = await apiPost<{ panel: any }>("insert-panel", context);
    return hydratePanel({
      id: crypto.randomUUID(),
      description: panel.description || "",
      characterFocus: panel.characterFocus,
      cameraAngle: panel.cameraAngle,
      mood: panel.mood,
    });
  } catch (error: any) {
    if (error?.message !== "proxy-unavailable") {
      notifyError("Panel insertion failed", error);
    }
    return null;
  }
};

export const finalNaturalRender = async (
  panelImage: string,
  bubbles: Bubble[],
): Promise<string | null> => {
  try {
    const result = await apiPost<{ image: string }>(
      "final-render",
      { panelImage, bubbles },
      IMAGE_TIMEOUT,
    );
    return result.image ? await compressImage(result.image) : null;
  } catch (error: any) {
    if (error?.message === "proxy-unavailable") {
      try {
        const ai = await getDirectAI();
        const match = panelImage.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!match) return null;
        const bubblesDesc = bubbles
          .map(
            (b, i) =>
              `Bubble ${i + 1}: ${b.style} bubble containing "${b.text}" at ${b.pos.x}%/${b.pos.y}%.`,
          )
          .join("\n");
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash-preview-image-generation",
          contents: {
            parts: [
              { inlineData: { mimeType: match[1], data: match[2] } },
              {
                text: `Regenerate this comic panel with integrated dialogue:\n${bubblesDesc}\nMaintain original scene composition.`,
              },
            ],
          },
          config: { responseModalities: ["IMAGE", "TEXT"] },
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            const img = `data:image/png;base64,${part.inlineData.data}`;
            return await compressImage(img);
          }
        }
        return null;
      } catch (directError) {
        notifyError("Final render failed", directError);
        return null;
      }
    }
    notifyError("Final render failed", error);
    return null;
  }
};
