---
created: "2026-05-10"
status: draft
---

# Traffic Spike Prep — PH Mobile/Desktop Split

**Premise:** For Panel Haus, desktop is the real workspace, but discovery and sharing live on mobile. A traffic burst is expected next week.

**Implication:** Most incoming traffic will land on **mobile** (links shared in DMs, social, group chats). The mobile site is the front door, the first impression, and the funnel into desktop. If mobile bottlenecks or fails to convert, the spike is wasted.

This doc captures changes I'd consider — grouped by where they pay off.

---

## 0. Audience profile (confirmed 2026-05-10)

The spike will be driven by **X posts from the NFT world** — specifically a partnership with a well-known NFT founder + their collection, plus echoes from popular X Spaces. This is not a generic mobile audience and the priorities shift accordingly:

- **Sharing happens almost entirely on X.** Twitter/X card unfurls are the single highest-leverage thing we can ship — every screenshot or share that doesn't unfurl as the actual comic is wasted reach. iMessage / Discord cards matter, but X is where this audience lives.
- **iPhone-heavy.** NFT/X audience skews Apple. iOS Safari quirks dominate over Chrome Android quirks. The `.comic` share bug from [comic-share-debugging.md](comic-share-debugging.md) needs an iOS-specific re-test before launch.
- **Bursty traffic shape.** X Spaces end at a specific minute; founder tweets get RT'd in the first 30 min. Plan for **spikes within the spike** — 90-minute bursts after a Space ends or a quote-RT chain ignites — not a smooth week-long ramp.
- **They expect "drop / claim / mint" framing.** A landing from a partner founder's tweet should feel like a _partnership event_, not generic onboarding. Co-branded interstitial ("Made with Panel Haus × [Collection]") will read as native to this crowd, not as advertising.
- **They will want their PFP / collection art in the comic.** This is the highest-conversion product question of the spike: can someone import a JPEG of their NFT as a character reference today? If yes, surface it on the share page. If no, that's the single most valuable product change to ship before launch.
- **Skip the desktop bridge promotion for this audience.** NFT/X is mobile-native. The desktop redirect gate is mostly noise here — confirm it's suppressed for spike-driven sessions, or kill-switch it for the week. Save desktop conversion for a different launch.

### Decision (2026-05-10): Image-first sharing only

We are **not** building hosted `/share/<id>` URLs for this spike. There is no per-comic public URL today (confirmed via [vercel.json](../vercel.json), [ShareScreen.tsx:97](../src/screens/ShareScreen.tsx#L97), [comic-sharing-exploration.md](comic-sharing-exploration.md)) and standing up Supabase Storage upload + a meta-tagged viewer page is a multi-day build.

Instead, we lean into the existing Web Share API → image-file flow. **On X, the image IS the post.** The PNG that lands in someone's tweet is the artifact — there's nothing to unfurl. This means:

- Twitter/X meta-card work is **dropped** for this spike.
- The shared PNG itself becomes the marketing surface — watermark, brand mark, and visual quality of that asset matter much more than they would otherwise.
- Attribution is degraded: we lose per-comic "shared → visited" tracking. We can still measure "anonymous landing → editor → generation → share" as a session-level funnel, but not "tweet X drove Y conversions."
- The trade-off is acceptable because the audience (NFT/X) already shares back to X primarily via screenshot/repost, and would mostly bypass a hosted reader anyway.

---

## 1. Make the mobile front door survive a hug of death

These are pure load-bearing concerns. Cheap to do, expensive if skipped.

- **Pre-warm caching for shared comic routes.** `/share/...` and `/view/...` are the URLs that will get amplified. Make sure the static shell, fonts, and hero image are aggressively cached at the CDN edge with long max-age + immutable hashes. Bypass any auth checks on these routes.
- **Audit Supabase rate limits and read paths.** Anonymous auth + a public `comics` read path under viral load will hit row-level limits before it hits CPU. Check that `select` policies on the share table don't trigger N+1s. If a single shared comic does multiple round-trips, collapse it to one RPC.
- **Move shared-comic image hosting off the API path.** If image bytes are still flowing through the app server (or Gemini API key path), front them with Supabase Storage public URLs or a CDN. Static bytes should never touch app code.
- **Kill the cold-start risk.** Vercel/serverless cold starts on a viral spike show up as a slow first paint. Either pin a region close to expected audience, or move the share view to a fully static prerender so no function spins up at all.
- **Set a circuit breaker on Gemini calls.** If new visitors land and immediately hit "Generate," a Gemini quota burn could rate-limit _real_ users mid-comic. Throttle anon-user generations more aggressively than known-user ones during the spike window.
- **Error boundaries on the share view specifically.** Most spike traffic never sees the editor — but if the share page white-screens for one user, it white-screens for all of them. Wrap that route in its own boundary with a "view as image" fallback.

---

## 2. Tune the mobile experience for "I just landed here cold from X"

Per the §0 decision, there are no `/share/*` URLs — visitors will land on the **root URL** from a link in someone's tweet (or after seeing a comic image and going to find the app). Optimize for that arrival pattern.

- **Don't show the desktop redirect gate to first-time mobile visitors during the spike.** Already excluded for `/share/*` per [desktop-redirect-gate.md](desktop-redirect-gate.md), but since spike traffic now lands on `/` directly, re-verify or kill-switch the gate for the week.
- **Root-URL landing should hero a working example, not a feature list.** A first-time visitor from an X tweet wants to see "could I make something like that?" within 1 second. Show a beautiful sample comic above the fold with a single "Make one →" CTA, not the full app onboarding.
- **Polish the shared-image asset itself.** Since the PNG is the marketing surface (per §0 decision), it must work hard:
  - ~~Visible but tasteful "panelhaus.app" watermark / brand mark on every exported page.~~ Skipped 2026-05-10 — see [Watermark-Options-for-Free-Users.md](Watermark-Options-for-Free-Users.md) for future revisit.
  - High-contrast, readable at thumbnail size in an X feed.
  - Re-test [comic-share-debugging.md](comic-share-debugging.md) on iOS Safari — many users will tap the in-app share button to send the image directly to X.
- **Co-branded landing for partner-tweet referrers.** If a referrer header or `?utm_source=collection` query param is present, swap the hero to "Made with Panel Haus × [Collection]" so it reads as partnership-event, not generic app.
- **One-tap "Open in app" for returning users.** If we have any signal the user has visited before (localStorage flag), skip the onboarding and drop them straight at the editor.

_(Deferred — depends on hosted-share infra not built this spike: dedicated share view with full-bleed comic, "save image" / "repost" button on a viewer page, OG/Twitter card pre-rendering.)_

---

## 3. Mobile → desktop bridge — DEPRIORITIZED for this spike

Per §0, the NFT/X audience is mobile-native. Desktop conversion is not a goal for this launch and the desktop redirect gate is mostly noise. The bullets below are kept for reference but are **not on the spike-week roadmap**.

- ~~Replace the timed auto-redirect with a contextual nudge.~~ Just confirm the gate is suppressed during the spike window.
- ~~"Send to my desktop" QR flow.~~ Save for a different launch — desktop bridge work is post-spike.
- ~~Email-the-link fallback.~~ Same — defer.
- ~~Surface desktop offering on the share page.~~ No share page exists this spike; desktop bridge promotion happens via the existing Workshop/Editor screens only.

---

## 4. Observability for the spike itself

You can't tune what you can't see. Set this up _before_ traffic arrives, not during. Detailed plan in [analytics-audit-and-plan.md](analytics-audit-and-plan.md).

- **Per-route traffic + error dashboards.** Specifically: `/` (root cold landings), editor, generation endpoints. No `/share/*` to monitor — image-first sharing means we can't track per-comic conversion (see §0 decision trade-off).
- **Funnel metric: cold landing → editor open → first generation → first share.** This is the session-level funnel for image-first sharing. We lose per-tweet attribution but keep "did they convert" measurement.
- **Gemini quota dashboard with a Slack/email alert at 70%.** Don't find out we're throttled when users complain.
- ~~Track "stay on mobile" vs "redirect to desktop" rates on the gate.~~ Deferred — desktop gate is suppressed for the spike per §3.

---

## 5. Things to NOT do this week

Spike weeks are not the time for ambitious changes. Some explicit non-goals:

- Don't ship cloud auth migration ([cloud-storage-plan.md](cloud-storage-plan.md)) — too risky for a high-traffic week.
- Don't change the editor UX. New visitors will be confused regardless; established muscle memory matters more.
- Don't ship a new monetization gate. If there's a paywall change planned, hold it for a calmer week — viral moments are about reach, not extraction.
- Don't refactor the share/export pipeline. If `.comic` sharing is currently buggy on some browsers (per [comic-share-debugging.md](comic-share-debugging.md)), patch the specific bug — don't redesign.

---

## Suggested sequencing (re-prioritized for image-first NFT/X spike)

Decisions confirmed 2026-05-10: hosted share **dropped** (image-first only, see §0); PFP/NFT-as-character flow **dropped** (out of scope for this spike); desktop bridge **dropped** (see §3).

Remaining work, in order:

1. **Day 1 (highest leverage, time-critical):** Phase 1 of [analytics-audit-and-plan.md](analytics-audit-and-plan.md) — Vercel Web Analytics + 5 custom events + fix the broken `_proxyAvailable` fallback. **Must land first** because we need 3+ quiet days to build a baseline before the spike. Every day delayed is a baseline day lost.
2. **Day 2:** Polish the shared-image asset (watermark, brand mark, iOS Safari share re-test per [comic-share-debugging.md](comic-share-debugging.md)) + co-branded "Made with Panel Haus × [Collection]" hero for partner-tweet referrers.
3. **Day 3:** CDN/cache audit, Gemini throttle for anon users, error boundary hardening, on-call rota, walk through bursty-spike failure modes (X Space ends → 90-min surge).

Everything else is post-spike learnings.

---

## Metrics & funnel setup

Detailed plan lives in [analytics-audit-and-plan.md](analytics-audit-and-plan.md). The minimum we need before traffic arrives:

- **Baseline before spike (3–4 quiet days).** Run Vercel Web Analytics + the 5 custom events for at least 3 days _before_ launch so we have a quiet-day conversion rate to compare against.
- **Funnel for image-first sharing:** `cold_landing` → `editor_first_open` → `generation_started` → `share_completed`. (Note: the analytics doc currently lists `share_view_opened` / `share_view_cta_tapped` — those events presumed a hosted share view. Per the §0 decision, replace them with `cold_landing` and `share_completed` to match what actually exists.)
- **The number that matters:** cold-landing → first-generation conversion %. Without a baseline, a spike-day 8% conversion means nothing — we won't know if it's a win, a loss, or noise.
- **What to do with it during the spike:**
  - Conversion craters (e.g. 15% → 3%) → root landing is the bottleneck. Push CTA higher, simplify, kill chrome.
  - Conversion holds but `generation_started` falls off → editor onboarding is the bottleneck for cold visitors.
  - Both hold but `share_completed` falls off → loop is broken; sharing needs to be the very last action of the create flow.

---

## Confirmed context (was: open questions)

- ✅ **Traffic source:** X posts driven by NFT-world partnership (popular founder + collection) and X Spaces echoes. See §0.
- ⚠️ **Baseline conversion:** Does not exist yet. **Blocks knowing whether the spike succeeded.** See [analytics-audit-and-plan.md](analytics-audit-and-plan.md) Phase 1 — must land in next 1–2 days to leave time for a quiet-day baseline.
- ✅ **On-call human:** Confirmed available for most of the spike window. Designate one person + one bookmark for Vercel function logs; rotate if the window stretches past 4 hours.
