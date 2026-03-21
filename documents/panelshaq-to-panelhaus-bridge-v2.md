# Panel Shaq → Panelhaus Bridge v2

## Context Change

Both Panel Shaq and Panelhaus are **web apps** — no Electron, no desktop process. The WebSocket bridge (v1) assumed Panelhaus was an Electron app that could run a WS server on localhost. That doesn't work. Two browser tabs can't talk via WebSocket.

## The Two Apps

| App        | URL                                  | Purpose                                                                                    |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| Panel Shaq | `panelhaus.app`                      | Mobile-first AI comic generator. Users create stories, generate panels, arrange layouts.   |
| Panelhaus  | `panelhaus.com` (or separate domain) | Full desktop editor. Canvas, layers, text tools, effects. Where users polish their comics. |

## What We Need

User generates a comic on Panel Shaq → taps one button → comic opens in Panelhaus editor. No file downloads, no manual import.

---

## Options (for two web apps)

### Option A: Supabase Realtime Channel (RECOMMENDED)

Both apps connect to the same Supabase project. Panel Shaq pushes project data to a shared channel, Panelhaus listens and imports.

**Flow:**

```
Panel Shaq                    Supabase                    Panelhaus
    │                            │                            │
    │  1. User taps "Send"       │                            │
    │──── INSERT into ──────────►│                            │
    │     "transfers" table      │                            │
    │                            │  2. Realtime event ───────►│
    │                            │                            │
    │                            │  3. Panelhaus downloads    │
    │                            │◄──── project data ─────────│
    │                            │                            │
    │  4. Show "Sent!" toast     │  5. Opens on canvas        │
```

**How:**

1. Create a `transfers` table in Supabase
2. Panel Shaq inserts a row with the `.comic` JSON (or a reference to Supabase Storage)
3. Panelhaus subscribes to realtime changes on `transfers` where `recipient = user_id`
4. When a new row appears, Panelhaus fetches it and imports

**Schema:**

```sql
create table public.transfers (
  id uuid default gen_random_uuid() primary key,
  sender_id text not null,
  recipient_id text,           -- null = self-transfer
  project_data jsonb not null, -- the .comic JSON
  status text default 'pending', -- pending | claimed | expired
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '24 hours'
);

-- Auto-cleanup expired transfers
-- (or use a cron job)
```

**Pros:**

- Works across devices (phone → desktop on different machine)
- Works across origins (different domains)
- Already have Supabase set up
- Realtime = near-instant
- Both apps can share the same Supabase project

**Cons:**

- Needs both apps to use the same Supabase project (or share keys)
- Large projects = large JSONB rows (images are base64)
- Better to use Supabase Storage for the actual data and just the transfer ID in the table

**Best approach:** Store the `.comic` file in Supabase Storage, put just the file URL in the `transfers` table. Panelhaus fetches from Storage.

---

### Option B: Share Link (Simplest)

Panel Shaq generates a unique link. User opens it in Panelhaus.

**Flow:**

```
Panel Shaq                                          Panelhaus
    │                                                   │
    │  1. Upload .comic to Supabase Storage              │
    │  2. Generate link: panelhaus.com/import/abc123     │
    │  3. User taps link or copies it                    │
    │                                                   │
    │                    4. Panelhaus opens link ────────►│
    │                    5. Downloads .comic from Storage │
    │                    6. Imports into editor           │
```

**Pros:**

- Dead simple
- Works across devices
- No realtime needed
- User can share the link with others too

**Cons:**

- Not instant — user has to navigate to the link
- Need a `/import/:id` route in Panelhaus
- Storage costs

---

### Option C: Clipboard + Panelhaus Import Detection

Panel Shaq copies a special payload to clipboard. Panelhaus detects it on focus.

**Flow:**

1. User taps "Copy for Panelhaus" → clipboard gets a JSON blob
2. User switches to Panelhaus tab
3. Panelhaus checks clipboard on window focus (with permission)
4. If it finds a `.comic` payload → offers to import

**Pros:**

- No server needed
- Works same-machine only (which is the common case)

**Cons:**

- Clipboard API requires user permission
- Size limits
- Feels janky

---

### Option D: Same-Origin Communication (if same domain)

If both apps are on subdomains of the same root (e.g., `app.panelhaus.com` and `studio.panelhaus.com`), they can use:

- **BroadcastChannel** — instant, zero setup, both tabs communicate
- **localStorage events** — one writes, the other's `storage` event fires
- **SharedWorker** — shared background thread

**This only works if both apps share the same origin or set `document.domain` to the same root.**

---

## Recommendation

**Option A (Supabase Realtime) for cross-device.**
**Option B (Share Link) as the MVP — ship this first.**

### MVP: Share Link

This is the fastest to implement and gives 80% of the value:

1. Panel Shaq uploads `.comic` to Supabase Storage
2. Creates a `transfers` row with the storage URL
3. Shows a link: `panelhaus.com/import/abc123`
4. User taps → opens Panelhaus → it auto-imports

**Panel Shaq side (already partially built):**

- `exportAsComic()` generates the `.comic` JSON ✓
- Supabase client exists ✓
- Just needs: upload to Storage + generate link

**Panelhaus side needs:**

- A `/import/:id` route
- Fetch the `.comic` from Supabase Storage
- Import using existing `.comic` import logic
- Delete the transfer after claiming

### Upgrade to Realtime Later

Once Share Link works, add Supabase Realtime so that if both apps are open simultaneously, the transfer is instant — no link clicking needed.

---

## What Panel Shaq Has Already Built

- `exportAsComic()` — generates Panelhaus-compatible `.comic` JSON with layers wrapper, strokeWidth/strokeColor, version 2.0.0, blueprints, etc.
- `desktopBridge.ts` — WebSocket client (needs to be replaced with Supabase transfer)
- ShareScreen — UI for the send button, detection, fallback to download
- Supabase client — anonymous auth, usage tracking

## What Panelhaus Needs To Build

1. **`/import/:id` route** — fetches transfer from Supabase, downloads `.comic`, imports
2. **Import adapter** — `convertPanelShaqFormat()` to handle any format differences (already documented in `PANEL_SHAQ_EXPORT_COMPATIBILITY.md`)
3. **Optional: Realtime listener** — subscribe to `transfers` table for instant push

## Shared Requirement

Both apps need access to the same Supabase project:

- **Supabase URL:** `https://xhugcilxdxpnvjlahyar.supabase.co`
- **Anon key:** (Panel Shaq already has this as `VITE_SUPABASE_ANON_KEY`)
- Panelhaus needs the same anon key to read from the `transfers` table and Storage

---

## Transfer Table SQL

Run this in the shared Supabase project:

```sql
-- Transfer queue for Panel Shaq → Panelhaus handoff
create table public.transfers (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid,
  file_path text not null,        -- path in Supabase Storage
  project_name text default 'Untitled',
  status text default 'pending',  -- pending | claimed | expired
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '24 hours'
);

-- RLS: anyone can read pending transfers (they're short-lived)
alter table public.transfers enable row level security;

create policy "Anyone can read pending transfers"
  on public.transfers for select
  using (status = 'pending' and expires_at > now());

-- Only service role can insert (Panel Shaq's API route)
-- Panelhaus reads via anon key
```

## Storage Bucket

Create a `transfers` bucket in Supabase Storage:

- Public: No (use signed URLs or service key)
- File size limit: 50MB
- Allowed MIME types: application/json
