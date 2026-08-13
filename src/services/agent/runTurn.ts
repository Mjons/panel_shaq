import { beginTurn, clearSnapshot } from "./turnSnapshot";
import { buildMobileDigest, type MobileDoc } from "./mobileDigest";
import { preflightTurn, postAgentRound } from "./agentClient";
import { OutOfInkError } from "../geminiService";
import { track } from "../analytics";
import type { ChatMessage, ToolCall, ToolResult } from "./types";
import type { ToolSchema } from "./tools";

// Turbo-first means 2 rounds is typical (plan, then build); 4 is a safety ceiling.
// Desktop uses 8, but its hand-building loop is exactly what mobile routes around.
const MAX_ROUNDS = 4;

/** Everything the loop needs, backed by refs in the hook so reads are never stale. */
export interface TurnContext {
  /** Current transcript (the hook's messagesRef) — always up to date. */
  transcript: () => ChatMessage[];
  /** Current document (the hook's docRef) — reflects mid-turn mutations. */
  readDoc: () => MobileDoc;
  tools: ToolSchema[];
  /** Append a message: updates the ref AND triggers a re-render. */
  pushMessage: (m: ChatMessage) => void;
  /** Execute one tool call locally, returning the result the model will see. */
  executeTool: (call: ToolCall) => Promise<unknown>;
  /** A transient status line ("Smudge is building your page…"), or null to clear. */
  setStatus: (s: string | null) => void;
}

function genTurnId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto)
      return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  // Fallback for non-secure contexts (plain-HTTP LAN): matches the route's
  // /^[A-Za-z0-9_-]{1,64}$/ turnId guard.
  return `t${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function statusFor(call: ToolCall): string {
  switch (call.name) {
    case "build_comic":
      return "Smudge is laying out your page…";
    case "update_panel":
      return "Smudge is changing that panel…";
    case "set_dialogue":
      return "Smudge is writing the dialogue…";
    case "save_character":
      return "Smudge is remembering that character…";
    default:
      return "Smudge is working…";
  }
}

function lastAssistantHasText(messages: ChatMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant") return !!m.text.trim();
  }
  return false;
}

/**
 * Run one full turn: snapshot, gate, then loop rounds until the model stops
 * calling tools (or the ceiling). Never throws to the caller — every failure ends
 * in a chat message. Never ends the turn empty (desktop rule 7).
 */
export async function runAgentTurn(
  ctx: TurnContext,
  userText: string,
): Promise<void> {
  const turnId = genTurnId();
  const doc0 = ctx.readDoc();
  // One snapshot brackets the whole turn — undo restores to here.
  beginTurn(
    { panels: doc0.panels, pages: doc0.pages, vaultEntries: doc0.vaultEntries },
    userText.slice(0, 60),
  );
  ctx.pushMessage({ role: "user", text: userText });
  track("generation_started", { type: "board-agent" });

  try {
    preflightTurn();
  } catch (e) {
    // Gated before anything ran: drop the snapshot (nothing to undo) and say why.
    clearSnapshot();
    if (e instanceof OutOfInkError) return; // Buy sheet already open
    ctx.pushMessage({
      role: "assistant",
      text: "Sign in and I'll get straight to it.",
    });
    return;
  }

  let didSomething = false;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    ctx.setStatus("Smudge is thinking…");
    const digest = buildMobileDigest(ctx.readDoc());

    let res;
    try {
      res = await postAgentRound({
        messages: ctx.transcript().slice(-40),
        digest,
        tools: ctx.tools,
        turnId,
      });
    } catch (e) {
      ctx.setStatus(null);
      if (e instanceof OutOfInkError) return; // Buy sheet already open
      ctx.pushMessage({
        role: "assistant",
        text: "Smudge hit a snag. Tell me what to try and I'll have another go.",
      });
      return;
    }

    ctx.pushMessage({
      role: "assistant",
      text: res.text,
      toolCalls: res.toolCalls,
      textSignature: res.textSignature,
    });

    if (!res.toolCalls.length) break;

    const results: ToolResult[] = [];
    for (const call of res.toolCalls) {
      ctx.setStatus(statusFor(call));
      const result = await ctx.executeTool(call);
      results.push({ name: call.name, result });
    }
    ctx.pushMessage({ role: "tool", results });
    didSomething = true;

    // Stop after ONE tool round. Lite models are unreliable across tool rounds:
    // the round-2 call often fails and the turn reports "couldn't finish" even
    // though the round-1 build/edit already landed. Our tools are single-shot (a
    // build becomes a draft the user confirms; an edit applies immediately), so a
    // second round has nothing to do.
    break;
  }

  ctx.setStatus(null);
  // Only say "couldn't finish" when NOTHING happened — no tool ran AND no prose.
  // A successful build with empty model text must NOT read as a failure.
  if (!didSomething && !lastAssistantHasText(ctx.transcript()))
    ctx.pushMessage({
      role: "assistant",
      text: "I could not finish that one. Tell me what to try instead and I'll have another go.",
    });
}
