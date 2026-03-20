import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const { story, previousPanel, nextPanel, allCharacters, insertIndex } =
    req.body;

  const charContext = (allCharacters || [])
    .map(
      (c: any) => `${c.name}: ${c.description || "A character in the story"}`,
    )
    .join("\n");

  let neighborSection = "";

  if (previousPanel) {
    neighborSection += `
PREVIOUS PANEL (Panel ${insertIndex}):
- Description: ${previousPanel.description}
- Character Focus: ${previousPanel.characterFocus || "None"}
- Camera Angle: ${previousPanel.cameraAngle || "Cinematic 35mm"}
- Mood: ${previousPanel.mood || "Cyberpunk Neon"}
`;
  } else {
    neighborSection += `
This panel will OPEN the comic. Set the scene and draw the reader in before the action of the next panel begins.
`;
  }

  if (nextPanel) {
    neighborSection += `
NEXT PANEL (Panel ${insertIndex + 1}):
- Description: ${nextPanel.description}
- Character Focus: ${nextPanel.characterFocus || "None"}
- Camera Angle: ${nextPanel.cameraAngle || "Cinematic 35mm"}
- Mood: ${nextPanel.mood || "Cyberpunk Neon"}
`;
  } else {
    neighborSection += `
The story continues beyond the last panel. Create the next narrative beat that advances the plot.
`;
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `You are a comic book director. Given a story and the surrounding panels, create a single new panel that fits naturally between them.

STORY:
${story}

${neighborSection}

AVAILABLE CHARACTERS:
${charContext}

Create a panel that bridges the narrative gap. Vary the camera angle from the neighbors for visual rhythm. Return JSON with: description, characterFocus, cameraAngle, mood.`,
      config: {
        systemInstruction:
          "You are an expert comic book storyboard artist. You create compelling single panels that bridge narrative gaps seamlessly.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
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
          required: ["description"],
        },
      },
    });

    const text = response.text || "{}";
    const panel = JSON.parse(text);
    return res.status(200).json({ panel });
  } catch (error: any) {
    console.error("Insert panel error:", error);
    return res
      .status(500)
      .json({ error: error.message || "Panel insertion failed" });
  }
}
