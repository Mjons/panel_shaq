# Friction Audit — Panel Shaq

Full UX/bug/rough-edge sweep of every screen and service. Prioritized by severity.

---

## Critical (App-Breaking)

| #   | Issue                                           | Where                                   | Detail                                                                                                                                                                                                  |
| --- | ----------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Silent API failures**                         | `geminiService.ts`                      | All `apiPost` calls catch errors and log to console only. User gets zero feedback — panel just stays empty, story stays unpolished. No toasts, no error banners.                                        |
| 2   | **Export history blows localStorage quota**     | `EditorScreen.tsx`                      | Export history stores full base64 PDFs/PNGs in localStorage. Each export is several MB. After a few exports, quota overflows and other saves fail silently. Should use IndexedDB or not store raw data. |
| 3   | **No error boundary on lazy screens**           | `App.tsx`                               | `<Suspense>` has a fallback but no `<ErrorBoundary>`. If a lazy-loaded screen throws, the entire app white-screens instead of recovering.                                                               |
| 4   | **Race condition in auto-save**                 | `App.tsx`                               | `saveCurrentProject` fires on an interval with a large dependency array. Rapid state changes can spawn overlapping IndexedDB writes that corrupt data.                                                  |
| 5   | **Panels missing `bubbles` field crash Editor** | `geminiService.ts` → `EditorScreen.tsx` | If hydrated panel data lacks the `bubbles` array (e.g., old data format), `panel.bubbles.map(...)` throws. No fallback.                                                                                 |

---

## High (Lost Work / Data Corruption)

| #   | Issue                                                        | Where                                                         | Detail                                                                                                                                         |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | **Layout repartition silently discards page customizations** | `LayoutScreen.tsx`                                            | Changing panels-per-page regenerates all pages with new IDs. Any manual layout tweaks are gone with no warning.                                |
| 7   | **No file size validation on uploads**                       | `WorkshopScreen.tsx`, `VaultScreen.tsx`, `DirectorScreen.tsx` | Users can upload 50MB images. No size check. Causes IndexedDB quota issues and UI hangs.                                                       |
| 8   | **Project metadata index can desync**                        | `projectStorage.ts`                                           | If IndexedDB save succeeds but the localStorage metadata update fails, the project list goes out of sync. No rollback.                         |
| 9   | **Bubble positions break on aspect ratio change**            | `EditorScreen.tsx`                                            | Bubbles use percentage coords relative to the panel. If the panel's aspect ratio changes or image is zoomed, bubbles drift to wrong positions. |
| 10  | **No auto-save status indicator**                            | `App.tsx`                                                     | Auto-save runs silently. User has no way to know if save succeeded or failed. No "Saved" / "Saving..." badge.                                  |
| 11  | **Story "word" count actually counts characters**            | `WorkshopScreen.tsx`                                          | Label says "2000 Words" but checks `story.length` (characters). 2000 chars ≈ 350 words. Limit is 5x more restrictive than advertised.          |

---

## Medium (Unexpected Behavior)

| #   | Issue                                                   | Where                | Detail                                                                                                    |
| --- | ------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| 12  | **No loading state for character image upload**         | `WorkshopScreen.tsx` | FileReader is async but UI shows no spinner. Large images freeze the UI.                                  |
| 13  | **"Drafts" button does nothing**                        | `WorkshopScreen.tsx` | Button is visible, clickable, and completely non-functional. Confuses users.                              |
| 14  | **"Help" button does nothing**                          | `Navigation.tsx`     | Same — visible, no handler.                                                                               |
| 15  | **Camera angle "None" appends "None" to prompt**        | `DirectorScreen.tsx` | Selecting "None" still concatenates the string "None" into the image generation prompt.                   |
| 16  | **Custom char refs accumulate unbounded**               | `DirectorScreen.tsx` | No limit on uploaded reference images per panel. 50+ refs degrades performance.                           |
| 17  | **Panel description has no length limit**               | `DirectorScreen.tsx` | Story has a 2000-char limit but panel descriptions accept unlimited text.                                 |
| 18  | **Style ref auto-re-enables after manual disable**      | `DirectorScreen.tsx` | `useEffect` re-enables style ref when characters are added, even if user explicitly disabled it.          |
| 19  | **Multiple exports can fire simultaneously**            | `EditorScreen.tsx`   | Rapid clicks before `isExporting` state updates can queue multiple overlapping exports.                   |
| 20  | **Export size display is inflated ~33%**                | `EditorScreen.tsx`   | Size calculated from base64 string length, not decoded binary. Displayed size is always wrong.            |
| 21  | **Share "Copy Link" copies the app URL, not the comic** | `ShareScreen.tsx`    | "Copy App Link" copies `window.location.href`. Comic data isn't in the URL. Link is useless for sharing.  |
| 22  | **Image compression fallback is silent**                | `geminiService.ts`   | `compressImage` falls back to original on error. User doesn't know compression failed; image stays large. |
| 23  | **Empty story shows "Estimated: 4 Panels"**             | `WorkshopScreen.tsx` | Should show 0 or hide the estimate when story is blank.                                                   |
| 24  | **Bubble text overflows container**                     | `EditorScreen.tsx`   | Long single words overflow the bubble's `max-w-[100px]` without wrapping or truncation.                   |

---

## Low (Rough Edges / Polish)

| #   | Issue                                             | Where                                    | Detail                                                                                        |
| --- | ------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| 25  | **No keyboard shortcuts**                         | App-wide                                 | No hotkeys for generate, export, save, undo. Everything requires mouse.                       |
| 26  | **No undo/redo**                                  | App-wide                                 | Mistakes (wrong character, deleted panel) are permanent.                                      |
| 27  | **No lazy-loading on panel images**               | `DirectorScreen.tsx`, `LayoutScreen.tsx` | All images load immediately even if off-screen.                                               |
| 28  | **No focus management on modal open**             | `VaultScreen.tsx`, `WorkshopScreen.tsx`  | Modals open but keyboard focus stays behind them.                                             |
| 29  | **Touch targets too small on mobile**             | Multiple files                           | Many icon-only buttons lack 48x48px minimum touch area.                                       |
| 30  | **Vault search doesn't highlight matches**        | `VaultScreen.tsx`                        | Filter works but no visual indicator of which part matched.                                   |
| 31  | **Project name can be set to empty string**       | `App.tsx` / `ProjectManager.tsx`         | No validation — shows blank in project list.                                                  |
| 32  | **Export settings display is hardcoded**          | `EditorScreen.tsx`                       | Shows "300 DPI" / "PDF (HQ)" but these aren't configurable and don't reflect actual settings. |
| 33  | **"Continue Story" insert label is ambiguous**    | `DirectorScreen.tsx`                     | Could be confused with "advance to next step." Consider "Add Next Panel".                     |
| 34  | **Bubble tail direction has no visual preview**   | `EditorScreen.tsx`                       | User has to guess which direction the tail points.                                            |
| 35  | **Long character names have no tooltip**          | `DirectorScreen.tsx`                     | Names truncate with CSS but no `title` attribute for hover.                                   |
| 36  | **Workshop placeholder text is a full paragraph** | `WorkshopScreen.tsx`                     | Makes the textarea look cramped before typing.                                                |

---

## Recommended Fix Order

**Batch 1 — Stop silent failures:**

- Add a toast/notification system for API errors (#1)
- Add error boundary wrapping screens (#3)
- Guard against missing `bubbles` on hydration (#5)

**Batch 2 — Protect user work:**

- Move export history to IndexedDB (#2)
- Add auto-save status indicator (#10)
- Add confirmation before layout repartition (#6)
- File size validation on uploads (#7)

**Batch 3 — Fix misleading UI:**

- Fix word/char count label (#11)
- Remove or implement Drafts/Help buttons (#13, #14)
- Fix export size calculation (#20)
- Fix empty-story panel estimate (#23)

**Batch 4 — Polish:**

- Keyboard shortcuts, undo/redo, lazy images, focus management
