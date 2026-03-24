# TWA: Ship Panel Shaq to Google Play Store

## What We're Doing

Package the existing PWA (panelshaq.vercel.app or whatever the production URL is) as a Trusted Web Activity and publish it to the Google Play Store. Zero code changes to the web app.

---

## Prerequisites

- [x] PWA already works (manifest, service worker, icons)
- [ ] Google Play Developer account ($25 one-time fee — https://play.google.com/console)
- [ ] Production URL finalized (needs to be the same domain long-term)
- [ ] Digital Asset Links file hosted on the domain (proves you own the site)

---

## Step-by-Step

### 1. Set Up Bubblewrap CLI

Bubblewrap is Google's official tool for generating TWA projects.

```bash
npm install -g @anthropic-ai/bubblewrap
# or
npx @nicolo-ribaudo/bubblewrap init --manifest https://YOUR_URL/manifest.webmanifest
```

Alternative: Use **PWABuilder** (https://pwabuilder.com) — paste your URL, click "Package for Android," download the APK. No CLI needed.

### 2. Generate a Signing Key

Google Play requires a signed APK. Generate a keystore:

```bash
keytool -genkeypair -v -keystore panelshaq.keystore -alias panelshaq -keyalg RSA -keysize 2048 -validity 10000
```

**Keep this keystore file safe.** If you lose it, you can never update the app.

### 3. Configure Digital Asset Links

This file proves to Chrome that your Play Store app owns the website. Without it, Chrome shows a browser bar instead of fullscreen.

Create `/.well-known/assetlinks.json` on your domain:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app_store",
      "package_name": "app.panelshaq.twa",
      "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
    }
  }
]
```

Get the fingerprint from your keystore:

```bash
keytool -list -v -keystore panelshaq.keystore -alias panelshaq
```

For Vercel hosting, add the file to `public/.well-known/assetlinks.json`.

### 4. Configure the TWA

Bubblewrap generates an Android project. Key settings:

| Setting          | Value                                   |
| ---------------- | --------------------------------------- |
| Package name     | `app.panelshaq.twa`                     |
| App name         | Panel Shaq                              |
| Display mode     | Standalone                              |
| Start URL        | `/`                                     |
| Theme color      | `#0F172A` (matches your PWA manifest)   |
| Background color | `#0F172A`                               |
| Icon             | 512x512 PNG (already have this for PWA) |
| Splash screen    | Same dark background + logo             |

### 5. Build the APK

```bash
bubblewrap build
```

This produces an `.aab` (Android App Bundle) ready for upload.

### 6. Create Play Store Listing

In the Google Play Console:

- **App name:** Panel Shaq — AI Comic Studio
- **Short description:** Create AI-powered comics on your phone. Write a story, generate panels, add speech bubbles, export.
- **Full description:** Panel Shaq turns your story ideas into visual comic panels using AI. Write your story in the Workshop, generate and customize panels in the Director, arrange layouts, add speech bubbles in the Editor, and export as PDF or PNG. Features character vault, multiple art styles, camera lens effects, and more.
- **Category:** Art & Design or Comics
- **Content rating:** Complete the questionnaire (likely "Everyone")
- **Screenshots:** 2-3 phone screenshots of each screen (Workshop, Director, Editor)
- **Feature graphic:** 1024x500 banner image

### 7. Upload and Submit

- Upload the `.aab` to Play Console
- Fill in the content declaration (no ads, no in-app purchases for now)
- Submit for review
- Review typically takes 1-3 days for new apps

---

## Vercel Config for Asset Links

Add to `vercel.json` (if not already present):

```json
{
  "headers": [
    {
      "source": "/.well-known/assetlinks.json",
      "headers": [{ "key": "Content-Type", "value": "application/json" }]
    }
  ]
}
```

And create `public/.well-known/assetlinks.json` with the content from step 3.

---

## PWA Checklist (Verify Before Packaging)

The TWA inherits everything from the PWA. Double-check:

- [ ] `manifest.webmanifest` has `name`, `short_name`, `icons` (192 + 512), `start_url`, `display: standalone`
- [ ] Service worker registers and caches assets
- [ ] HTTPS (Vercel handles this)
- [ ] Icons are correct size and maskable
- [ ] Theme color and background color match
- [ ] App loads within 5 seconds on 3G (Lighthouse check)

Run a Lighthouse audit on production URL — aim for PWA score of 100.

---

## After Publishing

### Updates

The beauty of TWA: deploy to Vercel → users get the new version automatically. No Play Store review for web code changes. The TWA shell itself rarely needs updating.

### When to Update the TWA Shell

Only if you change:

- App name or icon
- Package name
- Signing key
- Asset links configuration

### Monitoring

- Play Console shows installs, ratings, crashes
- Web analytics (if you have any) still works — it's the same website

---

## Cost

| Item                          | Cost                          |
| ----------------------------- | ----------------------------- |
| Google Play Developer account | $25 (one-time)                |
| Bubblewrap / PWABuilder       | Free                          |
| Hosting                       | Already on Vercel (free tier) |
| **Total**                     | **$25**                       |

---

## Timeline

| Task                                    | Time               |
| --------------------------------------- | ------------------ |
| Set up Play Developer account           | 30 min             |
| Generate keystore + asset links         | 30 min             |
| Run Bubblewrap / PWABuilder             | 30 min             |
| Create Play Store listing + screenshots | 1-2 hours          |
| Submit for review                       | 10 min             |
| **Total**                               | **~Half a day**    |
| Google review                           | 1-3 days (waiting) |

---

## Risks

| Risk                              | Mitigation                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Google rejects "thin wrapper" app | Add a good description, screenshots, and feature graphic. TWAs from legitimate PWAs are generally accepted.  |
| Chrome not installed on device    | 98%+ of Android devices have Chrome. Fallback opens in default browser.                                      |
| Domain changes break asset links  | Pick a final domain before publishing. Changing domains later requires a new TWA build.                      |
| Lost keystore                     | Back up keystore + password immediately. Use Google Play App Signing (recommended) so Google holds a backup. |
