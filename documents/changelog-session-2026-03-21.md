# Changelog — Session 2026-03-21

## Director Onboarding Banner (NEW)

- Dismissible **"Step 2 of 4 — Plan Your Panels"** banner on the Director screen
- Shows when panels exist but no images have been generated yet
- Lists what users can do: edit descriptions, insert panels, generate, regenerate
- Auto-hides once images are generated (user clearly knows the flow)
- Persists dismissal in localStorage so it doesn't nag returning users

## Preview Overlay Fixes

- **Bottom padding increased** so description, regeneration notes, and generate button clear the bottom nav bar
- **Added "Close Preview" button** at the bottom of the overlay with X icon — clear exit path alongside the top-right X

## Director Bottom Actions

- Added smaller **Preview** and **Download All** buttons at the bottom of the Director page (above "Continue to Layouts")
- Only appear when panels have generated images
- Contextual — users scrolling through panels don't have to scroll back to the top header

## Nav Cleanup

- **"PANEL SHAQ" title shrunk** from `text-3xl` to `text-xl` in top nav bar — less visual weight
- **Removed panelhaus.app link** from the title — was a clickable link, now just text
- **Added panelhaus.app** as a menu item inside the hamburger sidebar (with Globe icon)

## Camera Lens Reference Images (NEW)

- Replaced native `<select>` dropdown for Camera Lens with **custom dropdown showing thumbnail previews**
- Each lens type shows a 24x24 reference image alongside the name
- Selected lens also shows its thumbnail in the closed button state
- 12 lens type images added: Default, Fish-eye 8mm, Ultra Wide 14mm, Wide 24mm, Cinematic 35mm, Standard 50mm, Portrait 85mm, Telephoto 135mm, Extreme Telephoto 200mm, Macro, Tilt-Shift, Anamorphic

## Bubble Editor — New SFX Types + Mobile UX

- **5 bubble types** now available: Speech, Thought, SFX, SFX Impact, SFX Ambient
- **SFX Impact** — large bold red text with heavy black stroke + red glow, aggressive 8° tilt, wide letter spacing (CRASH, BOOM, WHAM)
- **SFX Ambient** — soft blue italic text with subtle shadow, wide letter spacing, no tilt (drip, hummm, tick)
- **Single toggle button** replaces type pills — tap to cycle through all 5 types, shows current type + "tap to change"
- **Floating toolbar fixed to bottom-center** of screen — no longer clipped by panel overflow, visible and reachable on mobile regardless of which panel the bubble is in
- **Final render** descriptions updated for new SFX types
- **`.comic` export** maps new types: `sfx-impact` → `shout-bubble`, `sfx-ambient` → `caption-box`

## Bug Fixes

- **Thumbnail fix** — project thumbnails in the ProjectManager grid were broken (base64 truncated to 200 chars + "..."). Now generates a real 120px-wide JPEG thumbnail via canvas
- **createdAt preserved** — auto-save was overwriting `createdAt` on every save, making all projects show "created just now". Now preserves the original timestamp, only sets it on first save
- **Font loading** — Material Symbols font was render-blocking. Added `&display=swap` to prevent first-paint delay (Space Grotesk + Inter already had it)

## Performance

- **PanelCard wrapped in `React.memo`** — cards only re-render when their own props change, not when sibling cards update
- **Stable callbacks** — `handleUpdatePanel`, `handleQueueGenerate`, `handlePreview` wrapped in `useCallback` to prevent unnecessary re-renders
- Removed inline arrow functions at PanelCard call site that were creating new references every render

## Desktop Redirect Gate (NEW)

- **Full-screen interstitial** shown to desktop visitors (viewport ≥ 1024px, no touch capability)
- Explains that panelhaus.app is mobile-first, compares mobile vs desktop feature sets side-by-side
- **10-second countdown** auto-redirects to `panelhaus.app`
- **"Stay on mobile version anyway"** button cancels countdown and dismisses the gate
- Dismissal persisted in localStorage (`panelshaq_desktop_gate_dismissed`) — won't show again
- Tablets with keyboards and touchscreen desktops are not affected (touch detection bypass)
- App loads behind the overlay so clicking "stay" is instant with no loading delay

## Documentation

- [cloud-storage-plan.md](cloud-storage-plan.md) — full plan for Supabase cloud storage (auth, storage bucket, DB schema, sync layer)
- [panelhaus-package-export.md](panelhaus-package-export.md) — `.panelhaus` ZIP package format spec for Desktop import
- [director-onboarding-ux.md](director-onboarding-ux.md) — design doc for the Director onboarding banner
- [low-hanging-fruit.md](low-hanging-fruit.md) — prioritized list of quick wins with effort estimates
- [desktop-redirect-gate.md](desktop-redirect-gate.md) — design doc for the desktop redirect interstitial
