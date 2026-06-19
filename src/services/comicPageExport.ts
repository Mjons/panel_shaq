/* ── Comic page export algorithms (driver-based) ──
   Phase 2 of the export-renderer-extraction plan: the PNG / PDF / GIF export
   logic lifted verbatim out of EditorScreen, parameterized over a
   `PageExportDriver` so it doesn't care *which* DOM node it captures. The
   Editor builds a driver from its live `comicRef` + `setSelectedPageIdx`; the
   Export tab (Phase 3) will build one from an offscreen `ComicPageCanvas`.
   Capture options (pixelRatio, skipFonts, backgroundColor) are kept identical
   to the original so output stays pixel-identical. */
import { toPng, toJpeg } from "html-to-image";
import { encode as encodeGif } from "modern-gif";
import jsPDF from "jspdf";
import { PAGE_FORMATS } from "../screens/LayoutScreen";

export type GifMode =
  | "story-flow"
  | "page-reveal"
  | "slideshow"
  | "cinematic"
  | "this-page";

export interface PageExportDriver {
  /** The node to rasterize (the `ComicPageCanvas` root / `comicRef`). */
  getNode(): HTMLElement | null;
  pageCount: number;
  /** The page index shown when the export began (for single-page + restore). */
  currentIndex: number;
  /** Switch the rendered page and wait for it to paint. */
  setPageIndex(i: number): Promise<void>;
  onProgress?(pct: number): void;
  isCancelled?(): boolean;
}

export interface ExportArtifact {
  fileName: string;
  dataUri: string;
  type: "pdf" | "png";
}

export const waitForPaint = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

export async function captureNode(
  node: HTMLElement,
  format: "jpeg" | "png",
): Promise<string> {
  // Double rAF ensures layout is settled before capture
  await waitForPaint();
  if (format === "jpeg") {
    return toJpeg(node, {
      quality: 0.9,
      backgroundColor: "#000000",
      pixelRatio: 1.5,
      skipFonts: true,
      cacheBust: true,
    });
  }
  return toPng(node, {
    backgroundColor: "#000000",
    pixelRatio: 1.5,
    skipFonts: true,
    cacheBust: true,
  });
}

function downloadDataUri(fileName: string, dataUri: string) {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = dataUri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Export pages as a single PDF. Saves the file and returns the artifact for
    history (or null if nothing was produced / the export was cancelled). */
export async function exportPagesPDF(
  d: PageExportDriver,
  allPages: boolean,
): Promise<ExportArtifact | null> {
  if (!d.getNode()) return null;

  const pdf = new jsPDF("p", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const indices = allPages
    ? Array.from({ length: d.pageCount }, (_, i) => i)
    : [d.currentIndex];
  const originalPageIdx = d.currentIndex;

  for (let i = 0; i < indices.length; i++) {
    if (d.isCancelled?.()) break;

    if (allPages) {
      await d.setPageIndex(indices[i]);
    }

    try {
      const node = d.getNode();
      if (!node) continue;
      const imgData = await captureNode(node, "jpeg");

      if (i > 0) pdf.addPage();

      const canvasRatio = node.offsetWidth / node.offsetHeight;
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

    d.onProgress?.(Math.round(((i + 1) / indices.length) * 100));
  }

  if (d.isCancelled?.()) return null;

  if (allPages) await d.setPageIndex(originalPageIdx);

  const fileName = `Comic_Export_${new Date().getTime()}.pdf`;
  const pdfData = pdf.output("datauristring");

  await waitForPaint();
  pdf.save(fileName);

  return { fileName, dataUri: pdfData, type: "pdf" };
}

/** Export pages as PNG files (one download per page). Returns the artifacts
    for history. */
export async function exportPagesPNG(
  d: PageExportDriver,
  allPages: boolean,
): Promise<ExportArtifact[]> {
  if (!d.getNode()) return [];

  const indices = allPages
    ? Array.from({ length: d.pageCount }, (_, i) => i)
    : [d.currentIndex];
  const originalPageIdx = d.currentIndex;
  const artifacts: ExportArtifact[] = [];

  for (let i = 0; i < indices.length; i++) {
    if (d.isCancelled?.()) break;

    if (allPages) {
      await d.setPageIndex(indices[i]);
    }

    try {
      const node = d.getNode();
      if (!node) continue;
      const imgData = await captureNode(node, "png");

      const fileName = `Comic_Page_${allPages ? indices[i] + 1 : originalPageIdx + 1}_${new Date().getTime()}.png`;

      downloadDataUri(fileName, imgData);
      artifacts.push({ fileName, dataUri: imgData, type: "png" });
    } catch (pageError) {
      console.error(`Error exporting page ${i + 1}:`, pageError);
    }

    d.onProgress?.(Math.round(((i + 1) / indices.length) * 100));
  }

  if (allPages) await d.setPageIndex(originalPageIdx);

  return artifacts;
}

/** Render pages/panels into an animated GIF and download it. */
/** Capture pages as PNGs and hand them to the native share sheet (falling
    back to per-file download). Mirrors the Editor's inline Share handlers. */
export async function sharePages(
  d: PageExportDriver,
  allPages: boolean,
  opts: { title: string; text: string },
): Promise<void> {
  if (!d.getNode()) return;

  const indices = allPages
    ? Array.from({ length: d.pageCount }, (_, i) => i)
    : [d.currentIndex];
  const originalPageIdx = d.currentIndex;
  const files: File[] = [];

  for (let i = 0; i < indices.length; i++) {
    if (allPages) await d.setPageIndex(indices[i]);
    const node = d.getNode();
    if (!node) continue;
    const imgData = await captureNode(node, "png");
    const res = await fetch(imgData);
    const blob = await res.blob();
    files.push(
      new File([blob], `Comic_Page_${indices[i] + 1}.png`, {
        type: "image/png",
      }),
    );
    d.onProgress?.(Math.round(((i + 1) / indices.length) * 100));
  }

  if (allPages) await d.setPageIndex(originalPageIdx);
  if (files.length === 0) return;

  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ title: opts.title, text: opts.text, files });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      // otherwise fall through to download
    }
  }
  files.forEach((f) => {
    const url = URL.createObjectURL(f);
    const link = document.createElement("a");
    link.download = f.name;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  });
}

export async function createGif(
  d: PageExportDriver,
  mode: GifMode,
  pageFormat: string | undefined,
): Promise<void> {
  if (!d.getNode()) return;

  // Determine frame size from page format
  const fmt = PAGE_FORMATS[pageFormat || "portrait"] || PAGE_FORMATS.portrait;
  const gifWidth = 480;
  const gifHeight = Math.round(gifWidth * (fmt.ratio[1] / fmt.ratio[0]));

  const canvas = document.createElement("canvas");
  canvas.width = gifWidth;
  canvas.height = gifHeight;
  const ctx = canvas.getContext("2d")!;

  const loadImg = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  type Frame = { data: ImageData; delay: number };
  const frames: Frame[] = [];

  const drawFit = (img: HTMLImageElement, delay: number, fr: Frame[]) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, gifWidth, gifHeight);
    const s = Math.max(gifWidth / img.width, gifHeight / img.height);
    const dw = img.width * s,
      dh = img.height * s;
    ctx.drawImage(img, (gifWidth - dw) / 2, (gifHeight - dh) / 2, dw, dh);
    fr.push({ data: ctx.getImageData(0, 0, gifWidth, gifHeight), delay });
  };

  const capturePanel = async (el: HTMLElement) =>
    loadImg(
      await toPng(el, { pixelRatio: 2, cacheBust: true, skipFonts: true }),
    );

  const capturePage = async () => {
    await waitForPaint();
    return loadImg(await captureNode(d.getNode()!, "png"));
  };

  const originalPageIdx = d.currentIndex;
  const pagesToProcess =
    mode === "this-page"
      ? [d.currentIndex]
      : Array.from({ length: d.pageCount }, (_, i) => i);

  for (let pi = 0; pi < pagesToProcess.length; pi++) {
    const pageIdx = pagesToProcess[pi];
    if (pageIdx !== originalPageIdx || pi > 0) {
      await d.setPageIndex(pageIdx);
    }

    if (mode === "slideshow") {
      drawFit(await capturePage(), 3000, frames);
    } else {
      const node = d.getNode();
      if (!node) continue;
      const slots = Array.from(
        node.querySelectorAll("[data-panel-slot]"),
      ) as HTMLElement[];

      for (let i = 0; i < slots.length; i++) {
        const panelImg = await capturePanel(slots[i]);

        if (panelImg.width <= 0 || panelImg.height <= 0) continue;

        if (mode === "cinematic") {
          for (let step = 0; step < 3; step++) {
            const zoom = 1 + step * 0.08;
            const zw = panelImg.width / zoom,
              zh = panelImg.height / zoom;
            const sx = (panelImg.width - zw) / 2,
              sy = (panelImg.height - zh) / 2;
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, gifWidth, gifHeight);
            const s = Math.max(gifWidth / zw, gifHeight / zh);
            const dw = zw * s,
              dh = zh * s;
            ctx.drawImage(
              panelImg,
              sx,
              sy,
              zw,
              zh,
              (gifWidth - dw) / 2,
              (gifHeight - dh) / 2,
              dw,
              dh,
            );
            frames.push({
              data: ctx.getImageData(0, 0, gifWidth, gifHeight),
              delay: 600,
            });
          }
        } else {
          drawFit(
            panelImg,
            mode === "story-flow" || mode === "this-page" ? 1200 : 800,
            frames,
          );
        }
      }

      if (mode === "page-reveal") {
        drawFit(await capturePage(), 2000, frames);
      }
    }

    d.onProgress?.(Math.round(((pi + 1) / pagesToProcess.length) * 85));
  }

  await d.setPageIndex(originalPageIdx);
  d.onProgress?.(90);

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
  d.onProgress?.(100);

  const filename =
    mode === "this-page"
      ? `Comic_Page_${originalPageIdx + 1}.gif`
      : `Comic_${mode}.gif`;

  // Always download directly — navigator.share() fails here because
  // the user gesture has expired during async GIF encoding
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
