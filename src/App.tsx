import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
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
const GifEditorScreen = lazyWithReload(() =>
  import("./screens/GifEditorScreen").then((m) => ({
    default: m.GifEditorScreen,
  })),
);

// Character is now a VaultEntry with type "Character" — single source of truth
export type Character = VaultEntry;

// --- Desktop Redirect Gate ---
function useIsDesktop() {
  // Synchronous init — no useEffect delay so the gate shows on first paint
  const [isDesktop] = useState(() => {
    const wide = window.innerWidth >= 1024;
    const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
    return wide && hasFinePointer;
  });
  return isDesktop;
}

function DesktopRedirectGate({ onStay }: { onStay: () => void }) {
  const [seconds, setSeconds] = useState(16);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          window.location.href = "https://panelhaus.app";
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleStay = () => {
    localStorage.setItem("panelshaq_desktop_gate_dismissed", "1");
    onStay();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-surface/95 flex items-center justify-center animate-in fade-in duration-300">
      <div className="max-w-lg mx-auto px-8 text-center">
        <h1 className="text-3xl font-headline font-bold text-accent mb-2">
          PANELHAUS
        </h1>
        <div className="w-16 h-px bg-primary/40 mx-auto mb-8" />

        <p className="text-accent/80 text-lg mb-2">
          Looks like you're on a desktop.
        </p>
        <p className="text-accent/50 text-sm leading-relaxed mb-8">
          This is our mobile-first comic creator — built for phones and tablets.
          For the full desktop experience with advanced layout tools, layer
          editing, and export options:
        </p>

        <a
          href="https://panelhaus.app"
          className="inline-block w-full py-4 bg-primary text-surface font-label uppercase tracking-[0.15em] text-sm rounded-xl mb-4 hover:bg-primary/90 transition-colors"
        >
          Open Panel Haus Desktop →
          <span className="block text-xs opacity-60 mt-1 normal-case tracking-normal">
            panelhaus.app
          </span>
        </a>

        <p className="text-accent/30 text-xs mb-6">
          Redirecting in {seconds} second{seconds !== 1 ? "s" : ""}…
        </p>

        <button
          onClick={handleStay}
          className="text-accent/40 hover:text-accent/70 text-sm underline underline-offset-4 transition-colors"
        >
          Stay on the mobile version anyway
        </button>

        <div className="mt-12 grid grid-cols-2 gap-8 text-left text-xs text-accent/40">
          <div>
            <p className="font-label uppercase tracking-[0.15em] text-accent/60 mb-2">
              Mobile App
            </p>
            <ul className="space-y-1">
              <li>✦ AI story generation</li>
              <li>✦ Quick panel creation</li>
              <li>✦ Touch-friendly editing</li>
              <li>✦ Speech bubbles & text</li>
              <li>✦ On-the-go workflows</li>
            </ul>
          </div>
          <div>
            <p className="font-label uppercase tracking-[0.15em] text-accent/60 mb-2">
              Desktop App
            </p>
            <ul className="space-y-1">
              <li>✦ Full layer editor</li>
              <li>✦ Advanced layout tools</li>
              <li>✦ High-res export</li>
              <li>✦ Import .panelhaus packages</li>
              <li>✦ Professional finishing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  const [vaultAutoOpen, setVaultAutoOpen] = useState(false);
  const [gifEditorImages, setGifEditorImages] = useState<
    { id: string; imageData: string }[] | null
  >(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = usePersistedState(
    "panelshaq_active_tab",
    "workshop",
  );

  const guardedSetActiveTab = useCallback(
    (tab: string) => {
      if (activeTab === "director" && isGenerating && tab !== "director") {
        if (
          !window.confirm(
            "Panels are still generating. Switching tabs will cancel the queue and waste API credits. Continue?",
          )
        ) {
          return;
        }
      }
      setActiveTab(tab);
    },
    [activeTab, isGenerating, setActiveTab],
  );

  useEffect(() => {
    if (activeTab !== "vault") setVaultAutoOpen(false);
  }, [activeTab]);

  // Warn on browser close/refresh during generation
  useEffect(() => {
    if (!isGenerating) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isGenerating]);
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
  const [pageFormat, setPageFormat] = usePersistedState<string>(
    "panelshaq_page_format",
    "portrait",
  );
  const [styleReferenceImage, setStyleReferenceImage] = useIndexedDBState<
    string | null
  >("panelshaq_style_ref", null);

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
  const projectCreatedAtRef = useRef<string | null>(null);
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);

  // Auto-save to IndexedDB
  const saveCurrentProject = useCallback(async () => {
    if (!story && panels.length === 0) return;

    const id = currentProjectId || crypto.randomUUID();
    if (!currentProjectId) setCurrentProjectId(id);

    const fullImage = panels.find((p) => p.image)?.image || "";
    let smallThumb = "";
    if (fullImage) {
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = fullImage;
        });
        const canvas = document.createElement("canvas");
        const maxW = 120;
        const scale = maxW / img.width;
        canvas.width = maxW;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        smallThumb = canvas.toDataURL("image/jpeg", 0.6);
      } catch {
        smallThumb = "";
      }
    }

    // Preserve original createdAt if project already exists
    const now = new Date().toISOString();
    const existingCreatedAt = projectCreatedAtRef.current || now;
    if (!projectCreatedAtRef.current) projectCreatedAtRef.current = now;

    await saveProject({
      id,
      name: projectName,
      createdAt: existingCreatedAt,
      updatedAt: now,
      thumbnail: smallThumb,
      story,
      characters,
      vaultEntries,
      panels,
      pages,
    });
  }, [currentProjectId, projectName, story, vaultEntries, panels, pages]);

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
    projectCreatedAtRef.current = project.createdAt;
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
    projectCreatedAtRef.current = null;
    setProjectName("Untitled Project");
    setStory("");
    setPanels([]);
    setPages([]);
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
            onGenerateSuccess={() => setActiveTab("director")}
            onNavigate={(tab) => {
              if (tab === "vault") setVaultAutoOpen(true);
              guardedSetActiveTab(tab);
            }}
          />
        );
      case "director":
        return (
          <DirectorScreen
            panels={panels}
            setPanels={setPanels}
            characters={characters}
            backgrounds={vaultEntries.filter((e) => e.type === "Environment")}
            props={vaultEntries.filter((e) => e.type === "Prop")}
            vehicles={vaultEntries.filter((e) => e.type === "Vehicle")}
            story={story}
            projectName={projectName}
            onContinue={() => guardedSetActiveTab("layout")}
            onGeneratingChange={setIsGenerating}
          />
        );
      case "layout":
        return (
          <LayoutScreen
            panels={panels}
            pages={pages}
            setPages={setPages}
            onContinue={() => guardedSetActiveTab("editor")}
            pageFormat={pageFormat}
            setPageFormat={setPageFormat}
          />
        );
      case "vault":
        return (
          <VaultScreen
            entries={vaultEntries}
            setEntries={setVaultEntries}
            autoOpenNew={vaultAutoOpen}
          />
        );
      case "editor":
        return (
          <EditorScreen
            panels={panels}
            pages={pages}
            setPanels={setPanels}
            onNavigate={guardedSetActiveTab}
            pageFormat={pageFormat}
            onOpenGifEditor={setGifEditorImages}
          />
        );
      case "settings":
        return <SettingsScreen />;
      case "share":
        return (
          <ShareScreen
            projectName={projectName}
            story={story}
            pages={pages}
            panels={panels}
            vaultEntries={vaultEntries}
          />
        );
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
        guardedSetActiveTab(TAB_ORDER[nextIdx]);
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

      {gifEditorImages ? (
        <main className="relative z-10">
          <ErrorBoundary>
            <Suspense fallback={<LoadingSkeleton />}>
              <GifEditorScreen
                panelImages={gifEditorImages}
                onBack={() => setGifEditorImages(null)}
                pageFormat={pageFormat}
              />
            </Suspense>
          </ErrorBoundary>
        </main>
      ) : (
        <>
          <TopNav
            onCreate={() => setIsProjectManagerOpen(true)}
            onTabChange={guardedSetActiveTab}
          />

          <main
            {...bindSwipe()}
            className="relative z-10"
            style={{ touchAction: "pan-y" }}
          >
            <ErrorBoundary>
              <Suspense fallback={<LoadingSkeleton />}>
                {renderScreen()}
              </Suspense>
            </ErrorBoundary>
          </main>

          <BottomNav activeTab={activeTab} onTabChange={guardedSetActiveTab} />
        </>
      )}

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
  const isDesktop = useIsDesktop();
  const [gateOpen, setGateOpen] = useState(
    () => !localStorage.getItem("panelshaq_desktop_gate_dismissed"),
  );

  return (
    <ConfirmProvider>
      <ToastProvider>
        <AppInner />
        {isDesktop && gateOpen && (
          <DesktopRedirectGate onStay={() => setGateOpen(false)} />
        )}
      </ToastProvider>
    </ConfirmProvider>
  );
}
