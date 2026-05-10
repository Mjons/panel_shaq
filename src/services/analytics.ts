import { track } from "@vercel/analytics";

type Props = Record<string, string | number | boolean>;

export { track };

export function trackOnce(name: string, props?: Props) {
  const key = `panelshaq_tracked_${name}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  track(name, props);
}

export function trackColdLanding() {
  if (sessionStorage.getItem("panelshaq_tracked_cold_landing")) return;
  sessionStorage.setItem("panelshaq_tracked_cold_landing", "1");
  const isFirstEver = !localStorage.getItem("panelshaq_visited");
  if (isFirstEver) localStorage.setItem("panelshaq_visited", "1");
  track("cold_landing", { first_visit: isFirstEver });
}
