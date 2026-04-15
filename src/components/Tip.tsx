import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Smudge, SmudgePose } from "./Smudge";

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

/* ── Coach tip queue: show one at a time with a cooldown ── */

const COOLDOWN_MS = 30_000; // 30s between coach tips
const FIRST_TIP_DELAY_MS = 8_000; // 8s settle time before the very first tip
let lastShownAt = 0;
let currentlyShowing: string | null = null;
const queue: { id: string; show: () => void }[] = [];
let cooldownTimer: ReturnType<typeof setTimeout> | null = null;

function showNext() {
  cooldownTimer = null;
  if (currentlyShowing || queue.length === 0) return;
  const next = queue.shift()!;
  currentlyShowing = next.id;
  next.show();
}

function tryShowNext() {
  if (currentlyShowing) return;
  if (queue.length === 0) return;
  if (cooldownTimer) return; // already scheduled

  const isFirstEver = lastShownAt === 0;
  const elapsed = Date.now() - lastShownAt;
  const wait = isFirstEver
    ? FIRST_TIP_DELAY_MS
    : Math.max(0, COOLDOWN_MS - elapsed);

  if (wait > 0) {
    cooldownTimer = setTimeout(showNext, wait);
    return;
  }
  showNext();
}

function registerCoachTip(id: string, show: () => void) {
  // Don't double-register the same id
  if (currentlyShowing === id) return;
  if (queue.some((q) => q.id === id)) return;
  queue.push({ id, show });
  tryShowNext();
}

function unregisterCoachTip(id: string) {
  // Component unmounting (e.g., navigation away) — drop without triggering cooldown
  if (currentlyShowing === id) currentlyShowing = null;
  const idx = queue.findIndex((q) => q.id === id);
  if (idx !== -1) queue.splice(idx, 1);
  tryShowNext();
}

function markCoachTipDismissed(id: string) {
  if (currentlyShowing === id) {
    currentlyShowing = null;
    lastShownAt = Date.now();
  }
  const idx = queue.findIndex((q) => q.id === id);
  if (idx !== -1) queue.splice(idx, 1);
  if (cooldownTimer) {
    clearTimeout(cooldownTimer);
    cooldownTimer = null;
  }
  cooldownTimer = setTimeout(showNext, COOLDOWN_MS);
}

interface TipProps {
  /** Unique key — persisted in localStorage for coach mode. */
  id: string;
  /** Tooltip body text. */
  text: string;
  /** coach = auto-shows once then remembers dismissal. help = persistent ? icon. */
  mode: "coach" | "help";
  /** Which side of the parent the card appears on. */
  position?: "top" | "bottom" | "left" | "right";
  /** Horizontal alignment relative to parent. */
  align?: "left" | "center" | "right";
  /** Optional explicit Smudge pose. Falls back to a hash of `id`. */
  pose?: SmudgePose;
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
  pose,
}) => {
  const disabled = localStorage.getItem(TIPS_DISABLED_KEY) === "1";
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Coach: register with the global queue so tips show one at a time, 30s apart
  useEffect(() => {
    if (mode !== "coach" || getSeenTips().has(id)) return;
    registerCoachTip(id, () => setVisible(true));
    return () => {
      // Only unregister if we never showed it (still in queue) — otherwise
      // dismiss() handles cleanup. Component unmount mid-show shouldn't trigger
      // cooldown; treat it as the user navigated away.
      unregisterCoachTip(id);
    };
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
    if (mode === "coach") {
      markSeen(id);
      markCoachTipDismissed(id);
    }
  };

  // Anchor ref for portal-based positioning
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const updatePos = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const GAP = 16; // slightly more gap to accommodate longer arrow
    const CARD_WIDTH = 288; // w-72
    // Card height is measured live; fall back to an estimate if not yet rendered
    const cardHeight = cardRef.current?.offsetHeight || 100;
    let top: number;
    let left: number;

    if (position === "left" || position === "right") {
      // Side positions: vertically center to anchor; arrow points left/right
      top = rect.top + window.scrollY + rect.height / 2;
      if (position === "left") {
        left = rect.left + window.scrollX - CARD_WIDTH - GAP;
      } else {
        left = rect.right + window.scrollX + GAP;
      }
    } else {
      if (position === "top") {
        // Card sits ABOVE anchor — subtract its own height
        top = rect.top + window.scrollY - GAP - cardHeight;
      } else {
        top = rect.bottom + window.scrollY + GAP;
      }
      if (align === "left") {
        left = rect.left + window.scrollX;
      } else if (align === "right") {
        left = rect.right + window.scrollX - CARD_WIDTH;
      } else {
        left = rect.left + window.scrollX + rect.width / 2 - CARD_WIDTH / 2;
      }
    }

    // Clamp horizontally so the card doesn't overflow the viewport
    left = Math.max(8, Math.min(left, window.innerWidth - CARD_WIDTH - 8));
    setPos({ top, left });
  }, [position, align]);

  useEffect(() => {
    if (!visible) return;
    updatePos();
    // Re-measure once the card has mounted with its real dimensions
    const raf1 = requestAnimationFrame(() => {
      updatePos();
      // And once more after fonts/layout settle
      requestAnimationFrame(updatePos);
    });
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    // Watch the card's own size so position="top" follows height changes
    let observer: ResizeObserver | null = null;
    if (cardRef.current && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => updatePos());
      observer.observe(cardRef.current);
    }
    return () => {
      cancelAnimationFrame(raf1);
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
      observer?.disconnect();
    };
  }, [visible, updatePos]);

  // Arrow — larger (w-5 h-5 = 20px) with 10% rounded corners for a soft curve.
  // Rotated 45° so it protrudes ~10px from the card edge.
  const isSide = position === "left" || position === "right";
  const arrowStyle: React.CSSProperties = (() => {
    if (position === "top") {
      const horizOffset =
        align === "left" ? "1rem" : align === "right" ? "auto" : "50%";
      const rightOffset = align === "right" ? "1rem" : "auto";
      const tx = align === "center" ? "translateX(-50%)" : "";
      return {
        bottom: "-10px",
        left: horizOffset === "auto" ? undefined : horizOffset,
        right: rightOffset === "auto" ? undefined : rightOffset,
        transform: `${tx} rotate(45deg)`.trim(),
      };
    }
    if (position === "bottom") {
      const horizOffset =
        align === "left" ? "1rem" : align === "right" ? "auto" : "50%";
      const rightOffset = align === "right" ? "1rem" : "auto";
      const tx = align === "center" ? "translateX(-50%)" : "";
      return {
        top: "-10px",
        left: horizOffset === "auto" ? undefined : horizOffset,
        right: rightOffset === "auto" ? undefined : rightOffset,
        transform: `${tx} rotate(45deg)`.trim(),
      };
    }
    if (position === "left") {
      return {
        right: "-10px",
        top: "50%",
        transform: "translateY(-50%) rotate(45deg)",
      };
    }
    // right
    return {
      left: "-10px",
      top: "50%",
      transform: "translateY(-50%) rotate(45deg)",
    };
  })();

  if (disabled) return null;

  // Entrance/exit: slide from the anchor direction
  const slide = (() => {
    if (position === "top") return { x: 0, y: 6 };
    if (position === "bottom") return { x: 0, y: -6 };
    if (position === "left") return { x: 6, y: 0 };
    return { x: -6, y: 0 };
  })();

  const tooltip = (
    <AnimatePresence>
      {visible && pos && (
        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, ...slide, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          exit={{ opacity: 0, ...slide, scale: 0.97 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          data-tip-card
          style={{
            position: "absolute",
            top: pos.top,
            left: pos.left,
            ...(isSide ? { marginTop: "0", translate: "0 -50%" } : {}),
          }}
          className="z-[9999] w-72 pointer-events-auto"
        >
          {/* Arrow — 20px rotated square with 10% curve (2px radius) */}
          <div
            style={arrowStyle}
            className="absolute w-5 h-5 bg-primary rounded-[2px]"
          />

          {/* Card — overflow-visible so Smudge can bleed outside */}
          <div className="bg-primary rounded-xl p-3 pl-14 shadow-lg shadow-primary/25 relative">
            {/* Smudge — larger, anchored left, allowed to bleed outside the card */}
            <div className="absolute -left-1 top-3 pointer-events-none">
              <Smudge size={60} seed={id} pose={pose} />
            </div>
            <p className="text-base font-body font-medium text-background leading-snug whitespace-pre-line">
              {text}
            </p>
            {mode === "coach" && (
              <button
                onClick={dismiss}
                className="mt-3 w-full py-2 bg-background/20 hover:bg-background/30 text-background text-xs font-bold uppercase tracking-widest rounded-lg transition-colors active:scale-95"
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
