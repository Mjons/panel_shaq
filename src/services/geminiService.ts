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
  cameraLens?: string;
  mood?: string;
  aspectRatio?: string;
  artStyle?: string;
  image?: string;
  selectedCharacterIds?: string[];
  customReferenceImages?: string[];
  useStyleRef?: boolean;
  matchCharStyle?: boolean;
  stylePriority?: "reference" | "artStyle";
  notes?: string;
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

async function apiPost<T>(
  endpoint: string,
  body: any,
  timeoutMs: number = DEFAULT_TIMEOUT,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const userKey = getUserApiKey();
  if (userKey) headers["x-api-key"] = userKey;

  // Send user ID for usage tracking (non-blocking — don't break API calls if Supabase fails)
  try {
    const { getUserId } = await import("./supabase");
    const userId = await getUserId();
    if (userId) headers["x-user-id"] = userId;
  } catch {
    /* Supabase not available — skip usage tracking */
  }

  try {
    const res = await fetch(`/api/${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `API error ${res.status}`);
    }
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
    // Strip image data — server only needs name + description
    const lightChars = characters.map(({ name, description }: any) => ({
      name,
      description,
    }));
    const { panels } = await apiPost<{ panels: any[] }>("generate-panels", {
      story,
      characters: lightChars,
    });
    return panels.map(hydratePanel);
  } catch (error) {
    notifyError("Panel generation failed", error);
    return [];
  }
};

export const polishStory = async (
  text: string,
  characters?: { name: string; description?: string }[],
): Promise<string> => {
  if (!text.trim()) return text;

  try {
    const result = await apiPost<{ text: string }>("polish-story", {
      text,
      characters,
    });
    return result.text || text;
  } catch (error) {
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
  styleNotes?: string,
): Promise<string | null> => {
  if (!prompt.trim()) return null;

  try {
    const result = await apiPost<{ image: string }>(
      "generate-image",
      {
        prompt,
        style,
        referenceImages,
        styleReferenceImage,
        aspectRatio,
        styleNotes,
      },
      IMAGE_TIMEOUT,
    );
    return result.image ? await compressImage(result.image) : null;
  } catch (error) {
    notifyError("Image generation failed", error);
    return null;
  }
};

export const generateInsertedPanelPrompt = async (
  context: InsertionContext,
): Promise<PanelPrompt | null> => {
  // Strip image data from panels — server only needs text metadata
  const stripPanel = (p: PanelPrompt | null) =>
    p
      ? {
          description: p.description,
          characterFocus: p.characterFocus,
          cameraAngle: p.cameraAngle,
          mood: p.mood,
        }
      : null;
  const lightContext = {
    ...context,
    previousPanel: stripPanel(context.previousPanel),
    nextPanel: stripPanel(context.nextPanel),
  };

  try {
    const { panel } = await apiPost<{ panel: any }>(
      "insert-panel",
      lightContext,
    );
    return hydratePanel({
      id: crypto.randomUUID(),
      description: panel.description || "",
      characterFocus: panel.characterFocus,
      cameraAngle: panel.cameraAngle,
      mood: panel.mood,
    });
  } catch (error) {
    notifyError("Panel insertion failed", error);
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
  } catch (error) {
    notifyError("Final render failed", error);
    return null;
  }
};

export const analyzeCharacterImage = async (
  imageSrc: string,
): Promise<string> => {
  const prompt =
    "Describe this character's visual appearance for use as a reference in AI image generation. Focus ONLY on physical appearance: face shape, skin tone, hair, eye color, body type, clothing, accessories, tattoos, scars, and distinguishing features. Do NOT describe what they are doing, their pose, emotions, or the background. Be concise but specific. Write in a single paragraph, no bullet points.";

  try {
    const { text } = await apiPost<{ text: string }>("analyze-character", {
      image: imageSrc,
      prompt,
    });
    return text;
  } catch (error) {
    notifyError("Character analysis failed", error);
    return "";
  }
};
