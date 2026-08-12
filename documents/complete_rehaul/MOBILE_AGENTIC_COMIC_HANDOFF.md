# Handoff: Mobile Agentic Comic Studio — for the panel_shaq lead

**From:** Panel Haus (desktop, `panelhaus.app`, repo `Comic-Pro2`)
**To:** the mobile lead + team (`Mjons/panel_shaq`, `m.panelhaus.app`)
**Date:** 2026-07-25
**Status:** Proposal for your assessment. Nothing is scheduled or committed. This is yours to shape,
sequence, or push back on.

**Read with this:**

- `MOBILE_AGENTIC_COMIC_CREATION.md` — the product vision (the "why").
- `MOBILE_AGENTIC_COMIC_SPEC.md` — the full technical spec (the "how"), including the tool contract,
  phasing, and the exact project-doc shape.

This doc is the short cover letter: what we are proposing, what we believe is already true on your
side, the one thing that gates it, what we (desktop) owe you, and the decisions only you can make.

---

## TL;DR

We want to turn the mobile app into an **agent that makes a whole comic from a conversation**, then
lets the user either **open it in the desktop Studio** (one deep link, same project) or **finish it on
the phone** with a few tap-to-edit tools. The phone becomes where comics are _born_; the Studio stays
where they are _perfected_, and because of cloud storage they are the **same project object**, not an
export.

**What we need from you first:** an answer to one question (Phase 0 below) that determines whether the
Studio handoff is nearly free or a real build. Everything else follows from that.

---

## The concept in three sentences

1. On mobile, the user talks to an agent ("make a 4-panel comic about my cat's coup, make it
   dramatic"); the agent plans the beats, picks a layout, writes the dialogue, and generates each
   panel, streaming them in and asking only for taste decisions.
2. Every change is one reviewable step the user can approve, redirect, or tap to tweak, and every
   generation spends the **shared PH ink** through the same `reserve`/`refund` API you already call.
3. When they are happy, one button opens the exact same project in the desktop Studio for precision
   work, or they export/share straight from the phone.

Why this fits mobile specifically: it removes the sidebar problem. There is no rail of tools to hunt
on a small screen because the agent drives the tools and the user drives the agent.

---

## What we believe is already true on your side (please confirm)

From the two handoffs already exchanged (`PANEL_SHAQ_INTEGRATION_HANDOFF.md`,
`MOBILE_FREE_CREDITS_GAP_HANDOFF.md`), we believe:

- You share our **Clerk instance** (one account, apex-cookie SSO across `*.panelhaus.app`). ✅ shipped.
- You spend the **shared ink** via `POST /api/credits/reserve|refund` and read `GET /api/credits/balance`,
  server-to-server with the user's Clerk Bearer. ✅ shipped (266+ `credit_reserve` rows, incl.
  `mobile_image`/`mobile_text`).
- New mobile signups now get the **free grant at signup** (Clerk webhook fixed on our side), so a fresh
  user has ink before their first generation. ✅
- You have your **own Gemini generation routes** (`generate-image` etc.); you do not call ours. ✅

If any of that has drifted, tell us — the spec assumes all four.

---

## The one thing that gates everything: does your comic serialize to our project schema?

**This is Phase 0, and it decides how big this project is.**

A Panel Haus comic is a JSON `doc` saved via `POST /api/projects` (see
`CLOUD_STORAGE_API_CONTRACT.md`). The desktop Studio opens a project purely by loading that doc by id.
So **if the agent produces a doc in our `serializeProject` v2.0.0 shape, the Studio handoff is a deep
link and nothing more.** No export, no transfer, no conversion.

Two hard rules in that schema:

1. **No embedded base64.** A doc containing `"data:image` is rejected. Every image must be a
   `stored:<assetId>` reference. Your generation routes already persist to R2 and return
   `asset: { id, url, ... }`, so you have the `assetId` in hand — it just has to land in the doc
   instead of a data URL.
2. The doc carries pages, panels, text bubbles, stickers, `format`, `schemaVersion`. Whatever your
   serializer omits, the Studio shows as empty.

**The question we need answered:** does panel_shaq already model/serialize comics in our project-doc
shape, or does it use its own model?

- If **yes / close** → Phase 3 (handoff) is small, and this whole project is mostly the agent runtime.
- If **its own model** → the biggest sub-task is a schema-mapping shim from your model to our doc, and
  it is the thing that gates the Studio exit. Still very doable, just size it now, not in month two.

Your answer here is the single most useful thing you can send back.

---

## What Panel Haus (desktop) will provide

- The **project-doc schema** / `serializeProject` v2.0.0 reference so you can target it exactly (we can
  send the serializer or a schema doc — tell us which is more useful).
- A **`studio/<projectId>` deep link** on our side that opens an existing cloud project straight into
  the editor by id, if it does not already. This is the one desktop-side build the handoff depends on.
- The **per-action ink cost table** confirmation, so the agent's cost-preview matches what `reserve`
  actually charges.
- Continued ownership of the credit API and cloud storage as the single sources of truth. You build
  no balance math and no second project store.

## What mobile builds (the net-new work)

- The **agent runtime** — recommended as a server route in your repo (`api/agent`) that holds the
  working project for a turn, turns natural language into an ordered set of typed tool calls, and
  streams results. Full turn lifecycle, tool contract, and state model are in the spec §4–§5.
- The **tool implementations**, each mapping to a capability you already have (story, image, dialogue,
  style, pose). The agent adds sequencing and judgment, not new generation power.
- The **conversational client UX** (compose bar, streaming panels, cost-approval sheets) and the small
  **tap-to-edit** toolset (regenerate panel, edit text, reorder). Spec §8–§9.
- The **cloud persistence + deep-link handoff** on your side (POST/PUT the doc, offer the Studio link).

---

## Decisions only you can make (with our recommendation)

| Decision                         | Our lean                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------ |
| Agent hosting                    | Server-side route in your repo (keeps keys + tool schema off-device).          |
| Orchestration model              | A current Claude model (check the `claude-api` skill for id/pricing at build). |
| Cost-preview granularity         | Approve-per-batch; single cheap edits use a small pre-approved budget.         |
| Voice scope for v1               | First-prompt only; add voice-editing later.                                    |
| How hard to push the Studio      | Active nudge on out-of-scope edits, tuned to never nag.                        |
| Whether the agent is mobile-only | If desktop ever wants a co-pilot too, build the runtime as a shared service.   |

None of these block starting. Phase 0 (the schema answer) does.

---

## Suggested phasing (yours to reorder)

0. **Schema audit** — answer the doc-schema question above. Gates Phase 3.
1. **Agent skeleton** — turn loop + `plan_story` + `write_dialogue`, text only, no ink.
2. **Panel generation + ink** — `generate_panel` with reserve→Gemini→persist and cost preview.
3. **Cloud persist + Studio deep link** — a mobile comic opens in the Studio. (Highest value.)
4. **Inline review + tap-to-edit.**
5. **Style + character consistency.**
6. **Polish** — voice, cancel-with-refund, out-of-scope→Studio nudges.

Each phase ships something usable; acceptance tests are in spec §12–§13.

---

## Risks / unknowns we want your read on

- **Schema parity (Phase 0)** — the big one, above.
- **Streaming UX on a PWA** — you know your client constraints better than we do; the spec assumes you
  can stream per-panel results.
- **Conversation memory store** — we suggested Redis keyed by `(userId, projectId)` or a `story_chat`
  user-doc; your call.
- **409 conflicts** when a project is open in both the Studio and mobile at once — spec §7.1 has a
  reload-and-replay path; confirm it is acceptable for your flow.

---

## What we are NOT doing

We have not touched your repo, and we are not asking you to commit to this. This is a proposal and a
spec for you to assess, cost, cut down, or send back with a different shape. The only near-term ask is
the Phase 0 schema answer, because everything about the handoff sizing depends on it.

If it is easier to talk it through, we can walk the tool contract and the doc schema live.
