import { useCallback, useEffect, useState } from "react";
import { CARD_ZOOM, CARD_ZOOM_MAX } from "./CreatorCard";
import { artForUser } from "./cardArt";

/**
 * Custom card art + framing.
 *
 * ⚠️ PER-DEVICE, AND THAT IS A KNOWN LIMIT, not an oversight. localStorage is
 * origin-scoped, so m.panelhaus.app and www.panelhaus.app can never share these
 * keys — a member who uploads on desktop still sees their dealt scene here, and
 * vice versa. Everything else about the card (points, asks, tier, wallet) is
 * server-owned and DOES sync. Closing this gap means a server column on the
 * creator record and moving desktop onto it too; until then, do not add a
 * "syncing" affordance that would imply it already works.
 *
 * The DEALT scene is the default and always available: it is derived from the
 * server's artSeed, so a fresh device shows the same card the member's account
 * has on the web.
 */

const artKey = (seed: string) => `creator_card_art:${seed}`;
const zoomKey = (seed: string) => `creator_card_zoom:${seed}`;

/** Downscale ladder for an upload — try progressively smaller/lossier until it
 *  fits comfortably in localStorage. Ported from desktop. */
const QUALITY_STEPS = [
  { max: 1800, q: 0.9 },
  { max: 1400, q: 0.88 },
  { max: 1200, q: 0.85 },
];

/** Roughly 3.5MB of base64 — past this the write is likely to throw QuotaExceeded
 *  on a browser already holding projects and a vault. */
const MAX_STORED_CHARS = 3_500_000;

type Drawable = ImageBitmap | HTMLImageElement;

/**
 * Decode an uploaded file, richest path first.
 *
 * ⚠️ createImageBitmap ALONE IS NOT ENOUGH ON THIS APP. We deep-link users into
 * MetaMask's in-app browser for wallet sign-in (see services/wallet.ts), and
 * stripped-down wallet WebViews frequently lack createImageBitmap, mis-handle
 * its options dictionary, or block blob: URLs outright. That WebView is exactly
 * where the crypto-native members this card targets will be standing.
 *
 * The FileReader/data-URL rung is the one that actually rescues those: it forces
 * a full byte read through the WebView bridge and yields a self-contained URL,
 * with no blob: URL and no lazy content:// stream for the sandbox to refuse.
 *
 * Never collapse this back to a single call with a bare `catch` — the symptom is
 * a valid JPEG reported as "unsupported format", which reads as a file problem
 * and hides the real one.
 */
async function decodeFile(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      try {
        // Bare overload — older Safari and some WebViews reject the options arg
        // but handle this fine.
        return await createImageBitmap(file);
      } catch {
        /* fall through to the DOM decoders */
      }
    }
  }
  try {
    return await decodeViaFileReader(file);
  } catch {
    return decodeViaImgElement(file);
  }
}

function decodeViaFileReader(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error("decode failed"));
    const reader = new FileReader();
    reader.onerror = fail;
    reader.onload = () => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = fail;
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function decodeViaImgElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      // Revoked by the caller once drawing is done.
      (img as HTMLImageElement & { __objectUrl?: string }).__objectUrl = url;
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

/**
 * Some failures no decoder can fix: a cloud-only photo (Google Photos / Samsung
 * Cloud, not downloaded) or a file moved after selection. The OS refuses the
 * bytes. Detect it so the message is actionable instead of blaming the format.
 */
async function isUnreadable(file: File): Promise<boolean> {
  try {
    await file.arrayBuffer();
    return false;
  } catch {
    return true;
  }
}

async function downscaleToDataUrl(file: File): Promise<string> {
  let drawable: Drawable;
  try {
    drawable = await decodeFile(file);
  } catch {
    throw new Error(
      (await isUnreadable(file))
        ? "Couldn't read that image. It may be saved in the cloud or was moved. Pick a different photo, or download it to your phone first."
        : "Couldn't read that image. Try a PNG or JPG.",
    );
  }

  // <img> exposes naturalWidth, ImageBitmap exposes width — support both, since
  // decodeFile can return either.
  const srcW =
    (drawable as HTMLImageElement).naturalWidth || (drawable as ImageBitmap).width;
  const srcH =
    (drawable as HTMLImageElement).naturalHeight || (drawable as ImageBitmap).height;

  try {
    for (const step of QUALITY_STEPS) {
      const scale = Math.min(1, step.max / Math.max(srcW, srcH));
      const w = Math.round(srcW * scale);
      const h = Math.round(srcH * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Couldn't read that image. Try a PNG or JPG.");
      // Accepts an HTMLImageElement or an ImageBitmap, so the fallback drops in.
      ctx.drawImage(drawable, 0, 0, w, h);
      // JPEG, not PNG: the card art is photographic and a PNG of the same scene
      // is several times larger, which is what actually blows the quota.
      const dataUrl = canvas.toDataURL("image/jpeg", step.q);
      if (dataUrl.length <= MAX_STORED_CHARS) return dataUrl;
    }
    throw new Error("That image is too large. Try a smaller one.");
  } finally {
    (drawable as ImageBitmap).close?.();
    const objectUrl = (drawable as HTMLImageElement & { __objectUrl?: string })
      .__objectUrl;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export function useCardArt(seed: string | null) {
  const dealt = artForUser(seed);
  const [customArt, setCustomArt] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(CARD_ZOOM);

  useEffect(() => {
    if (!seed) {
      setCustomArt(null);
      setZoom(CARD_ZOOM);
      return;
    }
    try {
      setCustomArt(localStorage.getItem(artKey(seed)) || null);
    } catch {
      /* private mode / quota — fall back to the dealt art */
    }
    try {
      const savedZoom = parseInt(localStorage.getItem(zoomKey(seed)) || "", 10);
      // CLAMP ON READ as well as write: a stale value from an older build (or a
      // hand-edited key) must never be able to zoom the card back OUT past the
      // floor, which would put the wordmark baked into the scene art back on
      // screen. See CARD_ZOOM in CreatorCard.tsx.
      setZoom(
        Number.isFinite(savedZoom)
          ? Math.min(CARD_ZOOM_MAX, Math.max(CARD_ZOOM, savedZoom))
          : CARD_ZOOM,
      );
    } catch {
      setZoom(CARD_ZOOM);
    }
  }, [seed]);

  const changeZoom = useCallback(
    (next: number) => {
      const clamped = Math.min(CARD_ZOOM_MAX, Math.max(CARD_ZOOM, next));
      setZoom(clamped);
      if (!seed) return;
      try {
        localStorage.setItem(zoomKey(seed), String(clamped));
      } catch {
        /* private mode / quota — the zoom just won't survive a reload */
      }
    },
    [seed],
  );

  const uploadArt = useCallback(
    async (file: File): Promise<string | null> => {
      const dataUrl = await downscaleToDataUrl(file);
      setCustomArt(dataUrl);
      if (seed) {
        try {
          localStorage.setItem(artKey(seed), dataUrl);
        } catch {
          // Kept in state so the card still shows it this session; it simply
          // won't survive a reload. Better than refusing the upload outright.
          return "Saved for now, but your device is out of storage so it won't stick.";
        }
      }
      return null;
    },
    [seed],
  );

  const clearArt = useCallback(() => {
    setCustomArt(null);
    if (!seed) return;
    try {
      localStorage.removeItem(artKey(seed));
    } catch {
      /* nothing to do */
    }
  }, [seed]);

  return {
    /** What to render: the upload if there is one, otherwise the dealt scene. */
    artUrl: customArt || dealt,
    hasCustomArt: !!customArt,
    zoom,
    changeZoom,
    uploadArt,
    clearArt,
  };
}
