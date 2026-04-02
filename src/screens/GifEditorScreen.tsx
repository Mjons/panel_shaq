import React, { useState, useMemo, useCallback } from "react";
import { ArrowLeft, Download, Share2, Loader2, Film } from "lucide-react";
import type { GifPanelConfig, GifPreset } from "../types/gif";
import { defaultPanelConfig, applyPreset } from "../types/gif";
import { GifTimeline } from "../components/GifTimeline";
import { GifPanelEditor } from "../components/GifPanelEditor";
import { GifPreview } from "../components/GifPreview";
import { generateFrames } from "../services/gifAnimationService";
import { encode as encodeGif } from "modern-gif";

interface GifEditorProps {
  /** Panel images as base64 strings (with bubbles baked in) */
  panelImages: { id: string; imageData: string }[];
  onBack: () => void;
  pageFormat?: string;
}

const FORMAT_RATIOS: Record<string, [number, number]> = {
  portrait: [3, 4],
  square: [1, 1],
  webtoon: [9, 20],
};

export const GifEditorScreen: React.FC<GifEditorProps> = ({
  panelImages,
  onBack,
  pageFormat = "portrait",
}) => {
  const ratio = FORMAT_RATIOS[pageFormat] || FORMAT_RATIOS.portrait;
  const gifWidth = 480;
  const gifHeight = Math.round(gifWidth * (ratio[1] / ratio[0]));

  // Build initial panel configs from images
  const initialPanels = useMemo(
    () =>
      panelImages.map((p, i) => {
        // Estimate aspect ratio from image (default to 1 if unknown)
        const img = new Image();
        img.src = p.imageData;
        const ar =
          img.naturalWidth && img.naturalHeight
            ? img.naturalWidth / img.naturalHeight
            : 1;
        return defaultPanelConfig(p.id, p.imageData, ar, i, panelImages.length);
      }),
    [panelImages],
  );

  const [panels, setPanels] = useState<GifPanelConfig[]>(initialPanels);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activePreset, setActivePreset] = useState<GifPreset>("story-flow");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);

  const fps = 10;

  const handleActivePanelChange = useCallback((idx: number) => {
    // Optionally highlight the active panel in timeline during playback
    // Keeping it light — not selecting on every frame to avoid re-renders
  }, []);

  const handleGenerate = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportProgress(0);
    setExportedBlob(null);

    try {
      const project = {
        panels,
        width: gifWidth,
        height: gifHeight,
        fps,
        loop: true,
      };
      const frames = await generateFrames(project, (pct) =>
        setExportProgress(Math.round(pct * 85)),
      );

      if (frames.length === 0) {
        alert(
          "No frames to export. Make sure at least one panel is not skipped.",
        );
        return;
      }

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
      setExportedBlob(blob);
    } catch (error: any) {
      console.error("GIF export failed:", error);
      alert(`GIF export failed: ${error?.message || error}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (!exportedBlob) return;
    const url = URL.createObjectURL(exportedBlob);
    const link = document.createElement("a");
    link.download = "Comic_GifEditor.gif";
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (!exportedBlob) return;
    const file = new File([exportedBlob], "Comic_GifEditor.gif", {
      type: "image/gif",
    });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: "My Comic GIF",
        text: "Made with Panelhaus",
        files: [file],
      });
    } else {
      handleDownload();
    }
  };

  // Re-generate needed when panels change
  const handlePanelChangeAndInvalidate = useCallback(
    (updated: GifPanelConfig) => {
      setPanels((prev) =>
        prev.map((p) => (p.panelId === updated.panelId ? updated : p)),
      );
      setActivePreset("custom");
      setExportedBlob(null);
    },
    [],
  );

  const handlePresetChangeAndInvalidate = useCallback((preset: GifPreset) => {
    setActivePreset(preset);
    if (preset !== "custom") {
      setPanels((prev) => applyPreset(prev, preset));
    }
    setExportedBlob(null);
  }, []);

  const selectedPanel = selectedIndex !== null ? panels[selectedIndex] : null;

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div
        className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-outline/10"
        style={{ paddingTop: "var(--sat)" }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-accent/70 hover:text-accent active:scale-95 transition-all"
          >
            <ArrowLeft size={18} />
            <span className="text-xs font-headline font-bold uppercase tracking-wider">
              Editor
            </span>
          </button>

          <h2 className="font-headline font-bold text-accent text-sm uppercase tracking-widest flex items-center gap-2">
            <Film size={16} className="text-primary" />
            GIF Editor
          </h2>

          <div className="flex items-center gap-1.5">
            {exportedBlob ? (
              <>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-background font-headline font-bold text-xs uppercase tracking-wider active:scale-95 transition-all"
                >
                  <Download size={14} />
                  Save
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-accent/10 text-accent/70 font-headline font-bold text-xs active:scale-95 transition-all"
                >
                  <Share2 size={14} />
                </button>
              </>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-background font-headline font-bold text-xs uppercase tracking-wider active:scale-95 transition-all disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {exportProgress}%
                  </>
                ) : (
                  <>
                    <Film size={14} />
                    Create GIF
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-4 py-4 space-y-4">
        {/* Preview */}
        <GifPreview
          panels={panels}
          width={gifWidth}
          height={gifHeight}
          onActivePanelChange={handleActivePanelChange}
        />

        {/* Timeline */}
        <GifTimeline
          panels={panels}
          selectedIndex={selectedIndex}
          onSelectPanel={setSelectedIndex}
          activePreset={activePreset}
          onPresetChange={handlePresetChangeAndInvalidate}
          fps={fps}
          width={gifWidth}
          height={gifHeight}
        />

        {/* Panel Editor */}
        {selectedPanel && selectedIndex !== null && (
          <GifPanelEditor
            panel={selectedPanel}
            index={selectedIndex}
            onChange={handlePanelChangeAndInvalidate}
          />
        )}
      </div>
    </div>
  );
};
