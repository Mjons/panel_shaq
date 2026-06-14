import { useEffect, useState } from "react";

// Per-action ink costs, fetched live from /api/ink-costs so the UI always matches
// what the routes actually charge. Cached module-wide (one request per session).

export interface InkCosts {
  text: number;
  imageFlash: number;
  imagePro: number;
}

const DEFAULTS: InkCosts = { text: 1, imageFlash: 1, imagePro: 2 };

let cached: Promise<InkCosts> | null = null;

function fetchInkCosts(): Promise<InkCosts> {
  if (!cached) {
    cached = fetch("/api/ink-costs")
      .then((r) => (r.ok ? r.json() : DEFAULTS))
      .then((d) => ({
        text: Number(d?.text) || DEFAULTS.text,
        imageFlash: Number(d?.imageFlash) || DEFAULTS.imageFlash,
        imagePro: Number(d?.imagePro) || DEFAULTS.imagePro,
      }))
      .catch(() => DEFAULTS);
  }
  return cached;
}

/** Live ink costs; returns sensible defaults until the fetch resolves. */
export function useInkCosts(): InkCosts {
  const [costs, setCosts] = useState<InkCosts>(DEFAULTS);
  useEffect(() => {
    let alive = true;
    fetchInkCosts().then((c) => {
      if (alive) setCosts(c);
    });
    return () => {
      alive = false;
    };
  }, []);
  return costs;
}
