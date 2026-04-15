import React, { useState, useEffect } from "react";
import {
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  Info,
} from "lucide-react";
import { usePersistedState } from "../hooks/usePersistedState";
import { getUsageToday } from "../services/supabase";

export interface AppSettings {
  geminiApiKey: string;
  defaultExportFormat: "pdf" | "png";
  exportQuality: "standard" | "high" | "maximum";
  autoSaveInterval: number;
  includePageNumbers: boolean;
  imageModel: "flash" | "pro";
  showRegenWarnings: boolean;
  showDataWarnings: boolean;
  rotationStep: number;
  pageBackgroundColor: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: "",
  defaultExportFormat: "pdf",
  exportQuality: "high",
  autoSaveInterval: 30000,
  includePageNumbers: false,
  imageModel: "flash",
  showRegenWarnings: true,
  showDataWarnings: true,
  rotationStep: 10,
  pageBackgroundColor: "#000000",
};

interface SettingsScreenProps {
  appMode?: "byok" | "hosted";
}

export const SettingsScreen = ({ appMode = "byok" }: SettingsScreenProps) => {
  const [settings, setSettings] = usePersistedState<AppSettings>(
    "panelshaq_settings",
    DEFAULT_SETTINGS,
  );
  const [tipsEnabled, setTipsEnabled] = useState(
    () => localStorage.getItem("panelshaq_tips_disabled") !== "1",
  );
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [usage, setUsage] = useState<{ text: number; image: number } | null>(
    null,
  );

  useEffect(() => {
    getUsageToday().then((u) => {
      if (u) setUsage(u);
    });
  }, []);

  const updateSetting = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleTestConnection = async () => {
    setTestStatus("testing");
    try {
      const key = settings.geminiApiKey;
      if (!key) {
        setTestStatus("error");
        return;
      }
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: "Reply with just the word OK",
      });
      if (response.text) {
        setTestStatus("success");
      } else {
        setTestStatus("error");
      }
    } catch (err) {
      console.error("Connection test failed:", err);
      setTestStatus("error");
    }
  };

  const handleClearProjectData = () => {
    if (
      window.confirm(
        "This will delete ALL project data (story, panels, pages, characters). Are you sure?",
      )
    ) {
      localStorage.removeItem("panelshaq_story");
      localStorage.removeItem("panelshaq_characters");
      localStorage.removeItem("panelshaq_panels");
      localStorage.removeItem("panelshaq_pages");
      localStorage.removeItem("panelshaq_style_ref");
      localStorage.removeItem("panelshaq_vault");
      localStorage.removeItem("panelshaq_active_tab");
      window.location.reload();
    }
  };

  const handleClearExportHistory = () => {
    if (window.confirm("Clear all export history?")) {
      localStorage.removeItem("comic_export_history");
    }
  };

  return (
    <div className="pt-24 px-6 max-w-2xl mx-auto pb-40">
      <header className="mb-10">
        <span className="font-label text-primary uppercase tracking-[0.2em] text-[10px] mb-2 block">
          Configuration
        </span>
        <h2 className="font-headline text-5xl font-bold text-accent tracking-tighter">
          Settings
        </h2>
      </header>

      <div className="space-y-8">
        {/* API Configuration */}
        {appMode === "hosted" && (
          <section className="bg-surface-container rounded-xl p-6 border border-outline/10 space-y-3">
            <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
              <CheckCircle size={16} className="text-green-500 shrink-0" />
              <p className="text-sm text-accent/70">
                You're using Panel Shaq's hosted service.
                {settings.geminiApiKey ? " Your own API key is active." : ""}
              </p>
            </div>
          </section>
        )}
        <section className="bg-surface-container rounded-xl p-6 border border-outline/10 space-y-4">
          <h3 className="font-headline text-lg font-bold text-primary flex items-center gap-2">
            <Key size={18} />
            API Configuration
          </h3>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-accent/50 uppercase tracking-widest block">
              Gemini API Key
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={settings.geminiApiKey}
                  onChange={(e) =>
                    updateSetting("geminiApiKey", e.target.value)
                  }
                  placeholder="AIzaSy..."
                  className="w-full bg-background border border-outline/20 rounded-lg px-4 py-3 text-sm text-accent placeholder-accent/20 outline-none focus:border-primary/50 pr-10"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-accent/30 hover:text-accent transition-colors"
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                onClick={handleTestConnection}
                disabled={testStatus === "testing" || !settings.geminiApiKey}
                className="px-4 py-3 bg-primary/10 text-primary border border-primary/30 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-background transition-all disabled:opacity-50"
              >
                {testStatus === "testing" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  "Test"
                )}
              </button>
              {settings.geminiApiKey && (
                <button
                  onClick={() => {
                    updateSetting("geminiApiKey", "");
                    setTestStatus("idle");
                  }}
                  className="px-3 py-3 text-red-400/60 border border-red-500/20 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-all"
                  title="Remove API key"
                  aria-label="Remove API key"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {testStatus === "success" && (
              <p className="text-xs text-green-500 flex items-center gap-1">
                <CheckCircle size={12} /> Connected successfully
              </p>
            )}
            {testStatus === "error" && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <XCircle size={12} /> Connection failed — check your key
              </p>
            )}
            <p className="text-[10px] text-accent/30 leading-relaxed">
              Get a free key at{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                aistudio.google.com/apikey
              </a>
              . Your key is stored locally in your browser — never sent to our
              servers.
            </p>
          </div>
        </section>

        {/* Image Model */}
        <section className="bg-surface-container rounded-xl p-6 border border-outline/10 space-y-4">
          <h3 className="font-headline text-lg font-bold text-accent">
            Image Generation Model
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => updateSetting("imageModel", "flash")}
              className={`p-4 rounded-xl text-left border transition-all active:scale-95 ${
                settings.imageModel === "flash"
                  ? "bg-primary text-background border-primary shadow-[0_2px_10px_rgba(255,145,0,0.3)]"
                  : "bg-background text-accent/60 border-outline/20 hover:border-primary/50"
              }`}
            >
              <span className="text-sm font-bold block">Flash</span>
              <span className="text-[10px] opacity-70 block mt-1">
                Faster, cheaper
              </span>
              <span className="text-[9px] opacity-50 block">
                $0.067 / image
              </span>
            </button>
            <button
              onClick={() => updateSetting("imageModel", "pro")}
              className={`p-4 rounded-xl text-left border transition-all active:scale-95 ${
                settings.imageModel === "pro"
                  ? "bg-primary text-background border-primary shadow-[0_2px_10px_rgba(255,145,0,0.3)]"
                  : "bg-background text-accent/60 border-outline/20 hover:border-primary/50"
              }`}
            >
              <span className="text-sm font-bold block">Pro</span>
              <span className="text-[10px] opacity-70 block mt-1">
                Higher quality
              </span>
              <span className="text-[9px] opacity-50 block">
                $0.134 / image
              </span>
            </button>
          </div>
        </section>

        {/* Export Preferences */}
        <section className="bg-surface-container rounded-xl p-6 border border-outline/10 space-y-4">
          <h3 className="font-headline text-lg font-bold text-accent">
            Export Preferences
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-accent/50 uppercase tracking-widest block">
                Default Format
              </label>
              <select
                value={settings.defaultExportFormat}
                onChange={(e) =>
                  updateSetting(
                    "defaultExportFormat",
                    e.target.value as "pdf" | "png",
                  )
                }
                className="w-full bg-background text-accent text-sm py-2.5 px-3 rounded-lg border border-outline/20 outline-none focus:border-primary appearance-none"
              >
                <option value="pdf">PDF</option>
                <option value="png">PNG</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-accent/50 uppercase tracking-widest block">
                Export Quality
              </label>
              <select
                value={settings.exportQuality}
                onChange={(e) =>
                  updateSetting(
                    "exportQuality",
                    e.target.value as "standard" | "high" | "maximum",
                  )
                }
                className="w-full bg-background text-accent text-sm py-2.5 px-3 rounded-lg border border-outline/20 outline-none focus:border-primary appearance-none"
              >
                <option value="standard">Standard</option>
                <option value="high">High (300 DPI)</option>
                <option value="maximum">Maximum</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-background/30 rounded-lg">
            <span className="text-sm text-accent">Include Page Numbers</span>
            <input
              type="checkbox"
              checked={settings.includePageNumbers}
              onChange={(e) =>
                updateSetting("includePageNumbers", e.target.checked)
              }
              className="accent-primary w-4 h-4"
            />
          </div>
        </section>

        {/* Editor */}
        <section className="bg-surface-container rounded-xl p-6 border border-outline/10 space-y-4">
          <h3 className="font-headline text-lg font-bold text-accent">
            Editor
          </h3>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-accent/50 uppercase tracking-widest block">
              Rotation per tap
            </label>
            <div className="bg-background p-1 rounded-lg flex gap-1 border border-outline/10">
              {[1, 5, 10, 15, 45].map((deg) => (
                <button
                  key={deg}
                  onClick={() => updateSetting("rotationStep", deg)}
                  className={`flex-1 px-2 py-2 rounded-md text-[11px] font-bold transition-all ${
                    (settings.rotationStep || 10) === deg
                      ? "bg-primary text-background"
                      : "text-accent/50"
                  }`}
                >
                  {deg}°
                </button>
              ))}
            </div>
            <p className="text-[9px] text-accent/30">
              Degrees per 2-finger tap on images and bubbles
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-accent/50 uppercase tracking-widest block">
              Page Background
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { color: "#FFFFFF", label: "White" },
                { color: "#000000", label: "Black" },
                { color: "#FFF8E7", label: "Cream" },
                { color: "#E5E7EB", label: "Gray" },
                { color: "#DBEAFE", label: "Blue" },
                { color: "#0B1326", label: "Navy" },
                { color: "transparent", label: "Transparent" },
              ].map(({ color, label }) => (
                <button
                  key={color}
                  title={label}
                  onClick={() => updateSetting("pageBackgroundColor", color)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    (settings.pageBackgroundColor || "#FFFFFF") === color
                      ? "border-primary scale-110"
                      : "border-outline/20"
                  }`}
                  style={{
                    background:
                      color === "transparent"
                        ? "repeating-conic-gradient(#808080 0% 25%, #c0c0c0 0% 50%) 50% / 12px 12px"
                        : color,
                  }}
                />
              ))}
            </div>
            <p className="text-[9px] text-accent/30">
              Background color for comic pages and exports
            </p>
          </div>
        </section>

        {/* App Preferences */}
        <section className="bg-surface-container rounded-xl p-6 border border-outline/10 space-y-4">
          <h3 className="font-headline text-lg font-bold text-accent">
            App Preferences
          </h3>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-accent/50 uppercase tracking-widest block">
              Auto-Save Interval
            </label>
            <select
              value={settings.autoSaveInterval}
              onChange={(e) =>
                updateSetting("autoSaveInterval", parseInt(e.target.value))
              }
              className="w-full bg-background text-accent text-sm py-2.5 px-3 rounded-lg border border-outline/20 outline-none focus:border-primary appearance-none"
            >
              <option value={0}>Off</option>
              <option value={30000}>Every 30 seconds</option>
              <option value={60000}>Every 1 minute</option>
              <option value={300000}>Every 5 minutes</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-3 bg-background/30 rounded-lg">
            <div>
              <span className="text-sm text-accent">Regeneration Warnings</span>
              <p className="text-[10px] text-accent/30">
                Confirm before replacing existing images
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.showRegenWarnings}
              onChange={(e) =>
                updateSetting("showRegenWarnings", e.target.checked)
              }
              className="accent-primary w-4 h-4"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-background/30 rounded-lg">
            <div>
              <span className="text-sm text-accent">Data Warnings</span>
              <p className="text-[10px] text-accent/30">
                Confirm before switching projects or clearing data
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.showDataWarnings}
              onChange={(e) =>
                updateSetting("showDataWarnings", e.target.checked)
              }
              className="accent-primary w-4 h-4"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-background/30 rounded-lg">
            <div>
              <span className="text-sm text-accent">Tooltips & Hints</span>
              <p className="text-[10px] text-accent/30">
                Show Smudge tips throughout the app. Toggling on resets all
                dismissed tips so you can see them again.
              </p>
            </div>
            <input
              type="checkbox"
              checked={tipsEnabled}
              onChange={(e) => {
                const on = e.target.checked;
                setTipsEnabled(on);
                if (on) {
                  localStorage.removeItem("panelshaq_tips_disabled");
                  localStorage.removeItem("panelshaq_tips_seen");
                } else {
                  localStorage.setItem("panelshaq_tips_disabled", "1");
                }
              }}
              className="accent-primary w-4 h-4"
            />
          </div>

          <div className="space-y-2 pt-4 border-t border-outline/10">
            <button
              onClick={() => {
                localStorage.removeItem(
                  "panelshaq_director_onboarding_dismissed",
                );
                localStorage.removeItem(
                  "panelshaq_editor_onboarding_dismissed",
                );
                localStorage.removeItem(
                  "panelshaq_layout_onboarding_dismissed",
                );
                localStorage.removeItem("panelshaq_vault_onboarding_dismissed");
                localStorage.removeItem(
                  "panelshaq_workshop_onboarding_dismissed",
                );
                localStorage.removeItem("panelshaq_desktop_gate_dismissed");
                localStorage.removeItem("panelshaq_seen_desc_tip");
                alert("All instruction banners will show again on next visit.");
              }}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-primary/10 text-accent/60 hover:text-primary transition-all"
            >
              <Info size={16} />
              <span className="text-sm font-bold">Reset All Instructions</span>
            </button>
            <button
              onClick={handleClearExportHistory}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-500/10 text-accent/60 hover:text-red-500 transition-all"
            >
              <Trash2 size={16} />
              <span className="text-sm font-bold">Clear Export History</span>
            </button>
            <button
              onClick={handleClearProjectData}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-500/10 text-accent/60 hover:text-red-500 transition-all"
            >
              <Trash2 size={16} />
              <span className="text-sm font-bold">Clear All Project Data</span>
            </button>
          </div>
        </section>

        {/* Usage */}
        {usage && (
          <section className="bg-surface-container rounded-xl p-6 border border-outline/10 space-y-4">
            <h3 className="font-headline text-lg font-bold text-accent">
              Today's Usage
            </h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-accent/60">Text Generations</span>
                  <span className="font-bold text-accent">
                    {usage.text} / 50
                  </span>
                </div>
                <div className="h-2 bg-background rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${usage.text >= 45 ? "bg-red-500" : "bg-primary"}`}
                    style={{
                      width: `${Math.min(100, (usage.text / 50) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-accent/60">Image Generations</span>
                  <span className="font-bold text-accent">
                    {usage.image} / 20
                  </span>
                </div>
                <div className="h-2 bg-background rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${usage.image >= 18 ? "bg-red-500" : "bg-primary"}`}
                    style={{
                      width: `${Math.min(100, (usage.image / 20) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-accent/30">
                Resets at midnight UTC
              </p>
            </div>
          </section>
        )}

        {/* About */}
        <section className="bg-surface-container rounded-xl p-6 border border-outline/10 space-y-3">
          <h3 className="font-headline text-lg font-bold text-accent flex items-center gap-2">
            <Info size={18} />
            About
          </h3>
          <div className="space-y-2 text-sm text-accent/60">
            <div className="flex justify-between">
              <span>Version</span>
              <span className="font-bold text-primary">0.1.0</span>
            </div>
            <div className="flex justify-between">
              <span>Engine</span>
              <span className="font-bold text-accent/80">
                Gemini 3.1 Flash / Pro
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
