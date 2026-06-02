// Shared types for the MemeGen → Panel Shaq meme text-zone system.
//
// Zone geometry is normalized 0–1 (relative to the displayed image box), with
// x/y at the TOP-LEFT of the box and rotation applied about the box center —
// matching how PanelHaus desktop stores meme text bubbles. Font size is carried
// as a ratio of the image WIDTH so it scales with any rendered size while
// preserving the desktop proportions.

export interface MemeZoneStyle {
  /** Text color (PanelHaus `fontColor`). */
  color: string;
  /** Web-friendly font stack (Impact stacks are rewritten to lead with Anton). */
  fontFamily: string;
  /** 700 when the PanelHaus preset is bold, else 400. */
  fontWeight: number;
  italic: boolean;
  /** Render text uppercase (classic Impact look). */
  allCaps: boolean;
  textAlign: "left" | "center" | "right";
  lineHeight: number;
  /** Text stroke/outline, or null. `widthEm` is relative to font size (resolution-independent). */
  outline: { color: string; widthEm: number } | null;
  /** Solid background box behind the text (e.g. the `modern-slab` white box), or null. */
  box: { backgroundColor: string; borderColor: string; borderWidth: number } | null;
}

export interface MemeZone {
  id: string;
  /** Normalized 0–1, top-left anchored. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, about the box center. */
  rotation?: number;
  /** fontSize / customDimension.width — multiply by container width for px. */
  fontSizeRatio: number;
  /** Default placeholder caption from the template. */
  text: string;
  style: MemeZoneStyle;
}

export interface MemeTemplateZones {
  /** customDimension.width / customDimension.height (reference only). */
  aspect: number;
  /** Template background filename, served from /templates/ (admin calibration only). */
  image: string;
  zones: MemeZone[];
}

export type MemeZoneRegistry = Record<string, MemeTemplateZones>;
