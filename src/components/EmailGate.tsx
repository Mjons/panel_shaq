import React, { useState } from "react";
import { Mail, ArrowRight, Loader2 } from "lucide-react";
import { saveEmail } from "../services/supabase";

interface EmailGateProps {
  onComplete: (email: string) => void;
}

export function EmailGate({ onComplete }: EmailGateProps) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || saving) return;

    setSaving(true);
    setError("");

    try {
      await saveEmail(email);
      localStorage.setItem("panelshaq_user_email", email);
      onComplete(email);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
            <Mail className="text-primary" size={28} />
          </div>
          <h1 className="font-headline text-4xl font-bold text-accent tracking-tight mb-3">
            Welcome to Panel Shaq
          </h1>
          <p className="text-accent/50 text-sm leading-relaxed">
            Enter your email to start creating comics for free.
            <br />
            No credit card, no API key needed.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              className="w-full bg-surface-container border border-outline/20 rounded-xl px-5 py-4 text-accent placeholder-accent/20 outline-none focus:border-primary/50 text-base"
            />
          </div>

          <button
            type="submit"
            disabled={!isValid || saving}
            className="w-full py-4 px-6 bg-primary text-background font-headline font-bold rounded-xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 text-base"
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

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        </form>

        <p className="text-accent/25 text-[10px] text-center mt-6 leading-relaxed">
          We'll only use your email to keep you updated on Panel Shaq.
          <br />
          No spam, unsubscribe anytime.
        </p>
      </div>
    </div>
  );
}
