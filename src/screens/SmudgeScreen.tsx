import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Undo2,
  Check,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Loader2,
  Mic,
  ArrowRight,
} from "lucide-react";
import { Smudge } from "../components/Smudge";
import { useSmudgeChat, type PendingDraft } from "../hooks/useSmudgeChat";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { FULL_TOOLS } from "../services/agent/tools";
import type { MobileDoc } from "../services/agent/mobileDigest";
import type { ChatMessage } from "../services/agent/types";
import type { TurnSetters } from "../services/agent/turnSnapshot";
import type { PanelPrompt } from "../services/geminiService";
import type { Page } from "./LayoutScreen";
import type { VaultEntry } from "./VaultScreen";

// P5 — Revision + drawing. Smudge can build, edit panels, and set dialogue; the
// user draws the page (art appears one panel at a time). Editing a panel clears
// its art so the next Draw redraws it.

// All five tools are now implemented in the hook's executeTool.
const SMUDGE_TOOLS = FULL_TOOLS;

interface SmudgeScreenProps {
  story: string;
  vaultEntries: VaultEntry[];
  panels: PanelPrompt[];
  pages: Page[];
  pageFormat: string;
  projectName: string;
  setRawPanels: TurnSetters["setRawPanels"];
  setPages: TurnSetters["setPages"];
  setVaultEntries: TurnSetters["setVaultEntries"];
  onNavigate?: (tab: string) => void;
}

const STARTERS = [
  "A superhero's origin, in 4 panels",
  "Two friends argue over the last slice of pizza",
  "A detective finds one strange clue",
];

function latestSuggestions(messages: ChatMessage[]): string[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant") {
      const call = m.toolCalls?.find((c) => c.name === "suggest_next");
      const s = call?.input?.suggestions;
      return Array.isArray(s)
        ? s.filter((x): x is string => !!x).slice(0, 4)
        : [];
    }
  }
  return [];
}

export const SmudgeScreen: React.FC<SmudgeScreenProps> = ({
  story,
  vaultEntries,
  panels,
  pages,
  pageFormat,
  projectName,
  setRawPanels,
  setPages,
  setVaultEntries,
  onNavigate,
}) => {
  const doc: MobileDoc = useMemo(
    () => ({ story, vaultEntries, panels, pages, pageFormat, projectName }),
    [story, vaultEntries, panels, pages, pageFormat, projectName],
  );
  const setters: TurnSetters = useMemo(
    () => ({ setRawPanels, setPages, setVaultEntries }),
    [setRawPanels, setPages, setVaultEntries],
  );

  const {
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
    smudgePageId,
  } = useSmudgeChat({ doc, tools: SMUDGE_TOOLS, setters });

  const [input, setInput] = useState("");
  const voice = useVoiceInput(setInput);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status, draft, canUndo, drawStatus, panels]);

  const nameOf = useMemo(() => {
    const m = new Map(vaultEntries.map((v) => [v.id, v.name]));
    return (id?: string | null) => (id ? (m.get(id) ?? null) : null);
  }, [vaultEntries]);

  // Smudge's ONE page (the same one keepDraft/drawAllPending operate on) and which
  // of its panels still need art. The preview, the button count, and the draw all
  // read this — so they can never disagree.
  const smudgePage = smudgePageId
    ? (pages.find((p) => p.id === smudgePageId) ?? null)
    : null;
  const smudgePagePanels = useMemo(() => {
    if (!smudgePage) return [];
    return smudgePage.panelIds
      .map((id) => panels.find((p) => p.id === id))
      .filter((p): p is PanelPrompt => !!p);
  }, [smudgePage, panels]);
  const pendingArt = smudgePagePanels.filter((p) => !p.image).length;
  const hasComic = smudgePagePanels.length > 0;

  const send = (text: string) => {
    if (busy || drawing) return;
    sendMessage(text);
    setInput("");
  };

  const suggestions = latestSuggestions(messages);
  // Greeting only when there's genuinely nothing yet: no chat, no draft, and no
  // committed Smudge page. A returning user (chat state reset on tab switch) still
  // sees their page instead of a blank slate.
  const showGreeting = messages.length === 0 && !draft && !hasComic;

  return (
    <div className="pt-24 pb-48 px-4 max-w-2xl mx-auto min-h-screen">
      {showGreeting ? (
        <div className="flex flex-col items-center text-center gap-4 mt-8">
          <Smudge pose="waving" size={96} />
          <h1 className="font-headline text-2xl font-bold text-accent">
            Hey, I'm Smudge.
          </h1>
          <p className="text-sm text-accent/70 leading-relaxed max-w-sm">
            Tell me what you want your comic to be, in a sentence. I'll plan it
            with you, then draw it right here.
          </p>
          <div className="w-full space-y-2 mt-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="w-full rounded-xl border border-outline/20 bg-surface px-4 py-3 text-left text-sm text-accent/90 transition-all active:scale-[0.98] hover:border-primary/40"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.length === 0 && hasComic && !draft && (
            <p className="text-center text-sm text-accent/60 mt-2">
              Here's your page. Tell me what to change, or draw it below.
            </p>
          )}

          {messages.map((m, i) => (
            <MessageRow key={i} message={m} />
          ))}

          {status && (
            <div className="flex items-center gap-2 text-accent/50">
              <Smudge pose="thinking" size={28} />
              <span className="text-sm italic">{status}</span>
            </div>
          )}

          {draft && (
            <DraftCard
              draft={draft}
              nameOf={nameOf}
              onKeep={keepDraft}
              onDiscard={discardDraft}
            />
          )}

          {!draft && hasComic && (
            <PagePreview panels={smudgePagePanels} drawing={drawing} />
          )}

          {!busy && !draft && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary transition-all active:scale-[0.97]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div ref={bottomRef} />

      <div className="sticky bottom-24 mt-4 space-y-2">
        {canUndo && (
          <div className="flex items-center justify-between rounded-xl border border-outline/20 bg-surface/95 px-3 py-2 backdrop-blur">
            <span className="text-xs text-accent/70">
              Saved to your comic.
            </span>
            <button
              onClick={undo}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary active:scale-95"
            >
              <Undo2 size={14} /> Undo that
            </button>
          </div>
        )}

        {!draft && pendingArt > 0 && (
          <button
            onClick={drawAllPending}
            disabled={drawing || busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-headline font-bold text-background transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {drawing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {drawStatus || "Drawing…"}
              </>
            ) : (
              <>
                <Sparkles size={16} /> Draw {pendingArt}{" "}
                {pendingArt === 1 ? "panel" : "panels"}
              </>
            )}
          </button>
        )}

        {!draft && hasComic && onNavigate && (
          <button
            onClick={() => onNavigate("editor")}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-outline/25 bg-surface py-2.5 text-sm font-semibold text-accent/80 transition-all active:scale-[0.98]"
          >
            Open in the editor <ArrowRight size={15} />
          </button>
        )}

        <div className="flex items-end gap-2 rounded-2xl border border-outline/20 bg-surface p-2 shadow-2xl">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={voice.listening ? "Listening…" : "Tell Smudge what to make…"}
            disabled={drawing}
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-accent placeholder:text-accent/30 focus:outline-none max-h-32 disabled:opacity-50"
          />
          {voice.supported && (
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                voice.start();
              }}
              onPointerUp={voice.stop}
              onPointerLeave={voice.stop}
              disabled={busy || drawing}
              aria-label="Hold to talk"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95 disabled:opacity-40 ${
                voice.listening
                  ? "border-red-500/60 bg-red-500/15 text-red-400 animate-pulse"
                  : "border-outline/25 bg-surface text-accent/70"
              }`}
            >
              <Mic size={18} />
            </button>
          )}
          <button
            onClick={() => send(input)}
            disabled={busy || drawing || !input.trim()}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-background transition-all active:scale-95 disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

function PagePreview({
  panels,
  drawing,
}: {
  panels: PanelPrompt[];
  drawing: boolean;
}) {
  return (
    <div className="rounded-2xl border border-outline/15 bg-surface p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-accent/40 mb-2">
        Your page
      </p>
      <div className="grid grid-cols-2 gap-2">
        {panels.map((p, i) => (
          <div
            key={p.id}
            className="relative aspect-[3/4] overflow-hidden rounded-lg border border-outline/15 bg-background"
          >
            {p.image ? (
              <img
                src={p.image}
                alt={`Panel ${i + 1}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
                {drawing ? (
                  <Loader2 size={18} className="animate-spin text-primary/70" />
                ) : (
                  <span className="text-[10px] font-bold text-accent/30">
                    {i + 1}
                  </span>
                )}
                <span className="line-clamp-3 text-[10px] text-accent/40">
                  {p.description}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftCard({
  draft,
  nameOf,
  onKeep,
  onDiscard,
}: {
  draft: PendingDraft;
  nameOf: (id?: string | null) => string | null;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
          Draft page
        </span>
        {draft.title && (
          <span className="font-headline font-bold text-accent">
            {draft.title}
          </span>
        )}
      </div>

      <ol className="space-y-2">
        {draft.newPanels.map((p, i) => {
          const cast = (p.selectedCharacterIds ?? [])
            .map(nameOf)
            .filter(Boolean) as string[];
          const loc = nameOf(p.selectedBackgroundId);
          return (
            <li key={p.id} className="flex gap-2 text-sm">
              <span className="shrink-0 font-bold text-primary/70 tabular-nums">
                {i + 1}
              </span>
              <span className="text-accent/90">
                {p.description}
                {(cast.length > 0 || loc) && (
                  <span className="block text-xs text-accent/50 mt-0.5">
                    {cast.length > 0 && <>cast: {cast.join(", ")}</>}
                    {cast.length > 0 && loc && " · "}
                    {loc && <>at {loc}</>}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {draft.unresolved.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-accent/60">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-primary/70" />
          <span>
            {draft.unresolved.join(", ")} isn't in your vault yet, so they were
            left out. Save them first to include them.
          </span>
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onKeep}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 font-headline font-bold text-background transition-all active:scale-[0.98]"
        >
          <Check size={16} /> Keep it
        </button>
        <button
          onClick={onDiscard}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-outline/25 bg-surface px-4 py-2.5 text-sm text-accent/80 transition-all active:scale-[0.98]"
        >
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  if (message.role === "tool") return null;
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-background">
          {message.text}
        </div>
      </div>
    );
  }
  if (!message.text.trim()) return null;
  return (
    <div className="flex items-start gap-2">
      <Smudge pose="standing" size={28} seed={message.text} />
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-outline/15 bg-surface px-4 py-2.5 text-sm text-accent/90 leading-relaxed whitespace-pre-wrap">
        {message.text}
      </div>
    </div>
  );
}
