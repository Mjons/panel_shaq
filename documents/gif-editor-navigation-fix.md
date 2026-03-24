# GIF Editor Navigation Problem

## The Bug

When the GIF Editor opens, the user can't see:

- The back button (to return to Editor)
- The "Create GIF" button
- The "Save" / "Share" buttons after generating
- The "GIF Editor" title

All of these live in the GIF Editor's own sticky header — but the **global TopNav** (`fixed top-0 z-50`) renders on top of it and blocks everything.

## Why It Happens

In `App.tsx`, `TopNav` renders unconditionally — it's outside the `gifEditorImages` conditional:

```
<TopNav />                    ← always renders, fixed z-50

{gifEditorImages ? (
  <GifEditorScreen />         ← its header is sticky z-20, hidden behind TopNav
) : (
  <main>{renderScreen()}</main>
  <BottomNav />
)}
```

The GIF Editor is meant to be a **full-screen takeover** — no TopNav, no BottomNav. Currently BottomNav is correctly hidden, but TopNav is not.

## The Fix

Move `TopNav` inside the else branch so it only renders when NOT in the GIF Editor:

```
{gifEditorImages ? (
  <GifEditorScreen />         ← full screen, no nav chrome
) : (
  <>
    <TopNav />                ← only when in normal app flow
    <main>{renderScreen()}</main>
    <BottomNav />
  </>
)}
```

This gives the GIF Editor full ownership of the screen. Its own header provides the back button, title, and export actions.

## Additional UX Consideration

With TopNav hidden, the GIF Editor's header becomes the only navigation. It already has:

- **Back arrow + "Editor" label** — returns to Editor
- **"GIF Editor" title** — tells user where they are
- **Create GIF / Save / Share buttons** — export actions

This is sufficient. The GIF Editor is a focused tool — the user shouldn't be navigating to Workshop or Director from here.

## Safe Area

TopNav applies `paddingTop: var(--sat)` for the iOS safe area notch. The GIF Editor's sticky header needs the same padding so it doesn't get clipped under the status bar on mobile.
