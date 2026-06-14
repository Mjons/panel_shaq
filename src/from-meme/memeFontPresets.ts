import type { MemeZoneStyle } from "./zoneTypes";

// The 5 user-selectable font presets, mirroring PanelHaus's QuickFontBar
// (memeFontPresets.js). Applying a preset swaps a caption's style while keeping
// its position + size. Fonts are the web equivalents bundled in index.html
// (Impact → Anton, etc.).

export interface MemeFontPreset {
  id: string;
  label: string;
  style: MemeZoneStyle;
  /** Optional default font size (ratio of image width) applied when this preset
   * is picked. Impact uses it to render big by default. */
  fontSizeRatio?: number;
}

export const MEME_FONT_PRESETS: MemeFontPreset[] = [
  {
    id: "impact-classic",
    label: "Impact",
    // Impact = the classic meme look: white text + a thick black stroke.
    style: {
      color: "#ffffff",
      fontFamily: "Anton, 'Arial Black', Impact, sans-serif",
      fontWeight: 700,
      italic: false,
      allCaps: true,
      textAlign: "center",
      lineHeight: 1.1,
      outline: { color: "#000000", widthEm: 0.09 }, // ~2x thicker stroke
      box: null,
    },
  },
  {
    id: "wojak",
    label: "Wojak",
    style: {
      color: "#000000",
      fontFamily: "'Comic Sans MS', 'Comic Neue', cursive",
      fontWeight: 400,
      italic: false,
      allCaps: false,
      textAlign: "center",
      lineHeight: 1.15,
      outline: null,
      box: null,
    },
  },
  {
    id: "modern-slab",
    label: "Slab",
    style: {
      color: "#000000",
      fontFamily: "Inter, Helvetica, Arial, sans-serif",
      fontWeight: 700,
      italic: false,
      allCaps: true,
      textAlign: "center",
      lineHeight: 1.1,
      outline: null,
      box: {
        backgroundColor: "#ffffff",
        borderColor: "transparent",
        borderWidth: 0,
      },
    },
  },
  {
    id: "marker",
    label: "Marker",
    style: {
      color: "#ffffff",
      fontFamily: "'Permanent Marker', cursive",
      fontWeight: 400,
      italic: false,
      allCaps: false,
      textAlign: "center",
      lineHeight: 1.15,
      outline: { color: "#000000", widthEm: 0.06 },
      box: null,
    },
  },
  {
    id: "typewriter",
    label: "Type",
    style: {
      color: "#000000",
      fontFamily: "'Special Elite', 'Courier New', monospace",
      fontWeight: 400,
      italic: false,
      allCaps: false,
      textAlign: "left",
      lineHeight: 1.2,
      outline: null,
      box: null,
    },
  },
];

/** Best-effort match of a zone's current style back to a preset id (for UI highlight). */
export function detectPresetId(style: MemeZoneStyle): string | null {
  return (
    MEME_FONT_PRESETS.find((p) => p.style.fontFamily === style.fontFamily)
      ?.id ?? null
  );
}
