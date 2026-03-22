import React, { useState } from "react";
import {
  Menu,
  X,
  Home,
  BookOpen,
  Settings,
  HelpCircle,
  Layout,
  PenTool,
  Share2,
  Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

export const TopNav = ({
  onCreate,
  onTabChange,
}: {
  onCreate: () => void;
  onTabChange: (tab: string) => void;
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const menuItems = [
    { id: "workshop", icon: Home, label: "Workshop" },
    { id: "director", icon: BookOpen, label: "Director" },
    { id: "layout", icon: Layout, label: "Layout" },
    { id: "editor", icon: PenTool, label: "Editor" },
    { id: "vault", icon: Globe, label: "World Vault" },
    { id: "share", icon: Share2, label: "Share" },
  ];

  return (
    <>
      <header
        className="fixed top-0 w-full z-50 bg-[#0B1326] border-b border-surface-container"
        style={{ paddingTop: "var(--sat)" }}
      >
        <div className="flex justify-between items-center w-full px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="text-primary hover:opacity-80 transition-opacity active:scale-90 duration-200"
            >
              <Menu size={28} />
            </button>
            <h1 className="font-headline font-bold tracking-tighter text-xl text-primary italic uppercase">
              PANEL SHAQ
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onTabChange("settings")}
              className="text-accent/40 hover:text-primary transition-colors active:scale-90 duration-200 p-2"
              title="Settings"
            >
              <Settings size={22} />
            </button>
            <button
              onClick={onCreate}
              className="bg-primary text-background font-headline font-bold px-5 py-2 rounded-lg text-sm hover:opacity-80 transition-opacity active:scale-90 duration-200 uppercase"
            >
              NEW / LOAD
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />

            {/* Sidebar */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 h-full w-[280px] bg-[#0B1326] z-[70] shadow-2xl border-r border-surface-container p-6 flex flex-col"
            >
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-baseline gap-0.5">
                  <h2 className="font-headline font-bold text-2xl text-primary italic uppercase">
                    PANELHAUS
                  </h2>
                  <span className="text-[9px] text-primary/40 font-bold">
                    .app
                  </span>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="text-accent/60 hover:text-primary transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <nav className="flex-1 space-y-2">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id);
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-primary/10 text-accent/80 hover:text-primary transition-all group"
                  >
                    <item.icon
                      size={22}
                      className="group-hover:scale-110 transition-transform"
                    />
                    <span className="font-headline font-bold uppercase tracking-wide">
                      {item.label}
                    </span>
                  </button>
                ))}
              </nav>

              <div className="pt-6 border-t border-surface-container space-y-2">
                <button
                  onClick={() => {
                    onTabChange("settings");
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-surface-container text-accent/40 hover:text-primary transition-all"
                >
                  <Settings size={20} />
                  <span className="text-sm font-bold uppercase tracking-widest">
                    Settings
                  </span>
                </button>
                <button
                  onClick={() => setShowHelp((v) => !v)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-surface-container text-accent/40 hover:text-primary transition-all"
                >
                  <HelpCircle size={20} />
                  <span className="text-sm font-bold uppercase tracking-widest">
                    Help
                  </span>
                </button>
                {showHelp && (
                  <div className="mx-2 mb-2 p-4 bg-surface-container/80 rounded-xl border border-outline/10 space-y-4 text-xs text-accent/60 leading-relaxed max-h-[50vh] overflow-y-auto">
                    <div>
                      <p className="font-label text-primary uppercase tracking-[0.15em] text-[9px] font-bold mb-1">
                        The Workflow
                      </p>
                      <p>
                        <strong className="text-accent/80">Workshop</strong> —
                        Write your story and generate panel descriptions with
                        AI. <strong className="text-accent/80">Director</strong>{" "}
                        — Tweak descriptions, pick camera angles & lenses,
                        generate images.{" "}
                        <strong className="text-accent/80">Layout</strong> —
                        Arrange panels into comic pages with different layouts.{" "}
                        <strong className="text-accent/80">Editor</strong> — Add
                        speech bubbles, position panels, export or share.
                      </p>
                    </div>
                    <div>
                      <p className="font-label text-primary uppercase tracking-[0.15em] text-[9px] font-bold mb-1">
                        World Vault
                      </p>
                      <p>
                        Store characters, environments, props, and vehicles with
                        reference images. The AI uses these to keep your comic
                        visually consistent. You can select up to 5 references
                        per panel across all types.
                      </p>
                    </div>
                    <div>
                      <p className="font-label text-primary uppercase tracking-[0.15em] text-[9px] font-bold mb-1">
                        Panel Director Tips
                      </p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>
                          Edit descriptions to fine-tune what the AI generates
                        </li>
                        <li>
                          Use "Regeneration Notes" to give feedback on a result
                        </li>
                        <li>
                          Try different camera lenses for dramatic effects
                        </li>
                        <li>
                          Insert panels between existing ones to expand the
                          story
                        </li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-label text-primary uppercase tracking-[0.15em] text-[9px] font-bold mb-1">
                        Editor Tips
                      </p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>
                          Drag & pinch to reposition and scale panel images
                        </li>
                        <li>
                          Tap a panel, then add speech, thought, or SFX bubbles
                        </li>
                        <li>
                          Drag bubbles to position them anywhere in the panel
                        </li>
                        <li>
                          "Bake" burns dialogue permanently into the artwork
                        </li>
                        <li>
                          Export as PDF or PNG, or share directly from your
                          phone
                        </li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-label text-primary uppercase tracking-[0.15em] text-[9px] font-bold mb-1">
                        Layout Tips
                      </p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>
                          Each page can have a different number of panels (1–6)
                        </li>
                        <li>Tap layout thumbnails to switch arrangements</li>
                        <li>
                          Use the top bar to repartition all pages at once
                        </li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-label text-primary uppercase tracking-[0.15em] text-[9px] font-bold mb-1">
                        API Key
                      </p>
                      <p>
                        Panel Shaq uses Google Gemini for AI generation. You can
                        get a free API key from Google AI Studio and enter it in
                        Settings.
                      </p>
                    </div>
                  </div>
                )}
                <a
                  href="https://panelhaus.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-surface-container text-accent/40 hover:text-primary transition-all"
                >
                  <Globe size={20} />
                  <span className="text-sm font-bold uppercase tracking-widest">
                    Panelhaus.app
                  </span>
                </a>
                <a
                  href="https://discord.gg/UfshvCNY5Y"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-surface-container text-accent/40 hover:text-[#5865F2] transition-all"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  <span className="text-sm font-bold uppercase tracking-widest">
                    Discord
                  </span>
                </a>
              </div>

              {/* Brand footer */}
              <div className="pt-4 mt-4 border-t border-surface-container text-center">
                <a
                  href="https://panelhaus.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-baseline gap-0.5 opacity-30 hover:opacity-60 transition-opacity"
                >
                  <span className="font-headline font-bold text-[11px] text-accent italic uppercase tracking-tight">
                    PANELHAUS
                  </span>
                  <span className="text-[8px] text-accent font-bold">.app</span>
                </a>
                <p className="text-[8px] text-accent/20 mt-1">
                  AI Comic Studio
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export const BottomNav = ({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) => {
  const tabs = [
    { id: "workshop", icon: "home" },
    { id: "director", icon: "auto_stories" },
    { id: "layout", icon: "auto_awesome_motion" },
    { id: "editor", icon: "view_quilt" },
    { id: "vault", icon: "public" },
  ];

  // Using Material Symbols for icons as seen in the screenshots
  return (
    <nav
      className="bottom-nav fixed left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-50"
      style={{ bottom: "calc(var(--sab, 0px) + 1.5rem)" }}
    >
      <div className="bg-[#31394D]/60 backdrop-blur-xl rounded-2xl shadow-[0_20px_40px_rgba(6,14,32,0.4)] flex justify-around items-center py-2 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center justify-center p-3 rounded-xl transition-all duration-300",
              activeTab === tab.id
                ? "bg-primary text-background shadow-[0_0_15px_rgba(255,145,0,0.5)] scale-110"
                : "text-[#FFF3D2] hover:bg-surface-container",
            )}
          >
            <span className="material-symbols-outlined">{tab.icon}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};
