import React, { useState, useEffect } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { PanelPrompt } from "../services/geminiService";

// ── Layout Template System ──

export interface LayoutSlot {
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
}

export interface LayoutTemplate {
  id: string;
  name: string;
  panelCount: number;
  cols: number;
  rows: number;
  slots: LayoutSlot[];
}

export interface Page {
  id: string;
  panelIds: string[];
  layoutId: string;
}

// ── Templates ──

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  // 2-Panel
  {
    id: "2-split",
    name: "50/50 Split",
    panelCount: 2,
    cols: 2,
    rows: 1,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
    ],
  },
  {
    id: "2-stack",
    name: "Vertical Stack",
    panelCount: 2,
    cols: 1,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "2-sidebar",
    name: "Sidebar Left",
    panelCount: 2,
    cols: 3,
    rows: 1,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 4, rowStart: 1, rowEnd: 2 },
    ],
  },
  {
    id: "2-sidebar-right",
    name: "Sidebar Right",
    panelCount: 2,
    cols: 3,
    rows: 1,
    slots: [
      { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 3, colEnd: 4, rowStart: 1, rowEnd: 2 },
    ],
  },

  // 3-Panel
  {
    id: "3-top-heavy",
    name: "Top Heavy",
    panelCount: 3,
    cols: 2,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 3, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "3-bottom-split",
    name: "Bottom Split",
    panelCount: 3,
    cols: 2,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "3-feature-left",
    name: "Feature Left",
    panelCount: 3,
    cols: 2,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "3-feature-right",
    name: "Feature Right",
    panelCount: 3,
    cols: 2,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 3 },
    ],
  },
  {
    id: "3-l-shape",
    name: "L-Shape",
    panelCount: 3,
    cols: 3,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 4, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 4, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "3-vertical",
    name: "Triple Stack",
    panelCount: 3,
    cols: 1,
    rows: 3,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 2, rowStart: 3, rowEnd: 4 },
    ],
  },

  // 4-Panel
  {
    id: "4-grid",
    name: "Classic Grid",
    panelCount: 4,
    cols: 2,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "4-staggered",
    name: "Staggered",
    panelCount: 4,
    cols: 2,
    rows: 3,
    slots: [
      { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 4 },
      { colStart: 1, colEnd: 2, rowStart: 3, rowEnd: 4 },
    ],
  },
  {
    id: "4-3plus1",
    name: "3+1 Bottom",
    panelCount: 4,
    cols: 3,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 3, colEnd: 4, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 4, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "4-feature-stack",
    name: "Feature + Stack",
    panelCount: 4,
    cols: 2,
    rows: 3,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 3, rowStart: 3, rowEnd: 4 },
    ],
  },
  {
    id: "4-vertical",
    name: "Quad Stack",
    panelCount: 4,
    cols: 1,
    rows: 4,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 2, rowStart: 3, rowEnd: 4 },
      { colStart: 1, colEnd: 2, rowStart: 4, rowEnd: 5 },
    ],
  },

  // 5-Panel
  {
    id: "5-2over3",
    name: "2-over-3",
    panelCount: 5,
    cols: 6,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 4, rowStart: 1, rowEnd: 2 },
      { colStart: 4, colEnd: 7, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 3, colEnd: 5, rowStart: 2, rowEnd: 3 },
      { colStart: 5, colEnd: 7, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "5-manga",
    name: "Manga Flow",
    panelCount: 5,
    cols: 3,
    rows: 3,
    slots: [
      { colStart: 1, colEnd: 4, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 3, colEnd: 4, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 4, rowStart: 3, rowEnd: 4 },
    ],
  },
  {
    id: "5-asymmetric",
    name: "Asymmetric",
    panelCount: 5,
    cols: 3,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 3, colEnd: 4, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 4, rowStart: 2, rowEnd: 3 },
    ],
  },

  // 6-Panel
  {
    id: "6-3x2",
    name: "Classic 3x2",
    panelCount: 6,
    cols: 3,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 3, colEnd: 4, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 3, colEnd: 4, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "6-wide-narrow",
    name: "Wide + Narrow",
    panelCount: 6,
    cols: 4,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 3, colEnd: 5, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 3, colEnd: 4, rowStart: 2, rowEnd: 3 },
      { colStart: 4, colEnd: 5, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "6-pyramid",
    name: "Pyramid",
    panelCount: 6,
    cols: 4,
    rows: 3,
    slots: [
      { colStart: 1, colEnd: 5, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 3, colEnd: 5, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 2, rowStart: 3, rowEnd: 4 },
      { colStart: 2, colEnd: 3, rowStart: 3, rowEnd: 4 },
      { colStart: 3, colEnd: 5, rowStart: 3, rowEnd: 4 },
    ],
  },
  {
    id: "6-2x3",
    name: "Classic 2x3",
    panelCount: 6,
    cols: 2,
    rows: 3,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 2, rowStart: 3, rowEnd: 4 },
      { colStart: 2, colEnd: 3, rowStart: 3, rowEnd: 4 },
    ],
  },
];

// ── Helpers ──

const DEFAULT_LAYOUTS: Record<number, string> = {
  2: "2-split",
  3: "3-top-heavy",
  4: "4-grid",
  5: "5-2over3",
  6: "6-3x2",
};

export function getDefaultLayoutId(panelCount: number): string {
  return DEFAULT_LAYOUTS[panelCount] || DEFAULT_LAYOUTS[4]!;
}

export function getTemplate(layoutId: string): LayoutTemplate | undefined {
  return LAYOUT_TEMPLATES.find((t) => t.id === layoutId);
}

export function getTemplatesForCount(count: number): LayoutTemplate[] {
  return LAYOUT_TEMPLATES.filter((t) => t.panelCount === count);
}

/** Migrate old Page.layout to Page.layoutId */
export function migratePage(page: any): Page {
  if (page.layoutId) return page as Page;
  const oldLayout = page.layout as string | undefined;
  const panelCount = page.panelIds?.length || 4;
  let layoutId: string;
  if (oldLayout === "vertical") layoutId = "2-stack";
  else if (oldLayout === "dynamic") layoutId = "4-feature-stack";
  else layoutId = getDefaultLayoutId(panelCount);
  return { id: page.id, panelIds: page.panelIds, layoutId };
}

// ── Template Thumbnail Component ──

const TemplateThumbnail: React.FC<{
  template: LayoutTemplate;
  isActive: boolean;
  onClick: () => void;
}> = ({ template, isActive, onClick }) => (
  <button
    onClick={onClick}
    title={template.name}
    className={`p-1.5 rounded-lg border-2 transition-all hover:scale-105 ${
      isActive
        ? "border-primary bg-primary/10 shadow-[0_0_12px_rgba(255,145,0,0.2)]"
        : "border-outline/20 bg-background hover:border-primary/40"
    }`}
  >
    <div
      className="w-16 h-12 gap-[2px]"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${template.cols}, 1fr)`,
        gridTemplateRows: `repeat(${template.rows}, 1fr)`,
      }}
    >
      {template.slots.map((slot, i) => (
        <div
          key={i}
          className={`rounded-sm ${isActive ? "bg-primary/60" : "bg-accent/20"}`}
          style={{
            gridColumn: `${slot.colStart} / ${slot.colEnd}`,
            gridRow: `${slot.rowStart} / ${slot.rowEnd}`,
          }}
        />
      ))}
    </div>
    <p
      className={`text-[7px] font-bold uppercase tracking-wider mt-1 text-center truncate ${
        isActive ? "text-primary" : "text-accent/40"
      }`}
    >
      {template.name}
    </p>
  </button>
);

// ── Main Screen ──

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

  // Migrate old pages on mount
  useEffect(() => {
    if (pages.length > 0 && !(pages[0] as any).layoutId) {
      setPages((prev) => prev.map(migratePage));
    }
  }, []);

  // Initial page generation if none exist
  useEffect(() => {
    if (pages.length === 0 && panels.length > 0) {
      const newPages: Page[] = [];
      for (let i = 0; i < panels.length; i += panelsPerPage) {
        const pagePanel = panels.slice(i, i + panelsPerPage);
        newPages.push({
          id: `page-${Math.random().toString(36).substr(2, 9)}`,
          panelIds: pagePanel.map((p) => p.id),
          layoutId: getDefaultLayoutId(pagePanel.length),
        });
      }
      setPages(newPages);
    }
  }, [panels, pages.length, panelsPerPage, setPages]);

  const updatePageLayout = (pageId: string, layoutId: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, layoutId } : p)),
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
      const pagePanel = panels.slice(i, i + count);
      newPages.push({
        id: `page-${Math.random().toString(36).substr(2, 9)}`,
        panelIds: pagePanel.map((p) => p.id),
        layoutId: getDefaultLayoutId(pagePanel.length),
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
        {pages.map((page, pageIdx) => {
          const template = getTemplate(page.layoutId);
          const availableTemplates = getTemplatesForCount(page.panelIds.length);

          return (
            <div
              key={page.id}
              className="bg-surface rounded-2xl p-8 border border-outline/10 shadow-2xl relative group"
            >
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 bg-primary text-background w-8 h-8 rounded-full flex items-center justify-center font-headline font-bold shadow-lg z-10">
                {pageIdx + 1}
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <h3 className="font-headline text-xl font-bold text-accent">
                    Page {pageIdx + 1}
                  </h3>
                  <span className="text-[10px] font-label text-accent/30 uppercase tracking-widest">
                    {page.panelIds.length} Panels
                  </span>
                </div>
                {template && (
                  <span className="text-[10px] font-label text-primary uppercase tracking-widest font-bold">
                    {template.name}
                  </span>
                )}
              </div>

              {/* Template picker */}
              {availableTemplates.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-outline/10">
                  {availableTemplates.map((t) => (
                    <TemplateThumbnail
                      key={t.id}
                      template={t}
                      isActive={page.layoutId === t.id}
                      onClick={() => updatePageLayout(page.id, t.id)}
                    />
                  ))}
                </div>
              )}

              {/* Page preview */}
              <div
                className="gap-3 min-h-[400px]"
                style={
                  template
                    ? {
                        display: "grid",
                        gridTemplateColumns: `repeat(${template.cols}, 1fr)`,
                        gridTemplateRows: `repeat(${template.rows}, 1fr)`,
                      }
                    : { display: "grid", gridTemplateColumns: "repeat(2, 1fr)" }
                }
              >
                {page.panelIds.map((pid, idx) => {
                  const panel = panels.find((p) => p.id === pid);
                  if (!panel) return null;
                  const slot = template?.slots[idx];

                  return (
                    <div
                      key={pid}
                      className="bg-background rounded-lg overflow-hidden border border-outline/10 relative group/panel"
                      style={
                        slot
                          ? {
                              gridColumn: `${slot.colStart} / ${slot.colEnd}`,
                              gridRow: `${slot.rowStart} / ${slot.rowEnd}`,
                            }
                          : undefined
                      }
                    >
                      {panel.image ? (
                        <img
                          src={panel.image}
                          className="w-full h-full object-cover opacity-80 group-hover/panel:opacity-100 transition-opacity"
                          alt="Panel"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface-container text-accent/20 italic text-xs min-h-[120px]">
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
          );
        })}
      </div>

      {/* Bottom continue button */}
      {pages.length > 0 && (
        <div className="flex justify-center pt-8">
          <button
            onClick={onContinue}
            className="flex items-center justify-center gap-3 bg-secondary text-background px-10 py-4 rounded-lg font-headline font-extrabold tracking-tight hover:opacity-90 active:scale-95 transition-all shadow-[0_10px_20px_rgba(255,214,0,0.15)]"
          >
            CONTINUE TO EDITOR
            <ArrowRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
};
