import type { Dispatch, SetStateAction } from "react";
import type { PanelPrompt } from "../geminiService";
import type { Page } from "../../screens/LayoutScreen";
import type { VaultEntry } from "../../screens/VaultScreen";

// One-level undo for a whole agent turn (P0 — the launch blocker).
//
// panel_shaq has no undo of any kind, and on mobile the panels ARE the comic:
// Smudge writes straight into the artifact the user cares about. So every agent
// turn is bracketed — snapshot the three mutable arrays before it runs, restore
// them on one "Undo that" tap. The whole turn is ONE step, matching desktop's
// beginAgentTurn/endAgentTurn contract.
//
// Deliberately ONE level deep. "Undo the last thing Smudge did" is what the
// product promise requires; a full undo/redo stack is a separate, bigger project.
// Do not silently widen this.

/** The three arrays an agent turn can mutate. */
export interface TurnState {
  panels: PanelPrompt[];
  pages: Page[];
  vaultEntries: VaultEntry[];
}

/** App.tsx owns the state; it passes these three setters in. Typed as React's
 *  dispatch so callers can pass a value (undo/commit) OR a functional updater
 *  (per-panel redraw merges into current state). Matches App's actual setters. */
export interface TurnSetters {
  setRawPanels: Dispatch<SetStateAction<PanelPrompt[]>>;
  setPages: Dispatch<SetStateAction<Page[]>>;
  setVaultEntries: Dispatch<SetStateAction<VaultEntry[]>>;
}

interface Snapshot extends TurnState {
  at: number;
  label: string;
}

let pending: Snapshot | null = null;

// Both PanelPrompt.image and VaultEntry.image hold base64. structuredClone would
// duplicate those (six panels of base64 is real memory on a phone), so strip
// `image` before cloning the metadata and reattach the ORIGINAL string by
// reference. Safe because generated art is additive — a build never destroys an
// existing panel's image — so undo never needs a fresh copy of the pixels, only
// of the structure around them (ids, casts, bubbles, page order).
function clonePanel(p: PanelPrompt): PanelPrompt {
  const { image, ...rest } = p;
  const cloned = structuredClone(rest) as PanelPrompt;
  if (image !== undefined) cloned.image = image;
  return cloned;
}

function cloneVault(v: VaultEntry): VaultEntry {
  const { image, ...rest } = v;
  const cloned = structuredClone(rest) as VaultEntry;
  cloned.image = image; // required on VaultEntry
  return cloned;
}

/**
 * Capture the pre-turn state. Call once, before the turn's tools run. A second
 * call overwrites the first (one level deep), so a new turn always undoes to the
 * start of THAT turn, never earlier.
 */
export function beginTurn(state: TurnState, label: string): void {
  pending = {
    at: Date.now(),
    label,
    panels: state.panels.map(clonePanel),
    pages: structuredClone(state.pages),
    vaultEntries: state.vaultEntries.map(cloneVault),
  };
}

/** True while an undo is available — drives whether the UI shows "Undo that". */
export function canUndo(): boolean {
  return pending !== null;
}

/** The label captured at beginTurn (e.g. the user's message), for the affordance. */
export function pendingLabel(): string | null {
  return pending?.label ?? null;
}

/**
 * Drop the snapshot without restoring. Call when undo stops being meaningful —
 * e.g. the user keeps building, or manually edits — so a stale "Undo that" can't
 * silently revert unrelated later work.
 */
export function clearSnapshot(): void {
  pending = null;
}

/**
 * Restore the three arrays to their pre-turn state and consume the snapshot.
 * Returns false when there is nothing to undo. Restoring vault too is deliberate:
 * a turn can save a character (P6), and "undo that" must take it back out.
 */
export function undoTurn(setters: TurnSetters): boolean {
  if (!pending) return false;
  setters.setRawPanels(pending.panels);
  setters.setPages(pending.pages);
  setters.setVaultEntries(pending.vaultEntries);
  pending = null;
  return true;
}
