# PWABuilder Manifest Checklist

Cross-reference between what PWABuilder shows and what the project already has.
Use this to fill out the PWABuilder editor so it matches the deployed manifest.

---

## Info Tab

- [x] **Name** — `Panelhaus — AI Comic Studio`
- [x] **Short Name** — `Panelhaus`
- [ ] **Id** — Change from `/shaq` to `/` (current deployed manifest uses `/`)
- [x] **Description** — Matches deployed manifest
- [x] **Background Color** — `#0F172A`
- [x] **Theme Color** — `#0F172A`

## Settings Tab

- [ ] **Start URL** — Change from `/shaq` to `/` (deployed manifest uses `/`)
- [ ] **Dir** — Select `ltr`
- [x] **Scope** — `/`
- [x] **Language** — English
- [x] **Orientation** — portrait
- [x] **Display** — standalone

## Platform Tab

- [ ] **IARC Rating ID** — Optional, leave blank unless you have one
- [x] **Prefer Related Applications** — `false`
- [ ] **Categories** — Check **entertainment** (done), also check **graphics** and **productivity** (deployed manifest includes all three: `entertainment`, `graphics`, `productivity`)
- [ ] **Shortcuts** — Optional; none currently configured

## Icons Tab (has warning!)

- [ ] **Fix "purpose" warning** — At least one icon needs `purpose: "any"`. Currently all three icons show in PWABuilder but none has purpose set to `any`. Edit the 192x192 and one of the 512x512 icons to set purpose to `"any"`. The third 512x512 should stay `"maskable"`.
  - Expected final icon list:
    - `icon-192.png` — 192x192, purpose: `any`
    - `icon-512.png` — 512x512, purpose: `any`
    - `icon-maskable-512.png` — 512x512, purpose: `maskable`
  - All three icon files already exist in `public/icons/`

## Screenshots Tab

- [ ] **Add screenshots** — PWABuilder shows none, but three already exist in `public/screenshots/`. Upload them:
  - `workshop.png` (863x1920) — label: "Write your comic story in the Workshop"
  - `director.png` (863x1920) — label: "Generate AI panels in the Director"
  - `editor.png` (863x1920) — label: "Add speech bubbles and export in the Editor"
  - Set `form_factor` to `narrow` for all three

---

## After Download

Once you download the manifest from PWABuilder, compare it against the
current source of truth at `dist/manifest.webmanifest` to make sure nothing
was lost or changed unexpectedly.
