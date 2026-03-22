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
  style:
    | "speech"
    | "thought"
    | "action"
    | "effect"
    | "sfx-impact"
    | "sfx-ambient"
    | "narration"
    | "pop-text";
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  rotation?: number;
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
  image?: string;
  selectedCharacterIds?: string[];
  selectedBackgroundId?: string;
  selectedPropIds?: string[];
  selectedVehicleIds?: string[];
  customReferenceImages?: string[];
  notes?: string;
  bubbles: Bubble[];
  imageTransform?: { x: number; y: number; scale: number; rotation?: number };
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

export async function apiPost<T>(
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
  referenceImages?: string[],
  aspectRatio: string = "16:9",
): Promise<string | null> => {
  if (!prompt.trim()) return null;

  try {
    const result = await apiPost<{ image: string }>(
      "generate-image",
      { prompt, referenceImages, aspectRatio },
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

// Detect aspect ratio from a base64 image
const detectAspectRatio = (src: string): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const r = img.width / img.height;
      // Match to closest standard ratio
      if (r > 2) resolve("21:9");
      else if (r > 1.6) resolve("16:9");
      else if (r > 1.4) resolve("3:2");
      else if (r > 1.2) resolve("4:3");
      else if (r > 0.9) resolve("1:1");
      else if (r > 0.7) resolve("3:4");
      else if (r > 0.6) resolve("2:3");
      else resolve("9:16");
    };
    img.onerror = () => resolve("1:1");
    img.src = src;
  });

export const finalNaturalRender = async (
  panelImage: string,
  bubbles: Bubble[],
): Promise<string | null> => {
  try {
    const aspectRatio = await detectAspectRatio(panelImage);
    const result = await apiPost<{ image: string }>(
      "final-render",
      { panelImage, bubbles, aspectRatio },
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

export const generateReferenceImage = async (
  name: string,
  description: string,
  visualLook: string,
  type: "Character" | "Environment" | "Prop" | "Vehicle",
  stylePrompt: string = "Bold ink outlines, flat cel-shading, vibrant saturated colors, classic American comic book style",
  existingStyleRef?: string,
): Promise<string | null> => {
  const visualStr = visualLook ? `Visual details: ${visualLook}.` : "";
  const prompts: Record<string, string> = {
    Character: `Character reference sheet — front-facing portrait of ${name}. ${description}. ${visualStr} Style: Clean character design reference, simple background, full color, detailed. ${stylePrompt}. Do NOT include any text, labels, or speech bubbles.`,
    Environment: `Environment concept art — ${name}. ${description}. ${visualStr} Style: Wide establishing shot, detailed background art. ${stylePrompt}. No characters or figures. No text.`,
    Prop: `Object reference — ${name}. ${description}. ${visualStr} Style: Clean product-shot, simple background, detailed. ${stylePrompt}. No people, no hands. No text.`,
    Vehicle: `Vehicle reference — ${name}. ${description}. ${visualStr} Style: Three-quarter view, clean background, detailed mechanical design. ${stylePrompt}. No people, no drivers. No text.`,
  };

  const aspectRatios: Record<string, string> = {
    Character: "3:4",
    Environment: "16:9",
    Prop: "1:1",
    Vehicle: "4:3",
  };

  const refs = existingStyleRef ? [existingStyleRef] : undefined;
  return generatePanelImage(prompts[type], refs, aspectRatios[type]);
};

const CRITIQUE_PROMPT = `You are a comic book editor giving quick, constructive feedback. Review this comic page and critique it under these exact headings. Keep each section to 1-2 SHORT sentences — be direct, specific, and get to the point. Reference panels by position ("top panel", "bottom-right"). No fluff.

COMPOSITION
Panel layout, visual hierarchy, eye flow. What works, what doesn't.

PACING
Story rhythm and transitions. Any panels redundant or missing?

DIALOGUE
Bubble placement and readability. Any text issues?

VISUAL STORYTELLING
Camera angles, expressions, mood. Does it show or just tell?

OVERALL
Score out of 10. One strength, one concrete improvement.`;

export const critiqueComic = async (pageImages: string[]): Promise<string> => {
  try {
    const { text } = await apiPost<{ text: string }>(
      "critique-comic",
      { images: pageImages, prompt: CRITIQUE_PROMPT },
      IMAGE_TIMEOUT,
    );
    return text;
  } catch (error) {
    notifyError("Comic critique failed", error);
    return "Critique failed — check your API key in Settings.";
  }
};
