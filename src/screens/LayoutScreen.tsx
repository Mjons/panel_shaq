import React, { useState, useEffect } from "react";
import { ArrowRight, Sparkles, X } from "lucide-react";
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
  webtoon?: boolean; // if true, only shown in webtoon mode; if absent, hidden in webtoon mode
}

export interface Page {
  id: string;
  panelIds: string[];
  layoutId: string;
}

// ── Templates ──

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  // 1-Panel
  {
    id: "1-full",
    name: "Full Page",
    panelCount: 1,
    cols: 1,
    rows: 1,
    slots: [{ colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 }],
  },

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
  {
    id: "2-top-heavy",
    name: "Top Heavy",
    panelCount: 2,
    cols: 1,
    rows: 3,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 3 },
      { colStart: 1, colEnd: 2, rowStart: 3, rowEnd: 4 },
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
  {
    id: "3-t-shape",
    name: "T-Shape",
    panelCount: 3,
    cols: 2,
    rows: 3,
    slots: [
      { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 4 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 4 },
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
  {
    id: "4-1plus3",
    name: "1+3 Top",
    panelCount: 4,
    cols: 3,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 4, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 3, colEnd: 4, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "4-z-shape",
    name: "Z-Shape",
    panelCount: 4,
    cols: 3,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 3, colEnd: 4, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 4, rowStart: 2, rowEnd: 3 },
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
  {
    id: "5-feature-top",
    name: "Feature Top",
    panelCount: 5,
    cols: 4,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 3, colEnd: 5, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 3, colEnd: 5, rowStart: 2, rowEnd: 3 },
    ],
  },
  {
    id: "5-cross",
    name: "Cross",
    panelCount: 5,
    cols: 3,
    rows: 3,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 2, colEnd: 4, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 4, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 3, rowStart: 3, rowEnd: 4 },
      { colStart: 3, colEnd: 4, rowStart: 3, rowEnd: 4 },
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
  {
    id: "6-feature-hero",
    name: "Hero + 5",
    panelCount: 6,
    cols: 4,
    rows: 3,
    slots: [
      { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 3 },
      { colStart: 3, colEnd: 5, rowStart: 1, rowEnd: 2 },
      { colStart: 3, colEnd: 5, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 2, rowStart: 3, rowEnd: 4 },
      { colStart: 2, colEnd: 3, rowStart: 3, rowEnd: 4 },
      { colStart: 3, colEnd: 5, rowStart: 3, rowEnd: 4 },
    ],
  },

  // ── Webtoon Templates (vertical stacks only) ──
  {
    id: "wt-1-full",
    name: "Full Strip",
    panelCount: 1,
    cols: 1,
    rows: 1,
    slots: [{ colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 }],
    webtoon: true,
  },
  {
    id: "wt-2-stack",
    name: "2 Stack",
    panelCount: 2,
    cols: 1,
    rows: 2,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
    ],
    webtoon: true,
  },
  {
    id: "wt-2-hero",
    name: "Hero + Small",
    panelCount: 2,
    cols: 1,
    rows: 3,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 3 },
      { colStart: 1, colEnd: 2, rowStart: 3, rowEnd: 4 },
    ],
    webtoon: true,
  },
  {
    id: "wt-3-stack",
    name: "3 Stack",
    panelCount: 3,
    cols: 1,
    rows: 3,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 2, rowStart: 3, rowEnd: 4 },
    ],
    webtoon: true,
  },
  {
    id: "wt-3-hero-top",
    name: "Hero Top",
    panelCount: 3,
    cols: 2,
    rows: 3,
    slots: [
      { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 3 },
      { colStart: 1, colEnd: 2, rowStart: 3, rowEnd: 4 },
      { colStart: 2, colEnd: 3, rowStart: 3, rowEnd: 4 },
    ],
    webtoon: true,
  },
  {
    id: "wt-4-stack",
    name: "4 Stack",
    panelCount: 4,
    cols: 1,
    rows: 4,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 2, rowStart: 3, rowEnd: 4 },
      { colStart: 1, colEnd: 2, rowStart: 4, rowEnd: 5 },
    ],
    webtoon: true,
  },
  {
    id: "wt-4-mixed",
    name: "Mixed Stack",
    panelCount: 4,
    cols: 2,
    rows: 4,
    slots: [
      { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 3, rowStart: 3, rowEnd: 5 },
    ],
    webtoon: true,
  },
  {
    id: "wt-5-stack",
    name: "5 Stack",
    panelCount: 5,
    cols: 1,
    rows: 5,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 2, rowStart: 3, rowEnd: 4 },
      { colStart: 1, colEnd: 2, rowStart: 4, rowEnd: 5 },
      { colStart: 1, colEnd: 2, rowStart: 5, rowEnd: 6 },
    ],
    webtoon: true,
  },
  {
    id: "wt-5-mixed",
    name: "Mixed Flow",
    panelCount: 5,
    cols: 2,
    rows: 4,
    slots: [
      { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 3, rowStart: 3, rowEnd: 4 },
      { colStart: 1, colEnd: 3, rowStart: 4, rowEnd: 5 },
    ],
    webtoon: true,
  },
  {
    id: "wt-6-stack",
    name: "6 Stack",
    panelCount: 6,
    cols: 1,
    rows: 6,
    slots: [
      { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 2, rowStart: 3, rowEnd: 4 },
      { colStart: 1, colEnd: 2, rowStart: 4, rowEnd: 5 },
      { colStart: 1, colEnd: 2, rowStart: 5, rowEnd: 6 },
      { colStart: 1, colEnd: 2, rowStart: 6, rowEnd: 7 },
    ],
    webtoon: true,
  },
  {
    id: "wt-6-mixed",
    name: "Mixed Scroll",
    panelCount: 6,
    cols: 2,
    rows: 5,
    slots: [
      { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
      { colStart: 1, colEnd: 3, rowStart: 3, rowEnd: 4 },
      { colStart: 1, colEnd: 2, rowStart: 4, rowEnd: 6 },
      { colStart: 2, colEnd: 3, rowStart: 4, rowEnd: 6 },
    ],
    webtoon: true,
  },
];

// ── Helpers ──

const DEFAULT_LAYOUTS: Record<number, string> = {
  1: "1-full",
  2: "2-split",
  3: "3-top-heavy",
  4: "4-grid",
  5: "5-2over3",
  6: "6-3x2",
};

const WEBTOON_DEFAULT_LAYOUTS: Record<number, string> = {
  1: "wt-1-full",
  2: "wt-2-stack",
  3: "wt-3-stack",
  4: "wt-4-stack",
  5: "wt-5-stack",
  6: "wt-6-stack",
};

export function getDefaultLayoutId(
  panelCount: number,
  format?: string,
): string {
  if (format === "webtoon") {
    return WEBTOON_DEFAULT_LAYOUTS[panelCount] || WEBTOON_DEFAULT_LAYOUTS[3]!;
  }
  return DEFAULT_LAYOUTS[panelCount] || DEFAULT_LAYOUTS[4]!;
}

export function getTemplate(layoutId: string): LayoutTemplate | undefined {
  return LAYOUT_TEMPLATES.find((t) => t.id === layoutId);
}

export function getTemplatesForCount(
  count: number,
  format?: string,
): LayoutTemplate[] {
  return LAYOUT_TEMPLATES.filter((t) => {
    if (t.panelCount !== count) return false;
    if (format === "webtoon") return !!t.webtoon;
    return !t.webtoon;
  });
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
    className={`p-1 rounded-md border-2 transition-all hover:scale-105 ${
      isActive
        ? "border-primary bg-primary/10 shadow-[0_0_8px_rgba(255,145,0,0.2)]"
        : "border-outline/20 bg-background hover:border-primary/40"
    }`}
  >
    <div
      className="w-10 h-8 gap-[1px]"
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
  </button>
);

// ── Main Screen ──

const PAGE_FORMATS: Record<
  string,
  { label: string; aspect: string; ratio: [number, number] }
> = {
  portrait: { label: "Portrait", aspect: "aspect-[3/4]", ratio: [3, 4] },
  square: { label: "Square", aspect: "aspect-square", ratio: [1, 1] },
  webtoon: { label: "Webtoon", aspect: "aspect-[9/20]", ratio: [9, 20] },
};

export { PAGE_FORMATS };

interface LayoutScreenProps {
  panels: PanelPrompt[];
  pages: Page[];
  setPages: React.Dispatch<React.SetStateAction<Page[]>>;
  onContinue: () => void;
  pageFormat: string;
  setPageFormat: (format: string) => void;
}

export const LayoutScreen: React.FC<LayoutScreenProps> = ({
  panels,
  pages,
  setPages,
  onContinue,
  pageFormat,
  setPageFormat,
}) => {
  const [panelsPerPage, setPanelsPerPage] = useState(4);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem("panelshaq_layout_onboarding_dismissed"),
  );

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
          layoutId: getDefaultLayoutId(pagePanel.length, pageFormat),
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

  // Change panel count for a single page — redistributes panels from the flat list
  const changePagePanelCount = (pageIdx: number, newCount: number) => {
    setPages((prev) => {
      // Collect all panel IDs in order across all pages
      const allPanelIds = prev.flatMap((p) => p.panelIds);
      // Find where this page's panels start
      let startIdx = 0;
      for (let i = 0; i < pageIdx; i++) startIdx += prev[i].panelIds.length;
      const oldCount = prev[pageIdx].panelIds.length;
      const diff = newCount - oldCount;

      if (diff === 0) return prev;

      // Rebuild pages: this page gets newCount panels, subsequent pages shift
      const newPages: Page[] = [];
      let cursor = 0;
      for (let i = 0; i < prev.length; i++) {
        const count = i === pageIdx ? newCount : prev[i].panelIds.length;
        const ids = allPanelIds.slice(cursor, cursor + count);
        if (ids.length === 0) continue; // skip empty pages
        newPages.push({
          id: prev[i].id || `page-${Math.random().toString(36).substr(2, 9)}`,
          panelIds: ids,
          layoutId:
            ids.length === prev[i].panelIds.length
              ? prev[i].layoutId
              : getDefaultLayoutId(ids.length, pageFormat),
        });
        cursor += count;
      }
      // If there are leftover panels, add them as new pages
      while (cursor < allPanelIds.length) {
        const remaining = allPanelIds.slice(cursor, cursor + panelsPerPage);
        newPages.push({
          id: `page-${Math.random().toString(36).substr(2, 9)}`,
          panelIds: remaining,
          layoutId: getDefaultLayoutId(remaining.length, pageFormat),
        });
        cursor += remaining.length;
      }
      return newPages;
    });
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
        layoutId: getDefaultLayoutId(pagePanel.length, pageFormat),
      });
    }
    setPages(newPages);
  };

  return (
    <div className="pt-24 px-6 max-w-7xl mx-auto pb-32">
      {/* Header */}
      <div className="mb-6">
        <span className="font-label text-primary uppercase tracking-[0.2em] text-[10px] mb-2 block font-bold">
          Step 3: Composition
        </span>
        <h2 className="font-headline text-4xl md:text-5xl font-bold text-accent leading-tight">
          Layout Architect
        </h2>
      </div>

      {/* Onboarding */}
      {pages.length > 0 && showOnboarding && (
        <div className="mb-6 p-5 bg-surface-container/50 border-l-4 border-primary/60 rounded-r-xl">
          <p className="font-label text-primary uppercase tracking-[0.2em] text-[10px] font-bold mb-2">
            Step 3 of 4 — Arrange Your Pages
          </p>
          <p className="text-accent/70 text-sm leading-relaxed mb-3">
            Your panels have been grouped into pages. Pick a layout for each
            page, or change how many panels each page gets.
            <span className="text-accent/50">
              {" "}
              Speech bubbles & finishing come next.
            </span>
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-accent/40">
            <span>• Tap a layout thumbnail to change the arrangement</span>
            <span>
              • Use the number buttons on each page to adjust panel count
            </span>
            <span>
              • Use the global settings below to set format & panels per page
            </span>
          </div>
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setShowOnboarding(false);
                localStorage.setItem(
                  "panelshaq_layout_onboarding_dismissed",
                  "1",
                );
              }}
              className="px-6 py-2 bg-secondary text-background font-headline font-bold text-sm rounded-lg hover:opacity-90 active:scale-95 transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Global Page Settings */}
      <div className="mb-8 bg-surface-container/30 rounded-xl p-5 border border-outline/10 space-y-4">
        <p className="font-label text-accent/50 uppercase tracking-[0.15em] text-[9px] font-bold">
          Global Page Settings
        </p>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-accent/40 font-bold uppercase tracking-widest w-16 shrink-0">
              Format
            </span>
            <div className="bg-surface-container p-1 rounded-lg flex gap-1 border border-outline/10">
              {Object.entries(PAGE_FORMATS).map(([key, fmt]) => (
                <button
                  key={key}
                  onClick={() => setPageFormat(key)}
                  className={`px-3 py-2 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 ${pageFormat === key ? "bg-primary text-background" : "text-accent/50 hover:text-accent"}`}
                >
                  <span
                    className={`rounded-[2px] border ${pageFormat === key ? "border-background/50 bg-background/20" : "border-accent/30"}`}
                    style={{
                      width: Math.round(
                        (fmt.ratio[0] / Math.max(...fmt.ratio)) * 10,
                      ),
                      height: Math.round(
                        (fmt.ratio[1] / Math.max(...fmt.ratio)) * 10,
                      ),
                    }}
                  />
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-accent/40 font-bold uppercase tracking-widest w-16 shrink-0">
              Panels
            </span>
            <div className="bg-surface-container p-1 rounded-lg flex gap-1 border border-outline/10">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  onClick={() => repartitionPages(num)}
                  className={`px-3 py-2 rounded-md text-[10px] font-bold transition-all ${panelsPerPage === num ? "bg-primary text-background" : "text-accent/50 hover:text-accent"}`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={onContinue}
          className="w-full flex items-center justify-center gap-3 bg-secondary text-background px-8 py-4 rounded-lg font-headline font-extrabold tracking-tight hover:opacity-90 active:scale-95 transition-all shadow-xl"
        >
          CONTINUE TO EDITOR
          <ArrowRight size={20} />
        </button>
      </div>

      {pages.length > 0 && (
        <p className="text-[10px] text-accent/30 italic text-center mb-2">
          Panel images are for reference only — positioning and sizing are set
          in the Editor.
        </p>
      )}

      <div className="space-y-12">
        {pages.map((page, pageIdx) => {
          const template = getTemplate(page.layoutId);
          const availableTemplates = getTemplatesForCount(
            page.panelIds.length,
            pageFormat,
          );

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
                  <div className="flex items-center gap-1 bg-background rounded-md p-0.5 border border-outline/10">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        onClick={() => changePagePanelCount(pageIdx, n)}
                        className={`px-2 py-1 rounded text-[9px] font-bold transition-all ${page.panelIds.length === n ? "bg-primary text-background" : "text-accent/40 hover:text-accent/70"}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                {template && (
                  <span className="text-[10px] font-label text-primary uppercase tracking-widest font-bold">
                    {template.name}
                  </span>
                )}
              </div>

              {/* Template picker */}
              {availableTemplates.length > 0 && (
                <div className="grid grid-cols-5 gap-1.5 mb-6 pb-4 border-b border-outline/10">
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
                className={`gap-2 p-2 ${PAGE_FORMATS[pageFormat]?.aspect || "aspect-[3/4]"}`}
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
                          className="w-full h-full object-contain opacity-80 group-hover/panel:opacity-100 transition-opacity"
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
