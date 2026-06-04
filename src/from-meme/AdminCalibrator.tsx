import { useMemo, useRef, useState } from "react";
import { Plus, Minus, ClipboardCopy, ArrowLeft } from "lucide-react";
import { useToast } from "../components/Toast";
import { TextZonesOverlay } from "./TextZonesOverlay";
import { useElementSize, fitRect } from "./useFit";
import { MEME_TEXT_ZONES } from "../data/memeTextZones";
import type { HandoffPayload } from "./useHandoffPayload";
import type { MemeZone, MemeZoneStyle } from "./zoneTypes";

// Admin-only zone positioning tool. Mirrors MemeGen's dev calibrator: drag /
// rotate / resize zones over the real meme, edit labels, add/remove zones, then
// "Copy JSON" the registry entry to paste into src/data/memeTextZones.ts.

// New zones default to the big-Impact look (matches the user editor's Impact
// font preset: big white text + thick black stroke).
const DEFAULT_STYLE: MemeZoneStyle = {
  color: "#ffffff",
  fontFamily: "Anton, 'Arial Black', Impact, sans-serif",
  fontWeight: 700,
  italic: false,
  allCaps: true,
  textAlign: "center",
  lineHeight: 1.1,
  outline: { color: "#000000", widthEm: 0.09 },
  box: null,
};
const DEFAULT_FONT_RATIO = 0.06;

export function AdminCalibrator({
  payload,
  onBack,
}: {
  payload: HandoffPayload;
  onBack?: () => void;
}) {
  const { addToast } = useToast();

  // Aspect baked into the exported JSON (customDimension metadata).
  const registryAspect = useMemo(
    () =>
      MEME_TEXT_ZONES[payload.templateId]?.aspect ??
      payload.memeImageDimensions.width / payload.memeImageDimensions.height,
    [payload],
  );

  const [zones, setZones] = useState<MemeZone[]>(() =>
    JSON.parse(
      JSON.stringify(MEME_TEXT_ZONES[payload.templateId]?.zones ?? []),
    ),
  );

  // Viewport fit (shared with the user editor) — measure area, fit the actual image.
  const areaRef = useRef<HTMLDivElement>(null);
  const area = useElementSize(areaRef);
  const [imgDims, setImgDims] = useState({
    w: payload.memeImageDimensions.width,
    h: payload.memeImageDimensions.height,
  });
  const fitAspect = imgDims.w && imgDims.h ? imgDims.w / imgDims.h : 1;
  const fitted = fitRect(area.w, area.h, fitAspect);

  const texts = useMemo(() => {
    const t: Record<string, string> = {};
    for (const z of zones) t[z.id] = z.text;
    return t;
  }, [zones]);

  const addZone = () => {
    setZones((zs) => [
      ...zs,
      {
        id: `zone-${zs.length + 1}`,
        x: 0.1,
        y: Math.min(0.1 + zs.length * 0.12, 0.85),
        width: 0.8,
        height: 0.12,
        fontSizeRatio: DEFAULT_FONT_RATIO,
        text: "Your text",
        style: { ...DEFAULT_STYLE },
      },
    ]);
  };

  const removeLast = () => setZones((zs) => zs.slice(0, -1));

  const setLabel = (id: string, text: string) =>
    setZones((zs) => zs.map((z) => (z.id === id ? { ...z, text } : z)));

  const bumpSize = (id: string, factor: number) =>
    setZones((zs) =>
      zs.map((z) =>
        z.id === id
          ? {
              ...z,
              fontSizeRatio: Math.min(
                0.35,
                Math.max(0.02, z.fontSizeRatio * factor),
              ),
            }
          : z,
      ),
    );

  // Holds the emitted JSON so it can always be select-all-copied manually —
  // navigator.clipboard only works in a secure context (HTTPS / localhost), so
  // on a plain-HTTP phone the textarea is the reliable path (mirrors MemeGen).
  const [jsonOut, setJsonOut] = useState<string | null>(null);

  const copyJson = async () => {
    const entry = `"${payload.templateId}": ${JSON.stringify({ aspect: registryAspect, zones }, null, 2)},`;
    setJsonOut(entry);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(entry);
        addToast("Copied — also shown below to copy manually", "success");
        return;
      }
    } catch {
      /* fall through to the manual textarea */
    }
    addToast("Select the text below and copy it", "info");
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-background text-accent flex flex-col">
      <header className="shrink-0 relative px-4 pt-[max(0.75rem,var(--sat))] pb-2 text-center">
        {onBack && (
          <button
            onClick={onBack}
            className="absolute left-3 top-[max(0.75rem,var(--sat))] flex items-center gap-1 text-accent/60 text-sm"
            aria-label="Back to templates"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <p className="font-headline font-bold text-sm">
          Calibrator · {payload.templateId}
        </p>
        <p className="text-[11px] text-accent/40">
          Drag ✥ · rotate ↻ · resize ⤡ — then Copy JSON
        </p>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden p-3">
        <div ref={areaRef} className="w-full h-full flex items-center justify-center">
          {fitted.w > 0 && (
            <div
              className="relative [container-type:inline-size] shadow-2xl"
              style={{ width: fitted.w, height: fitted.h }}
            >
              <img
                src={payload.memeImageUrl}
                crossOrigin="anonymous"
                alt={payload.templateLabel}
                onLoad={(e) =>
                  setImgDims({
                    w: e.currentTarget.naturalWidth,
                    h: e.currentTarget.naturalHeight,
                  })
                }
                className="absolute inset-0 w-full h-full object-contain select-none"
                draggable={false}
              />
              <TextZonesOverlay
                zones={zones}
                texts={texts}
                editable
                onChange={setZones}
              />
            </div>
          )}
        </div>
      </main>

      <footer className="shrink-0 bg-surface-container border-t border-outline/10 px-4 pt-3 pb-[max(1rem,var(--sab))] space-y-3 max-h-[40vh] overflow-y-auto">
        <div className="flex gap-2">
          <button
            onClick={addZone}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-surface-container-high border border-outline/20 text-sm font-medium"
          >
            <Plus size={16} /> Add zone
          </button>
          <button
            onClick={removeLast}
            disabled={zones.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-surface-container-high border border-outline/20 text-sm font-medium disabled:opacity-40"
          >
            <Minus size={16} /> Remove last
          </button>
        </div>

        {zones.map((z) => (
          <div key={z.id} className="flex items-center gap-2">
            <span className="text-[10px] text-accent/40 w-12 shrink-0">
              {z.id}
            </span>
            <input
              value={z.text}
              onChange={(e) => setLabel(z.id, e.target.value)}
              placeholder="label"
              className="flex-1 min-w-0 bg-background border border-outline/20 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
            <button
              onClick={() => bumpSize(z.id, 0.88)}
              className="w-9 h-9 shrink-0 rounded-lg bg-surface-container-high border border-outline/20 text-sm font-bold"
              aria-label={`Smaller text for ${z.id}`}
            >
              A−
            </button>
            <button
              onClick={() => bumpSize(z.id, 1.13)}
              className="w-9 h-9 shrink-0 rounded-lg bg-surface-container-high border border-outline/20 text-base font-bold"
              aria-label={`Bigger text for ${z.id}`}
            >
              A+
            </button>
          </div>
        ))}

        <button
          onClick={copyJson}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-background font-headline font-bold rounded-xl active:scale-95 transition-transform"
        >
          <ClipboardCopy size={18} /> Copy JSON
        </button>

        {jsonOut && (
          <textarea
            readOnly
            value={jsonOut}
            onFocus={(e) => e.currentTarget.select()}
            rows={6}
            className="w-full bg-background border border-outline/20 rounded-lg p-2 font-mono text-[10px] text-accent/80 leading-snug"
            aria-label="Zone JSON — tap to select all, then copy"
          />
        )}
      </footer>
    </div>
  );
}
