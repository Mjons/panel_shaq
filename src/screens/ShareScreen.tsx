import React, { useState, useEffect, useRef } from "react";
import {
  Share2,
  Download,
  Trash2,
  Image as ImageIcon,
  FileText,
  Copy,
  Check,
  Upload,
  Film,
  FileDown,
  Loader2,
} from "lucide-react";
import type { PanelPrompt } from "../services/geminiService";
import { type Page, PAGE_FORMATS } from "./LayoutScreen";
import type { VaultEntry } from "./VaultScreen";
import {
  exportAsComic,
  downloadComicFile,
} from "../services/exportComicService";
import { track } from "../services/analytics";
import { ComicPageCanvas } from "../components/ComicPageCanvas";
import {
  exportPagesPNG,
  sharePages,
  waitForPaint,
  type PageExportDriver,
} from "../services/comicPageExport";

interface ExportItem {
  id: string;
  name: string;
  date: string;
  size: string;
  data: string;
  type: "pdf" | "png";
}

interface ShareProps {
  projectName?: string;
  story?: string;
  pages?: Page[];
  panels?: PanelPrompt[];
  vaultEntries?: VaultEntry[];
  pageFormat?: string;
  onOpenGifEditor?: (images: { id: string; imageData: string }[]) => void;
  onNavigate?: (tab: string) => void;
}

export const ShareScreen: React.FC<ShareProps> = ({
  projectName = "",
  story = "",
  pages = [],
  panels = [],
  vaultEntries = [],
  pageFormat,
  onOpenGifEditor,
  onNavigate,
}) => {
  const [exportHistory, setExportHistory] = useState<ExportItem[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("comic_export_history");
    if (saved) setExportHistory(JSON.parse(saved));
  }, []);

  const [sharing, setSharing] = useState(false);
  const panelsWithImages = panels.filter((p) => p.image);
  // The .comic package carries panels, pages, and vault entries — so it's a
  // meaningful export whenever any of those exist, not only when images render.
  const hasComicContent =
    panels.length > 0 || pages.length > 0 || vaultEntries.length > 0;
  const gifImages = panelsWithImages.map((p) => ({
    id: p.id,
    imageData: p.image!,
  }));

  // ── Offscreen page export (PNG / Share / GIF) ──
  // The composed page (layout + bubbles) is rendered off-viewport via
  // <ComicPageCanvas isExporting/> and rasterized by the shared export
  // algorithms — the same ones the Editor uses.
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [offscreenIdx, setOffscreenIdx] = useState(0);
  const offscreenRef = useRef<HTMLDivElement | null>(null);

  const pageBackgroundColor = (() => {
    try {
      const s = localStorage.getItem("panelshaq_settings");
      return s ? JSON.parse(s).pageBackgroundColor || "#000000" : "#000000";
    } catch {
      return "#000000";
    }
  })();

  const fmt = PAGE_FORMATS[pageFormat || "portrait"] || PAGE_FORMATS.portrait;
  const OFF_W = 1080;
  const OFF_H = Math.round(OFF_W * (fmt.ratio[1] / fmt.ratio[0]));

  const makeDriver = (): PageExportDriver => ({
    getNode: () => offscreenRef.current,
    pageCount: pages.length,
    currentIndex: offscreenIdx,
    setPageIndex: async (i: number) => {
      setOffscreenIdx(i);
      await waitForPaint();
    },
    onProgress: (pct: number) => setProgress(pct),
    isCancelled: () => false,
  });

  const addExportHistory = (
    name: string,
    data: string,
    type: "pdf" | "png",
  ) => {
    const base64Part = data.split(",")[1] || data;
    const byteSize = (base64Part.length * 3) / 4;
    const newItem: ExportItem = {
      id: crypto.randomUUID(),
      name,
      date: new Date().toLocaleDateString(),
      size: `${(byteSize / 1024 / 1024).toFixed(1)} MB`,
      data,
      type,
    };
    setExportHistory((prev) => {
      const updated = [newItem, ...prev].slice(0, 5);
      localStorage.setItem("comic_export_history", JSON.stringify(updated));
      return updated;
    });
  };

  const runExport = async (fn: () => Promise<void>) => {
    if (busy || pages.length === 0) return;
    setBusy(true);
    setProgress(0);
    try {
      await fn();
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setBusy(false);
      setProgress(0);
      setOffscreenIdx(0);
    }
  };

  const handleDownloadPages = () =>
    runExport(async () => {
      const arts = await exportPagesPNG(makeDriver(), true);
      arts.forEach((a) => addExportHistory(a.fileName, a.dataUri, a.type));
      track("share_completed", {
        surface: "export_tab_pages_download",
        count: arts.length,
      });
    });

  const handleSharePages = () =>
    runExport(async () => {
      await sharePages(makeDriver(), true, {
        title: projectName || "My Comic",
        text: "Made with Panelhaus",
      });
      track("share_completed", { surface: "export_tab_pages_share" });
    });

  const handleDelete = (id: string) => {
    const updated = exportHistory.filter((item) => item.id !== id);
    setExportHistory(updated);
    localStorage.setItem("comic_export_history", JSON.stringify(updated));
  };

  const handleClearAll = () => {
    if (window.confirm("Clear all export history?")) {
      setExportHistory([]);
      localStorage.removeItem("comic_export_history");
    }
  };

  const handleShare = async (item: ExportItem) => {
    try {
      // Convert data URL to blob
      const res = await fetch(item.data);
      const blob = await res.blob();
      const file = new File([blob], item.name, {
        type: item.type === "pdf" ? "application/pdf" : "image/png",
      });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            title: "Panel Haus Comic",
            files: [file],
          });
          track("share_completed", { surface: "export_item", kind: item.type });
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
          // Share rejected post-canShare (iOS file size, OS deny, etc.) — fall through
        }
      }
      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.name;
      a.click();
      URL.revokeObjectURL(url);
      track("share_completed", {
        surface: "export_item_download",
        kind: item.type,
      });
    } catch (err) {
      console.error("Share failed:", err);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pt-24 px-6 max-w-2xl mx-auto pb-40">
      <header className="mb-10">
        <span className="font-label text-primary uppercase tracking-[0.2em] text-[10px] mb-2 block">
          Export
        </span>
        <h2 className="font-headline text-5xl font-bold text-accent tracking-tighter">
          Export &amp; Share
        </h2>
      </header>

      <div className="space-y-8">
        {/* Send to Panelhaus Desktop — the lead CTA (mobile is the capture
            tool; the desktop app is where the full studio lives). */}
        <section className="bg-surface-container rounded-xl p-6 border border-primary/20 space-y-4">
          <h3 className="font-headline text-lg font-bold text-primary flex items-center gap-2">
            <Upload size={18} />
            Send to Panelhaus Desktop
          </h3>
          <p className="text-sm text-accent/50">
            Export as a <strong>.comic</strong> file to continue editing in
            Panelhaus Desktop — layers, effects, pro text tools, and more.
          </p>
          <div className="text-[10px] text-accent/30 space-y-1">
            <p>
              Includes: {panelsWithImages.length} panel images,{" "}
              {vaultEntries.length} vault entries, {pages.length} pages
            </p>
          </div>
          <button
            onClick={async () => {
              const json = exportAsComic(
                projectName,
                story,
                pages,
                panels,
                vaultEntries,
              );
              await downloadComicFile(json, projectName);
            }}
            disabled={!hasComicContent}
            className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-background font-headline font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
          >
            <Share2 size={18} />
            SHARE .COMIC FILE
          </button>
          {!hasComicContent && (
            <p className="text-[10px] text-accent/30 text-center">
              Add characters or generate panels first to export
            </p>
          )}
        </section>

        {/* Download comic pages — rendered offscreen via ComicPageCanvas and
            rasterized by the shared export algorithms. */}
        <section className="bg-surface-container rounded-xl p-6 border border-outline/10 space-y-4">
          <h3 className="font-headline text-lg font-bold text-primary flex items-center gap-2">
            <FileDown size={18} />
            Download Comic Pages
          </h3>
          <p className="text-sm text-accent/50">
            Save your laid-out pages — with layout and speech bubbles — as PNG
            images, or share them straight from here.
          </p>
          <button
            onClick={handleDownloadPages}
            disabled={busy || pages.length === 0}
            className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-background font-headline font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
          >
            {busy ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <FileDown size={18} />
            )}
            {busy ? `EXPORTING… ${progress}%` : "DOWNLOAD ALL PAGES (PNG)"}
          </button>
          <button
            onClick={handleSharePages}
            disabled={busy || pages.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3 bg-secondary/10 text-secondary border border-secondary/20 font-headline font-bold rounded-lg hover:bg-secondary/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <Share2 size={16} />
            SHARE ALL PAGES
          </button>
          {pages.length === 0 && (
            <p className="text-[10px] text-accent/30 text-center">
              Lay out your panels into pages first
            </p>
          )}
        </section>

        {/* Quick Share — share panel images */}
        <section className="bg-surface-container rounded-xl p-6 border border-outline/10 space-y-4">
          <h3 className="font-headline text-lg font-bold text-primary flex items-center gap-2">
            <Share2 size={18} />
            Share Panel Images
          </h3>
          <p className="text-sm text-accent/50">
            Share individual panel images via email, chat, or social media.
          </p>

          <div className="space-y-3">
            {/* Share all as a batch */}
            <button
              onClick={async () => {
                if (panelsWithImages.length === 0) return;
                setSharing(true);
                try {
                  const files = await Promise.all(
                    panelsWithImages.map(async (p, i) => {
                      const res = await fetch(p.image!);
                      const blob = await res.blob();
                      return new File([blob], `panel-${i + 1}.png`, {
                        type: "image/png",
                      });
                    }),
                  );
                  let shared = false;
                  if (navigator.canShare?.({ files })) {
                    try {
                      await navigator.share({
                        title: projectName || "My Comic",
                        text: "Made with Panelhaus",
                        files,
                      });
                      track("share_completed", {
                        surface: "all_panels",
                        count: files.length,
                      });
                      shared = true;
                    } catch (e) {
                      if ((e as Error).name === "AbortError") {
                        shared = true; // user cancelled — don't auto-download
                      }
                      // Otherwise fall through to download
                    }
                  }
                  if (!shared) {
                    // Fallback: download each
                    panelsWithImages.forEach((p, i) => {
                      const link = document.createElement("a");
                      link.download = `panel-${i + 1}.png`;
                      link.href = p.image!;
                      link.click();
                    });
                    track("share_completed", {
                      surface: "all_panels_download",
                      count: files.length,
                    });
                  }
                } catch (e) {
                  console.error("Batch share failed:", e);
                }
                setSharing(false);
              }}
              disabled={sharing || panelsWithImages.length === 0}
              className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-background font-headline font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
            >
              <Share2 size={18} />
              {sharing
                ? "PREPARING..."
                : panelsWithImages.length > 0
                  ? `SHARE ${panelsWithImages.length} PANELS`
                  : "SHARE PANELS"}
            </button>

            {/* Individual panel thumbnails */}
            {panelsWithImages.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {panelsWithImages.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={async () => {
                      try {
                        const res = await fetch(p.image!);
                        const blob = await res.blob();
                        const file = new File([blob], `panel-${i + 1}.png`, {
                          type: "image/png",
                        });
                        let shared = false;
                        if (navigator.canShare?.({ files: [file] })) {
                          try {
                            await navigator.share({
                              title: `Panel ${i + 1}`,
                              files: [file],
                            });
                            track("share_completed", {
                              surface: "single_panel",
                            });
                            shared = true;
                          } catch (e) {
                            if ((e as Error).name === "AbortError") {
                              shared = true;
                            }
                            // Otherwise fall through to download
                          }
                        }
                        if (!shared) {
                          const link = document.createElement("a");
                          link.download = file.name;
                          link.href = p.image!;
                          link.click();
                          track("share_completed", {
                            surface: "single_panel_download",
                          });
                        }
                      } catch (e) {
                        console.error("Panel share failed:", e);
                      }
                    }}
                    className="aspect-video rounded-lg overflow-hidden border border-outline/20 hover:border-primary transition-all relative group"
                  >
                    <img
                      src={p.image}
                      alt={`Panel ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Share2
                        size={14}
                        className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-accent/40 text-center">
                Generate panels first to share individual images
              </p>
            )}
          </div>
        </section>

        {/* Make a GIF — quick all-pages renders + the full GIF editor */}
        <section className="bg-surface-container rounded-xl p-6 border border-outline/10 space-y-4">
          <h3 className="font-headline text-lg font-bold text-primary flex items-center gap-2">
            <Film size={18} />
            Make a GIF
          </h3>
          <p className="text-sm text-accent/50">
            Open the GIF editor to pick an animation template and fine-tune
            timing and motion — with a live preview of the result.
          </p>

          <button
            onClick={() => {
              if (gifImages.length > 0) onOpenGifEditor?.(gifImages);
            }}
            disabled={gifImages.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary/10 text-primary border border-primary/20 font-headline font-bold rounded-lg hover:bg-primary/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <Film size={16} />
            OPEN GIF EDITOR
          </button>
          {gifImages.length === 0 && pages.length === 0 && (
            <p className="text-[10px] text-accent/30 text-center">
              Generate panels first to make a GIF
            </p>
          )}
        </section>

        {/* Export History */}
        <section className="bg-surface-container rounded-xl p-6 border border-outline/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-lg font-bold text-accent">
              Export History
            </h3>
            {exportHistory.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-[10px] font-bold text-red-500/60 hover:text-red-500 uppercase tracking-widest transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {exportHistory.length > 0 ? (
            <div className="space-y-3">
              {exportHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-3 bg-background/50 rounded-lg border border-outline/10 group"
                >
                  <div className="w-12 h-12 bg-surface-container-highest rounded-lg flex items-center justify-center border border-outline/10">
                    {item.type === "pdf" ? (
                      <FileText size={20} className="text-secondary" />
                    ) : (
                      <ImageIcon size={20} className="text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate text-accent">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-accent/40 uppercase">
                      {item.date} &middot; {item.size} &middot;{" "}
                      {item.type.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleShare(item)}
                      className="p-2 rounded-full hover:bg-primary/10 text-accent/40 hover:text-primary transition-colors"
                      title="Share"
                    >
                      <Share2 size={16} />
                    </button>
                    <a
                      href={item.data}
                      download={item.name}
                      className="p-2 rounded-full hover:bg-primary/10 text-accent/40 hover:text-primary transition-colors"
                      title="Download"
                    >
                      <Download size={16} />
                    </a>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 rounded-full hover:bg-red-500/10 text-accent/40 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <ImageIcon size={48} className="mx-auto text-accent/40 mb-4" />
              <p className="text-accent/30 text-sm">No exports yet</p>
              <p className="text-accent/40 text-xs mt-1">
                Export from the Editor to see your comics here
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Offscreen render host — ComicPageCanvas drawn off-viewport at a fixed
          size so the page-export algorithms can rasterize the composed page
          (layout + bubbles). Kept mounted (one page at a time) only when there
          are pages to export. */}
      {pages.length > 0 && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: -99999,
            top: 0,
            width: OFF_W,
            height: OFF_H,
            pointerEvents: "none",
          }}
        >
          <div
            ref={offscreenRef}
            className="bg-surface-container-highest p-1 rounded-lg shadow-2xl h-full w-full overflow-hidden"
          >
            <ComicPageCanvas
              currentPage={pages[offscreenIdx]}
              panels={panels}
              pageBackgroundColor={pageBackgroundColor}
              isExporting={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};
