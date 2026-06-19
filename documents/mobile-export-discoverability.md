# Mobile Export Discoverability — "the export button isn't responding"

**Date:** 2026-06-19
**Trigger:** A user (Tecno Pop 10, Chrome) reported that on the **Share** screen the "download or export the share panel image button isn't responding." Screenshot showed them sitting on the Share & Send screen: "Share Panel Images" displayed _"Generate some panels first to share"_, and "Send to Panelhaus Desktop" listed _"0 panel images, 1 vault entries, 2 pages."_

**Companion docs (read these too):**

- [[export-ux-simplification]] — consolidating the scattered Editor/Share export buttons into clear actions.
- [[export-ux-inconsistency]] — fixing the silent-download vs share-sheet inconsistency and the broken `.comic` share.

This doc is **additive**: those two cover _what the buttons do_ once you find them. This one is about the prior problem — **users can't find the export flow at all**, and when they land on Share with no panel images it _looks broken_.

---

## What actually happened (not a broken button)

There was no broken button. Two separate things combined to read as "nothing responds":

### 1. Export/Share isn't in the bottom nav

The bottom nav the user sees (`src/components/Navigation.tsx`, `BottomNav`) has **five** tabs:

```
[ Workshop ] [ Director ] [ Layout ] [ Editor ] [ Vault (globe) ]
   home       auto_stories  motion     view_quilt   public
```

`share` is **not** in the bottom nav. The only ways to reach the Share screen are the top-nav hamburger menu (`TopNav`, which _does_ list Share) or whatever path this user stumbled through. So the single screen literally named "Share & Send" — the one place a user goes to "get my comic out" — is hidden behind a menu, while the always-visible last tab is **World Vault**, an asset-management screen most first-session users have no reason to open.

Meanwhile the _other_ export path (per-page PNG/PDF) lives buried in the **Editor** sidebar (see [[export-ux-simplification]]), which is also not labeled "export."

Net: there is no obvious, persistent "export / share my work" destination anywhere in the primary navigation.

### 2. The Share screen shows dead text, not a disabled control

On [ShareScreen.tsx:135-262](../src/screens/ShareScreen.tsx#L135-L262), "Share Panel Images" only renders a button when `panelsWithImages.length > 0`. With zero rendered panel images it falls to:

```tsx
<p className="text-[10px] text-accent/30 text-center py-4">
  Generate some panels first to share
</p>
```

That's tiny, low-contrast hint text where a primary button should be. A user who came here _to export_ taps the region, nothing happens (it's not a control), and concludes "the button is broken." This user had **2 pages and 1 vault entry but 0 panel images**, so the section was empty for them specifically.

This is a real pattern worth fixing app-wide: **an empty primary action should be a disabled button with a label that tells you the next step**, not absent text.

---

## The owner's proposal

> "instead of the last tab being a world vault tab i should turn it into the export page"

Strongly endorse the direction. The Vault is a power-user / repeat-session feature; export is the **terminal step of the core loop** (`workshop → director → layout → editor → export`) and the funnel into the paid desktop product. It deserves the persistent slot far more than Vault does.

This also aligns with the stated strategy: **mobile is the onboarding + capture tool that funnels users to Panelhaus Desktop.** If mobile's job is to capture a creation and hand it off, then "send to desktop / share" must be the most discoverable thing on the screen — not hidden behind a hamburger while a globe icon sits in the nav.

---

## Options

### Option A — Replace the Vault bottom-nav slot with Export _(chosen)_

Swap the 5th bottom-nav tab from `vault` (globe) to `share`, renaming it **Export** with the `ios_share` icon (Material Symbols, matches the existing set; reads as "send out" which fits the desktop-handoff framing). Vault moves into **Workshop (step 1)**, nested — see [Vault's new home](#vaults-new-home) below.

```
[ Workshop ] [ Director ] [ Layout ] [ Editor ] [ Export ]
   home                                            ↑ ios_share
   └─ Vault nested here (step 1)
```

- **Pros:** One-line nav change; puts the funnel step in the thumb zone; matches the linear creation flow; the terminal nav slot now matches the terminal flow step.
- **Cons:** Existing users lose one-tap Vault — acceptable, since Vault belongs with story setup, not floating in the nav.
- **Touch:** `BottomNav` tabs array in [Navigation.tsx:217-223](../src/components/Navigation.tsx#L217-L223) (and the parallel list at [L34-39](../src/components/Navigation.tsx#L34-L39)); confirm `TAB_ORDER` / swipe order in [App.tsx](../src/App.tsx) still makes sense with Export as the terminal tab.

### Option B — Six tabs (keep Vault, add Export)

Add Export as a 6th bottom-nav icon alongside Vault.

- **Pros:** Nobody loses anything.
- **Cons:** Six targets is tight on a small phone (this user is on a budget device); dilutes the "linear flow" reading. Only do this if Vault telemetry shows real bottom-nav usage.

### Option C — Rename the Share screen to "Export" and make it the flow's endpoint

Independent of nav placement: the screen is titled "Share & Send" but its primary jobs are **export to desktop** and **save/share images**. Renaming to **Export** (or "Export & Share") and reordering so "Send to Panelhaus Desktop" leads — it's the strategic CTA — matches both user intent and business goal. Pairs naturally with A.

### Option D — Fix the empty states (do this regardless)

- Replace the dead "Generate some panels first to share" text with a **disabled button** carrying the same label, so the affordance is visible and obviously-not-yet-ready.
- Better: when there are no panel images, don't show an empty Share section at all — show a single CTA that routes back to Director ("Generate panels to share →").
- Minor real bug to fix while here: the `.comic` button is `disabled={panels.length === 0}` ([ShareScreen.tsx:292](../src/screens/ShareScreen.tsx#L292)) but the "includes" line counts `panels.filter(p => p.image)` ([L277](../src/screens/ShareScreen.tsx#L277)). A project with panels-but-no-images shows an **enabled** "SHARE .COMIC FILE" advertising "0 panel images." Gate on whatever the export actually needs and say so.

---

## Decisions (locked)

1. **Nav (A):** Vault bottom-nav slot → **Export** tab, `ios_share` icon.
2. **Vault's new home:** nested inside **Workshop (step 1)**, not the bottom nav — see below.
3. **Screen (C):** retitle "Share & Send" → **Export**, lead with "Send to Panelhaus Desktop."
4. **Empty states (D):** dead hint text → visible disabled buttons; fix the `.comic` enable/label mismatch.
5. **Consolidate (E):** the Export tab becomes the **single home for every export path**, including the GIF maker entry point — see inventory below.

---

## E — Consolidate every export path onto the Export tab

Right now exports are scattered across three places: the Editor sidebar (per-page PNG/PDF), the Share screen (panel images + `.comic`), and the GIF maker (reachable _only_ from inside the Editor). The Export tab should gather all of them so there is exactly one answer to "how do I get my comic out?"

What lands on the Export tab, in priority order (desktop handoff is the strategic CTA, so it leads):

| Block                                                          | Source today                       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Send to Panelhaus Desktop** (`.comic`)                       | Share screen                       | Lead CTA. Fix enable/label mismatch (D).                                                                                                                                                                                                                                                                                                                                                                                                |
| **Download / share comic pages** (PNG per page, PDF all pages) | Editor sidebar                     | **Pointer card (shipped).** The composed-page render (layout + bubbles) is welded to the live Editor DOM (`comicRef`, stepping `setSelectedPageIdx`), so a clean move would require extracting a standalone page-renderer from the 2.7k-line Editor. Instead the Export tab shows a "Download Comic Pages" card that routes to the Editor where export runs. Fully relocating it (true single destination) is the documented follow-up. |
| **Share panel images** (all + per-panel grid)                  | Share screen                       | Already here; just the empty-state fix (D).                                                                                                                                                                                                                                                                                                                                                                                             |
| **Make a GIF**                                                 | Editor → `onOpenGifEditor` overlay | Surface an entry button here. `GifEditorScreen` stays a full-screen overlay (not a tab) — the Export tab just calls the same `onOpenGifEditor` path (drives `gifEditorImages` in [App.tsx](../src/App.tsx)).                                                                                                                                                                                                                            |
| **Export History**                                             | Share screen                       | Already here; keep as the "downloads folder."                                                                                                                                                                                                                                                                                                                                                                                           |

This directly closes the second discoverability gap flagged in [[export-ux-simplification]] (per-page export buried in the Editor) and means the GIF maker — currently invisible unless you're deep in the Editor — finally has a findable entry point.

> **GIF maker plumbing:** it needs rendered panel images as input. On the Export tab, gate its button the same way as the other image actions (disabled with a "generate panels first" label when there are none), so it never becomes another dead control.

---

## <a id="vaults-new-home"></a>Vault's new home — Workshop, step 1

Vault leaves the bottom nav and nests inside **Workshop** (the first screen, where the story starts). Assets (characters/environments/props) are an _input_ to the story, so step 1 is where they belong — one tap from where they're used, not floating in global nav. Implementation can route to the existing `vault` screen/`setVaultAutoOpen` path ([App.tsx:561](../src/App.tsx)) from a Workshop affordance rather than a nav tab.

---

## Recommendation

Ship **A + C + D + E** as one "make export findable and complete" change:

1. **A** — Vault nav slot → **Export** (`ios_share`).
2. **C** — Retitle the screen **Export**, desktop handoff leads.
3. **D** — Empty states become visible disabled buttons; fix the `.comic` enable/label mismatch.
4. **E** — Move the GIF-maker entry onto the Export tab; add a pointer card for page PNG/PDF export (the renderer can't leave the Editor yet — see the table); Export History stays.
5. **Vault** nests into Workshop step 1.

Then layer the button-level cleanups from [[export-ux-simplification]] and [[export-ux-inconsistency]] on top. Order matters: **findable first, then complete, then coherent.** Getting the user to the screen is the bug they actually hit.

### Status: SHIPPED (2026-06-19)

A + C + D done; E shipped as GIF-entry + page-export pointer card; Vault confirmed already reachable from Workshop step 1 ([WorkshopScreen.tsx:291](../src/screens/WorkshopScreen.tsx#L291), [L363](../src/screens/WorkshopScreen.tsx#L363)), so it isn't stranded by leaving the bottom nav. **Follow-up:** extract a shared page-renderer so PNG/PDF can run on the Export tab directly (true single destination).

### Verification

- New user with 0 panels: bottom nav shows **Export**; tapping it lands on a screen where every action (desktop `.comic`, page download, share panels, make GIF) is **visible** — enabled ones work, not-ready ones are disabled with a "generate panels first" label. No dead-text region.
- After generating panels: all export controls enable; the `.comic` button's enable state and the "includes" line agree; "Make a GIF" opens the GIF editor.
- Vault is reachable from Workshop step 1.
- `npm run lint` clean.
