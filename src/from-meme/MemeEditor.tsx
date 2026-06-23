import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useElementSize, fitRect } from "./useFit";
import {
  Share2,
  Copy,
  Download,
  RefreshCw,
  Wand2,
  Loader2,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import { useToast } from "../components/Toast";
import { TextZonesOverlay } from "./TextZonesOverlay";
import { MEME_TEXT_ZONES } from "../data/memeTextZones";
import { MEME_FONT_PRESETS, detectPresetId } from "./memeFontPresets";
import type { MemeFontPreset } from "./memeFontPresets";
import { flattenMeme, blobToDataURL } from "./memeFlatten";
import { shareImage, copyImage, downloadImage } from "./memeShare";
import { makeNewComic } from "./makeComic";
import type { HandoffPayload } from "./useHandoffPayload";
import type { MemeZone } from "./zoneTypes";

const MEMEGEN_URL =
  import.meta.env.VITE_MEMEGEN_URL || "https://memegen.panelhaus.app";

const MIN_FONT_RATIO = 0.02;
const MAX_FONT_RATIO = 0.35;

interface MemeEditorProps {
  payload: HandoffPayload;
  token: string;
}

interface WorkState {
  zones: MemeZone[];
  removed: string[];
}

function initWork(token: string, seed: MemeZone[]): WorkState {
  try {
    const raw = sessionStorage.getItem(`panelshaq_meme_work:${token}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.zones)) {
        return { zones: parsed.zones, removed: parsed.removed ?? [] };
      }
    }
  } catch {
    /* ignore */
  }
  return { zones: JSON.parse(JSON.stringify(seed)), removed: [] };
}

export function MemeEditor({ payload, token }: MemeEditorProps) {
  const { addToast } = useToast();

  // Seed zones from the registry (branded defaults), then apply any per-brand caption
  // overrides MemeGen sent: swap a zone's text when its DEFAULT matches an override.
  // Positions/styles untouched — text only. Empty (DeadFellaz) → defaults unchanged.
  const seed = useMemo(() => {
    const base = MEME_TEXT_ZONES[payload.templateId]?.zones ?? [];
    const caps = payload.captions;
    if (!Array.isArray(caps) || caps.length === 0) return base;
    const norm = (s: string) =>
      s.trim().toLowerCase().replace(/\s+/g, " ").replace(/\s+([,.!?:;])/g, "$1");
    const capMap = new Map(caps.map((c) => [norm(c.match), c.text]));
    return base.map((z) => {
      const override = capMap.get(norm(z.text ?? ""));
      return override != null ? { ...z, text: override } : z;
    });
  }, [payload.templateId, payload.captions]);

  const [work, setWork] = useState<WorkState>(() => initWork(token, seed));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState(false);

  const blobRef = useRef<Blob | null>(null);
  const dataUrlRef = useRef<string | null>(null);
  // Timestamp of the last caption selection. Tapping a caption selects it on
  // pointerup, but in-app WebViews (e.g. MetaMask's) fire a delayed/ghost `click`
  // that can land on the background deselect right after, instantly closing the
  // editor (a slow, deliberate tap avoids the ghost click). Ignore a background
  // deselect within this window of a select so the toolbar stays open.
  const lastSelectAtRef = useRef(0);
  const selectZone = (id: string | null) => {
    if (id) lastSelectAtRef.current = Date.now();
    setSelectedId(id);
  };

  // Fit the meme into the available area (no scrolling, any aspect). Aspect comes
  // from the actual loaded image so any handoff/stub image lines up with its zones.
  const areaRef = useRef<HTMLDivElement>(null);
  const area = useElementSize(areaRef);
  const [imgDims, setImgDims] = useState({
    w: payload.memeImageDimensions.width,
    h: payload.memeImageDimensions.height,
  });
  const aspect = imgDims.w && imgDims.h ? imgDims.w / imgDims.h : 1;
  const fitted = fitRect(area.w, area.h, aspect);

  const activeZones = useMemo(
    () => work.zones.filter((z) => !work.removed.includes(z.id)),
    [work],
  );
  const removedZones = useMemo(
    () => work.zones.filter((z) => work.removed.includes(z.id)),
    [work],
  );

  useEffect(() => {
    try {
      sessionStorage.setItem(
        `panelshaq_meme_work:${token}`,
        JSON.stringify(work),
      );
    } catch {
      /* ignore */
    }
  }, [work, token]);

  // Pre-flatten (debounced) so Share/Copy fire within the user gesture.
  useEffect(() => {
    let cancelled = false;
    setPreparing(true);
    const id = window.setTimeout(async () => {
      try {
        const blob = await flattenMeme(payload, activeZones, {});
        if (cancelled) return;
        blobRef.current = blob;
        dataUrlRef.current = await blobToDataURL(blob);
        setExportError(false);
        setPreparing(false);
      } catch {
        if (!cancelled) {
          setExportError(true);
          setPreparing(false);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [activeZones, payload]);

  const filename = useMemo(
    () =>
      `${
        (payload.templateLabel || "meme")
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase() || "meme"
      }.png`,
    [payload.templateLabel],
  );

  const updateZone = (id: string, patch: Partial<MemeZone>) =>
    setWork((w) => ({
      ...w,
      zones: w.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)),
    }));

  const setText = (id: string, text: string) => updateZone(id, { text });

  // Merge geometry/rotation changes from the overlay handles back into the full
  // zone list (the overlay only sees active zones; preserve removed ones).
  const onZonesChange = (updated: MemeZone[]) =>
    setWork((w) => ({
      ...w,
      zones: w.zones.map((z) => updated.find((u) => u.id === z.id) ?? z),
    }));

  const applyFont = (id: string, preset: MemeFontPreset) =>
    updateZone(id, {
      style: JSON.parse(JSON.stringify(preset.style)),
      // Some presets (Impact) carry a default size so they render big on pick.
      ...(preset.fontSizeRatio ? { fontSizeRatio: preset.fontSizeRatio } : {}),
    });

  const bumpSize = (id: string, factor: number) =>
    setWork((w) => ({
      ...w,
      zones: w.zones.map((z) =>
        z.id === id
          ? {
              ...z,
              fontSizeRatio: Math.min(
                MAX_FONT_RATIO,
                Math.max(MIN_FONT_RATIO, z.fontSizeRatio * factor),
              ),
            }
          : z,
      ),
    }));

  const removeZone = (id: string) => {
    setWork((w) => ({ ...w, removed: [...w.removed, id] }));
    setSelectedId(null);
  };

  const restoreZone = (id: string) => {
    setWork((w) => ({ ...w, removed: w.removed.filter((x) => x !== id) }));
    setSelectedId(id);
  };

  async function ensureBlob(): Promise<Blob> {
    if (blobRef.current) return blobRef.current;
    const blob = await flattenMeme(payload, activeZones, {});
    blobRef.current = blob;
    dataUrlRef.current = await blobToDataURL(blob);
    return blob;
  }

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = blobRef.current ?? (await ensureBlob());
      const r = await shareImage(blob, filename);
      if (r === "downloaded") addToast("Saved to your device", "success");
    } catch {
      addToast("Couldn't share — try Download", "error");
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = blobRef.current ?? (await ensureBlob());
      const r = await copyImage(blob, filename);
      addToast(
        r === "copied" ? "Copied to clipboard" : "Saved to your device",
        "success",
      );
    } catch {
      addToast("Couldn't copy", "error");
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = blobRef.current ?? (await ensureBlob());
      downloadImage(blob, filename);
      addToast("Downloaded!", "success");
    } catch {
      addToast("Download failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const onMakeComic = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!dataUrlRef.current) await ensureBlob();
      await makeNewComic(dataUrlRef.current!, payload.templateLabel);
    } catch {
      addToast("Couldn't open the studio", "error");
      setBusy(false);
    }
  };

  const wallet = payload.originUser?.startsWith("web3:")
    ? payload.originUser.slice(5)
    : null;
  const walletShort = wallet
    ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}`
    : null;

  const exportDisabled = busy || preparing || exportError;
  const selectedZone = work.zones.find((z) => z.id === selectedId) ?? null;
  const selectedPresetId = selectedZone
    ? detectPresetId(selectedZone.style)
    : null;

  const captionLabel = (z: MemeZone) => {
    const t = z.text.trim();
    return t ? (t.length > 14 ? `${t.slice(0, 14)}…` : t) : "Caption";
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-background flex flex-col text-accent">
      <header className="shrink-0 px-4 pt-[max(0.75rem,var(--sat))] pb-2 text-center">
        <p className="font-headline font-bold text-sm tracking-tight">
          {selectedZone ? "Editing caption" : "Tap a caption to edit"}
        </p>
        <p className="text-[11px] text-accent/40 leading-snug mt-0.5">
          {walletShort ? `${walletShort} · ` : ""}💻 Even better on desktop —
          visit <span className="text-primary">panelhaus.app</span> on a
          computer
        </p>
      </header>

      {/* Tapping outside a caption deselects (ignoring the ghost click that can
          immediately follow a selection in in-app WebViews). */}
      <main
        className="flex-1 min-h-0 overflow-hidden p-3"
        onClick={() => {
          if (Date.now() - lastSelectAtRef.current < 400) return;
          setSelectedId(null);
        }}
      >
        <div
          ref={areaRef}
          className="w-full h-full flex items-center justify-center"
        >
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
                zones={activeZones}
                texts={{}}
                editable
                onlySelectedHandles
                selectedId={selectedId}
                onSelect={selectZone}
                onChange={onZonesChange}
              />
            </div>
          )}
        </div>
      </main>

      {/* Bottom: caption toolbar (when a caption is selected) OR action bar */}
      {selectedZone ? (
        <section className="shrink-0 bg-surface-container border-t border-outline/10 rounded-t-2xl px-4 pt-3 pb-[max(1rem,var(--sab))] space-y-3 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent/40">
              Caption
            </span>
            <button
              onClick={() => setSelectedId(null)}
              className="flex items-center gap-1 text-primary text-sm font-bold"
            >
              <Check size={16} /> Done
            </button>
          </div>

          <input
            autoFocus
            value={selectedZone.text}
            onChange={(e) => setText(selectedZone.id, e.target.value)}
            placeholder="Type your caption…"
            className="w-full bg-background border border-outline/20 rounded-xl px-4 py-3 text-base text-accent placeholder-accent/20 outline-none focus:border-primary/50"
          />

          {/* Font pills — preview in their own typeface; live-applies to the meme above */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            {MEME_FONT_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyFont(selectedZone.id, p)}
                style={{ fontFamily: p.style.fontFamily }}
                className={`shrink-0 px-4 py-2 rounded-full text-sm border whitespace-nowrap transition-colors ${
                  selectedPresetId === p.id
                    ? "bg-primary text-background border-primary"
                    : "bg-surface-container-high border-outline/20 text-accent"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent/40">
              Size
            </span>
            <button
              onClick={() => bumpSize(selectedZone.id, 0.88)}
              className="w-10 h-10 rounded-lg bg-surface-container-high border border-outline/20 font-bold text-sm active:scale-95 transition-transform"
              aria-label="Smaller"
            >
              A−
            </button>
            <button
              onClick={() => bumpSize(selectedZone.id, 1.13)}
              className="w-10 h-10 rounded-lg bg-surface-container-high border border-outline/20 font-bold text-lg active:scale-95 transition-transform"
              aria-label="Bigger"
            >
              A+
            </button>
            <div className="flex-1" />
            <button
              onClick={() => removeZone(selectedZone.id)}
              className="flex items-center gap-1.5 h-10 px-4 rounded-lg border border-red-500/40 text-red-400 text-sm font-medium active:scale-95 transition-transform"
            >
              <Trash2 size={16} /> Delete
            </button>
          </div>
        </section>
      ) : (
        <footer className="shrink-0 bg-surface-container border-t border-outline/10 px-4 pt-3 pb-[max(1rem,var(--sab))] space-y-2">
          {removedZones.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
              {removedZones.map((z) => (
                <button
                  key={z.id}
                  onClick={() => restoreZone(z.id)}
                  className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-full bg-surface-container-high border border-dashed border-primary/50 text-primary text-xs font-medium active:scale-95 transition-transform"
                >
                  <Plus size={14} /> {captionLabel(z)}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <ActionButton
              icon={
                preparing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Share2 size={18} />
                )
              }
              label="Share"
              onClick={onShare}
              disabled={exportDisabled}
              primary
            />
            <ActionButton
              icon={<Copy size={18} />}
              label="Copy"
              onClick={onCopy}
              disabled={exportDisabled}
            />
            <ActionButton
              icon={<Download size={18} />}
              label="Download"
              onClick={onDownload}
              disabled={exportDisabled}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => window.location.assign(MEMEGEN_URL)}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-container-high border border-outline/20 text-sm font-medium active:scale-95 transition-transform"
            >
              <RefreshCw size={16} /> Make another
            </button>
            <button
              onClick={onMakeComic}
              disabled={busy}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-container-high border border-outline/20 text-sm font-medium active:scale-95 transition-transform disabled:opacity-50"
            >
              <Wand2 size={16} /> Make a comic
            </button>
          </div>
          {exportError && (
            <p className="text-[11px] text-red-400 text-center">
              Couldn't prepare the image for export. Check your connection and
              reload.
            </p>
          )}
        </footer>
      )}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  primary,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-transform disabled:opacity-40 ${
        primary
          ? "bg-primary text-background"
          : "bg-surface-container-high border border-outline/20 text-accent"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
