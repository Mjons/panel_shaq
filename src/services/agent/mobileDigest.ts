import type { PanelPrompt } from "../geminiService";
import type { Page } from "../../screens/LayoutScreen";
import type { VaultEntry, VaultCategory } from "../../screens/VaultScreen";

// P1 — the digest. Smudge never sees panel_shaq's storage; it sees this small,
// typed projection of the six-value document. Desktop's agent reasons over a
// typed node/edge graph, but the graph is just a READ model — mobile's arrays
// already hold the same facts (edges are foreign-key fields), so we project them
// into the same shape. Output is a few KB of plain scalars: no base64, no pixels.
//
// This runs on the CLIENT (runTurn builds it every round and sends it); the route
// only embeds the result. Keep it cheap and allocation-light.

/** The whole mobile document the agent reasons over. `panels` are HYDRATED
 *  (App.tsx derives `panels = rawPanels.map(hydratePanel)`), so bubbles[] and
 *  imageTransform always exist here. */
export interface MobileDoc {
  story: string;
  vaultEntries: VaultEntry[];
  panels: PanelPrompt[];
  pages: Page[];
  pageFormat: string;
  projectName: string;
}

const clip = (s: unknown, n: number): string => String(s ?? "").trim().slice(0, n);

/**
 * Ported from desktop `detectUncastCharacters` (boardAgentService.js:145).
 *
 * A panel whose description NAMES a vault character but does not CAST it
 * (selectedCharacterIds) will generate successfully and WRONG — the model draws
 * a stand-in — and every generation is billed. This one check catches that
 * before ink is spent, which is why it earns its place even in a minimal v1.
 *
 * Returns panelId -> names present in the text but not cast.
 */
function detectUncast(
  panels: PanelPrompt[],
  vault: VaultEntry[],
): Map<string, string[]> {
  const characters = vault.filter((v) => v.type === "Character");
  const byPanel = new Map<string, string[]>();
  for (const p of panels) {
    const text = `${p.description ?? ""} ${p.notes ?? ""}`;
    const cast = new Set(p.selectedCharacterIds ?? []);
    const missing = characters
      .filter((c) => c.name && !cast.has(c.id))
      // Word-boundary, case-insensitive, with the name regex-escaped so a
      // character called "Mr. K." can't corrupt the pattern.
      .filter((c) =>
        new RegExp(
          `\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "i",
        ).test(text),
      )
      .map((c) => c.name);
    if (missing.length) byPanel.set(p.id, missing);
  }
  return byPanel;
}

export function buildMobileDigest(doc: MobileDoc) {
  const vaultById = new Map(doc.vaultEntries.map((v) => [v.id, v]));
  const nameOf = (id?: string | null): string | null =>
    id ? (vaultById.get(id)?.name ?? null) : null;
  const names = (ids?: string[]): string[] =>
    (ids ?? []).map(nameOf).filter((n): n is string => !!n);

  const uncast = detectUncast(doc.panels, doc.vaultEntries);
  const placed = new Set(doc.pages.flatMap((pg) => pg.panelIds));

  const panelDigest = (p: PanelPrompt) => ({
    id: p.id,
    visual: clip(p.description, 160) || "(no description)",
    cast: names(p.selectedCharacterIds),
    location: nameOf(p.selectedBackgroundId),
    things: [...names(p.selectedPropIds), ...names(p.selectedVehicleIds)],
    ...(p.cameraAngle ? { angle: p.cameraAngle } : {}),
    ...(p.mood ? { mood: p.mood } : {}),
    art: p.image ? "drawn" : "empty",
    dialogue: (p.bubbles ?? []).map((b) => ({
      style: b.style,
      text: clip(b.text, 120),
    })),
    ...(uncast.has(p.id)
      ? {
          warn: `UNCAST: ${uncast
            .get(p.id)!
            .join(", ")} named here but not cast — cast before generating`,
        }
      : {}),
  });

  return {
    project: doc.projectName,
    format: doc.pageFormat,
    story: clip(doc.story, 2000),
    vault: doc.vaultEntries.map((v) => ({
      id: v.id,
      type: v.type as VaultCategory,
      name: v.name,
      description: clip(v.description, 200),
      ...(v.personality ? { personality: clip(v.personality, 120) } : {}),
    })),
    pages: doc.pages.map((pg, i) => ({
      id: pg.id,
      number: i + 1,
      layout: pg.layoutId,
      panels: pg.panelIds
        .map((id) => doc.panels.find((p) => p.id === id))
        .filter((p): p is PanelPrompt => !!p)
        .map(panelDigest),
    })),
    // Mobile's staging area: panels that exist but sit on no page — the nearest
    // equivalent to desktop's "on the board, not sent to the comic".
    loosePanels: doc.panels
      .filter((p) => !placed.has(p.id))
      .map(panelDigest),
  };
}
