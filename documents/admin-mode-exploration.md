# Admin Mode: Hosted API Key + Email Gate

## The Idea

A toggle (CLI command or Vercel env var) that switches between two modes:

1. **BYOK (current)** — users enter their own Gemini API key in Settings. No email required.
2. **Hosted** — the site uses the admin's API key. Users must provide an email before they can generate anything.

This lets you open Panel Shaq up to people who don't have a Gemini key, while collecting emails for the user base you're subsidizing.

---

## How It Works Today

```
User enters API key in Settings → stored in localStorage
    ↓
Client sends key as x-api-key header → /api/* routes
    ↓
Server resolves: x-api-key || process.env.GEMINI_API_KEY
    ↓
Calls Gemini with whichever key it found
```

The fallback to `process.env.GEMINI_API_KEY` already exists — if a user doesn't provide a key, the server's env var is used. But right now there's no gate on that free usage.

---

## Proposed Flow

### BYOK Mode (default, current behavior)

```
Settings → user enters API key → works as today
No email required. No changes.
```

### Hosted Mode (admin toggles on)

```
User opens app → sees email gate before any generation
    ↓
Enters email → stored in Supabase + localStorage
    ↓
All API calls use server-side GEMINI_API_KEY
    ↓
Settings screen hides the API key input (not needed)
```

---

## What Needs to Change

### 1. New env var: `APP_MODE`

Set in Vercel dashboard:

| Var        | Values                           | Effect                              |
| ---------- | -------------------------------- | ----------------------------------- |
| `APP_MODE` | `"byok"` (default) or `"hosted"` | Controls which mode the app runs in |

### 2. New API route: `GET /api/config`

Returns the current mode to the client. No secrets exposed.

```typescript
// api/config.ts
export default function handler(req, res) {
  res.json({
    mode: process.env.APP_MODE || "byok",
  });
}
```

Client fetches this on app load, stores in React state.

### 3. Email gate component

A modal/overlay that appears before any generation in hosted mode.

```
┌──────────────────────────────────┐
│                                  │
│   Enter your email to start     │
│   creating comics for free      │
│                                  │
│   ┌────────────────────────────┐ │
│   │ email@example.com          │ │
│   └────────────────────────────┘ │
│                                  │
│   [Get Started]                  │
│                                  │
│   Your email is only used to    │
│   keep you updated on Panel     │
│   Shaq. We won't spam you.     │
│                                  │
└──────────────────────────────────┘
```

- Shows once — after email is saved, doesn't appear again
- Email stored in localStorage + sent to Supabase
- No password, no login — just email collection

### 4. Supabase: emails table

```sql
create table emails (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  user_id text,            -- anonymous supabase user id
  created_at timestamptz default now(),
  source text default 'hosted_mode'
);
```

### 5. Client-side changes

**App.tsx:**

- Fetch `/api/config` on mount
- Store `appMode` in state
- If `hosted` and no email in localStorage → show email gate

**geminiService.ts:**

- If `appMode === "hosted"` → don't send `x-api-key` header (let server use its own)
- If `appMode === "byok"` → send user's key as today

**SettingsScreen.tsx:**

- If `appMode === "hosted"` → hide the API key input section
- Show "You're using Panel Shaq's hosted service" instead

### 6. API routes: validate hosted mode

All `/api/*` routes already fall back to `process.env.GEMINI_API_KEY`. No change needed there. But in hosted mode, optionally check that the user has an email on file:

```typescript
if (process.env.APP_MODE === "hosted") {
  const userId = req.headers["x-user-id"];
  // Optional: verify email exists for this user in Supabase
  // Or just trust the client — email gate is UX, not security
}
```

---

## How to Toggle (Admin)

### Option A: Vercel Dashboard

1. Go to Vercel → Project Settings → Environment Variables
2. Set `APP_MODE` = `"hosted"` (or `"byok"`)
3. Redeploy

### Option B: CLI Command

```bash
vercel env add APP_MODE hosted
vercel --prod
```

### Option C: Vercel API (scriptable)

```bash
curl -X POST "https://api.vercel.com/v1/projects/panel-shaq/env" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -d '{"key":"APP_MODE","value":"hosted","target":["production"]}'
```

---

## What Stays the Same

- All existing export, generation, and editing functionality — untouched
- BYOK users keep entering their own key — nothing changes for them
- Usage tracking via Supabase anonymous users — still works
- Daily rate limits — still enforced (maybe tighter in hosted mode)

---

## Implementation Steps

### Step 1: Config endpoint + client fetch

- Create `api/config.ts`
- Fetch mode on app load in `App.tsx`
- Pass `appMode` to screens via props

### Step 2: Email gate

- Build `EmailGate.tsx` component (modal)
- Show in hosted mode when no email in localStorage
- Save email to localStorage + Supabase

### Step 3: Conditional UI

- Hide API key input in Settings when hosted
- Skip `x-api-key` header when hosted
- Show "hosted" badge somewhere subtle

### Step 4: Tighter rate limits for hosted mode

- Hosted users get lower daily limits (they're using your key)
- Maybe 10 image gens / day vs 20 for BYOK

---

## Open Questions

- Should hosted mode require email verification (confirmation link), or is just collecting the address enough?
- Do we want a "waiting list" variant where the email gate says "join the waitlist" and doesn't unlock immediately?
- Should hosted mode users see a "Get your own API key for unlimited usage" upsell in Settings?
- Rate limits: what's the right daily cap for hosted mode given API costs?
