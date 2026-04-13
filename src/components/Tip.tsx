import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Woodpecker } from "./Woodpecker";

const STORAGE_KEY = "panelshaq_tips_seen";
export const TIPS_DISABLED_KEY = "panelshaq_tips_disabled";

function getSeenTips(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markSeen(id: string) {
  const seen = getSeenTips();
  seen.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
}

/** Clear all dismissed tips so they show again. */
export function resetAllTips() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TIPS_DISABLED_KEY);
}

interface TipProps {
  /** Unique key — persisted in localStorage for coach mode. */
  id: string;
  /** Tooltip body text. */
  text: string;
  /** coach = auto-shows once then remembers dismissal. help = persistent ? icon. */
  mode: "coach" | "help";
  /** Which side of the parent the card appears on. */
  position?: "top" | "bottom";
  /** Horizontal alignment relative to parent. */
  align?: "left" | "center" | "right";
}

/**
 * Place inside a `relative` parent.
 *
 * Coach mode renders only the floating card (absolute).
 * Help mode renders a small `?` button *plus* the card.
 */
export const Tip: React.FC<TipProps> = ({
  id,
  text,
  mode,
  position = "bottom",
  align = "center",
}) => {
  const disabled = localStorage.getItem(TIPS_DISABLED_KEY) === "1";
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Coach: auto-show once
  useEffect(() => {
    if (mode === "coach" && !getSeenTips().has(id)) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [id, mode]);

  // Dismiss on outside tap — but not when clicking inside another tip
  useEffect(() => {
    if (!visible) return;
    const handler = (e: PointerEvent) => {
      const target = e.target as Node;
      if (cardRef.current && !cardRef.current.contains(target)) {
        // Don't dismiss if the click landed inside another tip card
        if ((target as Element).closest?.("[data-tip-card]")) return;
        dismiss();
      }
    };
    const t = setTimeout(
      () => document.addEventListener("pointerdown", handler),
      120,
    );
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", handler);
    };
  }, [visible]);

  const dismiss = () => {
    setVisible(false);
    if (mode === "coach") markSeen(id);
  };

  // Anchor ref for portal-based positioning
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const updatePos = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const GAP = 12;
    let top: number;
    if (position === "top") {
      top = rect.top + window.scrollY - GAP;
    } else {
      top = rect.bottom + window.scrollY + GAP;
    }
    let left: number;
    if (align === "left") {
      left = rect.left + window.scrollX;
    } else if (align === "right") {
      left = rect.right + window.scrollX - 240; // 240 = w-60
    } else {
      left = rect.left + window.scrollX + rect.width / 2 - 120;
    }
    // Clamp so the card doesn't overflow the viewport
    left = Math.max(8, Math.min(left, window.innerWidth - 248));
    setPos({ top, left });
  }, [position, align]);

  useEffect(() => {
    if (!visible) return;
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [visible, updatePos]);

  const arrowY = position === "top" ? "-bottom-1.5" : "-top-1.5";
  const arrowX =
    align === "left"
      ? "left-4"
      : align === "right"
        ? "right-4"
        : "left-1/2 -translate-x-1/2";

  if (disabled) return null;

  const tooltip = (
    <AnimatePresence>
      {visible && pos && (
        <motion.div
          ref={cardRef}
          initial={{
            opacity: 0,
            y: position === "top" ? 6 : -6,
            scale: 0.97,
          }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{
            opacity: 0,
            y: position === "top" ? 6 : -6,
            scale: 0.97,
          }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          data-tip-card
          style={{ position: "absolute", top: pos.top, left: pos.left }}
          className="z-[9999] w-60 pointer-events-auto"
        >
          {/* Arrow */}
          <div
            className={`absolute ${arrowY} ${arrowX} w-3 h-3 bg-primary rotate-45 rounded-[1px]`}
          />

          {/* Card */}
          <div className="bg-primary rounded-xl p-3 shadow-lg shadow-primary/25 relative">
            <div className="flex gap-2.5 items-start">
              <Woodpecker size={18} />
              <p className="text-[11px] font-semibold text-background leading-relaxed flex-1">
                {text}
              </p>
            </div>
            {mode === "coach" && (
              <button
                onClick={dismiss}
                className="mt-2.5 w-full py-1.5 bg-background/20 hover:bg-background/30 text-background text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors active:scale-95"
              >
                Got it
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {mode === "help" ? (
        <button
          ref={anchorRef as React.RefObject<HTMLButtonElement>}
          onClick={() => setVisible((v) => !v)}
          className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold inline-flex items-center justify-center hover:bg-primary/30 active:scale-90 transition-all shrink-0"
          aria-label="Tip"
        >
          ?
        </button>
      ) : (
        <span
          ref={anchorRef}
          className="absolute inset-0 pointer-events-none"
        />
      )}
      {createPortal(tooltip, document.body)}
    </>
  );
};
