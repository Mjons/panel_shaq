# Mobile Agentic Comic Studio — Full Spec

**Status:** Spec / planned (exploration). Not yet scheduled. **Date:** 2026-07-25.
**Vision (the "why"):** `MOBILE_AGENTIC_COMIC_CREATION.md` — read that first for the product framing.
**This doc (the "how"):** architecture, the agent runtime, the tool contract, the data model, the
Studio handoff mechanics, UX states, phasing, and verification.
**Owner of the build:** the mobile team (`Mjons/panel_shaq`). This spec is what Panel Haus (desktop)
hands them; the companion `MOBILE_AGENTIC_COMIC_HANDOFF.md` is the cover letter.

**Grounding docs (all verified against current code/contracts):**

- `PANEL_SHAQ_INTEGRATION_HANDOFF.md` — shared Clerk auth + shared ink; mobile has its own generation
  routes and calls PH only for credits.
- `MOBILE_FREE_CREDITS_GAP_HANDOFF.md` — the exact mobile→PH credit flow (`reserve`/`refund`/`balance`).
- `CLOUD_STORAGE_API_CONTRACT.md` — `/api/projects` doc shape, `/api/assets/*`, `stored:` refs, the
  fact that a project doc is base64-free and portable.
- `NANO_BANANA_PROMPTING_INTEGRATION.md` — how a good image prompt is built (mood→lighting, camera,
  references, vibeTags).
- `STORY_BEAT_PAGE_SYSTEM_PLAN.md` — narrative-beat layout taxonomy the agent picks from.

---

## 1. Goals and non-goals

### Goals

1. A user creates a **complete, finished comic on a phone by conversing with an agent**, approving one
   reviewable change at a time.
2. The comic the agent produces is a **valid Panel Haus project doc** — the same object the desktop
   Studio opens, byte-compatible with the cloud storage schema. No export, no conversion.
3. Two exits from the agent: **finish on mobile** (export/share) or **open in the Studio** (one deep
   link, same account, same project).
4. A small set of **touch-native editing tools** (tap-to-edit) for the obvious tweaks, so most users
   never need the Studio.
5. Every generation spends the **shared PH ink balance** through the existing atomic credit API, with
   cost previewed before a batch.

### Non-goals

- Rebuilding the Konva canvas on mobile. Precision editing stays in the Studio.
- Giving the agent new generation _power_. It orchestrates mobile's existing generation routes; it
  adds sequencing and judgment, not new models.
- A second source of truth for credits or projects. PH Postgres owns credits; the cloud project doc is
  the one artifact.
- Multi-page epics as the primary flow. Mobile optimizes the 1-to-few-page casual comic; multi-page
  bulk work is a Studio job.

---

## 2. Architecture overview

Three layers, only the middle one is net-new:

```
┌──────────────────────────────────────────────────────────────────────┐
│  MOBILE CLIENT (panel_shaq PWA)                                        │
│  • Chat/compose surface (text + voice)                                 │
│  • Inline scrollable comic renderer (read + tap-to-edit)               │
│  • Cost-approval sheets, streaming panel placeholders                  │
│  • "Open in Studio" deep link                                          │
└───────────────┬──────────────────────────────────────────────────────┘
                │  user turns (NL intent) + edit ops
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  AGENT RUNTIME  ◀── NET NEW ──▶   (recommended: server route api/agent)│
│  • Holds the working ComicProject for the session                      │
│  • Turns NL intent into an ordered plan of typed tool calls            │
│  • Emits streamed events (plan, cost estimate, per-panel results)      │
│  • Never spends ink itself — tools do, via PH credit API               │
└───────┬───────────────────────┬───────────────────────┬───────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌──────────────────┐     ┌────────────────────────┐
│ Mobile's own  │     │ PH credit API    │     │ Cloud storage (PH)     │
│ gen routes    │     │ reserve/refund/  │     │ /api/projects (doc)    │
│ (Gemini):     │     │ balance          │     │ /api/assets/* (R2)     │
│ story, image, │     │ (shared ink,     │     │ = the Studio's project │
│ dialogue,     │     │  PH is source    │     │   store; deep-linkable │
│ pose, style   │     │  of truth)       │     │                        │
└───────────────┘     └──────────────────┘     └────────────────────────┘
```

The critical relationship: **the agent's output is a cloud project doc.** Everything else is in
service of producing and mutating that doc.

---

## 3. The project doc is the shared artifact

This is the spec's spine. A Panel Haus comic is a JSON `doc` persisted by `POST /api/projects` /
`PUT /api/projects/[id]` (`CLOUD_STORAGE_API_CONTRACT.md` §Projects). Properties that make the handoff
free rather than a build:

- The doc carries `format`, `schemaVersion`, `pageCount`, pages, panels, images, text bubbles,
  stickers — the full comic. It is what `serializeProject` produces on desktop (v2.0.0 shape).
- **Images are never inlined.** Doc validation rejects any doc containing `"data:image` or
  `"data:font`. Images are referenced as `stored:<assetId>` and resolved to presigned GETs via
  `/api/assets/resolve`. Mobile's generation routes already persist to R2 and return
  `asset: { id, url, ... }` (persist-first addition in the contract), so the agent gets an `assetId` to
  drop into the doc directly.
- The doc is account-scoped by the Clerk `userId`. Because mobile and web share one Clerk instance,
  the same doc is readable by the Studio with zero transfer.

**Implication for the agent:** the agent maintains an in-memory `ComicProject` during the session and
serializes it to the exact project-doc schema on save. If the mobile app already has a project model
(it renders comics), the agent mutates _that_ model and reuses its existing serializer. The one hard
requirement is **schema parity with the Studio's `serializeProject`** so "Open in Studio" opens a
clean project. Any field the mobile serializer omits is a field the Studio will show as empty.

> **Decision the mobile team must confirm (see handoff):** does panel_shaq already serialize to the PH
> v2.0.0 project schema, or does it use its own comic model? If the latter, a schema-mapping shim is
> the single largest sub-task in Phase 3, and it gates the Studio handoff.

---

## 4. The agent runtime

### 4.1 Placement — recommend server-side

Run the agent as a **server route in the mobile repo** (`api/agent` or a small set of routes), not
on-device. Rationale:

- It already needs to call mobile's serverless generation routes and PH's credit API server-to-server
  with the user's Clerk Bearer. Keeping the loop server-side keeps one trust boundary.
- The system prompt, the tool schema, and the cost table live in one place, versioned, not shipped to
  every client.
- Model calls (Claude for orchestration) stay off the client, so keys never touch the device.

The client sends a turn (`{ projectId?, message, editOp? }`) and receives a **stream** of events. The
server holds the working project for the turn; the durable copy is the cloud project doc.

### 4.2 Model

Use a current Claude model for orchestration (the reasoning/tool-selection layer), per the
`claude-api` skill for exact IDs and pricing when implementing. The agent model does **not** generate
images or final art; it decides _what to do_ and writes prompts/dialogue. Image generation stays on
Gemini via mobile's existing routes. Keep the orchestration model and the media models decoupled so
either can be swapped.

### 4.3 The turn lifecycle

```
receive turn
  → load working project (from cloud doc if projectId, else new empty project)
  → agent reasons: classify intent, produce an ORDERED PLAN of tool calls
  → if plan spends ink: emit cost_estimate event, WAIT for client approval
  → execute tools in order, streaming a result event per tool
      • generation tools: reserve ink → call gen route → on success write asset into project
                            → on failure refund ink + emit tool_error
  → autosave: PUT the updated project doc to cloud (rev-checked)
  → emit turn_complete with the current project snapshot
```

Key properties:

- **One reviewable change at a time.** A turn may batch (e.g. "generate all 4 panels") but each panel
  streams back individually so the user watches it fill in and can interrupt.
- **Cost gate before spend.** No ink leaves the balance before the client confirms a batch. Single
  cheap edits (one panel regen) may use a standing per-turn budget the user pre-approves; batches
  always confirm. (Granularity is an open decision, §14.)
- **Autosave every turn.** The cloud doc is always current, so "Open in Studio" mid-session works.

### 4.4 Session state

The runtime holds a `WorkingProject` for the turn: pages, panels (with `stored:` image refs, prompts,
mood, camera), text bubbles, applied style ref, and a short **conversation memory** (last N turns +
a running summary) so "make _it_ more dramatic" resolves. Durable state is the cloud doc; the
conversation memory can be kept in Redis keyed by `(userId, projectId)` with a TTL, or re-derived
from the doc + a compact chat log stored as a `story_chat` user-doc (`docType: 'story_chat'` already
exists in the contract).

---

## 5. Tool contract

The agent calls **typed tools**. Each maps to a capability the mobile app already has. Tools are the
only way the agent touches state or spends ink. This table is the contract the mobile team implements
against; exact route names are theirs.

| Tool               | Input (abridged)                                  | Effect / output                                                   | Ink                                                      |
| ------------------ | ------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------- |
| `plan_story`       | `premise, panelCountHint?, tone?`                 | Returns beats: `[{ beat, description, mood, dialogue? }]`         | 0*                                                       |
| `choose_layout`    | `beats[]`                                         | Maps beats→a layout (panel count + geometry) via beat taxonomy    | 0                                                        |
| `generate_panel`   | `panelId, prompt, style?, mood?, camera?, refs[]` | Reserve→Gemini→persist; writes `stored:<assetId>` into the panel  | 1                                                        |
| `regenerate_panel` | `panelId, changeInstruction`                      | Remix/regen the existing panel image                              | 1                                                        |
| `write_dialogue`   | `panelId(s), intent`                              | Fills/rewrites text bubbles (no image spend)                      | 0*                                                       |
| `apply_style`      | `styleId                                          | styleMd`                                                          | Sets a house-style ref applied to subsequent generations | 0   |
| `set_character`    | `characterRef`                                    | Pins a recurring character for consistency (pose/analysis routes) | 0*                                                       |
| `add_panel`        | `afterPanelId, beat?`                             | Inserts a panel slot into the layout                              | 0                                                        |
| `remove_panel`     | `panelId`                                         | Deletes a panel, reflows layout                                   | 0                                                        |
| `reorder_panels`   | `order[]`                                         | Reorders panels                                                   | 0                                                        |
| `edit_text`        | `bubbleId, text                                   | style`                                                            | Direct text edit (also the backing op for tap-to-edit)   | 0   |
| `save_project`     | `-`                                               | Autosave hook (PUT doc); usually implicit per turn                | 0                                                        |

`*` = a text-model call (story/dialogue) that costs an LLM call but no _image_ ink. Whether text
generation debits ink at all follows mobile's current per-action cost table (it already prices
`mobile_text` vs `mobile_image`, per `MOBILE_FREE_CREDITS_GAP_HANDOFF.md`). The agent must read the
live cost table, not hardcode it.

**Prompt quality:** `generate_panel` should build the image prompt the way desktop does
(`NANO_BANANA_PROMPTING_INTEGRATION.md`): map the beat's `mood`→lighting terms, add the camera term,
inject character `vibeTags`, and attach references with role hints ("match the character reference",
"follow the style reference"). The agent writes the subject/action/location; the tool enriches. Text
is never rendered into the image (bubbles are doc elements), preserving Studio editability.

---

## 6. Ink and credits

Unchanged from the shipped cross-app flow (`MOBILE_FREE_CREDITS_GAP_HANDOFF.md` §2). Every generation
tool:

1. `POST {PANELHAUS_API_BASE}/api/credits/reserve { amount, action, idempotencyKey }` with the user's
   Clerk Bearer, **before** the Gemini call. Non-2xx → abort, never generate, surface PH's out-of-ink
   upsell.
2. Run Gemini.
3. On Gemini failure → `POST /api/credits/refund` so the user is not charged for nothing.

`GET /api/credits/balance` feeds the ink chip and the pre-batch cost estimate. Mobile holds **no**
credit state. The free-tier grant now happens at signup (Clerk webhook fixed, per the resolution box
in the mobile-credits handoff), so a fresh mobile user already has ink when the agent first runs.

**Cost preview contract:** before executing any plan whose summed ink `> 0`, the runtime emits
`cost_estimate { totalInk, breakdown[], balanceAfter }`. The client shows a one-tap approval. Use the
`idempotencyKey` per panel so an approval retry never double-charges.

---

## 7. Cloud persistence and Studio handoff

### 7.1 Persistence

- First save of a session: `POST /api/projects { name, format, schemaVersion, doc, origin: 'mobile',
clientProjectId }`. `clientProjectId` is an idempotency key so a retried first-save returns the same
  project instead of duplicating.
- Subsequent turns: `PUT /api/projects/[id] { doc, rev }`. On `409 REV_CONFLICT` (the user also has it
  open in the Studio), the runtime reloads the server doc, replays the turn's mutation onto it, and
  re-PUTs. Last-writer-wins is acceptable for the casual flow; the conflict is rare and the reload
  keeps it safe.
- Images: the generation route already persisted the asset to R2 and returned `asset.id`; the doc just
  holds `stored:<assetId>`. No separate upload step from the agent.

### 7.2 The handoff itself

"Open in Studio" is a **deep link**, not an export:

```
https://www.panelhaus.app/studio/<projectId>       (exact desktop path TBD by PH)
```

- Same Clerk account (apex-cookie SSO across `*.panelhaus.app`) → the user is already signed in on the
  desktop side.
- The Studio loads the project by id via `GET /api/projects/[id]`, resolves `stored:` refs, and opens
  the full editor.
- On mobile the link is offered as: tap to open (tablet/desktop browser) or send-to-self (email / the
  ecosystem nav) to continue on a laptop.

**PH (desktop) must provide** a route that opens an existing cloud project straight into the Studio
editor by id (if `panelhaus.app/studio/<id>` does not already deep-link). This is the one desktop-side
dependency; everything else already exists.

### 7.3 Finish-on-mobile exit

The other exit is export/share. Mobile can either render locally or call PH's
`POST /api/projects/export` (server-prepared `.comic`), but for a casual share the common case is a
flattened PNG/share-sheet, tier-watermarked. Reuse mobile's existing export surface (it already fires
the GTD ship-claim on export/share, per the credits handoff §5).

---

## 8. Mobile client UX

### 8.1 Screens / states

| State             | What the user sees                                                             |
| ----------------- | ------------------------------------------------------------------------------ |
| Cold start        | One field: "What's your comic about?" + voice button. Nothing else.            |
| Planning          | Agent's plan as a short sentence + a **cost estimate** + one **Go** button.    |
| Generating        | Vertical comic; panels stream in as skeleton→image, dialogue lands in bubbles. |
| Review / idle     | Scrollable comic; a persistent compose bar; tap any element to edit.           |
| Editing (tap)     | A small contextual sheet for the tapped element (see §9).                      |
| Done              | Bottom sheet: **Share / Export** and **Open in Studio**.                       |
| Out of ink        | PH's upsell path (from the `reserve` 402), inline, no dead-end.                |
| Out-of-scope edit | A gentle "This is a job for the Studio →" nudge (see §9 out-of-scope).         |

### 8.2 Streaming and interruption

- The runtime streams events; the client renders each panel the moment its `tool_result` arrives.
- The compose bar is always live. A new message mid-generation queues as the next turn (or, for
  "stop", cancels remaining tool calls; already-reserved ink for an in-flight call is refunded on
  cancel).
- Every result is inline and reversible: a per-panel "try again" and a global undo (the doc `rev`
  history / a client-side op stack) so redirection is always cheap.

### 8.3 Voice

Voice is a first-class input for at least the first prompt (describing a comic aloud is the native
couch gesture). Scope beyond the first prompt (voice for edits too) is an open decision (§14).

---

## 9. Mobile editing tools (tap-to-edit)

A deliberate, small set. Tapping the thing you want to change opens a contextual sheet. Each maps to
an agent tool op, so tap-edits and spoken-edits mutate the same doc.

**In scope:**

| Tap on...     | Contextual actions                                          | Backing op         |
| ------------- | ----------------------------------------------------------- | ------------------ |
| Panel image   | Regenerate · nudge prompt · pan/zoom image within the panel | `regenerate_panel` |
| Speech bubble | Edit text · change bubble type · drag tail anchor           | `edit_text`        |
| Caption       | Edit text · restyle (font preset, color)                    | `edit_text`        |
| Empty panel   | Generate · import from camera roll                          | `generate_panel`   |
| Whole comic   | Reorder panels · change overall style · add/remove panel    | reorder/style/add  |

**Out of scope on mobile (route to the Studio):** custom freeform panel geometry, manual per-layer
z-ordering / Layer Manager, precise multi-object selection & alignment, deep typography (custom font
upload, per-character formatting), multi-page bulk operations (page organizer). When a user attempts
one, that is the natural moment to surface **Open in Studio** rather than cramming a desktop control
onto the phone.

---

## 10. Error handling and edge cases

| Case                                    | Behavior                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| Gemini fails mid-batch                  | Refund that panel's ink; mark the panel "tap to retry"; continue the batch.       |
| `reserve` returns 402 (out of ink)      | Abort the plan at that tool; surface PH upsell; keep everything already done.     |
| `reserve` succeeds, generation crashes  | Refund; no orphan charge (the shipped invariant).                                 |
| `PUT` 409 REV_CONFLICT (open in Studio) | Reload server doc, replay mutation, re-PUT. Never silently clobber Studio work.   |
| Network drop mid-turn                   | Turn is idempotent per panel (`idempotencyKey`); resume re-requests unfinished.   |
| Ambiguous intent                        | Agent asks one clarifying question rather than guessing an expensive batch.       |
| User closes app mid-generation          | Autosave means the doc holds completed panels; unfinished panels are empty slots. |
| Redis (conversation memory) miss        | Re-derive context from the doc + stored `story_chat`; degrade, don't fail.        |

---

## 11. Security and abuse

- Clerk Bearer over HTTPS only; short-lived JWTs; server-side `verifyToken` (same instance/JWKS as PH).
- The agent runtime is server-side, so orchestration-model keys and the tool schema never ship to the
  client.
- Ink over-spend protection is entirely PH's atomic `reserve` — the runtime must not do balance math
  locally (the shipped invariant; two devices spending at once is already handled server-side).
- Prompt-injection surface: the user's message is untrusted and flows into the orchestration model.
  Tools are typed and capability-bounded (the agent cannot, e.g., mint ink or read another user's
  project — every route is `userId`-scoped by the token). Keep the tool set closed; no free-form "run
  arbitrary endpoint" tool.
- Signup-abuse guards are unchanged and gating-independent (`api/lib/signupGuards.js`); the agent
  creates no new account-creating path.

---

## 12. Phasing

Each phase ships something usable and has a hard acceptance test. The mobile team owns sequencing;
this is a suggested spine.

| Phase | Deliverable                                                                                           | Acceptance                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **0** | Schema audit: does panel_shaq serialize to PH v2.0.0 project doc?                                     | Written answer + gap list. Gates Phase 3.                                      |
| **1** | Agent runtime skeleton: server route, turn loop, `plan_story` + `write_dialogue` (text only, no ink). | A user types a premise and gets back a beat plan + dialogue, streamed.         |
| **2** | `generate_panel` + ink: reserve→Gemini→persist→doc, with cost preview.                                | "Generate all N panels" produces images, ink debits correctly, refund on fail. |
| **3** | Cloud persistence + Studio deep link.                                                                 | A mobile-made comic opens cleanly in the desktop Studio via one link.          |
| **4** | Inline review + tap-to-edit (regenerate, edit text).                                                  | User tweaks a panel and a line without leaving the comic view.                 |
| **5** | Style + character consistency (`apply_style`, `set_character`).                                       | A recurring character stays on-model; a house-style `.md` applies to all.      |
| **6** | Polish: voice, interruption/cancel-with-refund, out-of-scope→Studio nudges.                           | Full loop feels like one conversation; no dead-ends.                           |

Phase 3 is the highest-risk/highest-value phase and depends on Phase 0's answer + PH's deep-link route.

---

## 13. Testing and verification

- **Schema parity:** a mobile-authored doc round-trips through `GET /api/projects/[id]` and opens in
  the Studio with every panel, image, and bubble intact. This is the single most important test.
- **Ink correctness:** generate N panels → exactly N `credit_reserve` rows; force one Gemini failure →
  a matching `credit_refund`; balance on web reflects the spend (shared source of truth).
- **Idempotency:** replay a turn with the same `idempotencyKey`s → no double charge, no duplicate
  project (via `clientProjectId`).
- **Conflict:** open the same project in the Studio, edit on both, confirm the 409-replay path does not
  lose Studio edits.
- **Free-grant:** brand-new mobile signup has ink before the first generation (webhook grant), and the
  first `reserve` succeeds.
- **Cost gate:** no ink leaves the balance before the user taps approve on a batch.

---

## 14. Open decisions (carried from the vision doc, sharpened here)

1. **Agent model + hosting.** Recommend server-side route in the mobile repo. Confirm the Claude model
   id/effort at build time via the `claude-api` skill.
2. **Schema strategy (Phase 0).** Reuse an existing PH-compatible serializer vs build a mapping shim.
   This gates the Studio handoff and is the biggest unknown.
3. **Cost-preview granularity.** Per-batch approval (recommended) vs a running ink meter vs a
   pre-approved per-turn budget for single cheap edits.
4. **Voice scope for v1.** First-prompt only vs full voice-driven editing.
5. **Studio-nudge aggressiveness.** Passive (always in overflow) vs active (offer on out-of-scope
   attempt). Lean active, tuned to never nag.
6. **Shared vs mobile-only agent.** If the desktop Studio also wants an agent co-pilot, build the
   runtime as a service both apps call rather than a panel_shaq-only feature. Affects where the route
   and tool schema live.

---

## 15. Appendix A — example agent turn

User: _"My cat plots to overthrow me for the last treat. Make it dramatic, 4 panels."_

```
turn.intent      = create_comic(premise, panelCount=4, tone=dramatic)
plan:
  1. plan_story(premise, 4, "dramatic")
       → beats: [Breath: the calm before; Drive: the alliance with the dog;
                 Surge: the heist; Rupture: the betrayal]  (+ mood + dialogue per beat)
  2. choose_layout(beats)            → 4-panel dramatic layout
  3. write_dialogue(all panels)      → bubbles filled (text-model, no image ink)
  4. cost_estimate                   → { totalInk: 4, balanceAfter: 26 }   ⟵ WAIT for approve
  5. generate_panel(p1..p4)          → each: reserve 1 → Gemini(prompt enriched
                                        with mood→lighting + camera + style ref)
                                        → persist R2 → doc.panels[i].image = stored:<assetId>
  6. save_project (PUT doc, rev)     → autosaved
turn_complete → streamed project snapshot
```

Follow-up user tap on panel 3 image: _"more chaotic, treats flying everywhere"_ →
`regenerate_panel(p3, "more chaotic, treats flying")` → reserve 1 → remix → swap `stored:` ref → save.

## 16. Appendix B — the doc the agent must produce (shape)

Conceptually (exact schema = PH `serializeProject` v2.0.0; confirm in Phase 0):

```jsonc
{
  "format": "square", // or portrait/landscape/custom
  "schemaVersion": "2.0.0",
  "pages": [
    {
      "dimension": { "w": 700, "h": 700 }, // locked at creation
      "panels": [
        {
          "id": "panel_1",
          "bounds": { "x": 0, "y": 0, "w": 350, "h": 350 },
          "image": "stored:ast_<hex>", // NEVER data:image — R2 ref only
          "meta": { "prompt": "...", "mood": "tense", "camera": "low angle" },
        },
      ],
      "textBubbles": [
        {
          "id": "b1",
          "panelId": "panel_1",
          "type": "speech",
          "text": "you absolute fool",
          "tail": "bottom-left",
          "fontPreset": "...",
        },
      ],
      "stickers": [],
    },
  ],
}
```

The one hard rule from the contract: **no embedded base64.** Every image is a `stored:<assetId>`
reference the Studio resolves through `/api/assets/resolve`. If the mobile serializer inlines images,
`POST /api/projects` rejects the doc — this is caught in Phase 0.
