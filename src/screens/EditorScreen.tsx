import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useGesture, useDrag } from "@use-gesture/react";
import {
  MessageSquare,
  Zap,
  Paintbrush,
  ZoomIn,
  Layers,
  Wand2,
  Download,
  ImageIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Type as TypeIcon,
  Bold,
  Italic,
  Lock,
  Unlock,
  X,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Dices,
  Check,
  RefreshCw,
} from "lucide-react";
import {
  PanelPrompt,
  finalNaturalRender,
  Bubble,
  critiqueComic,
  suggestDialogue,
  DialogueSuggestion,
} from "../services/geminiService";
import { Page, getTemplate, PAGE_FORMATS } from "./LayoutScreen";
import {
  BORDER_PRESETS,
  hasActiveBorderStyle,
  randomSeed,
} from "../utils/borderStyles";
import { waitForPaint, captureNode } from "../services/comicPageExport";
import { Tip } from "../components/Tip";
import { InkCost } from "../components/InkCost";

import {
  ComicPageCanvas,
  PanelImage,
  DraggableBubble,
} from "../components/ComicPageCanvas";
import smudgeAvatar from "../images/smudge_100.png";

interface EditorProps {
  panels: PanelPrompt[];
  pages: Page[];
  setPanels: React.Dispatch<React.SetStateAction<PanelPrompt[]>>;
  onNavigate?: (tab: string) => void;
  pageFormat?: string;
  story?: string;
  characters?: { name: string; description?: string }[];
}

export const EditorScreen: React.FC<EditorProps> = ({
  panels,
  pages,
  setPanels,
  onNavigate,
  pageFormat = "portrait",
  story = "",
  characters = [],
}) => {
  const [selectedPageIdx, setSelectedPageIdx] = useState(0);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem("panelshaq_editor_onboarding_dismissed"),
  );
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);
  const [isBubbleEditing, setIsBubbleEditing] = useState(false);
  const [lockedPanelIds, setLockedPanelIds] = useState<Set<string>>(new Set());
  const [fullscreenPanelId, setFullscreenPanelId] = useState<string | null>(
    null,
  );
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);
  const rotationStep = useMemo(() => {
    try {
      const s = localStorage.getItem("panelshaq_settings");
      return s ? JSON.parse(s).rotationStep || 10 : 10;
    } catch {
      return 10;
    }
  }, []);
  const pageBackgroundColor = useMemo(() => {
    try {
      const s = localStorage.getItem("panelshaq_settings");
      return s ? JSON.parse(s).pageBackgroundColor || "#000000" : "#000000";
    } catch {
      return "#000000";
    }
  }, []);
  const [isRendering, setIsRendering] = useState(false);
  const comicRef = useRef<HTMLDivElement>(null);

  // Panel-level pinch for bubble font resize — captures pinch from anywhere on the panel
  const bubblePinchBase = useRef(12);
  const bubblePinchRotBase = useRef(0);
  const bubbleRotAccum = useRef(0);
  const bubbleLastPinchEndTime = useRef(0);

  const bindComicPinch = useGesture(
    {
      onPinchStart: () => {
        if (!selectedBubbleId || !selectedPanel) return;
        const panelLocked = lockedPanelIds.has(selectedPanelId || "");
        if (!isBubbleEditing && !panelLocked) return;
        const b = selectedPanel.bubbles.find((b) => b.id === selectedBubbleId);
        if (b) {
          bubblePinchBase.current = b.fontSize;
          const timeSinceEnd = Date.now() - bubbleLastPinchEndTime.current;
          if (timeSinceEnd < 400 && timeSinceEnd > 50) {
            const newRotation = (b.rotation || 0) + rotationStep;
            updateBubble(selectedBubbleId, {
              rotation:
                Math.abs(newRotation % 360) < rotationStep / 2
                  ? 0
                  : newRotation,
            });
          }
        }
      },
      onPinch: ({ offset: [s], last }) => {
        const panelIsLocked = lockedPanelIds.has(selectedPanelId || "");
        if (!selectedBubbleId || (!isBubbleEditing && !panelIsLocked)) return;
        const selectedBubble = selectedPanel?.bubbles.find(
          (b) => b.id === selectedBubbleId,
        );
        const maxSize = selectedBubble?.style === "sticker" ? 138 : 69;
        const newSize = Math.round(
          Math.max(6, Math.min(maxSize, bubblePinchBase.current * s)),
        );

        updateBubble(selectedBubbleId, {
          fontSize: newSize,
        });
        if (last) bubbleLastPinchEndTime.current = Date.now();
      },
    },
    {
      pinch: { scaleBounds: { min: 0.5, max: 4 }, from: () => [1, 0] },
      eventOptions: { passive: false },
    },
  );
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [critiqueText, setCritiqueText] = useState<string | null>(null);
  const [isCritiquing, setIsCritiquing] = useState(false);
  const [dialogueSuggestions, setDialogueSuggestions] = useState<
    DialogueSuggestion[]
  >([]);
  const [isGeneratingDialogue, setIsGeneratingDialogue] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<number>>(
    new Set(),
  );

  const currentPage = pages[selectedPageIdx];
  const selectedPanel = panels.find((p) => p.id === selectedPanelId);
  const selectedBubble = selectedPanel?.bubbles.find(
    (b) => b.id === selectedBubbleId,
  );

  const updatePanel = (id: string, updates: Partial<PanelPrompt>) => {
    setPanels((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    );
  };

  const addBubble = () => {
    if (!selectedPanelId) return;
    const newBubble: Bubble = {
      id: crypto.randomUUID(),
      text: "New Dialogue",
      pos: { x: 50, y: 50 },
      style: "speech",
      fontSize: 12,
      fontWeight: "bold",
      fontStyle: "normal",
      tailPos: { x: 50, y: 60 },
    };

    setPanels((prev) =>
      prev.map((p) => {
        if (p.id === selectedPanelId) {
          return { ...p, bubbles: [...(p.bubbles || []), newBubble] };
        }
        return p;
      }),
    );

    setSelectedBubbleId(newBubble.id);
  };

  const addSticker = (emoji: string) => {
    if (!selectedPanelId) return;
    const newBubble: Bubble = {
      id: crypto.randomUUID(),
      text: emoji,
      pos: { x: 50, y: 50 },
      style: "sticker",
      fontSize: 48,
      fontWeight: "normal",
      fontStyle: "normal",
    };
    setPanels((prev) =>
      prev.map((p) =>
        p.id === selectedPanelId
          ? { ...p, bubbles: [...(p.bubbles || []), newBubble] }
          : p,
      ),
    );
    setSelectedBubbleId(newBubble.id);
    setShowEmojiPicker(false);
  };

  const updateBubble = (bubbleId: string, updates: Partial<Bubble>) => {
    if (!selectedPanelId) return;
    setPanels((prev) =>
      prev.map((p) => {
        if (p.id === selectedPanelId) {
          return {
            ...p,
            bubbles: (p.bubbles || []).map((b) =>
              b.id === bubbleId ? { ...b, ...updates } : b,
            ),
          };
        }
        return p;
      }),
    );
  };

  const removeBubble = (bubbleId: string) => {
    if (!selectedPanelId) return;
    setPanels((prev) =>
      prev.map((p) => {
        if (p.id === selectedPanelId) {
          return {
            ...p,
            bubbles: (p.bubbles || []).filter((b) => b.id !== bubbleId),
          };
        }
        return p;
      }),
    );
    if (selectedBubbleId === bubbleId) setSelectedBubbleId(null);
  };

  const handleFinalRender = async () => {
    if (!selectedPanel?.image || isRendering) return;
    setIsRendering(true);

    try {
      const renderedImage = await finalNaturalRender(
        selectedPanel.image,
        selectedPanel.bubbles,
      );
      if (renderedImage) {
        updatePanel(selectedPanel.id, { image: renderedImage, bubbles: [] });
        setSelectedBubbleId(null);
        console.log("Natural Render Success");
      }
    } catch (error) {
      console.error("Natural Render Failed", error);
    } finally {
      setIsRendering(false);
    }
  };

  // Thin wrapper preserving the (ref, format) call sites used by critique
  // and dialogue capture. The capture options live in services/comicPageExport.
  const captureRef = async (
    ref: React.RefObject<HTMLDivElement | null>,
    format: "jpeg" | "png",
  ) => {
    if (!ref.current) throw new Error("Ref not available");
    return captureNode(ref.current, format);
  };

  const handleCritique = async (allPages: boolean) => {
    if (!comicRef.current || isCritiquing) return;
    setIsCritiquing(true);
    setCritiqueText(null);
    setSelectedPanelId(null);
    setSelectedBubbleId(null);
    await waitForPaint();

    try {
      const pagesToCapture = allPages ? pages : [pages[selectedPageIdx]];
      const originalIdx = selectedPageIdx;
      const captures: string[] = [];

      for (let i = 0; i < pagesToCapture.length; i++) {
        if (allPages) {
          setSelectedPageIdx(i);
          await waitForPaint();
        }
        captures.push(await captureRef(comicRef, "png"));
      }

      if (allPages) setSelectedPageIdx(originalIdx);

      const critique = await critiqueComic(captures);
      setCritiqueText(critique);
    } catch (err) {
      console.error("Critique failed:", err);
      setCritiqueText("Critique failed — check your API key in Settings.");
    }
    setIsCritiquing(false);
  };

  const handleSuggestDialogue = async () => {
    if (!comicRef.current || isGeneratingDialogue) return;
    setIsGeneratingDialogue(true);
    setDialogueSuggestions([]);
    setAppliedSuggestions(new Set());
    setSelectedPanelId(null);
    setSelectedBubbleId(null);
    await waitForPaint();

    try {
      const capture = await captureRef(comicRef, "png");
      const currentPage = pages[selectedPageIdx];
      const pagePanels = currentPage.panelIds
        .map((id) => panels.find((p) => p.id === id))
        .filter(Boolean) as PanelPrompt[];

      const panelDescriptions = pagePanels.map((p, i) => ({
        index: i,
        description: p.description,
      }));

      const charContext = characters.map((c) => ({
        name: c.name,
        description: c.description,
      }));

      const suggestions = await suggestDialogue(
        [capture],
        story,
        panelDescriptions,
        charContext,
      );
      setDialogueSuggestions(suggestions);
    } catch (err) {
      console.error("Dialogue suggestion failed:", err);
    }
    setIsGeneratingDialogue(false);
  };

  const applyDialogueSuggestion = (
    suggestion: DialogueSuggestion,
    suggestionIdx: number,
  ) => {
    const currentPage = pages[selectedPageIdx];
    const targetPanelId = currentPage.panelIds[suggestion.panelIndex];
    if (!targetPanelId) return;

    const newBubble: Bubble = {
      id: crypto.randomUUID(),
      text: suggestion.text,
      pos: { x: 50, y: 20 + (suggestionIdx % 3) * 15 },
      style: suggestion.style || "speech",
      fontSize: suggestion.style?.startsWith("sfx") ? 18 : 12,
      fontWeight: "bold",
      fontStyle: "normal",
      tailPos:
        suggestion.style === "speech" || suggestion.style === "thought"
          ? { x: 50, y: 40 + (suggestionIdx % 3) * 10 }
          : undefined,
    };

    setPanels((prev) =>
      prev.map((p) =>
        p.id === targetPanelId
          ? { ...p, bubbles: [...(p.bubbles || []), newBubble] }
          : p,
      ),
    );

    setAppliedSuggestions((prev) => new Set(prev).add(suggestionIdx));
  };

  return (
    <main className="pt-24 pb-32 px-4 md:px-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Sidebar: Tools & Assets */}
      <aside className="lg:col-span-3 space-y-6">
        {/* Editor Instructions */}
        {showOnboarding && (
          <div className="p-5 bg-surface-container/50 border-l-4 border-primary/60 rounded-r-xl">
            <p className="font-label text-primary uppercase tracking-[0.2em] text-[10px] font-bold mb-2">
              Step 4 of 4 — Final Touches
            </p>
            <p className="text-accent/70 text-sm leading-relaxed mb-3">
              Position your panels and add dialogue before exporting your comic.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-accent/40">
              <span>• Drag & pinch panels to reposition and scale</span>
              <span>• Tap a panel, then tap + to add a bubble</span>
              <span>• Tap a bubble to edit text, type, and size</span>
              <span>• Drag bubbles to reposition, pinch to resize</span>
              <span>• Use "Bake" to burn dialogue into the image</span>
            </div>
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setShowOnboarding(false);
                  localStorage.setItem(
                    "panelshaq_editor_onboarding_dismissed",
                    "1",
                  );
                }}
                className="px-6 py-2 bg-secondary text-background font-headline font-bold text-sm rounded-lg hover:opacity-90 active:scale-95 transition-all"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* Panel Actions */}
        {selectedPanelId && (
          <div className="bg-surface-container rounded-lg p-4 flex gap-2">
            <button
              onClick={() =>
                updatePanel(selectedPanelId, {
                  imageTransform: { x: 0, y: 0, scale: 1 },
                })
              }
              className="flex-1 py-2 text-[10px] font-bold uppercase tracking-widest text-accent/50 hover:text-primary border border-outline/10 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw size={12} />
              Reset Position
            </button>
            {selectedPanel?.image && (
              <button
                onClick={() => {
                  const link = document.createElement("a");
                  link.download = `panel-${panels.findIndex((p) => p.id === selectedPanelId) + 1}.png`;
                  link.href = selectedPanel.image!;
                  link.click();
                }}
                className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-accent/50 hover:text-primary border border-outline/10 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Download size={12} />
                Save
              </button>
            )}
          </div>
        )}

        {/* Border Color */}
        {selectedPanelId && selectedPanel && (
          <div className="bg-surface-container rounded-lg p-4 space-y-2">
            <label className="text-[9px] font-bold uppercase tracking-widest text-accent/40 block">
              Border
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { color: "#000000", label: "Black" },
                { color: "#FFFFFF", label: "White" },
                { color: "#EF4444", label: "Red" },
                { color: "#3B82F6", label: "Blue" },
                { color: "#F5B119", label: "Gold" },
                { color: "#10B981", label: "Green" },
                { color: "#8B5CF6", label: "Purple" },
                { color: "#0B1326", label: "Navy" },
                {
                  color:
                    pageBackgroundColor === "transparent"
                      ? "#FFFFFF"
                      : pageBackgroundColor,
                  label: "Page",
                },
                { color: "none", label: "None" },
              ].map(({ color, label }) => (
                <button
                  key={color}
                  title={label}
                  onClick={() =>
                    updatePanel(selectedPanelId, {
                      borderColor: color,
                      borderWidth:
                        color === "none" ? 0 : selectedPanel.borderWidth || 2,
                    })
                  }
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    (selectedPanel.borderColor || "none") === color
                      ? "border-primary scale-110"
                      : "border-outline/20"
                  }`}
                  style={{
                    background:
                      color === "none"
                        ? "linear-gradient(135deg, transparent 45%, #EF4444 45%, #EF4444 55%, transparent 55%)"
                        : color,
                  }}
                />
              ))}
            </div>
            {selectedPanel.borderColor &&
              selectedPanel.borderColor !== "none" && (
                <div className="flex items-center gap-2">
                  <label className="text-[9px] text-accent/30 shrink-0">
                    Width
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    value={selectedPanel.borderWidth || 2}
                    onChange={(e) =>
                      updatePanel(selectedPanelId, {
                        borderWidth: parseInt(e.target.value),
                      })
                    }
                    className="flex-1 accent-primary h-1"
                  />
                  <span className="text-[9px] text-accent/40 w-4 text-right">
                    {selectedPanel.borderWidth || 2}
                  </span>
                </div>
              )}

            {/* Border Effect Presets */}
            <label className="text-[9px] font-bold uppercase tracking-widest text-accent/40 block pt-1">
              Border Effect
            </label>
            <div className="grid grid-cols-4 gap-1">
              {BORDER_PRESETS.map((preset) => {
                const isActive =
                  preset.layers.length === 0
                    ? !hasActiveBorderStyle(selectedPanel.borderStyle)
                    : selectedPanel.borderStyle?.layers?.length ===
                        preset.layers.length &&
                      preset.layers.every(
                        (pl, i) =>
                          selectedPanel.borderStyle?.layers[i]?.effect ===
                            pl.effect &&
                          selectedPanel.borderStyle?.layers[i]?.intensity ===
                            pl.intensity,
                      );
                return (
                  <button
                    key={preset.id}
                    onClick={() =>
                      updatePanel(selectedPanelId, {
                        borderStyle:
                          preset.layers.length === 0
                            ? null
                            : {
                                seed:
                                  selectedPanel.borderStyle?.seed ||
                                  randomSeed(),
                                layers: preset.layers,
                              },
                      })
                    }
                    className={`px-1.5 py-1.5 rounded text-[9px] font-bold uppercase tracking-wide transition-all text-center ${
                      isActive
                        ? "bg-primary text-background"
                        : "bg-background text-accent/50 border border-outline/10"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
              <button
                onClick={() =>
                  selectedPanel.borderStyle &&
                  updatePanel(selectedPanelId, {
                    borderStyle: {
                      ...selectedPanel.borderStyle,
                      seed: randomSeed(),
                    },
                  })
                }
                disabled={!hasActiveBorderStyle(selectedPanel.borderStyle)}
                className="px-1.5 py-1.5 rounded text-[9px] font-bold transition-all text-center bg-background text-accent/50 border border-outline/10 disabled:opacity-30 flex items-center justify-center"
                title="Randomize"
              >
                <Dices size={12} />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Center: Comic Canvas */}
      <section className="lg:col-span-6 space-y-6 relative">
        <Tip
          id="editor-gestures"
          text="On any panel: drag to reposition, pinch to zoom, two-finger tap to rotate by your step size, double-tap to open it fullscreen for fine detail work."
          mode="coach"
          position="bottom"
          align="center"
          pose="dancing"
        />
        <div className="flex items-center justify-between bg-surface-container p-4 rounded-lg border border-outline/10">
          <button
            disabled={selectedPageIdx === 0}
            onClick={() => {
              setSelectedBubbleId(null);
              setSelectedPanelId(null);
              setIsBubbleEditing(false);
              setFullscreenPanelId(null);
              setSelectedPageIdx((prev) => prev - 1);
            }}
            className="p-2 rounded-full hover:bg-background disabled:opacity-20 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-headline font-bold text-accent">
            PAGE {selectedPageIdx + 1} OF {pages.length}
          </span>
          <button
            disabled={selectedPageIdx === pages.length - 1}
            onClick={() => {
              setSelectedBubbleId(null);
              setSelectedPanelId(null);
              setIsBubbleEditing(false);
              setFullscreenPanelId(null);
              setSelectedPageIdx((prev) => prev + 1);
            }}
            className="p-2 rounded-full hover:bg-background disabled:opacity-20 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div
          className={`${PAGE_FORMATS[pageFormat]?.aspect || "aspect-[3/4]"} relative`}
        >
          <div
            className="bg-surface-container-highest p-1 rounded-lg shadow-2xl h-full w-full overflow-hidden"
            ref={comicRef}
          >
            <ComicPageCanvas
              currentPage={currentPage}
              panels={panels}
              pageBackgroundColor={pageBackgroundColor}
              isExporting={false}
              gifVisibleCount={null}
              selectedPanelId={selectedPanelId}
              selectedBubbleId={selectedBubbleId}
              lockedPanelIds={lockedPanelIds}
              rotationStep={rotationStep}
              isRendering={isRendering}
              bindComicPinch={bindComicPinch}
              setSelectedPanelId={setSelectedPanelId}
              setSelectedBubbleId={setSelectedBubbleId}
              setIsBubbleEditing={setIsBubbleEditing}
              setFullscreenPanelId={setFullscreenPanelId}
              setLockedPanelIds={setLockedPanelIds}
              updatePanel={updatePanel}
              updateBubble={updateBubble}
              removeBubble={removeBubble}
              addBubble={addBubble}
              handleFinalRender={handleFinalRender}
              lastTapRef={lastTapRef}
            />
          </div>
        </div>
      </section>

      {/* Right Sidebar: Finish & Export */}
      <aside className="lg:col-span-3 space-y-6">
        {/* Dialogue */}
        <div className="bg-surface-container rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-primary text-lg font-bold flex items-center gap-2">
              <MessageSquare size={18} />
              DIALOGUE
            </h3>
            {selectedPanelId && (
              <button
                onClick={addBubble}
                className="p-1.5 bg-primary/10 text-primary rounded-md hover:bg-primary hover:text-background transition-colors"
                title="Add Bubble"
              >
                <Plus size={16} />
              </button>
            )}
          </div>

          {selectedPanelId ? (
            <div className="space-y-3">
              {(!selectedPanel?.bubbles ||
                selectedPanel.bubbles.length === 0) && (
                <div className="space-y-1.5 text-[10px] text-accent/30">
                  <p>
                    <span className="text-primary font-bold">1.</span> Tap{" "}
                    <span className="text-primary">+</span> above to add a
                    bubble
                  </p>
                  <p>
                    <span className="text-primary font-bold">2.</span> Tap the
                    bubble to edit text & type
                  </p>
                  <p>
                    <span className="text-primary font-bold">3.</span> Drag it
                    into position
                  </p>
                </div>
              )}

              {selectedPanel?.bubbles && selectedPanel.bubbles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedPanel.bubbles.map((b, idx) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBubbleId(b.id)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${selectedBubbleId === b.id ? "bg-primary border-primary text-background" : "bg-surface-container-highest border-outline/20 text-accent/50 hover:border-primary/50"}`}
                    >
                      {b.style === "effect" ? "SFX" : b.style} {idx + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-center text-accent/30 italic text-xs">
              Select a panel to add dialogue
            </div>
          )}
        </div>

        {/* Bake Dialogue */}
        <div className="relative">
          <button
            onClick={() => {
              if (
                window.confirm(
                  "This will permanently bake ALL text elements on the selected panel into the image. The original clean image will be replaced.\n\nDownload the panel first if you want to keep the clean version.\n\nContinue?",
                )
              ) {
                handleFinalRender();
              }
            }}
            disabled={
              !selectedPanelId || isRendering || !selectedPanel?.bubbles?.length
            }
            className="w-full py-4 rounded-lg bg-primary text-background font-headline font-bold flex flex-col items-center justify-center gap-1 shadow-[0_4px_14px_rgba(255,145,0,0.39)] active:scale-95 transition-transform disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              {isRendering ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Wand2 size={20} />
              )}
              <span>Bake Dialogue Into Image</span>
            </div>
            <span className="text-[8px] opacity-70 uppercase tracking-widest">
              Permanently renders bubbles into artwork
            </span>
          </button>
          <Tip
            id="bake-btn"
            text="Once you're happy with your bubbles, hit Bake to fuse them permanently into the panel image. Download a clean copy first if you want to keep the bubble-free version."
            mode="coach"
            position="top"
            align="center"
            pose="jumping"
          />
        </div>

        {/* Dialogue Helper */}
        <div className="bg-surface-container rounded-lg p-6 space-y-4">
          <h3 className="font-headline text-primary text-lg font-bold flex items-center gap-2">
            <MessageSquare size={18} />
            DIALOGUE HELPER
          </h3>

          {dialogueSuggestions.length === 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-accent/50">
                Suggest dialogue for your panels based on the story and visuals.
              </p>
              <div className="relative">
                <button
                  onClick={handleSuggestDialogue}
                  disabled={isGeneratingDialogue}
                  className="w-full py-3 rounded-lg bg-primary/10 text-primary border border-primary/20 font-headline font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
                >
                  {isGeneratingDialogue ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <MessageSquare size={14} />
                  )}
                  {isGeneratingDialogue ? "GENERATING..." : "SUGGEST DIALOGUE"}
                  {!isGeneratingDialogue && <InkCost kind="text" />}
                </button>
                <Tip
                  id="suggest-dialogue"
                  text="Press this and I'll review your laid-out comic, then suggest dialogue, thoughts and SFX for each panel. Tap Apply on any line to drop it in as a bubble — then bake it right into the image."
                  mode="coach"
                  position="left"
                  pose="thinking"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {dialogueSuggestions.map((s, i) => {
                const applied = appliedSuggestions.has(i);
                return (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border transition-all ${
                      applied
                        ? "bg-primary/5 border-primary/20 opacity-60"
                        : "bg-background/50 border-outline/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-primary">
                        Panel {String(s.panelIndex + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[8px] font-bold uppercase tracking-widest text-accent/30 bg-surface-container px-1.5 py-0.5 rounded">
                        {s.style}
                      </span>
                    </div>
                    {s.speaker && (
                      <p className="text-[9px] text-accent/40 font-bold mb-0.5">
                        {s.speaker}:
                      </p>
                    )}
                    <p className="text-xs text-accent/80 italic leading-relaxed mb-2">
                      "{s.text}"
                    </p>
                    {applied ? (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-primary flex items-center gap-1">
                        <Check size={10} />
                        Applied
                      </span>
                    ) : (
                      <button
                        onClick={() => applyDialogueSuggestion(s, i)}
                        className="text-[9px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                      >
                        <Plus size={10} />
                        Apply to Panel
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                onClick={handleSuggestDialogue}
                disabled={isGeneratingDialogue}
                className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-accent/40 hover:text-primary transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isGeneratingDialogue ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <RefreshCw size={10} />
                )}
                {isGeneratingDialogue ? "Generating..." : "Try Again"}
                {!isGeneratingDialogue && <InkCost kind="text" />}
              </button>
            </div>
          )}
        </div>

        {/* Comic Critique Corner */}
        <div className="bg-surface-container rounded-lg p-6 space-y-4 relative">
          <h3 className="font-headline text-primary text-lg font-bold flex items-center gap-2">
            <Sparkles size={18} />
            CRITIQUE CORNER
            <Tip
              id="ai-critique"
              text="Get AI feedback on your page's pacing, composition, and dialogue."
              mode="help"
              position="bottom"
              align="left"
            />
          </h3>

          {!critiqueText ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={smudgeAvatar}
                  alt="Smudge"
                  className="w-14 h-14 object-contain shrink-0"
                />
                <p className="text-xs text-accent/50">
                  Smudge will give your page a look. Composition, pacing, the
                  works.
                </p>
              </div>
              <button
                onClick={() => handleCritique(false)}
                disabled={isCritiquing}
                className="w-full py-3 rounded-lg bg-primary/10 text-primary border border-primary/20 font-headline font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
              >
                {isCritiquing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                {isCritiquing ? "ANALYZING..." : "CRITIQUE THIS PAGE"}
                {!isCritiquing && <InkCost kind="text" />}
              </button>
              {pages.length > 1 && (
                <button
                  onClick={() => handleCritique(true)}
                  disabled={isCritiquing}
                  className="w-full py-2.5 rounded-lg bg-background text-accent/60 border border-outline/10 font-headline font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
                >
                  {isCritiquing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Layers size={14} />
                  )}
                  {isCritiquing ? "ANALYZING..." : "CRITIQUE ALL PAGES"}
                  {!isCritiquing && <InkCost kind="text" />}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <img
                  src={smudgeAvatar}
                  alt="Smudge"
                  className="w-10 h-10 object-contain shrink-0"
                />
                <span className="font-label text-accent/40 uppercase tracking-[0.15em] text-[9px] font-bold">
                  Smudge's notes
                </span>
              </div>
              {critiqueText
                .split(
                  /\n(?=(?:COMPOSITION|PACING|DIALOGUE|VISUAL STORYTELLING|OVERALL)\b)/i,
                )
                .filter((s) => s.trim())
                .map((section, i) => {
                  const lines = section.split("\n");
                  const heading = lines[0].trim();
                  const body = lines.slice(1).join(" ").trim();
                  return (
                    <div key={i}>
                      <p className="font-label text-primary uppercase tracking-[0.15em] text-[9px] font-bold mb-1">
                        {heading}
                      </p>
                      <p className="text-xs text-accent/60 leading-relaxed">
                        {body}
                      </p>
                    </div>
                  );
                })}

              {/* Panelhaus CTA */}
              <div className="p-3 bg-primary/5 rounded-xl border border-primary/15 space-y-2">
                <p className="text-[10px] text-accent/60 leading-relaxed">
                  Want to polish it further? Download your{" "}
                  <strong className="text-accent/80">.comic</strong> file from
                  the Share menu and open it in{" "}
                  <strong className="text-accent/80">panelhaus.app</strong> for
                  the full desktop editing experience.
                </p>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate("share")}
                    className="w-full py-2 rounded-lg bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    <ArrowRight size={12} />
                    Go to Share & Export
                  </button>
                )}
              </div>

              <button
                onClick={() => setCritiqueText(null)}
                className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-accent/40 hover:text-primary transition-colors"
              >
                Get Another Critique
              </button>
            </div>
          )}
        </div>

        {/* Export / Next — advances to the Export tab (the flow's terminal step) */}
        {onNavigate && (
          <button
            onClick={() => onNavigate("share")}
            className="w-full py-3 rounded-lg bg-secondary/10 text-secondary border border-secondary/20 font-headline font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-secondary/20 active:scale-95 transition-all"
          >
            Export / Next
            <ArrowRight size={16} />
          </button>
        )}
      </aside>

      {/* Full-screen panel editing overlay */}
      {fullscreenPanelId &&
        (() => {
          const panel = panels.find((p) => p.id === fullscreenPanelId);
          if (!panel) return null;
          const panelIdx =
            currentPage?.panelIds.indexOf(fullscreenPanelId) ?? -1;
          const isLocked = lockedPanelIds.has(fullscreenPanelId);

          // Calculate proportional panel size from the layout template
          const tmpl = currentPage ? getTemplate(currentPage.layoutId) : null;
          const slot = tmpl?.slots[panelIdx];
          const colSpan = slot ? slot.colEnd - slot.colStart : 1;
          const rowSpan = slot ? slot.rowEnd - slot.rowStart : 1;
          const totalCols = tmpl?.cols || 1;
          const totalRows = tmpl?.rows || 1;
          const widthPct = (colSpan / totalCols) * 100;
          const heightPct = (rowSpan / totalRows) * 100;

          return (
            <div className="fixed inset-0 z-[200] bg-background flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-outline/10 bg-surface-container">
                <button
                  onClick={() => {
                    setFullscreenPanelId(null);
                    setSelectedBubbleId(null);
                    setIsBubbleEditing(false);
                  }}
                  className="flex items-center gap-1.5 text-accent/70 hover:text-primary transition-colors"
                >
                  <ChevronLeft size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest">
                    Back to Page
                  </span>
                </button>
                <span className="text-[10px] font-label text-accent/40 uppercase tracking-widest">
                  Panel {panelIdx + 1} of {currentPage?.panelIds.length || 0}
                </span>
              </div>

              {/* Panel — centered at composed size */}
              <div
                className="flex-1 relative overflow-hidden flex items-center justify-center"
                {...bindComicPinch()}
              >
                <div
                  className="relative bg-black overflow-hidden"
                  data-panel-bg
                  style={{ width: `${widthPct}%`, height: `${heightPct}%` }}
                >
                  {panel.image ? (
                    <PanelImage
                      panel={panel}
                      idx={panelIdx}
                      isSelected={true}
                      isExporting={false}
                      locked={isLocked}
                      rotationStep={rotationStep}
                      onSelect={() => {}}
                      onTransform={(id, t) =>
                        updatePanel(id, { imageTransform: t })
                      }
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-surface-container text-accent/40">
                      <ImageIcon size={48} />
                    </div>
                  )}

                  {/* Bubbles */}
                  {(panel.bubbles || []).map((bubble) => (
                    <DraggableBubble
                      key={bubble.id}
                      bubble={bubble}
                      isSelected={selectedBubbleId === bubble.id}
                      isExporting={false}
                      onSelect={() => {
                        setSelectedPanelId(fullscreenPanelId);
                        setSelectedBubbleId(bubble.id);
                      }}
                      onDeselect={() => {
                        setSelectedBubbleId(null);
                        setIsBubbleEditing(false);
                      }}
                      onEditingChange={setIsBubbleEditing}
                      panelLocked={isLocked}
                      isFullscreen={true}
                      onMove={(pos) => updateBubble(bubble.id, { pos })}
                      onUpdateBubble={(updates) =>
                        updateBubble(bubble.id, updates)
                      }
                      onRemove={() => removeBubble(bubble.id)}
                      onBakeAll={handleFinalRender}
                      isRendering={isRendering}
                    />
                  ))}
                </div>
              </div>

              {/* Floating editing toolbar — matches bottom nav style */}
              <div
                className="fixed left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-[201]"
                style={{ bottom: "calc(var(--sab, 0px) + 5.5rem)" }}
              >
                <p className="text-center text-[9px] text-accent/30 mb-1.5">
                  {isLocked
                    ? selectedBubbleId
                      ? "Drag to move • 2-finger tap to rotate"
                      : "Tap a bubble to edit • 2-finger tap rotates"
                    : "Drag to reposition • 2-finger tap to rotate"}
                  <span className="text-accent/40">
                    {" "}
                    (step size in Settings)
                  </span>
                </p>
                {/* Rotation slider */}
                {panel.image && (
                  <div className="bg-[#31394D]/60 backdrop-blur-xl rounded-2xl px-4 py-2.5 mb-2 flex items-center gap-3">
                    <RotateCcw size={14} className="text-accent/40 shrink-0" />
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={panel.imageTransform?.rotation ?? 0}
                      onChange={(e) => {
                        const deg = Number(e.target.value);
                        updatePanel(panel.id, {
                          imageTransform: {
                            ...(panel.imageTransform || {
                              x: 0,
                              y: 0,
                              scale: 1,
                            }),
                            rotation: deg,
                          },
                        });
                      }}
                      className="flex-1 h-1 accent-primary bg-outline/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
                    />
                    <span className="text-[10px] font-mono text-accent/40 w-8 text-right shrink-0">
                      {panel.imageTransform?.rotation ?? 0}°
                    </span>
                    {(panel.imageTransform?.rotation ?? 0) !== 0 && (
                      <button
                        onClick={() =>
                          updatePanel(panel.id, {
                            imageTransform: {
                              ...(panel.imageTransform || {
                                x: 0,
                                y: 0,
                                scale: 1,
                              }),
                              rotation: 0,
                            },
                          })
                        }
                        className="text-[8px] font-bold uppercase tracking-widest text-accent/40 hover:text-primary transition-colors px-1.5 py-0.5 rounded border border-outline/10 shrink-0"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                )}
                {showEmojiPicker && (
                  <div className="mb-2 bg-[#31394D]/80 backdrop-blur-xl rounded-2xl p-3 shadow-2xl">
                    <div className="grid grid-cols-8 gap-1">
                      {[
                        "❤️",
                        "💔",
                        "😱",
                        "😂",
                        "😡",
                        "💀",
                        "😢",
                        "💧",
                        "💥",
                        "⚡",
                        "🔥",
                        "✨",
                        "💢",
                        "⭐",
                        "💨",
                        "💫",
                        "❗",
                        "❓",
                        "💡",
                        "🎵",
                        "💬",
                        "💭",
                        "➡️",
                        "👆",
                      ].map((e) => (
                        <button
                          key={e}
                          onClick={() => addSticker(e)}
                          className="w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-white/10 active:scale-90 transition-all"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="bg-[#31394D]/60 backdrop-blur-xl rounded-2xl shadow-[0_20px_40px_rgba(6,14,32,0.4)] flex justify-around items-center py-2 px-2">
                  <button
                    onClick={() => {
                      setSelectedPanelId(fullscreenPanelId);
                      addBubble();
                      setShowEmojiPicker(false);
                    }}
                    className="flex flex-col items-center justify-center p-3 rounded-xl text-[#FFF3D2] hover:bg-surface-container transition-all"
                  >
                    <Plus size={20} />
                    <span className="text-[8px] mt-0.5 uppercase tracking-widest">
                      Bubble
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPanelId(fullscreenPanelId);
                      setShowEmojiPicker((v) => !v);
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${showEmojiPicker ? "bg-primary text-background shadow-[0_0_15px_rgba(255,145,0,0.5)] scale-110" : "text-[#FFF3D2] hover:bg-surface-container"}`}
                  >
                    <span className="text-lg">😀</span>
                    <span className="text-[8px] mt-0.5 uppercase tracking-widest">
                      Emoji
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setLockedPanelIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(fullscreenPanelId))
                          next.delete(fullscreenPanelId);
                        else next.add(fullscreenPanelId);
                        return next;
                      });
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                      isLocked
                        ? "bg-primary text-background shadow-[0_0_15px_rgba(255,145,0,0.5)] scale-110"
                        : "text-[#FFF3D2] hover:bg-surface-container"
                    }`}
                  >
                    {isLocked ? <Lock size={20} /> : <Unlock size={20} />}
                    <span className="text-[8px] mt-0.5 uppercase tracking-widest">
                      {isLocked ? "Lock" : "Unlock"}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          "Bake ALL text into the image? The original will be replaced.",
                        )
                      ) {
                        handleFinalRender();
                      }
                    }}
                    disabled={isRendering || !panel.bubbles?.length}
                    className="flex flex-col items-center justify-center p-3 rounded-xl text-[#FFF3D2] hover:bg-surface-container transition-all disabled:opacity-30"
                  >
                    {isRendering ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Wand2 size={20} />
                    )}
                    <span className="text-[8px] mt-0.5 uppercase tracking-widest">
                      Bake
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setFullscreenPanelId(null);
                      setSelectedBubbleId(null);
                      setIsBubbleEditing(false);
                    }}
                    className="flex flex-col items-center justify-center p-3 rounded-xl text-[#FFF3D2] hover:bg-surface-container transition-all"
                  >
                    <X size={20} />
                    <span className="text-[8px] mt-0.5 uppercase tracking-widest">
                      Done
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </main>
  );
};
