import { useState } from "react";
import { MEME_TEXT_ZONES } from "../data/memeTextZones";
import { AdminCalibrator } from "./AdminCalibrator";
import type { HandoffPayload } from "./useHandoffPayload";

// Admin-only: browse all templates and open any one in the calibrator to bake
// its default caption positions. Reached at /c/from-meme?admin=<secret>&gallery=1
// (no handoff token required). Images are served from /templates/.
export function AdminGallery() {
  const [selected, setSelected] = useState<string | null>(null);
  const entries = Object.entries(MEME_TEXT_ZONES);

  if (selected) {
    const entry = MEME_TEXT_ZONES[selected];
    const payload: HandoffPayload = {
      v: 1,
      memeImageUrl: `/templates/${entry.image}`,
      memeImageDimensions: { width: 1000, height: 1000 }, // corrected on load
      memeImageMime: "image/jpeg",
      templateId: selected,
      templateLabel: selected,
      originUser: null,
    };
    return (
      <AdminCalibrator payload={payload} onBack={() => setSelected(null)} />
    );
  }

  return (
    <div className="h-[100dvh] overflow-y-auto bg-background text-accent">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 pt-[max(0.75rem,var(--sat))] pb-3 text-center border-b border-outline/10">
        <p className="font-headline font-bold text-lg">Calibrate templates</p>
        <p className="text-[11px] text-accent/40">
          {entries.length} templates · tap one to position its captions
        </p>
      </header>
      <div className="grid grid-cols-3 gap-2 p-3 pb-[max(1rem,var(--sab))]">
        {entries.map(([id, t]) => (
          <button
            key={id}
            onClick={() => setSelected(id)}
            className="relative aspect-square rounded-lg overflow-hidden bg-surface-container border border-outline/10 active:scale-95 transition-transform"
          >
            <img
              src={`/templates/${t.image}`}
              alt={id}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white px-1 py-0.5 truncate text-left">
              {id}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
