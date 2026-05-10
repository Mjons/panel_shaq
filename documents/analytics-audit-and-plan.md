---
created: "2026-05-10"
status: draft
---

# Analytics & Dashboard — Audit and Plan

**TL;DR:** No product analytics. No dashboard. The only telemetry that exists is a Supabase `usage` table used as a per-day quota gate — and per [Usage-Tracking-Debug-—-Why-Rows-Don't-Appear.md](Usage-Tracking-Debug-—-Why-Rows-Don't-Appear.md), even that may not be receiving writes. With a traffic spike expected next week ([traffic-spike-prep.md](traffic-spike-prep.md)), this is the minimum viable observability we'll need before traffic arrives.

---

## Findings

### What exists today

**Quota tracking (server-side, partial / suspected broken):**

- [api/generate-panels.ts:49-92](api/generate-panels.ts#L49-L92) — `checkUsage()` writes a row per `user_id` + `date` to a Supabase `usage` table with columns `text_generations` / `image_generations`. Same helper duplicated in [api/generate-image.ts:51-92](../api/generate-image.ts#L51-L92), [api/final-render.ts:51-92](../api/final-render.ts#L51-L92), [api/insert-panel.ts](../api/insert-panel.ts), [api/polish-story.ts](../api/polish-story.ts). Limits are hardcoded: 50 text, 20 image per user per day.
- The intent is rate-limiting, not analytics. There is no aggregation, no time-series, no read path for the data.
- Known broken per [Usage-Tracking-Debug-—-Why-Rows-Don't-Appear.md](Usage-Tracking-Debug-—-Why-Rows-Don't-Appear.md): client `_proxyAvailable` flag falls back to direct SDK after a single 404, bypassing the API routes entirely. Writes likely silent for many users.

### What does NOT exist

- **No frontend analytics SDK** — no GA4, Plausible, PostHog, Mixpanel, Vercel Web Analytics, or anything else in [package.json](../package.json) or [index.html](../index.html).
- **No event tracking** — zero `track()`/`trackEvent()`/`logEvent()` calls in `src/`.
- **No error monitoring** — no Sentry, no Cloudflare/Vercel error capture beyond default platform logs.
- **No dashboard route** — none of [src/screens](../src/screens) is an admin/stats view. The `documents/admin-mode-exploration.md` is exploratory only.
- **No funnel data** — share-view → editor-open → first-generation conversion (the metric [traffic-spike-prep.md](traffic-spike-prep.md) §4 calls out as critical) is not measurable today.
- **No quota / cost dashboard** — Gemini API spend and per-user generation rates are invisible until something pages.

### Stack constraints (relevant for tool choice)

- React 19 + Vite 6 SPA, hosted on Vercel (`vercel.json`, `@vercel/node` Functions).
- Supabase already in use for anon auth + (intended) usage rows. Free-tier-friendly.
- PWA via `vite-plugin-pwa` — service worker is in play, so any analytics SDK needs to behave with offline/cached loads.
- Privacy posture isn't documented; no cookie banner today, so cookieless analytics is the path of least resistance.

---

## Plan

Sequenced by leverage and by the traffic-spike timeline. Phase 1 is the only thing that has to land before the spike.

### Phase 1 — Survive the spike (1–2 days, before traffic) — **SHIPPED 2026-05-10**

Goal: be able to answer "is the spike working?" and "is anything on fire?" in real time.

1. ✅ **Vercel Web Analytics added.** `@vercel/analytics` v2.0.1 installed; `<Analytics />` mounted in [src/main.tsx](../src/main.tsx). Verify post-deploy: traffic should appear in Vercel dashboard within an hour.
2. ✅ **`_proxyAvailable` fallback already removed** in a prior cleanup — current [src/services/geminiService.ts](../src/services/geminiService.ts) `apiPost` has no sticky-fallback flag and no direct-SDK call path. The only `@google/genai` import left is in [SettingsScreen.tsx:82](../src/screens/SettingsScreen.tsx#L82) for an API-key validation test (intentional, not a generation path). Usage rows should be writing as long as Supabase env vars are baked in at build time.
3. ✅ **5 custom events wired** (image-first event names per [traffic-spike-prep.md](traffic-spike-prep.md) §0 decision):
   - `cold_landing` — fires once per browser session in [src/main.tsx](../src/main.tsx). Props: `{ first_visit: bool }` based on a `panelshaq_visited` localStorage marker.
   - `editor_first_open` — fires once per session via `trackOnce()` in [src/App.tsx](../src/App.tsx) `useEffect` watching `activeTab`.
   - `generation_started` — fires from [apiPost](../src/services/geminiService.ts#L109) for every API call. Props: `{ type: endpoint }` (e.g. `generate-panels`, `generate-image`).
   - `generation_failed` — fires from `apiPost` catch path. Props: `{ type, reason }` where `reason` is `timeout` or the first 80 chars of the error message.
   - `share_completed` — fires from 3 paths in [ShareScreen.tsx](../src/screens/ShareScreen.tsx). Props: `{ surface: 'export_item' | 'all_panels' | 'single_panel' (+ '_download' suffix on fallback path), ... }`.
   - Wrapper lives in [src/services/analytics.ts](../src/services/analytics.ts) — exports `track`, `trackOnce(name)`, `trackColdLanding()`. 18 lines total.
4. **Vercel Function logs → keep the tab open during the spike.** No code change. Just designate one human + one bookmark.

**Verification still pending (post-deploy):**

- Confirm events arrive in the Vercel dashboard custom-events panel.
- Confirm `cold_landing` `{first_visit: true}` count matches new visitors and `{first_visit: false}` matches returning ones.
- Run a baseline for 3+ quiet days before the spike so conversion % has a comparison point.

### Phase 2 — Real numbers, not vibes (3–5 days, can land week-of or just after)

5. **Add Sentry (free tier) for client + server errors** → verify: a thrown test error appears in Sentry within 60s.
   - Client: `@sentry/react`. Server: `@sentry/node` in the API handlers. Catches the white-screen failure mode that [traffic-spike-prep.md](traffic-spike-prep.md) §1 specifically warns about.
6. **Build a thin `/api/stats` endpoint that reads the Supabase `usage` table** → verify: hitting it returns today's totals.
   - Server-only, gated behind a shared secret in `STATS_TOKEN` env var. Returns: today's total text/image generations, unique user_ids, top users by volume.
7. **Build a `/admin/stats` route in the app** → verify: rendering shows the same numbers.
   - Single page. Reads `/api/stats` with the token (entered once and stored in localStorage on the admin's device — no real auth needed at this scale). Tables, not charts. Three numbers: today's generations, this week's generations, current Gemini spend if computable.

### Phase 3 — Post-spike learnings (only if Phase 1+2 land cleanly)

8. **PostHog free tier OR keep using Vercel events.** Decide based on what we actually want to slice. If the questions stay at "how many X happened," Vercel events are enough. If they become "what's the path of users who churn at step 3," migrate to PostHog. Don't pre-emptively add PostHog — it doubles the analytics surface area.
9. **Funnel report** off the events from Phase 1.3 — share_view → editor_first_open → generation_started conversion %. This is the single number that tells us if the bridge ([traffic-spike-prep.md](traffic-spike-prep.md) §3) is working.
10. **Promote the `/admin/stats` page to include charts only if anyone is actually opening it.** If no one looks, kill the route — don't maintain dead surface area.

---

## Decisions to confirm before I touch code

- **Vercel Web Analytics vs. Plausible vs. PostHog as the v1 SDK?** I'm recommending Vercel because zero-config, native to the host, and cookieless. Plausible is similar but $9/mo. PostHog is heavier than we need this week.
- **Are we OK adding a `usage_events` table in Supabase**, or do we want to keep all event data in the analytics SDK and leave Supabase to quota only? Recommendation: keep Supabase for quota only this week, revisit if Phase 3 needs deeper queries.
- **Who is the on-call human during the spike?** The plan above assumes someone is watching the Vercel dashboard + Sentry + function logs in real time. Without that, Phase 1 is just decoration.

---

## Non-goals

- Not building a charting/BI tool. If the answer needs a line chart, we read it off the Vercel/Sentry UI, not a dashboard we maintain.
- Not adding a cookie-consent banner this week. Stay cookieless so we don't need one.
- Not migrating quota tracking to a new system. The current Supabase table is fine; it just needs the proxy fallback fix to actually receive writes.
