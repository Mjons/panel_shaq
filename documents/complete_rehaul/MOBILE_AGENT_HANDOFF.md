# Mobile Agent Handoff — Smudge on `m.panelhaus.app`

**Date:** 2026-07-13
**Owner decision (locked):** Agent-first, graph-as-output. Responsive web on `m.panelhaus.app` (NOT native, NOT a touch-native graph rebuild).
**Status:** Scoped, not started. This doc is the build brief.

---

## 1. What we are building (and what we are NOT)

We are bringing the **board agent (Smudge)** to phones as a **chat-first** experience. The
user talks to Smudge; Smudge builds the story on the node board behind the scenes; the phone
shows the **result as a scrollable sequence of frame cards**, not an editable node graph.

**In scope**

- A full-screen mobile chat shell (Smudge) — message list, input, image attach, provider
  chip, live status line, approval chips.
- A read-only "result" view: the board's frames rendered as an ordered card stack.
- Tap a card → ask Smudge to tweak/regenerate it (round-trips through the same agent).
- Lives at / inside `m.panelhaus.app` (phones already redirect there — see §5).

**Explicitly OUT of scope**

- No touch-native React Flow editor. Phones never see the draggable node graph.
- No wiring, box-select, handle-to-handle connecting, inspector panels on mobile.
- No native app (React Native / Capacitor). This is responsive web.
- No backend changes to the agent proxy (it is already stateless and mobile-ready).

**Why this framing:** the one genuinely hard mobile problem is touch-driving a 4,900-line
mouse-first graph editor. Agent-first sidesteps it entirely and plays to touch strengths
(chat + tap-to-approve). Everything the agent needs already runs client-side on a
renderer-agnostic store.

---

## 2. The pieces you REUSE (the win — do not rewrite these)

| Piece                       | File                                                 | Notes                                                                                                                                                                             |
| --------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent brain / tool loop     | `src/services/boardAgentService.js` (~2,095 lines)   | Digest builder, tool manifest, validation wall, client-side tool execution, chat persistence. **Renderer-agnostic.**                                                              |
| Board state                 | `src/store/nodeBoardStore.js` (~1,285 lines)         | `nodes`/`edges` arrays, `useActiveBoard()` selector, agent-turn undo batching, `data.byAgent` attribution flag. The agent mutates THIS, not the UI.                               |
| Bucket (brand/asset intake) | `src/store/bucketStore.js` (~313 lines)              | Optional on mobile v1; agent tools read it.                                                                                                                                       |
| Agent backend proxy         | `api/board-agent.js` (223 lines)                     | Stateless. Clerk auth + Redis 30/min rate limit + emergency stop already in place. **Zero backend work.**                                                                         |
| Provider adapters           | `api/lib/agentProviders.js` (~284 lines)             | Claude `claude-sonnet-5` default (`ANTHROPIC_API_KEY`, optional `BOARD_AGENT_CLAUDE_MODEL`); Gemini Flash auto-fallback; Grok text-only.                                          |
| Reading-order → sequence    | `src/services/boardPromotionService.js` (~814 lines) | Topological sort over `seq` edges; spatial fallback (rows top→bottom, then left→right). **This is how you turn the graph into an ordered card list — reuse it, do not reinvent.** |
| Persistence                 | IndexedDB stores `nodeBoards`, `boardChats` (DB v11) | Works identically in mobile Safari/Chrome. Same generation billing path.                                                                                                          |

**Key architectural fact:** board documents hold **IDs only** ("cloud-shape rule"). Image
nodes resolve thumbnails from `storageService` (IndexedDB) at render time; canon nodes resolve
live from `worldVaultStore`. The card view must resolve the same way — do not expect image
bytes in the node.

### The agent's tool surface (already implemented, ~29 tools)

Mutation: `add_frame`, `update_frame`, `add_note`, `update_note`, `add_page`, `update_page`,
`add_canon`, `set_canon_look`, `add_style_bundle`, `update_style_bundle`, `add_instruction`,
`update_instruction`, `set_frame_instruction`, `set_active_take`, `set_edge_type`, `connect`,
`arrange`, `duplicate`, `update_bucket_item`.
Read: `get_board`, `get_frame_recipe`, `read_bucket_doc`.
Generation: `generate_frame`, `place_bucket_image`, `place_attachment`.
Build: `submit_build_plan` (Turbo whole-story build).
**Approval chips (staged, user confirms):** `propose_send_to_comic`, `propose_generate_page`,
`propose_create_blueprint`.

### Turn caps to respect on mobile (already enforced in the service)

`MAX_TOOL_CALLS = 15`, `MAX_NODES_PER_TURN = 30`, `MAX_GENERATES_PER_TURN = 4`,
`MAX_BUILDS_PER_TURN = 1`, `MAX_AUTOPILOT_INK_PER_TURN = 12`, `MAX_CHAT_MESSAGES_SENT = 40`
(transcript window). On mobile, consider surfacing the `(n/15 tools)` status prominently and
capping autopilot depth so cellular users are not left on a spinner.

---

## 3. The pieces you BUILD (net-new work)

### 3a. Mobile chat shell (extract, don't invent)

Today `SmudgeDock` is a desktop side-panel embedded inline at
`src/components/Board/DraftingTableView.jsx:1380`. **Lift its logic into a standalone
full-screen mobile view.** It already has: message list, input, 📎 image attach, provider
chip (Claude/Gemini/Grok), live status line, per-board persisted chat, "Allow Smudge to
generate" toggle, autopilot, and the proposal/approval chips (`BucketDrawer` at line 1125 is
optional for v1).

The extraction is UI-only — the state and calls live in `boardAgentService.js`. Aim to import
the service and render a mobile-first chat, not to copy desktop layout.

### 3b. Read-only "result" card view (the one design-risk item)

Render the active board's frames as a vertical scrollable stack of cards:

- One card per frame, in **reading order from `boardPromotionService`** (topological over
  `seq` edges, spatial fallback). Page boundaries become section headers.
- Each card: resolved frame image (via `storageService`) + caption/dialogue + the ✨ badge
  when `data.byAgent` is set.
- Tap a card → opens a small action sheet ("Ask Smudge to change this / regenerate / delete")
  that seeds a chat message. All edits go THROUGH the agent — no direct node editing UI.

This is the only piece with real design risk. **Prototype it first** to prove the sequence
reads well without the spatial layout, before wiring the full chat shell around it.

### 3c. Route / entry

Phones already redirect to `m.panelhaus.app` (see §5). This experience IS that destination
(or a route within it). No new phone-detection logic needed on the studio side.

---

## 4. Sequence of work (suggested)

1. **Confirm the `m.panelhaus.app` stack** (BLOCKER — see §5). Gates everything below.
2. **Spike the card view (3b)** against the existing board store + promotion service. Prove
   the sequence reads cleanly on a phone. Lowest code, highest learning.
3. **Extract the chat shell (3a)** from `SmudgeDock` into a mobile view; wire it to
   `boardAgentService`.
4. **Connect tap-to-tweak** (card → seeded chat message → agent round-trip).
5. **Polish:** persistent status line on cellular, autopilot depth cap, attach/upload on
   mobile file pickers, error/timeout states.

Rough size: a **2–3 week focused build** IF `m.panelhaus.app` shares this repo's React/Vite
stack and can import the service layer directly. If it is a separate codebase, add time to
copy `boardAgentService.js` + `nodeBoardStore.js` across and point them at the same `/api`.

---

## 5. Open questions / blockers (resolve before coding)

1. **`m.panelhaus.app` is a separate surface NOT in this repo.** What is its stack? This is
   the single biggest estimate driver:
   - Same React/Vite app → reuse the service layer by import. Cheapest.
   - Different codebase → copy `boardAgentService.js` + `nodeBoardStore.js`, share `/api`.
     Confirm this FIRST.
2. **Auth continuity.** Studio uses Clerk. `MobileBlocker.jsx` notes localStorage is
   origin-scoped, so `m.panelhaus.app` cannot read PH's stored code. How does a user land on
   mobile already authenticated? Needs a cross-origin session story.
3. **IndexedDB is origin-scoped too.** Boards/chats saved on `panelhaus.app` are NOT visible
   on `m.panelhaus.app`. If mobile must see boards created on desktop (or vice versa), we need
   the in-flight **storage-cloud upgrade** (boards already designed "cloud-shape", IDs-only,
   for exactly this). Confirm its status — it may be a dependency.
4. **Tier gating.** Board agent is Pro-tier server-gated. Confirm mobile users hit the same
   gate and that the paywall/upsell renders on phones.

---

## 6. Reference file map

- Agent brain: `src/services/boardAgentService.js`
- Board store: `src/store/nodeBoardStore.js` (`useActiveBoard()`)
- Reading order: `src/services/boardPromotionService.js`
- Desktop dock to extract: `src/components/Board/DraftingTableView.jsx:1380` (`SmudgeDock`),
  `:1125` (`BucketDrawer`)
- Agent backend: `api/board-agent.js`, `api/lib/agentProviders.js`
- Phone redirect: `src/components/UI/MobileBlocker.jsx` (`narrowSide <= 500` → `m.panelhaus.app`)
- Env: `BOARD_AGENT_CLAUDE_MODEL` documented in `.env.example` (~line 157)
- Existing specs: `documentation/exploration/BOARD_AGENT_SMUDGE_PLAN.md`,
  `documentation/exploration/NODE_CANVAS_FRAME_CREATION_EXPLORATION.md`
- Prior-art agent for comparison: `src/components/INK/` + `src/store/inkChatStore.js` +
  `api/ink-chat.js`
