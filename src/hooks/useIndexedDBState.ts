import { useState, useEffect, useRef, useCallback } from "react";

const DB_NAME = "panelshaq";
const DB_VERSION = 1;
const STORE_NAME = "state";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbSet<T>(key: string, value: T): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

/**
 * Like usePersistedState but backed by IndexedDB instead of localStorage.
 * Use this for large data (panels with base64 images) that would exceed
 * localStorage's ~5MB quota.
 */
export function useIndexedDBState<T>(
  key: string,
  defaultValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(defaultValue);
  const initialized = useRef(false);
  const skipNextSave = useRef(true); // skip saving the default on mount

  // Load from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    idbGet<T>(key).then((saved) => {
      if (!cancelled && saved !== undefined) {
        skipNextSave.current = true;
        setState(saved);
      }
      initialized.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  // Save to IndexedDB whenever state changes (after init)
  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (!initialized.current) return;
    idbSet(key, state).catch((e) =>
      console.warn(`Failed to save ${key} to IndexedDB`, e),
    );
  }, [key, state]);

  return [state, setState];
}
