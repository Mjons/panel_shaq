# Making the Creator Program's other earners reachable from mobile

**Status:** plan, nothing built. **Written:** 2026-08-14.
**Companion:** `CREATOR_PROGRAM_BUILD_PLAN.md` (the shipped integration).

---

## 1. The question

Panel Haus's Creator Card pays for twelve actions plus a per-credit engine. Mobile shows all of
them, but only **two** are earnable from inside this app:

| Earnable on mobile today | Not earnable on mobile today |
|---|---|
| the four asks (claim, follow, post, refer) | `comic_finished` (50) |
| `creation` — 1 pt per credit, uncapped | `comic_3_pages` (75) |
| `first_creation` (15) | `comic_10_pages` (150) |
| | `blueprint_saved` (50) |
| | `meme_shipped` (25) |
| | `print_order` (200) |
| | `contest` (20, repeatable) |

How do we close that gap?

## 2. Why the gap exists

Every unreachable earner verifies against **Panel Haus's own Postgres**:

```
comic_finished/3/10  projects.page_count + assets (kind=image, status=ready)
blueprint_saved      user_documents WHERE doc_type = 'blueprint'
meme_shipped         assets WHERE source = 'memegen_handoff'
print_order          print_orders
contest              share_events WHERE contest_id IS NOT NULL
```

Mobile writes to **none** of those tables. By deliberate design (`CLAUDE.md`: *"There is no app
database for user content"*), a mobile comic lives in the browser's IndexedDB and the vault is
localStorage/IndexedDB. The only server-side trace a mobile user leaves is a **credit spend** — and
that is exactly why `creation` and `first_creation` already work.

So this is not a bug and not a missing flag. It is the local-first architecture meeting a
server-verified rewards system.

## 3. The rule that must not be broken

Panel Haus's action table is explicit about this, and it is the reason the program survived a
607-account referral farm: **award on evidence we hold, never on a client's claim.** The only two
honour-system actions are the X follow and the X post, and they carry the two smallest weights on
purpose.

So the tempting fix — a `POST /api/creator-card/mobile-event {type: 'comic_finished'}` — is
**out of the question**. A 50-point award on the client's word is a faucet: anyone with devtools
mints points, and points gate the mint wallet.

**Every option below therefore works by making mobile produce real server-side evidence, or by
sending the user to the surface that already produces it.** Nothing here asks Panel Haus to trust us.

## 4. Reframe the urgency before spending anything

**The mint allowlist is not affected by any of this.** The tier (Starter / Plus / OG) is computed
from the **four asks only** — `tierFor(completedCount, ASK_STEPS.length)` — and the GTD/FCFS queue
ranks on `card_action_*` timestamps for those four. Mobile can already complete all four.

The other earners feed the **points balance**, which gates exactly one thing: attaching a mint
wallet at 100 points. And `creation` pays 1 point per credit uncapped, so ~100 credits of ordinary
mobile use clears that gate on its own.

**Conclusion:** a mobile-only member is not locked out of the mint and is not disadvantaged in the
queue. This work is about **engagement and honesty of the card**, not fairness. Price it accordingly
— it does not need to happen before the drop.

## 5. What each earner would actually take

Costs assume Panel Haus endpoints that **already exist** (verified 2026-08-14).

### Tier 1 — cheap, no new Panel Haus code

**`print_order` (200) — deep-link, don't build.**
Panel Haus has the full Lulu flow (`api/lulu/{calculate-price,create-order,upload-pdf,get-order,webhook}.js`).
Building a mobile print flow is weeks; linking to Panel Haus's is an afternoon. The user orders on
desktop, `print_orders` gets a row, the points appear on the mobile card automatically. Add a row in
"More ways to earn" that opens panelhaus.app.
**Cost: hours. Points reachable: 200, repeatable.**

**`meme_shipped` (25) — forward a ticket we already receive.**
`api/handoff/consume.js` mints a `handoffIngestTicket` **into the payload mobile already gets**
through `api/handoff-consume.ts`. `api/assets/ingest-mg-handoff.js` is Clerk-authed and takes that
ticket, writing the asset with `source='memegen_handoff'`. So the evidence is one authed POST away.

⚠️ The tension: `/c/from-meme` is **deliberately Clerk-free**, so it cannot make an authed call.
Options: stash the ticket and ingest from the main app on next sign-in, or add a signed-in-only
"save to my Panel Haus" affordance on the meme screen. The first keeps the Clerk-free root intact.
**Cost: ~half a day. Verify the ticket's TTL survives the stash.**

### Tier 2 — moderate, real product value on its own

**`contest` (20, repeatable) — the best value on this list.**
`api/contest/active.js` lists live contests. `api/share-track.js` is Clerk-authed and
**re-validates `contest_id` against the live contests table** — its own comment: *"never trust the
client's claim that a contest is live."* So mobile posting a contest entry is safe by construction:
the server decides whether it counts.

Mobile already has a ship/share flow. This is: fetch live contests, offer entry at ship time, call
share-track with the id. It is **repeatable**, so it keeps paying — the only earner here that does.
**Cost: 1–2 days. Also gives mobile users the contest hub, which is a product win independent of points.**

**`blueprint_saved` (50) — the cheapest path to cloud sync.**
Verifies `user_documents WHERE doc_type='blueprint'`. A mobile vault entry is small (text + one
image) compared with a comic, so this is the low-risk way to prove out a mobile→Panel Haus write
path. Users get a vault that survives cache eviction — which today it does **not**.
**Cost: 2–3 days, including the asset upload for the entry's image.**

### Tier 3 — the real work, worth doing for its own reasons

**`comic_finished` / `comic_3_pages` / `comic_10_pages` (50 / 75 / 150) — publish comics to Panel Haus.**
Verifies `projects.page_count >= N` **and** `assets` count `>= N` (`kind='image'`, `status='ready'`).

Better news than expected: Panel Haus already exposes everything needed —
`api/assets/upload-init.js` → `api/assets/commit.js` for images, and `api/projects/index.js`
accepts **POST** (Clerk-authed, rate-limited). So this is *calling four existing endpoints*, not
building a sync service on Panel Haus.

Mobile also already produces a desktop-compatible package (`src/services/exportComicService.ts`),
so the mapping work is largely done.

**Do this for cloud backup, not for the points.** Mobile comics currently live only in IndexedDB,
which browsers evict under storage pressure — a user can lose everything. "Publish to Panel Haus"
solves a real data-loss risk and unlocks 275 points as a side effect.
**Cost: 1–2 weeks. Needs a decision on what "publish" means (explicit action vs auto-sync) and who
pays for the storage.**

## 6. Recommended sequence

1. **Ship nothing yet beyond the honesty line already in the card** ("points are shared with
   panelhaus.app"). It is accurate and costs nothing.
2. **Tier 1 both items** — a day's work for 225 points of reachable value and no Panel Haus changes.
3. **`contest`** — highest ongoing value because it repeats, and it hands mobile the contest hub.
4. **Decide on comic publishing as a product question** (cloud backup), and take the points as a
   bonus. Do not build it *for* the points; 275 one-time points do not justify a two-week sync
   feature, but not losing users' comics does.

## 7. What not to do

- **No client-attested awards.** Not for one action, not "just" for the 25-point one. The moment one
  exists, the honest ones are indistinguishable from it in the ledger.
- **Do not add mobile-only actions to `CARD_ACTIONS` with weaker evidence** than the desktop
  equivalent. One shared economy means one standard of proof.
- **Do not put any of these in `STEPS`.** `STEPS` drives the pips and `tierFor`, and the tier is the
  mint allowlist's ranking input. They belong in `EARNERS`, which cannot affect it.
- **Do not mirror point values by hand in more places than necessary.** They already live in
  `EARNERS` (display) and Panel Haus's table (truth); a third copy will drift.

## 8. Open questions for the Panel Haus side

1. **Is mobile *meant* to write to `projects` / `assets` / `user_documents`?** That is the
   architectural question underneath all of Tier 2–3, and it is Panel Haus's call, not ours.
2. **Storage cost** of mobile users publishing comics — who absorbs it, and is there a tier gate?
3. **Should `contest` entries from mobile be allowed at all**, or are contests deliberately a
   desktop-quality bar?
4. `contest` and `print_order` are repeatable, but both apps' cards render a row as permanently
   "done" once `breakdown > 0`. Shared trait, worth fixing in both — or accepting and documenting.

---

## Appendix — verified evidence sources (2026-08-14)

| Endpoint / table | Exists | Relevance |
|---|---|---|
| `api/contest/active.js` | ✅ | list live contests |
| `api/share-track.js` | ✅ Clerk-authed, server-validates `contest_id` | contest entry |
| `api/assets/upload-init.js`, `commit.js` | ✅ | image upload pipeline |
| `api/projects/index.js` | ✅ GET + **POST** | create a project |
| `api/assets/ingest-mg-handoff.js` | ✅ Clerk-authed, ticket-based | meme_shipped |
| `api/handoff/consume.js` | ✅ mints `handoffIngestTicket` into the payload mobile receives | meme_shipped |
| `api/lulu/create-order.js` + siblings | ✅ | print_order |
| `user_documents` (`doc_type='blueprint'`) | ✅ | blueprint_saved |
