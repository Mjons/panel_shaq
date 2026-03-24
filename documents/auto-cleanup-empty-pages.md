# Auto-Cleanup Empty Pages

## The Bug

When panels are deleted in the Director, the Layout Architect still shows pages referencing those deleted panel IDs. This creates pages with empty slots — or entirely empty pages.

### How It Happens

1. User generates 8 panels → Layout creates 2 pages (4 panels each)
2. User goes to Director, deletes 3 panels → 5 panels remain
3. User goes back to Layout → still 2 pages, but page 2 references 3 deleted panel IDs
4. Those slots render as "No image generated" or blank space
5. If all panels on a page were deleted, the entire page is empty

### Root Cause

Pages store `panelIds: string[]` — references to panel IDs. When `setPanels` removes a panel in Director, nobody updates `pages` to remove that ID. The two state arrays are independent.

---

## The Fix

**Sync pages whenever panels change.** Two parts:

### 1. Filter stale panel IDs from pages

When navigating to Layout (or on every render), remove any `panelId` from pages that doesn't exist in the current `panels` array.

### 2. Remove empty pages

After filtering, any page with `panelIds.length === 0` should be deleted entirely.

### 3. Re-fit layout templates

After filtering, if a page went from 4 panels to 2, the layout template (e.g., "4-grid") no longer matches. Auto-switch to the best template for the new count.

---

## Implementation

### Option A: useEffect in LayoutScreen (simplest)

Add a cleanup effect that runs when panels change:

```tsx
// In LayoutScreen, after the migration effect
useEffect(() => {
  if (pages.length === 0) return;
  const validIds = new Set(panels.map((p) => p.id));

  const cleaned = pages
    .map((page) => ({
      ...page,
      panelIds: page.panelIds.filter((id) => validIds.has(id)),
    }))
    .filter((page) => page.panelIds.length > 0)
    .map((page) => {
      // Re-fit template if panel count changed
      const tmpl = getTemplate(page.layoutId);
      if (tmpl && tmpl.panelCount !== page.panelIds.length) {
        return {
          ...page,
          layoutId: getDefaultLayoutId(page.panelIds.length, pageFormat),
        };
      }
      return page;
    });

  // Only update if something actually changed
  if (
    cleaned.length !== pages.length ||
    cleaned.some((p, i) => p.panelIds.length !== pages[i]?.panelIds.length)
  ) {
    setPages(cleaned);
  }
}, [panels]);
```

### Option B: Cleanup on panel delete in Director

In `handleDeletePanel`, also update pages after deleting:

```tsx
setPanels((prev) => prev.filter((_, i) => i !== index));
setPages((prev) =>
  prev
    .map((page) => ({
      ...page,
      panelIds: page.panelIds.filter((id) => id !== deletedId),
    }))
    .filter((page) => page.panelIds.length > 0),
);
```

### Recommendation: Both

- **Option B** keeps pages in sync immediately when deleting
- **Option A** catches any edge cases (e.g., panels deleted via other means, data corruption, stale saved projects)

---

## Edge Cases

| Case                                | Handling                                                       |
| ----------------------------------- | -------------------------------------------------------------- |
| All panels deleted                  | All pages removed, Layout shows "no pages" empty state         |
| Panel deleted from middle of a page | Remaining panels stay on that page, template re-fits           |
| Last panel on a page deleted        | Page removed, panels redistribute                              |
| Panel inserted in Director          | Pages don't auto-update (user repartitions manually in Layout) |
| Stale project loaded from IndexedDB | Cleanup runs on mount via Option A                             |

---

## Files to Change

| File                             | Change                                  |
| -------------------------------- | --------------------------------------- |
| `src/screens/LayoutScreen.tsx`   | Add cleanup useEffect (Option A)        |
| `src/screens/DirectorScreen.tsx` | Update pages on panel delete (Option B) |

**Effort: ~30 minutes**
