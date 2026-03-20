import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Type } from "@google/genai";
import { resolveApiKey, createAI, friendlyError } from "../lib/api-utils";

export const config = {
  api: { bodyParser: { sizeLimit: "4mb" } },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = resolveApiKey(req, res);
  if (!apiKey) return;

  const { story, characters } = req.body;
  if (!story?.trim())
    return res.status(400).json({ error: "Story is required" });

  const charContext = (characters || [])
    .map(
      (c: any) => `${c.name}: ${c.description || "A character in the story"}`,
    )
    .join("\n");

  const ai = createAI(apiKey);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
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
    const panels = JSON.parse(text);
    return res.status(200).json({ panels });
  } catch (error: any) {
    console.error("Generate panels error:", error);
    return res.status(500).json({ error: friendlyError(error) });
  }
}
