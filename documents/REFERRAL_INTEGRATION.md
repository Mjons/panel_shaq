# Referral Integration — Panel Haus Mobile

How `m.panelhaus.app` participates in Panel Haus's (PH) referral program. We add **no**
referral logic or data of our own — PH owns the codes, rewards, and idempotency. We only
**capture** an incoming code, **link** it after Clerk sign-in, and let users **share** their own.

Companion: `CLERK_INTEGRATION_DEFERRED_AND_WALLET_NOTES.md` (§1a), `PRODUCTION_LAUNCH_CHECKLIST.md`.

---

## The universal link (why it works both ways)

A referral code is universal: `PH-XXXXXX`. PH generates each user's canonical link as
**`https://www.panelhaus.app/?ref=PH-XXXXXX`**. That single link works for every recipient:

- **Opened on desktop** → lands on PH, which captures the code natively and links it at signup.
- **Opened on mobile** → PH redirects to `m.panelhaus.app/?ref=PH-XXXXXX`, where our capture takes
  over and links it after Clerk sign-in.

So whether the link is shared *from* desktop or *from* mobile, and opened *on* desktop or *on*
mobile, the same code reaches the right place. The mobile Share button shares PH's canonical
`referralUrl` (the `www` link), so mobile-originated invites also work for desktop recipients.

---

## Flow

```
[recipient opens …/?ref=PH-ABC123 (+ optional ?comic=ID)]
   ├─ desktop → PH handles it (unchanged)
   └─ mobile  → m.panelhaus.app/?ref=PH-ABC123
        │
   ReferralLinker (src/components/ReferralLinker.tsx — mounted in main.tsx
                   inside <ClerkProvider>, beside <ClerkTokenBridge/>)
     1. CAPTURE on mount: captureReferralFromUrl() validates /^PH-[A-Z0-9]{6}$/,
        stores panelshaq_referral_code (+ _comic_id), strips ONLY ref/comic from the URL.
     2. LINK when signed in: linkPendingReferral() → POST /api/referral-link (Bearer)
        → PH /api/referral/link-pending. On a terminal response (linked OR skipped)
        the stored code is cleared; on network error it's kept for next session.

[SHARE]  Settings → Account → ReferralCard:
   fetchMyReferral() → GET /api/referral-code (Bearer) → PH /api/referral/code
   → { code, referralUrl } → navigator.share / clipboard copy.
```

PH grants the rewards (referrer points + new-user welcome) inside `link-pending`, idempotently.
Self-referral and already-referred are handled PH-side (returns `{ ok:true, skipped:"…" }`).

---

## Files

**Proxies (server-to-server, mirror `api/credits-*.ts`: apex→www normalize, `redirect:"manual"`, `status===0→502`):**
- `api/referral-link.ts` — `POST`, forwards Bearer + `{ referralCode, comicId }` → PH `referral/link-pending`.
- `api/referral-code.ts` — `GET`, forwards Bearer → PH `referral/code` (`{ code, referralUrl }`).
- `api/referral-stats.ts` — `GET`, forwards Bearer → PH `referral/stats` (`{ referralCount, … }`).

**Frontend:**
- `src/services/referral.ts` — `captureReferralFromUrl`, `getStoredReferral`/`clearStoredReferral`, `linkPendingReferral`, `fetchMyReferral`. localStorage keys `panelshaq_referral_code` / `panelshaq_referral_comic_id`.
- `src/components/ReferralLinker.tsx` — invisible; capture on mount + link on sign-in (a `useRef` guard avoids redundant StrictMode calls; the endpoint is idempotent regardless).
- `src/components/ReferralCard.tsx` — "Refer a friend" Share/Copy UI in Settings → Account, with the "N referred" count. The code/URL is cached for the session (immutable, so reopening Settings is instant, no reload); the count is cached for instant display and refreshed on each open.

**Wiring:** `main.tsx` mounts `<ReferralLinker/>`; `AccountSection.tsx` renders `<ReferralCard/>` (signed-in).

All of it is **Clerk-gated** (`isClerkEnabled()`); with no publishable key, nothing mounts/fires.
The `/c/from-meme` receiver is untouched.

---

## Upstream dependency (PH side, one line)

PH's **auto-redirect** to mobile (`Comic-Pro2/src/components/UI/MobileBlocker.jsx`) currently does
`window.location.href = "https://m.panelhaus.app"` and **drops the query string**. To preserve the
code on that path, it must append the pending `?ref=`/`?comic=` to the URL — exactly like PH's own
manual "Start creating" CTA already does (`src/pages/LandingPage/index.jsx`). Until then:
- Manual CTA path: code preserved ✅
- Auto-countdown path: code lost ❌ (needs the fix)
- Directly-shared `m.panelhaus.app/?ref=` links and our Share links (canonical `www`): unaffected ✅

---

## Verification

1. `npm run lint`.
2. Local (PH backend + panel_shaq + same dev Clerk instance; `PANELHAUS_API_BASE=http://localhost:3001`):
   - Open `localhost:3002/?ref=PH-ABC123` (a code from another PH account) → URL cleans, code stored.
   - Sign in with a **fresh** account → `/api/referral-link` → `{ ok:true, linked:true }`; stored code cleared. Check PH DB: `referred_by_user_id` set; referrer got points.
   - Sign in again → `{ ok:true, skipped:"already-referred" }`, no double award.
   - `/?ref=bogus` → ignored (regex), no call.
   - Settings → Refer a friend → shows `https://www.panelhaus.app/?ref=…`; Share/Copy work; opening that link on desktop + mobile both link.
   - Unset `VITE_CLERK_PUBLISHABLE_KEY` → nothing fires. `/c/from-meme` unaffected.
