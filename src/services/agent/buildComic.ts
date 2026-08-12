import { getDefaultLayoutId } from "../../screens/LayoutScreen";
import type { Page } from "../../screens/LayoutScreen";
import type { VaultCategory, VaultEntry } from "../../screens/VaultScreen";
import type { Bubble, PanelPrompt } from "../geminiService";
import type { MobileDoc } from "./mobileDigest";
import { BUILD_LIMITS } from "./tools";

// P4 — the deterministic builder. Turns Smudge's build_comic plan into panels +
// a page, exactly the shape the manual Director/Layout flow produces, so a
// Smudge-built page is indistinguishable from a hand-built one and stays fully
// editable. NO model calls here: validate, then apply. Pure functions — applyPlan
// takes the plan + current doc and returns the new pieces, mutating nothing.

export interface BuildPlan {
  title?: string;
  panels: Array<{
    visual: string;
    cast?: string[];
    location?: string;
    dialogue?: Array<{ speaker?: string; text: string }>;
    angle?: string;
    mood?: string;
  }>;
}

export interface ApplyResult {
  newPanels: PanelPrompt[];
  page: Page;
  /** Names Smudge referenced that are not in the vault — reported, never invented. */
  unresolved: string[];
}

/**
 * Validate + normalize. The builder only ever sees a normalized plan. Over-limit
 * is an ERROR the model is told about, never a silent .slice() (desktop shipped a
 * vanished 5th panel that way — Handoff 7.5).
 */
export function validatePlan(raw: any): {
  plan: BuildPlan | null;
  errors: string[];
} {
  const errors: string[] = [];
  const panels = Array.isArray(raw?.panels) ? raw.panels : [];
  if (!panels.length) errors.push("a page needs at least one panel");
  if (panels.length > BUILD_LIMITS.panels)
    errors.push(
      `too many panels (${panels.length}, the most I can build at once is ${BUILD_LIMITS.panels})`,
    );

  const norm = panels
    .map((p: any) => ({
      visual: String(p?.visual ?? "").trim().slice(0, 600),
      cast: (Array.isArray(p?.cast) ? p.cast : [])
        .slice(0, BUILD_LIMITS.cast)
        .map(String),
      location: p?.location ? String(p.location) : undefined,
      dialogue: (Array.isArray(p?.dialogue) ? p.dialogue : [])
        .slice(0, BUILD_LIMITS.dialoguePerPanel)
        .map((d: any) => ({
          speaker: d?.speaker ? String(d.speaker) : undefined,
          text: String(d?.text ?? "").trim().slice(0, 300),
        }))
        .filter((d: { text: string }) => d.text),
      angle: p?.angle ? String(p.angle) : undefined,
      mood: p?.mood ? String(p.mood) : undefined,
    }))
    .filter((p: { visual: string }) => p.visual);

  if (!norm.length && !errors.length)
    errors.push("none of the panels had a description");
  if (errors.length) return { plan: null, errors };
  return {
    plan: { title: raw?.title ? String(raw.title) : undefined, panels: norm },
    errors: [],
  };
}

/**
 * Pure: takes the validated plan + current doc, returns the new panels and page
 * to append. Resolves cast/location NAMES to vault ids; a name with no vault
 * entry is reported in `unresolved`, never invented (Smudge tells the user).
 * Layout is chosen by the SAME getDefaultLayoutId a hand-built page uses.
 */
export function applyPlan(doc: MobileDoc, plan: BuildPlan): ApplyResult {
  const byName = new Map(
    doc.vaultEntries.map((v) => [v.name.toLowerCase(), v]),
  );
  const resolve = (name: string, type?: VaultCategory): VaultEntry | null => {
    const v = byName.get(name.toLowerCase());
    return v && (!type || v.type === type) ? v : null;
  };
  const unresolved: string[] = [];
  const stamp = Date.now();

  const newPanels: PanelPrompt[] = plan.panels.map((p, i) => {
    const cast = (p.cast ?? [])
      .map((n) => {
        const v = resolve(n, "Character");
        if (!v) unresolved.push(n);
        return v;
      })
      .filter((v): v is VaultEntry => !!v);

    const loc = p.location ? resolve(p.location, "Environment") : null;
    if (p.location && !loc) unresolved.push(p.location);

    const bubbles: Bubble[] = (p.dialogue ?? []).map((d, j) => ({
      id: `bub_${stamp}_${i}_${j}`,
      // Dialogue becomes a bubble ON the panel — it NEVER enters the art prompt
      // (desktop rule 5c / Handoff). Speaker prefixes the line if present.
      text: d.speaker ? `${d.speaker}: ${d.text}` : d.text,
      pos: { x: 50, y: 12 + j * 18 },
      style: "speech",
      fontSize: 16,
      fontWeight: "600",
      fontStyle: "normal",
    }));

    return {
      id: `panel_${stamp}_${i}`,
      description: p.visual,
      selectedCharacterIds: cast.map((c) => c.id),
      ...(loc ? { selectedBackgroundId: loc.id } : {}),
      ...(p.angle ? { cameraAngle: p.angle } : {}),
      ...(p.mood ? { mood: p.mood } : {}),
      bubbles,
    };
  });

  const page: Page = {
    id: `page_${stamp}`,
    panelIds: newPanels.map((p) => p.id), // plan order IS reading order
    layoutId: getDefaultLayoutId(newPanels.length, doc.pageFormat),
  };

  return { newPanels, page, unresolved: [...new Set(unresolved)] };
}
