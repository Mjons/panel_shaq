import { track } from "../services/analytics";

// Share / Copy / Download for the flattened meme PNG.
//  - Share: Web Share API with files (the mobile-correct path; mirrors
//    ShareScreen.tsx). Falls back to download where unsupported.
//  - Copy: image → clipboard via ClipboardItem (replicating PanelHaus
//    shareService.js), with a download fallback for browsers without image
//    clipboard support (common on mobile Safari).
// Callers should pass an ALREADY-FLATTENED blob so the clipboard/share write
// runs inside the user gesture (mobile loses the gesture across an await).

export type ShareResult = "shared" | "downloaded" | "cancelled";
export type CopyResult = "copied" | "downloaded";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareImage(
  blob: Blob,
  filename: string,
): Promise<ShareResult> {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: "My meme", files: [file] });
      track("share_completed", { surface: "meme_share" });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
      // post-canShare rejection (size/deny) — fall through to download
    }
  }
  downloadBlob(blob, filename);
  track("share_completed", { surface: "meme_share_download" });
  return "downloaded";
}

export async function copyImage(
  blob: Blob,
  filename: string,
): Promise<CopyResult> {
  const clipboard = navigator.clipboard as Clipboard | undefined;
  if (clipboard?.write && typeof ClipboardItem !== "undefined") {
    try {
      await clipboard.write([new ClipboardItem({ "image/png": blob })]);
      track("share_completed", { surface: "meme_copy" });
      return "copied";
    } catch {
      /* unsupported / denied — fall through */
    }
  }
  downloadBlob(blob, filename);
  track("share_completed", { surface: "meme_copy_download" });
  return "downloaded";
}

export function downloadImage(blob: Blob, filename: string): void {
  downloadBlob(blob, filename);
  track("share_completed", { surface: "meme_download" });
}
