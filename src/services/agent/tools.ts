// The mobile tool manifest — deliberately five, where desktop has 37. Every tool
// is context the model pays for on every round and the phone network is the
// constraint, so resist growth. Schemas are Gemini functionDeclarations; they are
// sent from the client (the client is what executes them) and relayed by the route.
//
// The manifest is built up across phases: READ_ONLY_TOOLS (P3) can only talk;
// FULL_TOOLS (P4+) can build and edit. The screen picks the set.

export interface ToolSchema {
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

export const BUILD_LIMITS = { panels: 6, cast: 4, dialoguePerPanel: 3 } as const;

export const BUILD_COMIC_TOOL: ToolSchema = {
  name: "build_comic",
  description:
    "Build a complete comic page. Use this for ANY request that produces more than one panel, never hand-build with repeated calls. Cast members must be EXISTING vault entries referenced by name; if a character has no vault entry, leave them out and say so. Limits: 1 page, 6 panels, 4 cast, 3 dialogue lines per panel. This does NOT generate art, it lays out the page. Art is a separate, confirmed step.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      panels: {
        type: "array",
        items: {
          type: "object",
          properties: {
            visual: {
              type: "string",
              description: "what happens in this panel",
            },
            cast: {
              type: "array",
              items: { type: "string" },
              description: "vault entry NAMES of characters in this panel",
            },
            location: {
              type: "string",
              description: "vault Environment name, optional",
            },
            dialogue: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  speaker: { type: "string" },
                  text: { type: "string" },
                },
                required: ["text"],
              },
            },
            angle: { type: "string" },
            mood: { type: "string" },
          },
          required: ["visual"],
        },
      },
    },
    required: ["panels"],
  },
};

export const UPDATE_PANEL_TOOL: ToolSchema = {
  name: "update_panel",
  description:
    "Change one existing panel. Only the fields you pass are changed; omit the rest. cast and location are vault entry NAMES.",
  parameters: {
    type: "object",
    properties: {
      panelId: { type: "string" },
      visual: { type: "string" },
      cast: { type: "array", items: { type: "string" } },
      location: { type: "string" },
      angle: { type: "string" },
      mood: { type: "string" },
    },
    required: ["panelId"],
  },
};

export const SET_DIALOGUE_TOOL: ToolSchema = {
  name: "set_dialogue",
  description:
    "Replace all speech on one panel with these lines (in order). Dialogue becomes speech bubbles on the panel, never part of the art.",
  parameters: {
    type: "object",
    properties: {
      panelId: { type: "string" },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            speaker: { type: "string" },
            text: { type: "string" },
          },
          required: ["text"],
        },
      },
    },
    required: ["panelId", "lines"],
  },
};

export const SAVE_CHARACTER_TOOL: ToolSchema = {
  name: "save_character",
  description:
    "Save a character to the user's vault so it stays consistent across panels. Use when a character is named and recurring. Does not draw them.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      personality: { type: "string" },
    },
    required: ["name", "description"],
  },
};

export const SUGGEST_NEXT_TOOL: ToolSchema = {
  name: "suggest_next",
  description:
    "Offer 2 to 4 short, complete next steps as tappable buttons. Each is a full instruction the user could send you as-is. Call this once as your last tool call after you built or changed something.",
  parameters: {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["suggestions"],
  },
};

// P3: Smudge can describe and suggest, but holds no mutating tool.
export const READ_ONLY_TOOLS: ToolSchema[] = [SUGGEST_NEXT_TOOL];

// P4+: the full set.
export const FULL_TOOLS: ToolSchema[] = [
  BUILD_COMIC_TOOL,
  UPDATE_PANEL_TOOL,
  SET_DIALOGUE_TOOL,
  SAVE_CHARACTER_TOOL,
  SUGGEST_NEXT_TOOL,
];
