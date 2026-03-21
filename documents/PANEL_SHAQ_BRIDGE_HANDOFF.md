# Panel Shaq → Panel Haus Desktop Bridge: Handoff

This doc tells the Panel Shaq developer everything they need to add a "Send to Panel Haus Desktop" button.

---

## How It Works

Panel Haus Desktop runs a WebSocket server on `ws://127.0.0.1:9876`. Any local app can connect, send a `.comic` JSON string, and Desktop imports it as a new project. The web app (panelhaus.com) already uses this — Panel Shaq just needs to do the same thing.

```
Panel Shaq app
    │
    │  ws://127.0.0.1:9876
    ▼
Panel Haus Desktop (Electron)
    │
    ▼
  Imports project → opens on canvas
```

---

## Step 1: Probe for Desktop

Before showing the send button, check if Desktop is running:

```javascript
async function isDesktopAvailable() {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket("ws://127.0.0.1:9876");
      const timer = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 1500);
      ws.onopen = () => {
        clearTimeout(timer);
        ws.close();
        resolve(true);
      };
      ws.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}

// Usage:
const available = await isDesktopAvailable();
// available === true  → show "Send to Desktop" button
// available === false → show "Desktop not detected" or hide button
```

---

## Step 2: Transform Your Data

Panel Haus expects a specific JSON format. Panel Shaq's native format is different. You **must** transform before sending. Here's the complete conversion function:

```javascript
function convertPanelShaqToHaus(shaqData) {
  const meta = shaqData.meta || shaqData.metadata || {};

  const haus = {
    version: "2.0.0",
    metadata: {
      createdAt: meta.createdAt || new Date().toISOString(),
      name: meta.name || shaqData.project?.name || "Imported Project",
      embeddedImages: true,
      source: "panelshaq",
      sourceVersion: meta.sourceVersion || meta.version || "1.0.0",
    },
    project: {
      id: shaqData.project?.id || crypto.randomUUID(),
      name: shaqData.project?.name || meta.name || "Imported Project",
      pages: [],
      generatedStories: shaqData.project?.generatedStories || [],
      blueprints: [],
    },
  };

  // Convert blueprints
  for (const bp of shaqData.project?.blueprints || []) {
    const { imageData, ...rest } = bp;
    haus.project.blueprints.push({
      ...rest,
      type: (bp.type || "character").toLowerCase(),
      thumbnailDataUrl: imageData || bp.thumbnailDataUrl || null,
      referenceImageId: bp.referenceImageId || null,
    });
  }

  // Convert pages
  for (const page of shaqData.project?.pages || []) {
    const sourcePanels = page.panels || page.layers?.panels || [];
    const textBubbles = [];
    let globalZIndex = 0;

    const hausPanels = sourcePanels.map((panel, idx) => {
      // Extract nested bubbles → page-level textBubbles
      for (const bubble of panel.bubbles || []) {
        textBubbles.push({
          id: `bubble-${bubble.id || crypto.randomUUID()}`,
          type: bubble.style
            ? `${bubble.style}-bubble`
            : bubble.type || "speech-bubble",
          text: bubble.text || "",
          // Convert panel-relative coords to absolute page coords
          x: (panel.x || 0) + (bubble.x || 0),
          y: (panel.y || 0) + (bubble.y || 0),
          width: bubble.width || 150,
          height: bubble.height || 60,
          rotation: bubble.rotation || 0,
          globalZIndex: globalZIndex++,
          style: {
            fontFamily: bubble.fontFamily || "Bangers",
            fontSize: bubble.fontSize || 16,
            fontColor: bubble.fontColor || "#000000",
            textAlign: bubble.textAlign || "center",
            bold: bubble.fontWeight === "bold" || bubble.bold || false,
            italic: bubble.fontStyle === "italic" || bubble.italic || false,
            underline: false,
            allCaps: false,
            verticalAlign: "middle",
            letterSpacing: 0,
            lineHeight: 1.2,
            shadow: null,
            outline: null,
          },
          bubble: {
            backgroundColor: "#FFFFFF",
            borderColor: "#000000",
            borderWidth: 2,
            opacity: 1,
          },
          tailAngle: bubble.tailAngle ?? 270,
        });
      }

      return {
        id: `panel-${panel.id || crypto.randomUUID()}`,
        x: panel.x,
        y: panel.y,
        width: panel.width,
        height: panel.height,
        imageSrc: panel.imageData || panel.imageSrc || null,
        imageId: panel.imageId || `img_${idx}`,
        imageTransform: {
          x: panel.imageTransform?.x || 0,
          y: panel.imageTransform?.y || 0,
          scale: panel.imageTransform?.scale || 1,
          rotation: panel.imageTransform?.rotation || 0,
          flipH: panel.imageTransform?.flipH || false,
          flipV: panel.imageTransform?.flipV || false,
        },
        strokeWidth: panel.borderWidth ?? panel.strokeWidth ?? 2,
        strokeColor: panel.borderColor || panel.strokeColor || "#000000",
        showOutline: panel.showOutline ?? true,
        visible: true,
        locked: false,
        zIndex: idx,
      };
    });

    const existingBubbles = page.textBubbles || page.layers?.textBubbles || [];
    const stickers = page.stickers || page.layers?.stickers || [];

    haus.project.pages.push({
      id: page.id || crypto.randomUUID(),
      dimension: {
        width: page.width || page.dimension?.width || 490,
        height: page.height || page.dimension?.height || 700,
      },
      layers: {
        panels: hausPanels,
        textBubbles: [...existingBubbles, ...textBubbles],
        stickers: stickers,
        background: page.background || page.layers?.background || null,
      },
    });
  }

  return haus;
}
```

---

## Step 3: Send Over WebSocket

```javascript
async function sendToDesktop(panelShaqProject) {
  const hausData = convertPanelShaqToHaus(panelShaqProject);

  return new Promise((resolve) => {
    try {
      const ws = new WebSocket("ws://127.0.0.1:9876");

      const timer = setTimeout(() => {
        ws.close();
        resolve({ success: false, error: "Connection timed out" });
      }, 5000);

      ws.onopen = () => {
        ws.send(JSON.stringify(hausData));
      };

      ws.onmessage = (event) => {
        clearTimeout(timer);
        try {
          const response = JSON.parse(event.data);
          ws.close();
          resolve(
            response.status === "ok"
              ? { success: true }
              : {
                  success: false,
                  error: response.message || "Desktop rejected the project",
                },
          );
        } catch {
          ws.close();
          resolve({ success: false, error: "Invalid response from Desktop" });
        }
      };

      ws.onerror = () => {
        clearTimeout(timer);
        resolve({
          success: false,
          error: "Could not connect to Panel Haus Desktop",
        });
      };
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
}

// Usage:
const result = await sendToDesktop(myProject);
if (result.success) {
  showToast("Sent to Panel Haus Desktop!");
} else {
  showToast("Error: " + result.error);
}
```

---

## Property Mapping Quick Reference

| Panel Shaq                        | Panel Haus                          | Action                           |
| --------------------------------- | ----------------------------------- | -------------------------------- |
| `meta`                            | `metadata`                          | Rename key                       |
| `meta.version: "1.0"`             | Top-level `version: "2.0.0"`        | Move + set to "2.0.0"            |
| `page.width` / `page.height`      | `page.dimension: { width, height }` | Wrap                             |
| `page.panels`                     | `page.layers.panels`                | Wrap in `layers`                 |
| `page.textBubbles`                | `page.layers.textBubbles`           | Wrap in `layers`                 |
| `page.stickers`                   | `page.layers.stickers`              | Wrap in `layers`                 |
| `panel.borderWidth`               | `panel.strokeWidth`                 | Rename                           |
| `panel.borderColor`               | `panel.strokeColor`                 | Rename                           |
| `panel.borderRadius`              | _(drop)_                            | Delete                           |
| `panel.backgroundColor`           | _(drop)_                            | Delete                           |
| `panel.imageData`                 | `panel.imageSrc`                    | Rename                           |
| `panel.imageTransform` (3 fields) | `panel.imageTransform` (6 fields)   | Add `rotation`, `flipH`, `flipV` |
| `panel.bubbles[]` (nested)        | `page.layers.textBubbles[]` (flat)  | Extract + convert coords         |
| `bubble.style: "speech"`          | `bubble.type: "speech-bubble"`      | Append `-bubble`                 |
| `bubble.fontSize` (flat)          | `bubble.style.fontSize` (nested)    | Restructure                      |
| `blueprint.imageData`             | `blueprint.thumbnailDataUrl`        | Rename                           |
| `blueprint.type: "Character"`     | `blueprint.type: "character"`       | Lowercase                        |

---

## Safety Net

Panel Haus has a built-in adapter that auto-detects Panel Shaq format and converts it on import. So even if you send raw unconverted data, it will **probably** work. But don't rely on this — it's a fallback for edge cases, not a substitute for proper conversion. The adapter may not cover future format changes.

---

## Testing Locally

You don't need Panel Haus Desktop installed. We have a test server script:

```bash
# In the Panel Haus repo:
node scripts/dev/test-bridge-server.js
```

This starts a mock server on `ws://127.0.0.1:9876` that:

- Accepts connections
- Parses incoming JSON
- Logs a summary (pages, panels, format issues)
- Warns if data looks unconverted
- Saves received data to `scripts/dev/bridge-received-*.comic`
- Responds with `{ "status": "ok" }`

### Test Flow

1. Run the test server: `node scripts/dev/test-bridge-server.js`
2. In Panel Shaq, call `sendToDesktop(project)`
3. Watch the test server terminal — it should log the project summary
4. Check the saved `.comic` file to verify format
5. Try loading the saved `.comic` in Panel Haus web app (File > Open) to confirm it imports cleanly

---

## Checklist

- [ ] Probe `ws://127.0.0.1:9876` before showing send button
- [ ] Copy `convertPanelShaqToHaus()` into your codebase
- [ ] Transform data before sending
- [ ] Send transformed JSON over WebSocket
- [ ] Handle `{ status: "ok" }` response (success toast)
- [ ] Handle errors (timeout, connection refused, rejection)
- [ ] Test with `test-bridge-server.js`
- [ ] Test round-trip: Panel Shaq → test server → open .comic in Panel Haus web app
