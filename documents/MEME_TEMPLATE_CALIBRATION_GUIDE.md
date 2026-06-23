# Meme Template Calibration Guide

**What this is:** how to position the text captions for a meme template so they sit
correctly when a user edits it. Calibrated positions are stored in
`src/data/memeTextZones.ts` (the single source of truth, committed to the repo).

**Who does this:** an admin, using the in-app calibrator. No code editing is
required to _calibrate_ — only to _paste the result back_ into the data file.

---

## TL;DR — adding a new meme template (for other devs)

The whole flow, in order. Steps 1–2 and 5 are code (hand to Claude/an agent or do
by hand); steps 3–4 are the visual part only you can do by eye.

1. **Confirm the template exists on MemeGen.** Templates originate there — Panel
   Shaq only renders captions for ids it already knows.
2. **Wire it up (code):** drop the image into `public/templates/<templateId>.<ext>`
   and add a stub entry to `src/data/memeTextZones.ts` with the right `aspect`,
   `image`, and empty `zones: []` (see §5 for the exact shape).
3. **Run it so the template shows up:** restart `npm run dev` (or, if calibrating on
   prod, commit + deploy first — the gallery only lists templates that exist in the
   running build).
4. **Calibrate (visual, by eye):** open the gallery → tap the new template → **Add
   zone** per caption → drag/rotate/resize, type the default label, **A− / A+** for
   size → **Copy JSON** (full flow in §2).
5. **Bake it in (code):** paste the JSON back into the entry, **preserving the
   `image` line** (§3), then `npm run lint` and commit.

> ⚠️ **The calibrator is disabled in production** unless `VITE_MEME_ADMIN_SECRET` is
> set at build time (`adminGate.ts`). The easy path is to **calibrate in local dev**,
> where the secret defaults to `panelshaq-admin` — see §1.

**Analytics:** nothing to do. This repo uses Vercel Analytics only, and no event is
per-template — adding a template needs zero analytics work. (There is no PostHog
here.)

---

## ⚠️ Read first — the one rule that can destroy your work

**Do NOT re-run `scripts/generateMemeTextZones.mjs` after you've calibrated.**
That generator regenerates the _entire_ `memeTextZones.ts` from PanelHaus's seed
positions and will **overwrite every hand-calibrated zone**. It is a one-time
bootstrap. To add a single new template, add its entry by hand (see §5) — don't
regenerate.

---

## 0. Concepts (30 seconds)

- Each template has an entry in `src/data/memeTextZones.ts`, keyed by `templateId`:
  ```jsonc
  "drake-hotline-bling": {
    "aspect": 1,                       // image width / height (display only)
    "image": "drake-hotline-bling.jpg",// file in /public/templates/
    "zones": [ /* caption boxes */ ]
  }
  ```
- Zone coordinates are **normalized 0–1** (x,y = top-left of the box; width/height
  = fraction of the image). They are **resolution-independent** — only the image's
  **aspect ratio** matters, so a calibration holds for handoff images of any size.
- `fontSizeRatio` = font size as a fraction of the image **width**.
- The template **images** in `/public/templates/` are only for the admin gallery
  and the local stub — real users always get the handoff image.
- A zone's `text` here is the **branded / default** caption (derived from Comic-Pro2).
  You do **not** author internal/neutral captions here — on handoff, MemeGen sends
  per-brand overrides (`payload.captions: { match, text }[]`) and `MemeEditor` swaps a
  zone's text when its default matches (by normalized text). DeadFellaz sends none →
  defaults are kept. So calibration here is about **positions**, not brand wording.

---

## 1. The calibration link (how to get it)

The calibrator/gallery lives at the `/c/from-meme` route, unlocked with the admin
secret. URL shape:

```
<HOST>/c/from-meme?admin=<SECRET>&gallery=1
```

- **`<SECRET>`** = the value of `VITE_MEME_ADMIN_SECRET`. In local dev the default
  is `panelshaq-admin`. In production set your own (see `.env.example`).
- **`&gallery=1`** opens the grid of all templates (no handoff token needed).

Pick `<HOST>`:

| Where                     | HOST                         | Copy JSON works how                                    |
| ------------------------- | ---------------------------- | ------------------------------------------------------ |
| Desktop, local            | `http://localhost:3000`      | Copies straight to clipboard (secure context)          |
| Phone, local (same Wi-Fi) | `http://<LAN-IP>:3000`       | Use the on-screen textarea (LAN-HTTP blocks clipboard) |
| Production                | `https://shaq.panelhaus.app` | Copies straight to clipboard (HTTPS)                   |

**Finding your LAN IP:** run `npm run dev` and read the **`Network:`** line it
prints (e.g. `http://192.168.2.228:3000/`), or run `ipconfig` (Windows) and use the
IPv4 address. The phone must be on the **same Wi-Fi**.

Examples:

- Desktop: `http://localhost:3000/c/from-meme?admin=panelshaq-admin&gallery=1`
- Phone: `http://192.168.2.228:3000/c/from-meme?admin=panelshaq-admin&gallery=1`

---

## 2. Calibrate an existing template (the normal flow)

1. **Start the dev server:** `npm run dev` (on the machine serving the app).
2. **Open the gallery link** (§1) — on the device you want to calibrate on. Phone
   and desktop give the same result (coords are aspect-based), so use whichever is
   comfier. The phone shows the real mobile rendering; the desktop makes Copy JSON
   one-tap.
3. **Tap the template** in the grid. It opens in the calibrator over its image.
4. **Position each caption** using the handles on the selected zone:
   - **✥ (top-left)** — drag to move.
   - **↻ (top-right)** — drag to rotate; **double-tap to reset to 0°**.
   - **⤡ (bottom-right)** — drag to resize the box.
5. **Set the caption's default text** in its row at the bottom (the `label` field).
   Use realistic placeholder text (it's what users see before they edit).
6. **Set font size** with the **`A− / A+`** buttons in each zone's row.
7. **Add / remove zones** if needed: **Add zone** / **Remove last** buttons. (Only
   do this if the template genuinely needs a different number of captions.)
8. **Tap “Copy JSON.”**
   - Desktop/HTTPS: it's now on your clipboard.
   - Phone/LAN-HTTP: it also appears in a **textarea** below the button — **tap the
     box (it selects all) → Copy**.

---

## 3. Bake the result into the repo

Paste the copied block into `src/data/memeTextZones.ts`, **replacing that
template's existing entry**.

**Important:** Copy JSON emits only `aspect` + `zones`. The committed entry also
has an **`image`** field — **keep the existing `image` line**. So in practice you
update the `aspect` and `zones` values but leave `"image": "..."` intact.

(If you hand the JSON to a developer/agent to paste, they'll preserve `image`
automatically.)

Optional tidy: round long `fontSizeRatio` floats (e.g. `0.06348746…`) to 4 decimals
(`0.0635`) — visually identical, keeps the file clean.

---

## 4. Verify

Reload the **non-admin** stub for that template and confirm the captions sit right:

```
<HOST>/c/from-meme?stub=1&template=<templateId>
```

For a true check against a real generated meme (not the clean template image), use
the image override:

```
<HOST>/c/from-meme?stub=1&template=<templateId>&img=<public-image-url>&w=<W>&h=<H>
```

---

## 5. Add a brand-new template (not yet in the registry)

1. **Add the image** to `public/templates/<templateId>.<ext>` (copy from MemeGen /
   Comic-Pro2, keeping the same `templateId` used by the handoff).
2. **Add a stub entry** to `src/data/memeTextZones.ts` (so it shows in the gallery):
   ```jsonc
   "<templateId>": {
     "aspect": <imageWidth / imageHeight>,
     "image": "<templateId>.<ext>",
     "zones": []
   }
   ```
3. Open the gallery → tap the new template → **Add zone** for each caption →
   calibrate (§2) → Copy JSON → paste back (§3).

> Do **not** regenerate via the script to add one template — it would wipe all your
> calibrations. Hand-add the entry instead.

---

## 6. Gotchas

- **Secure context for Copy:** `navigator.clipboard` only works on HTTPS or
  `localhost`. On a plain-HTTP LAN IP, both Copy JSON (calibrator) and Copy (user
  editor) fall back — Copy JSON shows the textarea; user Copy downloads instead.
- **Preserve `image`** when pasting (Copy JSON doesn't include it).
- **Never re-run the generator** after calibrating (see top warning).
- **Normalized coords** mean a phone-calibrated template lines up on desktop and on
  any handoff image of the same aspect.
