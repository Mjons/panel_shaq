import React, { useState, useEffect } from "react";
import {
  Layout,
  Columns,
  Grid,
  ArrowRight,
  Sparkles,
  Layers,
} from "lucide-react";
import { PanelPrompt } from "../services/geminiService";

export interface Page {
  id: string;
  panelIds: string[];
  layout: "grid" | "vertical" | "dynamic";
}

interface LayoutScreenProps {
  panels: PanelPrompt[];
  pages: Page[];
  setPages: React.Dispatch<React.SetStateAction<Page[]>>;
  onContinue: () => void;
}

export const LayoutScreen: React.FC<LayoutScreenProps> = ({
  panels,
  pages,
  setPages,
  onContinue,
}) => {
  const [panelsPerPage, setPanelsPerPage] = useState(4);

  // Initial page generation if none exist
  useEffect(() => {
    if (pages.length === 0 && panels.length > 0) {
      const newPages: Page[] = [];
      for (let i = 0; i < panels.length; i += panelsPerPage) {
        newPages.push({
          id: `page-${Math.random().toString(36).substr(2, 9)}`,
          panelIds: panels.slice(i, i + panelsPerPage).map((p) => p.id),
          layout: "grid",
        });
      }
      setPages(newPages);
    }
  }, [panels, pages.length, panelsPerPage, setPages]);

  const updatePageLayout = (
    pageId: string,
    layout: "grid" | "vertical" | "dynamic",
  ) => {
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, layout } : p)),
    );
  };

  const repartitionPages = (count: number) => {
    if (
      pages.length > 0 &&
      !window.confirm("Repartitioning will reset all page layouts. Continue?")
    ) {
      return;
    }
    setPanelsPerPage(count);
    const newPages: Page[] = [];
    for (let i = 0; i < panels.length; i += count) {
      newPages.push({
        id: `page-${Math.random().toString(36).substr(2, 9)}`,
        panelIds: panels.slice(i, i + count).map((p) => p.id),
        layout: "grid",
      });
    }
    setPages(newPages);
  };

  return (
    <div className="pt-24 px-6 max-w-7xl mx-auto pb-32">
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="font-label text-primary uppercase tracking-[0.2em] text-[10px] mb-2 block font-bold">
            Step 3: Composition
          </span>
          <h2 className="font-headline text-4xl md:text-5xl font-bold text-accent leading-tight">
            Layout Architect
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-surface-container p-1 rounded-lg flex gap-1 border border-outline/10">
            {[2, 3, 4, 6].map((num) => (
              <button
                key={num}
                onClick={() => repartitionPages(num)}
                className={`px-3 py-2 rounded-md text-[10px] font-bold transition-all ${panelsPerPage === num ? "bg-primary text-background" : "text-accent/50 hover:text-accent"}`}
              >
                {num} PANELS
              </button>
            ))}
          </div>
          <button
            onClick={onContinue}
            className="flex items-center justify-center gap-3 bg-secondary text-background px-8 py-4 rounded-lg font-headline font-extrabold tracking-tight hover:opacity-90 active:scale-95 transition-all shadow-xl"
          >
            EDITOR
            <ArrowRight size={20} />
          </button>
        </div>
      </div>

      <div className="space-y-12">
        {pages.map((page, pageIdx) => (
          <div
            key={page.id}
            className="bg-surface rounded-2xl p-8 border border-outline/10 shadow-2xl relative group"
          >
            <div className="absolute -left-4 top-1/2 -translate-y-1/2 bg-primary text-background w-8 h-8 rounded-full flex items-center justify-center font-headline font-bold shadow-lg z-10">
              {pageIdx + 1}
            </div>

            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <h3 className="font-headline text-xl font-bold text-accent">
                  Page {pageIdx + 1}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => updatePageLayout(page.id, "grid")}
                    className={`p-2 rounded-lg border transition-all ${page.layout === "grid" ? "bg-primary/20 border-primary text-primary" : "border-outline/10 text-accent/30 hover:text-accent"}`}
                  >
                    <Grid size={18} />
                  </button>
                  <button
                    onClick={() => updatePageLayout(page.id, "vertical")}
                    className={`p-2 rounded-lg border transition-all ${page.layout === "vertical" ? "bg-primary/20 border-primary text-primary" : "border-outline/10 text-accent/30 hover:text-accent"}`}
                  >
                    <Columns size={18} />
                  </button>
                  <button
                    onClick={() => updatePageLayout(page.id, "dynamic")}
                    className={`p-2 rounded-lg border transition-all ${page.layout === "dynamic" ? "bg-primary/20 border-primary text-primary" : "border-outline/10 text-accent/30 hover:text-accent"}`}
                  >
                    <Layout size={18} />
                  </button>
                </div>
              </div>
              <span className="text-[10px] font-label text-accent/30 uppercase tracking-widest">
                {page.panelIds.length} Panels
              </span>
            </div>

            <div
              className={`grid gap-4 min-h-[400px] ${
                page.layout === "grid"
                  ? "grid-cols-2"
                  : page.layout === "vertical"
                    ? "grid-cols-1"
                    : "grid-cols-3"
              }`}
            >
              {page.panelIds.map((pid, idx) => {
                const panel = panels.find((p) => p.id === pid);
                if (!panel) return null;

                let colSpan = "col-span-1";
                if (page.layout === "dynamic") {
                  if (idx === 0) colSpan = "col-span-2 row-span-2";
                  else colSpan = "col-span-1 row-span-1";
                } else if (
                  page.layout === "grid" &&
                  page.panelIds.length % 2 !== 0 &&
                  idx === page.panelIds.length - 1
                ) {
                  colSpan = "col-span-2";
                }

                return (
                  <div
                    key={pid}
                    className={`${colSpan} bg-background rounded-lg overflow-hidden border border-outline/10 relative group/panel`}
                  >
                    {panel.image ? (
                      <img
                        src={panel.image}
                        className="w-full h-full object-cover opacity-80 group-hover/panel:opacity-100 transition-opacity"
                        alt="Panel"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-surface-container text-accent/20 italic text-xs">
                        No image generated
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-[8px] font-bold text-primary uppercase">
                      Panel {idx + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
