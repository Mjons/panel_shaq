import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function getApiKey(req: any): string | null {
  return (
    (req.headers["x-api-key"] as string) || process.env.GEMINI_API_KEY || ""
  );
}

async function geminiText(
  apiKey: string,
  model: string,
  contents: string,
  opts?: {
    systemInstruction?: string;
    responseMimeType?: string;
    responseSchema?: any;
  },
): Promise<string> {
  const body: any = { contents: [{ parts: [{ text: contents }] }] };
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

const LIMITS = { text: 50, image: 20 };

async function checkUsage(
  req: any,
  type: "text" | "image",
): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  const userId = (req.headers["x-user-id"] as string) || "";
  if (!userId) return null;

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const today = new Date().toISOString().split("T")[0];
  const col = type === "image" ? "image_generations" : "text_generations";
  const limit = type === "image" ? LIMITS.image : LIMITS.text;

  const { data: existing } = await supabase
    .from("usage")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  const count = existing?.[col] || 0;
  if (count >= limit) {
    return `Daily ${type} limit reached (${count}/${limit}). Resets at midnight UTC.`;
  }

  if (existing) {
    await supabase
      .from("usage")
      .update({ [col]: count + 1 })
      .eq("user_id", userId)
      .eq("date", today);
  } else {
    await supabase
      .from("usage")
      .insert({ user_id: userId, date: today, [col]: 1 });
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = getApiKey(req);
  if (!apiKey) return res.status(401).json({ error: "No API key configured." });

  const usageError = await checkUsage(req, "text");
  if (usageError) return res.status(429).json({ error: usageError });

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
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
