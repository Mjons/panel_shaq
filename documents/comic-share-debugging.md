# .comic File Share Sheet Not Appearing — Debug Exploration

## Symptom

Tapping "Share .comic File" on the Share screen silently downloads the file instead of opening the native share sheet. This happens even after fixing the file extension (`.comic`) and MIME type (`application/octet-stream`).

## Current Code

```typescript
const file = new File([json], `${safeName}.comic`, {
  type: "application/octet-stream",
});

if (navigator.canShare?.({ files: [file] })) {
  await navigator.share({ title, text, files: [file] });
  return;
}
// Falls through to <a>.click() download
```

## Why `canShare()` Returns False

`navigator.canShare({ files: [file] })` checks if the browser/OS can share a file with the given MIME type and extension. The problem is likely one of:

### Theory 1: `.comic` extension is unknown to the OS

iOS and Android maintain a registry of known file extensions. `.comic` is not a registered extension. When the OS sees an unknown extension, some browsers return `false` from `canShare()` even with `application/octet-stream`.

**Test:** Change the extension to `.zip` or `.json` (both well-known) and see if the share sheet appears.

### Theory 2: `application/octet-stream` is blocked by canShare

Some mobile browsers (especially older Chrome on Android) don't support sharing `application/octet-stream` files. They only allow known types like `image/*`, `text/*`, `application/pdf`.

**Test:** Try `application/json` as the MIME type (which the content actually is) but with `.comic` extension.

### Theory 3: File size too large for share

The `.comic` file contains base64-encoded panel images, making it potentially very large (10-50MB+). `navigator.share()` has file size limits that vary by platform:

- iOS Safari: ~100MB
- Chrome Android: varies, some report failures above 5-10MB

**Test:** Create a minimal .comic file (1 panel, tiny image) and see if share works.

### Theory 4: `canShare` is available but always returns false for files

Some browsers implement `navigator.canShare` but only support sharing text/URLs, not files. `canShare({ files: [...] })` returns `false` even though `canShare({ text: "hello" })` returns `true`.

**Test:** Log `navigator.canShare?.({ files: [file] })` to console before the if-check.

### Theory 5: The browser doesn't support the Web Share API Level 2 (files)

Web Share Level 1 = text/URL only. Level 2 = files. Not all browsers support Level 2.

- Safari iOS 15+: supports files ✓
- Chrome Android 93+: supports files ✓
- Firefox Android: does NOT support file sharing
- Samsung Internet: varies

## Diagnostic Approach

Add temporary logging to identify exactly where it fails:

```typescript
export async function downloadComicFile(json: string, projectName: string) {
  const safeName = (projectName || "Untitled").replace(/[^a-zA-Z0-9-_ ]/g, "");

  // Try multiple file configurations
  const configs = [
    { name: `${safeName}.comic`, type: "application/octet-stream" },
    { name: `${safeName}.json`, type: "application/json" },
    { name: `${safeName}.zip`, type: "application/zip" },
  ];

  for (const config of configs) {
    const file = new File([json], config.name, { type: config.type });
    const canShare = navigator.canShare?.({ files: [file] });
    console.log(`canShare ${config.name} (${config.type}):`, canShare);
  }

  // ... rest of function
}
```

This will tell us exactly which combination the OS accepts.

## Likely Fix: Use `.json` Extension with Share Title as `.comic`

The most reliable approach for cross-platform file sharing:

```typescript
// Use .json extension (universally recognized) but display as .comic
const file = new File([json], `${safeName}.json`, {
  type: "application/json",
});

if (navigator.canShare?.({ files: [file] })) {
  try {
    await navigator.share({
      title: `${safeName}.comic`, // Display name shows .comic
      text: "Panelhaus comic project — open in panelhaus.app",
      files: [file],
    });
    return;
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
  }
}
```

The file itself is `.json` (which the OS knows how to handle), but the share title shows `.comic` so the recipient knows what it is.

## Alternative Fix: Blob URL Share

If `canShare` keeps failing, bypass it entirely by creating a shareable blob URL:

```typescript
const blob = new Blob([json], { type: "application/json" });
const url = URL.createObjectURL(blob);

// Open share sheet via intent URL on Android
// Or copy to clipboard as fallback
```

This is more fragile and platform-specific — not recommended unless the File approach truly doesn't work on the target device.

## Alternative Fix: Email/Signal Deep Links

If native share doesn't work, offer direct sharing buttons:

```typescript
// Email
const mailtoUrl = `mailto:?subject=${encodeURIComponent(safeName + ".comic")}&body=${encodeURIComponent("Open this in panelhaus.app")}`;
// Note: mailto can't attach files — would need a server-side upload + link

// Signal / WhatsApp
// These also can't receive files via URL scheme — need native share
```

This approach is limited because you can't attach files via URL schemes. The file would need to be uploaded to a server and shared as a link.

## Nuclear Option: Upload to Server, Share Link

If file sharing truly doesn't work:

1. Upload the `.comic` JSON to Supabase storage
2. Generate a short shareable URL
3. Share that URL via `navigator.share({ url })` (Level 1, universally supported)
4. Recipient opens the link → downloads the file

This always works but requires server infrastructure and the file is no longer local-only.

## Recommended Next Step

1. **Add the diagnostic logging** to see what `canShare` returns for each file type
2. **Test on the actual device** — check console output
3. If `.json` works but `.comic` doesn't → use `.json` with `.comic` in the title
4. If nothing works → the device/browser doesn't support Web Share Level 2 for files, and we need the toast fallback for the silent download
