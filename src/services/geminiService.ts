import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

const getAI = () => {
  const key = process.env.API_KEY || process.env.GEMINI_API_KEY || "";
  return new GoogleGenAI({ apiKey: key });
};

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
  image?: string;
  selectedCharacterIds?: string[];
  customReferenceImages?: string[];
  useStyleRef?: boolean;
  bubbles: Bubble[];
  imageTransform?: { x: number; y: number; scale: number };
}

export const generatePanelPrompts = async (
  story: string,
  characters: any[],
): Promise<PanelPrompt[]> => {
  if (!story.trim()) return [];

  const charContext = characters
    .map((c) => `${c.name}: ${c.description || "A character in the story"}`)
    .join("\n");
  const ai = getAI();

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Break down the following story into 4-6 distinct comic book panels. For each panel, provide a visual description, which character is the focus (if any), a suggested camera angle, and a suggested mood.

Story:
${story}

Characters:
${charContext}

Return the result as a JSON array of objects.`,
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
              description: {
                type: Type.STRING,
                description: "Detailed visual description of the panel",
              },
              characterFocus: {
                type: Type.STRING,
                description: "Name of the character in focus",
              },
              cameraAngle: { type: Type.STRING },
              mood: { type: Type.STRING },
            },
            required: ["id", "description"],
          },
        },
      },
    });

    const text = response.text || "[]";
    const rawPanels = JSON.parse(text);
    return rawPanels.map((p: any) => ({
      ...p,
      bubbles: [],
      imageTransform: { x: 0, y: 0, scale: 1 },
    }));
  } catch (error) {
    console.error("Gemini Panel Breakdown Error:", error);
    return [];
  }
};

export const polishStory = async (text: string): Promise<string> => {
  if (!text.trim()) return text;

  const ai = getAI();
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Polish the following story segment to be more evocative and professional, maintaining a "Cyberpunk Noir" tone: \n\n${text}`,
      config: {
        systemInstruction:
          "You are a world-class comic book writer specializing in Cyberpunk Noir. Your writing is punchy, atmospheric, and visually descriptive.",
      },
    });
    return response.text || text;
  } catch (error) {
    console.error("Gemini Polish Error:", error);
    return text;
  }
};

export const generatePanelImage = async (
  prompt: string,
  style: string,
  referenceImages?: string[],
  styleReferenceImage?: string,
): Promise<string | null> => {
  if (!prompt.trim()) return null;

  const ai = getAI();
  try {
    const parts: any[] = [
      {
        text: `A cinematic comic book panel. 
        ${styleReferenceImage ? "MANDATORY STYLE ADHERENCE: You MUST strictly replicate the exact artistic style, brushwork, color palette, and line weight of the provided style reference image. The output should look like it was drawn by the same artist as the reference." : `Style: ${style}.`}
        ${prompt.includes("Subject:") ? prompt : `Subject: ${prompt}.`}
        CRITICAL: Do NOT include any speech bubbles, text, or dialogue balloons in the image. The image should be pure artwork.
        ${referenceImages && referenceImages.length > 0 ? "Ensure the characters in the panel match the provided character reference images." : ""}`,
      },
    ];

    // Add style reference first if provided
    if (styleReferenceImage) {
      const match = styleReferenceImage.match(
        /^data:(image\/\w+);base64,(.+)$/,
      );
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    }

    // Add character references
    if (referenceImages && referenceImages.length > 0) {
      referenceImages.forEach((ref) => {
        const match = ref.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          });
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: {
        parts,
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini Image Gen Error:", error);
    return null;
  }
};

export const finalNaturalRender = async (
  panelImage: string,
  bubbles: Bubble[],
): Promise<string | null> => {
  const ai = getAI();
  try {
    const match = panelImage.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return null;

    const bubblesDesc = bubbles
      .map((b, i) => {
        const styleDesc = {
          speech:
            "a standard rounded speech bubble with a tail pointing to the speaker",
          thought:
            "a cloud-like thought bubble with small circles leading to the character",
          action: "a jagged, explosive action bubble with bold, dynamic text",
          effect:
            "a stylized sound effect bubble integrated into the environment",
        }[b.style];
        return `Bubble ${i + 1}: ${styleDesc} containing the text: "${b.text}". Positioned at approximately ${b.pos.x}% from the left and ${b.pos.y}% from the top. Font size: ${b.fontSize}px, Style: ${b.fontWeight} ${b.fontStyle}.`;
      })
      .join("\n");

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          },
          {
            text: `Regenerate this comic panel image. Integrate the following bubbles naturally into the scene:
            ${bubblesDesc}
            The bubbles and text should look like they are part of the original hand-drawn or painted comic art, not a digital overlay. 
            Maintain the original character likeness and scene composition.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Final Natural Render Error:", error);
    return null;
  }
};
