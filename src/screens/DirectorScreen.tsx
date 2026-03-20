import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowRight,
  RefreshCw,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Upload,
  X,
  Plus,
  Check,
  ChevronDown,
  Download,
  Eye,
} from "lucide-react";
import {
  generatePanelImage,
  generateInsertedPanelPrompt,
  PanelPrompt,
  InsertionContext,
} from "../services/geminiService";
import { Character } from "../App";
import { useConfirm } from "../components/ConfirmDialog";
import { PreviewCarousel } from "../components/PreviewCarousel";

interface DirectorProps {
  panels: PanelPrompt[];
  setPanels: React.Dispatch<React.SetStateAction<PanelPrompt[]>>;
  characters: Character[];
  story: string;
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
  isQueued,
  isQueueGenerating,
  isFailed,
  onQueueGenerate,
  onPreview,
}: {
  panel: PanelPrompt;
  characters: Character[];
  index: number;
  onUpdatePanel: (updated: PanelPrompt) => void;
  isQueued?: boolean;
  isQueueGenerating?: boolean;
  isFailed?: boolean;
  onQueueGenerate: (panelId: string) => void;
  onPreview?: () => void;
  key?: string | number;
}) => {
  const [prompt, setPrompt] = useState(panel.description);
  const [cameraAngle, setCameraAngle] = useState(panel.cameraAngle || "None");
  const [cameraLens, setCameraLens] = useState(panel.cameraLens || "None");
  const [mood, setMood] = useState(panel.mood || "None");
  const [aspectRatio, setAspectRatio] = useState(panel.aspectRatio || "16:9");
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>(
    panel.selectedCharacterIds ?? characters.map((c) => c.id),
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

  const getRegenWarning = () => {
    try {
      const s = localStorage.getItem("panelshaq_settings");
      return s ? JSON.parse(s).showRegenWarnings !== false : true;
    } catch {
      return true;
    }
  };

  const handleGenerate = () => {
    if (
      panel.image &&
      getRegenWarning() &&
      !window.confirm(
        "Regenerate this panel? The current image will be replaced.",
      )
    )
      return;
    // Save current settings to the panel before queueing
    onUpdatePanel({
      ...panel,
      description: prompt,
      cameraAngle,
      cameraLens,
      mood,
      aspectRatio,
      selectedCharacterIds: selectedCharIds,
      customReferenceImages: customCharRefs,
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

  // Descriptive phrases for each camera/mood option
  const ANGLE_DESC: Record<string, string> = {
    "Eye Level": "Shot from eye level, straight-on natural perspective",
    "Low Angle":
      "Low angle shot looking upward, making the subject appear powerful and imposing",
    "High Angle":
      "High angle shot looking downward, making the subject appear small or vulnerable",
    "Bird's Eye": "Extreme overhead bird's eye view looking straight down",
    "Worm's Eye": "Extreme low worm's eye view from ground level looking up",
    "Over the Shoulder":
      "Over-the-shoulder framing from behind one character looking at another",
    "Dutch Angle":
      "Tilted dutch angle with the horizon askew, creating unease and tension",
    "POV / First Person": "First-person POV shot from the character's eyes",
    "Three-Quarter View": "Three-quarter view angled slightly to the side",
    "Profile / Side View": "Clean profile side view silhouette framing",
    "Tracking Shot":
      "Dynamic tracking shot with motion blur suggesting camera movement",
    "Crane Shot": "Sweeping crane shot from an elevated moving vantage point",
    "Dolly Zoom":
      "Dolly zoom vertigo effect with compressed background perspective",
  };

  const LENS_DESC: Record<string, string> = {
    "Fish-eye 8mm":
      "Fish-eye 8mm lens with extreme barrel distortion and exaggerated depth",
    "Ultra Wide 14mm":
      "Ultra wide 14mm lens with dramatic perspective and expansive field of view",
    "Wide 24mm":
      "Wide 24mm lens capturing broad scenes with slight perspective distortion",
    "Cinematic 35mm":
      "Cinematic 35mm lens with natural field of view and shallow depth of field",
    "Standard 50mm": "Standard 50mm lens mimicking natural human vision",
    "Portrait 85mm":
      "Portrait 85mm lens with creamy bokeh background blur and subject isolation",
    "Telephoto 135mm":
      "Telephoto 135mm lens compressing depth and flattening perspective",
    "Extreme Telephoto 200mm":
      "Extreme telephoto 200mm with heavily compressed planes and intense subject isolation",
    "Macro / Extreme Close-up":
      "Macro extreme close-up revealing fine textures and tiny details",
    "Tilt-Shift / Miniature":
      "Tilt-shift miniature effect with selective focus making the scene look like a diorama",
    "Anamorphic Widescreen":
      "Anamorphic widescreen with horizontal lens flares and oval bokeh",
  };

  const MOOD_DESC: Record<string, string> = {
    "Cyberpunk Neon":
      "Drenched in neon pinks, blues, and purples with rain-slicked reflections",
    "High Contrast Noir":
      "High contrast noir with deep blacks, harsh shadows, and single-source dramatic lighting",
    "Amber Glow":
      "Warm amber glow with golden hour lighting casting long soft shadows",
    "Sun-Kissed Tech":
      "Bright sun-kissed lighting with clean whites and optimistic tech vibes",
    "Cold Industrial":
      "Cold industrial blue-grey tones with sterile fluorescent lighting",
    "Warm Sunset":
      "Warm sunset palette with rich oranges and deep magentas bleeding across the sky",
    "Foggy / Atmospheric":
      "Dense fog and atmospheric haze with diffused light and silhouetted shapes",
    "Dark & Gritty":
      "Dark and gritty with muted desaturated colors and grime textures",
    "Bright & Cheerful":
      "Bright and cheerful with vivid saturated colors and soft even lighting",
    "Dramatic Shadows":
      "Dramatic chiaroscuro with stark contrast between deep shadow and bright highlight",
  };

  const appendToPrompt = (desc: string) => {
    if (!desc || prompt.includes(desc)) return;
    const sep = prompt.trim() ? (prompt.trim().endsWith(".") ? " " : ". ") : "";
    setPrompt((prev) => `${prev.trim()}${sep}${desc}.`);
  };

  const handleAngleChange = (val: string) => {
    setCameraAngle(val);
    if (val !== "None" && ANGLE_DESC[val]) appendToPrompt(ANGLE_DESC[val]);
  };

  const handleLensChange = (val: string) => {
    setCameraLens(val);
    if (val !== "None" && LENS_DESC[val]) appendToPrompt(LENS_DESC[val]);
  };

  const handleMoodChange = (val: string) => {
    setMood(val);
    if (val !== "None" && MOOD_DESC[val]) appendToPrompt(MOOD_DESC[val]);
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
              className="w-full h-full object-contain opacity-90 group-hover:opacity-100 transition-opacity cursor-pointer"
              src={image}
              alt={`Panel ${index + 1}`}
              onClick={onPreview}
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

          <div className="absolute top-2 left-2 md:top-4 md:left-4 flex flex-col gap-1">
            <div className="bg-background/80 backdrop-blur-md px-2 py-0.5 md:px-3 md:py-1 rounded-md md:rounded-lg border border-outline/20">
              <span className="font-label text-[8px] md:text-[10px] text-primary uppercase font-bold tracking-widest">
                Panel {String(index + 1).padStart(2, "0")}
              </span>
            </div>
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
          {isFailed && !isQueued && !isQueueGenerating && (
            <button
              onClick={handleGenerate}
              className="absolute top-4 right-4 bg-red-500/90 backdrop-blur-md text-white px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 z-10 hover:bg-red-500 transition-colors cursor-pointer"
            >
              <RefreshCw size={10} /> Failed — Retry
            </button>
          )}
          {image && !isQueued && !isQueueGenerating && !isFailed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const link = document.createElement("a");
                link.download = `panel-${String(index + 1).padStart(2, "0")}.png`;
                link.href = image;
                link.click();
              }}
              className="absolute top-2 right-2 md:top-4 md:right-4 bg-background/70 backdrop-blur-md text-accent/70 p-1.5 rounded-lg z-10 hover:text-primary hover:bg-background/90 transition-all"
              title="Download panel image"
            >
              <Download size={14} />
            </button>
          )}

          <div className="absolute bottom-2 right-2 md:bottom-3 md:right-3 opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            <button
              onClick={handleGenerate}
              disabled={isQueued || isQueueGenerating}
              className="bg-primary/90 backdrop-blur-sm text-background px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg font-headline font-bold text-[10px] md:text-xs flex items-center gap-1 disabled:opacity-50 pointer-events-auto shadow-lg"
            >
              {isQueueGenerating ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              {isQueueGenerating ? "..." : image ? "REGEN" : "GEN"}
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="font-label text-[9px] text-accent/50 uppercase tracking-widest font-bold">
                Camera Angle
              </label>
              <select
                value={cameraAngle}
                onChange={(e) => handleAngleChange(e.target.value)}
                className="w-full bg-background text-accent text-xs py-2 px-3 rounded-lg border border-outline/20 outline-none focus:border-primary appearance-none"
              >
                <option>None</option>
                <optgroup label="Height">
                  <option>Eye Level</option>
                  <option>Low Angle</option>
                  <option>High Angle</option>
                  <option>Bird's Eye</option>
                  <option>Worm's Eye</option>
                </optgroup>
                <optgroup label="Position">
                  <option>Over the Shoulder</option>
                  <option>Dutch Angle</option>
                  <option>POV / First Person</option>
                  <option>Three-Quarter View</option>
                  <option>Profile / Side View</option>
                </optgroup>
                <optgroup label="Movement">
                  <option>Tracking Shot</option>
                  <option>Crane Shot</option>
                  <option>Dolly Zoom</option>
                </optgroup>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-label text-[9px] text-accent/50 uppercase tracking-widest font-bold">
                Camera Lens
              </label>
              <select
                value={cameraLens}
                onChange={(e) => handleLensChange(e.target.value)}
                className="w-full bg-background text-accent text-xs py-2 px-3 rounded-lg border border-outline/20 outline-none focus:border-primary appearance-none"
              >
                <option>None</option>
                <optgroup label="Wide">
                  <option>Fish-eye 8mm</option>
                  <option>Ultra Wide 14mm</option>
                  <option>Wide 24mm</option>
                </optgroup>
                <optgroup label="Standard">
                  <option>Cinematic 35mm</option>
                  <option>Standard 50mm</option>
                </optgroup>
                <optgroup label="Telephoto">
                  <option>Portrait 85mm</option>
                  <option>Telephoto 135mm</option>
                  <option>Extreme Telephoto 200mm</option>
                </optgroup>
                <optgroup label="Special">
                  <option>Macro / Extreme Close-up</option>
                  <option>Tilt-Shift / Miniature</option>
                  <option>Anamorphic Widescreen</option>
                </optgroup>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-label text-[9px] text-accent/50 uppercase tracking-widest font-bold">
                Mood
              </label>
              <select
                value={mood}
                onChange={(e) => handleMoodChange(e.target.value)}
                className="w-full bg-background text-accent text-xs py-2 px-3 rounded-lg border border-outline/20 outline-none focus:border-primary appearance-none"
              >
                <option>None</option>
                <option>Cyberpunk Neon</option>
                <option>High Contrast Noir</option>
                <option>Amber Glow</option>
                <option>Sun-Kissed Tech</option>
                <option>Cold Industrial</option>
                <option>Warm Sunset</option>
                <option>Foggy / Atmospheric</option>
                <option>Dark & Gritty</option>
                <option>Bright & Cheerful</option>
                <option>Dramatic Shadows</option>
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
  onContinue,
}) => {
  const { confirm } = useConfirm();
  const [generationQueue, setGenerationQueue] = useState<string[]>([]);
  const [currentlyGenerating, setCurrentlyGenerating] = useState<string | null>(
    null,
  );
  const [failedPanels, setFailedPanels] = useState<Set<string>>(new Set());
  const [insertingAt, setInsertingAt] = useState<number | null>(null);
  const [draftPanel, setDraftPanel] = useState<{
    panel: PanelPrompt;
    insertIndex: number;
  } | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

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
    // Clear failed state if retrying
    setFailedPanels((prev) => {
      if (!prev.has(panelId)) return prev;
      const next = new Set(prev);
      next.delete(panelId);
      return next;
    });
    setGenerationQueue((prev) =>
      prev.includes(panelId) ? prev : [...prev, panelId],
    );
  };

  const handleRetryFailed = () => {
    const ids = Array.from(failedPanels);
    setFailedPanels(new Set());
    setGenerationQueue((prev) => [
      ...prev,
      ...ids.filter((id) => !prev.includes(id)),
    ]);
  };

  const handleDownloadAll = () => {
    panels
      .filter((p) => p.image)
      .forEach((panel, i) => {
        const link = document.createElement("a");
        link.download = `panel-${String(i + 1).padStart(2, "0")}.png`;
        link.href = panel.image!;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
  };

  const shouldWarnRegen = () => {
    try {
      const s = localStorage.getItem("panelshaq_settings");
      return s ? JSON.parse(s).showRegenWarnings !== false : true;
    } catch {
      return true;
    }
  };

  const handleGenerateAll = async () => {
    const missing = panels.filter((p) => !p.image).map((p) => p.id);
    const withImages = panels.filter((p) => p.image).length;

    if (missing.length > 0 && withImages > 0) {
      if (shouldWarnRegen()) {
        const ok = await confirm({
          title: "Generate Missing Panels",
          message: `${withImages} of ${panels.length} panels already have images. Only the ${missing.length} missing panels will be generated.`,
          confirmText: `Generate ${missing.length} Panels`,
        });
        if (!ok) return;
      }
      setGenerationQueue(missing);
    } else if (missing.length === 0) {
      if (shouldWarnRegen()) {
        const ok = await confirm({
          title: "Regenerate Everything",
          message:
            "All panels already have images. This will replace every image with a new generation.",
          confirmText: "Regenerate All",
          danger: true,
        });
        if (!ok) return;
      }
      setGenerationQueue(panels.map((p) => p.id));
    } else {
      setGenerationQueue(missing);
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
          (
            panelSnapshot.selectedCharacterIds ?? characters.map((ch) => ch.id)
          ).includes(c.id),
        );
        // Only include base64 images — URLs can't be sent as inline data to Gemini
        const allRefs = [
          ...(panelSnapshot.customReferenceImages || []),
          ...(selectedChars.map((c) => c.image).filter(Boolean) as string[]),
        ];
        const charRefs = allRefs.filter((r) => r.startsWith("data:image/"));
        const characterContext = selectedChars
          .map((c) => `${c.name}: ${c.description || ""}`)
          .join(". ");

        const cameraStr =
          panelSnapshot.cameraAngle && panelSnapshot.cameraAngle !== "None"
            ? panelSnapshot.cameraAngle
            : "";
        const lensStr =
          panelSnapshot.cameraLens && panelSnapshot.cameraLens !== "None"
            ? panelSnapshot.cameraLens
            : "";
        const moodStr =
          panelSnapshot.mood && panelSnapshot.mood !== "None"
            ? panelSnapshot.mood
            : "";

        const finalPrompt = `
          A cinematic comic book panel.
          Subject: ${panelSnapshot.description}.
          Characters present: ${characterContext}.
          ${cameraStr ? `Camera Angle: ${cameraStr}.` : ""}
          ${lensStr ? `Camera Lens: ${lensStr}.` : ""}
          ${moodStr ? `Mood: ${moodStr}.` : ""}
          ${panelSnapshot.notes?.trim() ? `User feedback: ${panelSnapshot.notes.trim()}.` : ""}
          ${charRefs.length > 0 ? "CRITICAL: Match the exact visual style, line work, and coloring of the attached character reference images. The output must look like it belongs in the same comic as the references." : ""}
          CRITICAL: Do NOT include any speech bubbles or text in the image.
        `.trim();

        const imageUrl = await generatePanelImage(
          finalPrompt,
          charRefs,
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
        setFailedPanels((prev) => new Set(prev).add(nextId));
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
        <div className="flex items-center gap-3 flex-wrap">
          {panels.some((p) => p.image) && (
            <button
              onClick={handleDownloadAll}
              className="flex items-center justify-center gap-2 px-5 py-4 rounded-lg border border-accent/20 text-accent/60 font-headline font-bold text-xs uppercase tracking-widest hover:text-primary hover:border-primary/30 transition-all"
            >
              <Download size={16} />
              DOWNLOAD ALL
            </button>
          )}
          {panels.length > 0 && (
            <>
              <button
                onClick={() => setPreviewIndex(0)}
                className="flex items-center justify-center gap-2 px-5 py-4 rounded-lg border border-accent/20 text-accent/60 font-headline font-bold text-xs uppercase tracking-widest hover:text-primary hover:border-primary/30 transition-all"
              >
                <Eye size={16} />
                PREVIEW
              </button>
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
              {failedPanels.size > 0 && !queueActive && (
                <button
                  onClick={handleRetryFailed}
                  className="flex items-center justify-center gap-2 px-5 py-4 rounded-lg border border-red-500/30 text-red-400 font-headline font-bold text-xs uppercase tracking-widest hover:bg-red-500/10 transition-all"
                >
                  <RefreshCw size={16} />
                  RETRY {failedPanels.size} FAILED
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
                isQueued={generationQueue.includes(panel.id)}
                isQueueGenerating={currentlyGenerating === panel.id}
                isFailed={failedPanels.has(panel.id)}
                onQueueGenerate={handleQueueGenerate}
                onPreview={() => setPreviewIndex(index)}
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

      {/* Bottom continue button */}
      {panels.length > 0 && (
        <div className="flex justify-center pt-8">
          <button
            onClick={onContinue}
            className="flex items-center justify-center gap-3 bg-secondary text-background px-10 py-4 rounded-lg font-headline font-extrabold tracking-tight hover:opacity-90 active:scale-95 transition-all shadow-[0_10px_20px_rgba(255,214,0,0.15)]"
          >
            CONTINUE TO LAYOUTS
            <ArrowRight size={20} />
          </button>
        </div>
      )}

      {previewIndex !== null && (
        <PreviewCarousel
          panels={panels}
          initialIndex={previewIndex}
          onUpdatePanel={(updated) =>
            setPanels((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p)),
            )
          }
          onRegenerate={handleQueueGenerate}
          onClose={() => setPreviewIndex(null)}
          generatingId={currentlyGenerating}
        />
      )}
    </div>
  );
};
