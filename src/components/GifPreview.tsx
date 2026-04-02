import React, { useRef, useEffect, useState, useCallback } from "react";
import type { GifPanelConfig } from "../types/gif";
import {
  drawFrameAtTime,
  totalDuration,
} from "../services/gifAnimationService";
import { Play, Pause } from "lucide-react";

interface GifPreviewProps {
  panels: GifPanelConfig[];
  width: number;
  height: number;
  onActivePanelChange?: (index: number) => void;
}

export const GifPreview: React.FC<GifPreviewProps> = ({
  panels,
  width,
  height,
  onActivePanelChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const activePanels = panels.filter((p) => !p.skip);
  const duration = totalDuration(panels);

  // Load images when panel data changes
  useEffect(() => {
    let cancelled = false;
    setImagesLoaded(false);

    const loadAll = async () => {
      const imgs = await Promise.all(
        activePanels.map(
          (p) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = reject;
              img.src = p.imageData;
            }),
        ),
      );
      if (!cancelled) {
        imagesRef.current = imgs;
        setImagesLoaded(true);
      }
    };

    loadAll().catch(console.error);
    return () => {
      cancelled = true;
    };
    // Re-load when panel images or skip status changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panels.map((p) => p.imageData + (p.skip ? "S" : "")).join(",")]);

  const animate = useCallback(
    (timestamp: number) => {
      if (!canvasRef.current || !imagesLoaded || activePanels.length === 0)
        return;

      if (startTimeRef.current === 0) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      const loopedTime = duration > 0 ? elapsed % duration : 0;

      const ctx = canvasRef.current.getContext("2d")!;
      const idx = drawFrameAtTime(
        ctx,
        imagesRef.current,
        panels,
        loopedTime,
        width,
        height,
      );
      onActivePanelChange?.(idx);

      rafRef.current = requestAnimationFrame(animate);
    },
    [
      imagesLoaded,
      activePanels.length,
      panels,
      width,
      height,
      duration,
      onActivePanelChange,
    ],
  );

  useEffect(() => {
    if (isPlaying && imagesLoaded) {
      startTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, imagesLoaded, animate]);

  // Draw first frame when paused and images load
  useEffect(() => {
    if (
      !isPlaying &&
      imagesLoaded &&
      canvasRef.current &&
      activePanels.length > 0
    ) {
      const ctx = canvasRef.current.getContext("2d")!;
      drawFrameAtTime(ctx, imagesRef.current, panels, 0, width, height);
    }
  }, [isPlaying, imagesLoaded, panels, width, height, activePanels.length]);

  const togglePlay = () => {
    setIsPlaying((p) => !p);
  };

  return (
    <div className="relative flex flex-col items-center gap-2">
      <div
        className="rounded-xl overflow-hidden bg-background border border-outline/20"
        style={{ maxWidth: "100%" }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-auto"
          style={{ maxHeight: "50vh" }}
        />
      </div>
      <button
        onClick={togglePlay}
        className="absolute bottom-4 right-4 p-2 rounded-full bg-background/70 text-accent/70 backdrop-blur-sm border border-accent/10 hover:bg-background/90 active:scale-95 transition-all"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </button>
    </div>
  );
};
