import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import crypto from "node:crypto";

// GTD ship-claim intent capture (mobile half). Mirrors Comic-Pro2's
// api/creator-application.js: ANONYMOUS by design (lead capture, not the mint
// whitelist), FREE (no ink reserve/refund, no credit guard), Redis-backed.
// Points at the SAME Upstash DB as Panel Haus, so both apps share one dedupe
// namespace (creator:application:<identity>) and one admin review list
// (creator:applications) — desktop's export script sees mobile leads unchanged.
//
// Deliberately imports NO auth helper and NO credit helper. Do not add
// requireSignInWhenClerk / reserveInk here; signed-out users must be able to
// claim, and claiming grants nothing (whitelist spot only, auto-approved).
//
// Hardening (per desktop CR 1140/1141, plus our fix for its open finding #5):
// per-IP rate limit (rightmost-XFF, anti-spoof), body-size cap, list ltrim,
// per-identity key TTL, AND server-side enum/length/wallet validation so
// nothing stored can render as markup in an admin panel.

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

// Keys MUST match Panel Haus byte for byte — one wrong character silently forks
// the shared namespace. See Comic-Pro2 api/creator-application.js:45-46,89.
const keyFor = (id: string) => `creator:application:${String(id).slice(0, 200)}`;
const LIST_KEY = "creator:applications";

const RATE_MAX = parseInt(process.env.CREATOR_APP_RATE_LIMIT_PER_HOUR || "10", 10);
const RATE_WINDOW = 3600;
const MAX_APP_CHARS = parseInt(process.env.CREATOR_APP_MAX_CHARS || "4000", 10);
const LIST_MAX = parseInt(process.env.CREATOR_APP_LIST_MAX || "20000", 10);
const KEY_TTL = parseInt(process.env.CREATOR_APP_KEY_TTL_DAYS || "365", 10) * 86400;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Trusted-hop client IP: the RIGHTMOST x-forwarded-for entry is edge-appended;
// the leftmost is client-controlled and would let an attacker rotate it to mint
// unlimited rate-limit buckets.
function clientIpHash(req: VercelRequest): string {
  const xff = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ip =
    (req.headers["x-real-ip"] as string) ||
    xff[xff.length - 1] ||
    req.socket?.remoteAddress ||
    "unknown";
  return crypto.createHash("sha256").update(String(ip)).digest("hex").slice(0, 16);
}

const ENUMS: Record<string, readonly string[]> = {
  made: ["Comic", "Meme", "Brand content", "Other"],
  audience: ["Myself", "A brand or client", "A community I run"],
  platform: ["X", "TikTok", "Instagram", "Discord", "Nowhere yet"],
  cadence: ["Daily", "Weekly", "Now and then"],
};

// Strip control chars and angle brackets so nothing stored can ever render as
// markup in an admin panel, present or future.
const clean = (v: unknown, max: number): string =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .replace(/[<>]/g, "")
        .trim()
        .slice(0, max)
    : "";

// Build a FRESH allowlisted object; unknown keys are dropped, never passed through.
// Returns null when a required enum is missing/unknown (→ 400).
function sanitizeApplication(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: Record<string, string> = {};

  for (const key of Object.keys(ENUMS)) {
    const v = r[key];
    if (typeof v !== "string" || !ENUMS[key].includes(v)) return null;
    out[key] = v;
  }

  const goal = clean(r.goal, 500);
  if (goal) out.goal = goal;

  const handle = clean(r.handle, 64);
  if (handle) out.handle = handle;

  const wallet = typeof r.wallet === "string" ? r.wallet.trim() : "";
  if (/^0x[a-fA-F0-9]{40}$/.test(wallet)) out.wallet = wallet;

  // Offline-dedupe metadata attached client-side (join key: PH users.clerk_user_id).
  if (r.app === "mobile") out.app = "mobile";
  if (typeof r.source === "string" && /^[a-z0-9_]{1,40}$/.test(r.source)) {
    out.source = r.source;
  }
  if (
    typeof r.clerk_user_id === "string" &&
    /^user_[A-Za-z0-9]{1,48}$/.test(r.clerk_user_id)
  ) {
    out.clerk_user_id = r.clerk_user_id;
  }
  const email = clean(r.email, 200);
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.email = email;
  if (
    typeof r.identity_source === "string" &&
    ["clerk-email", "clerk-wallet", "anon"].includes(r.identity_source)
  ) {
    out.identity_source = r.identity_source;
  }

  return out;
}

// The Redis key. Printable ASCII only so it can't pollute the key namespace.
function sanitizeIdentity(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v || v.length > 200) return null;
  return /^[\x21-\x7E]+$/.test(v) ? v : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // .json(), not .end(): the local vercelApiDev mockRes has no end().
  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });

  const redis = getRedis();

  // GET: has this identity already applied (on either app)? Fail open; not rate limited.
  if (req.method === "GET") {
    const identity = sanitizeIdentity(req.query?.identity);
    if (!identity || !redis) return res.status(200).json({ applied: false });
    try {
      const exists = await redis.exists(keyFor(identity));
      return res.status(200).json({ applied: !!exists });
    } catch {
      return res.status(200).json({ applied: false });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawApp = (req.body as Record<string, unknown> | undefined)?.application;
  if (JSON.stringify(rawApp || {}).length > MAX_APP_CHARS) {
    return res
      .status(413)
      .json({ error: "Application too large", code: "PAYLOAD_TOO_LARGE" });
  }

  const application = sanitizeApplication(rawApp);
  if (!application) {
    return res
      .status(400)
      .json({ error: "Invalid application", code: "INVALID_APPLICATION" });
  }

  const identity = sanitizeIdentity(
    (req.body as Record<string, unknown> | undefined)?.identity,
  );

  // Rate limit: best effort — a Redis hiccup must never block a legit applicant.
  if (redis) {
    try {
      const rlKey = `ratelimit:creator-app:${clientIpHash(req)}`;
      const hits = await redis.incr(rlKey);
      if (hits === 1) await redis.expire(rlKey, RATE_WINDOW);
      if (hits > RATE_MAX) {
        return res.status(429).json({
          error: "Too many applications. Try again later.",
          code: "RATE_LIMIT",
        });
      }
    } catch (e) {
      console.warn(
        "[creator-application] rate-limit check failed:",
        (e as Error)?.message,
      );
    }
  }

  // Stored as a JSON STRING — Panel Haus's admin list reader expects strings.
  const record = JSON.stringify({
    identity: identity ? String(identity).slice(0, 200) : null,
    application,
    ts: Date.now(),
  });

  // FAIL CLOSED on the write path (desktop changelog 1240). This route used to
  // return {ok:true} when Upstash was unconfigured or the write threw, which made
  // a missing env var invisible: prod accepted claims, showed "You're on the list",
  // and stored nothing for two hours. A claim we cannot store is a lead we lose, so
  // the client must learn about it and keep the user on the form.
  // The GET gate above still fails OPEN on purpose: re-showing the sheet to someone
  // who already applied is a smaller harm than locking a real creator out.
  if (!redis) {
    console.error("[creator-application] Upstash not configured — refusing the claim");
    return res
      .status(503)
      .json({ error: "Storage unavailable", code: "STORAGE_UNAVAILABLE" });
  }

  try {
    if (identity) {
      const already = await redis.exists(keyFor(identity));
      if (already)
        return res.status(200).json({ ok: true, stored: true, alreadyApplied: true });
      await redis.set(keyFor(identity), record, { ex: KEY_TTL });
    }
    await redis.rpush(LIST_KEY, record);
    await redis.ltrim(LIST_KEY, -LIST_MAX, -1);
  } catch (e) {
    console.error("[creator-application] redis write failed:", (e as Error)?.message);
    return res
      .status(503)
      .json({ error: "Could not save the application", code: "STORAGE_FAILED" });
  }

  // stored:true is the client's proof — only then may it burn the one-shot flag.
  return res.status(200).json({ ok: true, stored: true, alreadyApplied: false });
}
