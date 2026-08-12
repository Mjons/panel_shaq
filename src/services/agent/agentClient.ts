import {
  isClerkEnabled,
  isClerkSignedIn,
  openClerkSignIn,
  getClerkToken,
} from "../clerkToken";
import { getCachedBalance, emitBalance } from "../credits";
import { getInkCostsSync } from "../inkCosts";
import { openBuyCredits } from "../buyCredits";
import { OutOfInkError } from "../geminiService";
import { track } from "../analytics";
import type { ToolCall } from "./types";

// The Smudge client transport. Deliberately NOT apiPost: apiPost runs an
// out-of-ink PRECHECK on EVERY call, which would abort an already-paid multi-round
// turn at round 2 (round 1 spent the ink; the turn is charged once via idempotent
// reserve). So the gate runs ONCE here (preflightTurn), and each round posts
// without re-checking.

const AGENT_TIMEOUT = 75_000; // server maxDuration is 60s; give the round trip headroom

// Mirrors geminiService's private getUserApiKey (not exported): a 3-line BYOK read.
function byokKey(): string {
  try {
    const saved = localStorage.getItem("panelshaq_settings");
    if (saved) return JSON.parse(saved).geminiApiKey || "";
  } catch {
    /* ignore */
  }
  return "";
}

export interface RoundResult {
  text: string;
  textSignature?: string;
  toolCalls: ToolCall[];
  newBalance?: number;
}

/**
 * Gate the whole turn ONCE, before any round runs. BYOK bypasses (they pay
 * Google); legacy anon path bypasses (no Clerk). Otherwise: signed-out opens the
 * Clerk modal; a cached balance below one turn's cost opens the Buy sheet. Throws
 * to abort — the relevant modal/sheet is already open when it does. The authoritative
 * check is still the server 402 on round 0 (the cache can be stale or unknown).
 */
export function preflightTurn(): void {
  if (byokKey()) return;
  if (!isClerkEnabled()) return;
  if (!isClerkSignedIn()) {
    openClerkSignIn();
    throw new Error("Please sign in to use Smudge.");
  }
  const balance = getCachedBalance();
  // No agent-specific published cost; a turn defaults to the text cost (1), so the
  // text cost is the right precheck proxy.
  if (balance !== null && balance < getInkCostsSync().text) {
    openBuyCredits("out_of_ink");
    track("out_of_ink", { tool: "board-agent", source: "precheck" });
    throw new OutOfInkError();
  }
}

/** One round: POST the transcript + digest + tools, return the model's reply. */
export async function postAgentRound(body: {
  messages: unknown[];
  digest: unknown;
  tools: unknown[];
  turnId: string;
}): Promise<RoundResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = byokKey();
  if (key) headers["x-api-key"] = key;
  else {
    const token = await getClerkToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  try {
    const { getUserId } = await import("../supabase");
    const uid = await getUserId();
    if (uid) headers["x-user-id"] = uid;
  } catch {
    /* usage tracking is best-effort */
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT);
  try {
    const res = await fetch("/api/board-agent", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}) as { error?: string });
      if (res.status === 402) {
        // Authoritative out-of-ink (cache was stale/unknown). Only round 0 can
        // land here; later rounds replay the idempotent reserve and succeed.
        openBuyCredits("out_of_ink");
        track("out_of_ink", { tool: "board-agent", source: "server_402" });
        throw new OutOfInkError();
      }
      throw new Error(err?.error || `Smudge error ${res.status}`);
    }
    const data = await res.json();
    // newBalance is present only on the round that actually charged; push it to the
    // chip and count ink_spent exactly once per turn.
    if (typeof data.newBalance === "number") {
      emitBalance(data.newBalance);
      track("ink_spent", { tool: "board-agent", balance_after: data.newBalance });
    }
    return {
      text: typeof data.text === "string" ? data.text : "",
      textSignature: data.textSignature,
      toolCalls: Array.isArray(data.toolCalls) ? data.toolCalls : [],
      newBalance:
        typeof data.newBalance === "number" ? data.newBalance : undefined,
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError")
      throw new Error("Smudge took too long. Try again.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
