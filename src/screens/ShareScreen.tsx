import React, { useState, useEffect } from "react";
import {
  Share2,
  Download,
  Trash2,
  Image as ImageIcon,
  FileText,
  Copy,
  Check,
  Upload,
} from "lucide-react";
import type { PanelPrompt } from "../services/geminiService";
import type { Page } from "./LayoutScreen";
import type { VaultEntry } from "./VaultScreen";
import {
  exportAsComic,
  downloadComicFile,
} from "../services/exportComicService";

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
}

export const ShareScreen: React.FC<ShareProps> = ({
  projectName = "",
  story = "",
  pages = [],
  panels = [],
  vaultEntries = [],
}) => {
  const [exportHistory, setExportHistory] = useState<ExportItem[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("comic_export_history");
    if (saved) setExportHistory(JSON.parse(saved));
  }, []);

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
        await navigator.share({
          title: "Panel Shaq Comic",
          files: [file],
        });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = item.name;
        a.click();
        URL.revokeObjectURL(url);
      }
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
          Distribution
        </span>
        <h2 className="font-headline text-5xl font-bold text-accent tracking-tighter">
          Share & Export
        </h2>
      </header>

      <div className="space-y-8">
        {/* Quick Share */}
        <section className="bg-surface-container rounded-xl p-6 border border-outline/10 space-y-4">
          <h3 className="font-headline text-lg font-bold text-primary flex items-center gap-2">
            <Share2 size={18} />
            Quick Share
          </h3>
          <p className="text-sm text-accent/50">
            Share your comic via your device's native share sheet, or copy a
            link to this app.
          </p>
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary/10 text-primary border border-primary/30 rounded-lg font-bold text-sm hover:bg-primary hover:text-background transition-all"
          >
            {copied ? (
              <>
                <Check size={16} /> Copied!
              </>
            ) : (
              <>
                <Copy size={16} /> Copy App Link
              </>
            )}
          </button>
          <p className="text-[10px] text-accent/30 text-center">
            To share a comic, export it first from the Editor, then share from
            the history below.
          </p>
        </section>

        {/* Export for Panelhaus */}
        <section className="bg-surface-container rounded-xl p-6 border border-primary/20 space-y-4">
          <h3 className="font-headline text-lg font-bold text-primary flex items-center gap-2">
            <Upload size={18} />
            Export for Panelhaus
          </h3>
          <p className="text-sm text-accent/50">
            Download your project as a <strong>.comic</strong> file and open it
            in Panelhaus for full editing — layers, effects, text tools, and
            more.
          </p>
          <div className="text-[10px] text-accent/30 space-y-1">
            <p>
              Includes: {panels.filter((p) => p.image).length} panel images,{" "}
              {vaultEntries.length} vault entries, {pages.length} pages
            </p>
          </div>
          <button
            onClick={() => {
              const json = exportAsComic(
                projectName,
                story,
                pages,
                panels,
                vaultEntries,
              );
              downloadComicFile(json, projectName);
            }}
            disabled={panels.length === 0}
            className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-background font-headline font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
          >
            <Download size={18} />
            DOWNLOAD .COMIC FILE
          </button>
          {panels.length === 0 && (
            <p className="text-[10px] text-accent/30 text-center">
              Generate some panels first to export
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
              <ImageIcon size={48} className="mx-auto text-accent/10 mb-4" />
              <p className="text-accent/30 text-sm">No exports yet</p>
              <p className="text-accent/20 text-xs mt-1">
                Export from the Editor to see your comics here
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
