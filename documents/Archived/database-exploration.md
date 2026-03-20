# Database Exploration — What to Store, Where, and Why

## Current State

Everything lives client-side:

- **IndexedDB** — panels (with base64 images), characters, style references
- **localStorage** — settings, API key, story text, pages, project metadata

Users bring their own Gemini key. We have zero backend state. This is great for simplicity but bad for:

- Sharing comics between devices
- Analytics (we don't know how many people use the app)
- Rate limiting abusers (someone could hammer the proxy with a stolen key)
- Gallery/community features
- Monetization (we can't meter usage without a backend)

## What We Actually Want to Store

Ranked by value:

| Data                  | Why                                        | Size             | Write Frequency |
| --------------------- | ------------------------------------------ | ---------------- | --------------- |
| **User sessions**     | Know who's using the app, basic analytics  | Tiny             | Once per visit  |
| **Project metadata**  | Cross-device access, share links           | ~1KB per project | On save         |
| **Usage counters**    | Rate limiting, metering for future billing | Tiny             | Per API call    |
| **Panel images**      | The expensive part — cross-device, sharing | 500KB-2MB each   | Per generation  |
| **Full project data** | Story, characters, pages, settings         | 10KB-50KB        | On save         |

## Option Analysis

### Option 1: Supabase (Postgres + Storage)

**What:** Hosted Postgres for metadata + Supabase Storage (S3-backed) for images.

**Pros:**

- Free tier: 500MB database, 1GB storage, 2GB bandwidth
- Built-in auth (magic link, OAuth, anonymous)
- Row-level security — users can only access their own data
- Real-time subscriptions (future: collaborative editing)
- JS client is tiny (~5KB gzipped)

**Cons:**

- Another dependency
- Free tier bandwidth (2GB) could be tight with base64 images
- Need to manage migrations

**Schema sketch:**

```sql
users (id, created_at, email?, anonymous_id)
projects (id, user_id, name, story, characters_json, pages_json, style, updated_at)
panels (id, project_id, description, camera, lens, mood, image_url, order)
usage (user_id, date, generations_count, image_count)
```

Images stored in Supabase Storage bucket, referenced by URL in panels table.

**Cost at scale:**

- 1000 users × 5 projects × 6 panels × 1MB = 30GB storage → ~$0.75/month (Pro plan)
- Database stays tiny

---

### Option 2: Cloudflare D1 + R2

**What:** D1 (SQLite at the edge) for metadata + R2 (S3-compatible) for images.

**Pros:**

- D1 free tier: 5GB storage, 5M reads/day, 100K writes/day
- R2 free tier: 10GB storage, 10M reads/month, 1M writes/month — no egress fees ever
- No egress costs is huge for image-heavy apps
- Edge-deployed = fast everywhere

**Cons:**

- Need Cloudflare Workers for API (we're on Vercel)
- D1 is still technically in beta
- Auth not built-in — need to roll your own or use a third party
- Requires moving off Vercel or running a hybrid setup

**Verdict:** Great tech but bad fit — we're on Vercel. Migrating infra just for DB isn't worth it.

---

### Option 3: Vercel KV + Vercel Blob

**What:** Vercel's own Redis (KV) for metadata + Blob storage for images.

**Pros:**

- Zero config — same platform, same deploy
- KV free tier: 30K requests/month, 256MB storage
- Blob free tier: 250MB storage
- Native integration with our existing API routes

**Cons:**

- KV is Redis (key-value), not relational — awkward for queries
- Blob free tier is tiny (250MB = ~250 panels worth of images)
- Scales expensively — Blob Pro is $0.12/GB stored + $0.30/GB bandwidth
- KV Pro is $1/100K requests
- No built-in auth

**Verdict:** Easiest to set up but scales poorly. Good for prototyping, not for image storage.

---

### Option 4: Firebase (Firestore + Cloud Storage)

**What:** Google's Firestore for metadata + Cloud Storage for images.

**Pros:**

- Free tier: 1GB Firestore, 5GB Cloud Storage
- Built-in auth (same Google ecosystem as Gemini keys)
- Users already have Google accounts (Gemini key requires one)
- Generous free tier for storage
- Good JS SDK

**Cons:**

- Firebase SDK is heavy (~100KB)
- Firestore pricing is per-read/write (can get expensive with frequent saves)
- Vendor lock-in (but we're already Google-dependent via Gemini)
- NoSQL = no joins, denormalized data

**Verdict:** Strong option given we're already in Google's ecosystem.

---

### Option 5: Minimal — Just Supabase Auth + Usage Counter

**What:** Don't migrate storage at all. Keep everything client-side. Just add:

1. Anonymous auth (fingerprint or Supabase anonymous sign-in)
2. A `usage` table tracking generations per user per day
3. Rate limiting in the API routes

**Pros:**

- Smallest change — no data migration
- Users keep their images locally (privacy)
- We get analytics + rate limiting
- Can upgrade to full storage later
- Supabase free tier easily handles this

**Cons:**

- No cross-device sync
- No share links (yet)
- Images still lost if user clears browser data

**Schema:**

```sql
users (id, fingerprint, created_at, last_seen)
usage (id, user_id, date, text_generations, image_generations, total_cost_estimate)
```

API routes check usage before forwarding to Gemini. If user exceeds daily limit → 429.

---

## Recommendation

**Phase 1 (now): Option 5 — Supabase Auth + Usage Counter**

Why:

- Adds rate limiting (prevents abuse of the Gemini proxy)
- Gives us basic analytics (DAU, generations per user)
- Minimal code change — just add a middleware check in API routes
- Free tier covers us for thousands of users
- No data migration, no breaking changes
- Sets the foundation for Phase 2

Daily limits for free users:

- 50 text generations (panels, polish, insert)
- 20 image generations
- Resets at midnight UTC

**Phase 2 (later): Option 1 or 4 — Full Storage**

When we want cross-device sync or sharing:

- Supabase if we want Postgres + clean relational model
- Firebase if we want to stay in Google's ecosystem

Either way, the `users` table from Phase 1 carries forward.

**Phase 3 (monetization): Paid tiers**

The usage table from Phase 1 becomes the billing meter:

- Free: 50 text / 20 images per day
- Pro ($X/mo): 500 text / 200 images per day
- Unlimited: uncapped, direct Gemini billing passthrough

---

## Phase 1 Implementation — Step by Step

### Step 1: Create Supabase Project

1. Go to https://supabase.com → "Start your project"
2. Create a new project (pick a region close to your Vercel region)
3. Wait for it to provision (~30 seconds)
4. Go to **Settings → API** and copy:
   - `Project URL` (e.g. `https://abc123.supabase.co`)
   - `anon public` key (safe to expose, RLS protects data)
   - `service_role` key (KEEP SECRET — only for server-side)

### Step 2: Enable Anonymous Auth

1. Go to **Authentication → Providers**
2. Scroll to **Anonymous Sign-ins**
3. Toggle it **ON**
4. Save

This lets us create sessions without requiring email/password. Each browser gets a persistent anonymous user ID.

### Step 3: Create Database Tables

Go to **SQL Editor** and run this:

```sql
-- Usage tracking table
create table public.usage (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  date date not null default current_date,
  text_generations int not null default 0,
  image_generations int not null default 0,
  created_at timestamptz not null default now(),

  -- One row per user per day
  unique(user_id, date)
);

-- Index for fast lookups
create index idx_usage_user_date on public.usage(user_id, date);

-- Analytics view (optional — for dashboard queries)
create view public.daily_stats as
select
  date,
  count(distinct user_id) as unique_users,
  sum(text_generations) as total_text,
  sum(image_generations) as total_images
from public.usage
group by date
order by date desc;

-- Row Level Security
alter table public.usage enable row level security;

-- Users can only read their own usage
create policy "Users can read own usage"
  on public.usage for select
  using (auth.uid() = user_id);

-- Only service role can insert/update (server-side API routes)
-- No insert/update policy for anon = blocked client-side
-- Server uses service_role key which bypasses RLS
```

### Step 4: Add Environment Variables

**Vercel Dashboard → Settings → Environment Variables:**

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  (service_role key — NEVER expose to client)
```

**Local `.env` file (for `vercel dev`):**

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

Note: We use the `service_role` key server-side (bypasses RLS) so the API routes can write usage. The client uses the `anon` key (read-only via RLS) just for auth and reading usage.

**Also add to Vercel:**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  (anon key — safe to expose)
```

### Step 5: Install Client

```bash
npm install @supabase/supabase-js
```

### Step 6: Server-Side Usage Middleware

Create a helper that each API route calls before hitting Gemini.

**File: `api/usage.ts` (NOT a route — but since we can't share files in api/, inline this into each route OR use a different approach)**

Since Vercel can't share files between API routes, we have two options:

- **Option A:** Inline the Supabase check in each route (repetitive but works)
- **Option B:** Make a single `/api/check-usage` endpoint that the client calls before each generation, and the generation routes trust it

**Recommended: Option A with a copy-paste block.** Each API route gets this at the top:

```ts
import { createClient } from "@supabase/supabase-js";

const LIMITS = { text: 50, image: 20 };

async function checkAndIncrementUsage(
  req: any,
  type: "text" | "image",
): Promise<{ allowed: boolean; remaining: number; error?: string }> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { allowed: true, remaining: 999 }; // Skip if not configured

  const supabase = createClient(url, key);
  const userId = (req.headers["x-user-id"] as string) || "";
  if (!userId) return { allowed: true, remaining: 999 }; // Skip if no user

  const today = new Date().toISOString().split("T")[0];
  const column = type === "image" ? "image_generations" : "text_generations";
  const limit = type === "image" ? LIMITS.image : LIMITS.text;

  // Upsert: create row if not exists, increment if exists
  const { data } = await supabase
    .from("usage")
    .upsert(
      { user_id: userId, date: today, [column]: 1 },
      { onConflict: "user_id,date" },
    )
    .select(column)
    .single();

  // If row already existed, we need to increment instead
  if (data && data[column] > 1) {
    // Row existed — the upsert reset it. Fix with an increment.
  }

  // Actually, simpler approach — just read then conditionally write:
  const { data: existing } = await supabase
    .from("usage")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  const currentCount = existing?.[column] || 0;
  if (currentCount >= limit) {
    return {
      allowed: false,
      remaining: 0,
      error: `Daily ${type} limit reached (${limit}/day). Resets at midnight UTC.`,
    };
  }

  if (existing) {
    await supabase
      .from("usage")
      .update({ [column]: currentCount + 1 })
      .eq("user_id", userId)
      .eq("date", today);
  } else {
    await supabase
      .from("usage")
      .insert({ user_id: userId, date: today, [column]: 1 });
  }

  return { allowed: true, remaining: limit - currentCount - 1 };
}
```

Then in each route handler, before the Gemini call:

```ts
const usage = await checkAndIncrementUsage(req, "image"); // or "text"
if (!usage.allowed) {
  return res.status(429).json({ error: usage.error });
}
// Add remaining count to response headers for client
res.setHeader("X-Remaining", String(usage.remaining));
```

### Step 7: Client-Side Auth

Create a Supabase client that handles anonymous auth:

**File: `src/services/supabase.ts`**

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = supabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

let _userId: string | null = null;

export async function getUserId(): Promise<string> {
  if (_userId) return _userId;
  if (!supabase) return "";

  // Check for existing session
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user?.id) {
    _userId = session.user.id;
    return _userId;
  }

  // Create anonymous session
  const { data } = await supabase.auth.signInAnonymously();
  _userId = data?.user?.id || "";
  return _userId;
}
```

Then in `geminiService.ts`, add the user ID to every API request:

```ts
// In apiPost(), add to headers:
const userId = await getUserId();
if (userId) headers["x-user-id"] = userId;
```

### Step 8: Client-Side Usage Display

**In Settings screen**, show current usage:

```ts
// Fetch usage from Supabase directly (read-only via RLS)
const { data } = await supabase
  .from("usage")
  .select("text_generations, image_generations")
  .eq("user_id", userId)
  .eq("date", new Date().toISOString().split("T")[0])
  .maybeSingle();
```

Display: "Images: 12 / 20 today" with a progress bar.

### Step 9: Vite Config

Add the Supabase env vars to Vite's define block so the client can access them:

```ts
// vite.config.ts
define: {
  // These are exposed to the client (safe — anon key is public)
},
```

Actually, Vite auto-exposes `import.meta.env.VITE_*` vars. So just name them:

**Vercel env vars:**

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Step 10: Vercel Deploy

1. Add all env vars to Vercel dashboard
2. Push code
3. Verify: hit an API route, check Supabase dashboard → Table Editor → `usage`

---

## After Setup Checklist

- [ ] Supabase project created
- [ ] Anonymous auth enabled
- [ ] `usage` table + RLS created
- [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in Vercel env vars
- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel env vars
- [ ] Same vars in local `.env`
- [ ] `@supabase/supabase-js` installed
- [ ] API routes check usage before Gemini calls
- [ ] Client sends `x-user-id` header
- [ ] Settings shows usage counter
- [ ] 429 errors display branded "limit reached" message
