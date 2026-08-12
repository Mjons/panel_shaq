# Panel Haus Mobile — Rebuild Plan

**Date:** 2026-07-26
**Status:** Plan, pending sign-off. Supersedes the sequencing in `MOBILE_AGENTIC_COMIC_SPEC.md`.
**Repo:** `Mjons/panel_shaq` (`m.panelhaus.app`). **Desktop:** `Comic-ProV2` (`panelhaus.app`).
**Verified against code** in both repos on 2026-07-26, not against the handoff docs alone.

---

## 0. The user we are building for

Not the casual one-shot meme maker. **The hybrid creator.**

> They are on a train. They open the phone, describe a comic, generate panels, rough in the
> dialogue and the beats. They get home, sit at the desktop, and the comic is _already there_ —
> open in the Studio, ready to be pushed further.

Everything below is sequenced from that sentence. Three consequences:

1. **The handoff is the spine, not an exit.** `MOBILE_AGENTIC_COMIC_SPEC.md` treats "open in Studio"
   as one of two equal exits and schedules it at Phase 3. For this user it is the _product_. If the
   comic does not appear on the desktop, nothing else on the phone matters. It ships first.
2. **Offline is a hard requirement, not polish.** "In transit" means tunnels, dead zones, planes,
   and a phone that backgrounds the tab. A design where the doc lives only in the cloud and the
   agent only runs server-side dies in a subway. See §5.
3. **Mobile editing is "primitive but usable," not minimal.** Real reorder, real layout choice, real
   text editing — enough that a non-desktop user finishes a comic, and enough that the hybrid user
   arrives home with something shaped, not a pile of images.

---

## 1. Decision: which agent

**Build a new server-side runtime in this repo. Harvest Smudge's scaffolding; do not port Smudge.**

### What the two proposals actually are

|             | `MOBILE_AGENT_HANDOFF.md` (Jul 13) | `MOBILE_AGENTIC_COMIC_SPEC.md` (Jul 25) |
| ----------- | ---------------------------------- | --------------------------------------- |
| Agent       | Port **Smudge** from desktop       | Net-new `api/agent` runtime             |
| State model | Node **graph** (`nodeBoardStore`)  | The **cloud project doc**               |
| Execution   | **Client-side** tool loop          | **Server-side** turn loop               |
| Tools       | 29, already built                  | 12, to be defined                       |
| Gate        | Pro tier                           | Follows the shared cost table           |

### Why not port Smudge

- **Its output is the wrong artifact.** Smudge produces a node graph. Turning that into a comic
  needs `boardPromotionService.js` (850 lines of topological sort + spatial fallback), and the
  result still has to be mapped to the cloud doc. That is _two_ conversions and _two_ schemas to
  keep in parity, for a model the mobile UI deliberately never shows. Our artifact is the project
  doc. The agent should write it directly.
- **Client-side execution is wrong for transit.** Smudge runs its tool loop in the browser. On a
  train that means: tab backgrounds mid-turn, loop dies, ink already reserved. A server-side turn
  survives backgrounding and is resumable. This is the single strongest technical argument.
- **The port is a moving target.** The handoff sized `boardAgentService.js` at ~2,095 lines and
  `nodeBoardStore.js` at ~1,285. Today they are **2,961** and **1,662** — roughly +40% and +30% in
  two weeks. Porting ~4,600 lines of actively-developed JS into a TypeScript repo does not produce
  a shared asset; it produces a permanent fork that drifts every week.
- **Stack mismatch.** `Comic-ProV2` is JavaScript (`.js`/`.jsx`). This repo is TypeScript, React 19,
  Vite 6, Tailwind v4. A port means either a rewrite or `allowJs` sprawl through the new codebase.
- **Tier mismatch.** Smudge is Pro-gated server-side. Our free tier mirrors desktop credits (§6).

### What to harvest from Smudge (this is the real value in that repo)

These are earned lessons from a shipped agent. Copy the _patterns_, deliberately, into new TS:

- **Turn caps** — `MAX_TOOL_CALLS=15`, `MAX_GENERATES_PER_TURN=4`, `MAX_AUTOPILOT_INK_PER_TURN=12`,
  `MAX_CHAT_MESSAGES_SENT=40`. These numbers cost someone real debugging. Start there.
- **The validation wall** — the agent's tool args are checked before execution, not trusted.
- **Approval chips** — `propose_*` tools that stage an action for user confirmation. This is exactly
  our cost-approval gate, already designed.
- **`data.byAgent` attribution** — marking agent-created content so the UI can badge it and undo can
  batch a whole turn. Carry this into the doc.
- **Provider adapters** (`api/lib/agentProviders.js`) — Claude default, Gemini fallback. Worth
  copying the shape so a provider outage is not an outage.
- **Undo batching per agent turn** — one turn is one undo step. Non-obvious and correct.

### The one thing to decide with Tay before building

`MOBILE_AGENTIC_COMIC_SPEC.md` §14.6 asks whether the agent is mobile-only or a shared service.
**Recommendation: build it mobile-only but shaped as a service** — the tool layer takes a project
doc and returns a mutated project doc, with no mobile-specific state inside it. If desktop later
wants a doc-native co-pilot (as opposed to Smudge, which is board-native), it can call the same
routes. Do not build for that now; just do not preclude it.

---

## 2. Decision: which repo

**This repo (`panel_shaq`), same origin, new root. Not the desktop repo. Not a new repo.**

### Why not the desktop repo (`Comic-ProV2`)

- Stack mismatch (JS vs TS/React 19/Vite 6/Tailwind 4).
- **Deploy coupling.** Mobile needs to iterate daily through a rebuild; desktop is production and
  stable. One repo means one deploy risk surface.
- All 16 `api/` routes with the inlined Clerk + credit gate already live here. Vercel cannot share
  local files between serverless functions anyway, so co-location buys nothing.
- `m.panelhaus.app` DNS, the Clerk `authorizedParty`, and the PWA manifest are configured here.

### Why not a brand-new repo/origin

- **IndexedDB is origin-scoped.** Every existing user's projects live in `panelshaq_projects` on
  `m.panelhaus.app`. A new origin orphans all of them with no migration path. From this origin we
  can read them and push them to the cloud — which is exactly what Phase 1 does.
- The live `/c/from-meme` receiver serves real traffic here and is Clerk-free by design.
- Clerk apex-cookie SSO, PWA install state, `originMigration`, and `DesktopRedirectGate` all exist
  and work.

### The mechanism

`src/main.tsx` already branches on `window.location.pathname` — that is how `/c/from-meme` bypasses
the tab app entirely. Add a **third root** for the new experience with its own state model, its own
routing, and **no import from `App.tsx` or `src/screens/`**.

```
src/main.tsx
├── /c/from-meme  → FromMemeRoot        (live, untouched)
├── /            → StudioMobileRoot     (NEW — the rebuild)
└── /classic     → App                  (legacy tab app, fallback during transition, then deleted)
```

Keep and reuse (roughly 60% of the current repo, all of it shipped and debugged):

| Keep                                                  | Why                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| `api/*` — all 16 routes                               | Clerk verify + reserve/refund is inlined per route and works |
| `services/clerkToken.ts`, `ClerkTokenBridge`          | Auth plumbing                                                |
| `services/credits.ts`, `checkout.ts`, `buyCredits.ts` | Ink, Stripe, upsell bus                                      |
| `services/referral.ts`, `ReferralCard`                | Referral program                                             |
| `services/analytics.ts` + PostHog bridge              | Single funnel                                                |
| `src/from-meme/*`                                     | Live traffic                                                 |
| PWA config, theme tokens in `index.css`               | Brand + install                                              |

Rebuild from scratch (~7,200 lines deleted): `DirectorScreen`, `EditorScreen`, `LayoutScreen`,
`WorkshopScreen`, `VaultScreen`, `ShareScreen`, `ComicPageCanvas` — these implement the
tab-and-picker flow the new product does not have. Their exported domain types (`Page` in
LayoutScreen, `VaultEntry` in VaultScreen) must be lifted into a real `src/model/` first.

---

## 3. ⚠️ Correction to the handoff: `serializeProject` is the wrong target

`MOBILE_AGENTIC_COMIC_HANDOFF.md` and `MOBILE_AGENTIC_COMIC_SPEC.md` §3 both say to target
"PH `serializeProject` v2.0.0." **Reading the code, that is wrong, and building against it would
produce a doc the server rejects.**

There are **two different formats** in the desktop repo:

|             | `.comic` file                                                                                       | Cloud project doc                         |
| ----------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Produced by | `saveLoadService.serializeProject()` (`saveLoadService.js:310`)                                     | `src/services/cloud/projectRepository.js` |
| Images      | **Embedded base64** — `embeddedImages: true`, resolves `stored:` refs _into_ data URLs (`:362-380`) | **`stored:<assetId>` refs only**          |
| Shape       | `{ version, metadata, project: {...} }`                                                             | the runtime project object                |
| Consumed by | file open/import                                                                                    | `POST /api/projects` → the Studio         |

`api/lib/cloudAssets.js → validateDocPayload()` **hard-rejects** any doc containing `"data:image`,
`"data:font`, or a `data:<mime>;base64,` pattern, with `code: 'EMBEDDED_DATA_URL'`. So a doc
produced by `serializeProject` — the thing the handoff told us to target — **cannot be POSTed to
`/api/projects` at all.**

**Action:** ask Tay for the shape that `projectRepository.js` PUTs, not the `.comic` serializer.
This correction is the most useful thing we can send back, and it changes their Phase 0 answer too.

### The good news

Cloud storage is **live and complete** on desktop, contrary to what we could see from this repo:

- `api/projects/index.js` (POST/GET, quota, `clientProjectId` idempotency, Redis rate limit)
- `api/projects/[id].js` (GET/PUT with rev)
- `api/assets/{upload-init,commit,resolve,index}.js` — the R2 pipeline
- `origin` is an allowlist at `api/projects/index.js:116`: `['created','migration','comic-import','meme-handoff']`.
  **Unknown values silently coerce to `'created'`.** If we want mobile-made projects to be
  identifiable, `'mobile'` must be added to that array on the desktop side. Small ask, easy to miss.

---

## 4. Our Phase 0 answer (send this to Tay now)

> **Q: Does panel_shaq serialize to the PH project doc schema?**
>
> **No, and not close.** Zero references to `schemaVersion`, `stored:`, `/api/projects`, or
> `/api/assets` anywhere in `src/` or `api/`. Images are base64 data URLs (`PanelPrompt.image?:
string`) held in IndexedDB. Our only desktop-facing artifact is `exportComicService.ts` (305
> lines), a one-way `.comic` file writer — useful as a _mapping reference_ (it already maps grid
> layouts → pixel rects and bubble styles → desktop bubble types) but not a doc serializer.
>
> **We are rebuilding the mobile model to be doc-native rather than writing a shim.** The new
> mobile project model _is_ the cloud doc, so there is no conversion step to keep in parity.
>
> **What we need from you:**
>
> 1. The **cloud doc shape** (what `projectRepository.js` PUTs) — not `serializeProject`. See §3.
> 2. `'mobile'` added to the `origin` allowlist in `api/projects/index.js:116`.
> 3. The **`studio/<projectId>` deep link** (spec §7.2) — still the one hard desktop dependency.
> 4. Confirmation that `ENABLE_CLOUD_STORAGE` is on in production and the per-tier project quota
>    applies to mobile-created projects the same way.
> 5. The live **per-action ink cost table**, so the agent's cost preview matches `reserve`.
> 6. Whether `apply_style` has a backing contract — style `.md` files from World Vault / The Dump
>    do not exist in this repo, and the spec's tool table assumes they do.

---

## 5. Architecture

### 5.1 The doc is the model — local _and_ remote

The mistake to avoid is treating the cloud doc as an export target. **The mobile app's in-memory
project state is the cloud doc**, in cloud shape, with `stored:<assetId>` refs — from the first
render. There is no serializer, because there is nothing to convert.

Offline is then a caching problem, not a modelling one:

```
┌─────────────────────────────────────────────────────────┐
│  Client                                                  │
│  project state  ═ the cloud doc shape (stored: refs)     │
│  IndexedDB      ─ doc cache + blob cache (assetId→bytes) │
│  outbox         ─ queued mutations, replayed on reconnect│
└──────────────────┬──────────────────────────────────────┘
                   │ online only
                   ▼
   PUT /api/projects/[id] {doc, rev}   ·   /api/assets/*   ·   credits reserve/refund
```

- **Blob cache is what makes transit work.** The doc holds `stored:` refs; the bytes live in
  IndexedDB keyed by `assetId`. A generated panel is written to _both_ R2 and the local cache, so
  the comic renders in a tunnel.
- **Outbox.** Desktop already solved this — `src/services/cloud/syncOutbox.js`. Read it before
  writing ours; the conflict/replay semantics should match so both clients behave the same.
- **Rev conflicts** (comic open on phone and desktop at once): reload server doc, replay mutation,
  re-PUT. Spec §7.1 path is fine.

### 5.2 What is genuinely offline vs online-only

| Works offline                     | Needs signal                      |
| --------------------------------- | --------------------------------- |
| Read the whole comic (blob cache) | Generating a panel (Gemini + ink) |
| Reorder / add / remove panels     | The agent turn (server-side)      |
| Edit bubble text, type, placement | Cloud sync (queued in outbox)     |
| Change layout / composition       |                                   |

Be honest in the UI about the split. A queued action should look queued, not broken.

### 5.3 Agent runtime

Server route in this repo (`api/agent`), streaming. Holds the working doc for a turn, emits
`plan → cost_estimate → (await approval) → tool_result* → turn_complete`. Ink is spent only by
tools, only via PH `reserve`/`refund`, with a per-panel `idempotencyKey`. Orchestration model is
Claude (check the `claude-api` skill for the current id at build time); Gemini stays on images.
Conversation memory: last N turns + running summary, keyed `(userId, projectId)`.

---

## 6. Ink and the free tier

Free tier **mirrors desktop** — so there is no mobile tier logic to write. Read the live cost table
from `api/ink-costs.ts`, read balance from PH, reserve before every generation, refund on failure.
PH's Postgres stays the only source of truth; we hold no credit state.

The one new risk the agent introduces: **depth, not surprise.** Today a generation costs a user a
deliberate tap, so effort rate-limits spend. An agent that plans four panels and retries two of them
can drain a signup grant in one turn. The cost-approval gate protects against _unexpected_ spend but
not against _fast_ spend. Mitigations, in order of preference:

1. Per-turn ink ceiling (Smudge's `MAX_AUTOPILOT_INK_PER_TURN=12` is a reasonable start).
2. Approve-per-batch for anything > 1 ink; a small standing budget for single-panel retries.
3. Show balance-after in the approval sheet, always.

---

## 7. Mobile editing tools — "primitive but usable"

More than the spec's tap-to-edit table, far less than the old `EditorScreen`. The test: _a
non-desktop user can finish a comic, and a hybrid user arrives home with something shaped._

**In scope**

| Surface       | Actions                                                                                 |
| ------------- | --------------------------------------------------------------------------------------- |
| Panel image   | Regenerate · nudge prompt · pan/zoom within frame · import from camera roll             |
| Speech bubble | Edit text · change type · move · drag tail anchor                                       |
| Caption       | Edit text · font preset · color                                                         |
| Layout        | Pick from a small curated set of mobile-friendly layouts (not 664) · change panel count |
| Composition   | Reorder panels · add/remove panel · reflow                                              |
| Whole comic   | Apply style · page format                                                               |

**Out of scope → route to Studio:** freeform panel geometry, layer manager / z-ordering, precise
multi-select and alignment, custom font upload, per-character typography, multi-page bulk ops.

Every tool is an op on the doc, and every op is also expressible to the agent. Tap is the fast path
for the obvious tweak; the agent is the path for the vague one. Same doc, not two modes.

---

## 8. Phasing

Reordered from the spec. **The handoff ships first, using the app we already have** — that proves
the schema, the asset pipeline, the deep link, and all of Tay's dependencies _before_ we build an
agent against an unproven target. It also delivers value to existing users on day one.

| Phase | Deliverable                                                                                                                                                                                  | Acceptance                                                                                                                                                     |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** | Contracts settled with Tay (§4). Domain model lifted out of `src/screens/` into `src/model/`.                                                                                                | Written answers to all six asks. `npm run lint` clean with types in `src/model/`.                                                                              |
| **1** | **Cloud doc + asset pipeline + Studio deep link — using the _current_ app.** Panels upload to R2, doc POSTs to `/api/projects`, "Open in Studio" works. Existing IndexedDB projects migrate. | A comic made in today's mobile app opens cleanly in the desktop Studio via one link. Every panel, image, bubble intact. **This is the whole premise, proven.** |
| **2** | New root (`StudioMobileRoot`): doc-native state, blob cache, outbox, offline read. Comic viewer + composition tools (§7).                                                                    | Make and edit a comic on the new root with the network off; it syncs on reconnect.                                                                             |
| **3** | Agent runtime skeleton — `api/agent`, streaming turn loop, `plan_story` + `write_dialogue`. Text only, no ink.                                                                               | Type a premise → get a streamed beat plan with dialogue in bubbles.                                                                                            |
| **4** | `generate_panel` + ink: reserve → Gemini → R2 → doc, with cost preview and per-turn ceiling.                                                                                                 | "Generate all 4" produces images; N reserves; a forced failure produces a matching refund.                                                                     |
| **5** | Tap-to-edit wired to agent ops · regenerate · interruption/cancel-with-refund.                                                                                                               | Tweak a panel and a line without leaving the comic view; cancel mid-batch refunds correctly.                                                                   |
| **6** | Style + character consistency · voice for the first prompt · out-of-scope → Studio nudges.                                                                                                   | A recurring character stays on-model across panels.                                                                                                            |
| **7** | Delete `/classic` and the ~7,200 lines of old screens.                                                                                                                                       | Nothing imports `src/screens/`.                                                                                                                                |

Phase 1 is deliberately _not_ on the new root. It is worth building the handoff twice-ish (once
against the old model, once native) to retire the risk early, and the second time is nearly free
because Phase 2's model is the doc.

---

## 9. Verification

- **Schema parity** — a mobile-authored doc round-trips `GET /api/projects/[id]` and opens in the
  Studio with every panel, image, and bubble intact. The single most important test.
- **No embedded base64** — assert every outgoing doc passes a local mirror of `validateDocPayload`
  before PUT. Catch it client-side, not as a 400.
- **Ink correctness** — N panels → exactly N `credit_reserve` rows; forced Gemini failure → matching
  `credit_refund`; desktop balance reflects the spend.
- **Idempotency** — replay a turn with the same keys → no double charge, no duplicate project.
- **Conflict** — same project open in Studio and mobile, edit both, confirm no Studio work is lost.
- **Offline** — airplane mode: read the comic, reorder panels, edit text; reconnect and confirm the
  outbox drains to the correct final doc.
- **Migration** — an existing user's IndexedDB projects appear in the cloud exactly once.

---

## 10. Open questions

1. **Does the agent live on desktop too?** Affects whether the tool layer is a shared service (§1).
2. **Voice scope for v1** — first prompt only (recommended) vs full voice editing.
3. **Studio-nudge aggressiveness** — lean active on out-of-scope attempts, tuned to never nag.
4. **Layout set for mobile** — which curated subset of desktop's layouts, and does the agent pick by
   story beat (`STORY_BEAT_PAGE_SYSTEM_PLAN.md`) or does the user pick from a short list?
5. **Project quota on mobile** — an agent that makes comics quickly will hit a per-tier project cap
   faster than a desktop user does. Confirm the number.
