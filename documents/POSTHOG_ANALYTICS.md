# PostHog Analytics (Panel Haus Mobile)

Product analytics for case studies: how many sign up, which AI tools they use, where
they spend ink, and what converts. PostHog runs **alongside** Vercel Analytics (Vercel =
traffic/web-vitals, PostHog = product funnels), both fed from one wrapper.

## Architecture

`src/services/analytics.ts` is the single funnel. `track()`/`trackOnce()` fan out to
**both** Vercel and PostHog, so every existing event reaches PostHog with no new call sites.

- **Init:** `initAnalytics()` in `src/main.tsx` calls `posthog.init(VITE_POSTHOG_KEY, …)`.
  **Gated on `VITE_POSTHOG_KEY`** (unset = PostHog is a no-op; Vercel still runs).
  Config: `api_host` US (`https://us.i.posthog.com`, override with `VITE_POSTHOG_HOST`),
  `capture_pageview: 'history_change'` (SPA pageviews), `capture_pageleave: true`,
  `autocapture: true` (clicks/inputs, inputs masked by default), `person_profiles:
  'identified_only'` (anonymous events still flow + merge on identify; profiles only for
  signed-in users → cheaper + less PII).
- **Identity:** `<PosthogIdentifyBridge/>` (mounted in `main.tsx`, inside `<ClerkProvider>`)
  → on Clerk sign-in `identifyUser(clerkUserId, { email|wallet, auth_method, signup_date })`;
  on sign-out `resetUser()`. `credits.ts` adds `setUserProps({ tier })` once the balance loads.
- **Privacy:** identified users carry email/wallet + tier (chosen for case studies). The meme
  receiver `/c/from-meme` is outside the Clerk wrapper, so it's anonymous (no identify).

## Event taxonomy

| Event | Props | Fired from | Answers |
|---|---|---|---|
| `cold_landing` | `first_visit` | `main.tsx` | acquisition |
| `$pageview` / autocapture | (auto) | posthog-js | traffic, UI interaction |
| `signed_up` | `auth_method` | `PosthogIdentifyBridge` | **signups** (also = unique identified users) |
| `generation_started` | `type` (endpoint) | `geminiService.apiPost` | **which AI tool used** |
| `generation_failed` | `type`, `reason` | `apiPost` | reliability |
| `ink_spent` | `tool`, `balance_after` | `apiPost` (charged success) | **where ink goes** |
| `out_of_ink` | `tool`, `source` (precheck/server_402) | `apiPost` | paywall hits |
| `checkout_started` | `pack` | `checkout.ts` | purchase intent |
| `purchase_completed` | `type` | `App.tsx` (Stripe return) | conversion |
| `referral_linked` | `code` | `referral.ts` | virality (in) |
| `referral_shared` | `method` | `ReferralCard` | virality (out) |
| `share_completed` | (various) | screens | value/output |
| `editor_first_open` | (none) | `App.tsx` | activation |

Person properties (for segmentation): `email`/`wallet`, `auth_method` (email/google/wallet),
`tier` (free / Founder Pass / …), `signup_date`.

`type`/`tool` values map to the AI routes: `generate-panels`, `generate-image`,
`final-render`, `insert-panel`, `polish-story`, `suggest-dialogue`, `analyze-character`,
`critique-comic` (Vault asset gen also goes through `generate-image`).

## Suggested PostHog insights (for case studies)
- **Signup funnel:** `cold_landing` → `signed_up` → first `generation_started` → `ink_spent`.
- **Tool popularity:** bar of `generation_started` broken down by `type`.
- **Monetization:** `out_of_ink` → `checkout_started` → `purchase_completed` conversion.
- **Retention:** weekly active identified users; ink_spent per user over time.
- **Segment by `tier`/`auth_method`** on any of the above.

## Setup / activation
1. Create a PostHog project (US Cloud) → copy the **Project API key**.
2. Set `VITE_POSTHOG_KEY` (and optionally `VITE_POSTHOG_HOST`) in the Vercel project
   (and `.env.local` for dev). `VITE_` keys bake at **build time** → redeploy after setting.
3. That's it; events start flowing. Verify in PostHog → Activity (live events).
4. Optional later: a reverse proxy (`/ingest` Vercel rewrite to PostHog) to dodge ad-blockers;
   session replay (more quota + records UI). Both are config-only follow-ups.

## Notes
- Analytics is fire-and-forget; all wrappers swallow errors and never block the app.
- No PostHog dependency when the key is unset (init early-returns), so dev without the key
  behaves exactly as before.
