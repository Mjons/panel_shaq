// One-time cross-origin data migration: shaq.panelhaus.app -> m.panelhaus.app.
//
// localStorage + IndexedDB are scoped per origin, so renaming the canonical host
// strands existing users' on-device content. On first load of the NEW host this
// embeds a hidden iframe pointing at the OLD host's /migrate-bridge.html, pulls
// the data across via postMessage, and writes it into this origin's storage.
//
// Same-site (both subdomains of panelhaus.app) means the iframe reads the old
// origin's real first-party storage, not a partitioned bucket — see the long
// comment in public/migrate-bridge.html. Keep the old host serving the bridge
// (don't blanket-redirect it) for as long as you want migration to work.

const OLD_ORIGIN = "https://shaq.panelhaus.app";
const BRIDGE_PATH = "/migrate-bridge.html";

// Only auto-run on the new canonical host. Avoids running on the old host
// (the source), on *.vercel.app, and on localhost where there's nothing to pull.
const NEW_HOST = "m.panelhaus.app";

const STATUS_KEY = "panelshaq_origin_migration"; // "done" | "<attempt count>"
const MAX_ATTEMPTS = 3;
const PULL_TIMEOUT_MS = 8000;

const STATE_DB = "panelshaq";
const STATE_STORE = "state";
const PROJECTS_DB = "panelshaq_projects";
const PROJECTS_STORE = "projects";

// Content keys that indicate this origin already has real user data we must not
// clobber. Deliberately excludes analytics/visit flags (panelshaq_visited etc.),
// which get written on first paint before migration runs.
const CONTENT_LOCAL_KEYS = [
  "panelshaq_story",
  "panelshaq_pages",
  "panelshaq_vault", // legacy pre-IndexedDB vault
  "panelshaq_project_index",
];

interface MigratePayload {
  type: "panelhaus-migrate-payload";
  local?: Record<string, string>;
  idbState?: Array<{ key: IDBValidKey; value: unknown }>;
  idbProjects?: unknown[];
  error?: string;
}

function hasExistingData(): boolean {
  return CONTENT_LOCAL_KEYS.some((k) => localStorage.getItem(k) !== null);
}

function openDB(
  name: string,
  storeName: string,
  keyPath: string | null,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, keyPath ? { keyPath } : undefined);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function pullFromOldOrigin(): Promise<MigratePayload | null> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.display = "none";
    let settled = false;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };
    const finish = (val: MigratePayload | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(val);
    };

    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== OLD_ORIGIN) return;
      const data = ev.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "panelhaus-migrate-ready") {
        iframe.contentWindow?.postMessage(
          { type: "panelhaus-migrate-request" },
          OLD_ORIGIN,
        );
      } else if (data.type === "panelhaus-migrate-payload") {
        finish(data as MigratePayload);
      }
    };

    window.addEventListener("message", onMessage);
    const timer = setTimeout(() => finish(null), PULL_TIMEOUT_MS);

    // Also request on load, in case the ready ping fired before we listened.
    iframe.onload = () => {
      iframe.contentWindow?.postMessage(
        { type: "panelhaus-migrate-request" },
        OLD_ORIGIN,
      );
    };
    iframe.src = OLD_ORIGIN + BRIDGE_PATH;
    document.body.appendChild(iframe);
  });
}

async function writePayload(payload: MigratePayload): Promise<void> {
  // localStorage
  if (payload.local) {
    for (const [k, v] of Object.entries(payload.local)) {
      // Don't import the source's migration bookkeeping — we set our own below.
      if (k === STATUS_KEY) continue;
      try {
        localStorage.setItem(k, v);
      } catch (e) {
        console.warn("migration: failed to set localStorage", k, e);
      }
    }
  }

  // IndexedDB: state store (out-of-line keys)
  if (payload.idbState?.length) {
    const db = await openDB(STATE_DB, STATE_STORE, null);
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STATE_STORE, "readwrite");
      const store = tx.objectStore(STATE_STORE);
      for (const { key, value } of payload.idbState!) store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  // IndexedDB: projects store (in-line keyPath "id")
  if (payload.idbProjects?.length) {
    const db = await openDB(PROJECTS_DB, PROJECTS_STORE, "id");
    await new Promise<void>((resolve) => {
      const tx = db.transaction(PROJECTS_STORE, "readwrite");
      const store = tx.objectStore(PROJECTS_STORE);
      for (const rec of payload.idbProjects!) store.put(rec);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
}

function payloadHasData(p: MigratePayload): boolean {
  return Boolean(
    (p.local && Object.keys(p.local).length) ||
    p.idbState?.length ||
    p.idbProjects?.length,
  );
}

/**
 * Attempt the one-time pull from the old origin. Returns true if data was
 * imported (the caller should let the app hydrate fresh). Safe to call always —
 * it self-gates to the new host, runs once, and never clobbers existing data.
 */
export async function maybeMigrateFromOldOrigin(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.location.hostname !== NEW_HOST) return false;

  const status = localStorage.getItem(STATUS_KEY);
  if (status === "done") return false;
  const attempts = status ? parseInt(status, 10) || 0 : 0;
  if (attempts >= MAX_ATTEMPTS) {
    localStorage.setItem(STATUS_KEY, "done");
    return false;
  }

  if (hasExistingData()) {
    localStorage.setItem(STATUS_KEY, "done");
    return false;
  }

  try {
    const payload = await pullFromOldOrigin();
    if (payload && payloadHasData(payload)) {
      await writePayload(payload);
      localStorage.setItem(STATUS_KEY, "done");
      return true;
    }
    // Reached the bridge but there was nothing to bring over → done.
    if (payload) {
      localStorage.setItem(STATUS_KEY, "done");
      return false;
    }
    // Timed out / unreachable → record an attempt and let the next load retry.
    localStorage.setItem(STATUS_KEY, String(attempts + 1));
    return false;
  } catch (e) {
    console.warn("origin migration failed", e);
    localStorage.setItem(STATUS_KEY, String(attempts + 1));
    return false;
  }
}
