import React, { useState, useEffect, useCallback } from "react";
import { TopNav, BottomNav } from "./components/Navigation";
import { WorkshopScreen } from "./screens/WorkshopScreen";
import { DirectorScreen } from "./screens/DirectorScreen";
import { VaultScreen } from "./screens/VaultScreen";
import { EditorScreen } from "./screens/EditorScreen";
import { LayoutScreen, Page } from "./screens/LayoutScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { ShareScreen } from "./screens/ShareScreen";
import { ProjectManager } from "./components/ProjectManager";
import { PanelPrompt } from "./services/geminiService";
import { saveProject, type SavedProject } from "./services/projectStorage";
import { usePersistedState } from "./hooks/usePersistedState";
import { useIndexedDBState } from "./hooks/useIndexedDBState";

export interface Character {
  id: string;
  name: string;
  image: string;
  description?: string;
}

const DEFAULT_CHARACTERS: Character[] = [
  {
    id: "1",
    name: "Nova-7",
    image: "https://picsum.photos/seed/nova/400/400",
    description: "A cybernetic pilot with a glowing blue eye.",
  },
  {
    id: "2",
    name: "The Drifter",
    image: "https://picsum.photos/seed/drifter/400/400",
    description: "A mysterious wanderer in a tattered cloak.",
  },
];

export default function App() {
  const [activeTab, setActiveTab] = usePersistedState(
    "panelshaq_active_tab",
    "workshop",
  );
  const [story, setStory] = usePersistedState("panelshaq_story", "");
  const [characters, setCharacters] = useIndexedDBState<Character[]>(
    "panelshaq_characters",
    DEFAULT_CHARACTERS,
  );
  const [panels, setPanels] = useIndexedDBState<PanelPrompt[]>(
    "panelshaq_panels",
    [],
  );
  const [pages, setPages] = usePersistedState<Page[]>("panelshaq_pages", []);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [styleReferenceImage, setStyleReferenceImage] = useIndexedDBState<
    string | null
  >("panelshaq_style_ref", null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        setHasApiKey(true); // Fallback for local dev if not in AI Studio
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface-container p-8 rounded-2xl border border-outline/10 text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl">🔑</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-headline font-bold text-accent">
              API Key Required
            </h1>
            <p className="text-sm text-accent/60 leading-relaxed">
              To use the enhanced Gemini 3.1 models for high-quality comic
              generation, you need to select a paid API key.
            </p>
          </div>
          <button
            onClick={handleSelectKey}
            className="w-full py-4 bg-primary text-background font-headline font-bold rounded-xl shadow-[0_4px_14px_rgba(255,145,0,0.39)] active:scale-95 transition-transform"
          >
            Select API Key
          </button>
          <p className="text-[10px] text-accent/40 uppercase tracking-widest">
            Requires a Google Cloud project with billing enabled
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
    setStyleReferenceImage(null);
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

      <main className="relative z-10">{renderScreen()}</main>

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
