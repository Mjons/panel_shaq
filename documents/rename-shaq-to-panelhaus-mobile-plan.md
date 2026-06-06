# Rename "Shaq" → "Panel Haus Mobile" / `m.panelhaus.app`

**Goal:** Retire the "Panel Shaq" brand and the `shaq.panelhaus.app` subdomain across this repo, replacing them with **"Panel Haus Mobile"** (display name) and **`m.panelhaus.app`** (URL). The main Panel Haus (desktop) side is already being scrubbed; this plan covers the mobile repo.

**Status:** Planning only — nothing changed yet. ~525 hits across 78 files.

---

## The critical distinction: brand vs. internal identifiers

Not every occurrence of "shaq" is the same kind of thing. A naive global find/replace **will lose user data and break external contracts.** Hits sort into four tiers:

| Tier | What                                                                                 | Safe to rename?                                                                     |
| ---- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 1    | User-facing **display strings** ("Panel Shaq" in UI/meta)                            | ✅ Yes — pure cosmetic                                                              |
| 2    | The **subdomain / URLs** (`shaq.panelhaus.app`)                                      | ⚠️ Yes, but coordinate with DNS + deploy + upstream                                 |
| 3    | **External / cross-repo contracts** (switcher key, export `source`, TWA `packageId`) | ⚠️ Conditional — see each item                                                      |
| 4    | **Internal persistence keys** (`panelshaq_*` localStorage, IndexedDB `panelshaq`)    | ❌ **No** — renaming silently wipes every existing user's projects, vault, settings |

The single most important rule in this whole effort:

> **Do NOT rename the `panelshaq_*` localStorage keys or the `panelshaq` / `panelshaq_projects` IndexedDB databases.** They are storage namespaces, not brand text. Existing users' stories, characters, panels, saved projects, and settings live under those keys. Changing the strings orphans all of it. If we ever _must_ rename them, it requires an explicit one-time migration (read old key → write new key → delete old), which is a separate, riskier project. **Recommendation: leave Tier 4 exactly as-is.**

---

## Tier 1 — Display strings (safe; do these)

User-visible "Panel Shaq" → **"Panel Haus Mobile"**. (Note the app's PWA name is already "Panelhaus" in some places — keep that where it reads as the product family; use "Panel Haus Mobile" where it specifically named the mobile app.)

- [index.html](index.html#L99) — `PANEL SHAQ` splash wordmark → `PANEL HAUS` (matches the haus-switcher wordmark style). Lines 12/37 already say "Panelhaus" — leave.
- [metadata.json](metadata.json#L2) — `"name": "Panel Shaq"` → `"Panel Haus Mobile"`.
- [src/components/EmailGate.tsx](src/components/EmailGate.tsx#L60) — "Welcome to Panel Shaq" and line 156 "keep you updated on Panel Shaq".
- [src/components/Navigation.tsx](src/components/Navigation.tsx#L259) — "Panel Shaq uses Google Gemini…".
- [src/screens/SettingsScreen.tsx](src/screens/SettingsScreen.tsx#L141) — "You're using Panel Shaq's hosted service."
- [src/screens/ShareScreen.tsx](src/screens/ShareScreen.tsx#L81) — `title: "Panel Shaq Comic"` (Web Share title) → "Panel Haus Comic".
- Code comments that say "Panel Shaq" / "Shaq" (no behavior): [src/main.tsx](src/main.tsx#L19), [src/from-meme/makeComic.ts](src/from-meme/makeComic.ts#L4), [src/from-meme/zoneTypes.ts](src/from-meme/zoneTypes.ts#L1), [src/from-meme/TextZonesOverlay.tsx](src/from-meme/TextZonesOverlay.tsx#L6), [src/from-meme/useHandoffPayload.ts](src/from-meme/useHandoffPayload.ts#L7), [scripts/generateMemeTextZones.mjs](scripts/generateMemeTextZones.mjs#L3). Low priority but cheap.

**Verify:** `npm run lint` (tsc) + visual grep that no UI string still says "Panel Shaq".

---

## Tier 2 — Subdomain / URLs (`shaq.panelhaus.app` → `m.panelhaus.app`)

These only work if `m.panelhaus.app` is actually provisioned (DNS + Vercel domain) and the old subdomain redirects. **Sequence the code change to land with the infra change**, otherwise links 404.

- [twa-manifest.json](twa-manifest.json) — `host` (L3), `iconUrl` (L16), `maskableIconUrl` (L17), `webManifestUrl` (L27), `fullScopeUrl` (L36). **See Tier 3 for `packageId` — that one does NOT change.**
- [public/robots.txt](public/robots.txt#L4) — `Sitemap: https://shaq.panelhaus.app/sitemap.xml`.
- [src/hausbar-mock.ts](src/hausbar-mock.ts#L26) — dev switcher `href: "https://shaq.panelhaus.app"` (also see Tier 3 for its `key`/`label`).

**Open question for the user:** Is `m.panelhaus.app` the confirmed final URL, and is it live yet? If not, hold Tier 2 until it is.

---

## Tier 3 — External / cross-repo contracts (coordinate before touching)

Each of these is a handshake with something outside this repo. Get the value from the other side first.

1. **Cross-app switcher key.** [src/components/Navigation.tsx](src/components/Navigation.tsx#L52) mounts `<haus-switcher current="shaq">`, and the dev mock [src/hausbar-mock.ts](src/hausbar-mock.ts#L24-L26) defines `key: "shaq"` / `label: "Panel Shaq (Mobile)"`. The real switcher is served by the **upstream** `panelhaus.app/embed/hausbar.js` (another team). The `current` value must match whatever key that embed expects after _their_ scrub. **Action:** confirm the new key with the Panel Haus team (likely `"mobile"` or `"m"`), then set both the `current=` attribute and the mock's `key`/`label`/`href` to match. Don't guess — a mismatch just means the switcher won't highlight "you are here."

2. **TWA `packageId`.** [twa-manifest.json](twa-manifest.json#L2) — `"packageId": "app.panelhaus.shaq.twa"`. Normally permanent (changing it creates a brand-new Play listing), **but the user has confirmed we'll resubmit to Google Play**, so this is free to change → `app.panelhaus.mobile.twa` (or similar). Land it with the other twa-manifest URL edits in Tier 2. The keystore path (L20) is a local machine path — leave.

3. **Export `source` field.** [src/services/exportComicService.ts](src/services/exportComicService.ts#L229) — `source: "panelshaq"` in the `.comic` package metadata. The desktop importer may branch on this string. **Action:** check `documents/PANEL_SHAQ_EXPORT_COMPATIBILITY.md` and the desktop import code before changing. If the importer string-matches `"panelshaq"`, either keep it or change both sides together. **Recommendation: leave unless the desktop team confirms they accept a new value.**

4. **Admin secret default.** [src/from-meme/adminGate.ts](src/from-meme/adminGate.ts#L14) — dev default `"panelshaq-admin"` and flag `"panelshaq_admin"`. Internal; renaming is harmless but pointless and the flag is Tier-4-like (a sessionStorage key). **Recommendation: leave.**

---

## Tier 4 — Internal persistence keys (DO NOT RENAME)

**Decision (user-confirmed): leave all of these as-is** — they don't affect anything front-facing, and renaming them = data loss for existing users. Listed here so reviewers know they were considered and deliberately skipped. All of these are storage namespaces, not brand text.

- All `panelshaq_*` localStorage keys: auth mode, story, vault entries, panels, pages, page format, style ref, settings, project id/name, onboarding-dismissed flags, tips, email, etc. — across [src/App.tsx](src/App.tsx), [src/screens/\*](src/screens/), [src/components/Tip.tsx](src/components/Tip.tsx#L6), [src/components/EmailGate.tsx](src/components/EmailGate.tsx), [src/services/geminiService.ts](src/services/geminiService.ts#L101).
- IndexedDB: `panelshaq` ([src/hooks/useIndexedDBState.ts](src/hooks/useIndexedDBState.ts#L3)) and `panelshaq_projects` / `panelshaq_project_index` ([src/services/projectStorage.ts](src/services/projectStorage.ts#L29-L32)).
- Analytics dedup keys `panelshaq_tracked_*`, `panelshaq_visited` ([src/services/analytics.ts](src/services/analytics.ts)) — note the actual emitted event names (`cold_landing`, etc.) contain no "shaq", so analytics dashboards are unaffected.
- sessionStorage meme keys `panelshaq_meme_work:*`, `panelshaq_meme_handoff` ([src/from-meme/MemeEditor.tsx](src/from-meme/MemeEditor.tsx), [src/from-meme/useHandoffPayload.ts](src/from-meme/useHandoffPayload.ts#L16)).
- `package.json` / `package-lock.json` `"name": "panel-shaq"` — the npm package name is internal-only (never published); renaming churns the lockfile for no benefit. **Recommendation: leave**, or rename to `panel-haus-mobile` only if we want tidiness (low priority, do in isolation).
- CSS class `.panel-shaq-gradient` ([src/index.css](src/index.css#L42), used in [src/screens/WorkshopScreen.tsx](src/screens/WorkshopScreen.tsx#L554)) — purely internal; rename both occurrences together or leave. Cosmetic.

---

## Tier 5 — Documentation (bulk, low risk, do last)

~60 files under [documents/](documents/) plus [CHANGELOG.md](CHANGELOG.md) and [CLAUDE.md](CLAUDE.md) reference "Panel Shaq" / "Shaq". These are archives and design notes (not shipped).

- **`documents/` archives & changelogs**: historical. Recommendation: **leave them as-is** — they record what was true at the time, and rewriting history adds noise. Optionally add a one-line note at the top of the docs index that "Panel Shaq" was renamed to "Panel Haus Mobile" on <date>.
- **[CLAUDE.md](CLAUDE.md)**: this IS read every session and should reflect current reality. Update the product name and any live references (but keep storage-key names accurate — they really are still `panelshaq_*`). Several filenames in `documents/` themselves contain "Panel-Shaq" (e.g. `Panel-Shaq-—-Product-Documentation.md`); renaming files is optional and breaks any external links — skip unless asked.
- **[CHANGELOG.md](CHANGELOG.md)**: leave existing entries (history); add a new entry describing this rename.

---

## Suggested execution order

1. **Confirm remaining prerequisites:**
   - Is `m.panelhaus.app` the final URL, and is it live? (gates Tier 2)
   - What's the new `<haus-switcher>` key? (gates Tier 3 #1)
   - Does the desktop importer match on `source: "panelshaq"`? (decides Tier 3 #3)
   - ~~TWA on Google Play?~~ **Resolved:** resubmitting, so `packageId` is free to change.
2. **Tier 1** display strings — self-contained, ship anytime. `npm run lint`.
3. **Tier 3 #1** switcher key — once confirmed.
4. **Tier 2** URLs + TWA `packageId` — land with the DNS/redirect change, not before.
5. **CLAUDE.md + CHANGELOG entry** (Tier 5 essentials).
6. **Explicitly skip** Tier 4 (storage keys) and the npm package name unless a follow-up decision says otherwise.

## Verification checklist

- [ ] `npm run lint` clean.
- [ ] Grep `-i shaq` returns only: Tier 4 storage keys and archived docs (everything we deliberately kept).
- [ ] App boots, loads an existing project (proves Tier 4 keys untouched), email gate + settings show "Panel Haus Mobile".
- [ ] `/c/from-meme` handoff still consumes a token (proves meme storage keys untouched).
- [ ] Switcher highlights the mobile entry (if upstream embed is live).
- [ ] `.comic` export still imports on desktop (proves `source` contract intact).
