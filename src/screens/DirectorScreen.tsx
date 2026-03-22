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
import { VaultEntry } from "./VaultScreen";
import { useConfirm } from "../components/ConfirmDialog";
import { PreviewCarousel } from "../components/PreviewCarousel";

// Lens type reference images
import lensDefault from "../images/lens_types/Default.webp";
import lensFisheye from "../images/lens_types/Fish-eye 8mm.webp";
import lensUltraWide from "../images/lens_types/Ultra Wide 14mm.webp";
import lensWide from "../images/lens_types/Wide 24mm.webp";
import lensCinematic from "../images/lens_types/Cinematic 35mm.webp";
import lensStandard from "../images/lens_types/Standard 50mm.webp";
import lensPortrait from "../images/lens_types/Portrait 85mm.webp";
import lensTelephoto from "../images/lens_types/Telephoto 135mm.webp";
import lensExtremeTele from "../images/lens_types/Extreme Telephoto 200mm.webp";
import lensMacro from "../images/lens_types/Macro Extreme Closeup.webp";
import lensTiltShift from "../images/lens_types/til-shift-miniature.webp";
import lensAnamorphic from "../images/lens_types/anthro-widescreen.webp";

const LENS_IMAGES: Record<string, string> = {
  None: lensDefault,
  "Fish-eye 8mm": lensFisheye,
  "Ultra Wide 14mm": lensUltraWide,
  "Wide 24mm": lensWide,
  "Cinematic 35mm": lensCinematic,
  "Standard 50mm": lensStandard,
  "Portrait 85mm": lensPortrait,
  "Telephoto 135mm": lensTelephoto,
  "Extreme Telephoto 200mm": lensExtremeTele,
  "Macro / Extreme Close-up": lensMacro,
  "Tilt-Shift / Miniature": lensTiltShift,
  "Anamorphic Widescreen": lensAnamorphic,
};

const LENS_OPTIONS = [
  { group: "Wide", items: ["Fish-eye 8mm", "Ultra Wide 14mm", "Wide 24mm"] },
  { group: "Standard", items: ["Cinematic 35mm", "Standard 50mm"] },
  {
    group: "Telephoto",
    items: ["Portrait 85mm", "Telephoto 135mm", "Extreme Telephoto 200mm"],
  },
  {
    group: "Special",
    items: [
      "Macro / Extreme Close-up",
      "Tilt-Shift / Miniature",
      "Anamorphic Widescreen",
    ],
  },
];

const ASPECT_RATIOS = [
  { value: "1:1", label: "Square", w: 1, h: 1 },
  { value: "3:4", label: "Portrait", w: 3, h: 4 },
  { value: "4:3", label: "Landscape", w: 4, h: 3 },
  { value: "9:16", label: "Tall", w: 9, h: 16 },
  { value: "16:9", label: "Wide", w: 16, h: 9 },
  { value: "2:3", label: "Poster", w: 2, h: 3 },
  { value: "3:2", label: "Photo", w: 3, h: 2 },
  { value: "21:9", label: "Ultra Wide", w: 21, h: 9 },
];

function AspectRatioThumb({
  w,
  h,
  selected,
}: {
  w: number;
  h: number;
  selected?: boolean;
}) {
  // Normalize so the largest dimension is 18px
  const max = Math.max(w, h);
  const pw = Math.round((w / max) * 18);
  const ph = Math.round((h / max) * 18);
  return (
    <span
      className={`inline-block rounded-[2px] border ${selected ? "border-primary bg-primary/20" : "border-accent/30 bg-accent/10"}`}
      style={{ width: pw, height: ph }}
    />
  );
}

function AspectRatioPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current =
    ASPECT_RATIOS.find((r) => r.value === value) || ASPECT_RATIOS[0];

  return (
    <div className="space-y-1">
      <label className="font-label text-[9px] text-accent/50 uppercase tracking-widest font-bold">
        Aspect Ratio
      </label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full bg-background text-accent text-xs py-2 px-3 rounded-lg border border-outline/20 outline-none focus:border-primary flex items-center gap-2"
      >
        <AspectRatioThumb w={current.w} h={current.h} selected />
        <span className="flex-1 text-left">
          {current.label} ({current.value})
        </span>
        <ChevronDown size={12} className="text-accent/40" />
      </button>

      {/* Aspect ratio modal */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[80]"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-0 z-[81] flex items-start justify-center pointer-events-none pt-16 sm:pt-20 px-4">
            <div className="bg-surface border border-outline/20 rounded-2xl shadow-2xl p-5 w-full sm:max-w-md max-h-[75vh] overflow-y-auto pointer-events-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-headline font-bold text-accent text-base">
                  Aspect Ratio
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  className="text-accent/40 hover:text-accent"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {ASPECT_RATIOS.map((r) => {
                  const selected = r.value === value;
                  const max = Math.max(r.w, r.h);
                  const tw = Math.round((r.w / max) * 32);
                  const th = Math.round((r.h / max) * 32);
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => {
                        onChange(r.value);
                        setOpen(false);
                      }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                        selected
                          ? "bg-primary/10 border-primary shadow-[0_0_8px_rgba(255,145,0,0.15)]"
                          : "border-outline/10 hover:border-primary/30"
                      }`}
                    >
                      <span
                        className={`rounded-[3px] border-2 ${selected ? "border-primary bg-primary/20" : "border-accent/25 bg-accent/5"}`}
                        style={{ width: tw, height: th }}
                      />
                      <span
                        className={`text-xs font-bold ${selected ? "text-primary" : "text-accent/60"}`}
                      >
                        {r.label}
                      </span>
                      <span className="text-[10px] text-accent/30">
                        {r.value}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface DirectorProps {
  panels: PanelPrompt[];
  setPanels: React.Dispatch<React.SetStateAction<PanelPrompt[]>>;
  characters: Character[];
  backgrounds: VaultEntry[];
  props: VaultEntry[];
  vehicles: VaultEntry[];
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

const PanelCard = React.memo(
  ({
    panel,
    characters,
    index,
    onUpdatePanel,
    backgrounds,
    props: vaultProps,
    vehicles,
    isQueued,
    isQueueGenerating,
    isFailed,
    onQueueGenerate,
    onPreview,
  }: {
    panel: PanelPrompt;
    characters: Character[];
    index: number;
    onUpdatePanel: (index: number, updated: PanelPrompt) => void;
    backgrounds: VaultEntry[];
    props: VaultEntry[];
    vehicles: VaultEntry[];
    isQueued?: boolean;
    isQueueGenerating?: boolean;
    isFailed?: boolean;
    onQueueGenerate: (panelId: string) => void;
    onPreview: (index: number) => void;
  }) => {
    const [prompt, setPrompt] = useState(panel.description);
    const [cameraAngle, setCameraAngle] = useState(panel.cameraAngle || "None");
    const [cameraLens, setCameraLens] = useState(panel.cameraLens || "None");
    const [mood, setMood] = useState(panel.mood || "None");
    const [aspectRatio, setAspectRatio] = useState(panel.aspectRatio || "3:4");
    const [selectedBgId, setSelectedBgId] = useState<string | null>(
      panel.selectedBackgroundId || null,
    );
    const [showLensDropdown, setShowLensDropdown] = useState(false);
    const [showBackgrounds, setShowBackgrounds] = useState(false);
    const [selectedPropIds, setSelectedPropIds] = useState<string[]>(
      panel.selectedPropIds || [],
    );
    const [showProps, setShowProps] = useState(false);
    const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>(
      panel.selectedVehicleIds || [],
    );
    const [showVehicles, setShowVehicles] = useState(false);
    const [selectedCharIds, setSelectedCharIds] = useState<string[]>(
      panel.selectedCharacterIds ?? characters.map((c) => c.id).slice(0, 5),
    );
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [customCharRefs, setCustomCharRefs] = useState<string[]>(
      panel.customReferenceImages || [],
    );

    const uploadPanelRef = useRef<HTMLInputElement>(null);
    const handleUploadPanelImage = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        alert("Image too large. Please use an image under 10MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdatePanel(index, { ...panel, image: reader.result as string });
      };
      reader.readAsDataURL(file);
      if (e.target) e.target.value = "";
    };

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
      onUpdatePanel(index, {
        ...panel,
        description: prompt,
        cameraAngle,
        cameraLens,
        mood,
        aspectRatio,
        selectedCharacterIds: selectedCharIds,
        selectedBackgroundId: selectedBgId || undefined,
        selectedPropIds:
          selectedPropIds.length > 0 ? selectedPropIds : undefined,
        selectedVehicleIds:
          selectedVehicleIds.length > 0 ? selectedVehicleIds : undefined,
        customReferenceImages: customCharRefs,
      });
      // Add to the shared generation queue
      onQueueGenerate(panel.id);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (atRefLimit) {
          alert(
            `Maximum ${MAX_TOTAL_REFS} references per panel. Remove one first.`,
          );
          return;
        }
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
      const sep = prompt.trim()
        ? prompt.trim().endsWith(".")
          ? " "
          : ". "
        : "";
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
    const MAX_TOTAL_REFS = 5;
    const totalRefs =
      selectedCharIds.length +
      customCharRefs.length +
      (selectedBgId ? 1 : 0) +
      selectedPropIds.length +
      selectedVehicleIds.length;
    const atRefLimit = totalRefs >= MAX_TOTAL_REFS;

    const toggleChar = (id: string) => {
      const isSelecting = !selectedCharIds.includes(id);
      if (isSelecting && atRefLimit) return;
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

    const isWideRatio = ["16:9", "21:9", "3:2"].includes(aspectRatio);
    const aspectClass =
      {
        "1:1": "aspect-square",
        "16:9": "aspect-video",
        "9:16": "aspect-[9/16]",
        "4:3": "aspect-[4/3]",
        "3:4": "aspect-[3/4]",
        "2:3": "aspect-[2/3]",
        "3:2": "aspect-[3/2]",
        "21:9": "aspect-[21/9]",
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
                onClick={() => onPreview(index)}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-tr from-background to-surface-container flex flex-col items-center justify-center gap-4">
                <ImageIcon size={48} className="text-outline opacity-20" />
                {!isQueueGenerating && !isQueued && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerate}
                      className="bg-primary/10 text-primary border border-primary/30 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-background transition-all"
                    >
                      Generate
                    </button>
                    <button
                      onClick={() => uploadPanelRef.current?.click()}
                      className="bg-accent/5 text-accent/60 border border-outline/20 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:text-primary hover:border-primary/30 transition-all"
                    >
                      Upload
                    </button>
                  </div>
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
              <div className="absolute top-2 right-2 md:top-4 md:right-4 flex gap-1 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    uploadPanelRef.current?.click();
                  }}
                  className="bg-background/70 backdrop-blur-md text-accent/70 p-1.5 rounded-lg hover:text-primary hover:bg-background/90 transition-all"
                  title="Upload replacement image"
                >
                  <Upload size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const link = document.createElement("a");
                    link.download = `panel-${String(index + 1).padStart(2, "0")}.png`;
                    link.href = image;
                    link.click();
                  }}
                  className="bg-background/70 backdrop-blur-md text-accent/70 p-1.5 rounded-lg hover:text-primary hover:bg-background/90 transition-all"
                  title="Download panel image"
                >
                  <Download size={14} />
                </button>
              </div>
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

          <div className="p-5 space-y-3">
            {/* Reference count */}
            <div
              className={`text-[8px] font-label uppercase tracking-widest font-bold px-1 ${atRefLimit ? "text-primary" : "text-accent/30"}`}
            >
              References: {totalRefs}/{MAX_TOTAL_REFS}
            </div>

            {/* Character References — compact */}
            <div className="space-y-2 p-2.5 bg-background/30 rounded-lg border border-outline/5">
              <div className="flex items-center justify-between">
                <p className="text-[8px] font-label text-accent/40 uppercase tracking-widest font-bold">
                  Characters
                  <span className="text-accent/25 normal-case tracking-normal ml-1">
                    ({selectedCharIds.length})
                  </span>
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[9px] font-bold text-primary flex items-center gap-1 hover:opacity-80 transition-colors"
                >
                  <Upload size={9} />
                  Add
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {characters.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggleChar(c.id)}
                    className={`relative w-10 h-10 rounded-md overflow-hidden border-2 transition-all ${selectedCharIds.includes(c.id) ? "border-primary" : "border-outline/20 opacity-40 hover:opacity-100"}`}
                    title={c.name}
                  >
                    {c.image ? (
                      <img
                        src={c.image}
                        className="w-full h-full object-cover"
                        alt={c.name}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-surface-container text-[7px] font-bold">
                        {c.name.substring(0, 2)}
                      </div>
                    )}
                    {selectedCharIds.includes(c.id) && (
                      <div className="absolute top-0 right-0 bg-primary text-background p-0.5 rounded-bl-md">
                        <Sparkles size={5} />
                      </div>
                    )}
                  </button>
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
                      <X size={7} />
                    </button>
                  </div>
                ))}
                {selectedCharIds.length === 0 &&
                  customCharRefs.length === 0 && (
                    <div className="w-10 h-10 rounded-md bg-surface-container flex items-center justify-center border border-dashed border-outline/30 opacity-30">
                      <ImageIcon size={12} />
                    </div>
                  )}
              </div>
            </div>

            {/* Backgrounds — collapsible */}
            {backgrounds.length > 0 && (
              <div className="p-2.5 bg-background/30 rounded-lg border border-outline/5">
                <button
                  onClick={() => setShowBackgrounds(!showBackgrounds)}
                  className="flex items-center justify-between w-full"
                >
                  <p className="text-[8px] font-label text-accent/40 uppercase tracking-widest font-bold">
                    Background
                    {selectedBgId && (
                      <span className="text-primary ml-1">
                        (
                        {backgrounds.find((b) => b.id === selectedBgId)?.name ||
                          "Selected"}
                        )
                      </span>
                    )}
                  </p>
                  <ChevronDown
                    size={12}
                    className={`text-accent/30 transition-transform ${showBackgrounds ? "rotate-180" : ""}`}
                  />
                </button>
                {showBackgrounds && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      onClick={() => setSelectedBgId(null)}
                      className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase border transition-all ${
                        !selectedBgId
                          ? "border-primary text-primary bg-primary/10"
                          : "border-outline/20 text-accent/40 hover:text-accent"
                      }`}
                    >
                      None
                    </button>
                    {backgrounds.map((bg) => (
                      <button
                        key={bg.id}
                        onClick={() =>
                          setSelectedBgId(
                            bg.id === selectedBgId
                              ? null
                              : atRefLimit && !selectedBgId
                                ? selectedBgId
                                : bg.id,
                          )
                        }
                        className={`relative w-14 h-10 rounded-md overflow-hidden border-2 transition-all ${
                          selectedBgId === bg.id
                            ? "border-primary"
                            : "border-outline/20 opacity-50 hover:opacity-100"
                        }`}
                        title={bg.name}
                      >
                        {bg.image ? (
                          <img
                            src={bg.image}
                            className="w-full h-full object-cover"
                            alt={bg.name}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-surface-container text-[6px] font-bold">
                            {bg.name.substring(0, 3)}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Props — collapsible */}
            {vaultProps.length > 0 && (
              <div className="p-2.5 bg-background/30 rounded-lg border border-outline/5">
                <button
                  onClick={() => setShowProps(!showProps)}
                  className="flex items-center justify-between w-full"
                >
                  <p className="text-[8px] font-label text-accent/40 uppercase tracking-widest font-bold">
                    Props
                    {selectedPropIds.length > 0 && (
                      <span className="text-primary ml-1">
                        ({selectedPropIds.length})
                      </span>
                    )}
                  </p>
                  <ChevronDown
                    size={12}
                    className={`text-accent/30 transition-transform ${showProps ? "rotate-180" : ""}`}
                  />
                </button>
                {showProps && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {vaultProps.map((p) => (
                      <button
                        key={p.id}
                        onClick={() =>
                          setSelectedPropIds((prev) => {
                            const removing = prev.includes(p.id);
                            if (!removing && atRefLimit) return prev;
                            return removing
                              ? prev.filter((id) => id !== p.id)
                              : [...prev, p.id];
                          })
                        }
                        className={`relative w-14 h-10 rounded-md overflow-hidden border-2 transition-all ${
                          selectedPropIds.includes(p.id)
                            ? "border-primary"
                            : "border-outline/20 opacity-50 hover:opacity-100"
                        }`}
                        title={p.name}
                      >
                        {p.image ? (
                          <img
                            src={p.image}
                            className="w-full h-full object-cover"
                            alt={p.name}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-surface-container text-[6px] font-bold">
                            {p.name.substring(0, 3)}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Vehicles — collapsible */}
            {vehicles.length > 0 && (
              <div className="p-2.5 bg-background/30 rounded-lg border border-outline/5">
                <button
                  onClick={() => setShowVehicles(!showVehicles)}
                  className="flex items-center justify-between w-full"
                >
                  <p className="text-[8px] font-label text-accent/40 uppercase tracking-widest font-bold">
                    Vehicles
                    {selectedVehicleIds.length > 0 && (
                      <span className="text-primary ml-1">
                        ({selectedVehicleIds.length})
                      </span>
                    )}
                  </p>
                  <ChevronDown
                    size={12}
                    className={`text-accent/30 transition-transform ${showVehicles ? "rotate-180" : ""}`}
                  />
                </button>
                {showVehicles && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {vehicles.map((v) => (
                      <button
                        key={v.id}
                        onClick={() =>
                          setSelectedVehicleIds((prev) => {
                            const removing = prev.includes(v.id);
                            if (!removing && atRefLimit) return prev;
                            return removing
                              ? prev.filter((id) => id !== v.id)
                              : [...prev, v.id];
                          })
                        }
                        className={`relative w-14 h-10 rounded-md overflow-hidden border-2 transition-all ${
                          selectedVehicleIds.includes(v.id)
                            ? "border-primary"
                            : "border-outline/20 opacity-50 hover:opacity-100"
                        }`}
                        title={v.name}
                      >
                        {v.image ? (
                          <img
                            src={v.image}
                            className="w-full h-full object-cover"
                            alt={v.name}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-surface-container text-[6px] font-bold">
                            {v.name.substring(0, 3)}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                <button
                  type="button"
                  onClick={() => setShowLensDropdown(true)}
                  className="w-full bg-background text-accent text-xs py-2 px-3 rounded-lg border border-outline/20 outline-none focus:border-primary flex items-center gap-2 text-left"
                >
                  {LENS_IMAGES[cameraLens] && (
                    <img
                      src={LENS_IMAGES[cameraLens]}
                      alt=""
                      className="w-6 h-6 rounded object-cover shrink-0"
                    />
                  )}
                  <span className="flex-1 truncate">{cameraLens}</span>
                  <ChevronDown size={12} className="text-accent/30 shrink-0" />
                </button>

                {/* Lens modal */}
                {showLensDropdown && (
                  <>
                    <div
                      className="fixed inset-0 bg-black/50 z-[80]"
                      onClick={() => setShowLensDropdown(false)}
                    />
                    <div className="fixed inset-0 z-[81] flex items-end sm:items-center justify-center pointer-events-none p-0 sm:p-4">
                      <div className="bg-surface border border-outline/20 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 w-full sm:max-w-lg max-h-[85vh] overflow-y-auto pointer-events-auto">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-headline font-bold text-accent text-base">
                            Camera Lens
                          </h3>
                          <button
                            onClick={() => setShowLensDropdown(false)}
                            className="text-accent/40 hover:text-accent"
                          >
                            <X size={18} />
                          </button>
                        </div>

                        {/* None option */}
                        <button
                          onClick={() => {
                            handleLensChange("None");
                            setShowLensDropdown(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-2 transition-all ${cameraLens === "None" ? "bg-primary/10 border border-primary/30" : "hover:bg-background"}`}
                        >
                          {LENS_IMAGES["None"] && (
                            <img
                              src={LENS_IMAGES["None"]}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          )}
                          <span
                            className={`text-sm font-bold ${cameraLens === "None" ? "text-primary" : "text-accent/60"}`}
                          >
                            None
                          </span>
                        </button>

                        {LENS_OPTIONS.map((group) => (
                          <div key={group.group} className="mb-3">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-accent/30 mb-1.5 px-1">
                              {group.group}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {group.items.map((item) => (
                                <button
                                  key={item}
                                  onClick={() => {
                                    handleLensChange(item);
                                    setShowLensDropdown(false);
                                  }}
                                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                                    cameraLens === item
                                      ? "bg-primary/10 border-primary shadow-[0_0_8px_rgba(255,145,0,0.15)]"
                                      : "border-outline/10 hover:border-primary/30"
                                  }`}
                                >
                                  {LENS_IMAGES[item] && (
                                    <img
                                      src={LENS_IMAGES[item]}
                                      alt=""
                                      className="w-full aspect-video rounded-lg object-cover"
                                    />
                                  )}
                                  <span
                                    className={`text-[10px] font-bold text-center ${cameraLens === item ? "text-primary" : "text-accent/60"}`}
                                  >
                                    {item}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
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
              <AspectRatioPicker
                value={aspectRatio}
                onChange={setAspectRatio}
              />
            </div>
          </div>
        </div>
        <input
          type="file"
          ref={uploadPanelRef}
          onChange={handleUploadPanelImage}
          className="hidden"
          accept="image/*"
        />
      </div>
    );
  },
);

export const DirectorScreen: React.FC<DirectorProps> = ({
  panels,
  setPanels,
  characters,
  backgrounds,
  props,
  vehicles,
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
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem("panelshaq_director_onboarding_dismissed"),
  );

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

  const handleUpdatePanel = useCallback(
    (index: number, updated: PanelPrompt) => {
      setPanels((prev) => prev.map((p, i) => (i === index ? updated : p)));
    },
    [],
  );

  const handleQueueGenerate = useCallback((panelId: string) => {
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
  }, []);

  const handlePreview = useCallback((idx: number) => {
    setPreviewIndex(idx);
  }, []);

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
            panelSnapshot.selectedCharacterIds ??
            characters.map((ch) => ch.id).slice(0, 5)
          ).includes(c.id),
        );
        // Only include base64 images — URLs can't be sent as inline data to Gemini
        const allRefs = [
          ...(panelSnapshot.customReferenceImages || []),
          ...(selectedChars.map((c) => c.image).filter(Boolean) as string[]),
        ];
        const charRefs = allRefs
          .filter((r) => r.startsWith("data:image/"))
          .slice(0, 5);
        const characterContext = selectedChars
          .map((c) => `${c.name}: ${c.description || ""}`)
          .join(". ");

        // Background reference
        const selectedBg = panelSnapshot.selectedBackgroundId
          ? backgrounds.find((b) => b.id === panelSnapshot.selectedBackgroundId)
          : null;
        const bgRef =
          selectedBg?.image && selectedBg.image.startsWith("data:image/")
            ? selectedBg.image
            : null;
        const bgContext = selectedBg
          ? `Background/Setting: ${selectedBg.name}${selectedBg.description ? ` — ${selectedBg.description}` : ""}. Use this environment consistently. IMPORTANT: The background reference image is for the ENVIRONMENT ONLY — ignore any people, characters, or figures visible in it.`
          : "";

        // Props
        const selectedProps = (panelSnapshot.selectedPropIds || [])
          .map((id) => props.find((p) => p.id === id))
          .filter(Boolean) as VaultEntry[];
        const propRefs = selectedProps
          .map((p) => p.image)
          .filter((img) => img?.startsWith("data:image/")) as string[];
        const propContext =
          selectedProps.length > 0
            ? `Props in scene: ${selectedProps.map((p) => `${p.name}${p.description ? ` (${p.description})` : ""}`).join(", ")}. Include these objects as shown in their reference images.`
            : "";

        // Vehicles
        const selectedVehicles = (panelSnapshot.selectedVehicleIds || [])
          .map((id) => vehicles.find((v) => v.id === id))
          .filter(Boolean) as VaultEntry[];
        const vehicleRefs = selectedVehicles
          .map((v) => v.image)
          .filter((img) => img?.startsWith("data:image/")) as string[];
        const vehicleContext =
          selectedVehicles.length > 0
            ? `Vehicles in scene: ${selectedVehicles.map((v) => `${v.name}${v.description ? ` (${v.description})` : ""}`).join(", ")}. Include these vehicles as shown in their reference images.`
            : "";

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
          ${bgContext}
          ${propContext}
          ${vehicleContext}
          ${cameraStr ? `Camera Angle: ${cameraStr}.` : ""}
          ${lensStr ? `Camera Lens: ${lensStr}.` : ""}
          ${moodStr ? `Mood: ${moodStr}.` : ""}
          ${panelSnapshot.notes?.trim() ? `User feedback: ${panelSnapshot.notes.trim()}.` : ""}
          ${charRefs.length > 0 || bgRef || propRefs.length > 0 || vehicleRefs.length > 0 ? "CRITICAL: Match the exact visual style, line work, and coloring of the attached reference images. The output must look like it belongs in the same comic as the references." : ""}
          CRITICAL: Do NOT include any speech bubbles or text in the image.
        `.trim();

        // Combine all reference images
        const allImageRefs = [...charRefs, ...propRefs, ...vehicleRefs];
        if (bgRef) allImageRefs.push(bgRef);

        const imageUrl = await generatePanelImage(
          finalPrompt,
          allImageRefs,
          panelSnapshot.aspectRatio || "3:4",
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
          <button
            onClick={onContinue}
            className="flex items-center justify-center gap-3 bg-secondary text-background px-8 py-4 rounded-lg font-headline font-extrabold tracking-tight hover:opacity-90 active:scale-95 transition-all shadow-[0_10px_20px_rgba(255,214,0,0.15)]"
          >
            CONTINUE TO LAYOUTS
            <ArrowRight size={20} />
          </button>
        </div>
      </div>

      {panels.length > 0 && showOnboarding && (
        <div className="mb-8 p-5 bg-surface-container/50 border-l-4 border-primary/60 rounded-r-xl">
          <p className="font-label text-primary uppercase tracking-[0.2em] text-[10px] font-bold mb-2">
            Step 2 of 4 — Plan Your Panels
          </p>
          <p className="text-accent/70 text-sm leading-relaxed mb-3">
            This is your storyboard. Review and tweak each panel's description,
            then generate images when you're happy with the plan.
            <span className="text-accent/50"> Page layout comes next.</span>
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-accent/40">
            <span>• Edit descriptions & camera settings</span>
            <span>• Insert or remove panels</span>
            <span>• Generate one-by-one or all at once</span>
            <span>• Regenerate any image</span>
          </div>
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setShowOnboarding(false);
                localStorage.setItem(
                  "panelshaq_director_onboarding_dismissed",
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
                onUpdatePanel={handleUpdatePanel}
                backgrounds={backgrounds}
                props={props}
                vehicles={vehicles}
                isQueued={generationQueue.includes(panel.id)}
                isQueueGenerating={currentlyGenerating === panel.id}
                isFailed={failedPanels.has(panel.id)}
                onQueueGenerate={handleQueueGenerate}
                onPreview={handlePreview}
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

      {/* Bottom actions */}
      {panels.length > 0 && (
        <div className="flex flex-col items-center gap-4 pt-8">
          {/* Generate All / Cancel / Retry */}
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <button
              onClick={handleGenerateAll}
              disabled={queueActive}
              className="flex items-center justify-center gap-2 bg-primary text-background px-6 py-3.5 rounded-lg font-headline font-bold text-sm tracking-tight active:scale-95 transition-all disabled:opacity-50"
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
                className="px-4 py-3.5 rounded-lg border border-red-500/30 text-red-500 font-headline font-bold text-xs uppercase tracking-widest active:scale-95 transition-all"
              >
                Cancel
              </button>
            )}
            {failedPanels.size > 0 && !queueActive && (
              <button
                onClick={handleRetryFailed}
                className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg border border-red-500/30 text-red-400 font-headline font-bold text-xs uppercase tracking-widest transition-all"
              >
                <RefreshCw size={14} />
                RETRY {failedPanels.size} FAILED
              </button>
            )}
          </div>

          {/* Preview / Download */}
          <div className="flex items-center gap-3">
            {panels.some((p) => p.image) && (
              <>
                <button
                  onClick={() => setPreviewIndex(0)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-accent/20 text-accent/50 font-headline font-bold text-[10px] uppercase tracking-widest transition-all"
                >
                  <Eye size={14} />
                  Preview
                </button>
                <button
                  onClick={handleDownloadAll}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-accent/20 text-accent/50 font-headline font-bold text-[10px] uppercase tracking-widest transition-all"
                >
                  <Download size={14} />
                  Download All
                </button>
              </>
            )}
          </div>

          {/* Continue */}
          <button
            onClick={onContinue}
            className="flex items-center justify-center gap-3 bg-secondary text-background px-10 py-4 rounded-lg font-headline font-extrabold tracking-tight active:scale-95 transition-all shadow-[0_10px_20px_rgba(255,214,0,0.15)]"
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
