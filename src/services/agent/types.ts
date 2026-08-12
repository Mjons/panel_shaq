// Shared agent types. Kept in one place so the turn loop, the hook, and the
// screen agree on the transcript shape — which is BOTH the display model and the
// exact shape the server's toGeminiContents expects (role/text/toolCalls/
// textSignature/results). Keep them aligned.

export interface ToolCall {
  id: string;
  name: string;
  input: any;
  // Gemini stamps this on thinking models; it MUST round-trip verbatim or the
  // next tool round 400s on Gemini 3 (see api/board-agent.ts / Handoff 7.1).
  thoughtSignature?: string;
}

export interface ToolResult {
  name: string;
  result: any;
}

export type ChatMessage =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string;
      toolCalls?: ToolCall[];
      textSignature?: string;
    }
  | { role: "tool"; results: ToolResult[] };
