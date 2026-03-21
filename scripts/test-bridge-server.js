/**
 * Mock Panelhaus Desktop WebSocket server for testing the bridge.
 *
 * Usage: node scripts/test-bridge-server.js
 *
 * This simulates what Panelhaus Desktop's WS server does:
 * - Listens on ws://127.0.0.1:9876
 * - Accepts connections
 * - Receives .comic JSON data
 * - Logs a summary
 * - Saves to a file
 * - Responds with { status: "ok" }
 */

const { WebSocketServer } = require("ws");
const fs = require("fs");
const path = require("path");

const PORT = 9876;

const wss = new WebSocketServer({ port: PORT, host: "127.0.0.1" });

console.log(`\n🎨 Mock Panelhaus Desktop Bridge Server`);
console.log(`   Listening on ws://127.0.0.1:${PORT}`);
console.log(`   Waiting for connections from panelhaus.app...\n`);

wss.on("connection", (ws) => {
  console.log("✅ Connection established");

  ws.on("message", (data) => {
    const raw = data.toString();
    console.log(`📦 Received ${(raw.length / 1024).toFixed(0)} KB of data`);

    try {
      const comic = JSON.parse(raw);

      // Log summary
      const meta = comic.metadata || comic.meta || {};
      const project = comic.project || {};
      const pages = project.pages || [];

      console.log(`\n   Project: ${meta.name || project.name || "Untitled"}`);
      console.log(`   Version: ${comic.version || "unknown"}`);
      console.log(`   Source:  ${meta.source || "unknown"}`);
      console.log(`   Pages:   ${pages.length}`);

      let totalPanels = 0;
      let totalBubbles = 0;
      let panelsWithImages = 0;

      pages.forEach((page, i) => {
        const panels = page.layers?.panels || page.panels || [];
        const bubbles = page.layers?.textBubbles || page.textBubbles || [];
        totalPanels += panels.length;
        totalBubbles += bubbles.length;
        panelsWithImages += panels.filter(
          (p) => p.imageSrc || p.imageData,
        ).length;

        console.log(
          `   Page ${i + 1}: ${panels.length} panels, ${bubbles.length} bubbles${page.layers ? " ✓ layers" : " ✗ NO layers wrapper"}`,
        );
      });

      console.log(
        `\n   Total: ${totalPanels} panels (${panelsWithImages} with images), ${totalBubbles} bubbles`,
      );
      console.log(`   Blueprints: ${(project.blueprints || []).length}`);
      console.log(`   Stories: ${(project.generatedStories || []).length}`);

      // Check format
      if (!comic.version) console.log("   ⚠️  Missing version field");
      if (!pages[0]?.layers)
        console.log("   ⚠️  Missing layers wrapper — old format?");
      if (pages[0]?.panels)
        console.log(
          "   ⚠️  panels at page level instead of layers — needs conversion",
        );

      // Save to file
      const filename = `bridge-received-${Date.now()}.comic`;
      const outPath = path.join(__dirname, filename);
      fs.writeFileSync(outPath, raw);
      console.log(`\n   💾 Saved to: ${outPath}`);

      // Send ack
      ws.send(JSON.stringify({ status: "ok" }));
      console.log("   ↩️  Sent { status: ok }\n");
    } catch (err) {
      console.error("   ❌ Failed to parse:", err.message);
      ws.send(JSON.stringify({ status: "error", message: err.message }));
    }
  });

  ws.on("close", () => {
    console.log("   Connection closed\n");
  });
});

wss.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `❌ Port ${PORT} is already in use. Is Panelhaus Desktop running?`,
    );
    console.error("   Close it first, then try again.\n");
  } else {
    console.error("❌ Server error:", err.message);
  }
  process.exit(1);
});
