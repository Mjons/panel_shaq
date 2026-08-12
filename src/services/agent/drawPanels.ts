import { generatePanelImage, type PanelPrompt } from "../geminiService";
import type { VaultEntry } from "../../screens/VaultScreen";

// P5 — drawing. Composes the image prompt for one panel and renders it, reusing
// the exported generatePanelImage (which goes through apiPost, so ink + auth +
// out-of-ink are handled exactly like a manual generation). The composition
// MIRRORS DirectorScreen.tsx:1530-1622 so a Smudge-drawn panel looks identical to
// a hand-drawn one; keep the two in step if that composition changes.

function isData(img?: string): img is string {
  return !!img && img.startsWith("data:image/");
}

/** Build the exact prompt + reference-image set a manual generation would. */
export function composePanelPrompt(
  panel: PanelPrompt,
  vault: VaultEntry[],
): { prompt: string; refs: string[]; aspectRatio: string } {
  const byId = new Map(vault.map((v) => [v.id, v]));
  const pick = (ids: string[] | undefined, type: VaultEntry["type"]) =>
    (ids ?? [])
      .map((id) => byId.get(id))
      .filter((v): v is VaultEntry => !!v && v.type === type);

  const chars = pick(panel.selectedCharacterIds, "Character");
  const charRefs = [
    ...(panel.customReferenceImages ?? []),
    ...chars.map((c) => c.image),
  ]
    .filter(isData)
    .slice(0, 5);
  const characterContext = chars
    .map((c) => {
      let ctx = `${c.name}: ${c.description || ""}`;
      if (c.visualLook) ctx += `. Visual details: ${c.visualLook}`;
      if (c.personality) ctx += `. Personality/demeanor: ${c.personality}`;
      return ctx;
    })
    .join(". ");

  const bg = panel.selectedBackgroundId
    ? byId.get(panel.selectedBackgroundId)
    : null;
  const bgRef = isData(bg?.image) ? bg!.image : null;
  const bgContext = bg
    ? `Background/Setting: ${bg.name}${bg.description ? ` — ${bg.description}` : ""}. Use this environment consistently. IMPORTANT: The background reference image is for the ENVIRONMENT ONLY — ignore any people, characters, or figures visible in it.`
    : "";

  const propsUsed = pick(panel.selectedPropIds, "Prop");
  const propRefs = propsUsed.map((p) => p.image).filter(isData);
  const propContext =
    propsUsed.length > 0
      ? `Props in scene: ${propsUsed.map((p) => `${p.name}${p.description ? ` (${p.description})` : ""}`).join(", ")}. Include these objects as shown in their reference images.`
      : "";

  const vehiclesUsed = pick(panel.selectedVehicleIds, "Vehicle");
  const vehicleRefs = vehiclesUsed.map((v) => v.image).filter(isData);
  const vehicleContext =
    vehiclesUsed.length > 0
      ? `Vehicles in scene: ${vehiclesUsed.map((v) => `${v.name}${v.description ? ` (${v.description})` : ""}`).join(", ")}. Include these vehicles as shown in their reference images.`
      : "";

  const camera =
    panel.cameraAngle && panel.cameraAngle !== "None" ? panel.cameraAngle : "";
  const lens =
    panel.cameraLens && panel.cameraLens !== "None" ? panel.cameraLens : "";
  const mood = panel.mood && panel.mood !== "None" ? panel.mood : "";

  const refs = [...charRefs, ...propRefs, ...vehicleRefs];
  if (bgRef) refs.push(bgRef);

  const prompt = `
    A cinematic comic book panel.
    Subject: ${panel.description}.
    ${characterContext ? `Characters present: ${characterContext}.` : ""}
    ${bgContext}
    ${propContext}
    ${vehicleContext}
    ${camera ? `Camera Angle: ${camera}.` : ""}
    ${lens ? `Camera Lens: ${lens}.` : ""}
    ${mood ? `Mood: ${mood}.` : ""}
    ${panel.notes?.trim() ? `User feedback: ${panel.notes.trim()}.` : ""}
    ${refs.length > 0 ? "CRITICAL: Match the exact visual style, line work, and coloring of the attached reference images. The output must look like it belongs in the same comic as the references." : ""}
    CRITICAL: Do NOT include any speech bubbles or text in the image.
  `.trim();

  return { prompt, refs, aspectRatio: panel.aspectRatio || "3:4" };
}

/**
 * Draw one panel, returning the compressed base64 image (or null on failure).
 * Throwing is left to generatePanelImage's own handling — it returns null and
 * surfaces the error via the global bus, so a failed draw does not break the loop.
 */
export async function drawPanel(
  panel: PanelPrompt,
  vault: VaultEntry[],
): Promise<string | null> {
  const { prompt, refs, aspectRatio } = composePanelPrompt(panel, vault);
  return generatePanelImage(prompt, refs, aspectRatio);
}
