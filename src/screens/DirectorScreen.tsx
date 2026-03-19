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
} from "lucide-react";
import { generatePanelImage, PanelPrompt } from "../services/geminiService";
import { Character } from "../App";

interface DirectorProps {
  panels: PanelPrompt[];
  setPanels: React.Dispatch<React.SetStateAction<PanelPrompt[]>>;
  characters: Character[];
  styleReferenceImage: string | null;
  setStyleReferenceImage: (img: string | null) => void;
  onContinue: () => void;
}

const PanelCard = ({
  panel,
  characters,
  index,
  onUpdatePanel,
  styleReferenceImage,
  setStyleReferenceImage,
}: {
  panel: PanelPrompt;
  characters: Character[];
  index: number;
  onUpdatePanel: (updated: PanelPrompt) => void;
  styleReferenceImage: string | null;
  setStyleReferenceImage: (img: string | null) => void;
  key?: string | number;
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState(panel.description);
  const [cameraAngle, setCameraAngle] = useState(
    panel.cameraAngle || "Cinematic 35mm",
  );
  const [mood, setMood] = useState(panel.mood || "Cyberpunk Neon");
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

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    // Construct the enhanced prompt with character descriptions
    const selectedChars = characters.filter((c) =>
      selectedCharIds.includes(c.id),
    );
    const characterContext = selectedChars
      .map((c) => `${c.name}: ${c.description || ""}`)
      .join(". ");

    // Build the style string
    const style = `${cameraAngle}, ${mood}, Heavy Inks, High Contrast`;

    // Build the final prompt that includes character descriptions, camera angle and mood as modifiers
    const finalPrompt = `
      Subject: ${prompt}. 
      Characters present: ${characterContext}.
      Camera Angle: ${cameraAngle}.
      Mood: ${mood}.
    `.trim();

    // If useStyleRef is true, prioritize explicit styleReferenceImage,
    // then fallback to the first character reference if available
    const effectiveStyleRef = useStyleRef
      ? styleReferenceImage || finalCharRefs[0] || undefined
      : undefined;

    const imageUrl = await generatePanelImage(
      finalPrompt,
      style,
      finalCharRefs,
      effectiveStyleRef,
    );
    if (imageUrl) {
      onUpdatePanel({
        ...panel,
        image: imageUrl,
        description: prompt, // Keep the user's original description for the UI
        cameraAngle,
        mood,
        selectedCharacterIds: selectedCharIds,
        customReferenceImages: customCharRefs,
        useStyleRef,
      });
    }
    setIsGenerating(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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

  const isWide = index % 3 === 0;

  return (
    <div className={isWide ? "lg:col-span-8 group" : "lg:col-span-4 group"}>
      <div className="bg-surface rounded-lg overflow-hidden shadow-2xl transition-all duration-300 hover:translate-y-[-4px] border border-outline/10">
        <div
          className={`bg-surface-container relative overflow-hidden ${isWide ? "aspect-[21/9]" : "aspect-square"}`}
        >
          {image ? (
            <img
              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
              src={image}
              alt={`Panel ${index + 1}`}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-tr from-background to-surface-container flex flex-col items-center justify-center gap-4">
              <ImageIcon size={48} className="text-outline opacity-20" />
              {!isGenerating && (
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

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-primary panel-shaq-gradient text-background px-6 py-3 rounded-lg font-headline font-bold flex items-center gap-2 disabled:opacity-50 pointer-events-auto shadow-xl"
            >
              {isGenerating ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Sparkles size={20} />
              )}
              {isGenerating
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
              <span className="text-primary font-bold">Style:</span>{" "}
              {cameraAngle} • {mood}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-label text-[9px] text-accent/50 uppercase tracking-widest font-bold">
                Camera Angle
              </label>
              <select
                value={cameraAngle}
                onChange={(e) => updateCameraAngle(e.target.value)}
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
                value={mood}
                onChange={(e) => updateMood(e.target.value)}
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

          {/* Style Reference Toggle */}
          <div className="flex items-center justify-between p-3 bg-background/30 rounded-lg border border-outline/5">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`style-ref-${panel.id}`}
                checked={useStyleRef}
                onChange={(e) => setUseStyleRef(e.target.checked)}
                disabled={!styleReferenceImage && finalCharRefs.length === 0}
                className="accent-primary"
              />
              <label
                htmlFor={`style-ref-${panel.id}`}
                className={`text-[10px] font-bold uppercase tracking-widest ${!styleReferenceImage && finalCharRefs.length === 0 ? "text-accent/20" : "text-accent/60"}`}
              >
                {styleReferenceImage
                  ? "Same style as reference"
                  : finalCharRefs.length > 0
                    ? "Style from characters"
                    : "Same style as reference"}
              </label>
            </div>
            {image && (
              <button
                onClick={() =>
                  setStyleReferenceImage(
                    styleReferenceImage === image ? null : image,
                  )
                }
                className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded transition-colors ${styleReferenceImage === image ? "bg-primary text-background" : "text-primary hover:bg-primary/10"}`}
              >
                {styleReferenceImage === image
                  ? "Reference Set"
                  : "Set as Reference"}
              </button>
            )}
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
  styleReferenceImage,
  setStyleReferenceImage,
  onContinue,
}) => {
  const handleUpdatePanel = (index: number, updated: PanelPrompt) => {
    const newPanels = [...panels];
    newPanels[index] = updated;
    setPanels(newPanels);
  };

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
        <button
          onClick={onContinue}
          className="flex items-center justify-center gap-3 bg-secondary text-background px-8 py-4 rounded-lg font-headline font-extrabold tracking-tight hover:opacity-90 active:scale-95 transition-all shadow-[0_10px_20px_rgba(255,214,0,0.15)]"
        >
          CONTINUE TO DIALOGUE
          <ArrowRight size={20} />
        </button>
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
          {panels.map((panel, index) => (
            <PanelCard
              key={panel.id}
              panel={panel}
              characters={characters}
              index={index}
              onUpdatePanel={(updated) => handleUpdatePanel(index, updated)}
              styleReferenceImage={styleReferenceImage}
              setStyleReferenceImage={setStyleReferenceImage}
            />
          ))}
        </div>
      )}
    </div>
  );
};
