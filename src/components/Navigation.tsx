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
            <a
              href="https://panelhaus.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-baseline gap-0.5 group"
            >
              <h1 className="font-headline font-bold tracking-tighter text-3xl text-primary italic uppercase group-hover:opacity-80 transition-opacity">
                PANELHAUS
              </h1>
              <span className="text-[10px] text-primary/50 font-bold">
                .app
              </span>
            </a>
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
              NEW PROJECT
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
                <a
                  href="https://github.com/anthropics/claude-code/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-surface-container text-accent/40 transition-all"
                >
                  <HelpCircle size={20} />
                  <span className="text-sm font-bold uppercase tracking-widest">
                    Help
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
