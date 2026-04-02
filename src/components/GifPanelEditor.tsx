import React from "react";
import type { GifPanelConfig, GifMovement } from "../types/gif";

const MOVEMENTS: { id: GifMovement; label: string }[] = [
  { id: "hold", label: "Hold" },
  { id: "pan-lr", label: "Pan \u2192" },
  { id: "pan-rl", label: "\u2190 Pan" },
  { id: "pan-ud", label: "Pan \u2193" },
  { id: "zoom-in", label: "Zoom In" },
  { id: "zoom-out", label: "Zoom Out" },
  { id: "fade-in", label: "Fade In" },
  { id: "fade-out", label: "Fade Out" },
];

interface GifPanelEditorProps {
  panel: GifPanelConfig;
  index: number;
  onChange: (updated: GifPanelConfig) => void;
}

export const GifPanelEditor: React.FC<GifPanelEditorProps> = ({
  panel,
  index,
  onChange,
}) => {
  const update = (partial: Partial<GifPanelConfig>) =>
    onChange({ ...panel, ...partial });

  const showZoom =
    panel.movement === "zoom-in" || panel.movement === "zoom-out";

  return (
    <div className="bg-surface-container rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-headline font-bold text-accent text-sm uppercase tracking-widest">
          Panel {index + 1}
        </h2>
        <label className="flex items-center gap-2 text-[10px] text-accent/50 cursor-pointer">
          <input
            type="checkbox"
            checked={panel.skip || false}
            onChange={(e) => update({ skip: e.target.checked })}
            className="accent-primary"
          />
          Skip
        </label>
      </div>

      {/* Thumbnail */}
      <div className="w-full h-24 rounded-lg overflow-hidden bg-background">
        <img
          src={panel.imageData}
          alt={`Panel ${index + 1}`}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Movement */}
      <div className="space-y-1.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-accent/40">
          Movement
        </p>
        <div className="grid grid-cols-4 gap-1">
          {MOVEMENTS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => update({ movement: id })}
              className={`py-1.5 px-1 rounded-md text-[9px] font-headline font-bold transition-all active:scale-95 ${
                panel.movement === id
                  ? "bg-primary text-background"
                  : "bg-accent/5 text-accent/50 border border-accent/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-bold uppercase tracking-widest text-accent/40">
            Duration
          </p>
          <span className="text-xs text-accent/60 font-headline font-bold">
            {panel.duration.toFixed(1)}s
          </span>
        </div>
        <input
          type="range"
          min={0.3}
          max={5.0}
          step={0.1}
          value={panel.duration}
          onChange={(e) => update({ duration: parseFloat(e.target.value) })}
          className="w-full accent-primary"
        />
      </div>

      {/* Zoom amount (only for zoom movements) */}
      {showZoom && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase tracking-widest text-accent/40">
              Zoom Amount
            </p>
            <span className="text-xs text-accent/60 font-headline font-bold">
              {(panel.zoomAmount || 1.4).toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min={1.1}
            max={2.0}
            step={0.1}
            value={panel.zoomAmount || 1.4}
            onChange={(e) => update({ zoomAmount: parseFloat(e.target.value) })}
            className="w-full accent-primary"
          />
        </div>
      )}
    </div>
  );
};
