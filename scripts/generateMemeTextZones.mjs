#!/usr/bin/env node
/**
 * One-time generator: PanelHaus meme text positions → Panel Shaq normalized zones.
 *
 * Reads Comic-Pro2 (desktop PanelHaus) `memeTemplates.js` + `memeFontPresets.js`,
 * runs the REAL `resolveMemeBubbleStyle` merge, converts absolute-pixel bubble
 * geometry (top-left, in customDimension space) to normalized 0–1, and emits a
 * static, committed registry at src/data/memeTextZones.ts keyed by templateId.
 *
 * The shipped app has ZERO dependency on Comic-Pro2 — this is a dev tool. Re-run
 * only when PanelHaus template placements change.
 *
 *   node scripts/generateMemeTextZones.mjs
 *   COMIC_PRO2_DATA=/path/to/Comic-Pro2/src/data node scripts/generateMemeTextZones.mjs
 *
 * Both source files are self-contained ESM (no imports). We copy them to temp
 * .mjs files so Node imports them as ESM regardless of Comic-Pro2's package type.
 */
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const round = (v, d) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};
const round4 = (v) => round(v, 4);
const round2 = (v) => round(v, 2);

/** Rewrite Impact-led stacks to lead with the web font we bundle (Anton). */
function webFontStack(family) {
  if (!family || typeof family !== "string") return "Anton, 'Arial Black', sans-serif";
  if (/impact/i.test(family)) return "Anton, 'Arial Black', Impact, sans-serif";
  return family;
}

const DATA_DIR_URL = process.env.COMIC_PRO2_DATA
  ? pathToFileURL(process.env.COMIC_PRO2_DATA.replace(/\/?$/, "/"))
  : new URL("../../Comic-Pro2/src/data/", import.meta.url);

const tplPath = new URL("memeTemplates.js", DATA_DIR_URL);
const fontPath = new URL("memeFontPresets.js", DATA_DIR_URL);

let tplSrc, fontSrc;
try {
  tplSrc = readFileSync(tplPath, "utf8");
  fontSrc = readFileSync(fontPath, "utf8");
} catch (err) {
  console.error(
    `\n[generateMemeTextZones] Could not read PanelHaus data files at ${DATA_DIR_URL.pathname}\n` +
      `Make sure Comic-Pro2 is checked out as a sibling of panel_shaq, or set COMIC_PRO2_DATA.\n` +
      `Original error: ${err.message}\n`,
  );
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "memezones-"));
let MEME_TEMPLATES, resolveMemeBubbleStyle;
try {
  const tplTmp = join(tmp, "memeTemplates.mjs");
  const fontTmp = join(tmp, "memeFontPresets.mjs");
  writeFileSync(tplTmp, tplSrc);
  writeFileSync(fontTmp, fontSrc);
  ({ default: MEME_TEMPLATES } = await import(pathToFileURL(tplTmp).href));
  ({ resolveMemeBubbleStyle } = await import(pathToFileURL(fontTmp).href));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (!Array.isArray(MEME_TEMPLATES) || typeof resolveMemeBubbleStyle !== "function") {
  console.error("[generateMemeTextZones] Unexpected exports from PanelHaus data files.");
  process.exit(1);
}

const registry = {};
let zoneCount = 0;

for (const tpl of MEME_TEMPLATES) {
  const cd = tpl.customDimension;
  if (!cd || !cd.width || !cd.height) {
    console.warn(`[skip] ${tpl.id}: no customDimension`);
    continue;
  }
  const bubbles = Array.isArray(tpl.textBubbles) ? tpl.textBubbles : [];
  const zones = bubbles.map((tb, i) => {
    const r = resolveMemeBubbleStyle(tpl, tb);
    const s = r.style || {};
    const box = r.bubble || {};
    const hasBox =
      box.backgroundColor && box.backgroundColor !== "transparent";
    const fontSize = typeof s.fontSize === "number" ? s.fontSize : 42;
    return {
      id: tb.id || `zone-${i + 1}`,
      x: round4(tb.x / cd.width),
      y: round4(tb.y / cd.height),
      width: round4(tb.width / cd.width),
      height: round4(tb.height / cd.height),
      ...(typeof tb.rotation === "number" && tb.rotation !== 0
        ? { rotation: round2(tb.rotation) }
        : {}),
      fontSizeRatio: round4(fontSize / cd.width),
      text: typeof tb.text === "string" ? tb.text : "",
      style: {
        color: s.fontColor || "#ffffff",
        fontFamily: webFontStack(s.fontFamily),
        fontWeight: s.bold ? 700 : 400,
        italic: !!s.italic,
        allCaps: !!s.allCaps,
        textAlign: s.textAlign === "left" || s.textAlign === "right" ? s.textAlign : "center",
        lineHeight: typeof s.lineHeight === "number" ? s.lineHeight : 1.1,
        outline:
          s.outline && s.outline.color
            ? {
                color: s.outline.color,
                // width is in customDimension px; express relative to font size
                // so the outline scales with any rendered size.
                widthEm: round4((s.outline.width ?? 1.5) / fontSize),
              }
            : null,
        box: hasBox
          ? {
              backgroundColor: box.backgroundColor,
              borderColor: box.borderColor || "transparent",
              borderWidth: box.borderWidth || 0,
            }
          : null,
      },
    };
  });
  zoneCount += zones.length;
  const image = (tpl.image || "").split("/").pop() || "";
  registry[tpl.id] = { aspect: round4(cd.width / cd.height), image, zones };
}

const header = `// AUTO-GENERATED by scripts/generateMemeTextZones.mjs — DO NOT EDIT BY HAND.
// Source: PanelHaus (Comic-Pro2) memeTemplates.js + memeFontPresets.js, converted
// to normalized 0–1 zones via the real resolveMemeBubbleStyle. Re-run the script
// to regenerate, or edit via the in-app admin calibrator (Copy JSON → paste here).
import type { MemeZoneRegistry } from "../from-meme/zoneTypes";

export const MEME_TEXT_ZONES: MemeZoneRegistry = ${JSON.stringify(registry, null, 2)};
`;

const outPath = fileURLToPath(new URL("../src/data/memeTextZones.ts", import.meta.url));
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, header);

console.log(
  `[generateMemeTextZones] Wrote ${Object.keys(registry).length} templates / ${zoneCount} zones → src/data/memeTextZones.ts`,
);
