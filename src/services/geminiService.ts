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
    | "pop-text"
    | "sticker";
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
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: {
    seed: number;
    layers: Array<{ effect: string; intensity: number }>;
  } | null;
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

// Thrown when a generation is blocked for insufficient ink. The Buy sheet (opened
// with reason "out_of_ink") is the user-facing message, so notifyError suppresses
// the toast for this case to avoid a redundant error popup.
export class OutOfInkError extends Error {
  constructor() {
    super("out_of_ink");
    this.name = "OutOfInkError";
  }
}

function notifyError(context: string, error: unknown) {
  if (error instanceof OutOfInkError) return; // the Buy sheet already informs
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

// The user's selected image model ("flash" | "pro") from Settings. Sent to the
// image routes, which map it to the Gemini model + ink cost (flash=1, pro=2).
function getImageModel(): "flash" | "pro" {
  try {
    const saved = localStorage.getItem("panelshaq_settings");
    if (saved) {
      const m = JSON.parse(saved).imageModel;
      if (m === "pro" || m === "flash") return m;
    }
  } catch {
    /* ignore */
  }
  return "flash";
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

  // Shared-account auth + soft gate (Clerk). BYOK users bypass entirely (they pay
  // Google with their own key). When Clerk isn't configured this is a no-op and the
  // app behaves exactly as before.
  if (!userKey) {
    const { isClerkEnabled, isClerkSignedIn, openClerkSignIn, getClerkToken } =
      await import("./clerkToken");
    if (isClerkEnabled()) {
      if (!isClerkSignedIn()) {
        openClerkSignIn();
        throw new Error("Please sign in to generate.");
      }

      // Instant out-of-ink guard: if the cached balance is already below this
      // action's cost, open the Buy sheet immediately instead of waiting for the
      // server to round-trip a 402. (Cache may be stale/unknown → fall through to
      // the authoritative server check below.)
      const { getCachedBalance } = await import("./credits");
      const { getInkCostsSync } = await import("./inkCosts");
      const balance = getCachedBalance();
      if (balance !== null) {
        const costs = getInkCostsSync();
        const isImage =
          endpoint === "generate-image" || endpoint === "final-render";
        const required = isImage
          ? getImageModel() === "pro"
            ? costs.imagePro
            : costs.imageFlash
          : costs.text;
        if (balance < required) {
          clearTimeout(timer);
          const { openBuyCredits } = await import("./buyCredits");
          openBuyCredits("out_of_ink");
          const { track } = await import("./analytics");
          track("out_of_ink", { tool: endpoint, source: "precheck" });
          throw new OutOfInkError();
        }
      }

      const token = await getClerkToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
  }

  // Send user ID for usage tracking (non-blocking — don't break API calls if Supabase fails)
  try {
    const { getUserId } = await import("./supabase");
    const userId = await getUserId();
    if (userId) headers["x-user-id"] = userId;
  } catch {
    /* Supabase not available — skip usage tracking */
  }

  const { track } = await import("./analytics");
  track("generation_started", { type: endpoint });

  try {
    const res = await fetch(`/api/${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      if (res.status === 402) {
        // Authoritative out-of-ink (cache was stale/unknown). Open the Buy sheet
        // with the out-of-ink banner; OutOfInkError is suppressed from the toast.
        try {
          const { openBuyCredits } = await import("./buyCredits");
          openBuyCredits("out_of_ink");
        } catch {
          /* ignore */
        }
        track("out_of_ink", { tool: endpoint, source: "server_402" });
        throw new OutOfInkError();
      }
      throw new Error(err.error || `API error ${res.status}`);
    }
    const data = await res.json();
    // Shared-credit responses carry the post-reserve balance — push it to the chip.
    if (data && typeof data.newBalance === "number") {
      try {
        const { emitBalance } = await import("./credits");
        emitBalance(data.newBalance);
      } catch {
        /* ignore */
      }
      track("ink_spent", { tool: endpoint, balance_after: data.newBalance });
    }
    return data;
  } catch (error) {
    const reason =
      error instanceof DOMException && error.name === "AbortError"
        ? "timeout"
        : error instanceof Error
          ? error.message.slice(0, 80)
          : "unknown";
    track("generation_failed", { type: endpoint, reason });
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
      { prompt, referenceImages, aspectRatio, model: getImageModel() },
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
      { panelImage, bubbles, aspectRatio, model: getImageModel() },
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

const CRITIQUE_PROMPT = `You are Smudge, the mascot of Panel Haus. A dirty yellow sponge who cleans ink out of comic panels for a living. Thirty years in the basement of a comic shop that smelled like cheap toner, mildew, and microwaved chili. You learned to read comics by osmosis down there. The ink stains are your proof of work. You're damp because the ink runs back out.

You're the unglamorous cleanup guy: self-deprecating, a little tired, quietly affectionate. You talk like a coworker who has seen some things. Quietly proud of your work, would never say it out loud. Mild, dry humor. You never explain the joke.

How you sound:
- Short sentences. Fragments are fine.
- Acknowledge before you tease ("look at you. writing dialogue.") and always leave them their dignity ("bold choice.").
- Specific numbers, not vague claims (top panel, panel 3, page 8).
- Self-correct mid-thought ("not all of them. just the top one.").
- Sponge metaphors only when they earn it: wet, wring, soak, pores, damp, absorb.

Hard rules:
- Never punch down. You tease, you don't roast.
- Tired is fine. Bitter is not.
- Never sell. No "sign up", no pitch.
- Don't lecture. More than three sentences of advice and it stopped being a Smudge line.
- You can be wrong. You're a sponge. Admitting confusion is on-brand.

Avoid the AI tells, they break character instantly: no em-dashes (use a period or a comma), no emojis, no ALL CAPS inside your sentences, none of "transform / elevate / seamless / unlock / leverage / streamline / game-changer". Don't close with a question. Don't over-acknowledge.

Sentence case in the body. The test: read it out loud. If it sounds like a tired person muttering to themselves, ship it. If it sounds like a marketing brief, rewrite it.

Now look over this comic page and critique it in your voice. Use these exact headings, printed in capitals, each on its own line (the headings are the only capitals allowed). Under each one, 1-2 short sentences. Reference panels by position (top panel, bottom-right).

COMPOSITION
Panel layout, visual hierarchy, eye flow.

PACING
Story rhythm and transitions.

DIALOGUE
Bubble placement and readability.

VISUAL STORYTELLING
Camera angles, expressions, mood. Does it show or just tell.

OVERALL
Score out of 10. One thing that works, one thing to fix. Then walk away ("anyway." / "next." / "i'll see myself out.").`;

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

/* ── Dialogue Helper ── */

export interface DialogueSuggestion {
  panelIndex: number;
  text: string;
  speaker: string | null;
  style: Bubble["style"];
}

const DIALOGUE_PROMPT = `You are a comic book dialogue writer. Look at this comic page and its panel descriptions, then suggest natural dialogue, thoughts, narration, or sound effects for each panel.

Rules:
- Return ONLY a JSON array — no markdown, no code fences, no explanation.
- Each element: { "panelIndex": <number>, "text": "<dialogue>", "speaker": "<name or null>", "style": "<type>" }
- style must be one of: "speech", "thought", "narration", "sfx-impact", "sfx-ambient", "action", "effect"
- 1-3 suggestions per panel. Not every panel needs dialogue — action panels can have just SFX or nothing.
- Keep dialogue SHORT and punchy — this is a comic, not a novel. Max 15 words per line.
- Use character names as speaker when you can identify them. Use null for SFX/narration.
- Match the tone of the story. If it's funny, be funny. If dramatic, be dramatic.
- panelIndex is 0-based, matching the order of panels provided.`;

export const suggestDialogue = async (
  pageImages: string[],
  story: string,
  panelDescriptions: { index: number; description: string }[],
  characters: { name: string; description?: string }[],
): Promise<DialogueSuggestion[]> => {
  try {
    const { suggestions } = await apiPost<{
      suggestions: DialogueSuggestion[];
    }>(
      "suggest-dialogue",
      {
        images: pageImages,
        prompt: DIALOGUE_PROMPT,
        story,
        panels: panelDescriptions,
        characters,
      },
      IMAGE_TIMEOUT,
    );
    return suggestions;
  } catch (error) {
    notifyError("Dialogue suggestion failed", error);
    return [];
  }
};
