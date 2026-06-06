import { idbGet, idbSet } from "../hooks/useIndexedDBState";
import { track } from "../services/analytics";

// "Make a new comic" — saves the finished meme into Panel Haus Mobile's Vault (as a
// reusable Prop) and opens the main app on the Workshop tab. Runs from the
// separate /c/from-meme root (outside the React app tree), so it writes the
// IndexedDB / localStorage state imperatively, then navigates. The main app
// hydrates from those keys on load. Entering the EmailGate there is expected —
// this is the "commit to the real product" moment.

const VAULT_KEY = "panelshaq_vault_entries";
const ACTIVE_TAB_KEY = "panelshaq_active_tab";

interface MinimalVaultEntry {
  id: string;
  type: "Prop";
  name: string;
  image: string;
  description: string;
}

export async function makeNewComic(
  memeDataUrl: string,
  label: string,
): Promise<void> {
  const entry: MinimalVaultEntry = {
    id: crypto.randomUUID(),
    type: "Prop",
    name: label?.trim() || "Meme",
    image: memeDataUrl,
    description: "",
  };

  try {
    const existing = (await idbGet<MinimalVaultEntry[]>(VAULT_KEY)) ?? [];
    await idbSet(VAULT_KEY, [entry, ...existing]);
  } catch {
    /* if the vault write fails, still proceed to the app */
  }

  try {
    // usePersistedState stores values JSON-encoded.
    localStorage.setItem(ACTIVE_TAB_KEY, JSON.stringify("workshop"));
  } catch {
    /* ignore */
  }

  track("share_completed", { surface: "meme_make_comic" });
  window.location.assign("/");
}
