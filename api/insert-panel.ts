import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveApiKey, geminiText, friendlyError } from "../lib/api-utils";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = resolveApiKey(req, res);
  if (!apiKey) return;

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

  try {
    const text = await geminiText(
      apiKey,
      "gemini-3.1-flash-lite-preview",
      `You are a comic book director. Given a story and the surrounding panels, create a single new panel that fits naturally between them.

STORY:
${story}

${neighborSection}

AVAILABLE CHARACTERS:
${charContext}

Create a panel that bridges the narrative gap. Vary the camera angle from the neighbors for visual rhythm. Return JSON with: description, characterFocus, cameraAngle, mood.`,
      {
        systemInstruction:
          "You are an expert comic book storyboard artist. You create compelling single panels that bridge narrative gaps seamlessly.",
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            description: {
              type: "STRING",
              description: "Detailed visual description of the panel",
            },
            characterFocus: {
              type: "STRING",
              description: "Name of the character in focus",
            },
            cameraAngle: { type: "STRING" },
            mood: { type: "STRING" },
          },
          required: ["description"],
        },
      },
    );

    const panel = JSON.parse(text || "{}");
    return res.status(200).json({ panel });
  } catch (error: any) {
    console.error("Insert panel error:", error);
    return res.status(500).json({ error: friendlyError(error) });
  }
}
