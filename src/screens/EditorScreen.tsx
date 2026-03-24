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
  Share2,
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
} from "lucide-react";
import {
  PanelPrompt,
  finalNaturalRender,
  Bubble,
  critiqueComic,
} from "../services/geminiService";
import { Page, getTemplate, PAGE_FORMATS } from "./LayoutScreen";
import {
  BORDER_PRESETS,
  getCachedBorderPath,
  borderPathToSVG,
  hasActiveBorderStyle,
  randomSeed,
} from "../utils/borderStyles";
import { toPng, toJpeg } from "html-to-image";
import { encode as encodeGif } from "modern-gif";
import jsPDF from "jspdf";

/* ── Gesture-enabled panel image ── */
/* ── Gesture-enabled panel image ──
   Applies transforms directly to the DOM during gestures for 60fps,
   only commits to React state on gesture end. */
const PanelImage: React.FC<{
  panel: PanelPrompt;
  idx: number;
  isSelected: boolean;
  isExporting: boolean;
  locked?: boolean;
  rotationStep?: number;
  onSelect: (id: string) => void;
  onTransform: (
    id: string,
    t: { x: number; y: number; scale: number; rotation?: number },
  ) => void;
}> = ({
  panel,
  idx,
  isSelected,
  isExporting,
  locked,
  rotationStep = 10,
  onSelect,
  onTransform,
}) => {
  const initial = panel.imageTransform || { x: 0, y: 0, scale: 1, rotation: 0 };
  const imgRef = useRef<HTMLImageElement>(null);
  const tRef = useRef({ ...initial, rotation: initial.rotation || 0 });
  const baseRotation = useRef(initial.rotation || 0);
  const lastPinchEndTime = useRef(0);

  // Sync ref when props change
  useEffect(() => {
    tRef.current = { ...initial, rotation: initial.rotation || 0 };
  }, [initial.x, initial.y, initial.scale, initial.rotation]);

  const applyTransform = () => {
    if (!imgRef.current) return;
    const { scale, x, y, rotation } = tRef.current;
    imgRef.current.style.transform = `scale(${scale}) translate(${x}px, ${y}px) rotate(${rotation || 0}deg)`;
  };

  const bind = useGesture(
    {
      onDrag: ({ delta: [dx, dy], tap, event, last }) => {
        if (isExporting || locked) return;
        if (tap) {
          onSelect(panel.id);
          return;
        }
        event.preventDefault();
        const t = tRef.current;
        t.x += dx / t.scale;
        t.y += dy / t.scale;
        applyTransform();
        if (last) onTransform(panel.id, { ...t });
      },
      onPinchStart: () => {
        if (isExporting || locked) return;
        const timeSinceEnd = Date.now() - lastPinchEndTime.current;
        if (timeSinceEnd < 400 && timeSinceEnd > 50) {
          const newRotation = (tRef.current.rotation || 0) + rotationStep;
          tRef.current.rotation =
            Math.abs(newRotation % 360) < rotationStep / 2 ? 0 : newRotation;
          applyTransform();
          onTransform(panel.id, { ...tRef.current });
        }
      },
      onPinch: ({ offset: [s], event, last }) => {
        if (isExporting || locked) return;
        event?.preventDefault();
        tRef.current.scale = Math.min(4.2, Math.max(0.5, s));
        applyTransform();
        if (last) {
          onTransform(panel.id, { ...tRef.current });
          lastPinchEndTime.current = Date.now();
        }
      },
    },
    {
      drag: { filterTaps: true, pointer: { touch: true } },
      pinch: {
        scaleBounds: { min: 0.5, max: 4.2 },
        from: () => [tRef.current.scale, 0],
      },
    },
  );

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || isExporting || locked) return;
    const handler = (e: WheelEvent) => {
      if (window.innerWidth < 1024) return;
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      const t = tRef.current;
      t.scale = Math.min(4.2, Math.max(0.5, t.scale + delta));
      applyTransform();
      onTransform(panel.id, { ...t });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [isExporting, locked, panel.id, onTransform]);

  return (
    <div
      ref={containerRef}
      {...(!isExporting && !locked ? bind() : {})}
      className={`w-full h-full relative overflow-hidden ${locked ? "" : "touch-none"}`}
    >
      <img
        ref={imgRef}
        alt={`Panel ${idx + 1}`}
        className={`w-full h-full object-contain select-none will-change-transform ${isSelected ? "opacity-100" : "opacity-90 hover:opacity-100"}`}
        src={panel.image}
        draggable={false}
        style={{
          transform: `scale(${initial.scale}) translate(${initial.x}px, ${initial.y}px) rotate(${initial.rotation || 0}deg)`,
          transformOrigin: "center",
        }}
      />
    </div>
  );
};

/* ── Panel Border Wrapper — clip-path for outer edge + SVG stroke for visible line ── */
const PanelBorderWrapper: React.FC<{
  active: boolean;
  borderStyle?: {
    seed: number;
    layers: Array<{ effect: string; intensity: number }>;
  } | null;
  strokeColor: string;
  strokeWidth: number;
  children: React.ReactNode;
}> = ({ active, borderStyle, strokeColor, strokeWidth, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!ref.current || !active) return;
    const obs = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [active]);

  // Generate path at full size for the visible stroke
  const hasEffect = active && borderStyle && borderStyle.layers.length > 0;
  const layers = hasEffect ? borderStyle!.layers : [];
  const seed = borderStyle?.seed || 0;

  const svgPath =
    active && size.w > 0 && size.h > 0
      ? borderPathToSVG(getCachedBorderPath(size.w, size.h, layers, seed))
      : "";

  // Generate an inset path for clipping the image (inset by strokeWidth so image doesn't bleed past the border)
  const clipPath =
    active && size.w > 0 && size.h > 0
      ? borderPathToSVG(
          getCachedBorderPath(
            size.w - strokeWidth,
            size.h - strokeWidth,
            layers,
            seed,
          ).map((p) => ({
            x: p.x + strokeWidth / 2,
            y: p.y + strokeWidth / 2,
          })),
        )
      : "";

  return (
    <div
      ref={ref}
      className="w-full h-full relative"
      style={clipPath ? { clipPath: `path('${clipPath}')` } : undefined}
    >
      {children}
      {svgPath && strokeColor !== "none" && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-[25]"
          viewBox={`0 0 ${size.w} ${size.h}`}
          preserveAspectRatio="none"
        >
          <path
            d={svgPath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        </svg>
      )}
    </div>
  );
};

/* ── Draggable Bubble with floating toolbar ── */
const DraggableBubble: React.FC<{
  bubble: Bubble;
  isSelected: boolean;
  isExporting: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onMove: (pos: { x: number; y: number }) => void;
  onUpdateBubble: (updates: Partial<Bubble>) => void;
  onRemove: () => void;
  onBakeAll?: () => void;
  isRendering?: boolean;
  onEditingChange?: (editing: boolean) => void;
  panelLocked?: boolean;
  isFullscreen?: boolean;
}> = ({
  bubble,
  isSelected,
  isExporting,
  onSelect,
  onDeselect,
  onMove,
  onUpdateBubble,
  onRemove,
  onBakeAll,
  isRendering,
  onEditingChange,
  panelLocked,
  isFullscreen,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditingRaw] = useState(false);
  const setIsEditing = (v: boolean) => {
    setIsEditingRaw(v);
    onEditingChange?.(v);
  };

  // Track position in a ref for live DOM updates during drag
  const posRef = useRef({ ...bubble.pos });
  posRef.current = { ...bubble.pos };
  const baseFontSize = useRef(bubble.fontSize);
  const baseRotation = useRef(bubble.rotation || 0);

  // All gestures in one handler — drag/pinch always work, tap opens editor
  const bindGesture = useGesture(
    {
      onDrag: ({ delta: [dx, dy], tap, pinching, last, first }) => {
        if (isExporting) return;
        if (tap) {
          onSelect();
          setIsEditing(true);
          return;
        }
        // Allow dragging when in edit mode or when panel is locked
        if (!isEditing && !panelLocked) return;
        if (first) onSelect();
        if (pinching) return;
        const parent = containerRef.current?.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        const pctX = (dx / rect.width) * 100;
        const pctY = (dy / rect.height) * 100;
        posRef.current.x = Math.max(5, Math.min(95, posRef.current.x + pctX));
        posRef.current.y = Math.max(5, Math.min(95, posRef.current.y + pctY));

        if (containerRef.current) {
          containerRef.current.style.left = `${posRef.current.x}%`;
          containerRef.current.style.top = `${posRef.current.y}%`;
        }

        if (last)
          onMove({
            x: Math.round(posRef.current.x),
            y: Math.round(posRef.current.y),
          });
      },
    },
    {
      drag: { filterTaps: true, pointer: { touch: true } },
      eventOptions: { passive: false },
    },
  );

  // Prevent native browser zoom on the bubble so pinch gesture fires
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => {
      if (e.touches.length >= 2) e.preventDefault();
    };
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => el.removeEventListener("touchmove", prevent);
  }, []);

  const isSticker = bubble.style === "sticker";
  const isSFX =
    bubble.style === "effect" ||
    bubble.style === "action" ||
    bubble.style === "sfx-impact" ||
    bubble.style === "sfx-ambient";
  const isNarration = bubble.style === "narration";
  const isPopText = bubble.style === "pop-text";

  return (
    <>
      {/* Outer wrapper with expanded touch target for pinch */}
      <div
        ref={containerRef}
        {...(!isExporting ? bindGesture() : {})}
        onClick={(e) => e.stopPropagation()}
        className="absolute z-20 touch-none"
        style={{
          left: `${bubble.pos.x}%`,
          top: `${bubble.pos.y}%`,
          transform: `translate(-50%, -50%) rotate(${bubble.rotation || 0}deg)`,
          padding: "40px",
          margin: "-40px",
        }}
      >
        <div
          className={`cursor-grab active:cursor-grabbing ${
            isSelected && !isExporting
              ? "ring-2 ring-primary ring-offset-2 ring-offset-transparent"
              : ""
          } ${isSticker ? "" : isSFX || isPopText ? "" : isNarration ? "px-4 py-3 border border-background/60 shadow-lg" : "px-5 py-3 bg-white border-2 border-background shadow-xl"}`}
          style={{
            width: "max-content",
            maxWidth: isNarration ? "min(90vw, 400px)" : "min(80vw, 300px)",
            whiteSpace: bubble.text.includes("\n")
              ? "pre-wrap"
              : bubble.text.length < 40
                ? "nowrap"
                : "normal",
            ...(isSticker
              ? {}
              : isSFX || isPopText
                ? {}
                : isNarration
                  ? {
                      borderRadius: "2px",
                      backgroundColor: "rgba(255, 248, 220, 0.92)",
                    }
                  : {
                      borderRadius:
                        bubble.style === "thought" ? "40%" : "9999px",
                      borderStyle:
                        bubble.style === "thought" ? "dashed" : "solid",
                    }),
            fontSize: `${bubble.fontSize}px`,
            fontWeight: bubble.fontWeight,
            fontStyle: bubble.fontStyle,
          }}
        >
          {isSticker ? (
            <span
              style={{
                fontSize: `${bubble.fontSize}px`,
                lineHeight: 1,
                userSelect: "none",
              }}
            >
              {bubble.text}
            </span>
          ) : isPopText ? (
            <p
              className="leading-tight uppercase text-center font-black"
              style={{
                color: "#FFFFFF",
                fontFamily: "'Bangers', 'Comic Sans MS', cursive",
                fontSize: `${bubble.fontSize + 6}px`,
                textShadow:
                  "3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 0 0 #000, -3px 0 0 #000, 0 3px 0 #000, 0 -3px 0 #000",
                letterSpacing: "0.05em",
              }}
            >
              {bubble.text}
            </p>
          ) : isSFX ? (
            <p
              className="leading-tight uppercase font-headline text-center font-black"
              style={{
                color:
                  bubble.style === "sfx-impact"
                    ? "#FF3333"
                    : bubble.style === "sfx-ambient"
                      ? "#88CCFF"
                      : "#FFD600",
                textShadow:
                  bubble.style === "sfx-impact"
                    ? "3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 0 10px rgba(255,0,0,0.5)"
                    : bubble.style === "sfx-ambient"
                      ? "1px 1px 4px rgba(0,0,0,0.6)"
                      : "2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
                transform:
                  bubble.style === "sfx-impact"
                    ? "rotate(-8deg) scale(1.1)"
                    : bubble.style === "sfx-ambient"
                      ? "rotate(0deg)"
                      : "rotate(-3deg)",
                fontSize: `${bubble.fontSize + (bubble.style === "sfx-impact" ? 6 : bubble.style === "sfx-ambient" ? 2 : 4)}px`,
                fontStyle: bubble.style === "sfx-ambient" ? "italic" : "normal",
                letterSpacing:
                  bubble.style === "sfx-impact"
                    ? "0.1em"
                    : bubble.style === "sfx-ambient"
                      ? "0.2em"
                      : "normal",
              }}
            >
              {bubble.text}
            </p>
          ) : isNarration ? (
            <p
              className="leading-snug text-center italic text-background/90"
              style={{
                fontFamily: "'Inter', serif",
                fontSize: `${bubble.fontSize}px`,
              }}
            >
              {bubble.text}
            </p>
          ) : (
            <p className="leading-tight uppercase font-headline text-center text-background">
              {bubble.text}
            </p>
          )}
        </div>
      </div>

      {/* Floating toolbar on tap — fixed position so it's not clipped by panel overflow */}
      {isSelected && isEditing && !isExporting && (
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className={`fixed z-[210] flex flex-col gap-2 bg-surface-container border border-outline/20 rounded-xl p-3 shadow-2xl w-[220px]`}
          style={
            isFullscreen
              ? {
                  bottom: "calc(var(--sab, 0px) + 10rem)",
                  right: "1rem",
                }
              : {
                  left: "50%",
                  bottom: "calc(6rem + var(--sab, 0px))",
                  transform: "translateX(-50%)",
                }
          }
        >
          {/* Type toggle — tap to cycle */}
          {(() => {
            const types: { value: Bubble["style"]; label: string }[] = [
              { value: "speech", label: "Speech" },
              { value: "thought", label: "Thought" },
              { value: "narration", label: "Narration" },
              { value: "pop-text", label: "Pop Text" },
              { value: "effect", label: "SFX" },
              { value: "sfx-impact", label: "SFX Impact" },
              { value: "sfx-ambient", label: "SFX Ambient" },
            ];
            const currentIdx = types.findIndex((t) => t.value === bubble.style);
            const current = types[currentIdx >= 0 ? currentIdx : 0];
            const next = types[(currentIdx + 1) % types.length];
            return (
              <button
                onClick={() => onUpdateBubble({ style: next.value })}
                className="w-full py-2 rounded-lg bg-primary text-background text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all"
              >
                {current.label}{" "}
                <span className="opacity-50">→ tap to change</span>
              </button>
            );
          })()}

          {/* Text input */}
          <textarea
            value={bubble.text}
            onChange={(e) => onUpdateBubble({ text: e.target.value })}
            className="w-full bg-background border border-outline/20 rounded-lg px-2 py-1.5 text-xs text-accent outline-none focus:border-primary resize-none h-14 font-headline"
            placeholder="Type text..."
          />

          {/* Font size + delete */}
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                onUpdateBubble({ fontSize: Math.max(8, bubble.fontSize - 2) })
              }
              className="w-7 h-7 flex items-center justify-center bg-background border border-outline/20 rounded text-accent/50 text-xs font-bold"
            >
              A-
            </button>
            <span className="text-[9px] text-accent/40 flex-1 text-center">
              {bubble.fontSize}px
            </span>
            <button
              onClick={() =>
                onUpdateBubble({
                  fontSize: Math.min(
                    bubble.style === "sticker" ? 138 : 69,
                    bubble.fontSize + 2,
                  ),
                })
              }
              className="w-7 h-7 flex items-center justify-center bg-background border border-outline/20 rounded text-accent/50 text-xs font-bold"
            >
              A+
            </button>
            <button
              onClick={() => {
                onRemove();
                setIsEditing(false);
              }}
              className="w-7 h-7 flex items-center justify-center bg-background border border-red-500/20 rounded text-red-500/60 hover:bg-red-500 hover:text-white transition-colors ml-1"
            >
              <Trash2 size={12} />
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                onDeselect();
              }}
              className="w-9 h-7 flex items-center justify-center bg-green-500/15 border border-green-500/30 rounded text-green-400 text-sm font-bold hover:bg-green-500/25 transition-colors"
            >
              ✓
            </button>
          </div>

          {/* Bake all dialogue on this panel */}
          {onBakeAll && (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "This will permanently bake ALL text elements on this panel into the image. The original clean image will be replaced.\n\nDownload the panel first if you want to keep the clean version.\n\nContinue?",
                  )
                ) {
                  onBakeAll();
                  setIsEditing(false);
                }
              }}
              disabled={isRendering}
              className="w-full py-2 rounded-lg bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-background transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isRendering ? "Baking..." : "Bake Panel Dialogue"}
            </button>
          )}
        </div>
      )}
    </>
  );
};

interface EditorProps {
  panels: PanelPrompt[];
  pages: Page[];
  setPanels: React.Dispatch<React.SetStateAction<PanelPrompt[]>>;
  onNavigate?: (tab: string) => void;
  pageFormat?: string;
}

export const EditorScreen: React.FC<EditorProps> = ({
  panels,
  pages,
  setPanels,
  onNavigate,
  pageFormat = "portrait",
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
  const [isExporting, setIsExporting] = useState(false);
  const [shouldCancelExport, setShouldCancelExport] = useState(false);
  // isFraming removed — selected panels automatically show overflow for transform
  const [exportProgress, setExportProgress] = useState(0);
  const [gifVisibleCount, setGifVisibleCount] = useState<number | null>(null);
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
  const [exportHistory, setExportHistory] = useState<
    {
      id: string;
      name: string;
      date: string;
      size: string;
      data: string;
      type: "pdf" | "png";
    }[]
  >([]);

  useEffect(() => {
    // Migrate from localStorage to IndexedDB
    const saved = localStorage.getItem("comic_export_history");
    if (saved) {
      try {
        setExportHistory(JSON.parse(saved));
        localStorage.removeItem("comic_export_history");
      } catch {
        /* ignore parse errors */
      }
    }
  }, []);

  const addToHistory = (name: string, data: string, type: "pdf" | "png") => {
    // Calculate actual binary size (base64 is ~33% larger than raw bytes)
    const base64Part = data.split(",")[1] || data;
    const byteSize = (base64Part.length * 3) / 4;
    const newItem = {
      id: crypto.randomUUID(),
      name,
      date: new Date().toLocaleDateString(),
      size: `${(byteSize / 1024 / 1024).toFixed(1)} MB`,
      data,
      type,
    };
    const updated = [newItem, ...exportHistory].slice(0, 5);
    setExportHistory(updated);
    // Don't persist to localStorage — too large. History is session-only.
  };

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

  // Wait for React to paint after state change
  const waitForPaint = () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

  const captureRef = async (
    ref: React.RefObject<HTMLDivElement | null>,
    format: "jpeg" | "png",
  ) => {
    if (!ref.current) throw new Error("Ref not available");
    // Double rAF ensures layout is settled before capture
    await waitForPaint();
    if (format === "jpeg") {
      return toJpeg(ref.current, {
        quality: 0.9,
        backgroundColor: "#000000",
        pixelRatio: 1.5,
        skipFonts: true,
        cacheBust: true,
      });
    }
    return toPng(ref.current, {
      backgroundColor: "#000000",
      pixelRatio: 1.5,
      skipFonts: true,
      cacheBust: true,
    });
  };

  const handleExportPDF = async (allPages: boolean) => {
    if (!comicRef.current || isExporting) return;
    setIsExporting(true);
    setShouldCancelExport(false);
    setExportProgress(0);
    setSelectedPanelId(null);
    setSelectedBubbleId(null);
    // Wait for selection highlights to clear before capturing
    await waitForPaint();

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const pagesToExport = allPages ? pages : [pages[selectedPageIdx]];
      const originalPageIdx = selectedPageIdx;

      for (let i = 0; i < pagesToExport.length; i++) {
        if (shouldCancelExport) break;

        if (allPages) {
          setSelectedPageIdx(i);
          await waitForPaint();
        }

        try {
          const imgData = await captureRef(comicRef, "jpeg");

          if (i > 0) pdf.addPage();

          const canvasRatio =
            comicRef.current!.offsetWidth / comicRef.current!.offsetHeight;
          const pdfRatio = pdfWidth / pdfHeight;

          let finalWidth = pdfWidth;
          let finalHeight = pdfHeight;
          let xOffset = 0;
          let yOffset = 0;

          if (canvasRatio > pdfRatio) {
            finalHeight = pdfWidth / canvasRatio;
            yOffset = (pdfHeight - finalHeight) / 2;
          } else {
            finalWidth = pdfHeight * canvasRatio;
            xOffset = (pdfWidth - finalWidth) / 2;
          }

          pdf.addImage(
            imgData,
            "JPEG",
            xOffset,
            yOffset,
            finalWidth,
            finalHeight,
            undefined,
            "FAST",
          );
        } catch (pageError) {
          console.error(`Error exporting page ${i + 1}:`, pageError);
        }

        setExportProgress(Math.round(((i + 1) / pagesToExport.length) * 100));
      }

      if (!shouldCancelExport) {
        if (allPages) setSelectedPageIdx(originalPageIdx);

        const fileName = `Comic_Export_${new Date().getTime()}.pdf`;
        const pdfData = pdf.output("datauristring");
        addToHistory(fileName, pdfData, "pdf");

        await waitForPaint();
        pdf.save(fileName);
      }
    } catch (error) {
      console.error("PDF Export failed", error);
      alert("PDF Export failed. Please check console for details.");
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setShouldCancelExport(false);
    }
  };

  const handleExportPNG = async (allPages: boolean) => {
    if (!comicRef.current || isExporting) return;
    setIsExporting(true);
    setShouldCancelExport(false);
    setExportProgress(0);
    setSelectedPanelId(null);
    setSelectedBubbleId(null);
    await waitForPaint();

    try {
      const pagesToExport = allPages ? pages : [pages[selectedPageIdx]];
      const originalPageIdx = selectedPageIdx;

      for (let i = 0; i < pagesToExport.length; i++) {
        if (shouldCancelExport) break;

        if (allPages) {
          setSelectedPageIdx(i);
          await waitForPaint();
        }

        try {
          const imgData = await captureRef(comicRef, "png");

          const fileName = `Comic_Page_${allPages ? i + 1 : originalPageIdx + 1}_${new Date().getTime()}.png`;

          const link = document.createElement("a");
          link.download = fileName;
          link.href = imgData;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          addToHistory(fileName, imgData, "png");
        } catch (pageError) {
          console.error(`Error exporting page ${i + 1}:`, pageError);
        }

        setExportProgress(Math.round(((i + 1) / pagesToExport.length) * 100));
      }

      if (allPages) setSelectedPageIdx(originalPageIdx);
    } catch (error) {
      console.error("PNG Export failed", error);
      alert("PNG Export failed. Please check console for details.");
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setShouldCancelExport(false);
    }
  };

  type GifMode =
    | "story-flow"
    | "page-reveal"
    | "slideshow"
    | "cinematic"
    | "this-page";

  const handleCreateGif = async (mode: GifMode = "story-flow") => {
    if (!comicRef.current || isExporting) return;
    setIsExporting(true);
    setSelectedPanelId(null);
    setSelectedBubbleId(null);
    await waitForPaint();

    try {
      // Determine frame size from page format
      const fmt = PAGE_FORMATS[pageFormat] || PAGE_FORMATS.portrait;
      const gifWidth = 480;
      const gifHeight = Math.round(gifWidth * (fmt.ratio[1] / fmt.ratio[0]));
      const frameRatio = gifWidth / gifHeight;

      const canvas = document.createElement("canvas");
      canvas.width = gifWidth;
      canvas.height = gifHeight;
      const ctx = canvas.getContext("2d")!;

      const loadImg = (src: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });

      const drawFit = (
        img: HTMLImageElement,
        delay: number,
        fr: typeof frames,
      ) => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, gifWidth, gifHeight);
        const s = Math.max(gifWidth / img.width, gifHeight / img.height);
        const dw = img.width * s,
          dh = img.height * s;
        ctx.drawImage(img, (gifWidth - dw) / 2, (gifHeight - dh) / 2, dw, dh);
        fr.push({ data: ctx.getImageData(0, 0, gifWidth, gifHeight), delay });
      };

      const capturePanel = async (el: HTMLElement) =>
        loadImg(
          await toPng(el, { pixelRatio: 2, cacheBust: true, skipFonts: true }),
        );

      const capturePage = async () => {
        await waitForPaint();
        return loadImg(await captureRef(comicRef, "png"));
      };

      const frames: Array<{ data: ImageData; delay: number }> = [];
      const originalPageIdx = selectedPageIdx;
      const pagesToProcess =
        mode === "this-page"
          ? [selectedPageIdx]
          : Array.from({ length: pages.length }, (_, i) => i);

      for (let pi = 0; pi < pagesToProcess.length; pi++) {
        const pageIdx = pagesToProcess[pi];
        if (pageIdx !== selectedPageIdx || pi > 0) {
          setSelectedPageIdx(pageIdx);
          await waitForPaint();
        }

        if (mode === "slideshow") {
          drawFit(await capturePage(), 3000, frames);
        } else {
          const slots = Array.from(
            comicRef.current!.querySelectorAll("[data-panel-slot]"),
          ) as HTMLElement[];

          for (let i = 0; i < slots.length; i++) {
            const panelImg = await capturePanel(slots[i]);

            if (panelImg.width <= 0 || panelImg.height <= 0) continue;

            if (mode === "cinematic") {
              for (let step = 0; step < 3; step++) {
                const zoom = 1 + step * 0.08;
                const zw = panelImg.width / zoom,
                  zh = panelImg.height / zoom;
                const sx = (panelImg.width - zw) / 2,
                  sy = (panelImg.height - zh) / 2;
                ctx.fillStyle = "#000";
                ctx.fillRect(0, 0, gifWidth, gifHeight);
                const s = Math.max(gifWidth / zw, gifHeight / zh);
                const dw = zw * s,
                  dh = zh * s;
                ctx.drawImage(
                  panelImg,
                  sx,
                  sy,
                  zw,
                  zh,
                  (gifWidth - dw) / 2,
                  (gifHeight - dh) / 2,
                  dw,
                  dh,
                );
                frames.push({
                  data: ctx.getImageData(0, 0, gifWidth, gifHeight),
                  delay: 600,
                });
              }
            } else {
              drawFit(
                panelImg,
                mode === "story-flow" || mode === "this-page" ? 1200 : 800,
                frames,
              );
            }
          }

          if (mode === "page-reveal") {
            drawFit(await capturePage(), 2000, frames);
          }
        }

        setExportProgress(Math.round(((pi + 1) / pagesToProcess.length) * 85));
      }

      if (originalPageIdx !== selectedPageIdx)
        setSelectedPageIdx(originalPageIdx);
      setExportProgress(90);

      const gifBuffer = await encodeGif({
        width: gifWidth,
        height: gifHeight,
        frames: frames.map((f) => ({
          width: gifWidth,
          height: gifHeight,
          data: f.data.data,
          delay: f.delay,
        })),
        maxColors: 128,
      });
      const blob = new Blob([gifBuffer], { type: "image/gif" });
      setExportProgress(100);

      const filename =
        mode === "this-page"
          ? `Comic_Page_${selectedPageIdx + 1}.gif`
          : `Comic_${mode}.gif`;
      const file = new File([blob], filename, { type: "image/gif" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "My Comic",
          text: "Made with Panelhaus",
          files: [file],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = file.name;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error: any) {
      console.error("GIF export failed:", error);
      alert(`GIF export failed: ${error?.message || error}`);
    } finally {
      setGifVisibleCount(null);
      setIsExporting(false);
      setExportProgress(0);
    }
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
      <section className="lg:col-span-6 space-y-6">
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
          {/* Exporting Overlay - Moved outside the ref'd container to prevent it being captured in exports */}
          {isExporting && (
            <div className="absolute inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center gap-4 backdrop-blur-sm rounded-lg">
              <Loader2 size={48} className="text-primary animate-spin" />
              <div className="text-center space-y-1">
                <p className="font-headline font-bold text-primary tracking-widest uppercase">
                  Exporting Comic
                </p>
                <p className="text-[10px] text-accent/50 font-label uppercase tracking-widest">
                  {exportProgress}% Complete
                </p>
              </div>
              <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                ></div>
              </div>
              <button
                onClick={() => setShouldCancelExport(true)}
                className="mt-4 px-4 py-2 bg-red-500/20 text-red-500 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all pointer-events-auto"
              >
                Cancel Export
              </button>
            </div>
          )}

          <div
            className="bg-surface-container-highest p-1 rounded-lg shadow-2xl h-full w-full overflow-hidden"
            ref={comicRef}
          >
            <div
              {...(!isExporting ? bindComicPinch() : {})}
              className={`w-full h-full relative overflow-hidden ${isExporting ? "pointer-events-none" : ""} ${selectedBubbleId ? "touch-none" : ""}`}
              style={{
                backgroundColor:
                  pageBackgroundColor === "transparent"
                    ? "transparent"
                    : pageBackgroundColor,
                ...(pageBackgroundColor === "transparent" && !isExporting
                  ? {
                      backgroundImage:
                        "repeating-conic-gradient(#808080 0% 25%, #c0c0c0 0% 50%)",
                      backgroundSize: "16px 16px",
                    }
                  : {}),
              }}
            >
              {currentPage ? (
                <div
                  className="gap-2 h-full p-2"
                  style={(() => {
                    const tmpl = getTemplate(currentPage.layoutId);
                    if (tmpl) {
                      return {
                        display: "grid",
                        gridTemplateColumns: `repeat(${tmpl.cols}, 1fr)`,
                        gridTemplateRows: `repeat(${tmpl.rows}, 1fr)`,
                      };
                    }
                    return {
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                    };
                  })()}
                >
                  {currentPage.panelIds.map((pid, idx) => {
                    const panel = panels.find((p) => p.id === pid);
                    if (!panel) return null;

                    const tmpl = getTemplate(currentPage.layoutId);
                    const slot = tmpl?.slots[idx];

                    const transform = panel.imageTransform || {
                      x: 0,
                      y: 0,
                      scale: 1,
                    };

                    return (
                      <div
                        key={pid}
                        data-panel-slot={idx}
                        onClick={() => {
                          // Clear bubble selection when tapping a panel
                          setSelectedBubbleId(null);
                          setIsBubbleEditing(false);
                          const now = Date.now();
                          if (
                            lastTapRef.current?.id === pid &&
                            now - lastTapRef.current.time < 400
                          ) {
                            setFullscreenPanelId(pid);
                            setSelectedPanelId(pid);
                            // Auto-lock panel in fullscreen so text is manipulable by default
                            setLockedPanelIds((prev) => new Set(prev).add(pid));
                            lastTapRef.current = null;
                          } else {
                            setSelectedPanelId(pid);
                            lastTapRef.current = { id: pid, time: now };
                          }
                        }}
                        className={`bg-black relative cursor-pointer overflow-hidden group/panel ${isExporting ? "!ring-0 !shadow-none" : `transition-all ${selectedPanelId === pid ? "ring-2 ring-primary ring-inset" : ""}`}`}
                        style={{
                          ...(slot
                            ? {
                                gridColumn: `${slot.colStart} / ${slot.colEnd}`,
                                gridRow: `${slot.rowStart} / ${slot.rowEnd}`,
                              }
                            : {}),
                          ...(gifVisibleCount !== null && idx >= gifVisibleCount
                            ? { opacity: 0 }
                            : {}),
                        }}
                      >
                        <PanelBorderWrapper
                          active={
                            hasActiveBorderStyle(panel.borderStyle) ||
                            (!!panel.borderColor &&
                              panel.borderColor !== "none")
                          }
                          borderStyle={panel.borderStyle}
                          strokeColor={
                            panel.borderColor && panel.borderColor !== "none"
                              ? panel.borderColor
                              : "#000"
                          }
                          strokeWidth={panel.borderWidth || 2}
                        >
                          {panel.image ? (
                            <PanelImage
                              panel={panel}
                              idx={idx}
                              isSelected={selectedPanelId === pid}
                              isExporting={isExporting}
                              locked={
                                !!selectedBubbleId || lockedPanelIds.has(pid)
                              }
                              rotationStep={rotationStep}
                              onSelect={setSelectedPanelId}
                              onTransform={(id, t) =>
                                updatePanel(id, { imageTransform: t })
                              }
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-surface-container">
                              <ImageIcon
                                size={24}
                                className="text-outline opacity-20"
                              />
                              <span className="text-[8px] font-label uppercase text-accent/30">
                                No Image
                              </span>
                            </div>
                          )}

                          {/* Position lock toggle */}
                          {!isExporting && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLockedPanelIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(pid)) next.delete(pid);
                                  else next.add(pid);
                                  return next;
                                });
                              }}
                              className="absolute top-1.5 left-1.5 z-10 p-1.5 rounded"
                            >
                              {lockedPanelIds.has(pid) ? (
                                <Lock size={12} className="text-primary" />
                              ) : (
                                <Unlock size={12} className="text-accent/40" />
                              )}
                            </button>
                          )}

                          {/* Bubble Overlay */}
                          {(panel.bubbles || []).map((bubble) => (
                            <DraggableBubble
                              key={bubble.id}
                              bubble={bubble}
                              isSelected={
                                selectedBubbleId === bubble.id && !isExporting
                              }
                              isExporting={isExporting}
                              onSelect={() => {
                                setSelectedPanelId(pid);
                                setSelectedBubbleId(bubble.id);
                              }}
                              onDeselect={() => {
                                setSelectedBubbleId(null);
                                setIsBubbleEditing(false);
                              }}
                              onEditingChange={setIsBubbleEditing}
                              panelLocked={lockedPanelIds.has(pid)}
                              onMove={(pos) => {
                                if (selectedPanelId !== pid)
                                  setSelectedPanelId(pid);
                                updateBubble(bubble.id, { pos });
                              }}
                              onUpdateBubble={(updates) =>
                                updateBubble(bubble.id, updates)
                              }
                              onRemove={() => removeBubble(bubble.id)}
                              onBakeAll={handleFinalRender}
                              isRendering={isRendering}
                            />
                          ))}

                          {/* FAB: Add bubble button on selected panel */}
                          {selectedPanelId === pid &&
                            !isExporting &&
                            !selectedBubbleId && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addBubble();
                                  }}
                                  className="absolute bottom-2 right-2 z-30 w-8 h-8 bg-primary text-background rounded-full flex items-center justify-center shadow-lg hover:opacity-90 active:scale-90 transition-all"
                                  title="Add dialogue bubble"
                                >
                                  <Plus size={18} />
                                </button>
                                {(!panel.bubbles ||
                                  panel.bubbles.length === 0) && (
                                  <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                                    <p className="text-accent/30 text-xs font-bold uppercase tracking-widest bg-black/40 px-3 py-1.5 rounded-lg">
                                      Tap + to add dialogue
                                    </p>
                                  </div>
                                )}
                              </>
                            )}

                          {/* Dim non-selected panels when one is selected */}
                          {selectedPanelId &&
                            selectedPanelId !== pid &&
                            !isExporting && (
                              <div className="absolute inset-0 bg-black/30 z-10 pointer-events-none" />
                            )}
                        </PanelBorderWrapper>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-accent/20 italic">
                  No pages defined.
                </div>
              )}
            </div>
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

        {/* Comic Critique Corner */}
        <div className="bg-surface-container rounded-lg p-6 space-y-4">
          <h3 className="font-headline text-primary text-lg font-bold flex items-center gap-2">
            <Sparkles size={18} />
            CRITIQUE CORNER
          </h3>

          {!critiqueText ? (
            <div className="space-y-3">
              <p className="text-xs text-accent/50">
                Get AI feedback on composition, pacing, and storytelling.
              </p>
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
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
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

        {/* Export */}
        <div className="bg-surface-container rounded-lg p-6 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 text-primary/5 halftone-bg -mr-16 -mt-16 rotate-12"></div>
          <h3 className="font-headline text-accent text-lg font-bold">
            EXPORT
          </h3>
          <div className="space-y-4 relative z-10">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleExportPNG(false)}
                disabled={isExporting}
                className="py-3 rounded-lg bg-primary/10 text-primary border border-primary/20 font-headline font-bold text-xs flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                <span>This Page</span>
              </button>
              <button
                onClick={() => handleExportPNG(true)}
                disabled={isExporting}
                className="py-3 rounded-lg bg-primary text-background font-headline font-bold text-xs flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                <span>All Pages</span>
              </button>
            </div>
            <button
              onClick={async () => {
                if (!comicRef.current || isExporting) return;
                setIsExporting(true);
                setSelectedPanelId(null);
                setSelectedBubbleId(null);
                await waitForPaint();
                try {
                  const imgData = await captureRef(comicRef, "png");
                  const res = await fetch(imgData);
                  const blob = await res.blob();
                  const file = new File(
                    [blob],
                    `Comic_Page_${selectedPageIdx + 1}.png`,
                    { type: "image/png" },
                  );
                  if (navigator.canShare?.({ files: [file] })) {
                    await navigator.share({
                      title: "My Comic",
                      text: "Made with Panelhaus",
                      files: [file],
                    });
                  } else {
                    const link = document.createElement("a");
                    link.download = file.name;
                    link.href = imgData;
                    link.click();
                  }
                } catch {
                  /* user cancelled */
                }
                setIsExporting(false);
              }}
              disabled={isExporting}
              className="w-full py-3 rounded-lg bg-secondary/10 text-secondary border border-secondary/20 font-headline font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Share2 size={14} />
              )}
              Share This Page
            </button>
            {pages.length > 1 && (
              <button
                onClick={async () => {
                  if (!comicRef.current || isExporting) return;
                  setIsExporting(true);
                  setSelectedPanelId(null);
                  setSelectedBubbleId(null);
                  await waitForPaint();
                  try {
                    const originalIdx = selectedPageIdx;
                    const files: File[] = [];
                    for (let i = 0; i < pages.length; i++) {
                      setSelectedPageIdx(i);
                      await waitForPaint();
                      const imgData = await captureRef(comicRef, "png");
                      const res = await fetch(imgData);
                      const blob = await res.blob();
                      files.push(
                        new File([blob], `Comic_Page_${i + 1}.png`, {
                          type: "image/png",
                        }),
                      );
                    }
                    setSelectedPageIdx(originalIdx);
                    if (navigator.canShare?.({ files })) {
                      await navigator.share({
                        title: "My Comic",
                        text: "Made with Panelhaus",
                        files,
                      });
                    } else {
                      files.forEach((f) => {
                        const url = URL.createObjectURL(f);
                        const link = document.createElement("a");
                        link.download = f.name;
                        link.href = url;
                        link.click();
                        URL.revokeObjectURL(url);
                      });
                    }
                  } catch {
                    /* user cancelled */
                  }
                  setIsExporting(false);
                }}
                disabled={isExporting}
                className="w-full py-3 rounded-lg bg-secondary text-background font-headline font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Share2 size={14} />
                )}
                Share All Pages
              </button>
            )}
            {/* GIF Export Modes */}
            <div className="space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-accent/40">
                Animated GIF
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  {
                    mode: "story-flow" as const,
                    label: "Story Flow",
                    desc: "Panels only",
                  },
                  {
                    mode: "page-reveal" as const,
                    label: "Page Reveal",
                    desc: "Panels + page",
                  },
                  {
                    mode: "slideshow" as const,
                    label: "Slideshow",
                    desc: "Pages only",
                  },
                  {
                    mode: "cinematic" as const,
                    label: "Cinematic",
                    desc: "Zoom & pan",
                  },
                  {
                    mode: "this-page" as const,
                    label: "This Page",
                    desc: "Current page",
                  },
                ].map(({ mode, label, desc }) => (
                  <button
                    key={mode}
                    onClick={() => handleCreateGif(mode)}
                    disabled={isExporting}
                    className="py-2 px-2 rounded-lg bg-accent/5 text-accent/70 border border-accent/10 font-headline font-bold text-[10px] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    <span>{label}</span>
                    <span className="text-[8px] text-accent/30 font-normal">
                      {desc}
                    </span>
                  </button>
                ))}
              </div>
              {isExporting && exportProgress > 0 && (
                <div className="flex items-center gap-2 text-xs text-accent/50">
                  <Loader2 size={12} className="animate-spin" />
                  Creating GIF {exportProgress}%
                </div>
              )}
            </div>
          </div>
        </div>

        {/* More Export Options */}
        {onNavigate && (
          <button
            onClick={() => onNavigate("share")}
            className="w-full py-3 rounded-lg bg-secondary/10 text-secondary border border-secondary/20 font-headline font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-secondary/20 active:scale-95 transition-all"
          >
            <Share2 size={16} />
            More Export Options
          </button>
        )}

        {/* Recent Exports */}
        <div className="bg-surface-container rounded-lg p-6">
          <h3 className="font-headline text-accent text-lg font-bold mb-4 uppercase tracking-widest flex items-center gap-2">
            <Layers size={18} className="text-primary" />
            HISTORY
          </h3>
          <div className="space-y-4">
            {exportHistory.length > 0 ? (
              exportHistory.map((item) => (
                <div key={item.id} className="flex items-center gap-3 group">
                  <div className="w-12 h-12 bg-surface-container-highest rounded-lg overflow-hidden border border-outline/10 flex items-center justify-center">
                    {item.type === "pdf" ? (
                      <Share2 size={20} className="text-secondary" />
                    ) : (
                      <ImageIcon size={20} className="text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate text-accent">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-accent/50 uppercase">
                      {item.date} • {item.size}
                    </p>
                  </div>
                  <a
                    href={item.data}
                    download={item.name}
                    className="p-2 rounded-full hover:bg-primary/10 text-accent/50 hover:text-primary transition-colors"
                  >
                    <Download size={16} />
                  </a>
                </div>
              ))
            ) : (
              <div className="py-4 text-center text-accent/20 italic text-xs">
                No recent exports
              </div>
            )}
          </div>
        </div>
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
                {...(!isExporting ? bindComicPinch() : {})}
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
                    <div className="w-full h-full flex items-center justify-center bg-surface-container text-accent/20">
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
                  <span className="text-accent/20">
                    {" "}
                    (step size in Settings)
                  </span>
                </p>
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
