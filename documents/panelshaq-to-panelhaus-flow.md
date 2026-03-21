# Panelhaus Flow — Seamless Handoff from Web to Desktop

## The Vision

User generates a comic on panelhaus.app (mobile/web) → taps "Edit in Panelhaus" → Panelhaus Desktop opens with their comic loaded on the full canvas. No file downloads, no drag-and-drop, no manual import.

---

## Current State

- **panelhaus.app** (this app) generates panels, layouts, exports `.comic` files
- **Panelhaus Desktop** (Electron app) has a full canvas editor, imports `.comic` files
- The handoff is manual: export `.comic` → download → open Panelhaus Desktop → import

## Options for Seamless Handoff

### Option A: Custom Protocol Handler (`panelhaus://`)

**How:** Register a custom URL protocol on the desktop app. The web app opens a link like `panelhaus://open?project=...` which launches the desktop app with the project data.

**Flow:**

1. User taps "Edit in Panelhaus" on web
2. Web app generates the `.comic` blob
3. Opens `panelhaus://import?data=base64encodedcomicfile`
4. OS routes to Panelhaus Desktop which parses the URL and imports

**Pros:**

- One click, instant
- No server needed
- Works offline

**Cons:**

- URL length limits (~2MB on most OS) — comic files with images are way bigger
- Requires desktop app to register the protocol handler
- Doesn't work if desktop app isn't installed (need fallback)
- Base64 in URL is ugly and limited

**Verdict:** Doesn't work for image-heavy files. URL too small.

---

### Option B: Local WebSocket Bridge

**How:** Panelhaus Desktop runs a tiny local WebSocket server (e.g., `ws://localhost:9876`). The web app connects and sends the project data directly.

**Flow:**

1. Panelhaus Desktop starts → opens WS server on localhost:9876
2. User opens panelhaus.app in browser on same machine
3. Web app checks if `ws://localhost:9876` is available
4. If yes → shows "Send to Panelhaus Desktop" button
5. User taps → web app sends `.comic` data over WebSocket
6. Desktop app receives, imports, opens on canvas

**Pros:**

- No size limits — WebSocket handles megabytes easily
- Instant transfer, no files
- Works on same machine (which is the use case for desktop)
- Can be bidirectional (desktop sends back edits)

**Cons:**

- Requires Panelhaus Desktop to be running
- Browser security: HTTP page can't connect to WS on localhost (mixed content). HTTPS page CAN connect to `ws://localhost` in most browsers though.
- Need to handle connection failures gracefully
- Only works when both are on the same machine

**Verdict:** Best option for desktop-to-desktop handoff. Clean, fast, no file management.

---

### Option C: Cloud Relay (Shared Project via Supabase)

**How:** Save the project to Supabase (we already have it), generate a share link, desktop app opens the link and pulls the project.

**Flow:**

1. User taps "Edit in Panelhaus"
2. Web app uploads project to Supabase Storage (images + metadata)
3. Generates a unique URL: `panelhaus.app/project/abc123`
4. User opens this URL in Panelhaus Desktop (or it auto-opens via protocol handler)
5. Desktop app downloads the project from Supabase and imports

**Pros:**

- Works across devices (phone → desktop on different machine)
- No need for both apps on same machine
- Share links work for collaboration too
- Build on existing Supabase infrastructure

**Cons:**

- Requires upload/download (slower than local)
- Storage costs (images are big)
- Needs internet
- Privacy concerns (project data on server)

**Verdict:** Best for cross-device. Overkill for same-machine.

---

### Option D: Clipboard Transfer

**How:** Copy the `.comic` data to clipboard, user pastes in Panelhaus Desktop.

**Flow:**

1. User taps "Copy to Clipboard"
2. Web app writes `.comic` JSON to clipboard
3. User opens Panelhaus Desktop → Ctrl+V or "Paste Project"
4. Desktop imports from clipboard

**Pros:**

- Dead simple
- No protocol registration, no servers
- Works across apps natively

**Cons:**

- Clipboard has size limits (varies by OS, usually ~1-10MB)
- Images in base64 make it huge
- User has to manually switch apps and paste
- Not "seamless" — still requires user action

**Verdict:** Decent fallback but not seamless.

---

### Option E: Shared File via File System Access API

**How:** Use the browser's File System Access API to write the `.comic` file directly to a known location that Panelhaus Desktop watches.

**Flow:**

1. Panelhaus Desktop watches a folder (e.g., `~/Documents/Panelhaus/inbox/`)
2. User taps "Send to Panelhaus" on web
3. Web app uses File System Access API to save `.comic` to that folder
4. Desktop app detects new file → auto-imports → opens on canvas

**Pros:**

- No size limits
- No server needed
- File persists (can re-open later)
- Clean auto-import via file watcher

**Cons:**

- File System Access API only works in Chromium (no Firefox/Safari)
- Requires user to grant folder permission on first use
- Need to know the watch folder path
- Doesn't work on mobile (iOS/Android don't support this API)

**Verdict:** Clean for Chrome desktop users. Not universal.

---

## Recommendation: Option B (WebSocket) + Option C (Cloud) as fallback

### Primary: WebSocket Bridge (same machine)

When user is on desktop browser + has Panelhaus Desktop running:

```
[panelhaus.app] → ws://localhost:9876 → [Panelhaus Desktop]
```

- Desktop app includes a simple WS server (5 lines of code in Electron)
- Web app auto-detects if desktop is available
- "Edit in Panelhaus" button appears only when desktop is detected
- One tap → project transfers instantly

### Fallback: Cloud Relay (cross device)

When user is on phone or desktop app isn't running:

```
[panelhaus.app] → Supabase → share link → [Panelhaus Desktop]
```

- "Share Project" generates a temporary cloud link
- Link expires after 24 hours
- User opens link on desktop machine
- Works for phone → desktop workflow

### Fallback 2: Download `.comic` file

Always available. Manual but reliable.

---

## Auth Flow — New Users Who Don't Have Panelhaus Desktop

Panelhaus Desktop requires email login (sends a code, saves browser session). This creates a chicken-and-egg problem: user is on panelhaus.app, taps "Edit in Panelhaus Desktop", but they've never used the desktop app and don't have an account.

### Flow for new users:

```
1. User on panelhaus.app taps "Edit in Panelhaus Desktop"
2. WebSocket probe fails (desktop app not running/installed)
3. Show a modal with two paths:

   ┌─────────────────────────────────────────────────┐
   │  Open in Panelhaus Desktop                      │
   │                                                 │
   │  ┌─────────────────────────────────────────┐    │
   │  │  I have Panelhaus Desktop               │    │
   │  │  Make sure it's running, then try again  │    │
   │  │  [Try Again]                             │    │
   │  └─────────────────────────────────────────┘    │
   │                                                 │
   │  ┌─────────────────────────────────────────┐    │
   │  │  I don't have it yet                    │    │
   │  │  Download Panelhaus Desktop (free)      │    │
   │  │  [Download for Mac] [Download for Win]   │    │
   │  └─────────────────────────────────────────┘    │
   │                                                 │
   │  ── or ──                                       │
   │                                                 │
   │  [Download .comic file]                         │
   │  Open it manually in Panelhaus Desktop later    │
   └─────────────────────────────────────────────────┘
```

### What happens after they download + install:

1. User installs Panelhaus Desktop
2. Opens it → sees login screen → enters email → gets code → logs in
3. Desktop app starts WS server on port 9876 (automatic, no config)
4. User goes back to panelhaus.app → taps "Edit in Panelhaus Desktop" again
5. WebSocket connects → project transfers → desktop opens it
6. Done. Every future session is instant.

### Key decisions:

- **Don't gate the flow on auth.** The WebSocket bridge doesn't need authentication — it's localhost-only, so only apps on the user's own machine can connect. The desktop app handles its own auth separately.
- **The .comic file is the fallback.** Even if the user never gets the WebSocket working, they can always download the file and import manually.
- **Login happens in desktop, not web.** panelhaus.app never needs to know the user's Panelhaus account. The two apps are independent — the WebSocket just transfers the project data.

### Auth edge case: Desktop app is running but user isn't logged in

The WS server should start regardless of auth state. When it receives a project:

1. If user is logged in → import and open on canvas
2. If user is NOT logged in → save project to a pending queue, show login screen, after login → auto-import the pending project

This way the WebSocket transfer always succeeds immediately, and auth is handled asynchronously by the desktop app.

---

## Implementation Priority

### Phase 1 (now): WebSocket Bridge

**Panelhaus Desktop side:**

```ts
// In Electron main process
const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 9876 });
wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    const project = JSON.parse(data);
    importProject(project); // Your existing import logic
    mainWindow.focus();
  });
});
```

**panelhaus.app side:**

```ts
async function sendToDesktop(comicData: string): Promise<boolean> {
  try {
    const ws = new WebSocket("ws://localhost:9876");
    return new Promise((resolve) => {
      ws.onopen = () => {
        ws.send(comicData);
        ws.close();
        resolve(true);
      };
      ws.onerror = () => resolve(false);
      setTimeout(() => resolve(false), 2000); // 2s timeout
    });
  } catch {
    return false;
  }
}
```

**UI:**

- On page load, probe `ws://localhost:9876` with a 1s timeout
- If available → show "Edit in Panelhaus Desktop" button (prominent, primary style)
- If not available → show regular "Export .comic" button
- Button sends the `.comic` data over WebSocket, desktop auto-imports and focuses

### Phase 2 (later): Cloud Relay

- Upload to Supabase Storage
- Generate share link
- QR code for phone → desktop transfer

### Phase 3 (nice to have): Desktop Auto-Launch

- Register `panelhaus://` protocol in desktop installer
- Web app tries WebSocket first, if fails tries `panelhaus://open`
- If neither works → download `.comic` file

---

## Files to Change

| App               | File                                                | Changes                                         |
| ----------------- | --------------------------------------------------- | ----------------------------------------------- |
| panelhaus.app     | `src/screens/EditorScreen.tsx` or `ShareScreen.tsx` | Add "Edit in Panelhaus" button, WebSocket probe |
| panelhaus.app     | `src/services/desktopBridge.ts` (new)               | WebSocket connection, detection, send logic     |
| Panelhaus Desktop | `main.ts` (Electron main)                           | Add WebSocket server on port 9876               |
| Panelhaus Desktop | Import logic                                        | Handle incoming WebSocket `.comic` data         |
