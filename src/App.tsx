import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useDrag } from "@use-gesture/react";
import { TopNav, BottomNav } from "./components/Navigation";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider, useToast } from "./components/Toast";
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

export interface Character {
  id: string;
  name: string;
  image: string;
  description?: string;
}

const DEFAULT_CHARACTERS: Character[] = [
  {
    id: "1",
    name: "Dev Guy",
    image: "/sample.png",
    description:
      "A bald man with a thick scruffy brown beard, light skin, and an intense scowl. Wears a light blue t-shirt. Has blue tattoos on both forearms. Big ears, heavy brow, stocky build. Cartoon style with bold outlines.",
  },
];

function AppInner() {
  const { addToast } = useToast();

  // Connect API error notifications to toast system
  useEffect(() => {
    return onApiError((msg) => addToast(msg, "error"));
  }, [addToast]);

  const [activeTab, setActiveTab] = usePersistedState(
    "panelshaq_active_tab",
    "workshop",
  );
  const [story, setStory] = usePersistedState("panelshaq_story", "");
  const [characters, setCharacters] = useIndexedDBState<Character[]>(
    "panelshaq_characters",
    DEFAULT_CHARACTERS,
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
      panels,
      pages,
      styleReferenceImage,
    });
  }, [
    currentProjectId,
    projectName,
    story,
    characters,
    panels,
    pages,
    styleReferenceImage,
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

  const handleLoadProject = (project: SavedProject) => {
    setCurrentProjectId(project.id);
    setProjectName(project.name);
    setStory(project.story);
    setCharacters(project.characters);
    setPanels(project.panels);
    setPages(project.pages);
    setStyleReferenceImage(project.styleReferenceImage);
    setActiveTab("workshop");
  };

  const handleCreateNew = () => {
    saveCurrentProject();
    setCurrentProjectId(null);
    setProjectName("Untitled Project");
    setStory("");
    setPanels([]);
    setPages([]);
    setStyleReferenceImage("Cartoon");
    setActiveTab("workshop");
    setCharacters(DEFAULT_CHARACTERS);
  };

  const renderScreen = () => {
    switch (activeTab) {
      case "workshop":
        return (
          <WorkshopScreen
            story={story}
            setStory={setStory}
            characters={characters}
            setCharacters={setCharacters}
            setPanels={setPanels}
            styleReferenceImage={styleReferenceImage}
            setStyleReferenceImage={setStyleReferenceImage}
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
        return <VaultScreen />;
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
            story={story}
            setStory={setStory}
            characters={characters}
            setCharacters={setCharacters}
            setPanels={setPanels}
            styleReferenceImage={styleReferenceImage}
            setStyleReferenceImage={setStyleReferenceImage}
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
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
