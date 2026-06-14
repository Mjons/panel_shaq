# Panel Haus Mobile (Panelhaus)

Mobile-first, AI-powered comic creation studio. Write a story, generate comic panels with
Gemini, manage reusable assets (characters / environments / props / vehicles), lay panels
into pages, add speech bubbles, and export. It's the **mobile/tablet half** of the Panel Haus
ecosystem (desktop app: [panelhaus.app](https://panelhaus.app)) and exports `.comic` packages
the desktop app can import. It also hosts the **MemeGen → Panel Haus meme "add text" handoff**
receiver at `/c/from-meme`.

> Deployed at **m.panelhaus.app**. Storage keys keep the legacy `panelshaq_*` prefix on
> purpose — renaming them would orphan existing users' projects.

**Stack:** React 19 + Vite 6 + Tailwind CSS v4 (config-in-CSS via `@theme`) · Vercel serverless
functions in `api/` · Google Gemini (REST) · Clerk (shared auth + credits, optional) · Supabase
(usage/email, optional) · Vercel Analytics.

---

## Run locally

**Prerequisites:** Node.js 18+.

```bash
npm install            # install deps
npm run dev            # Vite dev server on :3000 — FRONTEND ONLY (/api routes won't run)
npm run dev:full       # vercel dev — frontend + api/ serverless functions together
npm run build          # vite build → dist/
npm run preview        # preview the production build
npm run lint           # tsc --noEmit — the ONLY check (no test suite, no ESLint)
```

- To exercise anything that calls `/api/*` (panel/image generation, polish, critique,
  credits), you must run the API functions — use `npm run dev:full`, not `npm run dev`.
- **Windows note:** on some setups `vercel dev` doesn't pass `.env.local` to the `/api`
  functions (the client reads it fine, the functions see them MISSING). Use the included
  **`dev.ps1`** launcher instead — it loads `.env.local` into the shell, then runs `vercel dev`:
  ```powershell
  .\dev.ps1
  ```

## Configuration (env vars)

Copy `.env.example` → `.env.local` and fill in what you need. Everything is **optional** —
the app degrades gracefully when a key is absent (e.g. no Clerk key → legacy anon/BYOK mode).

- **Client** vars are `VITE_`-prefixed and baked in at **build time** (must be set before
  `npm run build` / in Vercel before deploy).
- **Server** vars are read at runtime by the `api/` functions.

Quick reference (full descriptions in `.env.example` and `CLAUDE.md`):

| Var | Side | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | server | Shared Gemini key for generation (BYOK users send their own). |
| `VITE_CLERK_PUBLISHABLE_KEY` | client | Clerk key (same instance as Panel Haus) → shared account + credits. Unset = disabled. |
| `CLERK_SECRET_KEY` | server | Verifies the Clerk Bearer in `api/` routes. |
| `PANELHAUS_API_BASE` | server | Upstream for the meme handoff + shared-credit calls. Use `https://www.panelhaus.app`. |
| `INK_COST_IMAGE` | server | Ink charged per image generation (match Panel Haus). |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | client | Optional analytics / legacy usage. |
| `VITE_MEMEGEN_URL`, `VITE_MEME_ADMIN_SECRET` | client | Meme handoff "make another" target + admin calibrator. |

Quotes are optional in `.env.local` (`KEY=value` is fine); no spaces around `=`.

## How it works (high level)

- **State lives in the browser.** `src/App.tsx` owns all top-level state; large data
  (panels/images, vault, style ref) is in IndexedDB, small data in localStorage. The server
  is stateless.
- **Screens are tabs, not routes** (`workshop → director → layout → editor`, plus `vault`,
  `settings`, `share`). The only "route" is `/c/from-meme`, branched in `src/main.tsx`.
- **Auth + credits (optional):** when `VITE_CLERK_PUBLISHABLE_KEY` is set, the app shares one
  Clerk account + one ink balance with Panel Haus. A soft gate prompts sign-in at generation;
  image routes reserve/refund shared ink via Panel Haus's API (the single source of truth).
  Without the key, it runs the legacy anonymous/BYOK path. BYOK (your own Gemini key, set in
  Settings) always bypasses credits.
- **API routes are self-contained.** Each file in `api/` is an independent Vercel function;
  Vercel can't share local files, so helpers are inlined per route by design — don't "DRY" them.

## Documentation

- **`CLAUDE.md`** — architecture, conventions, and guidance (start here).
- **`documents/`** — design/handoff specs, including:
  - `CLERK_CREDITS_INTEGRATION_BUILD_PLAN.md` — shared Clerk auth + credits.
  - `CREDIT_PURCHASE_INAPP_PLAN.md` — in-app credit purchase (Stripe via Panel Haus).
  - `MEMEGEN_HANDOFF_AND_DESKTOP_UPSELL_STRATEGY.md` / `MEME_TEMPLATE_CALIBRATION_GUIDE.md` —
    the meme handoff + adding/calibrating templates.
  - `PANEL_HAUS_MOBILE_EXPORT_COMPATIBILITY.md` — the `.comic` export/desktop bridge.
- **`CHANGELOG.md`** — user-facing summary of changes.
