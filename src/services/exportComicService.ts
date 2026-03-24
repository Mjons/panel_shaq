import type { PanelPrompt, Bubble } from "./geminiService";
import type { Page, LayoutTemplate, LayoutSlot } from "../screens/LayoutScreen";
import { getTemplate } from "../screens/LayoutScreen";
import type { VaultEntry } from "../screens/VaultScreen";

// Default Desktop page dimensions (portrait)
const PAGE_WIDTH = 490;
const PAGE_HEIGHT = 700;
const MARGIN = 10;
const GAP = 6;

// ── Grid-to-Pixel Converter ──

interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function slotsToPixels(
  template: LayoutTemplate,
  pageW = PAGE_WIDTH,
  pageH = PAGE_HEIGHT,
  margin = MARGIN,
  gap = GAP,
): PanelRect[] {
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;
  const cellW = (usableW - (template.cols - 1) * gap) / template.cols;
  const cellH = (usableH - (template.rows - 1) * gap) / template.rows;

  return template.slots.map((slot: LayoutSlot) => {
    const col0 = slot.colStart - 1;
    const col1 = slot.colEnd - 1;
    const row0 = slot.rowStart - 1;
    const row1 = slot.rowEnd - 1;

    const x = Math.round(margin + col0 * (cellW + gap));
    const y = Math.round(margin + row0 * (cellH + gap));
    const w = Math.round((col1 - col0) * cellW + (col1 - col0 - 1) * gap);
    const h = Math.round((row1 - row0) * cellH + (row1 - row0 - 1) * gap);

    return { x, y, width: Math.max(w, cellW), height: Math.max(h, cellH) };
  });
}

// ── Bubble Mapper ──

const BUBBLE_TYPE_MAP: Record<string, string> = {
  speech: "speech-bubble",
  thought: "thought-bubble",
  action: "shout-bubble",
  effect: "caption-box",
  "sfx-impact": "shout-bubble",
  "sfx-ambient": "caption-box",
  narration: "caption-box",
  "pop-text": "shout-bubble",
};

function mapBubble(bubble: Bubble, panelRect: PanelRect) {
  // Convert percentage position to pixel position within panel
  const x = Math.round(panelRect.x + (bubble.pos.x / 100) * panelRect.width);
  const y = Math.round(panelRect.y + (bubble.pos.y / 100) * panelRect.height);

  // Calculate tail angle from bubble center to tail tip
  let tailAngle = 270;
  if (bubble.tailPos) {
    const dx = bubble.tailPos.x - bubble.pos.x;
    const dy = bubble.tailPos.y - bubble.pos.y;
    tailAngle = Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360);
  }

  return {
    id: `bubble-${bubble.id}`,
    bubbleType: BUBBLE_TYPE_MAP[bubble.style] || "speech-bubble",
    text: bubble.text,
    x,
    y,
    width: 200,
    height: 80,
    style: {
      fontFamily: "Comic Sans MS",
      fontSize: bubble.fontSize || 14,
      fontColor: "#000000",
      bold: bubble.fontWeight === "bold",
      italic: bubble.fontStyle === "italic",
      textAlign: "center",
      lineHeight: 1.2,
    },
    bubble: {
      backgroundColor: "#FFFFFF",
      borderColor: "#000000",
      borderWidth: 2,
      opacity: 1,
      shadowColor: "rgba(0,0,0,0.15)",
      shadowBlur: 4,
      shadowX: 2,
      shadowY: 2,
    },
    tailAngle,
    tailLength: 1.5,
    tailWidth: 1,
    rotation: 0,
    globalZIndex: 0,
    isVisible: true,
  };
}

// ── Vault Entry → Blueprint Mapper ──

function mapVaultEntry(entry: VaultEntry) {
  const typeMap: Record<string, string> = {
    Character: "character",
    Environment: "environment",
    Prop: "character",
    Vehicle: "vehicle",
  };

  const id = `bp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const description = [
    entry.description,
    entry.personality ? `Personality: ${entry.personality}` : "",
    entry.visualLook ? `Visual: ${entry.visualLook}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  return {
    id,
    name: entry.name,
    type: typeMap[entry.type] || "character",
    description,
    referenceImageId: entry.image?.startsWith("data:image/")
      ? id + "_img"
      : null,
    thumbnailDataUrl: entry.image?.startsWith("data:image/")
      ? entry.image
      : null,
    vibeTags: null,
    avoidDescription: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ── Main Export ──

export function exportAsComic(
  projectName: string,
  story: string,
  pages: Page[],
  panels: PanelPrompt[],
  vaultEntries: VaultEntry[],
): string {
  const panelMap = new Map(panels.map((p) => [p.id, p]));

  const desktopPages = pages.map((page) => {
    const template = getTemplate(page.layoutId);
    const rects = template
      ? slotsToPixels(template)
      : page.panelIds.map((_, i) => ({
          x: MARGIN,
          y: MARGIN + i * (PAGE_HEIGHT / page.panelIds.length),
          width: PAGE_WIDTH - MARGIN * 2,
          height: PAGE_HEIGHT / page.panelIds.length - MARGIN,
        }));

    const desktopPanels = page.panelIds.map((pid, i) => {
      const panel = panelMap.get(pid);
      const rect = rects[i] || rects[0];

      return {
        id: `panel-${pid}`,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        imageSrc: panel?.image || "",
        imageId: `img_${pid}`,
        imageTransform: {
          x: 0,
          y: 0,
          scale: -1,
          rotation: 0,
          flipH: false,
          flipV: false,
        },
        strokeWidth: panel?.borderWidth || 2,
        strokeColor:
          panel?.borderColor && panel.borderColor !== "none"
            ? panel.borderColor
            : "#000000",
        showOutline: true,
        visible: true,
        locked: false,
        zIndex: i,
      };
    });

    // Collect all bubbles from panels on this page
    const textBubbles = page.panelIds.flatMap((pid, i) => {
      const panel = panelMap.get(pid);
      const rect = rects[i] || rects[0];
      return (panel?.bubbles || []).map((b) => mapBubble(b, rect));
    });

    return {
      id: `page-${page.id}`,
      dimension: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
      layers: {
        panels: desktopPanels,
        textBubbles,
        stickers: [],
        background: null,
      },
    };
  });

  const blueprints = vaultEntries.map(mapVaultEntry);

  const comicFile = {
    version: "2.0.0",
    metadata: {
      createdAt: new Date().toISOString(),
      name: projectName || "Untitled Project",
      embeddedImages: true,
      source: "panelshaq",
      sourceVersion: "1.0.0",
    },
    project: {
      id: crypto.randomUUID(),
      name: projectName || "Untitled Project",
      pages: desktopPages,
      generatedStories: story
        ? [
            {
              id: crypto.randomUUID(),
              title: "Imported Story",
              content: story,
              createdAt: new Date().toISOString(),
            },
          ]
        : [],
      blueprints,
    },
  };

  return JSON.stringify(comicFile);
}

export async function downloadComicFile(json: string, projectName: string) {
  const safeName = (projectName || "Untitled").replace(/[^a-zA-Z0-9-_ ]/g, "");
  // Try shareable file types in order of preference
  const fileConfigs = [
    { name: `${safeName}.comic`, type: "application/octet-stream" },
    { name: `${safeName}.json`, type: "application/json" },
    { name: `${safeName}.comic.json`, type: "application/json" },
    { name: `${safeName}.txt`, type: "text/plain" },
  ];

  for (const cfg of fileConfigs) {
    const f = new File([json], cfg.name, { type: cfg.type });
    const ok = navigator.canShare?.({ files: [f] });
    console.log(`canShare "${cfg.name}" (${cfg.type}):`, ok);
  }

  // Use first config that canShare accepts
  let file: File | null = null;
  for (const cfg of fileConfigs) {
    const f = new File([json], cfg.name, { type: cfg.type });
    if (navigator.canShare?.({ files: [f] })) {
      file = f;
      break;
    }
  }

  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: `${safeName}.comic`,
        text: "Made with Panelhaus",
        files: [file],
      });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }

  // Fallback: direct download
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeName}.comic`;
  link.click();
  URL.revokeObjectURL(url);
}
