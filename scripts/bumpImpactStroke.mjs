#!/usr/bin/env node
/**
 * One-off, idempotent: set outline.widthEm = 0.09 on every EXISTING Impact-font
 * zone in src/data/memeTextZones.ts (the classic meme look = thick black stroke).
 * Only touches the outline width — positions, sizes, text, and all non-Impact
 * zones are left exactly as-is. Safe to re-run.
 *
 *   node scripts/bumpImpactStroke.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const IMPACT_WIDTH_EM = 0.09;
const path = fileURLToPath(
  new URL("../src/data/memeTextZones.ts", import.meta.url),
);
const text = readFileSync(path, "utf8");

// The registry is emitted as JSON; slice out the object literal and parse it.
const start = text.indexOf("{", text.indexOf("MEME_TEXT_ZONES"));
const end = text.lastIndexOf("}");
const prefix = text.slice(0, start); // header + import + "export const ... = "
const registry = JSON.parse(text.slice(start, end + 1));

let changed = 0;
for (const tpl of Object.values(registry)) {
  for (const zone of tpl.zones ?? []) {
    const s = zone.style;
    // Impact = the only stack containing "Impact"; only adjust if it has a stroke.
    if (s?.fontFamily?.includes("Impact") && s.outline) {
      if (s.outline.widthEm !== IMPACT_WIDTH_EM) changed++;
      s.outline.widthEm = IMPACT_WIDTH_EM;
    }
  }
}

writeFileSync(path, `${prefix}${JSON.stringify(registry, null, 2)};\n`);
console.log(
  `[bumpImpactStroke] set widthEm=${IMPACT_WIDTH_EM} on ${changed} Impact zones`,
);
