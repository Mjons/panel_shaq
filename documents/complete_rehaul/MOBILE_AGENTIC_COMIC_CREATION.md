# Mobile: The Agentic Comic Studio

**Status:** Vision / product spec (exploration). **Date:** 2026-07-25.
**Scope:** what the Panel Haus mobile app (`m.panelhaus.app`, repo `Mjons/panel_shaq`) becomes when
its whole reason for existing is _making a comic by talking to an agent_, then either handing that
comic to the desktop Studio or finishing it with a small set of touch-native editing tools.
**Companions:** `PANEL_SHAQ_INTEGRATION_HANDOFF.md` (auth + shared ink), `CROSS_APP_AUTH_AND_CREDITS.md`,
`CLOUD_STORAGE_MIGRATION_PLAN.md` (why a mobile project is already a Studio project),
`FIRST_CREATION_GUIDED_FLOW.md` (the golden path this agent automates).

---

## Thesis

On desktop, the user drives the tools. On mobile, **the agent drives the tools and the user drives
the agent.** The phone is not a shrunken canvas editor. It is a conversation that produces a finished
comic, with two ways out: open it in the desktop **Studio** for precision work, or polish it in place
with touch-native editing.

The golden path we already know casuals follow (pick panels → generate image → add text, see
`FIRST_CREATION_GUIDED_FLOW.md`) is exactly the path an agent can execute end to end. Desktop makes
that path _effortless_. Mobile makes it _automatic_ and asks the user only for taste decisions.

---

## Why mobile is a different product, not a smaller one

| Desktop Studio                                | Mobile Agent                                       |
| --------------------------------------------- | -------------------------------------------------- |
| Konva canvas, 5 layers, precise drag / resize | No exposed canvas by default; a scrollable comic   |
| User selects a layout from 664, then fills it | Agent proposes a layout by story beat, user reacts |
| Tools live in rails and toolbars              | The only persistent surface is a chat/compose bar  |
| Fine control is the point                     | Momentum is the point; fine control is an _exit_   |
| Mouse hover, right-click, keyboard shortcuts  | Thumb reach, one primary action per screen         |

The mobile constraint (small screen, one thumb, short sessions) is not a limitation to work around.
It is the reason the agent is the right interface: the user should never have to find a sidebar,
because there is no sidebar. They say what they want and approve what comes back.

---

## The agentic loop

The entire mobile experience is one loop, repeated until the comic feels done:

```
   ┌─────────────────────────────────────────────┐
   │  1. User says what they want (text or voice) │
   │  2. Agent proposes + generates a change       │
   │  3. User sees it inline, reacts               │
   │        • "yes, keep going"                    │
   │        • "no, try X"                          │
   │        • taps to tweak (mobile editing tools) │
   └───────────────┬─────────────────────────────┘
                   │  when done ▼
        ┌──────────┴───────────┐
        │  Finish on mobile     │      Open in Studio (desktop)
        │  (export / share)     │      (precision editing)
        └───────────────────────┘
```

The agent is not a one-shot "generate a comic" button. It is a collaborator that holds the whole
project in context and makes one reviewable change at a time. Every change is cheap to undo and cheap
to redirect, because redirecting is just the next message.

### What the user actually says

The agent should accept intent at any altitude and fill in the rest:

- **Whole comic:** "Make a 4-panel comic about my cat staging a coup for the last treat."
- **A beat:** "Add a panel where the dog realizes what's happening."
- **A visual:** "Make panel 2 rainier and more dramatic."
- **Text:** "The cat's line should be more menacing."
- **Style:** "Do the whole thing in the Smudge house style." (loads a style `.md`, see below)
- **Structure:** "This is dragging, cut it to 3 panels."

The agent decides which underlying capability that maps to. The user never picks "generate image"
vs "generate story" vs "layout" from a menu.

---

## What the agent can do (its tool surface)

The agent orchestrates the same primitives the app already has. It does not get new generation power;
it gets the _judgment_ to sequence them.

| Capability                   | Backing route (mobile's own copies)     | When the agent reaches for it                    |
| ---------------------------- | --------------------------------------- | ------------------------------------------------ |
| Draft the story / beats      | story generation                        | First turn, or "rewrite the arc"                 |
| Choose a layout by beat      | story-beat layout system (see below)    | Picks panel count + composition from the arc     |
| Generate a panel image       | `generate-image` (Gemini)               | Per panel; regenerates on "try again / change X" |
| Write / rewrite dialogue     | dialogue + `suggest-meme-dialogue`      | Fills bubbles; tightens a line on request        |
| Apply a house style          | style `.md` from World Vault / The Dump | "Do it in <style>"; layers on every image        |
| Pose / character consistency | pose + character analysis routes        | Keeps a recurring character on-model             |

Two grounding notes so this stays real:

- **Story beats:** layout choice is driven by narrative intent (Breath / Weight / Reveal / Drive /
  Surge / Rupture / Fracture), not by making the user scroll 664 layouts. See
  `documentation/layouts/STORY_BEAT_PAGE_SYSTEM_PLAN.md`. The agent maps "the reveal moment" to a
  reveal-beat layout automatically.
- **House style:** uploadable style execution files (`.md`) toggle per-generation and layer on top of
  World Vault. The agent can load one by name ("Smudge style") and apply it across every panel it
  generates, which is the single highest-leverage taste lever on mobile.

Every generation still spends shared ink through Panel Haus's atomic credit API
(`reserve` → generate → `refund` on failure). The agent should **state the cost before a batch**
("This will use ~4 ink, generate all 4 panels?") so the user is never surprised by a balance drop.
Mobile holds no credit state; PH's Postgres is the single source of truth
(see `PANEL_SHAQ_INTEGRATION_HANDOFF.md` §3).

---

## Exit 1: Hand off to the Studio

This is the part that only works because of cloud storage, and it is close to free to build.

Because `VITE_ENABLE_CLOUD_STORAGE` persists every project to R2 (binary) + Postgres (metadata) under
the user's account, **a comic the agent built on mobile is already the same project object the desktop
Studio opens.** The handoff is not an export or a file transfer. It is a deep link.

- Same Clerk account across `m.panelhaus.app` and `panelhaus.app` (apex-cookie SSO), so the user is
  already signed in on both.
- The mobile project autosaves to the cloud as the agent works.
- "Open in Studio" produces a link (`panelhaus.app/studio/<projectId>`) the user can:
  - tap to open on a tablet / desktop browser, or
  - send to themselves (email / the ecosystem nav) to pick up on their laptop.

**When the user should reach for this:** anything the agent is bad at because it needs a mouse and a
big screen. Precise bubble tail placement, per-object layering, custom panel geometry, multi-page
organization, fine typography. The mobile agent gets them 90% there; the Studio is where a creator
who cares does the last 10%.

The mental model to protect: **mobile is where comics are born, the Studio is where they are
perfected.** Nothing made on mobile is a dead end or a lesser format. It is the same project, one tap
from the full editor.

---

## Exit 2: Finish on mobile (touch-native editing tools)

Most casual users will never open the Studio. For them, mobile needs a _small, deliberate_ set of
editing tools, invoked by tapping the thing you want to change rather than by hunting a toolbar. This
is the "tidy house" principle applied to a phone: surface matches intent, nothing is removed, rare
tools stay one layer deeper.

**In scope (tap-to-edit, direct manipulation):**

| Tap on...       | You can...                                                        |
| --------------- | ----------------------------------------------------------------- |
| A panel's image | Regenerate, nudge the prompt, pan/zoom the image within the panel |
| A speech bubble | Edit the text, change bubble type, drag the tail to a new anchor  |
| A caption       | Edit text, restyle (font preset, color)                           |
| Empty panel     | "Generate" or "Import from camera roll"                           |
| The whole comic | Reorder panels, change the overall style, add/remove a panel      |

Every one of these is _also_ expressible to the agent by voice/text. The tap tools are the fast path
for the obvious tweak; the agent is the path for the vague or ambitious one. They are the same
project state, not two modes.

**Out of scope on mobile (this is what the Studio is for):**

- Custom panel-layout building (freeform geometry)
- Per-layer manual z-ordering / the Layer Manager
- Precise multi-object selection and alignment
- Deep typography (custom font upload, per-character formatting)
- Multi-page bulk operations (the page organizer)

If a user tries to do one of these, that is the natural, non-nagging moment to surface **"Open in
Studio"** rather than cramming a desktop control onto the phone.

---

## A concrete walkthrough

1. User opens the app. One field: _"What's your comic about?"_ (voice button beside it.)
2. They say: _"My cat plots to overthrow me for the last treat. Make it dramatic."_
3. Agent replies with a plan: _"4 panels — the plotting, the alliance with the dog, the heist, the
   betrayal. Generate all 4? (~4 ink)"_ User taps **Go**.
4. Panels stream in one by one as a vertical, scrollable comic. Dialogue is already in the bubbles.
5. User scrolls, taps panel 3's image: _"more chaotic, treats flying everywhere."_ It regenerates in
   place. Everything else is untouched.
6. User taps the cat's line in panel 4, edits _"you fool"_ → _"you absolute fool."_
7. User is happy. Bottom sheet offers two clear actions:
   - **Share / Export** (finish here) — PNG or share sheet, credited/watermarked per tier.
   - **Open in Studio** — for the tail bubble that is bugging them, on their laptop later.

At no point did they see a layout picker, a layer panel, or a rail of tools. They talked, they
approved, they tapped two or three things.

---

## Design principles (the non-negotiables)

1. **One primary action per screen.** The thumb should always know what the single obvious tap is.
2. **The agent proposes cost, the user approves spend.** Never silently drain ink.
3. **Every change is inline and reversible.** No modal dead-ends; "try again" is always one message.
4. **Nothing made on mobile is a lesser artifact.** Same account, same ink, same cloud project as the
   Studio. Handoff is a deep link, never an export.
5. **Reach for the Studio, don't apologize for mobile.** When a user wants precision, that is a
   success signal (they care), so route them to the right tool instead of degrading the phone.
6. **Voice is a first-class input,** not a gimmick. Describing a comic out loud on a couch is the
   native mobile gesture.

---

## What has to be true (dependencies)

- **Shared account + ink** across web and mobile. Already live (Clerk instance shared, PH Postgres is
  the credit source of truth; `PANEL_SHAQ_INTEGRATION_HANDOFF.md`).
- **Cloud storage on**, so a mobile project is a Studio project. This is the load-bearing assumption
  behind Exit 1 (`CLOUD_STORAGE_MIGRATION_PLAN.md`).
- **The agent runtime on mobile** — an orchestration layer that turns natural language into sequenced
  calls to mobile's existing generation routes. This is the net-new build.
- **A `studio/<projectId>` deep link** on the desktop side that opens an existing cloud project
  straight into the editor.
- **Story-beat layout data** reorganized enough that the agent can pick a layout by narrative intent
  (`STORY_BEAT_PAGE_SYSTEM_PLAN.md`).

---

## Open decisions

- **Agent model + where it runs.** On-device intent parsing vs a server route (`api/agent`) that holds
  the project state and calls the generation functions. Server side is simpler and keeps the tool
  surface in one place; decide before build.
- **Voice input scope for v1.** Full voice-driven creation, or voice only for the first prompt with
  text for edits.
- **How aggressively to push the Studio.** Passive ("Open in Studio" always in the overflow) vs active
  (offer it the moment a user attempts an out-of-scope edit). Lean active, but tune so it never nags.
- **Cost-preview granularity.** Per-batch approval (proposed above) vs a running ink meter vs silent
  with a cap. Per-batch is the safest default for trust.
- **Does the agent also live in the desktop Studio** as a co-pilot, or is it mobile-only? If shared,
  the orchestration layer should be a service both apps call, not a mobile-only feature.
