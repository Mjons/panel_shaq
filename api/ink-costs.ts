import type { VercelRequest, VercelResponse } from "@vercel/node";

// Public, non-sensitive: the per-action ink costs so the UI can show "⚡N" badges
// that always match what the routes actually charge (same INK_COST_* env). No auth.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    text: parseInt(process.env.INK_COST_TEXT || "1", 10),
    imageFlash: parseInt(process.env.INK_COST_IMAGE_FLASH || "1", 10),
    imagePro: parseInt(process.env.INK_COST_IMAGE_PRO || "2", 10),
  });
}
