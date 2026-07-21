import React, {
  useState,
  useEffect,
  useLayoutEffect,
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
import { BuyCreditsSheet } from "./components/BuyCreditsSheet";
import { ShipClaimHost } from "./components/ShipClaimHost";
import {
  PanelPrompt,
  onApiError,
  hydratePanel,
} from "./services/geminiService";
import { onOpenBuyCredits, type BuyReason } from "./services/buyCredits";
import { track } from "./services/analytics";
import {
  isClerkEnabled,
  getClerkToken,
  openClerkSignIn,
} from "./services/clerkToken";
import {
  fetchAccount,
  emitBalance,
  getCachedBalance,
} from "./services/credits";
import { saveProject, type SavedProject } from "./services/projectStorage";
import { usePersistedState } from "./hooks/usePersistedState";
import { useIndexedDBState } from "./hooks/useIndexedDBState";
import type { Page } from "./screens/LayoutScreen";
import type { VaultEntry } from "./screens/VaultScreen";

// Auto-reload on stale chunk errors (happens after new deployments)
function lazyWithReload<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  const never = () => new Promise<{ default: T }>(() => {});
  return React.lazy(() =>
    factory().catch(async (err) => {
      const isChunkError =
        err.message?.includes("Failed to fetch dynamically imported module") ||
        err.message?.includes("Loading chunk") ||
        err.name === "ChunkLoadError";
      if (!isChunkError) throw err;

      // A chunk failed to load — usually a stale app shell after a deploy.
      // Reload to pick up fresh chunks, but GUARD against an infinite reload
      // loop: a stale service worker can keep serving the same broken shell,
      // which would otherwise reload-flash forever.
      const RELOAD_KEY = "panelshaq_chunk_reload_at";
      const NUKE_KEY = "panelshaq_chunk_sw_cleared";
      const reloadedRecently =
        Date.now() - Number(sessionStorage.getItem(RELOAD_KEY) || "0") < 10_000;

      if (!reloadedRecently) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
        return never();
      }

      // The reload didn't fix it → the service worker is serving a stale
      // precache. Clear SW registrations + caches once, then reload clean.
      if (!sessionStorage.getItem(NUKE_KEY)) {
        sessionStorage.setItem(NUKE_KEY, "1");
        try {
          if ("serviceWorker" in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
          }
          if (typeof caches !== "undefined") {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
        } catch {
          /* best effort */
        }
        window.location.reload();
        return never();
      }

      // Even a clean reload failed — stop looping and let the ErrorBoundary
      // show a real message instead of an endless flash.
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

// Crypto (OxaPay) purchases settle ON-CHAIN — minutes, not the seconds a Stripe
// webhook takes — so the crypto return polls on this escalating schedule (~3 min
// total, mirroring Panel Haus) instead of the card path's 3s/7s. Do not shorten it.
const CRYPTO_POLL_DELAYS_MS = [3000, 7000, 15000, 30000, 60000, 65000];

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
    name: "Smudge",
    image: "/Smudge_the_dirty_sponge/02-standing.webp",
    description:
      "A grimy yellow kitchen sponge with a round, ball-shaped body (a circle, never square or rectangular), small beady black eyes, and tiny brown boots. Pores and blue stains cover his body. Cartoon style with bold outlines.",
    personality: "Wise-cracking, sarcastic veteran. Tired but sharp-witted.",
    visualLook:
      "Round, circular ball-shaped sponge body in yellow (never square or rectangular) with darker grime and blue stain patches. Small pores dotting the surface. Small beady black eyes with a grumpy expression. Thin arms and legs, small brown boots. Cartoon proportions.",
  },
];

function AppInner() {
  const { addToast } = useToast();
  const { confirm } = useConfirm();

  // Connect API error notifications to toast system
  useEffect(() => {
    return onApiError((msg) => addToast(msg, "error"));
  }, [addToast]);

  // Buy Ink sheet: a single instance opened from anywhere (Settings, the nav ink
  // chip, the out-of-ink path) via the buyCredits event bus. The reason drives a
  // contextual "out of ink" banner inside the sheet. Clerk-only.
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyReason, setBuyReason] = useState<BuyReason>(null);
  useEffect(
    () =>
      onOpenBuyCredits((reason) => {
        setBuyReason(reason);
        setBuyOpen(true);
      }),
    [],
  );

  // Wallet deep-link return: a plain-mobile user who tapped "Open in MetaMask"
  // lands back here inside MetaMask's in-app browser (where window.ethereum now
  // exists, so Clerk's native MetaMask button works). Auto-open the sign-in modal
  // and strip the param. Clerk-only.
  useEffect(() => {
    if (!isClerkEnabled()) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("signin") === "wallet") {
      openClerkSignIn();
      params.delete("signin");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (qs ? `?${qs}` : ""),
      );
    }
  }, []);

  // Checkout return handler. PH sends the user back to OUR origin at
  // /success?session_id=…&type=booster (card), /success?crypto=1&type=booster
  // (crypto), or /app?checkout_canceled=… (back). Runs once on mount; Clerk-only.
  //
  // The two rails settle on very different clocks: a Stripe webhook lands in
  // seconds, while crypto confirms ON-CHAIN and routinely takes 1-3 minutes, so
  // the card path's 3s/7s poll would essentially always miss it and leave the user
  // staring at an unchanged balance right after paying.
  useEffect(() => {
    if (!isClerkEnabled()) return;
    const params = new URLSearchParams(window.location.search);
    const isSuccess =
      window.location.pathname === "/success" || params.has("session_id");
    const isCanceled = params.has("checkout_canceled");
    if (!isSuccess && !isCanceled) return;

    if (isSuccess) {
      const isCrypto = params.get("crypto") === "1";
      const ptype = params.get("type") || "booster";
      let cancelled = false;

      if (isCrypto) {
        // Never claim "credits added" here — nothing is credited until OxaPay's
        // callback reaches PH. Poll on an escalating schedule (~3 min, mirroring
        // PH's SubscriptionBadge), stop the moment the balance actually rises, and
        // end on an honest message rather than an endless spinner.
        addToast("Confirming your crypto payment…", "info", 8000);
        let baseline = getCachedBalance();
        let timer: ReturnType<typeof setTimeout> | undefined;

        const poll = (attempt: number) => {
          if (cancelled) return;
          if (attempt >= CRYPTO_POLL_DELAYS_MS.length) {
            // Budget spent. PH still credits whenever the callback arrives, with
            // or without the app open, so this is true rather than a failure.
            addToast(
              "Payment received. Still confirming on-chain, your ink will land automatically.",
              "info",
              8000,
            );
            track("purchase_pending", { type: ptype, method: "crypto" });
            return;
          }
          timer = setTimeout(
            async () => {
              if (cancelled) return;
              const t = await getClerkToken();
              if (cancelled) return;
              if (t) {
                const { credits } = await fetchAccount(t);
                if (cancelled) return;
                if (credits !== null) {
                  emitBalance(credits);
                  // No baseline yet (cold load): the first read becomes it and we
                  // keep polling for a CHANGE.
                  if (baseline === null) baseline = credits;
                  else if (credits > baseline) {
                    addToast("Ink added. You're topped up.", "success");
                    track("purchase_completed", {
                      type: ptype,
                      method: "crypto",
                    });
                    return;
                  }
                }
              }
              poll(attempt + 1);
            },
            CRYPTO_POLL_DELAYS_MS[attempt],
          );
        };
        poll(0);
        window.history.replaceState(null, "", "/");
        return () => {
          cancelled = true;
          if (timer) clearTimeout(timer);
        };
      }

      // Card: unchanged 0/3s/7s, tuned for the Stripe webhook.
      addToast("Purchase complete. Credits added.", "success");
      track("purchase_completed", { type: ptype, method: "card" });
      const refresh = async () => {
        const t = await getClerkToken();
        if (!t || cancelled) return;
        const { credits } = await fetchAccount(t);
        if (!cancelled && credits !== null) emitBalance(credits);
      };
      refresh();
      const t1 = setTimeout(refresh, 3000);
      const t2 = setTimeout(refresh, 7000);
      window.history.replaceState(null, "", "/");
      return () => {
        cancelled = true;
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    addToast("Checkout canceled.", "info");
    window.history.replaceState(null, "", "/");
  }, [addToast]);

  // Legacy auth mode (byok/hosted) — read-only now. The startup EmailGate is
  // retired in favour of Clerk's soft sign-in gate (see main.tsx + apiPost). Still
  // read to pick the Settings view; falls back to "byok" so the API-key field shows.
  const [authMode] = useState<"byok" | "hosted" | null>(
    () =>
      (localStorage.getItem("panelshaq_auth_mode") as "byok" | "hosted") ||
      null,
  );

  const [vaultAutoOpen, setVaultAutoOpen] = useState(false);
  const [gifEditorImages, setGifEditorImages] = useState<
    { id: string; imageData: string }[] | null
  >(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = usePersistedState(
    "panelshaq_active_tab",
    "workshop",
  );

  // Per-tab scroll memory. Lateral navigation (bottom nav / menu / swipe)
  // restores where you last were on that tab; advancing a step snaps to the top.
  const scrollPositions = useRef<Record<string, number>>({});
  const pendingScroll = useRef<"top" | "restore" | null>(null);

  const changeTab = useCallback(
    (tab: string, scroll: "top" | "restore") => {
      if (activeTab === "director" && isGenerating && tab !== "director") {
        if (
          !window.confirm(
            "Panels are still generating. Switching tabs will cancel the queue and waste API credits. Continue?",
          )
        ) {
          return;
        }
      }
      scrollPositions.current[activeTab] = window.scrollY;
      pendingScroll.current = scroll;
      setActiveTab(tab);
    },
    [activeTab, isGenerating, setActiveTab],
  );

  // Lateral navigation → restore last scroll position for the target tab.
  const guardedSetActiveTab = useCallback(
    (tab: string) => changeTab(tab, "restore"),
    [changeTab],
  );
  // Advancing through the creation flow → snap to the top of the new step.
  const goToStep = useCallback(
    (tab: string) => changeTab(tab, "top"),
    [changeTab],
  );

  useLayoutEffect(() => {
    const mode = pendingScroll.current;
    pendingScroll.current = null;
    if (mode === "top") {
      window.scrollTo(0, 0);
    } else if (mode === "restore") {
      window.scrollTo(0, scrollPositions.current[activeTab] ?? 0);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "vault") setVaultAutoOpen(false);
    if (activeTab === "editor") {
      import("./services/analytics").then(({ trackOnce }) =>
        trackOnce("editor_first_open"),
      );
    }
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
            onGenerateSuccess={() => goToStep("director")}
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
            onContinue={() => goToStep("layout")}
            onGeneratingChange={setIsGenerating}
          />
        );
      case "layout":
        return (
          <LayoutScreen
            panels={panels}
            pages={pages}
            setPages={setPages}
            onContinue={() => goToStep("editor")}
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
            onNavigate={goToStep}
            pageFormat={pageFormat}
            story={story}
            characters={characters}
          />
        );
      case "settings":
        return <SettingsScreen appMode={authMode || "byok"} />;
      case "share":
        return (
          <ShareScreen
            projectName={projectName}
            story={story}
            pages={pages}
            panels={panels}
            vaultEntries={vaultEntries}
            pageFormat={pageFormat}
            onOpenGifEditor={setGifEditorImages}
            onNavigate={guardedSetActiveTab}
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
            onGenerateSuccess={() => goToStep("director")}
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

      {isClerkEnabled() && (
        <BuyCreditsSheet
          isOpen={buyOpen}
          reason={buyReason}
          onClose={() => {
            setBuyOpen(false);
            setBuyReason(null);
          }}
        />
      )}

      {/* GTD ship-claim (signed-in only — gated on the Clerk identity holder
          inside fireShipClaimOnce, not here). */}
      <ShipClaimHost />
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
