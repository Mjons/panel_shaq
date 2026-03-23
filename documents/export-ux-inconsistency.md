# Export UX Inconsistency

## Problem

The export buttons in the Editor behave inconsistently on mobile:

- **"This Page" (PNG)** — silently downloads a file. No share sheet, no confirmation, no visual feedback that it worked. The file appears in the phone's Downloads folder but the user has no idea it saved.
- **"Share This Page"** — opens the native share sheet. User picks where to send it. Clear feedback.
- **"All Pages" (PDF)** — silently downloads via `pdf.save()`. Same problem as PNG — no indication it worked.
- **".comic" export (Share screen)** — calls `downloadComicFile()` which tries `navigator.share()` first (share sheet), then falls back to silent download. Inconsistent with the Editor exports.

The result: tapping "Download" feels broken on mobile because nothing visibly happens. The file saved, but there's no toast, no animation, no share sheet — just silence.

## Root Cause

### Editor exports use `<a>.click()` / `pdf.save()`

```typescript
// PNG export (EditorScreen.tsx ~837)
const link = document.createElement("a");
link.download = fileName;
link.href = imgData;
link.click();

// PDF export (EditorScreen.tsx ~799)
pdf.save(fileName);
```

Both trigger a browser download. On desktop this opens a "Save As" dialog or drops a file in Downloads with a browser notification. On mobile, the file silently appears in Downloads — no visible feedback in the app.

### .comic export uses `navigator.share()` first

```typescript
// exportComicService.ts ~256
if (navigator.canShare?.({ files: [file] })) {
  await navigator.share({ title: `${safeName}.comic`, files: [file] });
  return;
}
// Fallback: <a>.click() download
```

This is the better pattern — share sheet gives the user control and visible feedback.

## Options

### Option A: Use `navigator.share()` for all exports (Recommended)

Make all export buttons use the share sheet on mobile, falling back to direct download on desktop:

```typescript
const shareOrDownload = async (
  blob: Blob,
  fileName: string,
  mimeType: string,
) => {
  const file = new File([blob], fileName, { type: mimeType });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: fileName, files: [file] });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  // Fallback: direct download
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};
```

Then use it in both PNG and PDF exports:

```typescript
// PNG
const res = await fetch(imgData);
const blob = await res.blob();
await shareOrDownload(blob, fileName, "image/png");

// PDF
const pdfBlob = pdf.output("blob");
await shareOrDownload(pdfBlob, fileName, "application/pdf");
```

**Pros:** Consistent behavior. User always sees the share sheet on mobile. Can save to Files, AirDrop, share to apps, etc.
**Cons:** Extra tap on mobile (share sheet → Save to Files). Some users may just want a quick download without choosing.

### Option B: Add a toast notification after silent downloads

Keep the current download behavior but show a toast confirming the save:

```typescript
link.click();
addToast("Saved to Downloads", "success");
```

**Pros:** Minimal change. User gets feedback. No extra taps.
**Cons:** Doesn't solve the "where did it go?" problem on mobile. Users still have to find it in Downloads.

### Option C: Let the user choose per-button

Show both a Download icon and a Share icon on each button. Download does silent save + toast, Share opens the share sheet:

```
┌──────────────┐ ┌──────────────┐
│  ↓ Save      │ │  ↑ Share     │
│  This Page   │ │  This Page   │
│  PNG         │ │  PNG         │
└──────────────┘ └──────────────┘
```

**Pros:** Maximum flexibility.
**Cons:** Too many buttons. Clutters the UI.

### Option D: Unified "Save & Share" button

One button per format that always opens the share sheet. Rename from "Download" to "Save":

```
┌──────────────┐ ┌──────────────┐
│  This Page   │ │  All Pages   │
│  PNG         │ │  PDF         │
└──────────────┘ └──────────────┘
```

All buttons use `navigator.share()` on mobile, direct download on desktop. Remove the separate "Share" row entirely — it's redundant if every button already shares.

**Pros:** Cleaner UI. Fewer buttons. Consistent behavior.
**Cons:** Loses the quick-download-without-share-sheet option.

## Recommendation

**Option D** — Unify all export buttons to use `navigator.share()` on mobile and direct download on desktop. Remove the separate "Share" row. Fewer buttons, consistent behavior, clear feedback.

The Export section would simplify to:

```
EXPORT
┌──────────────┐ ┌──────────────┐
│  This Page   │ │  All Pages   │
│  PNG         │ │  PDF         │
└──────────────┘ └──────────────┘
```

Both buttons open the share sheet on mobile (where the user can pick "Save to Files", "AirDrop", "Messages", etc.) and trigger a direct download on desktop.

Add a toast on desktop: "Saved to Downloads" after the file is saved.

## Files to Modify

| File                                 | Change                                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `src/screens/EditorScreen.tsx`       | Use shared `shareOrDownload` helper for PNG/PDF exports, remove duplicate Share row |
| `src/services/exportComicService.ts` | Already uses the right pattern — no change needed                                   |

## The Real Problem: .comic Export

The PNG/PDF exports are fine — they download and the user expects that. The `.comic` export is the one that's broken. When tapping "EXPORT .COMIC FILE", the user expects to be able to share it to email, Signal, AirDrop, etc. Instead it silently downloads with no share sheet, or the share sheet doesn't appear.

### Why It's Broken

**File:** `src/services/exportComicService.ts` line 251

```typescript
const file = new File([json], `${safeName}.json`, {
  type: "application/json",
});
```

Two bugs:

1. **Wrong extension**: The `File` object is created with `.json` extension but shared with title `.comic`. Some platforms use the File's actual name (not the share title) to determine what apps can receive it. The mismatch may cause `canShare()` to return `false` or share targets to not recognize the file.

2. **Wrong MIME type**: `application/json` is correct for the content but some mobile share targets (email, Signal) may not offer to attach a `.json` file. Using `application/octet-stream` would make it more universally shareable as a generic file attachment.

3. **No feedback on fallback**: If `canShare()` returns `false` (common on some Android browsers), it falls back to `<a>.click()` which silently downloads. No toast, no indication anything happened.

### Fix

```typescript
const file = new File([json], `${safeName}.comic`, {
  type: "application/octet-stream",
});

if (navigator.canShare?.({ files: [file] })) {
  try {
    await navigator.share({
      title: `${safeName}.comic`,
      text: "Made with Panelhaus",
      files: [file],
    });
    return;
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
  }
}

// Fallback: direct download + toast
const url = URL.createObjectURL(file);
const link = document.createElement("a");
link.href = url;
link.download = `${safeName}.comic`;
link.click();
URL.revokeObjectURL(url);
// TODO: show toast "Saved to Downloads"
```

Changes:

- File name matches: `safeName.comic` everywhere (not `.json`)
- MIME type: `application/octet-stream` so email/Signal/etc. treat it as a generic file attachment
- Add `text: "Made with Panelhaus"` to share for context

### Also Consider: Rename the Button

The button says "EXPORT .COMIC FILE" with a Download icon. This implies "download to device". If the primary action is sharing (email, Signal, AirDrop), rename it:

```
[Share icon]  SHARE .COMIC FILE
```

Or split into two buttons:

```
┌──────────────┐ ┌──────────────┐
│  ↓ Save      │ │  ↑ Share     │
│  .comic      │ │  .comic      │
└──────────────┘ └──────────────┘
```

Save does direct download. Share opens the share sheet. User picks.

## Files to Modify

| File                                 | Change                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `src/services/exportComicService.ts` | Fix file extension (`.comic` not `.json`), MIME type (`application/octet-stream`), add share text |
| `src/screens/ShareScreen.tsx`        | Optionally split into Save + Share buttons, or change icon to Share2                              |
