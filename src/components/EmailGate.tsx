import React, { useState } from "react";
import { Mail, Key, ArrowRight, Loader2 } from "lucide-react";
import { saveEmail } from "../services/supabase";

interface EmailGateProps {
  onComplete: (mode: "hosted" | "byok") => void;
}

export function EmailGate({ onComplete }: EmailGateProps) {
  const [view, setView] = useState<"choose" | "email" | "apikey">("choose");
  const [email, setEmail] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail || saving) return;

    setSaving(true);
    setError("");

    try {
      await saveEmail(email);
      localStorage.setItem("panelshaq_user_email", email);
      localStorage.setItem("panelshaq_auth_mode", "hosted");
      onComplete("hosted");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleApiKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    const saved = localStorage.getItem("panelshaq_settings");
    const settings = saved ? JSON.parse(saved) : {};
    settings.geminiApiKey = apiKey.trim();
    localStorage.setItem("panelshaq_settings", JSON.stringify(settings));
    localStorage.setItem("panelshaq_auth_mode", "byok");
    onComplete("byok");
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-headline text-4xl font-bold text-accent tracking-tight mb-3">
            Welcome to Panel Shaq
          </h1>
          <p className="text-accent/50 text-sm">AI-powered comic creation</p>
        </div>

        {view === "choose" && (
          <div className="space-y-3">
            <button
              onClick={() => setView("email")}
              className="w-full p-5 bg-surface-container border border-outline/20 rounded-xl text-left hover:border-primary/40 transition-all active:scale-[0.98] group"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Mail className="text-primary" size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-headline font-bold text-accent text-base">
                    Start free with email
                  </p>
                  <p className="text-accent/40 text-xs mt-0.5">
                    No API key needed — just enter your email
                  </p>
                </div>
                <ArrowRight
                  size={16}
                  className="text-accent/40 group-hover:text-primary transition-colors"
                />
              </div>
            </button>

            <button
              onClick={() => setView("apikey")}
              className="w-full p-5 bg-surface-container border border-outline/20 rounded-xl text-left hover:border-primary/40 transition-all active:scale-[0.98] group"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-accent/5 border border-outline/20 flex items-center justify-center shrink-0">
                  <Key className="text-accent/50" size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-headline font-bold text-accent text-base">
                    Use your own API key
                  </p>
                  <p className="text-accent/40 text-xs mt-0.5">
                    Bring your Gemini key for unlimited usage
                  </p>
                </div>
                <ArrowRight
                  size={16}
                  className="text-accent/40 group-hover:text-primary transition-colors"
                />
              </div>
            </button>
          </div>
        )}

        {view === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => setView("choose")}
              className="text-accent/40 text-xs hover:text-accent transition-colors mb-2"
            >
              ← Back
            </button>
            <div className="flex items-center gap-3 mb-2">
              <Mail className="text-primary" size={20} />
              <h2 className="font-headline font-bold text-accent text-lg">
                Start free with email
              </h2>
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              className="w-full bg-surface-container border border-outline/20 rounded-xl px-5 py-4 text-accent placeholder-accent/20 outline-none focus:border-primary/50 text-base"
            />
            <button
              type="submit"
              disabled={!isValidEmail || saving}
              className="w-full py-4 px-6 bg-primary text-background font-headline font-bold rounded-xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  Get Started
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            {error && (
              <p className="text-red-400 text-xs text-center">{error}</p>
            )}
            <p className="text-accent/50 text-[10px] text-center leading-relaxed">
              We'll only use your email to keep you updated on Panel Shaq. No
              spam, unsubscribe anytime.
            </p>
          </form>
        )}

        {view === "apikey" && (
          <form onSubmit={handleApiKeySubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => setView("choose")}
              className="text-accent/40 text-xs hover:text-accent transition-colors mb-2"
            >
              ← Back
            </button>
            <div className="flex items-center gap-3 mb-2">
              <Key className="text-accent/60" size={20} />
              <h2 className="font-headline font-bold text-accent text-lg">
                Enter your API key
              </h2>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              autoFocus
              className="w-full bg-surface-container border border-outline/20 rounded-xl px-5 py-4 text-accent placeholder-accent/20 outline-none focus:border-primary/50 text-base"
            />
            <button
              type="submit"
              disabled={!apiKey.trim()}
              className="w-full py-4 px-6 bg-primary text-background font-headline font-bold rounded-xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              Get Started
              <ArrowRight size={18} />
            </button>
            <p className="text-accent/50 text-[10px] text-center leading-relaxed">
              Get a free key at{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                aistudio.google.com/apikey
              </a>
              . Your key stays in your browser — never sent to our servers.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
