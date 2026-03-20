import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowRight,
  RefreshCw,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Upload,
  X,
  Palette,
  Plus,
  Check,
  ChevronDown,
} from "lucide-react";
import {
  generatePanelImage,
  generateInsertedPanelPrompt,
  PanelPrompt,
  InsertionContext,
} from "../services/geminiService";
import { Character } from "../App";

interface DirectorProps {
  panels: PanelPrompt[];
  setPanels: React.Dispatch<React.SetStateAction<PanelPrompt[]>>;
  characters: Character[];
  story: string;
  styleReferenceImage: string | null;
  setStyleReferenceImage: (img: string | null) => void;
  onContinue: () => void;
}

/* ── Insert Panel Button ── */
const InsertPanelButton = ({
  onClick,
  label,
  isLoading,
}: {
  onClick: () => void;
  label?: string;
  isLoading?: boolean;
}) => (
  <div className="col-span-full flex items-center gap-4 py-3">
    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    <button
      onClick={onClick}
      disabled={isLoading}
      className="group/insert flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-dashed border-primary/40 text-primary/70 bg-primary/5 hover:border-primary hover:text-primary hover:bg-primary/15 transition-all disabled:opacity-50 disabled:cursor-wait shadow-[0_0_15px_rgba(255,145,0,0.08)]"
    >
      {isLoading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Plus
          size={16}
          className="group-hover/insert:rotate-90 transition-transform"
        />
      )}
      <span className="text-xs font-bold uppercase tracking-widest">
        {isLoading ? "Generating..." : label || "Insert Panel"}
      </span>
    </button>
    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
  </div>
);

/* ── Draft Panel Card (editable preview before confirming insertion) ── */
const PanelDraftCard = ({
  draft,
  onConfirm,
  onCancel,
  onChange,
}: {
  draft: PanelPrompt;
  onConfirm: () => void;
  onCancel: () => void;
  onChange: (updated: PanelPrompt) => void;
}) => (
  <div className="col-span-full my-2">
    <div className="bg-surface rounded-lg overflow-hidden shadow-[0_0_30px_rgba(255,145,0,0.15)] border-2 border-primary/50">
      <div className="bg-primary/10 px-4 py-2 flex items-center justify-between border-b border-primary/20">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
            New Panel Draft
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest text-accent/50 hover:text-accent hover:bg-background/50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1 rounded bg-primary text-background text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-1"
          >
            <Check size={12} />
            Confirm
          </button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <label className="font-label text-[9px] text-accent/50 uppercase tracking-widest font-bold">
            Panel Description
          </label>
          <textarea
            className="text-accent text-sm bg-background/50 p-3 rounded-lg border border-outline/10 focus:ring-1 focus:ring-primary w-full italic resize-none min-h-[80px] outline-none transition-all"
            value={draft.description}
            onChange={(e) =>
              onChange({ ...draft, description: e.target.value })
            }
            placeholder="Describe the action in this panel..."
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="font-label text-[9px] text-accent/50 uppercase tracking-widest font-bold">
              Character Focus
            </label>
            <input
              type="text"
              className="w-full bg-background text-accent text-xs py-2 px-3 rounded-lg border border-outline/20 outline-none focus:border-primary"
              value={draft.characterFocus || ""}
              onChange={(e) =>
                onChange({ ...draft, characterFocus: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <label className="font-label text-[9px] text-accent/50 uppercase tracking-widest font-bold">
              Camera Angle
            </label>
            <select
              value={draft.cameraAngle || "Cinematic 35mm"}
              onChange={(e) =>
                onChange({ ...draft, cameraAngle: e.target.value })
              }
              className="w-full bg-background text-accent text-xs py-2 px-3 rounded-lg border border-outline/20 outline-none focus:border-primary appearance-none"
            >
              <option>Ultra Wide 14mm</option>
              <option>Cinematic 35mm</option>
              <option>Portrait 85mm</option>
              <option>Low Angle</option>
              <option>Bird's Eye</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="font-label text-[9px] text-accent/50 uppercase tracking-widest font-bold">
              Mood
            </label>
            <select
              value={draft.mood || "Cyberpunk Neon"}
              onChange={(e) => onChange({ ...draft, mood: e.target.value })}
              className="w-full bg-background text-accent text-xs py-2 px-3 rounded-lg border border-outline/20 outline-none focus:border-primary appearance-none"
            >
              <option>Cyberpunk Neon</option>
              <option>High Contrast Noir</option>
              <option>Amber Glow</option>
              <option>Sun-Kissed Tech</option>
              <option>Cold Industrial</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const PanelCard = ({
  panel,
  characters,
  index,
  onUpdatePanel,
  styleReferenceImage,
  setStyleReferenceImage,
  isQueued,
  isQueueGenerating,
  onQueueGenerate,
}: {
  panel: PanelPrompt;
  characters: Character[];
  index: number;
  onUpdatePanel: (updated: PanelPrompt) => void;
  styleReferenceImage: string | null;
  setStyleReferenceImage: (img: string | null) => void;
  isQueued?: boolean;
  isQueueGenerating?: boolean;
  onQueueGenerate: (panelId: string) => void;
  key?: string | number;
}) => {
  const [prompt, setPrompt] = useState(panel.description);
  const [cameraAngle, setCameraAngle] = useState(panel.cameraAngle || "None");
  const [mood, setMood] = useState(panel.mood || "None");
  const [aspectRatio, setAspectRatio] = useState(panel.aspectRatio || "16:9");
  const [artStyle, setArtStyle] = useState(panel.artStyle || "Cartoon");
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>(
    panel.selectedCharacterIds || [],
  );
  const [useStyleRef, setUseStyleRef] = useState(
    panel.useStyleRef !== undefined ? panel.useStyleRef : !!styleReferenceImage,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customCharRefs, setCustomCharRefs] = useState<string[]>(
    panel.customReferenceImages || [],
  );

  const image = panel.image;
  const selectedChars = characters.filter((c) =>
    selectedCharIds.includes(c.id),
  );
  const finalCharRefs = [
    ...customCharRefs,
    ...(selectedChars.map((c) => c.image).filter(Boolean) as string[]),
  ];

  useEffect(() => {
    // If a style reference or character reference becomes available,
    // and the user hasn't explicitly disabled it, enable it.
    if (
      (styleReferenceImage || finalCharRefs.length > 0) &&
      !useStyleRef &&
      panel.useStyleRef === undefined
    ) {
      setUseStyleRef(true);
    }
  }, [styleReferenceImage, finalCharRefs.length]);

  const handleGenerate = () => {
    // Save current settings to the panel before queueing
    onUpdatePanel({
      ...panel,
      description: prompt,
      cameraAngle,
      mood,
      aspectRatio,
      artStyle,
      selectedCharacterIds: selectedCharIds,
      customReferenceImages: customCharRefs,
      useStyleRef,
    });
    // Add to the shared generation queue
    onQueueGenerate(panel.id);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image too large. Please use an image under 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomCharRefs((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
  };

  const updateCameraAngle = (newAngle: string) => {
    setCameraAngle(newAngle);
    if (!prompt.toLowerCase().includes(newAngle.toLowerCase())) {
      const separator = prompt.trim()
        ? prompt.trim().endsWith(".")
          ? " "
          : ". "
        : "";
      setPrompt((prev) => `${prev.trim()}${separator}${newAngle}`);
    }
  };

  const updateMood = (newMood: string) => {
    setMood(newMood);
    if (!prompt.toLowerCase().includes(newMood.toLowerCase())) {
      const separator = prompt.trim()
        ? prompt.trim().endsWith(".")
          ? " "
          : ". "
        : "";
      setPrompt((prev) => `${prev.trim()}${separator}${newMood}`);
    }
  };
  const toggleChar = (id: string) => {
    const isSelecting = !selectedCharIds.includes(id);
    setSelectedCharIds((prev) =>
      isSelecting ? [...prev, id] : prev.filter((i) => i !== id),
    );

    // Auto-append character name to prompt if selecting and not already present
    if (isSelecting) {
      const char = characters.find((c) => c.id === id);
      if (char && !prompt.toLowerCase().includes(char.name.toLowerCase())) {
        const separator = prompt.trim()
          ? prompt.trim().endsWith(".")
            ? " "
            : ". "
          : "";
        setPrompt((prev) => `${prev.trim()}${separator}${char.name}`);
      }
    }
  };

  const removeCustomRef = (index: number) => {
    setCustomCharRefs((prev) => prev.filter((_, i) => i !== index));
  };

  const isWideRatio = ["16:9", "21:9"].includes(aspectRatio);
  const aspectClass =
    {
      "1:1": "aspect-square",
      "16:9": "aspect-video",
      "9:16": "aspect-[9/16]",
      "4:3": "aspect-[4/3]",
      "3:4": "aspect-[3/4]",
    }[aspectRatio] || "aspect-video";

  return (
    <div
      className={isWideRatio ? "lg:col-span-8 group" : "lg:col-span-4 group"}
    >
      <div className="bg-surface rounded-lg overflow-hidden shadow-2xl transition-all duration-300 hover:translate-y-[-4px] border border-outline/10">
        <div
          className={`bg-surface-container relative overflow-hidden ${aspectClass}`}
        >
          {image ? (
            <img
              className="w-full h-full object-contain opacity-90 group-hover:opacity-100 transition-opacity"
              src={image}
              alt={`Panel ${index + 1}`}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-tr from-background to-surface-container flex flex-col items-center justify-center gap-4">
              <ImageIcon size={48} className="text-outline opacity-20" />
              {!isQueueGenerating && !isQueued && (
                <button
                  onClick={handleGenerate}
                  className="bg-primary/10 text-primary border border-primary/30 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-background transition-all"
                >
                  Ready to Generate
                </button>
              )}
            </div>
          )}

          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <div className="bg-background/80 backdrop-blur-md px-3 py-1 rounded-lg border border-outline/20">
              <span className="font-label text-[10px] text-primary uppercase font-bold tracking-widest">
                Panel {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            {styleReferenceImage === image && image && (
              <div className="bg-primary/90 backdrop-blur-md px-2 py-0.5 rounded-md border border-primary/20 flex items-center gap-1">
                <Sparkles size={8} className="text-background" />
                <span className="font-label text-[8px] text-background uppercase font-bold tracking-widest">
                  Style Ref
                </span>
              </div>
            )}
          </div>

          {/* Queue status badges */}
          {isQueued && !isQueueGenerating && (
            <div className="absolute top-4 right-4 bg-secondary/90 backdrop-blur-md text-background px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest z-10">
              Queued
            </div>
          )}
          {isQueueGenerating && (
            <div className="absolute top-4 right-4 bg-primary/90 backdrop-blur-md text-background px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 z-10">
              <Loader2 size={10} className="animate-spin" /> Generating...
            </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <button
              onClick={handleGenerate}
              disabled={isQueued || isQueueGenerating}
              className="bg-primary panel-shaq-gradient text-background px-6 py-3 rounded-lg font-headline font-bold flex items-center gap-2 disabled:opacity-50 pointer-events-auto shadow-xl"
            >
              {isQueueGenerating ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Sparkles size={20} />
              )}
              {isQueueGenerating
                ? "GENERATING..."
                : image
                  ? "REGENERATE"
                  : "GENERATE IMAGE"}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between border-b border-outline/10 pb-3">
            <div className="w-full space-y-2">
              <label className="font-label text-[9px] text-accent/50 uppercase tracking-widest font-bold">
                Panel Description
              </label>
              <textarea
                className="text-accent text-sm bg-background/50 p-3 rounded-lg border border-outline/10 focus:ring-1 focus:ring-primary w-full italic resize-none min-h-[80px] outline-none transition-all"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the action in this panel..."
              />
            </div>
          </div>

          {/* Prompt Preview / AI Instruction */}
          <div className="bg-primary/5 rounded-lg p-3 border border-primary/10 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[8px] font-bold text-primary uppercase tracking-widest">
                AI Instruction Preview
              </p>
              <Sparkles size={10} className="text-primary opacity-50" />
            </div>
            <div className="text-[10px] text-accent/60 leading-relaxed font-mono">
              <span className="text-primary font-bold">Subject:</span>{" "}
              {prompt || "..."}
              <br />
              <span className="text-primary font-bold">Characters:</span>{" "}
              {selectedChars.length > 0
                ? selectedChars.map((c) => c.name).join(", ")
                : "None selected"}
              <br />
              <span className="text-primary font-bold">Art Style:</span>{" "}
              {useStyleRef && styleReferenceImage
                ? "Custom Reference"
                : artStyle}
              {cameraAngle !== "None" && <> • {cameraAngle}</>}
              {mood !== "None" && <> • {mood}</>}
            </div>
            {selectedChars.length > 0 && (
              <div className="pt-1 border-t border-primary/5">
                <p className="text-[8px] text-accent/40 italic">
                  Character details will be automatically reinforced in the
                  generation.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="font-label text-[9px] text-accent/50 uppercase tracking-widest font-bold">
                Camera Angle
              </label>
              <select
                value={cameraAngle}
                onChange={(e) => updateCameraAngle(e.target.value)}
                className="w-full bg-background text-accent text-xs py-2 px-3 rounded-lg border border-outline/20 outline-none focus:border-primary appearance-none"
              >
                <option>None</option>
                <option>Ultra Wide 14mm</option>
                <option>Cinematic 35mm</option>
                <option>Portrait 85mm</option>
                <option>Low Angle</option>
                <option>Bird's Eye</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-label text-[9px] text-accent/50 uppercase tracking-widest font-bold">
                Mood
              </label>
              <select
                value={mood}
                onChange={(e) => updateMood(e.target.value)}
                className="w-full bg-background text-accent text-xs py-2 px-3 rounded-lg border border-outline/20 outline-none focus:border-primary appearance-none"
              >
                <option>None</option>
                <option>Cyberpunk Neon</option>
                <option>High Contrast Noir</option>
                <option>Amber Glow</option>
                <option>Sun-Kissed Tech</option>
                <option>Cold Industrial</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-label text-[9px] text-accent/50 uppercase tracking-widest font-bold">
                Aspect Ratio
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full bg-background text-accent text-xs py-2 px-3 rounded-lg border border-outline/20 outline-none focus:border-primary appearance-none"
              >
                <option value="1:1">1:1 Square</option>
                <option value="16:9">16:9 Wide</option>
                <option value="9:16">9:16 Portrait</option>
                <option value="4:3">4:3 Standard</option>
                <option value="3:4">3:4 Tall</option>
              </select>
            </div>
          </div>

          {/* Character Reference Selection */}
          <div className="space-y-3 p-3 bg-background/30 rounded-lg border border-outline/5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-label text-accent/40 uppercase tracking-widest font-bold">
                Character References
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] font-bold text-primary flex items-center gap-1 hover:opacity-80 transition-colors"
              >
                <Upload size={10} />
                Add Custom
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              {characters.map((c) => (
                <div
                  key={c.id}
                  className="relative group/char flex flex-col items-center gap-1"
                >
                  <button
                    onClick={() => toggleChar(c.id)}
                    className={`relative w-12 h-12 rounded-md overflow-hidden border-2 transition-all ${selectedCharIds.includes(c.id) ? "border-primary" : "border-outline/20 opacity-40 hover:opacity-100"}`}
                    title={c.name}
                  >
                    {c.image ? (
                      <img
                        src={c.image}
                        className="w-full h-full object-cover"
                        alt={c.name}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-surface-container text-[8px] font-bold">
                        {c.name.substring(0, 2)}
                      </div>
                    )}
                    {selectedCharIds.includes(c.id) && (
                      <div className="absolute top-0 right-0 bg-primary text-background p-0.5 rounded-bl-md">
                        <Sparkles size={6} />
                      </div>
                    )}
                  </button>
                  <span
                    className={`text-[8px] font-bold uppercase tracking-tighter text-center w-12 truncate ${selectedCharIds.includes(c.id) ? "text-primary" : "text-accent/40"}`}
                  >
                    {c.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setStyleReferenceImage(
                        styleReferenceImage === c.image ? null : c.image,
                      );
                    }}
                    className={`absolute top-0 -left-1 p-1 rounded-full border border-outline/20 transition-all opacity-0 group-hover/char:opacity-100 ${styleReferenceImage === c.image ? "bg-primary text-background scale-110" : "bg-background text-accent hover:text-primary"}`}
                    title="Set as Style Reference"
                  >
                    <Palette size={8} />
                  </button>
                </div>
              ))}

              {customCharRefs.map((ref, idx) => (
                <div
                  key={idx}
                  className="relative w-10 h-10 rounded-md overflow-hidden border-2 border-primary"
                >
                  <img
                    src={ref}
                    className="w-full h-full object-cover"
                    alt="Custom Ref"
                  />
                  <button
                    onClick={() => removeCustomRef(idx)}
                    className="absolute top-0 right-0 bg-background/80 text-accent p-0.5 rounded-bl-md hover:text-primary"
                  >
                    <X size={8} />
                  </button>
                </div>
              ))}

              {selectedCharIds.length === 0 && customCharRefs.length === 0 && (
                <div className="w-10 h-10 rounded-md bg-surface-container flex items-center justify-center border border-dashed border-outline/30 opacity-30">
                  <ImageIcon size={14} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DirectorScreen: React.FC<DirectorProps> = ({
  panels,
  setPanels,
  characters,
  story,
  styleReferenceImage,
  setStyleReferenceImage,
  onContinue,
}) => {
  const [generationQueue, setGenerationQueue] = useState<string[]>([]);
  const [currentlyGenerating, setCurrentlyGenerating] = useState<string | null>(
    null,
  );
  const [insertingAt, setInsertingAt] = useState<number | null>(null);
  const [draftPanel, setDraftPanel] = useState<{
    panel: PanelPrompt;
    insertIndex: number;
  } | null>(null);

  const handleInsertPanel = async (insertIndex: number) => {
    setInsertingAt(insertIndex);
    const context: InsertionContext = {
      story,
      previousPanel: insertIndex > 0 ? panels[insertIndex - 1] : null,
      nextPanel: insertIndex < panels.length ? panels[insertIndex] : null,
      allCharacters: characters.map((c) => ({
        name: c.name,
        description: c.description,
      })),
      insertIndex,
    };

    const result = await generateInsertedPanelPrompt(context);
    setInsertingAt(null);

    if (result) {
      setDraftPanel({ panel: result, insertIndex });
    }
  };

  const handleConfirmInsert = () => {
    if (!draftPanel) return;
    const newPanels = [...panels];
    newPanels.splice(draftPanel.insertIndex, 0, draftPanel.panel);
    setPanels(newPanels);
    setDraftPanel(null);
  };

  const handleCancelInsert = () => {
    setDraftPanel(null);
  };

  const handleUpdatePanel = (index: number, updated: PanelPrompt) => {
    setPanels((prev) => prev.map((p, i) => (i === index ? updated : p)));
  };

  const handleQueueGenerate = (panelId: string) => {
    // Add to queue if not already queued or currently generating
    if (panelId === currentlyGenerating) return;
    setGenerationQueue((prev) =>
      prev.includes(panelId) ? prev : [...prev, panelId],
    );
  };

  const handleGenerateAll = () => {
    const panelIds = panels.filter((p) => !p.image).map((p) => p.id);
    if (panelIds.length === 0) {
      // All have images — regenerate all
      setGenerationQueue(panels.map((p) => p.id));
    } else {
      setGenerationQueue(panelIds);
    }
  };

  // Process the queue one panel at a time
  useEffect(() => {
    if (generationQueue.length === 0 || currentlyGenerating) return;

    const nextId = generationQueue[0];
    const panel = panels.find((p) => p.id === nextId);

    if (!panel) {
      setGenerationQueue((prev) => prev.slice(1));
      return;
    }

    // Snapshot the panel data we need for the API call so stale closures don't matter
    const panelSnapshot = { ...panel };

    setCurrentlyGenerating(nextId);

    const generate = async () => {
      try {
        const selectedChars = characters.filter((c) =>
          (panelSnapshot.selectedCharacterIds || []).includes(c.id),
        );
        const charRefs = [
          ...(panelSnapshot.customReferenceImages || []),
          ...(selectedChars.map((c) => c.image).filter(Boolean) as string[]),
        ];
        const characterContext = selectedChars
          .map((c) => `${c.name}: ${c.description || ""}`)
          .join(". ");

        const artStyleStr = panelSnapshot.artStyle || "Cartoon";
        const cameraStr =
          panelSnapshot.cameraAngle && panelSnapshot.cameraAngle !== "None"
            ? panelSnapshot.cameraAngle
            : "";
        const moodStr =
          panelSnapshot.mood && panelSnapshot.mood !== "None"
            ? panelSnapshot.mood
            : "";

        const finalPrompt = `
          Art Style: ${artStyleStr}.
          Subject: ${panelSnapshot.description}.
          Characters present: ${characterContext}.
          ${cameraStr ? `Camera Angle: ${cameraStr}.` : ""}
          ${moodStr ? `Mood: ${moodStr}.` : ""}
        `.trim();

        const styleParts = [
          artStyleStr,
          cameraStr,
          moodStr,
          "Heavy Inks",
          "High Contrast",
        ].filter(Boolean);
        const style = styleParts.join(", ");
        const effectiveStyleRef =
          panelSnapshot.useStyleRef !== false
            ? styleReferenceImage || charRefs[0] || undefined
            : undefined;

        const imageUrl = await generatePanelImage(
          finalPrompt,
          style,
          charRefs,
          effectiveStyleRef,
          panelSnapshot.aspectRatio || "16:9",
        );

        if (imageUrl) {
          // Use functional updater to merge into the CURRENT state, not stale closure
          setPanels((prev) =>
            prev.map((p) => (p.id === nextId ? { ...p, image: imageUrl } : p)),
          );
        }
      } catch (err) {
        console.error(`Failed to generate panel ${nextId}:`, err);
      } finally {
        setGenerationQueue((prev) => prev.slice(1));
        setCurrentlyGenerating(null);
      }
    };

    generate();
  }, [generationQueue, currentlyGenerating]);

  const queueActive =
    generationQueue.length > 0 || currentlyGenerating !== null;
  const queueProgress = queueActive
    ? panels.length - generationQueue.length
    : 0;

  return (
    <div className="pt-24 px-6 max-w-7xl mx-auto pb-32">
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="font-label text-primary uppercase tracking-[0.2em] text-[10px] mb-2 block font-bold">
            Project: Cyberpunk Chronicles
          </span>
          <h2 className="font-headline text-4xl md:text-5xl font-bold text-accent leading-tight">
            Panel Director
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {panels.length > 0 && (
            <>
              <button
                onClick={handleGenerateAll}
                disabled={queueActive}
                className="flex items-center justify-center gap-2 bg-primary text-background px-6 py-4 rounded-lg font-headline font-bold tracking-tight hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                {queueActive ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Sparkles size={18} />
                )}
                {queueActive
                  ? `GENERATING ${queueProgress}/${panels.length}...`
                  : "GENERATE ALL"}
              </button>
              {queueActive && (
                <button
                  onClick={() => {
                    setGenerationQueue([]);
                    setCurrentlyGenerating(null);
                  }}
                  className="px-4 py-4 rounded-lg border border-red-500/30 text-red-500 font-headline font-bold text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                >
                  Cancel
                </button>
              )}
            </>
          )}
          <button
            onClick={onContinue}
            className="flex items-center justify-center gap-3 bg-secondary text-background px-8 py-4 rounded-lg font-headline font-extrabold tracking-tight hover:opacity-90 active:scale-95 transition-all shadow-[0_10px_20px_rgba(255,214,0,0.15)]"
          >
            CONTINUE TO LAYOUTS
            <ArrowRight size={20} />
          </button>
        </div>
      </div>

      {panels.length === 0 ? (
        <div className="py-32 flex flex-col items-center justify-center text-center bg-surface-container/30 rounded-2xl border-2 border-dashed border-outline/10">
          <Sparkles size={64} className="text-primary/20 mb-6" />
          <h3 className="font-headline text-2xl font-bold text-accent mb-2">
            No Panels Generated Yet
          </h3>
          <p className="text-accent/50 max-w-md mx-auto">
            Go back to the Workshop and click "Generate Panels" to start your
            visual journey.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 items-start pb-12">
          {/* Insert before first panel */}
          {draftPanel && draftPanel.insertIndex === 0 ? (
            <PanelDraftCard
              draft={draftPanel.panel}
              onConfirm={handleConfirmInsert}
              onCancel={handleCancelInsert}
              onChange={(updated) =>
                setDraftPanel({ ...draftPanel, panel: updated })
              }
            />
          ) : (
            <InsertPanelButton
              onClick={() => handleInsertPanel(0)}
              label="Add Prelude"
              isLoading={insertingAt === 0}
            />
          )}

          {panels.map((panel, index) => (
            <React.Fragment key={panel.id}>
              <PanelCard
                panel={panel}
                characters={characters}
                index={index}
                onUpdatePanel={(updated) => handleUpdatePanel(index, updated)}
                styleReferenceImage={styleReferenceImage}
                setStyleReferenceImage={setStyleReferenceImage}
                isQueued={generationQueue.includes(panel.id)}
                isQueueGenerating={currentlyGenerating === panel.id}
                onQueueGenerate={handleQueueGenerate}
              />
              {/* Insert button / draft card after this panel */}
              {draftPanel && draftPanel.insertIndex === index + 1 ? (
                <PanelDraftCard
                  draft={draftPanel.panel}
                  onConfirm={handleConfirmInsert}
                  onCancel={handleCancelInsert}
                  onChange={(updated) =>
                    setDraftPanel({ ...draftPanel, panel: updated })
                  }
                />
              ) : (
                <InsertPanelButton
                  onClick={() => handleInsertPanel(index + 1)}
                  label={
                    index === panels.length - 1
                      ? "Continue Story"
                      : "Insert Panel"
                  }
                  isLoading={insertingAt === index + 1}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
