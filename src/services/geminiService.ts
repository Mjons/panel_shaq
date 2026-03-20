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
    img.onerror = () => resolve(base64); // fallback to original on error
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

export interface InsertionContext {
  story: string;
  previousPanel: PanelPrompt | null;
  nextPanel: PanelPrompt | null;
  allCharacters: { name: string; description?: string }[];
  insertIndex: number;
}

async function apiPost<T>(endpoint: string, body: any): Promise<T> {
  const res = await fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
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
    return panels.map((p: any) => ({
      ...p,
      bubbles: [],
      imageTransform: { x: 0, y: 0, scale: 1 },
    }));
  } catch (error) {
    console.error("Panel Breakdown Error:", error);
    return [];
  }
};

export const polishStory = async (text: string): Promise<string> => {
  if (!text.trim()) return text;

  try {
    const result = await apiPost<{ text: string }>("polish-story", { text });
    return result.text || text;
  } catch (error) {
    console.error("Polish Error:", error);
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
    const result = await apiPost<{ image: string }>("generate-image", {
      prompt,
      style,
      referenceImages,
      styleReferenceImage,
      aspectRatio,
    });
    return result.image ? await compressImage(result.image) : null;
  } catch (error) {
    console.error("Image Gen Error:", error);
    return null;
  }
};

export const generateInsertedPanelPrompt = async (
  context: InsertionContext,
): Promise<PanelPrompt | null> => {
  try {
    const { panel } = await apiPost<{ panel: any }>("insert-panel", context);
    return {
      id: crypto.randomUUID(),
      description: panel.description || "",
      characterFocus: panel.characterFocus,
      cameraAngle: panel.cameraAngle,
      mood: panel.mood,
      bubbles: [],
      imageTransform: { x: 0, y: 0, scale: 1 },
    };
  } catch (error) {
    console.error("Insert Panel Error:", error);
    return null;
  }
};

export const finalNaturalRender = async (
  panelImage: string,
  bubbles: Bubble[],
): Promise<string | null> => {
  try {
    const result = await apiPost<{ image: string }>("final-render", {
      panelImage,
      bubbles,
    });
    return result.image ? await compressImage(result.image) : null;
  } catch (error) {
    console.error("Final Render Error:", error);
    return null;
  }
};
