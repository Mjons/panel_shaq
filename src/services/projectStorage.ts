import { Character } from "../App";
import { PanelPrompt } from "./geminiService";
import { Page } from "../screens/LayoutScreen";

export interface SavedProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  thumbnail: string;
  story: string;
  characters: Character[];
  panels: PanelPrompt[];
  pages: Page[];
  styleReferenceImage: string | null;
  styleNotes?: string;
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  thumbnail: string;
}

const DB_NAME = "panelshaq_projects";
const DB_VERSION = 1;
const STORE_NAME = "projects";
const META_KEY = "panelshaq_project_index";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProject(project: SavedProject): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(project);
    tx.oncomplete = () => {
      // Update metadata index in localStorage
      const metas = getProjectMetas();
      const meta: ProjectMeta = {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        thumbnail: project.thumbnail,
      };
      const existing = metas.findIndex((m) => m.id === project.id);
      if (existing >= 0) {
        metas[existing] = meta;
      } else {
        metas.unshift(meta);
      }
      localStorage.setItem(META_KEY, JSON.stringify(metas));
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadProject(id: string): Promise<SavedProject | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => {
      const metas = getProjectMetas().filter((m) => m.id !== id);
      localStorage.setItem(META_KEY, JSON.stringify(metas));
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export function getProjectMetas(): ProjectMeta[] {
  try {
    const saved = localStorage.getItem(META_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}
