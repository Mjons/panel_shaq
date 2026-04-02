import React, { useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, RefreshCw, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useDrag } from "@use-gesture/react";
import type { PanelPrompt } from "../services/geminiService";

interface PreviewCarouselProps {
  panels: PanelPrompt[];
  initialIndex: number;
  onUpdatePanel: (panel: PanelPrompt) => void;
  onRegenerate: (panelId: string) => void;
  onClose: () => void;
  generatingId?: string | null;
}

export const PreviewCarousel: React.FC<PreviewCarouselProps> = ({
  panels,
  initialIndex,
  onUpdatePanel,
  onRegenerate,
  onClose,
  generatingId,
}) => {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);
  const panel = panels[index];

  const go = useCallback(
    (dir: number) => {
      const next = index + dir;
      if (next < 0 || next >= panels.length) return;
      setDirection(dir);
      setIndex(next);
    },
    [index, panels.length],
  );

  const bindSwipe = useDrag(
    ({ swipe: [sx], tap }) => {
      if (tap) return;
      if (sx === -1) go(1);
      if (sx === 1) go(-1);
    },
    {
      axis: "x",
      filterTaps: true,
      swipe: { distance: 30, velocity: 0.3 },
    },
  );

  const handleNotesChange = (notes: string) => {
    onUpdatePanel({ ...panel, notes });
  };

  const isGenerating = generatingId === panel?.id;

  if (!panel) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0B1326]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-primary font-headline font-bold text-lg">
            Panel {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-accent/30 text-xs">of {panels.length}</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <X size={24} className="text-accent/60" />
        </button>
      </div>

      {/* Image area */}
      <div
        className="flex-1 relative overflow-hidden flex items-center justify-center px-4"
        {...bindSwipe()}
        style={{ touchAction: "pan-y" }}
      >
        {/* Nav arrows */}
        {index > 0 && (
          <button
            onClick={() => go(-1)}
            className="absolute left-4 z-10 p-3 bg-black/40 hover:bg-black/60 rounded-full transition-colors backdrop-blur-sm"
            aria-label="Previous panel"
          >
            <ChevronLeft size={24} className="text-white" />
          </button>
        )}
        {index < panels.length - 1 && (
          <button
            onClick={() => go(1)}
            className="absolute right-4 z-10 p-3 bg-black/40 hover:bg-black/60 rounded-full transition-colors backdrop-blur-sm"
            aria-label="Next panel"
          >
            <ChevronRight size={24} className="text-white" />
          </button>
        )}

        <AnimatePresence mode="popLayout" custom={direction}>
          <motion.div
            key={panel.id}
            custom={direction}
            initial={{ x: direction > 0 ? 300 : -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction > 0 ? -300 : 300, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full max-w-3xl mx-auto"
          >
            {panel.image ? (
              <img
                src={panel.image}
                alt={`Panel ${index + 1}`}
                className="w-full h-auto max-h-[50vh] object-contain rounded-xl"
                draggable={false}
              />
            ) : (
              <div className="w-full aspect-video bg-surface-container rounded-xl flex items-center justify-center border border-outline/20">
                <span className="text-accent/30 text-sm font-bold uppercase tracking-widest">
                  Not Generated
                </span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div
        className="shrink-0 px-6 pt-3 max-w-3xl mx-auto w-full space-y-3 -mt-6"
        style={{ paddingBottom: "calc(5rem + var(--sab, 0px))" }}
      >
        {/* Description summary */}
        <p className="text-accent/50 text-xs line-clamp-2 leading-relaxed">
          {panel.description}
        </p>

        {/* Notes textarea */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent/40">
            Regeneration Notes
          </label>
          <textarea
            value={panel.notes || ""}
            onChange={(e) => handleNotesChange(e.target.value)}
            className="w-full bg-surface-container border border-outline/20 rounded-lg px-4 py-3 text-sm text-accent focus:border-primary outline-none transition-colors resize-none h-20 placeholder:text-accent/20"
            placeholder="e.g. make the sky darker, add more detail to the background, zoom in on the character..."
          />
        </div>

        {/* Regenerate button */}
        <button
          onClick={() => onRegenerate(panel.id)}
          disabled={isGenerating}
          className="w-full py-3 bg-primary text-background font-bold uppercase tracking-widest rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw size={18} />
              {panel.image ? "Regenerate" : "Generate"}
            </>
          )}
        </button>

        {/* Dot indicators */}
        <div className="flex justify-center gap-1.5 pt-1">
          {panels.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > index ? 1 : -1);
                setIndex(i);
              }}
              aria-label={`Go to panel ${i + 1}`}
              className={`w-2 h-2 rounded-full transition-all ${
                i === index
                  ? "bg-primary scale-125"
                  : panels[i].image
                    ? "bg-accent/30 hover:bg-accent/50"
                    : "bg-accent/10 hover:bg-accent/20"
              }`}
            />
          ))}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full py-3 border border-accent/20 text-accent/50 font-bold uppercase tracking-widest rounded-xl hover:bg-white/5 hover:text-accent/70 transition-all text-sm flex items-center justify-center gap-2"
        >
          <X size={16} />
          Close Preview
        </button>
      </div>
    </div>
  );
};
