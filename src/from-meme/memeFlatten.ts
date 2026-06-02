import type { HandoffPayload } from "./useHandoffPayload";
import type { MemeZone } from "./zoneTypes";
import { drawWatermark } from "./memeWatermark";

// Flattens the meme image + text zones (+ watermark) to a PNG Blob via a manual
// canvas. We use a canvas (not html-to-image) so we control fonts and outline
// exactly: html-to-image's skipFonts breaks the meme typefaces in its
// foreignObject render. Geometry/style here mirror TextZonesOverlay so the
// export matches what the user sees.

const FONT_FAMILIES = ["Anton", "Bangers", "Permanent Marker", "Special Elite", "Inter"];

async function ensureFonts(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts?.load) return;
  try {
    await Promise.all(FONT_FAMILIES.map((f) => fonts.load(`32px "${f}"`)));
    await fonts.ready;
  } catch {
    /* fonts best-effort */
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // Blob serves ACAO:* — keeps canvas untainted
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the meme image."));
    img.src = url;
  });
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      if (!line && ctx.measureText(word).width > maxWidth) {
        // Single word too long — break by character.
        let chunk = "";
        for (const ch of word) {
          if (chunk && ctx.measureText(chunk + ch).width > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        line = chunk;
      } else {
        line = test;
      }
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function drawZone(
  ctx: CanvasRenderingContext2D,
  zone: MemeZone,
  rawText: string,
  W: number,
  H: number,
): void {
  const s = zone.style;
  const zw = zone.width * W;
  const zh = zone.height * H;
  const cx = zone.x * W + zw / 2;
  const cy = zone.y * H + zh / 2;
  const fontPx = Math.max(6, zone.fontSizeRatio * W);
  const text = (s.allCaps ? rawText.toUpperCase() : rawText) || "";

  ctx.save();
  ctx.translate(cx, cy);
  if (zone.rotation) ctx.rotate((zone.rotation * Math.PI) / 180);

  if (s.box && text.trim()) {
    ctx.fillStyle = s.box.backgroundColor;
    ctx.fillRect(-zw / 2, -zh / 2, zw, zh);
    if (s.box.borderWidth > 0) {
      ctx.lineWidth = s.box.borderWidth;
      ctx.strokeStyle = s.box.borderColor;
      ctx.strokeRect(-zw / 2, -zh / 2, zw, zh);
    }
  }

  if (text.trim()) {
    ctx.font = `${s.italic ? "italic " : ""}${s.fontWeight} ${fontPx}px ${s.fontFamily}`;
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;

    const pad = fontPx * 0.15;
    const lines = wrapLines(ctx, text, zw - pad * 2);
    const lineH = fontPx * s.lineHeight;
    const startY = -((lines.length - 1) * lineH) / 2;

    let ax: number;
    if (s.textAlign === "left") {
      ctx.textAlign = "left";
      ax = -zw / 2 + pad;
    } else if (s.textAlign === "right") {
      ctx.textAlign = "right";
      ax = zw / 2 - pad;
    } else {
      ctx.textAlign = "center";
      ax = 0;
    }

    for (let i = 0; i < lines.length; i++) {
      const ly = startY + i * lineH;
      if (s.outline) {
        ctx.strokeStyle = s.outline.color;
        ctx.lineWidth = Math.max(1, s.outline.widthEm * fontPx * 2);
        ctx.strokeText(lines[i], ax, ly);
      }
      ctx.fillStyle = s.color;
      ctx.fillText(lines[i], ax, ly);
    }
  }

  ctx.restore();
}

export async function flattenMeme(
  payload: HandoffPayload,
  zones: MemeZone[],
  texts: Record<string, string>,
  opts: { watermark?: boolean } = {},
): Promise<Blob> {
  await ensureFonts();
  const img = await loadImage(payload.memeImageUrl);
  const W = img.naturalWidth || payload.memeImageDimensions.width || 1024;
  const H = img.naturalHeight || payload.memeImageDimensions.height || 1024;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");

  ctx.drawImage(img, 0, 0, W, H);
  for (const zone of zones) {
    drawZone(ctx, zone, texts[zone.id] ?? zone.text, W, H);
  }
  if (opts.watermark !== false) drawWatermark(ctx, W, H);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed."))),
      "image/png",
    );
  });
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(blob);
  });
}
