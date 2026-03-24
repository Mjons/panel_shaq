import React from "react";
import type { GifPanelConfig, GifPreset } from "../types/gif";
import {
  totalDuration,
  estimateFileSize,
  formatBytes,
} from "../services/gifAnimationService";

const MOVEMENT_LABELS: Record<string, string> = {
  hold: "Hold",
  "pan-lr": "Pan \u2192",
  "pan-rl": "\u2190 Pan",
  "pan-ud": "Pan \u2193",
  "zoom-in": "Zoom In",
  "zoom-out": "Zoom Out",
  "fade-in": "Fade In",
  "fade-out": "Fade Out",
};

const PRESET_OPTIONS: { id: GifPreset; label: string }[] = [
  { id: "story-flow", label: "Story Flow" },
  { id: "cinematic", label: "Cinematic" },
  { id: "dramatic", label: "Dramatic" },
  { id: "slideshow", label: "Slideshow" },
  { id: "custom", label: "Custom" },
];

interface GifTimelineProps {
  panels: GifPanelConfig[];
  selectedIndex: number | null;
  onSelectPanel: (index: number) => void;
  activePreset: GifPreset;
  onPresetChange: (preset: GifPreset) => void;
  fps: number;
  width: number;
  height: number;
}

export const GifTimeline: React.FC<GifTimelineProps> = ({
  panels,
  selectedIndex,
  onSelectPanel,
  activePreset,
  onPresetChange,
  fps,
  width,
  height,
}) => {
  const activePanels = panels.filter((p) => !p.skip);
  const duration = totalDuration(panels);
  const frameCount = activePanels.reduce(
    (sum, p) => sum + Math.round(p.duration * fps),
    0,
  );
  const estSize = formatBytes(
    estimateFileSize({ panels, width, height, fps, loop: true }),
  );

  return (
    <div className="bg-surface-container rounded-xl p-4 space-y-3">
      {/* Presets */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {PRESET_OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onPresetChange(id)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-headline font-bold uppercase tracking-wider transition-all active:scale-95 ${
              activePreset === id
                ? "bg-primary text-background"
                : "bg-accent/5 text-accent/50 border border-accent/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Timeline strip */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {panels.map((panel, i) => (
          <button
            key={panel.panelId}
            onClick={() => onSelectPanel(i)}
            className={`shrink-0 flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all active:scale-95 ${
              panel.skip ? "opacity-30" : ""
            } ${
              selectedIndex === i
                ? "bg-primary/20 ring-1 ring-primary"
                : "bg-surface hover:bg-surface/80"
            }`}
          >
            {/* Thumbnail */}
            <div className="w-14 h-14 rounded-md overflow-hidden bg-background">
              <img
                src={panel.imageData}
                alt={`Panel ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
            {/* Labels */}
            <span className="text-[9px] font-headline font-bold text-accent/70">
              {MOVEMENT_LABELS[panel.movement] || panel.movement}
            </span>
            <span className="text-[8px] text-accent/40">
              {panel.duration.toFixed(1)}s
            </span>
            <span className="text-[8px] text-accent/30">
              {panel.transitionOut === "cut"
                ? "\u2500cut\u2500"
                : panel.transitionOut}
            </span>
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-[10px] text-accent/40 font-headline">
        <span>
          Total: <span className="text-accent/60">{duration.toFixed(1)}s</span>
        </span>
        <span>
          Frames: <span className="text-accent/60">{frameCount}</span>
        </span>
        <span>
          ~<span className="text-accent/60">{estSize}</span>
        </span>
      </div>
    </div>
  );
};
