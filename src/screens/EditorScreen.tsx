import React, { useState, useRef, useEffect, useCallback } from "react";
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
} from "lucide-react";
import {
  PanelPrompt,
  finalNaturalRender,
  Bubble,
} from "../services/geminiService";
import { Page, getTemplate } from "./LayoutScreen";
import { toPng, toJpeg } from "html-to-image";
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
  onSelect: (id: string) => void;
  onTransform: (id: string, t: { x: number; y: number; scale: number }) => void;
}> = ({ panel, idx, isSelected, isExporting, onSelect, onTransform }) => {
  const initial = panel.imageTransform || { x: 0, y: 0, scale: 1 };
  const imgRef = useRef<HTMLImageElement>(null);
  const tRef = useRef({ ...initial });

  // Sync ref when props change (e.g. slider adjustment)
  useEffect(() => {
    tRef.current = { ...initial };
  }, [initial.x, initial.y, initial.scale]);

  const applyTransform = () => {
    if (!imgRef.current) return;
    const { scale, x, y } = tRef.current;
    imgRef.current.style.transform = `scale(${scale}) translate(${x}px, ${y}px)`;
  };

  const bind = useGesture(
    {
      onDrag: ({ delta: [dx, dy], tap, event, last }) => {
        if (isExporting) return;
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
      onPinch: ({ offset: [s], event, last }) => {
        if (isExporting) return;
        event?.preventDefault();
        tRef.current.scale = Math.min(4.2, Math.max(0.5, s));
        applyTransform();
        if (last) onTransform(panel.id, { ...tRef.current });
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

  return (
    <div
      {...(!isExporting ? bind() : {})}
      className="w-full h-full relative overflow-hidden touch-none"
    >
      <img
        ref={imgRef}
        alt={`Panel ${idx + 1}`}
        className={`w-full h-full object-contain select-none will-change-transform ${isSelected ? "opacity-100" : "opacity-90 hover:opacity-100"}`}
        src={panel.image}
        draggable={false}
        style={{
          transform: `scale(${initial.scale}) translate(${initial.x}px, ${initial.y}px)`,
          transformOrigin: "center",
        }}
      />
    </div>
  );
};

/* ── Draggable Bubble with floating toolbar ── */
const DraggableBubble: React.FC<{
  bubble: Bubble;
  isSelected: boolean;
  isExporting: boolean;
  onSelect: () => void;
  onMove: (pos: { x: number; y: number }) => void;
  onUpdateBubble: (updates: Partial<Bubble>) => void;
  onRemove: () => void;
}> = ({
  bubble,
  isSelected,
  isExporting,
  onSelect,
  onMove,
  onUpdateBubble,
  onRemove,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  const bindDrag = useDrag(
    ({ delta: [dx, dy], tap, last }) => {
      if (isExporting) return;
      if (tap) {
        onSelect();
        setIsEditing(true);
        return;
      }
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const pctX = (dx / rect.width) * 100;
      const pctY = (dy / rect.height) * 100;
      const newX = Math.max(5, Math.min(95, bubble.pos.x + pctX));
      const newY = Math.max(5, Math.min(95, bubble.pos.y + pctY));
      if (last) onMove({ x: Math.round(newX), y: Math.round(newY) });
    },
    { filterTaps: true, pointer: { touch: true } },
  );

  const isSFX = bubble.style === "effect" || bubble.style === "action";

  return (
    <>
      <div
        ref={containerRef}
        {...(!isExporting ? bindDrag() : {})}
        className={`absolute z-20 touch-none cursor-grab active:cursor-grabbing ${
          isSelected && !isExporting
            ? "ring-2 ring-primary ring-offset-2 ring-offset-transparent"
            : ""
        } ${isSFX ? "" : "p-2 bg-white border-2 border-background shadow-xl max-w-[100px]"}`}
        style={{
          left: `${bubble.pos.x}%`,
          top: `${bubble.pos.y}%`,
          transform: "translate(-50%, -50%)",
          ...(isSFX
            ? {}
            : {
                borderRadius: bubble.style === "thought" ? "40%" : "9999px",
                borderStyle: bubble.style === "thought" ? "dashed" : "solid",
              }),
          fontSize: `${bubble.fontSize}px`,
          fontWeight: bubble.fontWeight,
          fontStyle: bubble.fontStyle,
        }}
      >
        {isSFX ? (
          <p
            className="leading-tight uppercase font-headline text-center font-black"
            style={{
              color: "#FFD600",
              textShadow:
                "2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
              transform: "rotate(-3deg)",
              fontSize: `${bubble.fontSize + 4}px`,
            }}
          >
            {bubble.text}
          </p>
        ) : (
          <p className="leading-tight uppercase font-headline text-center text-background">
            {bubble.text}
          </p>
        )}
        {bubble.style === "speech" && bubble.tailPos && (
          <div
            className="absolute w-2 h-2 bg-white border-r-2 border-b-2 border-background rotate-45"
            style={{
              left: `${bubble.tailPos.x - bubble.pos.x + 50}%`,
              top: `${bubble.tailPos.y - bubble.pos.y + 50}%`,
              transform: "translate(-50%, -50%) rotate(45deg)",
            }}
          />
        )}
      </div>

      {/* Floating toolbar on tap */}
      {isSelected && isEditing && !isExporting && (
        <div
          className="absolute z-30 flex flex-col gap-2 bg-surface-container border border-outline/20 rounded-xl p-3 shadow-2xl w-[200px]"
          style={{
            left: `${Math.min(75, Math.max(25, bubble.pos.x))}%`,
            top: `${Math.max(0, bubble.pos.y - 5)}%`,
            transform: "translate(-50%, -105%)",
          }}
        >
          {/* Type pills */}
          <div className="flex gap-1">
            {[
              { label: "Speech", value: "speech" as const },
              { label: "Thought", value: "thought" as const },
              { label: "SFX", value: "effect" as const },
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => onUpdateBubble({ style: t.value })}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                  bubble.style === t.value
                    ? "bg-primary text-background"
                    : "bg-background text-accent/50 border border-outline/20"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

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
                onUpdateBubble({ fontSize: Math.min(24, bubble.fontSize + 2) })
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
              onClick={() => setIsEditing(false)}
              className="w-7 h-7 flex items-center justify-center bg-background border border-outline/20 rounded text-accent/40 text-[10px] font-bold"
            >
              ✓
            </button>
          </div>
        </div>
      )}
    </>
  );
};

interface EditorProps {
  panels: PanelPrompt[];
  pages: Page[];
  setPanels: React.Dispatch<React.SetStateAction<PanelPrompt[]>>;
}

export const EditorScreen: React.FC<EditorProps> = ({
  panels,
  pages,
  setPanels,
}) => {
  const [selectedPageIdx, setSelectedPageIdx] = useState(0);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [shouldCancelExport, setShouldCancelExport] = useState(false);
  // isFraming removed — selected panels automatically show overflow for transform
  const [exportProgress, setExportProgress] = useState(0);
  const comicRef = useRef<HTMLDivElement>(null);
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

  return (
    <main className="pt-24 pb-32 px-4 md:px-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Sidebar: Tools & Assets */}
      <aside className="lg:col-span-3 space-y-6">
        {/* Image Transform Tools */}
        <div className="bg-surface-container rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-primary text-lg font-bold flex items-center gap-2">
              <ZoomIn size={18} />
              PANEL TRANSFORM
            </h3>
            {selectedPanelId && (
              <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary">
                Active
              </span>
            )}
          </div>
          {selectedPanelId ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-label uppercase tracking-widest text-accent/50 flex justify-between">
                  Scale{" "}
                  <span>
                    {(
                      (selectedPanel?.imageTransform?.scale || 1) * 100
                    ).toFixed(0)}
                    %
                  </span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="4.2"
                  step="0.1"
                  value={selectedPanel?.imageTransform?.scale || 1}
                  onChange={(e) =>
                    updatePanel(selectedPanelId, {
                      imageTransform: {
                        ...(selectedPanel?.imageTransform || {
                          x: 0,
                          y: 0,
                          scale: 1,
                        }),
                        scale: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full accent-primary"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    updatePanel(selectedPanelId, {
                      imageTransform: { x: 0, y: 0, scale: 1 },
                    })
                  }
                  className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest text-accent/50 hover:text-primary border border-outline/10 rounded-lg transition-colors"
                >
                  Reset Transform
                </button>
                {selectedPanel?.image && (
                  <button
                    onClick={() => {
                      const link = document.createElement("a");
                      link.download = `panel-${panels.findIndex((p) => p.id === selectedPanelId) + 1}.png`;
                      link.href = selectedPanel.image!;
                      link.click();
                    }}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-accent/50 hover:text-primary border border-outline/10 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Download size={12} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-label uppercase tracking-widest text-accent/50">
                    Offset X
                  </label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={selectedPanel?.imageTransform?.x || 0}
                    onChange={(e) =>
                      updatePanel(selectedPanelId, {
                        imageTransform: {
                          ...(selectedPanel?.imageTransform || {
                            x: 0,
                            y: 0,
                            scale: 1,
                          }),
                          x: parseInt(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-label uppercase tracking-widest text-accent/50">
                    Offset Y
                  </label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={selectedPanel?.imageTransform?.y || 0}
                    onChange={(e) =>
                      updatePanel(selectedPanelId, {
                        imageTransform: {
                          ...(selectedPanel?.imageTransform || {
                            x: 0,
                            y: 0,
                            scale: 1,
                          }),
                          y: parseInt(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-accent/30 italic text-xs">
              Select a panel to transform
            </div>
          )}
        </div>

        <div className="bg-surface-container rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-primary text-lg font-bold">
              INK TOOLS
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
            <div className="space-y-4">
              {/* Bubble List */}
              <div className="flex flex-wrap gap-2">
                {selectedPanel?.bubbles.map((b, idx) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBubbleId(b.id)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${selectedBubbleId === b.id ? "bg-primary border-primary text-background" : "bg-surface-container-highest border-outline/20 text-accent/50 hover:border-primary/50"}`}
                  >
                    Bubble {idx + 1}
                  </button>
                ))}
              </div>

              {selectedBubbleId && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-outline/10">
                  {(["speech", "thought", "action", "effect"] as const).map(
                    (style) => (
                      <button
                        key={style}
                        onClick={() =>
                          updateBubble(selectedBubbleId, { style })
                        }
                        className={`p-3 rounded-lg flex flex-col items-center justify-center gap-1 border transition-colors ${selectedBubble?.style === style ? "bg-primary/20 border-primary" : "bg-surface-container-highest border-outline/20 hover:bg-surface"}`}
                      >
                        {style === "action" ? (
                          <Zap size={18} className="text-primary" />
                        ) : style === "effect" ? (
                          <Paintbrush size={18} className="text-secondary" />
                        ) : (
                          <MessageSquare size={18} className="text-secondary" />
                        )}
                        <span className="text-[9px] font-label uppercase tracking-widest text-accent/50">
                          {style}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-center text-accent/30 italic text-xs">
              Select a panel first
            </div>
          )}
        </div>

        <div className="bg-surface-container rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-accent text-lg font-bold">
              EDIT BUBBLE
            </h3>
            {selectedBubbleId && (
              <button
                onClick={() => removeBubble(selectedBubbleId)}
                className="text-accent/30 hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          {selectedBubbleId ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-label uppercase tracking-widest text-accent/50">
                  Dialog Text
                </label>
                <textarea
                  className="w-full bg-background border-outline/20 border rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none min-h-[80px] text-accent resize-none font-headline"
                  placeholder="Type character dialogue here..."
                  value={selectedBubble?.text || ""}
                  onChange={(e) =>
                    updateBubble(selectedBubbleId, { text: e.target.value })
                  }
                />
              </div>

              {/* Text Formatting */}
              <div className="space-y-2">
                <label className="text-[10px] font-label uppercase tracking-widest text-accent/50">
                  Formatting
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      updateBubble(selectedBubbleId, {
                        fontWeight:
                          selectedBubble?.fontWeight === "bold"
                            ? "normal"
                            : "bold",
                      })
                    }
                    className={`p-2 rounded border transition-colors ${selectedBubble?.fontWeight === "bold" ? "bg-primary/20 border-primary text-primary" : "bg-background border-outline/20 text-accent/50"}`}
                  >
                    <Bold size={14} />
                  </button>
                  <button
                    onClick={() =>
                      updateBubble(selectedBubbleId, {
                        fontStyle:
                          selectedBubble?.fontStyle === "italic"
                            ? "normal"
                            : "italic",
                      })
                    }
                    className={`p-2 rounded border transition-colors ${selectedBubble?.fontStyle === "italic" ? "bg-primary/20 border-primary text-primary" : "bg-background border-outline/20 text-accent/50"}`}
                  >
                    <Italic size={14} />
                  </button>
                  <div className="flex-1 flex items-center gap-2 bg-background border border-outline/20 rounded px-2">
                    <TypeIcon size={14} className="text-accent/50" />
                    <input
                      type="number"
                      min="8"
                      max="24"
                      value={selectedBubble?.fontSize || 12}
                      onChange={(e) =>
                        updateBubble(selectedBubbleId, {
                          fontSize: parseInt(e.target.value),
                        })
                      }
                      className="w-full bg-transparent text-xs text-accent outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-label uppercase tracking-widest text-accent/50">
                  Bubble Position
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[8px] text-accent/30 uppercase">
                      X: {selectedBubble?.pos.x}%
                    </span>
                    <input
                      className="accent-primary w-full"
                      type="range"
                      min="0"
                      max="100"
                      value={selectedBubble?.pos.x || 50}
                      onChange={(e) =>
                        updateBubble(selectedBubbleId, {
                          pos: {
                            ...(selectedBubble?.pos || { x: 50, y: 50 }),
                            x: parseInt(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[8px] text-accent/30 uppercase">
                      Y: {selectedBubble?.pos.y}%
                    </span>
                    <input
                      className="accent-primary w-full"
                      type="range"
                      min="0"
                      max="100"
                      value={selectedBubble?.pos.y || 50}
                      onChange={(e) =>
                        updateBubble(selectedBubbleId, {
                          pos: {
                            ...(selectedBubble?.pos || { x: 50, y: 50 }),
                            y: parseInt(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-label uppercase tracking-widest text-accent/50">
                  Tail Direction
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[8px] text-accent/30 uppercase">
                      X: {selectedBubble?.tailPos?.x}%
                    </span>
                    <input
                      className="accent-primary w-full"
                      type="range"
                      min="0"
                      max="100"
                      value={selectedBubble?.tailPos?.x || 50}
                      onChange={(e) =>
                        updateBubble(selectedBubbleId, {
                          tailPos: {
                            ...(selectedBubble?.tailPos || { x: 50, y: 60 }),
                            x: parseInt(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[8px] text-accent/30 uppercase">
                      Y: {selectedBubble?.tailPos?.y}%
                    </span>
                    <input
                      className="accent-primary w-full"
                      type="range"
                      min="0"
                      max="100"
                      value={selectedBubble?.tailPos?.y || 60}
                      onChange={(e) =>
                        updateBubble(selectedBubbleId, {
                          tailPos: {
                            ...(selectedBubble?.tailPos || { x: 50, y: 60 }),
                            y: parseInt(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-accent/30 italic text-xs">
              Select a bubble to edit
            </div>
          )}
        </div>
      </aside>

      {/* Center: Comic Canvas */}
      <section className="lg:col-span-6 space-y-6">
        <div className="flex items-center justify-between bg-surface-container p-4 rounded-lg border border-outline/10">
          <button
            disabled={selectedPageIdx === 0}
            onClick={() => setSelectedPageIdx((prev) => prev - 1)}
            className="p-2 rounded-full hover:bg-background disabled:opacity-20 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-headline font-bold text-accent">
            PAGE {selectedPageIdx + 1} OF {pages.length}
          </span>
          <button
            disabled={selectedPageIdx === pages.length - 1}
            onClick={() => setSelectedPageIdx((prev) => prev + 1)}
            className="p-2 rounded-full hover:bg-background disabled:opacity-20 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="aspect-[3/4] relative">
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
              className={`w-full h-full bg-background relative overflow-hidden ${isExporting ? "pointer-events-none" : ""}`}
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
                        onClick={() => setSelectedPanelId(pid)}
                        className={`bg-black relative cursor-pointer transition-all overflow-hidden ${isExporting ? "" : selectedPanelId === pid ? "ring-2 ring-primary ring-inset" : ""}`}
                        style={
                          slot
                            ? {
                                gridColumn: `${slot.colStart} / ${slot.colEnd}`,
                                gridRow: `${slot.rowStart} / ${slot.rowEnd}`,
                              }
                            : undefined
                        }
                      >
                        {panel.image ? (
                          <PanelImage
                            panel={panel}
                            idx={idx}
                            isSelected={selectedPanelId === pid}
                            isExporting={isExporting}
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
                            onMove={(pos) => {
                              if (selectedPanelId !== pid)
                                setSelectedPanelId(pid);
                              updateBubble(bubble.id, { pos });
                            }}
                            onUpdateBubble={(updates) =>
                              updateBubble(bubble.id, updates)
                            }
                            onRemove={() => removeBubble(bubble.id)}
                          />
                        ))}

                        {/* Dim non-selected panels when one is selected */}
                        {selectedPanelId &&
                          selectedPanelId !== pid &&
                          !isExporting && (
                            <div className="absolute inset-0 bg-black/30 z-10 pointer-events-none" />
                          )}
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
        <div className="bg-surface-container rounded-lg p-6 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 text-primary/5 halftone-bg -mr-16 -mt-16 rotate-12"></div>
          <h3 className="font-headline text-accent text-lg font-bold">
            FINISH LINE
          </h3>
          <div className="space-y-4 relative z-10">
            <button
              onClick={handleFinalRender}
              disabled={!selectedPanelId || isRendering}
              className="w-full py-4 rounded-lg bg-primary text-background font-headline font-bold flex flex-col items-center justify-center gap-1 shadow-[0_4px_14px_rgba(255,145,0,0.39)] active:scale-95 transition-transform disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                {isRendering ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Wand2 size={20} />
                )}
                <span>Final Natural Render</span>
              </div>
              <span className="text-[8px] opacity-70 uppercase tracking-widest">
                Bake dialogue into scene
              </span>
            </button>

            <div className="space-y-2">
              <p className="text-[10px] font-label uppercase tracking-widest text-accent/50">
                Export PDF
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleExportPDF(false)}
                  disabled={isExporting}
                  className="py-3 rounded-lg bg-secondary/20 text-secondary border border-secondary/30 font-headline font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
                >
                  {isExporting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  PAGE
                </button>
                <button
                  onClick={() => handleExportPDF(true)}
                  disabled={isExporting}
                  className="py-3 rounded-lg bg-secondary text-background font-headline font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
                >
                  {isExporting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Share2 size={14} />
                  )}
                  FULL
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-label uppercase tracking-widest text-accent/50">
                Export PNG
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleExportPNG(false)}
                  disabled={isExporting}
                  className="py-3 rounded-lg bg-primary/10 text-primary border border-primary/20 font-headline font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
                >
                  {isExporting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ImageIcon size={14} />
                  )}
                  PAGE
                </button>
                <button
                  onClick={() => handleExportPNG(true)}
                  disabled={isExporting}
                  className="py-3 rounded-lg bg-primary text-background font-headline font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
                >
                  {isExporting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Layers size={14} />
                  )}
                  FULL
                </button>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-outline/10">
            <h4 className="text-[10px] font-label uppercase tracking-widest text-accent/50 mb-4">
              Export Settings
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                <span className="text-xs text-accent">Format</span>
                <span className="text-xs font-bold text-primary">PDF (HQ)</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                <span className="text-xs text-accent">Resolution</span>
                <span className="text-xs font-bold text-primary">300 DPI</span>
              </div>
            </div>
          </div>
        </div>

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
    </main>
  );
};
