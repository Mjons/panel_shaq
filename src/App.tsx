import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
} from "react";
import { useDrag } from "@use-gesture/react";
import { TopNav, BottomNav } from "./components/Navigation";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider, useToast } from "./components/Toast";
import { ConfirmProvider, useConfirm } from "./components/ConfirmDialog";
import { ProjectManager } from "./components/ProjectManager";
import {
  PanelPrompt,
  onApiError,
  hydratePanel,
} from "./services/geminiService";
import { saveProject, type SavedProject } from "./services/projectStorage";
import { usePersistedState } from "./hooks/usePersistedState";
import { useIndexedDBState } from "./hooks/useIndexedDBState";
import type { Page } from "./screens/LayoutScreen";
import type { VaultEntry } from "./screens/VaultScreen";

// Auto-reload on stale chunk errors (happens after new deployments)
function lazyWithReload<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return React.lazy(() =>
    factory().catch((err) => {
      if (
        err.message?.includes("Failed to fetch dynamically imported module") ||
        err.message?.includes("Loading chunk") ||
        err.name === "ChunkLoadError"
      ) {
        window.location.reload();
        // Return a never-resolving promise so React doesn't try to render
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }),
  );
}

const WorkshopScreen = lazyWithReload(() =>
  import("./screens/WorkshopScreen").then((m) => ({
    default: m.WorkshopScreen,
  })),
);
const DirectorScreen = lazyWithReload(() =>
  import("./screens/DirectorScreen").then((m) => ({
    default: m.DirectorScreen,
  })),
);
const VaultScreen = lazyWithReload(() =>
  import("./screens/VaultScreen").then((m) => ({ default: m.VaultScreen })),
);
const EditorScreen = lazyWithReload(() =>
  import("./screens/EditorScreen").then((m) => ({ default: m.EditorScreen })),
);
const LayoutScreen = lazyWithReload(() =>
  import("./screens/LayoutScreen").then((m) => ({ default: m.LayoutScreen })),
);
const SettingsScreen = lazyWithReload(() =>
  import("./screens/SettingsScreen").then((m) => ({
    default: m.SettingsScreen,
  })),
);
const ShareScreen = lazyWithReload(() =>
  import("./screens/ShareScreen").then((m) => ({ default: m.ShareScreen })),
);

// Character is now a VaultEntry with type "Character" — single source of truth
export type Character = VaultEntry;

const DEFAULT_VAULT_ENTRIES: VaultEntry[] = [
  {
    id: "1",
    type: "Character",
    name: "Dev Guy",
    image: "/sample.png",
    description:
      "A cute bald man with a brown beard, light skin. Wears a light blue t-shirt. Heavy brows. Cartoon round style with bold outlines.",
  },
];

function AppInner() {
  const { addToast } = useToast();
  const { confirm } = useConfirm();

  // Connect API error notifications to toast system
  useEffect(() => {
    return onApiError((msg) => addToast(msg, "error"));
  }, [addToast]);

  const [activeTab, setActiveTab] = usePersistedState(
    "panelshaq_active_tab",
    "workshop",
  );
  const [story, setStory] = usePersistedState("panelshaq_story", "");
  const [vaultEntries, setVaultEntries] = useIndexedDBState<VaultEntry[]>(
    "panelshaq_vault_entries",
    DEFAULT_VAULT_ENTRIES,
  );
  const characters = useMemo(
    () => vaultEntries.filter((e) => e.type === "Character"),
    [vaultEntries],
  );
  const setCharacters: React.Dispatch<React.SetStateAction<Character[]>> =
    useCallback(
      (action) => {
        setVaultEntries((prev) => {
          const nonChars = prev.filter((e) => e.type !== "Character");
          const currentChars = prev.filter((e) => e.type === "Character");
          const newChars =
            typeof action === "function" ? action(currentChars) : action;
          return [...nonChars, ...newChars];
        });
      },
      [setVaultEntries],
    );
  const [rawPanels, setRawPanels] = useIndexedDBState<PanelPrompt[]>(
    "panelshaq_panels",
    [],
  );
  // Hydrate panels to ensure bubbles[] and imageTransform always exist
  const panels = rawPanels.map(hydratePanel);
  const setPanels: React.Dispatch<React.SetStateAction<PanelPrompt[]>> =
    setRawPanels;
  const [pages, setPages] = usePersistedState<Page[]>("panelshaq_pages", []);
  const [styleReferenceImage, setStyleReferenceImage] = useIndexedDBState<
    string | null
  >("panelshaq_style_ref", "Cartoon");
  const [styleNotes, setStyleNotes] = usePersistedState(
    "panelshaq_style_notes",
    "",
  );

  // One-time migration: merge old vault (localStorage) into unified vault entries
  useEffect(() => {
    const migrated = localStorage.getItem("panelshaq_vault_migrated");
    if (migrated) return;
    try {
      const oldVault = localStorage.getItem("panelshaq_vault");
      if (oldVault) {
        const oldEntries: VaultEntry[] = JSON.parse(oldVault);
        if (oldEntries.length > 0) {
          setVaultEntries((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const newEntries = oldEntries.filter((e) => !existingIds.has(e.id));
            return newEntries.length > 0 ? [...prev, ...newEntries] : prev;
          });
        }
      }
    } catch {}
    localStorage.setItem("panelshaq_vault_migrated", "1");
  }, []);

  // Check if user has an API key configured (BYOK or env var)
  const [apiKeyInput, setApiKeyInput] = useState("");
  const hasUserKey = (() => {
    try {
      const saved = localStorage.getItem("panelshaq_settings");
      if (saved) {
        const s = JSON.parse(saved);
        if (s.geminiApiKey) return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  })();

  // Show setup screen if no key anywhere
  // (env var is checked server-side, so we optimistically allow through if user has no local key
  //  and let the 401 toast handle it if server also has no key)
  const [showSetup, setShowSetup] = useState(!hasUserKey);
  const [setupSaving, setSetupSaving] = useState(false);

  const handleSetupSave = () => {
    if (!apiKeyInput.trim()) return;
    setSetupSaving(true);
    try {
      const existing = localStorage.getItem("panelshaq_settings");
      const settings = existing ? JSON.parse(existing) : {};
      settings.geminiApiKey = apiKeyInput.trim();
      localStorage.setItem("panelshaq_settings", JSON.stringify(settings));
      setShowSetup(false);
    } catch {
      /* ignore */
    }
    setSetupSaving(false);
  };

  if (showSetup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface-container p-8 rounded-2xl border border-outline/10 text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <img
              src="/sample.png"
              alt="Panel Shaq"
              className="w-16 h-16 rounded-full object-cover"
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-headline font-bold text-accent">
              Welcome to Panel Shaq
            </h1>
            <p className="text-sm text-accent/60 leading-relaxed">
              Enter your free Gemini API key to start creating comics. Google
              gives generous free-tier credits.
            </p>
          </div>
          <div className="space-y-3 text-left">
            <label className="text-[10px] font-bold text-accent/50 uppercase tracking-widest block">
              Gemini API Key
            </label>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSetupSave()}
              placeholder="AIzaSy..."
              className="w-full bg-background border border-outline/20 rounded-lg px-4 py-3 text-sm text-accent placeholder-accent/20 outline-none focus:border-primary/50"
              autoFocus
            />
            <p className="text-[10px] text-accent/30 leading-relaxed">
              Get yours free at{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                aistudio.google.com/apikey
              </a>
            </p>
          </div>
          <button
            onClick={handleSetupSave}
            disabled={!apiKeyInput.trim() || setupSaving}
            className="w-full py-4 bg-primary text-background font-headline font-bold rounded-xl shadow-[0_4px_14px_rgba(255,145,0,0.39)] active:scale-95 transition-transform disabled:opacity-50"
          >
            Start Creating
          </button>
          <p className="text-[10px] text-accent/20">
            Your key stays in your browser. Never sent to our servers.
          </p>
        </div>
      </div>
    );
  }

  // Project management
  const [currentProjectId, setCurrentProjectId] = usePersistedState<
    string | null
  >("panelshaq_current_project_id", null);
  const [projectName, setProjectName] = usePersistedState(
    "panelshaq_project_name",
    "Untitled Project",
  );
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);

  // Auto-save to IndexedDB
  const saveCurrentProject = useCallback(async () => {
    if (!story && panels.length === 0) return;

    const id = currentProjectId || crypto.randomUUID();
    if (!currentProjectId) setCurrentProjectId(id);

    const thumbnail = panels.find((p) => p.image)?.image || "";
    const smallThumb = thumbnail ? thumbnail.substring(0, 200) + "..." : "";

    await saveProject({
      id,
      name: projectName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      thumbnail: smallThumb,
      story,
      characters,
      vaultEntries,
      panels,
      pages,
      styleReferenceImage,
      styleNotes,
    });
  }, [
    currentProjectId,
    projectName,
    story,
    vaultEntries,
    panels,
    pages,
    styleReferenceImage,
    styleNotes,
  ]);

  // Auto-save on interval
  useEffect(() => {
    const settingsRaw = localStorage.getItem("panelshaq_settings");
    const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
    const interval = settings.autoSaveInterval ?? 30000;
    if (interval === 0) return;

    const timer = setInterval(saveCurrentProject, interval);
    return () => clearInterval(timer);
  }, [saveCurrentProject]);

  // Save on beforeunload
  useEffect(() => {
    const handler = () => {
      saveCurrentProject();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveCurrentProject]);

  const shouldWarnData = () => {
    try {
      const s = localStorage.getItem("panelshaq_settings");
      return s ? JSON.parse(s).showDataWarnings !== false : true;
    } catch {
      return true;
    }
  };

  const handleLoadProject = async (project: SavedProject) => {
    if (panels.some((p) => p.image) && shouldWarnData()) {
      const ok = await confirm({
        title: "Switch Project",
        message:
          "Your current work will be saved before loading the new project. You can find it in the project manager anytime.",
        confirmText: "Save & Switch",
      });
      if (!ok) return;
    }
    saveCurrentProject();
    setCurrentProjectId(project.id);
    setProjectName(project.name);
    setStory(project.story);
    // Restore vault entries — backward compat: convert old characters-only projects
    if (project.vaultEntries) {
      setVaultEntries(project.vaultEntries);
    } else {
      const converted: VaultEntry[] = project.characters.map((c) => ({
        ...c,
        type: "Character" as const,
        description: c.description || "",
      }));
      setVaultEntries(converted);
    }
    setPanels(project.panels);
    setPages(project.pages);
    setStyleReferenceImage(project.styleReferenceImage);
    setStyleNotes(project.styleNotes || "");
    setActiveTab("workshop");
  };

  const handleCreateNew = async () => {
    if (panels.some((p) => p.image) && shouldWarnData()) {
      const ok = await confirm({
        title: "New Project",
        message:
          "Your current work will be saved. You can reload it from the project manager anytime.",
        confirmText: "Save & Start Fresh",
      });
      if (!ok) return;
    }
    saveCurrentProject();
    setCurrentProjectId(null);
    setProjectName("Untitled Project");
    setStory("");
    setPanels([]);
    setPages([]);
    setStyleReferenceImage("Cartoon");
    setStyleNotes("");
    setActiveTab("workshop");
    setVaultEntries(DEFAULT_VAULT_ENTRIES);
  };

  const renderScreen = () => {
    switch (activeTab) {
      case "workshop":
        return (
          <WorkshopScreen
            projectName={projectName}
            setProjectName={setProjectName}
            story={story}
            setStory={setStory}
            characters={characters}
            setCharacters={setCharacters}
            panels={panels}
            setPanels={setPanels}
            styleReferenceImage={styleReferenceImage}
            setStyleReferenceImage={setStyleReferenceImage}
            styleNotes={styleNotes}
            setStyleNotes={setStyleNotes}
            onGenerateSuccess={() => setActiveTab("director")}
          />
        );
      case "director":
        return (
          <DirectorScreen
            panels={panels}
            setPanels={setPanels}
            characters={characters}
            story={story}
            styleReferenceImage={styleReferenceImage}
            setStyleReferenceImage={setStyleReferenceImage}
            styleNotes={styleNotes}
            onContinue={() => setActiveTab("layout")}
          />
        );
      case "layout":
        return (
          <LayoutScreen
            panels={panels}
            pages={pages}
            setPages={setPages}
            onContinue={() => setActiveTab("editor")}
          />
        );
      case "vault":
        return (
          <VaultScreen entries={vaultEntries} setEntries={setVaultEntries} />
        );
      case "editor":
        return (
          <EditorScreen panels={panels} pages={pages} setPanels={setPanels} />
        );
      case "settings":
        return <SettingsScreen />;
      case "share":
        return <ShareScreen />;
      default:
        return (
          <WorkshopScreen
            projectName={projectName}
            setProjectName={setProjectName}
            story={story}
            setStory={setStory}
            characters={characters}
            setCharacters={setCharacters}
            panels={panels}
            setPanels={setPanels}
            styleReferenceImage={styleReferenceImage}
            setStyleReferenceImage={setStyleReferenceImage}
            styleNotes={styleNotes}
            setStyleNotes={setStyleNotes}
            onGenerateSuccess={() => setActiveTab("director")}
          />
        );
    }
  };

  const TAB_ORDER = ["workshop", "director", "layout", "editor"];
  const bindSwipe = useDrag(
    ({ swipe: [swipeX] }) => {
      if (swipeX === 0) return;
      const currentIdx = TAB_ORDER.indexOf(activeTab);
      if (currentIdx === -1) return;
      const nextIdx = currentIdx - swipeX;
      if (nextIdx >= 0 && nextIdx < TAB_ORDER.length) {
        setActiveTab(TAB_ORDER[nextIdx]);
      }
    },
    { axis: "x", swipe: { distance: 50, velocity: 0.3 } },
  );

  return (
    <div className="min-h-screen bg-background selection:bg-primary/30">
      {/* Decorative Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02] overflow-hidden z-0">
        <div className="w-full h-full bg-[radial-gradient(#FF9100_1px,transparent_1px)] [background-size:24px_24px]"></div>
      </div>

      <TopNav
        onCreate={() => setIsProjectManagerOpen(true)}
        onTabChange={setActiveTab}
      />

      <main
        {...bindSwipe()}
        className="relative z-10"
        style={{ touchAction: "pan-y" }}
      >
        <ErrorBoundary>
          <Suspense fallback={<LoadingSkeleton />}>{renderScreen()}</Suspense>
        </ErrorBoundary>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      <ProjectManager
        isOpen={isProjectManagerOpen}
        onClose={() => setIsProjectManagerOpen(false)}
        onLoadProject={handleLoadProject}
        onNewProject={handleCreateNew}
        currentProjectId={currentProjectId}
      />
    </div>
  );
}

export default function App() {
  return (
    <ConfirmProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </ConfirmProvider>
  );
}
