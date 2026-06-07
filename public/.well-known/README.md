# `.well-known/assetlinks.json` — TWA Digital Asset Links

This file is served at `https://m.panelhaus.app/.well-known/assetlinks.json` (Vercel
serves everything under `public/` at the site root). It's what lets the Android TWA
wrapper verify it owns this domain so the app opens **without** the Chrome URL bar.

It is a **stub** — the two fingerprints are placeholders and MUST be replaced before
the TWA is rebuilt/resubmitted, or verification fails and the address bar shows.

## What to put in `sha256_cert_fingerprints`

`package_name` is already set to the new `app.panelhaus.mobile.twa` (matches
`twa-manifest.json`). You need the SHA-256 of the signing cert(s):

1. **Play App Signing key** (required if using Play App Signing, which is the default):
   Play Console → your app → **Test and release → App integrity → App signing** →
   copy the **SHA-256 certificate fingerprint**.
2. **Upload key** (needed for builds installed before Google re-signs, e.g. internal
   testing via the upload-signed APK/AAB). Extract from the keystore:
   ```
   keytool -list -v -keystore android.keystore -alias android | findstr SHA256
   ```
   (the keystore path is in `twa-manifest.json` → `signingKey.path`).

Paste each as the colon-separated hex form, e.g.
`AB:CD:12:...:EF`. Keep both entries if both keys are in play; drop the upload-key
line if you only ever serve Play-signed builds.

Bubblewrap can also regenerate this for you: `bubblewrap fingerprint generateAssetLinks`.
