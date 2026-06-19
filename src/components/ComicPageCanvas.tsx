import React, { useRef, useEffect, useState } from "react";
import { useGesture } from "@use-gesture/react";
import { Image as ImageIcon, Lock, Unlock, Plus, Trash2 } from "lucide-react";
import { PanelPrompt, Bubble } from "../services/geminiService";
import { Page, getTemplate } from "../screens/LayoutScreen";
import {
  getCachedBorderPath,
  borderPathToSVG,
  hasActiveBorderStyle,
} from "../utils/borderStyles";
import { Tip } from "./Tip";
import { InkCost } from "./InkCost";

/* ── Gesture-enabled panel image ── */
/* ── Gesture-enabled panel image ──
   Applies transforms directly to the DOM during gestures for 60fps,
   only commits to React state on gesture end. */
export const PanelImage: React.FC<{
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
export const PanelBorderWrapper: React.FC<{
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
export const DraggableBubble: React.FC<{
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
              {!isRendering && <InkCost kind="image" outlined />}
            </button>
          )}
        </div>
      )}
    </>
  );
};

/* ── Presentational comic page ──
   Extracted verbatim from EditorScreen's comicRef subtree (Phase 1 of the
   export-renderer-extraction plan). Interaction is driven by the props below;
   a future "forExport" mode will make them optional so this can render
   offscreen on the Export tab. Behavior here is identical to the Editor. */
interface ComicPageCanvasProps {
  currentPage: Page | undefined;
  panels: PanelPrompt[];
  pageBackgroundColor: string;
  isExporting: boolean;
  // Everything below is interaction state. Omit it all (and pass
  // isExporting) to render a clean, non-interactive page for offscreen
  // export — the defaults below are inert no-ops.
  gifVisibleCount?: number | null;
  selectedPanelId?: string | null;
  selectedBubbleId?: string | null;
  lockedPanelIds?: Set<string>;
  rotationStep?: number;
  isRendering?: boolean;
  bindComicPinch?: (...args: any[]) => any;
  setSelectedPanelId?: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedBubbleId?: React.Dispatch<React.SetStateAction<string | null>>;
  setIsBubbleEditing?: React.Dispatch<React.SetStateAction<boolean>>;
  setFullscreenPanelId?: React.Dispatch<React.SetStateAction<string | null>>;
  setLockedPanelIds?: React.Dispatch<React.SetStateAction<Set<string>>>;
  updatePanel?: (id: string, updates: Partial<PanelPrompt>) => void;
  updateBubble?: (bubbleId: string, updates: Partial<Bubble>) => void;
  removeBubble?: (bubbleId: string) => void;
  addBubble?: () => void;
  handleFinalRender?: () => void;
  lastTapRef?: React.MutableRefObject<{ id: string; time: number } | null>;
}

const NOOP = () => {};
const NOOP_BIND = () => ({});
const EMPTY_LOCKED: Set<string> = new Set();
const DUMMY_TAP_REF: React.MutableRefObject<{
  id: string;
  time: number;
} | null> = { current: null };

export const ComicPageCanvas: React.FC<ComicPageCanvasProps> = ({
  currentPage,
  panels,
  pageBackgroundColor,
  isExporting,
  gifVisibleCount = null,
  selectedPanelId = null,
  selectedBubbleId = null,
  lockedPanelIds = EMPTY_LOCKED,
  rotationStep = 10,
  isRendering = false,
  bindComicPinch = NOOP_BIND,
  setSelectedPanelId = NOOP,
  setSelectedBubbleId = NOOP,
  setIsBubbleEditing = NOOP,
  setFullscreenPanelId = NOOP,
  setLockedPanelIds = NOOP,
  updatePanel = NOOP,
  updateBubble = NOOP,
  removeBubble = NOOP,
  addBubble = NOOP,
  handleFinalRender = NOOP,
  lastTapRef = DUMMY_TAP_REF,
}) => {
  return (
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
                    (!!panel.borderColor && panel.borderColor !== "none")
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
                      locked={!!selectedBubbleId || lockedPanelIds.has(pid)}
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
                    <>
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
                        aria-label={
                          lockedPanelIds.has(pid)
                            ? "Unlock panel position"
                            : "Lock panel position"
                        }
                      >
                        {lockedPanelIds.has(pid) ? (
                          <Lock size={12} className="text-primary" />
                        ) : (
                          <Unlock size={12} className="text-accent/40" />
                        )}
                      </button>
                      {idx === 0 && (
                        <div className="absolute top-8 left-1.5 z-10">
                          <Tip
                            id="panel-lock"
                            text="Lock a panel to freeze its position and zoom — handy when you've got it framed just right and don't want to bump it. Bubbles on top still move freely."
                            mode="coach"
                            position="bottom"
                            align="left"
                            pose="standing"
                          />
                        </div>
                      )}
                    </>
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
                        if (selectedPanelId !== pid) setSelectedPanelId(pid);
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
                        {(!panel.bubbles || panel.bubbles.length === 0) && (
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
        <div className="w-full h-full flex items-center justify-center text-accent/40 italic">
          No pages defined.
        </div>
      )}
    </div>
  );
};
