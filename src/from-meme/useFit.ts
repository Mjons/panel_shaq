import { useEffect, useState } from "react";
import type { RefObject } from "react";

// Shared viewport-fit helpers used by both the user editor and the admin
// calibrator so their layout/zone-alignment behavior stays identical.

/** Live content-box size of an element via ResizeObserver. */
export function useElementSize<T extends HTMLElement>(
  ref: RefObject<T | null>,
) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** Largest rect of the given aspect that fits inside (aw × ah) — object-contain math. */
export function fitRect(aw: number, ah: number, aspect: number) {
  if (!aw || !ah || !aspect) return { w: 0, h: 0 };
  let w = aw;
  let h = aw / aspect;
  if (h > ah) {
    h = ah;
    w = ah * aspect;
  }
  return { w, h };
}
