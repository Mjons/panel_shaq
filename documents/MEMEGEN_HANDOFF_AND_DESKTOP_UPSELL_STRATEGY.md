# MemeGen → Panel Shaq Handoff + Wallet Identity + Desktop Upsell — Strategy

**Date:** 2026-06-02
**Status:** Strategy LOCKED for V1 (decisions A–G resolved 2026-06-02). Ready for plan mode. Not yet built.
**Surfaces:** `memegen.panelhaus.app` (generator) · `shaq.panelhaus.app` (Panel Shaq, mobile, THIS repo) · `panelhaus.app` (Panel Haus desktop, Comic-Pro2)

**Repos referenced (one level above this project):**

- `/mnt/c/Users/tayfu/Desktop/Claude_Projects/MemeGen` — the meme generator + handoff sender (Vite/React, wagmi/RainbowKit/SIWE, Ethereum mainnet)
- `/mnt/c/Users/tayfu/Desktop/Claude_Projects/Comic-Pro2` — Panel Haus desktop (Vite/React/Zustand, EVM+Solana wallet auth, Vercel Postgres credits, Upstash Redis)
- `/mnt/c/Users/tayfu/Desktop/Claude_Projects/panel_shaq` — Panel Shaq mobile (this repo; Vite/React/TS/Tailwind v4, Gemini via Vercel functions, Supabase metering, **no web3 today, no router today**)

**Related docs:**

- `MemeGen/MOBILE_TEXT_FLOW_EXPLORATION.md` — the original problem write-up (recommends "build /c/from-meme on Panel Shaq")
- `MemeGen/PANELHAUS_INTEGRATION_HANDOFF.md`, `MemeGen/PH_INTEGRATION_HANDOFF.md` — the handoff contract
- `Comic-Pro2/documentation/guides/PANEL_SHAQ_BRIDGE_HANDOFF.md` — the (aspirational, **not built**) shared-Supabase `.comic` transfer bridge
- `Comic-Pro2/documentation/changelog/935_GUEST_MODE_FOR_MEMEGEN_HANDOFF.md` and siblings — desktop guest-mode mechanics

---

## Decisions locked (2026-06-02)

These were the open questions (full record kept in §9). Resolved:

- **A — Seed text zones from PanelHaus.** Convert PanelHaus's absolute-pixel `textBubbles` → normalized 0–1; placements match the desktop experience exactly.
- **B — Calibrator: the easy path.** Committed seed file is the source of truth; an in-app **admin-gated calibrator** (simple client-side secret, works on a real phone) **exports JSON to the clipboard** for manual paste back into the seed file. **No Supabase backend / override layer** — easy, and still on-device. (Upgrade to live Supabase overrides only if it ever proves necessary.)
- **C — No AI in the meme flow (for now).** AI captions are explicitly **out of scope**; kept separate. The mobile meme flow is pure text overlay + share.
- **D — No credits on Panel Shaq.** PanelHaus and MemeGen each have their **own, separate** credit economies. Because the Shaq meme flow has **no AI**, it needs **no credits at all** — best outcome for now. Don't wire Shaq to any credit system.
- **E — No email courier.** Dropped. With wallet = identity, a user who wants the desktop experience simply **goes to `panelhaus.app` on a computer, connects the same wallet (or registers there)**. We do not build reverse-handoff / email link transport.
- **F — No email capture in the meme flow.** Follows from C/D/E: with no AI gate, no credits, and no courier, email has no functional purpose here. Skip it. (Revisit only as a pure marketing capture later, if ever.)
- **G — Ignore Solana.** MemeGen is EVM-only, so the handoff identity is always an EVM `web3:0x…` address.

Net effect: **V1 is dramatically simpler** — a creditless, AI-less, email-less guest meme editor. No new backend on Shaq. The only cross-repo change besides this repo is one small **mandatory** guard in PanelHaus (see §3, do not lose sight of this).

---

## V1 implementation decisions (2026-06-02, locked at plan time)

These refine the strategy into the build that is now in progress. The executable, file-level plan lives at `~/.claude/plans/you-are-a-professional-graceful-knuth.md`.

### Action bar (mobile-friendly)

Primary row — **Share · Copy · Download** (mirrors PanelHaus desktop guest mode):

- **Share** → Web Share API with files (`navigator.canShare?.({files})` → `navigator.share({files})`), reusing Panel Shaq's existing pattern in `src/screens/ShareScreen.tsx:69-105`. This is the mobile-correct path. (PanelHaus's own "share" is a desktop-only "copy + paste Ctrl+V into X" flow — **not** mobile-viable — so we do NOT replicate that; only its Copy is replicated.)
- **Copy** → image to clipboard via `navigator.clipboard.write([new ClipboardItem({"image/png": blob})])`, replicating `Comic-Pro2/src/services/shareService.js:169` (feature-detect guard + download fallback). The flattened PNG blob is **pre-rendered on edit (debounced)** so the clipboard write fires within the user-gesture (mobile Safari loses the gesture if we flatten inside the tap).
- **Download** → anchor download of the flattened PNG.

Secondary row — two CTAs:

- **Make another meme** → links back to MemeGen (`memegen.panelhaus.app`); keeps the meme loop.
- **Make a new comic** → saves the finished meme into Panel Shaq's **Vault** as a `VaultEntry` of type **`Prop`** (neutral type; does not pollute the Character-consistency filter), then opens the main app on the Workshop tab. Hitting the `EmailGate` there is acceptable (this is the "commit to the real product" moment).

Desktop upsell stays a small **informational** note (wallet-aware via `originUser`): "Open the full studio at panelhaus.app and connect this wallet." No reverse-handoff.

### Build architecture

- **Separate root, no router:** `src/main.tsx` branches on `window.location.pathname === "/c/from-meme"` to render a new `<FromMemeRoot/>` (wrapped in `ConfirmProvider`+`ToastProvider`) instead of `<App/>`. This bypasses `AppInner`'s `EmailGate` entirely. `vercel.json` already serves the SPA for that path.
- **Consume:** browser-side cross-origin `POST https://panelhaus.app/api/handoff/consume` (no secret; CORS `*`). Single-use → cache payload **and edited captions** to `sessionStorage`, hydrate cache-first, guard with a ref (React 19 StrictMode).
- **Text zones:** a one-time Node generator (`scripts/generateMemeTextZones.mjs`) reads PanelHaus's `memeTemplates.js` + `memeFontPresets.js`, runs the real `resolveMemeBubbleStyle`, normalizes px→0-1 (incl. `fontSizeRatio` and the `modern-slab` white box), and emits a **static committed** `src/data/memeTextZones.ts`. The shipped app has zero Comic-Pro2 dependency. Rendering ports MemeGen's `TextZonesOverlay.jsx` to TSX.
- **Export:** manual canvas flatten (not html-to-image — its `skipFonts:true` breaks meme fonts): `crossOrigin='anonymous'` image, `document.fonts.load` + `ready`, per-zone word-wrapped `fillText`/`strokeText` matching the overlay, then the watermark (port of `getMemeWatermarkBubbles`).
- **Fonts added** (`index.html` Google Fonts): Anton (Impact substitute — Impact is not a web font), Bricolage Grotesque, Bangers (watermark), Permanent Marker, Special Elite.

### Admin calibrator (easy path)

`?admin=<secret>` URL param (→ `localStorage.panelshaq_admin`) reveals the overlay in editable mode (move/rotate/resize handles, round 3dp/1dp) with add/remove/label-zone controls and a **Copy JSON** button. The admin pastes the JSON back into `src/data/memeTextZones.ts` and commits. No Supabase override layer in V1.

---

## As built — final V1 (2026-06-02) — AUTHORITATIVE

This section reflects the **actual shipped code** and supersedes the plan-time sections above wherever they differ (a few decisions evolved during implementation — noted as deltas).

### Files (Panel Shaq, this repo)

- `src/main.tsx` — branches on `window.location.pathname === "/c/from-meme"` → renders `<FromMemeRoot/>` instead of `<App/>` (bypasses `EmailGate`).
- `src/from-meme/`
  - `FromMemeRoot.tsx` — providers (`ToastProvider`), status states (loading / 410 / network / no-token), routes to gallery / calibrator / editor.
  - `useHandoffPayload.ts` — cross-origin consume of `${VITE_PANELHAUS_API_BASE}/api/handoff/consume`, sessionStorage cache-first, StrictMode ref-guard, typed errors, dev stub (`?stub=1&template=&img=&w=&h=`).
  - `MemeEditor.tsx` — the guest editor (viewport-fit, tap-to-edit, font/size, move/rotate/resize, delete + restore-chip, share/copy/download, CTAs).
  - `TextZonesOverlay.tsx` — normalized DOM overlay; read + editable (handles); `onlySelectedHandles` for users; box hidden when empty.
  - `memeFontPresets.ts` — the 5 presets (Impact/Wojak/Slab/Marker/Type) as `MemeZoneStyle`.
  - `memeFlatten.ts` / `memeWatermark.ts` — canvas flatten (crossOrigin, font preload, word-wrap, outline stroke, box) + `panelhaus.app` watermark.
  - `memeShare.ts` — Web Share (files) / `ClipboardItem` copy / download, each with fallbacks.
  - `makeComic.ts` — saves meme to Vault as a `Prop` (`panelshaq_vault_entries`), opens Workshop tab.
  - `adminGate.ts` — `?admin=<VITE_MEME_ADMIN_SECRET>` gate.
  - `AdminCalibrator.tsx` — positioning + Copy JSON (+ optional `onBack`).
  - `AdminGallery.tsx` — grid of all templates → opens any in the calibrator.
  - `useFit.ts` — shared `useElementSize` + `fitRect` (used by editor AND calibrator so they never drift).
  - `zoneTypes.ts` — `MemeZone`/`MemeTemplateZones` (+ `image`, `fontSizeRatio`, em-relative outline).
- `src/data/memeTextZones.ts` — generated, committed registry: **56 templates / 98 zones**, each with `aspect`, `image` (filename), and normalized zones.
- `scripts/generateMemeTextZones.mjs` — one-time generator (reads Comic-Pro2 data via temp `.mjs`; output committed).
- `public/templates/` — all **56 template images** (for the admin gallery + stub). Production users never fetch these (they get the handoff image).
- `src/hooks/useIndexedDBState.ts` — `idbGet`/`idbSet` exported (for `makeComic`).
- `index.html` — meme fonts (Anton, Bangers, Bricolage Grotesque, Permanent Marker, Special Elite).

### Behavior (final)

- **Viewport-fit, no scroll** for both the editor and the calibrator: area measured via ResizeObserver, image fitted (object-contain math) with aspect read from the actual loaded image; overlay aligns exactly; refits on rotate / keyboard.
- **User editor controls:** tap a caption → orange selection ring + slim docked toolbar (never covers the meme) with: text input, 5 font presets (live restyle), size `A−/A+`, **Delete**, plus **✥/↻/⤡ handles on the selected caption** for move/rotate/resize. Tap background to deselect.
- **Delete = clean preview** (no on-image ghost). Hidden captions are restored via a contextual **`＋ <text>` chip row** in the action bar (delete/re-add the seed initials only — no inventing new zones). Modern-Slab's box auto-hides when its text is empty.
- **Action bar:** **Share** (Web Share files) · **Copy** (`ClipboardItem`) · **Download**; second row **Make another** (→ MemeGen) · **Make a comic** (→ Vault as Prop + Workshop). Flattened PNG carries the watermark and is pre-rendered (debounced) so Share/Copy fire within the user gesture.
- **Desktop CTA = non-tappable text** (`💻 Even better on desktop — visit panelhaus.app on a computer`). A tappable link would bounce a phone back here via PanelHaus's mobile-blocker, so it's intentionally not a link. Desktop conversion is passive (watermark + the user opening panelhaus.app on a real computer with the same wallet).
- **Admin tools** (`?admin=<secret>`): per-handoff calibrator, plus `&gallery=1` → a grid of all 56 templates to calibrate any of them (no handoff needed) → Copy JSON.

### Deltas from the plan-time decisions

- **Users CAN reposition** (move/rotate/resize), not just admin — handles show only on the selected caption (admin shows all).
- **Users get font presets + size**, not just text.
- **Delete/restore** uses **clean-preview + chip** (not on-image ghosts) — better WYSIWYG.
- Added the **admin gallery** + **all 56 template images** committed to `public/templates/`.
- Desktop CTA demoted to **non-tappable text**.

### Environment variables (all optional; `.env.example` updated)

- `VITE_PANELHAUS_API_BASE` (default `https://panelhaus.app`) — consume origin.
- `VITE_MEMEGEN_URL` (default `https://memegen.panelhaus.app`) — "make another meme".
- `VITE_MEME_ADMIN_SECRET` (default `panelshaq-admin` — **change for prod**) — admin gate.
- `COMIC_PRO2_DATA` — dev-only path override for the generator (not a runtime var).

### Cross-repo status

- **Comic-Pro2 guard: DONE** — mobile guard added to `src/pages/FromMemeHandoff.jsx` (forwards the live token to Shaq before consuming). Documented in `Comic-Pro2/documentation/changelog/954_MOBILE_HANDOFF_FORWARD_TO_PANEL_SHAQ.md`. Needs deploy on the Comic-Pro2 side.
- **MemeGen: nothing required.** The optional click-time mobile fast-path was deliberately not built (the guard is the robust single source of truth).

### Testing notes

- `?stub=1` (+ `&template=` / `&img=&w=&h=`) renders without a real token (dev only).
- **Copy / Share / Copy-JSON need a secure context** (HTTPS or `localhost`). On a plain-HTTP LAN IP they correctly **fall back to download** — not a bug.
- Real end-to-end needs the Comic-Pro2 guard deployed + a minted token (or the `&img=` override to preview alignment on a real generated image).
- Repo has no automated tests; `npm run lint` (`tsc --noEmit`) is the only gate.

---

## TL;DR

1. **The bug:** On mobile, MemeGen's "Edit in Panel Haus" hands off to the **desktop** site. The desktop page **consumes the single-use token immediately** (it's now dead), stores the project in the wrong origin's IndexedDB, then the mobile blocker bounces the phone to `shaq.panelhaus.app` with **no token and no data**. Every mobile tap is a silent credit-sink. **Decision: build the receiver on Panel Shaq (Option A).**

2. **The redirect fix is the linchpin (§3):** the token dies because **desktop consumes it before the mobile bounce**. Mandatory fix = a **mobile guard at the top of PanelHaus's `FromMemeHandoff` that forwards the live token to Shaq BEFORE consuming** (one repo, surgical), optionally plus a MemeGen fast-path. If this isn't done, nothing else matters — the token never reaches Shaq alive.

3. **The unlock — wallet identity:** Users connect a **wallet on MemeGen**, and the handoff payload already carries `originUser: "web3:0x<lowercased>"`. PanelHaus desktop keys accounts on that exact string, and **credits/tier/points/referrals follow the wallet across devices**. So **identity is solved for free** — Panel Shaq knows who the user is from the payload without implementing wallet-connect, and "switch to desktop" = "connect the same wallet on your computer; you're already you there."

4. **V1 scope (locked):** `/c/from-meme` receiver on Shaq → guest meme editor → faithful per-template text zones (seeded from PanelHaus) → tap-to-edit → watermark → Post to X / Download. Plus an admin calibrator (clipboard export) and a "Make it a comic →" lateral upsell. **No AI, no credits, no email, no reverse-handoff.** Desktop upsell = wallet messaging + watermark; they register on desktop.

5. **The device-gap truth:** You cannot deliver the desktop experience to a phone — `panelhaus.app` mobile-blocks phones back to Shaq. Mobile→desktop is inherently cross-device. The wallet makes the _identity_ transition seamless; we deliberately **do not** transport the meme artifact (the user shares it on mobile; if they want more, they start on desktop with their wallet).

---

## 1. The problem, verified precisely

Current mobile chain (confirmed in Comic-Pro2 code):

```
1. MemeGen (wallet signed in) → POST panelhaus.app/api/handoff/create (X-Handoff-Secret)
                              ← opaque token (Redis, 1h TTL, single-use GETDEL)
2. MemeGen redirects phone → panelhaus.app/c/from-meme?h=<token>     [always desktop host]
3. /c/from-meme is UNPROTECTED → FromMemeHandoff.jsx runs immediately:
      → POST /api/handoff/consume  ← TOKEN IS CONSUMED HERE (now dead)
      → builds project into panelhaus.app-origin IndexedDB
      → navigate('/app')
4. /app IS protected → ProtectedRoute sees narrowSide ≤ 500px → <MobileBlocker/>
5. 10s countdown → window.location.href = 'https://shaq.panelhaus.app'  [no ?h=, no data]
```

Two compounding failures:

- **Token is actively consumed by desktop before the bounce** — so even forwarding the token afterward yields HTTP 410. (Worse than "expires unused.")
- **Project is stranded in `panelhaus.app`-origin IndexedDB** on the phone — a different origin than `shaq.panelhaus.app`, unreadable by Shaq.

Wasted on every mobile tap: Vercel Blob write, PH token mint (Redis), and the BFL/Grok generation credit. MemeGen has **zero mobile detection** today (verified: no `isMobile`/`PANELSHAQ`/`targetHost` anywhere); it only knows the desktop host via `VITE_PANELHAUS_APP_URL`.

---

## 2. Verified system facts (the research)

### 2.1 The handoff contract (stable, Redis-backed)

- `POST panelhaus.app/api/handoff/create` — **server-to-server**, auth via `X-Handoff-Secret: HANDOFF_SHARED_SECRET`. Stores payload in **Upstash Redis** key `handoff:<token>`, **1h TTL**, returns opaque 32-byte base64url token. Only MemeGen calls this.
- `POST panelhaus.app/api/handoff/consume` — `{ token }` → atomic **GETDEL** (single-use) → returns payload. **No secret check.** `vercel.json` serves `Access-Control-Allow-Origin: *` on all `/api/*`, so **Panel Shaq can consume directly from the browser, cross-origin** — no serverless function, no shared secret, no Redis on the Shaq side.
- **Payload schema:**
  ```json
  {
    "v": 1,
    "memeImageUrl": "https://<vercel-blob>/handoff/<slug>.jpg",
    "memeImageDimensions": { "width": 1024, "height": 1024 },
    "memeImageMime": "image/jpeg",
    "templateId": "drake-hotline-bling",
    "templateLabel": "Drake Approve / Disapprove",
    "originUser": "web3:0x<lowercased-address>", // ← THE IDENTITY (null only in MemeGen password mode)
    "createdAt": "2026-06-02T..."
  }
  ```
- **Single-use caveat for mobile:** a refresh / back-button / second consume → 410. Shaq must **cache the payload to sessionStorage the instant consume succeeds** so the editor survives reloads.

### 2.2 Wallet identity — the through-line (THE KEY FINDING)

- **MemeGen** uses RainbowKit + wagmi + viem + SIWE, **Ethereum mainnet, MetaMask only**. `AUTH_MODE=wallet` (the live mode) **requires a wallet sign-in** (SIWE → HTTP-only JWT cookie `mg_wallet`) to generate a meme and to run the handoff. So in production the handoff payload's `originUser` is **reliably** `web3:0x<lowercased>`. (It's `null` only if MemeGen runs in legacy `AUTH_MODE=password`.)
- **PanelHaus desktop** keys every account on `user_id = web3:0x<lowercased>` (verified `authStore.js:154`). The address is always lowercased on both sides, so **the same wallet deterministically resolves to the same account string across all three apps**.
- **What follows the wallet, server-side (Vercel Postgres + Upstash Redis), across any device:**
  | Data | Follows wallet? |
  |---|---|
  | Credits (`user_credits`) | **YES** |
  | Tier / Stripe subscription | **YES** |
  | Points, referrals | **YES** |
  | Redis user registry/metadata | **YES** |
  | **Projects / comics / memes** | **NO** — local IndexedDB/localStorage only |
- **NFT gating is currently OFF on PanelHaus** (`ENABLE_NFT_GATING=false`) → any connected wallet gets full `/app` access; email accounts bypass NFT entirely. NFT holding is a **toggleable access gate only — no credit/tier bonus is wired** anywhere. MemeGen runs a _soft_ NFT gate (`NFT_GATE_ALLOW_NON_HOLDERS=true`): non-holders sign in but downgraded.
- **Chain note (Decision G):** MemeGen is **EVM-only** (DeadFellaz / DeadFrenz). PanelHaus also supports Solana (CyberKongz / Neo Tokyo collections configured — look like placeholders), but since the handoff identity is always an EVM address, **we ignore Solana**. If NFT perks ever become real, collections must be aligned across apps.

### 2.3 Credit economies — separate, and intentionally untouched (Decision D)

- **PanelHaus:** Vercel Postgres `user_credits` keyed by wallet/email. 30 free lifetime credits; image gen 1–4 credits; Stripe tiers + boosters.
- **MemeGen:** its **own** Postgres credits (separate DB/project), charged per generation.
- **Panel Shaq:** today has Supabase anon metering for its Gemini features — **but the meme flow uses none of it.** Because the meme flow has no AI (Decision C), **Shaq needs no credits and touches no credit system** (Decision D). The three economies stay separate and unmodified.

### 2.4 Two text-positioning systems — seed from PanelHaus (Decision A)

- **PanelHaus** (`memeTemplates.js`, **56 templates**): text as **absolute pixels** in each template's `customDimension`, rendered through the Konva canvas. Styling via `customStyle` + font presets (`memeFontPresets.js`). **This is the seed source** — convert pixels → normalized (divide by `customDimension`).
- **MemeGen** (`templates.js`, **53 templates**): text as **normalized 0–1** coords, rendered by `TextZonesOverlay.jsx` — a **pure DOM overlay** (no canvas). Font size **derived from zone height** (`clamp(10px, zoneHeight*45 cqw, 64px)`, needs `container-type: inline-size`), 8-direction text-shadow outline, allCaps/center baked in. **This is the runtime model to port** (the rendering technique), even though the seed coordinates come from PanelHaus.

The handoff sends `templateId` (MemeGen's id namespace). PanelHaus's `memeTemplates.js` uses the same ids for handoff to work on desktop, so the PanelHaus-sourced, normalized zones key cleanly on the handoff's `templateId`. Unknown templates → no pre-positioned zones (user adds their own), mirroring desktop's fallback.

### 2.5 PanelHaus guest mode (the pattern to mirror, mobile-shaped)

- Guest mode = derived boolean `!isConnected && project.fromMemeHandoff`; persisted across refresh via `localStorage.panelhaus_guest_session='true'` + IndexedDB autosave.
- Allowed for guests: canvas + watermark, text editing, font bar, Share (X) / Copy / Download (watermarked), "make another." Hidden: toolbars, save/load/export menu, undo/redo, AI caption writer, profile/subscription, page navigator.
- Watermark: `getMemeWatermarkBubbles()` burns "made with" / "panelhaus.app" bottom-right, vertical, locked.

### 2.6 Panel Shaq today (the constraints)

- **No router** — tab-switch SPA (`activeTab` in `App.tsx`). `vercel.json` rewrites every non-`/api` path to `index.html`, so `/c/from-meme?h=…` _will_ load the app; we add early `window.location.pathname` detection to branch into the receiver before the normal app boots.
- **No web3** (no wagmi/wallet libs) — and V1 needs none (identity is read from the payload).
- **Auth = `EmailGate`** (hosted/byok). The meme guest flow **bypasses** it entirely.
- **Has** a full text/bubble editor (`EditorScreen`), bake/flatten (`finalNaturalRender`), share (`ShareScreen`), export, and a `BottomSheet` primitive — reusable building blocks.

---

## 3. ⚠ Decision 1 — Redirect fix (preserve the token to Shaq) — MANDATORY, DO NOT LOSE

> **This is the linchpin of the entire feature.** The token currently dies because desktop **consumes it before** the mobile bounce. The fix must intercept **before consume**. Without it, the token never reaches Shaq alive and the receiver has nothing to consume.

### 3.1 PanelHaus-side guard (MANDATORY — the real fix, one repo)

At the very top of `Comic-Pro2/src/pages/FromMemeHandoff.jsx`, **before** the consume effect runs, add a mobile check (mirror `MobileBlocker`'s `Math.min(window.innerWidth, window.innerHeight) <= 500`). If mobile:

```js
// DO NOT consume. Forward the still-live token to Shaq.
window.location.replace(
  `https://shaq.panelhaus.app/c/from-meme?h=${encodeURIComponent(token)}`,
);
```

Detection happens on the real device at the real landing, the token stays alive, and it works regardless of what MemeGen does. Surgical, lives entirely in Comic-Pro2, and is the line of defense at the exact spot the token currently dies.

### 3.2 MemeGen fast-path (OPTIONAL optimization)

In MemeGen's `handleEditInPanelHaus` (`GenerateModal.jsx`), detect mobile at click time and build the redirect straight to `shaq.panelhaus.app/c/from-meme?h=<token>`, skipping the desktop hop. Add `VITE_PANELSHAQ_APP_URL` + an `isMobile()` check. Cleaner UX (no extra hop), but relies on MemeGen's detection being right, so it's an add-on to 3.1, not a replacement.

> The token is always minted on `panelhaus.app` Redis (unchanged). Only the redirect host changes. Shaq consumes cross-origin (no secret, CORS `*`) and immediately caches the payload (sessionStorage) for refresh-safety.

---

## 4. Decision 2 — Text zones + admin positioning tool

### 4.1 Runtime model: port MemeGen's normalized overlay

Port `TextZonesOverlay`'s technique into Panel Shaq (TSX): normalized 0–1 zones rendered as `%`-positioned divs over the full-bleed meme image, font size from the `cqw`/zone-height formula, 8-dir shadow outline, tap-to-edit (native keyboard). DOM overlay — no Konva.

### 4.2 Seed data — from PanelHaus (Decision A)

Convert the 56 `memeTemplates.js` `textBubbles` absolute-pixel coords → normalized (divide by `customDimension` width/height). Deterministic; placements match the desktop experience precisely. Ship as a committed TS data file keyed by `templateId`. Unknown templates → no zones.

### 4.3 Admin calibration tool — the easy path (Decision B)

A mobile calibration mode mirroring MemeGen's embedded editor: render the template/meme image, overlay editable zones with move/rotate/resize handles, round to 3dp (coords) / 1dp (rotation). **Persistence = committed seed file** (source of truth). The tool **exports the zone array as JSON to the clipboard** (a "Copy JSON" button) for manual paste back into the seed file. **No Supabase override layer** (kept easy). **Access = a simple admin gate** (client-side secret via URL param or `localStorage` flag) so it can be opened on a real phone in production, but is invisible to normal users. Upgrade path (only if needed later): move overrides into a Supabase table read at runtime.

---

## 5. Decision 3 — Mobile guest mode

### 5.1 Flow

Arrive at `shaq.panelhaus.app/c/from-meme?h=<token>` → **bypass EmailGate** (set a `panelshaq_guest` flag) → consume token (cache payload to sessionStorage) → render the meme full-bleed with pre-positioned text zones → tap a zone, type; optional drag → sticky bottom bar:

- **Post to X** (primary)
- **Download** (watermarked `panelhaus.app`)
- **Make it a comic →** (lateral upsell into Shaq's own flow)
- **Open full studio on desktop** (informational CTA → "connect your wallet at panelhaus.app on a computer"; no asset transport — see §6)

A small guest banner; no tabs, no pro chrome, **no AI button** (Decision C). This is PanelHaus guest mode, mobile-shaped.

### 5.2 The gate principle

Finishing + sharing a meme needs **no registration, no AI, no credits**. The flow is fully free and self-contained. The only "upsell" surfaces are the lateral "Make it a comic" and the informational desktop CTA — neither blocks the meme.

---

## 6. Decision 4 — Identity & the upsell (creditless, courier-less)

### 6.1 The reframe: wallet is the account; email is dropped

- **Registering email on mobile is useless as identity** — confirmed. The **wallet is the cross-app account.** Shaq reads `originUser: web3:0x…` from the payload and can display/attribute the user **without implementing wallet-connect** in V1.
- Email is **not captured** in the meme flow (Decision F) — no AI gate, no credits, no courier means it has no job here.

### 6.2 Desktop upsell — identity is already seamless, no infra needed (Decision E)

Because PanelHaus keys accounts on the same wallet and NFT gating is off, the upsell is pure messaging:

> "Want the full studio? Open `panelhaus.app` on your computer and connect the same wallet — or just register there."

We deliberately **do not** build the reverse-handoff / email courier. The meme is finished and shared on mobile; a user who wants more goes to desktop and starts there with their wallet (identity, credits, tier all already tied to it). The device-gap (can't run desktop on a phone) is acknowledged and accepted — the transition is the user physically moving to a computer, which is fine for the "I want to do more" intent.

### 6.3 No credits anywhere on Shaq (Decision D)

The meme flow has no AI, so there is nothing to meter. Shaq's existing Supabase anon metering (for its own Gemini comic features) is **untouched** and irrelevant to the meme flow. PanelHaus and MemeGen credit economies remain separate and unmodified.

### 6.4 Keeping the user on mobile later (retention)

- **PWA install** — Shaq is already a PWA; an "Add to home screen" nudge after a successful meme is the strongest mobile retention hook.
- **Lateral upsell "Make it a comic"** — Shaq's actual product; the natural next step for a mobile-native, post-now audience. (This path _does_ use Shaq's Gemini pipeline and its existing metering — but that's Shaq's normal comic flow, separate from the creditless meme flow.)
- Wallet-recognized return + notifications are possible later but **out of V1 scope** (no email captured, no wallet-connect on Shaq yet).

---

## 7. Phasing (post-decisions)

**V1 — the whole feature, slim:**

- ⚠ PanelHaus-side mobile guard in `FromMemeHandoff` (§3.1) — forward token, don't consume. **Mandatory.**
- Panel Shaq `/c/from-meme` receiver: path detection (no router), cross-origin consume + sessionStorage cache, guest mode bypassing EmailGate.
- Mobile meme editor: PanelHaus-seeded normalized text-zone overlay, tap-to-edit, watermark, Post to X / Download.
- Read `originUser` for attribution/analytics + the "connect this wallet on desktop" CTA.
- Admin calibrator (clipboard export, admin-gated; §4.3).
- "Make it a comic →" entry into Shaq's existing flow.

**Deferred / explicitly out of scope for now:** AI captions (C), any credits (D), email courier + reverse-handoff (E/F), Supabase zone-override layer (B upgrade), Shaq wallet-connect, Solana (G).

**Possible later (not committed):** MemeGen mobile fast-path (§3.2); Supabase live zone overrides; PWA install nudge; wallet-recognized return; marketing email capture.

---

## 8. Cross-repo change inventory (V1)

| Repo                       | V1 changes                                                                                                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Comic-Pro2 (PanelHaus)** | ⚠ Mobile guard in `FromMemeHandoff.jsx` (forward token before consume). Nothing else.                                                                                                                                                                                                 |
| **MemeGen**                | None required (the PH guard covers it). Optional later: mobile fast-path + `VITE_PANELSHAQ_APP_URL`.                                                                                                                                                                                  |
| **Panel Shaq (this repo)** | `/c/from-meme` receiver, guest mode, normalized text-zone overlay + PanelHaus-seeded registry, admin calibrator (clipboard export), watermark, share/download, "make a comic" CTA, "open on desktop" informational CTA, read `originUser`. No backend, no web3, no credits, no email. |

---

## 9. Resolved decisions (record — kept, not removed)

- **A — Text-zone seed source → PanelHaus.** Convert px→normalized for exact desktop-fidelity placement.
- **B — Calibration persistence & access → easy path.** Committed seed file + admin-gated in-app calibrator that exports JSON to clipboard. No Supabase override layer for V1.
- **C — AI in V1? → No.** AI captions kept separate / out of scope. Meme flow is text-overlay only.
- **D — Credit economy → none on Shaq.** PanelHaus and MemeGen credits are separate ecosystems; the creditless meme flow needs neither.
- **E — Desktop courier? → No.** No reverse-handoff/email link. Users switch to desktop and connect wallet / register there.
- **F — Email capture in the meme flow? → No.** Nothing for it to do without AI/credits/courier.
- **G — Solana → ignore.** MemeGen is EVM-only; handoff identity is always EVM.

---

## 10. Risks

- **Single-use token on mobile** — refresh/back → 410. Mitigation: cache payload to sessionStorage immediately on consume.
- **The redirect guard is the single point of failure** — if §3.1 isn't shipped (or regresses), the token dies on desktop and the whole flow breaks silently. Keep it prominent and test it explicitly on a real phone.
- **Two text-rendering systems** (PanelHaus pixels vs the normalized mobile overlay) can drift as templates change. Mitigation: seed once from PanelHaus; only revisit if placements drift noticeably.
- **`originUser` null** if MemeGen ever runs `AUTH_MODE=password` — Shaq must handle the no-wallet guest gracefully (still let them finish the meme; just no identity/desktop-continuity messaging).
- **No asset transport to desktop (by design)** — a user who made a meme on mobile and wants _that exact meme_ on desktop can't bring it automatically. Accepted trade-off; revisit only if users ask.
- **Aspirational docs** — the `Comic-Pro2` "shared Supabase transfers" bridge is **not built**; don't assume it exists when planning.

---

## 11. Next step

Strategy is locked. Enter plan mode (extended thinking) to design V1 in detail:

1. The PanelHaus-side mobile guard (§3.1) — exact placement in `FromMemeHandoff` before consume.
2. The Shaq `/c/from-meme` receiver in a routing-less SPA (early `pathname` branch, cross-origin consume, sessionStorage cache, guest flag, EmailGate bypass).
3. The guest meme editor (full-bleed image + normalized text-zone overlay ported from `TextZonesOverlay`, tap-to-edit, watermark, share/download).
4. The PanelHaus→normalized zone seed registry + the admin calibrator (clipboard export, admin gate).
5. The "make it a comic" and "open on desktop" CTAs.
