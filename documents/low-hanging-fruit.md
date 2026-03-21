# Low-Hanging Fruit

Quick wins that can be knocked out in a single session. High impact, low effort.

---

## 1. Thumbnail Fix (15 min)

**Problem:** `projectStorage.ts` truncates the thumbnail to 200 chars + `"..."` making it an invalid data URL. Every project thumbnail in the ProjectManager grid is broken.

**Fix:** Generate an actual small thumbnail (resize to ~100px wide via canvas) instead of truncating the base64 string.

**File:** `src/services/projectStorage.ts` (saveProject), or generate thumbnail at capture time.

---

## 2. Auto-Save Overwrites createdAt (15 min)

**Problem:** Every auto-save call overwrites `createdAt` with the current timestamp. Projects all show "created just now."

**Fix:** Only set `createdAt` when it doesn't already exist on the project object.

**File:** `src/App.tsx` (wherever SavedProject is constructed for auto-save)

---

## 3. Font Loading (30 min)

**Problem:** Google Fonts are render-blocking. First paint is delayed while fonts download.

**Fix:** Add `&display=swap` to the Google Fonts URL (or `font-display: swap` in CSS). Optionally preconnect to `fonts.googleapis.com` and `fonts.gstatic.com`.

**File:** `index.html` or wherever fonts are loaded.

---

## 4. PanelCard Re-render Fix (1 hr)

**Problem:** All PanelCards re-render when any single panel updates (e.g., typing in one card re-renders all cards). Noticeable lag with 6+ panels.

**Fix:** Wrap `PanelCard` in `React.memo` and ensure `onUpdatePanel` / `onQueueGenerate` callbacks are stable (via `useCallback` with panel ID).

**File:** `src/screens/DirectorScreen.tsx`

---

## 5. Request Timeouts (2-4 hrs)

**Problem:** Gemini API calls can hang indefinitely with no feedback. Users see a spinner forever.

**Fix:** Wrap all `fetch()` calls in the service layer with `AbortController` + configurable timeout (60s for image gen, 30s for text). Show "Request timed out" toast on abort.

**Files:** `src/services/geminiService.ts`, `api/*.ts`

---

## 6. Vault Image Lazy Loading (1 hr)

**Problem:** VaultScreen renders all character/environment images at once. With 10+ entries each containing base64 images, this is a lot of DOM paint on tab switch.

**Fix:** Use `loading="lazy"` on `<img>` tags, or only render visible entries with a simple intersection observer or virtualized list.

**File:** `src/screens/VaultScreen.tsx`

---

## 7. Character Adherence Prompt Restore (2-4 hrs)

**Problem:** Character consistency regressed. Documented root causes:

- Model changed from an earlier version
- Prompt was weakened during style simplification
- `imageSize: "1K"` config was lost

**Fix:**

- Restore aggressive adherence language in the generation prompt
- Add `imageSize: "1K"` back to Gemini config
- Consider reverting to the model version that produced better results

**Files:** `api/generate-image.ts`, `api/final-render.ts`

---

## 8. Input Sanitization (1 hr)

**Problem:** Bubble text and vault entry names are rendered directly into the DOM. Low risk since it's all client-side, but still not clean.

**Fix:** Ensure all user-provided strings go through React's JSX rendering (which auto-escapes) and are never inserted via `dangerouslySetInnerHTML`. Audit for any `innerHTML` usage.

**Files:** `src/screens/EditorScreen.tsx`, `src/screens/VaultScreen.tsx`

---

## 9. Disabled Button Feedback (30 min)

**Problem:** When submit buttons are disabled (e.g., no story entered, no API key), the user gets no explanation — just a grayed-out button.

**Fix:** Add a tooltip or small helper text below disabled buttons explaining what's needed.

**Files:** `src/screens/WorkshopScreen.tsx`, `src/screens/DirectorScreen.tsx`

---

## 10. Help Button (1 hr)

**Problem:** Help button in the hamburger menu links to an external GitHub issues page. There's no in-app help.

**Fix:** Create a simple help overlay or modal showing:

- The 4-step workflow (Workshop → Director → Layout → Editor)
- How to add characters to the vault
- How to export your comic
- Link to report bugs

**File:** `src/components/Navigation.tsx` (help button handler), new `HelpModal` component

---

## Total Estimate

All 10 items: ~1-2 focused sessions (8-12 hours total)

Items 1-3 alone take 1 hour and fix the most visible jank.
