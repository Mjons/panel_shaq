# Smudge on Mobile — Agentic Chat Build Plan (Handoff)

**For:** the agent working in `panel_shaq` (Panel Haus Mobile, `m.panelhaus.app`) + whoever briefs it.
**From:** Panel Haus desktop (`Comic-Pro2`). **Date:** 2026-08-12.
**Status:** Plan. Nothing built. No prior spec existed (see Part 0).
> 📋 **This is the panel_shaq copy.** The original lives in `Comic-Pro2` at
> `documentation/architecture/MOBILE_AGENT_HANDOFF.md`. If the two drift, the Comic-Pro2 one wins,
> because that is where the desktop anchors it cites can actually be verified.

**Companion docs — all in `Comic-Pro2`, NOT in this repo:**
`documentation/architecture/PANEL_SHAQ_INTEGRATION_HANDOFF.md` (the auth/credits precedent this doc
copies its shape from), `documentation/exploration/BOARD_AGENT_SMUDGE_PLAN.md` (desktop Smudge, the
reference implementation), `documentation/exploration/SMUDGE_TURBO_BUILD_PLAN.md` (the plan-once
architecture this whole design rests on). Every `file:line` anchor in Part 1, Part 7 and the
Appendix's first table is a **Comic-Pro2** path; the Appendix's second table is this repo.

This doc is written to be **self-contained and reproducible**. Another AI should be able to read it
top to bottom and arrive at the same design without re-running the investigation. Every factual
claim carries a `file:line` anchor, verified 2026-08-12.

---

## Part 0 — The search that came first, and why it found nothing

**Read this section before asking "where is the existing spec".** There isn't one. This was checked
exhaustively, and re-checking is a waste of a session.

### 0.1 What was searched

| Target | Method | Result |
| --- | --- | --- |
| `panel_shaq/documents/` (90 docs) | full listing + keyword grep | No agent doc. 4 hits for `smudge` are the mascot, the ship-claim sheet, and tooltips. |
| `panel_shaq/CHANGELOG.md` | `grep -ci "agent"` | **0** |
| `panel_shaq/src/`, `panel_shaq/api/` | case-insensitive grep for `agent` | Only `magentas` (`DirectorScreen.tsx:571`) and `userAgent` (`services/wallet.ts`). **No agent code exists.** |
| Both repos | phrase grep: `mobile agent`, `agentic mobile`, `Smudge on mobile`, `mobile Smudge`, `agent on mobile`, `board on mobile` | **Zero hits** |
| `Comic-Pro2/documentation/` | `find -iname "*mobile*" -o -iname "*shaq*"` (30 files) | All nav switcher, the Shaq→Mobile rename, `.comic` export compat, the free-credits gap, MemeGen handoff, responsive fixes. None is an agent plan. |
| `panel_shaq` git history | `git log --diff-filter=A -- documents/` | Last doc added 2026-07-21. Nothing agent-related, ever. |

### 0.2 What DOES exist, and where

Three families, none of which is a mobile spec:

1. **Desktop agent specs** (`documentation/exploration/`): `BOARD_AGENT_SMUDGE_PLAN.md`,
   `SMUDGE_TURBO_BUILD_PLAN.md`, plus ~15 more `SMUDGE_*` docs. These describe the *desktop* agent.
   They are the reference, not the plan.
2. **Agent-as-consumer** (`architecture/PANEL_HAUS_MCP_SERVER_PLAN.md`,
   `exploration/API_DRIVEN_COMIC_GENERATION_SKILL_PLAN.md`,
   `features/viral_loop/SMUDGE_DM_COMPANION_EXPLORATION.md`). The DM Companion doc is the closest
   *shape* to this plan, because it is chat-first rather than canvas-first, but it targets desktop.
3. **`AGENTIC_FUTURE_COMPREHENSIVE_EXPLORATION.md`** (2026-04-02). Predates Smudge entirely. Its
   framing ("the missing piece is orchestration, not new AI") still holds; its specifics do not.

### 0.3 The direction itself

The product direction for mobile is settled and is **not** recorded in any repo document. That gap
is the reason this file exists. Do not go looking for a source document to reconcile against; this
doc is the source document.

### 0.4 One gap left open at time of writing

The local `panel_shaq` clone was at `7712b0b` (2026-07-28), working tree clean, **not fetched**. If
work landed on a remote branch since, it is not reflected here. Run `git -C panel_shaq fetch --all`
and re-check before treating Part 0 as final.

---

## Part 1 — Why this design, derived from the desktop code

This is the reasoning chain. It matters more than the conclusion, because if a premise turns out to
be wrong the conclusion should change with it.

### 1.1 The node graph is a typed IR, not a canvas

The obvious assumption is that the Drafting Table's node graph is what makes desktop Smudge good,
and that mobile therefore needs a canvas. **The code says otherwise.**

What Smudge actually receives each round (`src/services/boardAgentService.js:460-503`):

```js
{
  name, style,
  nodes: [{ id, t, label, xy }],            // label is a one-line human string
  edges: [[source, "casts" | "refs:background" | "about" | "seq", target]],
  collapsedPages, instructions, arcs, castWarnings
}
```

Typed nodes, typed edges, one-line labels. The `xy` exists only so Smudge can obey the lane grammar
for the **human's** benefit (system prompt rule 6, `src/data/smudgeSystemPrompt.js:39`). No pixels,
no geometry the model reasons about. The model never sees a canvas.

### 1.2 Turbo proves the graph is optional for building

The decisive evidence. `submit_build_plan` (`src/services/boardAgentService.js:1065-1136`) is the
tool that builds whole stories, and **its schema contains zero graph vocabulary**: no node ids, no
coordinates, no edge types.

```js
{
  title, style: { name, text }, avoid,
  cast:   [{ name }],                                  // EXISTING blueprint names
  plates: [{ location, forPages }],
  pages:  [{ targetPage, frames: [{ visual, cast[], dialogue[{speaker, text}],
                                    usePlate, angle, mood }] }]
}
```

That is a **story spec**. `src/services/boardBuildService.js` then constructs the graph from it
deterministically, with zero model calls in the middle. System-prompt rule 5f
(`smudgeSystemPrompt.js:37`) makes this the *mandatory* path for anything multi-frame, and
`SMUDGE_TURBO_BUILD_PLAN.md` §1 explains why: a 50-80 call hand-building loop drifts off spec by
round 23, costs a provider round-trip per round, and hits the transcript cap.

**Conclusion: the desktop agent's best path from prompt to comic already routes around the node
graph.** The graph is what the *human* uses to read, trust, and repair the result.

### 1.3 panel_shaq already holds the same graph, denormalized

This is the finding that makes the whole project cheap. Desktop's **edges** are mobile's
**foreign-key fields**:

| Desktop board | panel_shaq | Anchor |
| --- | --- | --- |
| `frame.visual` | `PanelPrompt.description` | `src/services/geminiService.ts:37` |
| `casts` edge → canon node | `selectedCharacterIds: string[]` | same |
| `refs:background` edge | `selectedBackgroundId: string` | same |
| `refs:object` edge | `selectedPropIds` / `selectedVehicleIds` | same |
| `about` edge → dialogue note | `bubbles: Bubble[]` | `geminiService.ts:16-35` |
| `seq` edge / `frameOrder` | `Page.panelIds` (ordered) | `src/screens/LayoutScreen.tsx:25` |
| `frame.angle` / `mood` | `cameraAngle` / `mood` | `geminiService.ts:37` |
| canon node → World Vault blueprint | `VaultEntry` | `src/screens/VaultScreen.tsx:120` |

Verified mobile types:

```ts
type VaultCategory = "Character" | "Environment" | "Prop" | "Vehicle";   // VaultScreen.tsx:25
interface VaultEntry  { id; type: VaultCategory; name; image; description;
                        personality?; visualLook?; style? }               // VaultScreen.tsx:120
interface Page        { id; panelIds: string[]; layoutId: string }        // LayoutScreen.tsx:25
interface PanelPrompt { id; description; characterFocus?; cameraAngle?; cameraLens?; mood?;
                        aspectRatio?; image?; selectedCharacterIds?; selectedBackgroundId?;
                        selectedPropIds?; selectedVehicleIds?; customReferenceImages?;
                        notes?; bubbles: Bubble[]; imageTransform?; borderColor?;
                        borderWidth?; borderStyle? }                       // geminiService.ts:37
interface Bubble      { id; text; pos {x,y};
                        style: "speech"|"thought"|"action"|"effect"|"sfx-impact"
                             |"sfx-ambient"|"narration"|"pop-text"|"sticker";
                        fontSize; fontWeight; fontStyle; rotation?; tailPos? }
```

The **entire mobile document** is six values in `src/App.tsx`:

```
story        usePersistedState   "panelshaq_story"        string       App.tsx:480
vaultEntries useIndexedDBState   "vaultEntries"           VaultEntry[] App.tsx:481
rawPanels    useIndexedDBState   "panels"                 PanelPrompt[] App.tsx:502
pages        usePersistedState   "panelshaq_pages"        Page[]       App.tsx:510
pageFormat   usePersistedState   "panelshaq_pageFormat"   string       App.tsx:511
projectName / currentProjectId                                          App.tsx:536,539
```

That serializes to a few KB — the exact property `BOARD_AGENT_SMUDGE_PLAN.md` §1.3 cites as what
made the desktop board agent-friendly in the first place.

### 1.4 Therefore

1. **Do not build a node canvas on mobile.** Nothing in the agent's operation requires one.
2. **Write a digest projector** over those six values that emits the same typed-node/typed-edge
   shape. Smudge's mental model is unchanged; only the storage differs.
3. **Go Turbo-first.** Skip the 37-tool hand-building loop entirely and start at
   `submit_build_plan`, which is where desktop converged after ~20 changelogs. Fewer round trips
   also matters a great deal on a phone network.
4. **A `PanelPrompt` not referenced by any `Page.panelIds` is mobile's staging area** — the nearest
   equivalent to desktop's "on the board but not sent to the comic".

---

## Part 2 — The product

**One line: the chat is the comic.** The comic gets built inside the conversation, in front of the
user, as they watch. On desktop the board sits next to the comic because there is room for two
surfaces. On a phone there is room for one, so the thread has to be the workspace.

### 2.1 The flow

```
Open app  →  Smudge greets, 3 tappable starters (pre-typed messages, NOT a menu)
   ↓
User types or speaks one line
   ↓
Smudge replies with the plan in plain words + a single [ Make it · N ink ] button
   ↓
Tap  →  panels appear one at a time IN THE THREAD as each finishes
   ↓
Finished page card  →  [ Share ]  [ Change something ]  [ Keep going ]
   ↓
"make panel 2 at night"  →  only that panel redraws
```

### 2.2 The five rules

1. **Always show the plan before spending.** One tap between the ask and the ink. This is the only
   place the "I asked for 8 panels and got 20" failure can be caught.
2. **Build where they are looking.** Never navigate away to show the result. Watching panels appear
   is the entire emotional payoff and turns a 30-second wait into a good 30 seconds.
3. **Every change is a sentence.** No panel picker, no settings sheet inside the agent flow.
4. **Nothing is permanent.** Every agent turn gets a one-tap "Undo that". This is a launch
   requirement, not a nice-to-have (see 4.1).
5. **It quietly remembers.** Second mention of a character → offer to save it as a `VaultEntry`.
   That is the retention hook and it feeds the vault the app already has.

### 2.3 Scope discipline for v1

**In:** one page, a handful of panels, free-form chat, plan-then-build, per-panel revision, undo,
share.

**Out:** multi-page stories, story arcs, brand-material intake (the bucket), style bundles,
per-panel instructions, node canvas, manual editing inside the chat (the existing Editor stays
behind a "Fine-tune" button).

### 2.4 Where it lives

**This is a new front door, not a rebuild.** The chat becomes the default landing screen; the
existing `workshop → director → layout → editor` tabs stay exactly as they are and become the
manual path. Mobile is not being rehauled into an agent; one screen is being added in front of what
already works, and it writes into the same `vaultEntries` / `rawPanels` / `pages` the app already
understands.

---

## Part 3 — What panel_shaq is today (verified)

Read `panel_shaq/CLAUDE.md` in full before writing code. The load-bearing facts:

- **Stack:** React 19 + Vite 6 + **Tailwind v4** (config-in-CSS via `@theme`), **TypeScript**.
- **No tests.** `npm run lint` is `tsc --noEmit`. That is the only gate.
- **Dev command is `./dev.ps1`** (plain Vite on :3002, serves `/api/*` in-process). Not `vercel dev`.
- **Screens are tabs, not routes.** `App.tsx` switches on `activeTab`; there is no router. A second
  root exists at `/c/from-meme` via a `pathname` branch in `main.tsx`.
- **`api/` routes are deliberately self-contained.** Vercel cannot share local files between
  functions, so every route inlines its own `getApiKey`, `geminiText`, `checkUsage`,
  `requireSignInWhenClerk`, `reserveInk`, `refundInk`. `lib/api-utils.ts` is imported by nothing.
  **Do not DRY these up — it breaks the deployment.**
- **Storage keys keep the `panelshaq_*` prefix on purpose.** Renaming orphans every user's data.
- **Auth + ink are shared with PH** through Clerk + `${PANELHAUS_API_BASE}/api/credits/*`.

### 3.1 The canonical route pattern

`api/polish-story.ts` is the reference text route. Its shape (abridged from the real 251 lines):

```ts
export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

const PH_BASE = (process.env.PANELHAUS_API_BASE || "https://www.panelhaus.app")
  .trim().replace("://panelhaus.app", "://www.panelhaus.app").replace(/\/+$/, "");
  //  ^ the apex 307s to www and STRIPS the Authorization header. Non-negotiable.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = getApiKey(req);                       // x-api-key (BYOK) || GEMINI_API_KEY
  if (!apiKey) return res.status(401).json({ error: "No API key configured." });
  if (!(await requireSignInWhenClerk(req)))
    return res.status(401).json({ error: "Please sign in to generate." });

  const byok   = !!req.headers["x-api-key"];
  const bearer = (req.headers["authorization"] || "").replace(/^Bearer /, "");
  let inkAmount = 0, inkKey: string | null = null, newBalance;

  if (process.env.CLERK_SECRET_KEY) {
    if (!byok) {
      inkAmount = parseInt(process.env.INK_COST_TEXT || "1", 10);
      inkKey = randomUUID();
      const r = await reserveInk(bearer, inkAmount, "mobile_text", inkKey);
      if (r.status === 402) return res.status(402).json({ error: "out_of_ink", code: "INSUFFICIENT_CREDITS" });
      if (r.status === 429) return res.status(429).json({ error: "weekly_limit_reached", code: "WEEKLY_LIMIT_REACHED" });
      if (r.status !== 200) return res.status(502).json({ error: "Credit reserve failed" });
      newBalance = r.body?.newBalance;
    }
  } else {
    const usageError = await checkUsage(req, "text");   // legacy anon limiter
    if (usageError) return res.status(429).json({ error: usageError });
  }

  try { /* … Gemini call … */ }
  catch (e) { if (inkKey) await refundInk(bearer, inkAmount, inkKey, "gemini failed"); throw e; }
}
```

### 3.2 The billing simplification (important)

Desktop needs **two Redis claims** to make "one charge per turn" true, because the client calls the
endpoint once per round and desktop deducts directly against its own ledger
(`api/_lib/boardChatBilling.js` header explains the whole problem).

**Mobile does not need any of that.** PH's `/api/credits/reserve` is **idempotent on
`idempotencyKey`** (`Comic-Pro2/api/credits/reserve.js:72-87`):

```js
if (idempotencyKey) {
  const prior = await sql`
    SELECT balance_after FROM credit_transactions
    WHERE reference_id = ${idempotencyKey} AND user_id = ${userId} AND type = 'credit_reserve'
    LIMIT 1`;
  if (prior.rows.length > 0)
    return res.status(200).json({ success: true, newBalance: prior.rows[0].balance_after, idempotent: true });
}
```

So mobile reserves with `idempotencyKey = turnId` on **every round** and PH charges **once**. No
Redis, no claim helpers, no `boardChatBilling` port.

⚠️ **Caveat to document in code:** that idempotency SELECT is non-fatal — on a Postgres hiccup it
logs and falls through to a fresh reserve (`reserve.js:83-86`). Under a database blip a long turn
could double-charge. Acceptable and strictly better than no dedup, but say so in a comment so the
next person does not discover it in a support ticket.

---

## Part 4 — Gaps and limitations, ranked

### 4.1 🔴 BLOCKER — panel_shaq has no undo at all

Verified: the only `history` references in `App.tsx` are `window.history.replaceState` for URL
cleanup (`App.tsx:287,367,386,395`). There is no undo stack anywhere.

Desktop wraps each agent turn in `beginAgentTurn`/`endAgentTurn` so a whole turn is **one** undo
step. That guarantee is *why* it is safe to let an agent rewrite your work.

It matters **more** on mobile, because of a structural difference: on desktop the board is a
staging area separate from the comic (frames must be "sent to comic"), so the agent can build
freely without touching the artifact. **On mobile, panels are the comic.** The agent writes
straight into the thing the user cares about.

**Required before any agent write ships.** Design in Part 6.4.

### 4.2 🟠 No tier check on agent turns — but the data is already there

Same hole as desktop's `claimFreeGeminiTurn` (`OUTSTANDING_ITEMS #72`, deadline 2026-08-31), where
every logged-in user gets free turns forever, free tier included. Mobile must not ship a second one.

**Good news: this needs no change in either repo.** PH's `/api/credits/balance` already returns
`tier: c.subscription_tier || 'free'` (`Comic-Pro2/api/credits/balance.js:58`), and this repo's
`api/credits-balance.ts` is a **transparent passthrough** (`return res.status(r.status).json(await
r.json())`, `:29`) — so `tier` is already reaching the mobile client today, unused. Read it and gate
free turns on it. Values are `free`, `creator_lite` (defined, unused in production), `creator_plus`.

### 4.3 🟠 Everything is device-local

panel_shaq has **no server-side store for user content** at all. "Start on my phone, finish on my
laptop" is out of scope until panel_shaq gets cloud storage. Do not promise it in copy.

### 4.4 🟡 No arc / longform memory

`Page[]` carries no story-level plan. Desktop's `arc` node with a derived build cursor
(`boardAgentService.js:438-458`, `isArcPageBuilt` at `:512`) has no mobile equivalent. This is why
v1 caps at one page. Adding it later means adding a seventh persisted value.

### 4.5 🟡 `refs:background` does not fully port

Mobile's `selectedBackgroundId` resolves against **Vault entries**
(`DirectorScreen.tsx:1557-1558`), not against another panel's generated take. So desktop's "reuse
the location from panel 3" has no direct equivalent. `customReferenceImages: string[]` is the
escape hatch — a previous panel's output can be pushed in there.

### 4.6 🟡 Provider: Gemini only

Mobile has `GEMINI_API_KEY` but **no `ANTHROPIC_API_KEY`**. v1 is Gemini-only. That is fine, and it
also sidesteps desktop's Claude prompt-caching complexity entirely. Keep the adapter shaped so a
second provider can be added without restructuring.

### 4.7 🟡 No bucket, no style bundles, no instructions

Deliberately out of scope. Do not stub them; their absence is a scope decision, not a TODO.

---

## Part 5 — Port map

| Desktop artifact | Mobile disposition |
| --- | --- |
| `src/data/smudgeSystemPrompt.js` | **Adapt.** Rules 1, 2, 3, 4b, 5b, 5d, 5f are stack-agnostic doctrine. Rule 6 (lane grammar) **delete** — no canvas. Rules 5c/5e/5g shrink to the mobile toolset. |
| `buildBoardDigest` (`boardAgentService.js:359`) | **Rewrite** as `buildMobileDigest` over the six values. Same output shape. |
| `detectUncastCharacters` (`:145`) | **Port nearly verbatim.** Cheap, high value, catches silent wrong generations that cost ink. |
| `windowPages` (`:287`) | **Defer.** v1 is one page. Needed the moment multi-page lands. |
| `submit_build_plan` schema (`:1065`) | **Copy the schema shape**, drop `plates`/`avoid` for v1. |
| `boardBuildService.js` | **Rewrite** as `buildComic()` writing `rawPanels` + `pages` instead of nodes + edges. |
| `api/board-agent.js` | **Rewrite inline** in panel_shaq's self-contained style, Gemini-only, idempotent reserve, no Redis. |
| `api/_lib/agentProviders.js` → `toGeminiContents` + `callGemini` | **Inline into the route.** Carry the `thoughtSignature` handling verbatim (Part 7.1). |
| `api/_lib/boardChatBilling.js` | **Do not port.** Superseded by idempotent reserve (3.2). |
| `beginAgentTurn`/`endAgentTurn` batching | **Build from scratch** as a snapshot (Part 6.4). |
| Approval chips / `propose_*` | **Simplify** to one "Make it" confirmation on the plan. |
| SmudgeDock UI | **Replace.** Thread-as-workspace, not a side panel. |

---

## Part 6 — Implementation

> These are **reference implementations to adapt**, not tested code. They were written against the
> verified types in 1.3 but have not been run through `tsc`. Typecheck as you go.

### 6.1 The digest — `src/services/agent/mobileDigest.ts`

```ts
import type { VaultEntry } from "../../screens/VaultScreen";
import type { Page } from "../../screens/LayoutScreen";
import type { PanelPrompt } from "../geminiService";

export interface MobileDoc {
  story: string;
  vaultEntries: VaultEntry[];
  panels: PanelPrompt[];
  pages: Page[];
  pageFormat: string;
  projectName: string;
}

const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);

/**
 * Ported from desktop detectUncastCharacters (boardAgentService.js:145).
 * A panel whose description NAMES a vault character but does not cast it will
 * generate successfully and WRONG, and generation is billed. This is the single
 * check that stops that, so it earns its place even in a minimal v1.
 */
function detectUncast(panels: PanelPrompt[], vault: VaultEntry[]) {
  const characters = vault.filter((v) => v.type === "Character");
  const byPanel = new Map<string, string[]>();
  for (const p of panels) {
    const text = `${p.description ?? ""} ${p.notes ?? ""}`;
    const cast = new Set(p.selectedCharacterIds ?? []);
    const missing = characters
      .filter((c) => c.name && !cast.has(c.id))
      .filter((c) => new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text))
      .map((c) => c.name);
    if (missing.length) byPanel.set(p.id, missing);
  }
  return byPanel;
}

export function buildMobileDigest(doc: MobileDoc) {
  const vaultById = new Map(doc.vaultEntries.map((v) => [v.id, v]));
  const nameOf = (id?: string | null) => (id ? vaultById.get(id)?.name ?? null : null);
  const names = (ids?: string[]) => (ids ?? []).map(nameOf).filter(Boolean) as string[];

  const uncast = detectUncast(doc.panels, doc.vaultEntries);
  const placed = new Set(doc.pages.flatMap((pg) => pg.panelIds));

  const panelDigest = (p: PanelPrompt) => ({
    id: p.id,
    visual: clip(p.description, 160) || "(no description)",
    cast: names(p.selectedCharacterIds),
    location: nameOf(p.selectedBackgroundId),
    things: [...names(p.selectedPropIds), ...names(p.selectedVehicleIds)],
    ...(p.cameraAngle ? { angle: p.cameraAngle } : {}),
    ...(p.mood ? { mood: p.mood } : {}),
    art: p.image ? "drawn" : "empty",
    dialogue: (p.bubbles ?? []).map((b) => ({ style: b.style, text: clip(b.text, 120) })),
    ...(uncast.has(p.id)
      ? { warn: `UNCAST: ${uncast.get(p.id)!.join(", ")} named here but not cast — cast before generating` }
      : {}),
  });

  return {
    project: doc.projectName,
    format: doc.pageFormat,
    story: clip(doc.story, 2000),
    vault: doc.vaultEntries.map((v) => ({
      id: v.id, type: v.type, name: v.name,
      description: clip(v.description, 200),
      ...(v.personality ? { personality: clip(v.personality, 120) } : {}),
    })),
    pages: doc.pages.map((pg, i) => ({
      id: pg.id,
      number: i + 1,
      layout: pg.layoutId,
      panels: pg.panelIds
        .map((id) => doc.panels.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => panelDigest(p as PanelPrompt)),
    })),
    // Mobile's staging area: panels that exist but sit on no page. This is the
    // closest equivalent to desktop's "on the board, not sent to the comic".
    loosePanels: doc.panels.filter((p) => !placed.has(p.id)).map(panelDigest),
  };
}
```

### 6.2 The tool manifest — deliberately small

```ts
export const MOBILE_TOOLS = [
  {
    name: "build_comic",
    description:
      "Build a complete comic page. Use this for ANY request that produces more than one panel — " +
      "never hand-build with repeated add_panel calls. Cast members must be EXISTING vault entries " +
      "referenced by name; if a character has no vault entry, leave them out and say so. " +
      "Limits: 1 page, 6 panels, 4 cast, 3 dialogue lines per panel. " +
      "This does NOT generate art — it lays out the page. Art is a separate, confirmed step.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        panels: {
          type: "array",
          items: {
            type: "object",
            properties: {
              visual:   { type: "string", description: "what happens in this panel" },
              cast:     { type: "array", items: { type: "string" }, description: "vault entry NAMES" },
              location: { type: "string", description: "vault Environment name, optional" },
              dialogue: {
                type: "array",
                items: {
                  type: "object",
                  properties: { speaker: { type: "string" }, text: { type: "string" } },
                  required: ["text"],
                },
              },
              angle: { type: "string" },
              mood:  { type: "string" },
            },
            required: ["visual"],
          },
        },
      },
      required: ["panels"],
    },
  },
  { name: "update_panel",   /* { panelId, visual?, cast?, location?, angle?, mood? } */ },
  { name: "set_dialogue",   /* { panelId, lines: [{speaker, text}] }  — replaces */ },
  { name: "save_character", /* { name, description, personality? } → VaultEntry   */ },
  { name: "suggest_next",   /* { suggestions: string[] } → renders tap buttons     */ },
];
```

Five tools. Desktop has 37. Resist growth in v1: every tool is context the model pays for on every
round, and the mobile network is the constraint.

### 6.3 The executor — `src/services/agent/buildComic.ts`

```ts
import { getDefaultLayoutId } from "../../screens/LayoutScreen";   // :601

interface BuildPlan {
  title?: string;
  panels: Array<{
    visual: string;
    cast?: string[];
    location?: string;
    dialogue?: Array<{ speaker?: string; text: string }>;
    angle?: string;
    mood?: string;
  }>;
}

export const BUILD_LIMITS = { panels: 6, cast: 4, dialoguePerPanel: 3 };

/** Validate + normalize. The executor only ever sees a normalized plan. */
export function validatePlan(raw: any): { ok: true; plan: BuildPlan } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const panels = Array.isArray(raw?.panels) ? raw.panels : [];
  if (!panels.length) errors.push("plan needs at least one panel");
  if (panels.length > BUILD_LIMITS.panels)
    // An ERROR the model is told about, never a silent .slice() — desktop learned
    // this the hard way (boardBuildService.js:89-91).
    errors.push(`too many panels (${panels.length} > ${BUILD_LIMITS.panels})`);
  const norm = panels.map((p: any) => ({
    visual: String(p?.visual ?? "").trim().slice(0, 600),
    cast: (p?.cast ?? []).slice(0, BUILD_LIMITS.cast).map(String),
    location: p?.location ? String(p.location) : undefined,
    dialogue: (p?.dialogue ?? []).slice(0, BUILD_LIMITS.dialoguePerPanel).map((d: any) => ({
      speaker: d?.speaker ? String(d.speaker) : undefined,
      text: String(d?.text ?? "").trim().slice(0, 300),
    })).filter((d: any) => d.text),
    angle: p?.angle ? String(p.angle) : undefined,
    mood: p?.mood ? String(p.mood) : undefined,
  })).filter((p: any) => p.visual);
  if (errors.length) return { ok: false, errors };
  return { ok: true, plan: { title: raw?.title, panels: norm } };
}

// Layout selection is ALREADY SOLVED — do not write your own. LayoutScreen
// exports getDefaultLayoutId(panelCount, format) at :601, which is what every
// existing caller uses (:727, :776, :798) and which handles the webtoon format
// via its own table. Using it means an agent-built page picks exactly the layout
// a hand-built one would.

/** Pure: takes the plan + current doc, returns the NEXT doc. No side effects. */
export function applyPlan(doc: MobileDoc, plan: BuildPlan) {
  const byName = new Map(doc.vaultEntries.map((v) => [v.name.toLowerCase(), v]));
  const resolve = (name: string, type?: VaultCategory) => {
    const v = byName.get(name.toLowerCase());
    return v && (!type || v.type === type) ? v : null;
  };
  const unresolved: string[] = [];

  const newPanels: PanelPrompt[] = plan.panels.map((p, i) => {
    const cast = (p.cast ?? [])
      .map((n) => { const v = resolve(n, "Character"); if (!v) unresolved.push(n); return v; })
      .filter(Boolean) as VaultEntry[];
    const loc = p.location ? resolve(p.location, "Environment") : null;
    if (p.location && !loc) unresolved.push(p.location);

    return {
      id: `panel_${Date.now()}_${i}`,
      description: p.visual,
      selectedCharacterIds: cast.map((c) => c.id),
      ...(loc ? { selectedBackgroundId: loc.id } : {}),
      ...(p.angle ? { cameraAngle: p.angle } : {}),
      ...(p.mood ? { mood: p.mood } : {}),
      // Dialogue lands as bubbles on THIS panel — never in the image prompt.
      // (Desktop rule 5c: dialogue notes "never enter prompts".)
      bubbles: (p.dialogue ?? []).map((d, j) => ({
        id: `bub_${Date.now()}_${i}_${j}`,
        text: d.speaker ? `${d.speaker}: ${d.text}` : d.text,
        pos: { x: 50, y: 12 + j * 18 },
        style: "speech" as const,
        fontSize: 16, fontWeight: "600", fontStyle: "normal",
      })),
    } as PanelPrompt;
  });

  const page: Page = {
    id: `page_${Date.now()}`,
    panelIds: newPanels.map((p) => p.id),          // plan order IS reading order
    layoutId: getDefaultLayoutId(newPanels.length, doc.pageFormat),
  };

  return {
    panels: [...doc.panels, ...newPanels],
    pages: [...doc.pages, page],
    report: {
      built: newPanels.length,
      // Never invent a character. Report and let Smudge tell the user.
      unresolved: [...new Set(unresolved)],
    },
  };
}
```

### 6.4 Undo — the blocker fix

Snapshot before the turn, restore on one tap. The whole turn is one step, matching desktop's
`beginAgentTurn`/`endAgentTurn` contract.

```ts
// src/services/agent/turnSnapshot.ts
interface Snapshot { at: number; label: string; panels: PanelPrompt[]; pages: Page[]; vault: VaultEntry[] }

let pending: Snapshot | null = null;

export function beginTurn(doc: MobileDoc, label: string) {
  // Structured clone, not a reference copy — these arrays get mutated in place
  // by the executor and a shallow copy would restore the post-turn state.
  pending = {
    at: Date.now(), label,
    panels: structuredClone(doc.panels),
    pages:  structuredClone(doc.pages),
    vault:  structuredClone(doc.vaultEntries),
  };
}

export function undoTurn(setters: {
  setRawPanels: (v: PanelPrompt[]) => void;
  setPages: (v: Page[]) => void;
  setVaultEntries: (v: VaultEntry[]) => void;
}) {
  if (!pending) return false;
  setters.setRawPanels(pending.panels);
  setters.setPages(pending.pages);
  setters.setVaultEntries(pending.vault);
  pending = null;
  return true;
}
```

**Only one level deep, deliberately.** A full undo stack is a bigger project; "undo the last thing
Smudge did" is what the product promise actually requires. Do not silently widen it.

⚠️ Snapshot memory: `PanelPrompt.image` holds base64. Six panels of base64 in a snapshot is real
memory on a phone. Snapshot the **ids and metadata**, and for `image` keep the reference only —
generated art is additive and never destroyed by a build, so it does not need restoring.

### 6.5 The route — `api/board-agent.ts`

Self-contained per panel_shaq's rules. Gemini-only. Idempotent reserve replaces desktop's Redis
claims.

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyToken } from "@clerk/backend";

export const config = { api: { bodyParser: { sizeLimit: "6mb" } }, maxDuration: 60 };

const MAX_MESSAGES = 40;
const MAX_TOTAL_CHARS = 120_000;
const MAX_TOOLS = 10;
const MAX_DIGEST_CHARS = 40_000;

const PH_BASE = (process.env.PANELHAUS_API_BASE || "https://www.panelhaus.app")
  .trim().replace("://panelhaus.app", "://www.panelhaus.app").replace(/\/+$/, "");

// ── inlined per panel_shaq route rules (CLAUDE.md: no shared local imports) ──
const AUTHORIZED_PARTIES = [
  "https://m.panelhaus.app", "http://localhost:3000",
  "http://localhost:5173", "http://localhost:3002",
];

async function clerkUserId(req: any): Promise<string | null> {
  if (!process.env.CLERK_SECRET_KEY) return null;
  const h = (req.headers["authorization"] as string) || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return null;
  try {
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: AUTHORIZED_PARTIES,
    });
    return claims?.sub ?? null;
  } catch { return null; }
}

async function reserveInk(bearer: string, amount: number, action: string, idempotencyKey: string) {
  try {
    const r = await fetch(`${PH_BASE}/api/credits/reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ amount, action, idempotencyKey }),
      redirect: "manual",
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  } catch { return { status: 502, body: {} as any }; }
}

async function refundInk(bearer: string, amount: number, idempotencyKey: string, reason: string) {
  try {
    await fetch(`${PH_BASE}/api/credits/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ amount, idempotencyKey, reason }),
      redirect: "manual",
    });
  } catch { /* best-effort */ }
}

// ── Gemini adapter: ported from Comic-Pro2/api/_lib/agentProviders.js:192-349 ──
// Read Part 7.1 and 7.2 BEFORE touching either of these two functions.
function toGeminiContents(messages: any[]) {
  const out: any[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      const parts: any[] = [];
      for (const img of m.images || []) parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      parts.push({ text: m.text || "" });
      out.push({ role: "user", parts });
    } else if (m.role === "assistant") {
      const parts: any[] = [];
      // thoughtSignature MUST round-trip verbatim. See Part 7.1.
      if (m.text) parts.push({ text: m.text, ...(m.textSignature ? { thoughtSignature: m.textSignature } : {}) });
      for (const c of m.toolCalls || [])
        parts.push({
          functionCall: { name: c.name, args: c.input || {} },
          ...(c.thoughtSignature ? { thoughtSignature: c.thoughtSignature } : {}),
        });
      if (parts.length) out.push({ role: "model", parts });
    } else if (m.role === "tool") {
      out.push({
        role: "user",
        parts: (m.results || []).map((r: any) => ({
          functionResponse: {
            name: r.name,
            response: { result: typeof r.result === "string" ? r.result : JSON.stringify(r.result) },
          },
        })),
      });
    }
  }
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages, digest, tools, turnId, promptText } = (req.body as any) || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: "messages required" });
  if (messages.length > MAX_MESSAGES) return res.status(400).json({ error: "Conversation too long", code: "TOO_MANY_MESSAGES" });
  if (!Array.isArray(tools) || !tools.length || tools.length > MAX_TOOLS)
    return res.status(400).json({ error: "Invalid tool manifest" });
  if (!turnId) return res.status(400).json({ error: "turnId required" });

  const digestText = typeof digest === "string" ? digest : JSON.stringify(digest || {});
  if (digestText.length > MAX_DIGEST_CHARS)
    return res.status(400).json({ error: "Project too large", code: "PAYLOAD_TOO_LARGE" });
  if (JSON.stringify(messages).length + digestText.length + JSON.stringify(tools).length > MAX_TOTAL_CHARS)
    return res.status(400).json({ error: "Conversation too large", code: "PAYLOAD_TOO_LARGE" });

  const byok = !!req.headers["x-api-key"];
  const apiKey = (req.headers["x-api-key"] as string) || process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(401).json({ error: "No API key configured." });

  const bearer = ((req.headers["authorization"] as string) || "").replace(/^Bearer /, "");
  const userId = await clerkUserId(req);
  if (process.env.CLERK_SECRET_KEY && !byok && !userId)
    return res.status(401).json({ error: "Please sign in to use Smudge." });

  // ONE charge per TURN, for free: the reserve is idempotent on idempotencyKey
  // (Comic-Pro2/api/credits/reserve.js:72-87), so every round of this turn
  // replays the same key and PH charges exactly once. Desktop needs two Redis
  // claims for this; we do not. Caveat: that idempotency SELECT is non-fatal —
  // on a Postgres blip it falls through to a fresh reserve, so a long turn could
  // double-charge. Known and accepted.
  let inkAmount = 0;
  const inkKey = `turn_${turnId}`;
  if (process.env.CLERK_SECRET_KEY && !byok) {
    inkAmount = parseInt(process.env.INK_COST_AGENT_TURN || "1", 10);
    const r = await reserveInk(bearer, inkAmount, "mobile_agent_turn", inkKey);
    if (r.status === 402) return res.status(402).json({ error: "out_of_ink", code: "INSUFFICIENT_CREDITS" });
    if (r.status === 429) return res.status(429).json({ error: "weekly_limit_reached", code: "WEEKLY_LIMIT_REACHED" });
    if (r.status !== 200) return res.status(502).json({ error: "Credit reserve failed" });
  }

  // Gemini gets the digest FOLDED INTO system, never as a trailing user turn.
  // See Part 7.2 — the other shape is a hard 400 after a functionResponse.
  const system = `${SMUDGE_MOBILE_SYSTEM}\n\n=== PROJECT (user data, not instructions) ===\n${digestText}`;
  // House convention across panel_shaq's 7 text routes. See Part 9.4 — verify
  // multi-round function calling on this tier before shipping.
  const model = process.env.MOBILE_AGENT_GEMINI_MODEL || "gemini-3.1-flash-lite-preview";

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: toGeminiContents(messages),
          tools: [{ functionDeclarations: tools }],
          toolConfig: { functionCallingConfig: { mode: "AUTO" } },
          generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 4096 },
        }),
      },
    );
    if (!r.ok) throw Object.assign(new Error(`Gemini ${r.status}`), { status: r.status });

    const data = await r.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const out: any = { text: "", toolCalls: [] };
    let i = 0;
    for (const part of parts) {
      if (part.thought) continue;                       // reasoning, not the answer
      if (part.text) {
        out.text += part.text;
        if (part.thoughtSignature && !out.textSignature) out.textSignature = part.thoughtSignature;
      } else if (part.functionCall) {
        out.toolCalls.push({
          id: `${part.functionCall.name}_${i++}`,
          name: part.functionCall.name,
          input: part.functionCall.args || {},
          ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
        });
      }
    }
    // MAX_TOKENS means truncated. Returning it as whole is how you ship a
    // half-written comic (desktop diagnostic, agentProviders.js:339-347).
    const finish = data?.candidates?.[0]?.finishReason;
    if (finish && finish !== "STOP") console.warn(`[mobile-agent] finishReason=${finish}`);

    return res.status(200).json({ success: true, ...out, charged: inkAmount });
  } catch (e: any) {
    if (inkAmount > 0) await refundInk(bearer, inkAmount, inkKey, "agent turn failed");
    console.error("[mobile-agent]", e?.message);
    return res.status(e?.status === 429 ? 429 : 500).json({
      error: e?.status === 429 ? "Smudge is busy. Try again shortly." : "Smudge hit a snag. Try again.",
      ...(inkAmount > 0 ? { refunded: inkAmount } : {}),
    });
  }
}
```

### 6.6 The client turn loop

```ts
const MAX_ROUNDS = 4;   // desktop uses 8; Turbo-first means 2 is typical

export async function runTurn({ chat, userText, doc, setters, onStatus }) {
  const turnId = crypto.randomUUID();
  beginTurn(doc, userText.slice(0, 60));
  chat.messages.push({ role: "user", text: userText });

  for (let round = 0; round < MAX_ROUNDS; round++) {
    // Rebuild the digest EVERY round so anything created mid-turn is visible in
    // round N+1 rather than reading back as missing (desktop boardAgentService.js:2980).
    const digest = buildMobileDigest(currentDoc());
    const res = await apiPost("board-agent", {
      messages: chat.messages.slice(-40), digest, tools: MOBILE_TOOLS, turnId,
      promptText: userText,
    });
    chat.messages.push({
      role: "assistant", text: res.text,
      toolCalls: res.toolCalls, textSignature: res.textSignature,   // must round-trip
    });
    if (!res.toolCalls?.length) break;

    const results = [];
    for (const call of res.toolCalls) {
      onStatus?.(statusFor(call));
      results.push({ name: call.name, result: await executeTool(call, setters) });
    }
    chat.messages.push({ role: "tool", results });
  }
  // Never end empty (desktop rule 7).
  if (!lastAssistantText(chat)) chat.messages.push({
    role: "assistant",
    text: "I could not finish that one. Tell me what to try instead and I will have another go.",
  });
}
```

---

## Part 7 — Traps that will bite, carried over from desktop

These cost the desktop team real debugging time. Do not rediscover them.

### 7.1 🔴 Gemini `thoughtSignature` must round-trip verbatim — and mobile is on Gemini 3

On thinking models Gemini stamps an encrypted `thoughtSignature` onto returned parts. Desktop
rebuilt each model turn from scratch and dropped it, replayed the stripped history, and got
**corrupted tool arguments while chat prose stayed clean** — because the signatures carry reasoning
state that tool args depend on. Source: `agentProviders.js:204-231`, changelog `1395`.

**This is a hard blocker on mobile, not a degradation.** On Gemini 2.5 a missing signature merely
degrades; **on Gemini 3 it is a hard 400 on multi-turn tool use** — and panel_shaq's text routes
already standardize on **`gemini-3.1-flash-lite-preview`** (7 of its routes; the image routes use
`gemini-3.1-flash-image-preview` / `gemini-2.5-flash-image`). So the very first multi-round tool
turn will fail outright if `toGeminiContents` drops the signature. Get 6.5 right the first time.

### 7.2 Gemini rejects a trailing user turn after a `functionResponse`

Desktop puts the digest in a trailing user "CONTEXT REFRESH" message **for Claude only**, because it
lets the transcript prefix-cache. **Gemini gets the digest folded back into `system`.** Appending a
standalone user Content after a tool `functionResponse` is a sequence Gemini's function-call loop
rejects. Since mobile is Gemini-only, **always fold**. Source: `api/board-agent.js:361-375`.

### 7.3 The apex URL strips the Authorization header

`panelhaus.app` 307s to `www.panelhaus.app` and the header does not survive the cross-origin
redirect. Always normalize `PANELHAUS_API_BASE`. Source: `panel_shaq/api/polish-story.ts:135-137`.

### 7.4 Refund before the platform kills you

A Vercel hard timeout **kills the process**, so a refund in `catch`/`finally` never runs. Desktop
races the provider itself and answers 504 with time left on the clock
(`api/board-agent.js:34-39, 380-396`). Mobile's `maxDuration: 60` plus a single Gemini call is a
smaller risk, but if rounds grow, port `withDeadline`.

### 7.5 Never silently truncate a plan

Desktop's builder used `.slice()` on over-limit input, so a 5th panel vanished without the model or
the user knowing. Every over-limit is now an **error the model is told about**
(`boardBuildService.js:89-91`). Same rule here.

### 7.6 Never say chatting is free

An earlier desktop prompt only mentioned ink for image takes, so the model concluded chat was free
and **told users that while they were being charged**. Rule 4b exists because of that
(`smudgeSystemPrompt.js:31`). Mobile's prompt must carry the same rule, and must never quote a
number — the UI shows live costs, the model would get them wrong.

### 7.7 Vercel cannot share local files between functions

Every helper in this doc is inlined into the route on purpose. `lib/api-utils.ts` exists in
panel_shaq and is imported by **nothing**. Do not DRY it up.

### 7.8 The em-dash rule

Panel Haus fails the build on em dashes in **member-facing copy**. panel_shaq does not currently run
that gate, but any copy that migrates back to PH will hit it. Keep UI strings em-dash free from the
start; use a comma, a colon, or two sentences. Code comments and this doc are exempt.

---

## Part 8 — Build order

Each phase is independently shippable and independently testable.

| # | Phase | Deliverable | Depends on |
| --- | --- | --- | --- |
| **P0** | **Undo** | `turnSnapshot.ts` + an "Undo that" affordance wired to the three setters | — |
| **P1** | Digest | `buildMobileDigest` + uncast detection. Verify by eye against a real project. | — |
| **P2** | Route | `api/board-agent.ts`, Gemini-only, idempotent reserve. Prove billing with two rounds on one `turnId`: exactly one `credit_transactions` row. | P1 |
| **P3** | Chat, read-only | Thread UI, free-form input, `suggest_next` buttons. Smudge can **describe** but not write. Validates prompt + digest before any mutation risk. | P2 |
| **P4** | Build | `build_comic` + `applyPlan` + the plan/confirm chip. **The milestone.** | P0, P3 |
| **P5** | Revision | `update_panel`, `set_dialogue`, per-panel regeneration | P4 |
| **P6** | Memory | `save_character` → `VaultEntry` | P4 |
| **P7** | Voice | hold-to-talk input | P3 |

**P0 before P4 is not negotiable.** No agent write ships without undo.

---

## Part 9 — Open decisions

1. **Draft or direct?** Does a built page land straight in the comic, or arrive as a draft the user
   confirms? Direct is fewer taps and more magical; draft-first is safer and creates a natural
   "Keep / Try again" beat. **Recommendation: draft-first for launch**, loosen once output is
   trusted.
2. **Turn price.** `INK_COST_AGENT_TURN` default. Must be settled alongside the desktop repricing
   (`OUTSTANDING_ITEMS #72`, deadline **2026-08-31**) so the two products do not contradict each
   other. Free turns need a tier check from day one (4.2).
3. **Front door or fourth tab?** This plan assumes the chat becomes the default landing screen.
   Shipping it as an opt-in tab first is lower risk and lower reward.
4. **Model — needs a real answer before P2.** panel_shaq's text routes standardize on
   **`gemini-3.1-flash-lite-preview`** (verified: 7 routes). Matching house convention is the
   default choice, but ⚠️ **a lite-tier model is not a safe assumption for multi-round function
   calling**, which is the one thing this feature depends on. Before committing: run a two-round
   tool-calling turn against that model and confirm (a) `functionCall` parts come back, (b)
   `thoughtSignature` is present and replays without a 400. If it falls short, step up to the
   full `gemini-3.1-flash` tier. Keep `MOBILE_AGENT_GEMINI_MODEL` as the override either way so
   this is a config change, not a redeploy.

---

## Part 10 — Verification checklist

- [ ] `npm run lint` (`tsc --noEmit`) clean. It is the only gate panel_shaq has.
- [ ] Two rounds on one `turnId` produce **one** `credit_transactions` row.
- [ ] A failed provider call refunds; balance returns to its pre-turn value.
- [ ] Signed-out user gets a sign-in prompt, not a 500.
- [ ] BYOK key bypasses ink entirely.
- [ ] Out-of-ink returns 402 and opens the existing `BuyCreditsSheet`.
- [ ] A panel naming an uncast vault character shows the warning **before** art is generated.
- [ ] "Undo that" restores panels, pages **and** vault to their pre-turn state.
- [ ] Over-limit plan (7 panels) returns an error the model reports, not a silent truncation.
- [ ] A multi-round turn with tool calls does not 400 on Gemini (7.1 + 7.2 both honored).
- [ ] No em dashes in any new UI string.
- [ ] Storage keys still `panelshaq_*`; existing projects still load.

---

## Appendix — reference anchors

**Desktop (`Comic-Pro2`), read these to understand the agent:**

| File | Lines | What |
| --- | --- | --- |
| `src/data/smudgeSystemPrompt.js` | 124 | The whole prompt + doctrine. Read first. |
| `src/services/boardAgentService.js` | 3460 | Digest `:359`, tools `:630`, `submit_build_plan` `:1065`, executor `:1375`, turn loop `:2975` |
| `src/services/boardBuildService.js` | 434 | Deterministic builder, validation |
| `api/board-agent.js` | 502 | The relay: auth, caps, billing, provider fallback |
| `api/_lib/agentProviders.js` | 439 | `toGeminiContents` `:192`, `callGemini` `:248` |
| `api/_lib/boardChatBilling.js` | 134 | Why per-turn billing is hard (not needed on mobile) |
| `api/credits/reserve.js` | — | Idempotency `:72-87` |

**Mobile (`panel_shaq`), read these before writing:**

| File | What |
| --- | --- |
| `CLAUDE.md` | Non-negotiable. Route rules, storage keys, dev command. |
| `api/polish-story.ts` | The canonical route pattern to copy |
| `src/App.tsx` | The six-value document, `:480-539` |
| `src/services/geminiService.ts` | `apiPost` `:135`, `Bubble` `:16`, `PanelPrompt` `:37` |
| `src/screens/VaultScreen.tsx` | `VaultCategory` `:25`, `VaultEntry` `:120` |
| `src/screens/LayoutScreen.tsx` | `Page` `:25`, `LAYOUT_TEMPLATES` |
| `src/screens/DirectorScreen.tsx` | How generation resolves refs today, `:1540-1560` |
