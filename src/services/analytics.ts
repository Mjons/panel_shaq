import { track as vercelTrack } from "@vercel/analytics";
import posthog from "posthog-js";

type Props = Record<string, string | number | boolean>;

// Analytics fans out to BOTH Vercel Analytics (traffic/web-vitals) and PostHog
// (product funnels / case studies). PostHog is gated on VITE_POSTHOG_KEY; unset →
// it's a no-op and only Vercel runs (graceful degradation, like Clerk/Supabase).

let phReady = false;

/** Initialize PostHog once, if a key is configured. Call from main.tsx at startup. */
export function initAnalytics(): void {
  if (phReady || typeof window === "undefined") return;
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) return;
  try {
    posthog.init(key, {
      api_host:
        (import.meta.env.VITE_POSTHOG_HOST as string) ||
        "https://us.i.posthog.com",
      capture_pageview: "history_change", // SPA pageviews (no router)
      capture_pageleave: true,
      autocapture: true,
      // Only create person profiles for identified (signed-in) users; anonymous
      // events still flow and merge on identify. Cheaper + privacy-friendlier.
      person_profiles: "identified_only",
      persistence: "localStorage+cookie",
    });
    phReady = true;
  } catch {
    /* analytics must never break the app */
  }
}

/** Fire an event to both sinks. */
export function track(name: string, props?: Props): void {
  try {
    vercelTrack(name, props);
  } catch {
    /* ignore */
  }
  if (phReady) {
    try {
      posthog.capture(name, props);
    } catch {
      /* ignore */
    }
  }
}

/** Link subsequent events to a signed-in user (PostHog person). */
export function identifyUser(distinctId: string, props?: Props): void {
  if (!phReady) return;
  try {
    posthog.identify(distinctId, props);
  } catch {
    /* ignore */
  }
}

/** Set/update person properties on the current user (e.g. tier once it loads). */
export function setUserProps(props: Props): void {
  if (!phReady) return;
  try {
    posthog.setPersonProperties(props);
  } catch {
    /* ignore */
  }
}

/** Clear identity on sign-out so the next user starts fresh. */
export function resetUser(): void {
  if (!phReady) return;
  try {
    posthog.reset();
  } catch {
    /* ignore */
  }
}

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
