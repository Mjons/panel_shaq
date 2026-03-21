# Comic Sharing — How Users Share Their Work

## Current State

The "Copy App Link" button copies `window.location.href` — just a link to the app itself. Useless for sharing a specific comic. Users can export PDFs/PNGs and share those files manually, but there's no way to share a comic as a viewable link.

## What Users Want

"Look at this comic I made" → tap share → friend opens a link → sees the comic. No downloads, no app installs, no accounts.

---

## Options

### Option A: Client-Side Image Share (Lowest Friction)

**How:** Render the current page as a PNG, use the Web Share API to share the image directly.

**Flow:**

1. User taps "Share"
2. App renders the current page to a PNG (same as export)
3. Web Share API opens the native share sheet (iMessage, WhatsApp, Twitter, etc.)
4. User picks a destination → image is shared

**Code (mostly exists already):**

```ts
const png = await toPng(comicRef.current, { pixelRatio: 1.5 });
const blob = await fetch(png).then((r) => r.blob());
const file = new File([blob], "comic.png", { type: "image/png" });

if (navigator.canShare?.({ files: [file] })) {
  await navigator.share({ files: [file], title: "My Comic" });
} else {
  // Fallback: download the image
  const link = document.createElement("a");
  link.download = "comic.png";
  link.href = png;
  link.click();
}
```

**Pros:**

- Zero infrastructure
- Works offline
- Native share sheet = every social platform
- No account needed
- Already have the rendering code from PDF/PNG export
- Image is self-contained — recipient doesn't need the app

**Cons:**

- Shares a flat image, not an interactive comic
- Multi-page comics would need multiple shares or a combined image
- No link to view later — it's just a picture

**Verdict:** Fastest to ship. Highest value for social sharing.

---

### Option B: Upload to Supabase Storage + Share Link

**How:** Upload rendered pages to Supabase Storage, generate a public viewer link.

**Flow:**

1. User taps "Share"
2. App renders all pages as PNGs
3. Uploads to Supabase Storage (`/public/comics/{id}/page-1.png`, etc.)
4. Generates a link: `panelhaus.app/view/{id}`
5. Viewer page shows the pages in a simple reader

**Pros:**

- Shareable link that works for everyone
- Can add a simple reader/viewer page
- Link is short and clean
- Can track views

**Cons:**

- Needs Supabase Storage setup (we have Supabase already)
- Storage costs (images are big)
- Need to build a `/view/:id` viewer page
- Images expire or need cleanup
- Privacy: comics are on a public URL

**Viewer page:** Dead simple — just renders the uploaded PNGs in a vertical scroll layout with the project name as the title. No login needed.

**Verdict:** Best balance of effort and value. Gives users a real "share link."

---

### Option C: Embed Code / Social Cards

**How:** Generate an Open Graph-compatible share link with preview image.

When someone shares `panelhaus.app/view/abc123` on Twitter/Discord/iMessage, it shows a preview card with the first panel as the thumbnail.

**Requires:**

- Server-side rendering of OG meta tags (or a Vercel Edge function)
- Thumbnail image at a known URL
- The viewer page from Option B

**Pros:**

- Rich previews on social media
- Professional looking shares

**Cons:**

- Needs server-side OG tag generation
- More infrastructure

**Verdict:** Nice-to-have on top of Option B. Not MVP.

---

### Option D: Direct-to-Social Posting

**How:** Integrate with Twitter/Instagram/TikTok APIs to post directly.

**Pros:**

- One-tap posting
- Maximum reach

**Cons:**

- Each platform needs its own API integration
- OAuth flows for each
- Maintaining API access
- Massive effort

**Verdict:** Way too much effort. The Web Share API (Option A) already covers this.

---

## Recommendation: Option A now, Option B next

### Phase 1 (now): Web Share API — share as image

Zero infrastructure. Ship in 30 minutes. Users can share to any platform via native share sheet. Fallback to download for browsers without Web Share API.

**What to build:**

- "Share Page" button in the Editor
- Renders current page as PNG
- Opens native share sheet with the image
- Title: project name

### Phase 2 (later): Supabase share link

When we want persistent, linkable comics:

- Upload pages to Supabase Storage
- Build a minimal `/view/:id` page
- Generate short share links
- Add OG meta tags for social previews

---

## Phase 1 Implementation

### Files to change:

| File                           | Change                                                |
| ------------------------------ | ----------------------------------------------------- |
| `src/screens/EditorScreen.tsx` | Update share button to render + share image           |
| `src/screens/ShareScreen.tsx`  | Update "Copy App Link" to actually share comic images |

### The share function:

```ts
async function shareComicPage(comicRef, projectName) {
  // Render the current page
  const dataUrl = await toPng(comicRef.current, {
    backgroundColor: "#000000",
    pixelRatio: 1.5,
    skipFonts: true,
  });

  // Convert to blob
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], `${projectName || "comic"}.png`, {
    type: "image/png",
  });

  // Try native share
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: projectName || "My Comic",
      text: "Made with Panelhaus",
      files: [file],
    });
  } else {
    // Fallback: download
    const link = document.createElement("a");
    link.download = file.name;
    link.href = dataUrl;
    link.click();
  }
}
```

That's it. One function, works everywhere.
