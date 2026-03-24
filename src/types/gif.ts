export type GifMovement =
  | "hold"
  | "pan-lr"
  | "pan-rl"
  | "pan-ud"
  | "zoom-in"
  | "zoom-out"
  | "fade-in"
  | "fade-out";

export type GifTransition =
  | "cut"
  | "cross-fade"
  | "wipe-left"
  | "wipe-up"
  | "flash";

export interface GifPanelConfig {
  panelId: string;
  imageData: string; // base64 or blob URL — captured panel with bubbles
  movement: GifMovement;
  duration: number; // seconds (0.5–5.0)
  transitionOut: GifTransition;
  transitionDuration: number; // seconds
  skip?: boolean;
  zoomAmount?: number; // 1.0–2.0
  shake?: boolean;
  shakeIntensity?: number; // 1–10
  pulse?: boolean;
  pulseAmount?: number; // 1.05–1.2
  aspectRatio: number; // width / height of source panel image
}

export interface GifProject {
  panels: GifPanelConfig[];
  width: number;
  height: number;
  fps: number;
  loop: boolean;
}

export type GifPreset =
  | "story-flow"
  | "cinematic"
  | "dramatic"
  | "slideshow"
  | "custom";

/** Build smart defaults for a panel based on its aspect ratio and position */
export function defaultPanelConfig(
  panelId: string,
  imageData: string,
  aspectRatio: number,
  index: number,
  total: number,
): GifPanelConfig {
  let movement: GifMovement = "hold";
  if (aspectRatio > 1.5) movement = "pan-lr";
  else if (aspectRatio < 0.67) movement = "pan-ud";
  if (index === 0) movement = "fade-in";
  if (index === total - 1) movement = "fade-out";

  return {
    panelId,
    imageData,
    movement,
    duration: 1.2,
    transitionOut: "cut",
    transitionDuration: 0.3,
    aspectRatio,
  };
}

/** Apply a preset to all panels, returning new configs */
export function applyPreset(
  panels: GifPanelConfig[],
  preset: GifPreset,
): GifPanelConfig[] {
  return panels.map((p, i) => {
    switch (preset) {
      case "story-flow":
        return {
          ...p,
          movement: "hold" as const,
          duration: 1.2,
          transitionOut: "cut" as const,
        };
      case "cinematic":
        return {
          ...p,
          movement: (i % 2 === 0 ? "zoom-in" : "pan-lr") as GifMovement,
          duration: 1.5,
          transitionOut: "cross-fade" as const,
          transitionDuration: 0.5,
        };
      case "dramatic":
        return {
          ...p,
          movement: (p.aspectRatio <= 1 ? "zoom-in" : "hold") as GifMovement,
          duration: 1.0,
          transitionOut: "flash" as const,
          transitionDuration: 0.2,
          shake: p.aspectRatio <= 1,
          shakeIntensity: 5,
        };
      case "slideshow":
        return {
          ...p,
          movement: "hold" as const,
          duration: 3.0,
          transitionOut: "cut" as const,
        };
      case "custom":
      default:
        return p;
    }
  });
}
