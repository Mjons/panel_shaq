import { useCallback, useEffect, useRef, useState } from "react";
import { runAgentTurn, type TurnContext } from "../services/agent/runTurn";
import {
  beginTurn,
  undoTurn,
  clearSnapshot,
  type TurnSetters,
} from "../services/agent/turnSnapshot";
import { validatePlan, applyPlan } from "../services/agent/buildComic";
import { drawPanel } from "../services/agent/drawPanels";
import type { MobileDoc } from "../services/agent/mobileDigest";
import type { ChatMessage, ToolCall } from "../services/agent/types";
import type { ToolSchema } from "../services/agent/tools";
import type { Bubble, PanelPrompt } from "../services/geminiService";
import type { Page } from "../screens/LayoutScreen";
import type { VaultEntry } from "../screens/VaultScreen";
import { OutOfInkError } from "../services/geminiService";
import { track } from "../services/analytics";

export interface PendingDraft {
  title?: string;
  newPanels: PanelPrompt[];
  page: Page;
  unresolved: string[];
}

function buildBubbles(
  lines: Array<{ speaker?: string; text: string }>,
): Bubble[] {
  const stamp = Date.now();
  return lines
    .map((d) => ({ speaker: d.speaker, text: String(d?.text ?? "").trim() }))
    .filter((d) => d.text)
    .slice(0, 3)
    .map((d, j) => ({
      id: `bub_${stamp}_${j}`,
      text: d.speaker ? `${d.speaker}: ${d.text}` : d.text,
      pos: { x: 50, y: 12 + j * 18 },
      style: "speech" as const,
      fontSize: 16,
      fontWeight: "600",
      fontStyle: "normal",
    }));
}

export function useSmudgeChat({
  doc,
  tools,
  setters,
}: {
  doc: MobileDoc;
  tools: ToolSchema[];
  setters: TurnSetters;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<PendingDraft | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [drawStatus, setDrawStatus] = useState<string | null>(null);

  const messagesRef = useRef<ChatMessage[]>([]);
  const docRef = useRef<MobileDoc>(doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);
  const draftRef = useRef<PendingDraft | null>(null);
  const setDraftBoth = useCallback((d: PendingDraft | null) => {
    draftRef.current = d;
    setDraft(d);
  }, []);

  const pushMessage = useCallback((m: ChatMessage) => {
    messagesRef.current = [...messagesRef.current, m];
    setMessages(messagesRef.current);
  }, []);

  // ---- name -> id resolution against the CURRENT vault ----
  const resolveCast = useCallback((names: string[], out: string[]) => {
    const byName = new Map(
      docRef.current.vaultEntries
        .filter((v) => v.type === "Character")
        .map((v) => [v.name.toLowerCase(), v.id]),
    );
    return names
      .map((n) => {
        const id = byName.get(String(n).toLowerCase());
        if (!id) out.push(n);
        return id;
      })
      .filter((x): x is string => !!x);
  }, []);

  const resolveEnv = useCallback((name: string, out: string[]) => {
    const v = docRef.current.vaultEntries.find(
      (e) => e.type === "Environment" && e.name.toLowerCase() === name.toLowerCase(),
    );
    if (!v) {
      out.push(name);
      return undefined;
    }
    return v.id;
  }, []);

  const executeTool = useCallback(
    async (call: ToolCall): Promise<unknown> => {
      switch (call.name) {
        case "build_comic": {
          const { plan, errors } = validatePlan(call.input);
          if (!plan) return { error: errors.join("; ") };
          const applied = applyPlan(docRef.current, plan);
          // Draft-first: hold it, do NOT commit. The card lets the user keep it.
          setDraftBoth({
            title: plan.title,
            newPanels: applied.newPanels,
            page: applied.page,
            unresolved: applied.unresolved,
          });
          return {
            status: "draft_ready",
            panels: applied.newPanels.length,
            ...(applied.unresolved.length
              ? { not_in_vault: applied.unresolved }
              : {}),
          };
        }

        case "update_panel": {
          const id = String(call.input?.panelId ?? "");
          const panel = docRef.current.panels.find((p) => p.id === id);
          if (!panel) return { error: `no panel with id ${id}` };
          const unresolved: string[] = [];
          const patch: Partial<PanelPrompt> = {};
          if (typeof call.input.visual === "string")
            patch.description = call.input.visual;
          if (Array.isArray(call.input.cast))
            patch.selectedCharacterIds = resolveCast(call.input.cast, unresolved);
          if (typeof call.input.location === "string")
            patch.selectedBackgroundId = resolveEnv(call.input.location, unresolved);
          if (typeof call.input.angle === "string")
            patch.cameraAngle = call.input.angle;
          if (typeof call.input.mood === "string") patch.mood = call.input.mood;
          // The prompt changed, so the existing art is stale — clear it so the
          // panel shows as needing a redraw (and Draw picks it up).
          setters.setRawPanels((prev) =>
            prev.map((p) =>
              p.id === id ? { ...p, ...patch, image: undefined } : p,
            ),
          );
          setCanUndo(true);
          return {
            updated: id,
            ...(unresolved.length ? { not_in_vault: unresolved } : {}),
          };
        }

        case "set_dialogue": {
          const id = String(call.input?.panelId ?? "");
          const panel = docRef.current.panels.find((p) => p.id === id);
          if (!panel) return { error: `no panel with id ${id}` };
          const lines = Array.isArray(call.input?.lines) ? call.input.lines : [];
          const bubbles = buildBubbles(lines);
          // Dialogue never touches the art, so the image is NOT cleared.
          setters.setRawPanels((prev) =>
            prev.map((p) => (p.id === id ? { ...p, bubbles } : p)),
          );
          setCanUndo(true);
          return { updated: id, lines: bubbles.length };
        }

        case "save_character": {
          const name = String(call.input?.name ?? "").trim();
          if (!name) return { error: "a character needs a name" };
          const exists = docRef.current.vaultEntries.some(
            (v) =>
              v.type === "Character" &&
              v.name.toLowerCase() === name.toLowerCase(),
          );
          if (exists) return { note: `${name} is already in the vault` };
          const entry: VaultEntry = {
            id: `vault_${Date.now()}`,
            type: "Character",
            name,
            image: "", // text-only for now; the user can add a reference later
            description: String(call.input?.description ?? "").trim().slice(0, 600),
            ...(call.input?.personality
              ? { personality: String(call.input.personality).trim().slice(0, 300) }
              : {}),
          };
          setters.setVaultEntries((prev) => [...prev, entry]);
          setCanUndo(true);
          return { saved: name };
        }

        case "suggest_next":
          return { ok: true };
        default:
          return { error: `unknown tool: ${call.name}` };
      }
    },
    [setDraftBoth, setters, resolveCast, resolveEnv],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy || drawing) return;
      setBusy(true);
      setDraftBoth(null);
      setCanUndo(false);
      const ctx: TurnContext = {
        transcript: () => messagesRef.current,
        readDoc: () => docRef.current,
        tools,
        pushMessage,
        executeTool,
        setStatus,
      };
      try {
        await runAgentTurn(ctx, trimmed);
      } finally {
        setStatus(null);
        setBusy(false);
      }
    },
    [busy, drawing, tools, pushMessage, executeTool, setDraftBoth],
  );

  const keepDraft = useCallback(() => {
    const d = draftRef.current;
    if (!d) return;
    const cur = docRef.current;
    beginTurn(
      { panels: cur.panels, pages: cur.pages, vaultEntries: cur.vaultEntries },
      d.title || "built page",
    );
    setters.setRawPanels([...cur.panels, ...d.newPanels]);
    setters.setPages([...cur.pages, d.page]);
    setDraftBoth(null);
    setCanUndo(true);
    track("smudge_page_kept", { panels: d.newPanels.length });
  }, [setters, setDraftBoth]);

  const discardDraft = useCallback(() => {
    setDraftBoth(null);
  }, [setDraftBoth]);

  const undo = useCallback(() => {
    if (undoTurn(setters)) {
      setCanUndo(false);
      pushMessage({
        role: "assistant",
        text: "Reverted. We're back to where we were.",
      });
    }
  }, [setters, pushMessage]);

  /**
   * Draw art for every committed panel that has none, one at a time, so panels
   * appear in the thread as they finish. Each draw spends image ink through the
   * same generate-image path a manual generation uses. Stops on the first failure
   * (usually out-of-ink, whose Buy sheet is already open).
   */
  const drawAllPending = useCallback(async () => {
    if (drawing) return;
    const placed = new Set(docRef.current.pages.flatMap((pg) => pg.panelIds));
    const todo = docRef.current.panels.filter(
      (p) => placed.has(p.id) && !p.image,
    );
    if (!todo.length) return;
    setDrawing(true);
    try {
      let done = 0;
      for (const target of todo) {
        // Re-read the panel from the live doc so its latest prompt is used.
        const panel = docRef.current.panels.find((p) => p.id === target.id);
        if (!panel) continue;
        setDrawStatus(`Drawing panel ${done + 1} of ${todo.length}…`);
        const img = await drawPanel(panel, docRef.current.vaultEntries);
        if (!img) break; // failure / out-of-ink — Buy sheet already handled it
        setters.setRawPanels((prev) =>
          prev.map((p) => (p.id === target.id ? { ...p, image: img } : p)),
        );
        done++;
      }
    } finally {
      setDrawStatus(null);
      setDrawing(false);
    }
  }, [drawing, setters]);

  useEffect(() => () => clearSnapshot(), []);

  return {
    messages,
    status,
    busy,
    draft,
    canUndo,
    drawing,
    drawStatus,
    sendMessage,
    keepDraft,
    discardDraft,
    undo,
    drawAllPending,
  };
}
