# Changelog

## August 14, 2026 — Creator Card polish (first-run fixes)

- **Joining reveals your card immediately.** It used to sit on "Join the Creator Program" for about ten seconds after you'd already joined, so the button read as having done nothing. Two expensive calls were running back to back: the join itself, and then the first card load — which is the single slowest request in the feature, because Panel Haus verifies and *records* every step you'd already earned, one at a time. The card now appears the moment the join returns, which is accurate rather than optimistic (you are a member server-side at that point), and the backfilled points arrive a beat later and announce themselves. Your ink balance in the nav also updates straight away instead of waiting for something else to refresh it.
- **Your shared card keeps its typefaces.** Exporting the card walks the page's stylesheets to find the fonts and embed them into the image. A stylesheet fetched without CORS is unreadable to that process — and the error is swallowed, so the only symptom was a card quietly exported in a fallback system font. The Creator Card's font request now asks for it in CORS mode. Console warnings for the app's *other* font sheets (Material Symbols, the comic display faces) are expected and deliberate: the card doesn't use them, and embedding them would bloat every exported PNG for nothing.
- **Setup note for local development:** the Discord claim's return address is a **Panel Haus** setting, not a mobile one — `PUBLIC_MOBILE_ORIGIN` in the Panel Haus repo. Left unset it defaults to the production mobile app, so a local claim completes and then lands you on production mid-flow. Production needs nothing; local needs `http://localhost:3002`.

## August 13, 2026 — The Creator Program comes to mobile

- **You can now join the Creator Program, claim your Creator Card and earn points from your phone.** Settings → Account → **Creator Card** opens the whole thing: the card itself (steel → cyan → animated gold as it levels), the seven asks, your points, and the mint wallet. It is the same program as panelhaus.app, not a copy — same account, same points, same card. Claim on your laptop and it is already claimed here; earn a point here and it is on the web.
- **We own no part of the economy, deliberately.** Point values, what counts as done, and the 100-point mint threshold all live in Panel Haus and are read from it. Six small proxy routes forward your sign-in and pass Panel Haus's answer back untouched. Nothing on this side can award a point, so the two apps cannot drift apart — and because every ask is recorded against your account id under a uniqueness rule, an ask completed on the web is physically un-re-awardable here, and vice versa.
- **Steps you already finished tick themselves the moment you open the card.** Panel Haus checks its own records before answering — so if you have ever generated art, "Make something" pays out on your first open; two real referrals tick "Refer two friends" without you claiming anything. Notably, generating an image *on mobile* has always satisfied "Make something"; there was simply no card here to show it.
- **Claiming is Discord, and it now comes back to mobile.** Tapping "Claim your card" runs the Discord sign-in and returns you here with the card open. That needed a change on the Panel Haus side: its OAuth callback only knew two destinations, both on the web app, so a mobile claimer was bounced to `m.panelhaus.app` with the query string stripped — the claim landed but you never saw it happen. There is a third destination now.
- **The card you are dealt is the card the web deals you.** The scene is assigned by hashing your account id over a pool of 16, so it has to be the *same* id on both sides. Mobile never sees that id, and guessing it from your email would deal wallet-first accounts a different card — so Panel Haus now ships the value it hashes. The 16 scenes and the Panel Haus mark are bundled here rather than hot-linked, because sharing your card renders it to an image and a cross-origin picture cannot be baked in.
- **"Post your card" uses your phone's own share sheet.** Desktop copies the image to the clipboard and opens the X composer, crediting you when the composer opens. Neither half is reliable on a phone — image-to-clipboard barely works in mobile Safari and Android webviews, and a blocked popup makes that credit either impossible or free. So the card renders to a PNG and goes to the native sheet, and the points land only when a share actually completes. Cancel and you earn nothing; if your browser can only download, a **Post on X** button appears and credits when you take it there.
- **At 100 points you can lock in the wallet your Smudgie mints to.** Paste, review, confirm. The address is shown **in full at every step and never shortened**, because it cannot be changed afterwards without a support ticket and the automatic format check is partial — it catches a typo in a checksummed address and misses one in an all-lowercase address, so reading it back is the real safeguard. Reaching 100 for the first time gets a moment of its own.
- **Also: a reminder email before the mint, and your own image on the card.** The framing slider only ever crops further in — the scenes have a wordmark baked into the art and the default crop is what pushes it out of frame.
- **Your uploaded card image stays on the device you uploaded it from.** Browser storage is per-site, so `m.panelhaus.app` and `www.panelhaus.app` cannot share it — this is the one thing about the card that does not sync, and it is a known limit rather than a bug. Points, asks, tier, Discord and your mint wallet all live on the server and follow your account everywhere.
- **Card uploads now work inside wallet browsers.** We deep-link people into MetaMask's in-app browser to sign in, and those stripped-down browsers often cannot decode an image the usual way — a perfectly good photo would come back as "unsupported format". The upload now falls back through three decoders, and a photo the phone genuinely cannot hand over (still in the cloud, or moved after you picked it) says so instead of blaming the file.
- **Fixed: your plan read "Founder Pass" in Settings.** Panel Haus renamed that plan to **Creator Pass**; mobile was showing a third name for it, so one account looked like a different plan depending on which app you opened.
- Full build notes, endpoint contracts and the verbatim copy are in `documents/CREATOR_PROGRAM_BUILD_PLAN.md`. Not ported: the `/creators` marketing page.

## August 13, 2026 — Smudge polish (single page, reliable turns, visible panel delete)

- **Smudge is now the default landing screen.** New users open straight into the chat; the manual tabs stay one tap away. Returning users keep whatever tab they were last on (the choice is remembered per device).
- **Smudge owns one page, and rebuilding replaces it.** Each build used to append a brand-new page, so retrying stacked duplicates and the "Draw N panels" count could disagree with the preview. Smudge now tracks its page (persisted, so it survives a tab switch) and a rebuild replaces that page's panels only — it never touches your manually-made pages. The page preview, the Draw button, and the actual draw all read that one page, so the number is always honest.
- **Your comic no longer vanishes when you leave the tab.** The conversation state lives in the screen and resets on a tab switch; now the committed page (with a "here's your page, tell me what to change") shows on return instead of a blank greeting, so the work is never lost from view.
- **Turns finish reliably.** A build sometimes reported "I couldn't finish" even though the page was fine: the model built on round one and then stumbled on a fragile second round. Smudge now does a single tool round (the draft or edit is the deliverable) and only says "couldn't finish" when genuinely nothing happened.
- **Open in the editor.** Once you have a page, a button jumps straight to the full editor to finish it (bubbles, layout, export).
- **Director: the delete-panel button is visible again, and always warns.** On a drawn panel the trash icon was pinned to the same corner as the Upload/Copy/Download toolbar and was painted over by it; it is now the fourth icon in that toolbar (with a standalone trash for undrawn panels). Deleting any panel now asks for confirmation first ("its generated image will be gone for good"), where before it only warned on drawn panels.

## August 12, 2026 — Smudge: build a comic by chatting (v1)

- **A new first tab, Smudge, builds comics through conversation.** Tell Smudge what you want in a sentence; it plans the page in plain words, you tap **Keep it**, and the panels draw themselves into the thread one at a time. Ask "make panel 2 at night" and only that panel redraws. The four manual tabs (Workshop → Director → Layout → Editor) are unchanged and stay the manual path; Smudge writes into the same panels, pages, and vault, so anything it makes is still editable by hand.
- **Draft-first, and nothing is permanent.** A built page arrives as a draft with **Keep it / Try again**; only Keep it commits it. Every agent action gets a one-tap **Undo that** (the app had no undo before this at all). Characters you mention can be saved to your vault so they stay consistent.
- **It charges ink honestly.** A Smudge turn costs ink once, no matter how many internal steps it takes (idempotent reserve keyed on the turn), and drawing bills image ink separately per panel, exactly like manual generation. Signed-out users get the sign-in prompt; BYOK bypasses ink; out-of-ink opens the Buy sheet. New env: `INK_COST_AGENT_TURN` (default 1, finalized with the desktop repricing) and `MOBILE_AGENT_GEMINI_MODEL`.
- **Hold-to-talk** input where the browser supports it. Built as the mobile port of Panel Haus desktop's Smudge; full plan + reasoning in `documents/MOBILE_AGENT_HANDOFF.md`.

## July 28, 2026 — The FCFS ship-claim sheet is retired

- **The sheet no longer fires.** `SHIP_CLAIM_ENABLED = false` in `src/services/shipClaim.ts` is the whole change. It offered "a first-come-first-served spot on the Smudgies drop whitelist", confirmed "in claim order" — but those claims land in a Redis list that decides nothing. The mint lists are built from Panel Haus's Postgres `point_transactions`: who completed which Creator Card asks, and when, ranked by qualification time. So two live systems were promising the SAME whitelist under two different orderings, and only one of them gets minted. Panel Haus retired its half first (Comic-Pro2 changelog `1342`); this is the other half, so the promise isn't still being made on mobile after being withdrawn on desktop.
- **The guard sits in `fireShipClaimOnce`, not in `markShipped`.** `markShipped()` does two jobs — it emits the `share_completed` analytics event AND arms the claim. Guarding the caller would have silently killed ship tracking across every surface. It also returns above the flag writes and above the per-account `fetch`, so a retired sheet burns nobody's one-shot flag and costs no network call. `forceShipClaim()` still works (dev-only, dispatches to listeners directly), so the sheet stays testable.
- **`SHIP_CLAIM_ENABLED` is annotated `: boolean` on purpose.** Left to infer, TypeScript types it as the literal `false`, narrows the guard to always-taken, and treats the rest of `fireShipClaimOnce` as unreachable — greyed out in editors, and an outright error under `allowUnreachableCode: false`. The widened type keeps the body live so re-enabling is genuinely one word.
- **`api/creator-application.ts` is deliberately NOT disabled**, and nothing stored was deleted. The endpoint and its Redis keys (`creator:applications`, `creator:application:<identity>`) are shared byte-for-byte with Panel Haus, whose list/export/backup scripts still read them. Killing the endpoint would have broken tooling in the other repo.
- **Worth knowing about that shared list:** it held **581 rows of which only 22 are real**. 557 were injected by the 2026-07-19/21 referral farm — 522 submitted in a single day, all with a byte-identical `goal` string and the same four answers, from 522 unique wallets. The farm hit Panel Haus **web** and never touched mobile: all 6 mobile-sourced rows are genuine. PH's scripts now filter it by default (Comic-Pro2 changelog `1343`).
- **If this ever comes back, rewrite the copy first.** `ShipClaimSheet.tsx` still reads "first-come-first-served spot", "Your FCFS whitelist unlocks", "Claim my FCFS spot". That wording *is* the conflicting promise — flipping the flag without changing it re-creates the problem. Keeping it as pure lead capture (same questions, no spot promise) is the middle option.

## July 21, 2026 — Product analytics joins MemeGen's PostHog project

- **One shared PostHog project instead of a second one.** Panel Haus desktop isn't on PostHog at all (it uses Google Analytics), so the only app we overlap with is MemeGen — and specifically its internal build at `memes.panelhaus.app`, which shares our Clerk account and our ink balance. Sharing the project keeps that one genuinely-linked journey intact (a meme handed off to mobile, ink bought on one surface and spent on the other) and costs nothing, since PostHog's free plan allows only one project per organization anyway. The branded MemeGen builds (`dfz`, `dumpstr`, `coolcats`) don't use Clerk, so their users were never going to overlap with ours; they stay separated by the `whitelabel` property they already carry.
- **Signed-in users are now identified as `clerk:<user id>`**, matching MemeGen's format exactly. Without this the same human counted as two different people. It also removes a real conflict: PostHog's cookie is shared across `*.panelhaus.app`, so someone identified in MemeGen already arrives here carrying that id, and PostHog refuses to merge two identified ids.
- **Every event now carries `app: "panel_shaq"` plus an `env` tag**, mirroring MemeGen's `app: "memegen"`, so either app's data can be isolated with one filter. Super properties live in per-origin storage, so the two apps' tags can't bleed into each other.
- **Autocapture and session recording are off.** One project means one shared event and recording allowance, and recordings are billed separately; our explicit events carry the signal without the click-by-click firehose. MemeGen disables both for the same reason.
- **New `checkout_failed` event** closes a blind spot on both rails: a checkout that never starts (signed out, network down, crypto disabled, rate limited, or a bad upstream response) used to look identical to nobody trying to buy, since `checkout_started` simply dropped to zero. It carries the pack, the method, the HTTP status and a stable reason code, never the upstream's raw error text. All nine failure paths across the card and crypto flows now report one.
- Nothing was captured before this: the key was never configured, so PostHog was a no-op in production. Setting `VITE_POSTHOG_KEY` to MemeGen's project key (and redeploying) turns on the existing events, including the new `checkout_started {method: card|crypto}` split.

## July 20, 2026 — Pay for ink with crypto

- **Boosters can now be bought with crypto**, not just card. When Panel Haus reports crypto is available, the Buy Ink sheet shows a **Card / Crypto** toggle; picking Crypto sends you to an OxaPay hosted page instead of Stripe. Same packs, same prices (Panel Haus reads the amount live from Stripe for both rails, so they can never disagree), same shared ink balance. This is the mobile half of Panel Haus changelog `1275`.
- **The toggle is server-driven.** It appears only when PH's balance payload says `cryptoEnabled` — the flag already arrived through our passthrough proxy and was simply being discarded. A crypto-off or half-configured deploy shows no button at all rather than a dead one.
- **The return now waits for the chain.** Card payments confirm via a Stripe webhook in seconds; crypto settles on-chain and routinely takes 1-3 minutes, so the old 3s/7s refresh would have left buyers staring at an unchanged balance. The crypto return polls on an escalating ~3 minute schedule, updates the moment the ink actually lands, and otherwise ends on an honest "still confirming on-chain, your ink will land automatically" rather than an endless spinner. Card timing is untouched.
- This repo holds **no payment logic**: no OxaPay keys, no prices, no webhook. `api/crypto-create-invoice` is a byte-identical twin of the existing card proxy with one different upstream path. The OxaPay callback is pinned to Panel Haus by design (a webhook here would take money and never credit it). Spec: `documents/PANEL_SHAQ_CRYPTO_CHECKOUT_HANDOFF.md`.

## July 14, 2026 — GTD claims fail loudly instead of vanishing

- **A claim we can't store is no longer reported as success.** The claim endpoint used to return `{ok:true}` when Upstash was unconfigured or a write threw, so the sheet said "You're on the list." and nothing was saved. Production shipped without the `UPSTASH_*` vars and silently dropped every claim for about two hours before anyone could tell. The write path now **fails closed** (`503 STORAGE_UNAVAILABLE` / `STORAGE_FAILED`) and returns `stored: true` only on a confirmed write. The **GET** "already applied?" gate still fails open on purpose: re-showing the sheet to someone who already applied is a smaller harm than locking a real creator out during an outage.
- **A failed claim no longer costs the creator their invite.** The client wrote its "applied" flag *before* the request and ignored the response, so a dropped write lost the lead twice — nothing stored, and the sheet suppressed forever on that browser. It now writes the flag only after the server confirms `stored: true`, clears the shown-flag on failure so the next ship re-opens the sheet, and keeps the user on the form with their answers intact behind a **"Try again"** button. New `ship_claim_failed` analytics event carries the status and error code.
- **Everyone burned during the outage gets one fresh shot.** The one-shot localStorage keys are now `panelshaq_ship_claim_shown_v2` / `_applied_v2`; the v1 keys are abandoned rather than migrated, so anyone whose claim vanished is re-invited on their next ship. Anyone who genuinely applied is re-suppressed by the server GET, at the cost of one extra request.
- Mobile half of Panel Haus desktop's changelog `1240` (commit `6c57a7e2`), which found the same three defects in the shared design.

## July 14, 2026 — GTD ship-claim (export/share → whitelist)

- **Ship something, claim a GTD spot.** After a **signed-in** user's first export or share (comic pages, single panels, GIF, or `.comic` file), a one-shot bottom sheet invites them to claim a **guaranteed spot on the Smudgies drop whitelist** — the mobile port of Panel Haus desktop's creator-invite (Comic-Pro2 changelogs `1139`/`1140`/`1141`). Same 4-question application + optional goal / X handle / ETH address, same copy, and it registers into the **same shared Upstash store** as desktop (one dedupe namespace, one admin list). Claiming grants nothing immediately (auto-approved whitelist spot; the drop mints at 0.03 ETH) and costs zero ink. The invite is **signed-in only**: a signed-out ship is a silent no-op that doesn't burn the one shot, and the Clerk-free `/c/from-meme` receiver never shows it. The endpoint (`api/creator-application`) mirrors desktop's shared contract, with per-IP rate limiting and server-side validation (fixing desktop CR `1140` finding #5 in our copy).
- **One "ship" concept.** All export/share surfaces now call `markShipped()` (`src/services/shipClaim.ts`), which emits the existing `share_completed` analytics event and arms the claim. Three previously-untracked surfaces (`.comic` export, GIF download, GIF share) now get analytics; the GIF share also gained a missing cancel/error catch (a cancelled share sheet was an unhandled rejection).
- Signed-in identity (email/wallet) flows in via `<ShipIdentityBridge/>` for the cross-app dedupe key (`email:`/`web3:`, matching PH's user_id convention) and wallet prefill. New env: `UPSTASH_REDIS_REST_URL`/`_TOKEN` (same values as Panel Haus). Build doc: `documents/GTD_SHIP_CLAIM_BUILD_PLAN.md`.

## July 4, 2026 — Two new meme templates (internal build)

- **`vince-mcmahon` ("Escalating Reaction").** Added the 3-caption escalating-reaction meme (700×700) with match keys `i made a meme` / `i made a comic` / `i made a whole series`, hand-calibrated onto the three panels.
- **`smudge-stage` ("Standing Ovation").** Added the 2-caption meme (700×700) with match keys `shipped it` / `on the first try`, hand-calibrated top and bottom.
- Both are `brands:["panelhaus"]` in MemeGen (the internal build, not CyberKongz-scoped like the July 3 pair). Ported from Comic-Pro2 via the generator with match-key text kept byte-exact so the handoff swap lands; images in `public/templates/`. Registry is now at parity with Comic-Pro2 (76 templates).

## July 3, 2026 — CyberKongz-only meme templates (handoff)

- **`hangover-casino` ("Casino Win").** Added the CyberKongz-exclusive casino-table meme (700×625, top/bottom full-width zones) with match keys `they said it was gambling` / `it's a strategy engine`. Mobile half of MemeGen changelog `131`.
- **`empire-state-building` ("Plant the Flag").** Added the CyberKongz-exclusive black-flag rooftop meme (673×700), captions rotated ~20.5° onto the flag with match keys `sold at the bottom` / `planted the flag at the top`, hand-calibrated onto the flag. Mobile half of MemeGen changelog `132`.
- Both are `brands:["cyberkongz"]` scoped in MemeGen, so no `BRAND_EXCLUSIVE_ZONES` wiring is needed (the whole template only appears in the CyberKongz build); ported from Comic-Pro2 via the generator with match-key text kept byte-exact so the handoff swap lands. Images in `public/templates/`.

## July 2, 2026 — Patrick to-do-list steps 2 & 3 + new meme templates

- **`patrick-to-do-list` now renders all three steps.** Added `zone-2` and `zone-3` to the template in `src/data/memeTextZones.ts` with default text matching the cross-repo handoff **match keys** exactly (`step 2: stay dead` / `step 3: stay dead`), then hand-calibrated all three zones onto the paper's lines. CyberKongz handoffs swap in `step 2: ???` / `step 3: profit`; every other brand sends a blank swap so those two bubbles **hide** (only step 1 shows). This is the mobile half of MemeGen changelog `126` — the desktop half already lives in Comic-Pro2 `memeTemplates.js`. `zone-1`'s existing calibration was preserved (not regenerated).
- **New meme templates.** Added and calibrated `monster-house-disappointed`, `kongz-trashbin-held`, `kongz-trashbin-crew`, `kongz-dumpster`, plus an earlier batch (`press-buttons`, `trump-ufc-gift`, `pablo-escobar-waiting`, `leonardo-dicaprio-cheers`, `a-scientist-myself`, `leonardo-dicaprio-pointing`, `black-girl-wat`, `look-at-this`) — ported from MemeGen via the generator, images in `public/templates/`. Caption **positions** are calibrated locally; the branded **text** arrives per-brand on handoff.

## June 23, 2026 — Handoff applies per-brand caption overrides

- **Handed-off meme captions are now brand-correct.** MemeGen's internal Panel Haus build shows neutral meme captions, but handing off used to bring back our **branded** defaults (the captions live in `src/data/memeTextZones.ts`, generated from Comic-Pro2). The handoff payload now optionally carries per-brand caption overrides (`captions: { match, text }[]`), and `MemeEditor` swaps a zone's default text for the override when its text matches (normalized) — **text only, positions/styles untouched**. When MemeGen sends nothing (e.g. the **DeadFellaz** build), the zones keep their branded defaults, so DeadFellaz handoffs are unaffected.
- **Match by existing text, not slot order.** MemeGen's zone order and ours have drifted, so the override is keyed on the zone's current text (the reliable join); `norm` also strips whitespace-before-punctuation so minor formatting differences still match.
- Replaces the earlier in-place neutralization (reverted, because that single shared copy also de-branded DeadFellaz). Pairs with MemeGen changelog `081` (the send side) + Comic-Pro2 `1082` (desktop).

- **Export is now one place.** Removed the old EXPORT and HISTORY cards from the comic Editor (PNG/share/GIF-mode buttons + recent-exports list) — all of it already lives on the first-class **Export** tab. The Editor keeps its **Export / Next** button to advance there.
- **GIF templates moved into the GIF editor.** The broken pre-made "quick render" GIF mode buttons are gone from both the Editor and the Export tab. Animation templates (Story Flow / Cinematic / Dramatic / Slideshow) now live **inside the GIF editor** where they apply live with a WYSIWYG preview; surfaced under a **Template** label. The Export tab keeps the working **Open GIF Editor** entry.
- **Smarter scroll on navigation.** Advancing a step in the creation flow (Workshop → Director → Layout → Editor → Export) now **snaps to the top**; navigating via the bottom nav / menu / swipe **restores where you last were** on that tab (per-tab scroll memory).
- **Critique Corner is now Smudge.** The AI critique speaks in **Smudge's voice** (tired, dry, self-deprecating sponge), and **Smudge appears in the Critique Corner** — in the intro and as the byline on his notes. Section headings stay as-is so the output still parses.
- **Bubble text-settings toolbar floats above everything.** The per-bubble editing toolbar was getting clipped inside the panel: it was `position: fixed`, but a transformed panel/bubble ancestor re-trapped it in the panel's `overflow: hidden` box. It now renders through a portal to `<body>`, so it always floats above the page (and the fullscreen editor).

## June 16, 2026 — Product analytics (PostHog)

- **Added PostHog alongside Vercel Analytics**, both fed from one wrapper (`src/services/analytics.ts`): every `track()` event now fans out to both. Gated on `VITE_POSTHOG_KEY`; unset and it's a no-op (Vercel still runs), so dev without the key behaves exactly as before.
- **Identified analytics for case studies.** Signed-in users are identified by their Clerk id with `email`/`wallet`, `auth_method`, `signup_date`, and `tier` (set once the balance loads), via `<PosthogIdentifyBridge/>`; reset on sign-out.
- **Key events** (answer "how many signed up / which AI tools / where ink goes"): `signed_up`, `generation_started {type}` (per tool), `ink_spent`, `out_of_ink`, `checkout_started`, `purchase_completed`, `referral_shared`, plus autocapture + SPA pageviews. Config: US host, `identified_only` person profiles. Full taxonomy + suggested funnels: `documents/POSTHOG_ANALYTICS.md`.

## June 15, 2026 — Wallet sign-in, nav split, +4 meme templates

- **Wallet sign-in through Clerk.** Clerk's native MetaMask button shows **only where a wallet provider exists** (desktop extension / MetaMask in-app browser); plain mobile browsers get an **"Open in MetaMask"** deep-link that reopens the site in the wallet's in-app browser (then the native flow works). Auth stays 100% Clerk, so the account + ink balance stay shared. No wagmi/SIWE, no new deps.
- **Nav split** (matches the desktop header): the ecosystem logo on the **far left** (links to `panelhaus.app/universe`) and the ⊞ cross-app switcher on the **far right** (via the shared component's `logo="off"`). Compact icon buttons + no-wrap labels so nothing overflows on mobile.
- **4 new meme templates** with hand-calibrated caption zones: `spongebob-burning-paper`, `first-world-problems`, `im-the-captain-now`, `uno-draw-25-cards`. The `/c/from-meme` dev stub now resolves any template's image from the registry (no more per-template config).

## June 14, 2026 — Shared Panel Haus accounts + ink credits (Clerk)

- **One account, one balance across both apps.** panel_shaq now shares a single Clerk login and a single ink-credit balance with Panel Haus (`panelhaus.app`); sign up on mobile and it's the same user, with the same balance, on desktop. Soft gate: the app opens freely and only prompts sign-in when a non-BYOK user triggers a generation. Gated on `VITE_CLERK_PUBLISHABLE_KEY`; with it unset the app runs the legacy anonymous/BYOK path unchanged.
- **Metering on every AI tool.** Each AI action reserves ink from the shared balance before running and refunds on failure: images cost by model (flash 1 / pro 2), text/vision 1. Per-action **cost badges** on the generate buttons + a cost table in Settings, an ink-balance chip in the nav, and an **instant out-of-ink** prompt that opens the buy sheet. **BYOK** (your own Gemini key) bypasses auth + credits.
- **Buy ink in-app.** Booster packs (75 / 150 / 300) via Panel Haus's existing Stripe: hosted checkout, return-to-app with balance refresh. We hold no Stripe secrets, price IDs, or webhook.
- **Referral.** Captures an incoming `?ref=PH-XXXXXX` and links it on sign-in via Panel Haus's idempotent endpoint; share your own invite link (with a referral count) from Settings.
- **Account UI.** Custom account menu (email or truncated wallet + sign out), tier labels (e.g. "Founder Pass"), and the Clerk sign-in modal themed to the app. Docs: `documents/CLERK_AUTH_AND_WALLET_ARCHITECTURE.md`, `INTEGRATE_NEW_APP_INTO_CLERK_ECOSYSTEM.md`.

## June 6, 2026 — Domain move groundwork (`m.panelhaus.app`)

- **Cross-origin data migration.** localStorage + IndexedDB are per-origin, so moving the canonical host from `shaq.panelhaus.app` to `m.panelhaus.app` would strand existing users' on-device projects. Added a one-time, same-site migration: `public/migrate-bridge.html` (a read-only exporter served on the old origin) + `src/services/originMigration.ts` (runs once on first load of `m.panelhaus.app`, pulls the old origin's storage via a hidden iframe + `postMessage`, writes it locally, then mounts). Self-gates to the new host and never clobbers existing data. **Requires the old host to keep serving `/migrate-bridge.html`** (don't blanket-redirect it).
- **TWA Digital Asset Links stub.** Added `public/.well-known/assetlinks.json` (package `app.panelhaus.mobile.twa`) so the rebuilt TWA verifies the new domain. Fingerprints are placeholders — fill before resubmit (see `public/.well-known/README.md`).

## June 6, 2026 — Rebrand: "Panel Shaq" → "Panel Haus Mobile"

- **Renamed the app's user-facing brand** from "Panel Shaq" to **Panel Haus Mobile** across the UI: the loading splash wordmark, the email gate, the API-key help text, the Settings hosted-service banner, the Web Share comic title, and `metadata.json`. The new home is **`m.panelhaus.app`** (replacing `shaq.panelhaus.app`).
- **Internal storage keys are intentionally unchanged.** Every `panelshaq_*` localStorage key and the `panelshaq` / `panelshaq_projects` IndexedDB databases keep their names — they're storage namespaces, and renaming them would wipe existing users' projects, vault, and settings. Likewise the `.comic` export `source: "panelshaq"` field is left as a cross-repo contract with the desktop importer.
- **TWA `packageId`** changes with the rename (app is being resubmitted to Google Play). Plan + full tier breakdown: `documents/rename-shaq-to-panelhaus-mobile-plan.md`.

## June 6, 2026 — Panel Haus cross-app switcher (`haus-switcher`)

### Nav integration

- **Mounted the shared `<haus-switcher current="shaq">` web component** in the top nav, in the far-left group, to the right of the hamburger menu. It's the cross-app launcher shared across Panel Haus properties (loaded from `panelhaus.app/embed/hausbar.js` via `index.html`). Replaces the old "PANEL SHAQ" text wordmark in that slot.
- **Removed the hardcoded "Panelhaus.app" cross-link** from the menu drawer — the switcher supersedes it. The Discord link and brand-attribution footer are left intact (community/brand, not sibling-app nav chrome).
- **React 19 typing:** added `src/global.d.ts` declaring `haus-switcher` under the `react` JSX namespace (React 19 moved it off the global `JSX` namespace).

### Dev-only

- **Local mock of the switcher** (`src/hausbar-mock.ts`, loaded only under `import.meta.env.DEV`) so it's visible while developing — the real embed isn't live yet. A ⊞ opens a full-screen sibling-app drawer; the logo links to `panelhaus.app/universe`. Tree-shaken out of prod builds; in prod the empty tag stays invisible until the real embed ships.

## June 3, 2026 — MemeGen → Panel Shaq Meme Handoff (mobile "add text")

### New: mobile meme text editor (`/c/from-meme`)

- **The mobile half of MemeGen's "add text" flow.** On a phone, generating a meme on MemeGen and tapping "add text" now lands in Panel Shaq's full meme editor (instead of dead-ending on the desktop site). No login, no AI, no credits — just finish the meme and share.
- **Caption editing:** tap a caption to edit text; pick from **5 fonts** (Impact / Wojak / Slab / Marker / Type); adjust size with `A− / A+`; **move, rotate, resize** each caption — drag anywhere on the caption box, or use the ✥ / ↻ / ⤡ handles.
- **Delete / restore:** remove a caption (clean preview, no clutter); a `＋` chip in the bar brings it back. Modern-Slab's box auto-hides when empty.
- **Share / Copy / Download:** flattened, watermarked PNG. Share uses the native share sheet; Copy puts the image on the clipboard (both need HTTPS — they fall back to Download otherwise).
- **Fits any screen:** the meme always fits the viewport (no scrolling), for any aspect ratio, and refits on rotate.
- **CTAs:** "Make another meme" (back to MemeGen) and "Make a comic" (saves the meme to your Vault and opens the comic studio).

### Impact font — classic meme look

- **Thicker black stroke on Impact**, applied to **all existing templates** by default (positions and sizes unchanged). Picking Impact in the editor, and new admin-added zones, also use the thick stroke. Other fonts are unaffected.

### Templates & admin

- **56 meme templates** with caption positions pre-calibrated (normalized, so they line up on any handoff image size). Admin calibrator + template gallery (`?admin=…&gallery=1`) to (re)position captions and Copy JSON back into the registry.

### Infrastructure

- Handoff token is consumed via a **same-origin serverless proxy** (`api/handoff-consume`) that calls PanelHaus server-to-server — avoids a cross-origin CORS failure. The payload is cached for refresh-safety (single-use token).
- Requires a one-line **guard in the desktop app** (Comic-Pro2 `FromMemeHandoff`) that forwards mobile traffic to Panel Shaq with the live token (see that repo's changelog 954).

## May 10, 2026 — BottomSheet Nav Clearance

- **BottomSheet bottom padding bumped to `pb-28`** so the floating BottomNav no longer visually overlaps the last form action (e.g. the "Create Vault Entry" button). Affects all BottomSheet uses; visible impact today is the Vault new-entry / edit-entry forms.

## May 10, 2026 — Vault Add Flow & Email Gate Hardening

### Workshop

- **Both `+` buttons now go to the Vault** — the larger dashed-border character slot used to open a file picker that created a placeholder character with default name and description. It now navigates to the Vault to create a real entry, matching the behavior of the smaller orange `+` button. Net: one consistent path for adding characters.
- **Tip text shows the actual icon** — the `style-ref` coach tip now renders the `PlusCircle` icon inline ("Tap the orange ⊕ to create a new character blueprint") instead of describing it in text, so the user sees what they're looking for.
- **React 19 prop casing fix** — `fetchpriority` → `fetchPriority` on character images.

### Email Gate

- **Surface the real `saveEmail` error** — when Supabase rejects the email save, the gate now shows the actual error message ("Couldn't save your email: {reason}") instead of a generic "Something went wrong." Keeps the generic fallback only for the localStorage save step.

## May 10, 2026 — Share Polish & Settings

### Sharing

- **Editor share buttons now include a real share message** — both "Share This Page" and "Share All Pages" pass `text: "Made this with panelhaus.app — AI comic creator"` so X (and other recipients) get usable tweet copy with the URL. Previously was just "Made with Panelhaus".
- **iOS fallback applied to editor share** — both buttons now fall through to download when `navigator.share()` rejects with anything other than user-cancel. Matches the same pattern applied to ShareScreen earlier today.
- **Page-numbered share titles** — "Share This Page" now uses `Comic Page N` as the share title instead of generic `My Comic`, so the page number travels with the share.
- **Share analytics in editor** — both buttons fire `share_completed` events (`surface: editor_current_page` / `editor_all_pages`, with `_download` suffix on fallback) so the funnel covers all share paths.

### Settings

- **"Signed in as: {email}" display** — hosted-mode users now see their saved email in Settings, below the existing hosted-service banner. Read from the `panelshaq_user_email` localStorage key set during email-gate signup. BYOK users see nothing extra (no email is collected in BYOK mode).

## May 10, 2026 — Spike Prep

### Observability

- **Vercel Web Analytics integrated** — `@vercel/analytics` v2 mounted in app root, custom-event wrapper at `src/services/analytics.ts`.
- **5 custom events wired** — `cold_landing` (with `first_visit` flag), `editor_first_open`, `generation_started`, `generation_failed`, `share_completed` (with `surface` tag). Funnel data for the upcoming traffic spike.
- **ErrorBoundary now reports client errors** — `componentDidCatch` fires `client_error` event with truncated message and retry count, instead of silently logging to console.

### Reliability

- **Anon-vs-BYOK throttling** — `checkUsage` now distinguishes BYOK users (50 text / 20 image / day, unchanged) from anon users (env-tunable via `ANON_LIMIT_TEXT` / `ANON_LIMIT_IMAGE`, defaults 10 / 5). Applied across `generate-image`, `generate-panels`, `insert-panel`, `final-render`, `polish-story`.
- **Share fallback on iOS rejection** — all three Share screen handlers (single export, batch, single panel) now fall through to download when `navigator.share()` rejects with anything other than user-cancel. Previously failed silently when iOS Safari rejected the share post-`canShare()`.
- **Crash fix in `.comic` file share fallback** — `URL.createObjectURL(file)` no longer crashes when no file config passed `canShare`; builds a fresh blob from the JSON instead.

### Documents

- **Traffic spike prep plan** — `documents/traffic-spike-prep.md` captures the spike strategy: image-first sharing, NFT/X audience profile, 3-day sequencing.
- **Analytics audit & plan** — `documents/analytics-audit-and-plan.md` covers Phase 1/2/3 instrumentation roadmap with status tracking.
- **Tooltip catalog** — `documents/tooltips-current.md` snapshot of all 17 tips (10 coach, 7 help) by screen.

## March 20–22, 2026

### Comic Creation

- **Custom panel image upload** — use your own artwork, photos, or images from other tools alongside AI-generated panels. Upload button on empty panels and existing panels.
- **Default aspect ratio changed to 3:4** (portrait) — better for comic panels than the old 16:9 wide default.
- **Character adherence restored** — switched back to `gemini-3.1-flash-image-preview`, reference images sent first in prompt, `imageSize: "1K"` restored, stronger style adherence prompt.
- **New unique pose enforcement** — AI generates fresh poses instead of copying the reference image pose.
- **Background/Environment support** — select a background from the Vault per panel. The AI uses it as the setting while ignoring any people in the reference.
- **Props and Vehicles** — Vault props and vehicles appear as collapsible pickers on each panel card. Selected items are included as references with descriptive prompts.
- **Art style simplified** — removed the confusing Art Style picker, Style Priority toggle, Match Char Style, and Style Notes. Character reference images now define both appearance AND style automatically.

### Dialogue & Editor

- **Dialogue UX overhaul** — merged INK TOOLS + EDIT BUBBLE into a single "DIALOGUE" section with step-by-step hints (1. Add → 2. Edit → 3. Drag → 4. Bake).
- **Inline bubble editing** — tap a bubble on the panel to edit text, change type (Speech/Thought/SFX), adjust font size, and delete. All in a floating toolbar right next to the bubble.
- **Smooth bubble dragging** — bubbles now move live during drag via direct DOM updates instead of snapping on release.
- **"Bake Panel Dialogue"** button added to the floating bubble toolbar — bake all bubbles on the selected panel without going to the sidebar.
- **Panel drag lock during bubble editing** — panel image can't accidentally move while editing bubbles. Tap the green ✓ to exit edit mode and unlock.
- **Renamed "Final Natural Render" to "Bake Dialogue Into Image"** — clearer name, disabled when no bubbles exist, includes warning about permanent replacement.
- **Removed tail direction square** — the small tail indicator was non-functional and confusing.

### Director & Layout

- **Camera lens modal** — full-width bottom sheet on mobile with thumbnail previews in a 2-column grid. Replaces the old tiny inline dropdown.
- **Lens images optimized** — PNG → WebP conversion, 5.4MB → 96KB (98% reduction).
- **Layout template picker** — compact 5-column grid, smaller thumbnails, no text labels. 10 options fit in 2 clean rows.
- **Per-page panel count controls** — change how many panels each page gets independently.
- **5-panel and 1-panel layout support** — new templates including Full Page, 2-over-3, Feature Top, Cross, Hero+5.
- **Regenerate button 60% opacity** — more visible on mobile (was 30%).
- **Download All + individual panel download** — download buttons on each panel card and a batch "Download All" in the header.

### Sharing & Export

- **Native share sheet** — share all panel images or individual panels via iMessage, WhatsApp, Twitter, etc. using the Web Share API. Fallback to download.
- **Export for Panelhaus** — `.comic` file export with full compatibility (layers wrapper, strokeWidth, dimension, blueprints).
- **Replace panels warning** — now includes a "Download X Images" button so you can save your work before replacing.

### Infrastructure & Reliability

- **Supabase usage tracking** — anonymous auth, daily usage counters (50 text/20 image generations per day), progress bars in Settings.
- **API routes fixed** — `@google/genai` SDK replaced with REST API calls (`fetch`), all helpers inlined per route (Vercel can't share files between serverless functions).
- **PWA service worker fix** — `/api/` routes excluded from navigation fallback, `skipWaiting` + `clientsClaim` for immediate updates.
- **Proxy fallback removed** — all generation calls go through API routes for proper usage tracking.
- **Request timeouts** — 90s for text, 180s for image generation.
- **Friendly error messages** — quota exceeded, invalid API key, and timeout errors shown as clean toasts instead of raw JSON.
- **Failed panel retry** — failed panels get a red "Failed — Retry" badge, batch retry button in header.
- **Stale chunk auto-reload** — `lazyWithReload` wrapper catches chunk load errors after deploys and refreshes the page.

### Settings & UX

- **BYOK (Bring Your Own Key)** — setup screen for first-time users to enter their Gemini API key. Link to get a free key at aistudio.google.com.
- **Warning toggles** — turn off regeneration warnings and data warnings independently in Settings.
- **Usage display** — "Today's Usage" section in Settings with progress bars for text and image generations.
- **Discord link** — added to hamburger menu.
- **Onboarding banners** — contextual help on Layout, Vault, and Editor screens (dismissible).
- **Branded confirmation dialogs** — replaced all `window.confirm` with themed modals.
- **File size validation** — 5MB limit on character/style uploads, 10MB on panel uploads.

### Bug Fixes

- Fixed panels losing images on refresh (IndexedDB persistence instead of localStorage).
- Fixed stale closure in panel generation queue (functional `setPanels` updater).
- Fixed export rendering orange selection border (deselect + `waitForPaint` before capture).
- Fixed body parser limits on API routes (was 100KB default, now 1-20MB per route).
- Fixed Supabase `service_role` key needing `{ auth: { autoRefreshToken: false, persistSession: false } }` to bypass RLS.
- Fixed `VITE_` env vars not baked into client bundle (must be set before build).
- Fixed ErrorBoundary wrapping Suspense for lazy screen crashes.
- Fixed word count label (was "Words", actually counts characters).
- Removed dead "Drafts" and "Help" buttons.
