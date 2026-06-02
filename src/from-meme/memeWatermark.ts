// Draws the "made with panelhaus.app" watermark into the flattened meme canvas.
// Mirrors PanelHaus's getMemeWatermarkBubbles intent: white text, thin dark
// outline, Bangers stack, vertical (-90°), bottom-right corner. Geometry scales
// with the export width (baseline 700px, matching the desktop meme dimension).

const WM_FONT = '"Bangers", "Impact", "Arial Black", sans-serif';

export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
): void {
  const s = W / 700;
  const margin = 6 * s;
  const laneInset = 14 * s;
  const fontMade = 8 * s;
  const fontApp = 10 * s;

  ctx.save();
  // Anchor at bottom-right, rotate so text reads bottom-to-top along the edge.
  ctx.translate(W - margin - laneInset, H - margin);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#000000";

  let x = 0;
  ctx.font = `${fontMade}px ${WM_FONT}`;
  ctx.lineWidth = Math.max(1, fontMade * 0.1);
  const made = "made with ";
  ctx.strokeText(made, x, 0);
  ctx.fillText(made, x, 0);
  x += ctx.measureText(made).width;

  ctx.font = `${fontApp}px ${WM_FONT}`;
  ctx.lineWidth = Math.max(1, fontApp * 0.1);
  const app = "panelhaus.app";
  ctx.strokeText(app, x, 0);
  ctx.fillText(app, x, 0);

  ctx.restore();
}
