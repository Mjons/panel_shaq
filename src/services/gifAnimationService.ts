import type { GifPanelConfig, GifProject } from "../types/gif";

/** Load an image from a src string */
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Draw an image fitted/covered into the canvas, centered */
function drawFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  offsetX = 0,
  offsetY = 0,
  scale = 1,
) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  const s = Math.max(w / img.width, h / img.height) * scale;
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, (w - dw) / 2 + offsetX, (h - dh) / 2 + offsetY, dw, dh);
}

/** Render a single panel's animation frames to the canvas */
function renderPanelFrames(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  config: GifPanelConfig,
  w: number,
  h: number,
  fps: number,
): ImageData[] {
  const frameCount = Math.max(1, Math.round(config.duration * fps));
  const frames: ImageData[] = [];

  for (let f = 0; f < frameCount; f++) {
    const t = frameCount > 1 ? f / (frameCount - 1) : 0; // 0..1

    switch (config.movement) {
      case "hold":
        drawFit(ctx, img, w, h);
        break;

      case "pan-lr": {
        // Pan from left to right — shift the image
        const maxShift = w * 0.3;
        drawFit(ctx, img, w, h, -maxShift / 2 + maxShift * t, 0, 1.3);
        break;
      }

      case "pan-rl": {
        const maxShift = w * 0.3;
        drawFit(ctx, img, w, h, maxShift / 2 - maxShift * t, 0, 1.3);
        break;
      }

      case "pan-ud": {
        const maxShift = h * 0.3;
        drawFit(ctx, img, w, h, 0, -maxShift / 2 + maxShift * t, 1.3);
        break;
      }

      case "zoom-in": {
        const zoom = 1 + (config.zoomAmount || 1.4) * t * 0.3;
        drawFit(ctx, img, w, h, 0, 0, zoom);
        break;
      }

      case "zoom-out": {
        const zoom = 1 + (config.zoomAmount || 1.4) * (1 - t) * 0.3;
        drawFit(ctx, img, w, h, 0, 0, zoom);
        break;
      }

      case "fade-in": {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = t;
        drawFit(ctx, img, w, h);
        ctx.globalAlpha = 1;
        break;
      }

      case "fade-out": {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1 - t;
        drawFit(ctx, img, w, h);
        ctx.globalAlpha = 1;
        break;
      }
    }

    frames.push(ctx.getImageData(0, 0, w, h));
  }

  return frames;
}

export interface GeneratedFrame {
  data: ImageData;
  delay: number; // ms
}

/**
 * Generate all frames for a GIF project.
 * Calls onProgress(0..1) as it works.
 */
export async function generateFrames(
  project: GifProject,
  onProgress?: (pct: number) => void,
): Promise<GeneratedFrame[]> {
  const { panels, width, height, fps } = project;
  const activePanels = panels.filter((p) => !p.skip);
  if (activePanels.length === 0) return [];

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const delay = Math.round(1000 / fps);
  const allFrames: GeneratedFrame[] = [];

  // Pre-load all images
  const images = await Promise.all(
    activePanels.map((p) => loadImg(p.imageData)),
  );

  for (let i = 0; i < activePanels.length; i++) {
    const config = activePanels[i];
    const img = images[i];

    // Render this panel's movement frames
    const panelFrames = renderPanelFrames(ctx, img, config, width, height, fps);
    for (const frame of panelFrames) {
      allFrames.push({ data: frame, delay });
    }

    // Transition frames (Phase 2 will add cross-fade/wipe/flash here)
    // For now, "cut" = no transition frames needed

    onProgress?.((i + 1) / activePanels.length);

    // Yield to main thread to keep UI responsive
    if (i % 2 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return allFrames;
}

/**
 * Draw a single frame at a given time position (for live preview).
 * Returns the panel index being displayed.
 */
export function drawFrameAtTime(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  panels: GifPanelConfig[],
  time: number, // seconds from start
  w: number,
  h: number,
): number {
  const activePanels = panels.filter((p) => !p.skip);
  if (activePanels.length === 0) return -1;

  // Find which panel we're in
  let elapsed = 0;
  let panelIdx = 0;
  for (let i = 0; i < activePanels.length; i++) {
    if (time < elapsed + activePanels[i].duration) {
      panelIdx = i;
      break;
    }
    elapsed += activePanels[i].duration;
    if (i === activePanels.length - 1) panelIdx = i;
  }

  const config = activePanels[panelIdx];
  const img = images[panelIdx];
  if (!img) return panelIdx;

  const localTime = time - elapsed;
  const t = config.duration > 0 ? Math.min(1, localTime / config.duration) : 0;

  // Same rendering logic as frame generation
  switch (config.movement) {
    case "hold":
      drawFit(ctx, img, w, h);
      break;
    case "pan-lr": {
      const maxShift = w * 0.3;
      drawFit(ctx, img, w, h, -maxShift / 2 + maxShift * t, 0, 1.3);
      break;
    }
    case "pan-rl": {
      const maxShift = w * 0.3;
      drawFit(ctx, img, w, h, maxShift / 2 - maxShift * t, 0, 1.3);
      break;
    }
    case "pan-ud": {
      const maxShift = h * 0.3;
      drawFit(ctx, img, w, h, 0, -maxShift / 2 + maxShift * t, 1.3);
      break;
    }
    case "zoom-in": {
      const zoom = 1 + (config.zoomAmount || 1.4) * t * 0.3;
      drawFit(ctx, img, w, h, 0, 0, zoom);
      break;
    }
    case "zoom-out": {
      const zoom = 1 + (config.zoomAmount || 1.4) * (1 - t) * 0.3;
      drawFit(ctx, img, w, h, 0, 0, zoom);
      break;
    }
    case "fade-in": {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = t;
      drawFit(ctx, img, w, h);
      ctx.globalAlpha = 1;
      break;
    }
    case "fade-out": {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1 - t;
      drawFit(ctx, img, w, h);
      ctx.globalAlpha = 1;
      break;
    }
  }

  return panelIdx;
}

/** Compute total duration of all active panels in seconds */
export function totalDuration(panels: GifPanelConfig[]): number {
  return panels.filter((p) => !p.skip).reduce((sum, p) => sum + p.duration, 0);
}

/** Estimate file size in bytes (rough: ~50 bytes per pixel per frame, with maxColors compression) */
export function estimateFileSize(project: GifProject): number {
  const activePanels = project.panels.filter((p) => !p.skip);
  const totalFrames = activePanels.reduce(
    (sum, p) => sum + Math.round(p.duration * project.fps),
    0,
  );
  // Rough estimate: each frame is width*height pixels, GIF compresses well
  // ~3-8 bytes per pixel after compression, use 5 as average
  return totalFrames * project.width * project.height * 5;
}

/** Format bytes as human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
