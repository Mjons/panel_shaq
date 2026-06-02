// Lightweight admin gate for the meme text-zone calibrator. Opening
// /c/from-meme?h=<token>&admin=<secret> on any device unlocks calibration and
// remembers it (localStorage). Invisible to normal users. Not a security
// boundary — it only reveals a positioning tool whose output is hand-committed.

const ADMIN_FLAG = "panelshaq_admin";

// Secret to unlock the calibrator. In dev it defaults to "panelshaq-admin" for
// convenience. In a production build it must be set explicitly via
// VITE_MEME_ADMIN_SECRET — if it's empty/unset, the admin tools are DISABLED
// entirely (no public fallback). So leaving the env var empty in prod = off.
const ADMIN_SECRET =
  import.meta.env.VITE_MEME_ADMIN_SECRET ||
  (import.meta.env.DEV ? "panelshaq-admin" : "");

export function isAdmin(): boolean {
  if (!ADMIN_SECRET) return false; // no secret configured → admin disabled
  try {
    const q = new URLSearchParams(window.location.search).get("admin");
    if (q !== null) {
      if (q === ADMIN_SECRET) {
        localStorage.setItem(ADMIN_FLAG, "1");
        return true;
      }
      return false;
    }
    return localStorage.getItem(ADMIN_FLAG) === "1";
  } catch {
    return false;
  }
}
