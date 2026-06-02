import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { MemeZone } from "./zoneTypes";

// DOM overlay of meme text captions over the image. Ported from MemeGen's
// TextZonesOverlay, adapted to Panel Shaq's typed zones: geometry is normalized
// 0–1, font size is `fontSizeRatio` of the container WIDTH (cqw — the parent
// must set container-type: inline-size), the outline is an em-relative 8-way
// text-shadow, and `style.box` renders the solid background some presets use
// (e.g. modern-slab's white box).
//
// Read mode: tapping a zone calls onSelect (opens the edit sheet).
// Editable mode (admin calibrator): move / rotate / resize handles, emitting the
// full updated zones array via onChange.

interface TextZonesOverlayProps {
  zones: MemeZone[];
  /** Current text per zone id (user edits); falls back to the zone's default. */
  texts: Record<string, string>;
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onChange?: (zones: MemeZone[]) => void;
  /** When true, drag/rotate/resize handles show only on the selected zone (user
   * editing). When false (admin calibration), every zone shows handles. */
  onlySelectedHandles?: boolean;
}

type DragKind = "move" | "resize" | "rotate";
interface DragState {
  idx: number;
  kind: DragKind;
  startX: number;
  startY: number;
  startZone: MemeZone;
  centerX?: number;
  centerY?: number;
  startAngle?: number;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);
const clamp01 = (v: number) => clamp(v, 0, 1);
const round3 = (v: number) => Math.round(v * 1000) / 1000;
const round1 = (v: number) => Math.round(v * 10) / 10;

export function outlineShadow(color: string, widthEm: number): string {
  const e = Math.max(widthEm, 0.02);
  const o = `${e}em`;
  const n = `-${e}em`;
  return [
    `${o} ${o} 0 ${color}`,
    `${n} ${n} 0 ${color}`,
    `${o} ${n} 0 ${color}`,
    `${n} ${o} 0 ${color}`,
    `0 ${o} 0 ${color}`,
    `${o} 0 0 ${color}`,
    `0 ${n} 0 ${color}`,
    `${n} 0 0 ${color}`,
  ].join(", ");
}

const ALIGN_TO_JUSTIFY: Record<string, string> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

export function TextZonesOverlay({
  zones,
  texts,
  editable = false,
  selectedId = null,
  onSelect,
  onChange,
  onlySelectedHandles = false,
}: TextZonesOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    if (!editable) return;
    function onMove(e: PointerEvent) {
      if (!drag || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const next = zones.map((z, i) => {
        if (i !== drag.idx) return z;
        if (drag.kind === "move") {
          const dx = (e.clientX - drag.startX) / rect.width;
          const dy = (e.clientY - drag.startY) / rect.height;
          const x = Math.min(clamp01(drag.startZone.x + dx), 1 - z.width);
          const y = Math.min(clamp01(drag.startZone.y + dy), 1 - z.height);
          return { ...z, x: round3(Math.max(0, x)), y: round3(Math.max(0, y)) };
        }
        if (drag.kind === "resize") {
          const dx = (e.clientX - drag.startX) / rect.width;
          const dy = (e.clientY - drag.startY) / rect.height;
          return {
            ...z,
            width: round3(clamp(drag.startZone.width + dx, 0.04, 1 - z.x)),
            height: round3(clamp(drag.startZone.height + dy, 0.03, 1 - z.y)),
          };
        }
        // rotate
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const cur = Math.atan2(py - (drag.centerY ?? 0), px - (drag.centerX ?? 0));
        let deg =
          (drag.startZone.rotation ?? 0) +
          ((cur - (drag.startAngle ?? 0)) * 180) / Math.PI;
        for (const t of [-180, -135, -90, -45, 0, 45, 90, 135, 180]) {
          if (Math.abs(deg - t) < 3) {
            deg = t;
            break;
          }
        }
        while (deg > 180) deg -= 360;
        while (deg <= -180) deg += 360;
        return { ...z, rotation: round1(deg) };
      });
      onChange?.(next);
    }
    function onUp() {
      setDrag(null);
      document.body.style.userSelect = "";
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [editable, drag, zones, onChange]);

  function startDrag(e: ReactPointerEvent, idx: number, kind: DragKind) {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const zone = zones[idx];
    const base: DragState = {
      idx,
      kind,
      startX: e.clientX,
      startY: e.clientY,
      startZone: { ...zone },
    };
    if (kind === "rotate" && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      base.centerX = (zone.x + zone.width / 2) * rect.width;
      base.centerY = (zone.y + zone.height / 2) * rect.height;
      base.startAngle = Math.atan2(
        e.clientY - rect.top - base.centerY,
        e.clientX - rect.left - base.centerX,
      );
    }
    setDrag(base);
    document.body.style.userSelect = "none";
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      {zones.map((zone, i) => {
        const s = zone.style;
        const text = (texts[zone.id] ?? zone.text) || "";
        const display = s.allCaps ? text.toUpperCase() : text;
        const isSelected = selectedId === zone.id;
        const showHandles = editable && (!onlySelectedHandles || isSelected);

        return (
          <div
            key={zone.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(zone.id);
            }}
            className="absolute pointer-events-auto"
            style={{
              left: `${zone.x * 100}%`,
              top: `${zone.y * 100}%`,
              width: `${zone.width * 100}%`,
              height: `${zone.height * 100}%`,
              transform: zone.rotation ? `rotate(${zone.rotation}deg)` : undefined,
              transformOrigin: "center",
              cursor: editable ? "move" : "text",
            }}
          >
            {/* Solid box behind text (e.g. modern-slab white box) — hidden when empty */}
            {s.box && text.trim() && (
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: s.box.backgroundColor,
                  border:
                    s.box.borderWidth > 0
                      ? `${s.box.borderWidth}px solid ${s.box.borderColor}`
                      : undefined,
                }}
              />
            )}

            <div
              className="relative w-full h-full flex items-center px-1"
              style={{
                justifyContent: ALIGN_TO_JUSTIFY[s.textAlign] ?? "center",
                textAlign: s.textAlign,
                color: s.color,
                fontFamily: s.fontFamily,
                fontWeight: s.fontWeight,
                fontStyle: s.italic ? "italic" : "normal",
                fontSize: `${zone.fontSizeRatio * 100}cqw`,
                lineHeight: s.lineHeight,
                textTransform: s.allCaps ? "uppercase" : "none",
                textShadow: s.outline
                  ? outlineShadow(s.outline.color, s.outline.widthEm)
                  : "none",
                wordBreak: "break-word",
                overflow: "hidden",
                outline: isSelected
                  ? "2px solid rgba(255, 145, 0, 0.95)"
                  : editable && !onlySelectedHandles
                    ? "1px dashed rgba(250, 204, 21, 0.5)"
                    : "none",
                outlineOffset: "-2px",
                userSelect: "none",
              }}
            >
              {display || (editable ? "" : "")}
            </div>

            {showHandles && (
              <>
                <button
                  type="button"
                  aria-label="Move"
                  onPointerDown={(e) => startDrag(e, i, "move")}
                  className="absolute -top-3 -left-3 w-7 h-7 rounded-full bg-primary text-background flex items-center justify-center shadow text-xs font-bold touch-none"
                >
                  ✥
                </button>
                <button
                  type="button"
                  aria-label="Rotate"
                  onPointerDown={(e) => startDrag(e, i, "rotate")}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange?.(
                      zones.map((z, j) => (j === i ? { ...z, rotation: 0 } : z)),
                    );
                  }}
                  className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-primary text-background flex items-center justify-center shadow text-xs font-bold touch-none"
                >
                  ↻
                </button>
                <button
                  type="button"
                  aria-label="Resize"
                  onPointerDown={(e) => startDrag(e, i, "resize")}
                  className="absolute -bottom-3 -right-3 w-7 h-7 rounded-full bg-primary text-background flex items-center justify-center shadow text-xs font-bold touch-none"
                >
                  ⤡
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
