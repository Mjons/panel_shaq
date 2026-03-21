# Cloud Storage Plan

## Goal

Move from browser-only storage (IndexedDB + localStorage) to Supabase cloud storage so users get persistent, cross-device access to their projects without needing a native app.

---

## What's Already Done

| Area                        | Details                                                                  |
| --------------------------- | ------------------------------------------------------------------------ |
| **Supabase client**         | `src/services/supabase.ts` — client initialized from env vars            |
| **Anonymous auth**          | `signInAnonymously()` with cached user ID                                |
| **Usage tracking**          | `usage` table in Supabase Postgres, enforced in all API endpoints        |
| **Local project save/load** | IndexedDB via `src/services/projectStorage.ts`, auto-save every 30s      |
| **PWA**                     | Service worker, manifest, Add-to-Home-Screen ready via `vite-plugin-pwa` |
| **Image compression**       | JPEG compression at 80% quality in `src/services/geminiService.ts`       |

---

## What Needs Building

### Phase 1 — Auth + Storage (enables everything else)

#### 1. Real Authentication

Replace anonymous auth with Google/email sign-in using Supabase Auth.

- Enable Google OAuth provider in Supabase dashboard
- Add login/signup UI (modal or dedicated screen)
- Session management (persist session, auto-refresh tokens)
- Sign-out button in settings
- **Why:** Anonymous auth can't recover data if the browser is cleared. Real auth ties data to an identity.

#### 2. Supabase Storage Bucket

Create an `images` bucket for all user-uploaded and generated images.

- Create bucket with RLS policy (users can only access their own images)
- Build an `uploadImage(userId, file/base64)` helper that returns a public URL
- Upload character reference images on vault entry creation
- Upload generated panel images after generation
- Store the returned URL in state instead of raw base64
- **Why:** Base64 in IndexedDB bloats local storage and can't sync across devices.

---

### Phase 2 — Cloud Projects

#### 3. Database Schema

Create tables in Supabase Postgres:

**`projects`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| user_id | uuid | references auth.users |
| name | text | project name |
| story | text | story textarea content |
| settings | jsonb | camera defaults, aspect ratio, etc. |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**`panels`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| project_id | uuid | references projects |
| order | integer | panel position |
| description | text | panel prompt |
| camera_angle | text | |
| camera_lens | text | |
| mood | text | |
| image_url | text | points to Storage bucket |
| created_at | timestamptz | |

**`vault_entries`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| user_id | uuid | references auth.users |
| name | text | character/environment name |
| type | text | Character, Environment, etc. |
| description | text | AI-generated or user-written |
| image_url | text | points to Storage bucket |
| created_at | timestamptz | |

**`pages`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| project_id | uuid | references projects |
| order | integer | page position |
| layout | jsonb | panel arrangement data |

RLS policies on all tables: users can only CRUD their own rows.

#### 4. Cloud Service Layer

Create `src/services/cloudStorage.ts` to replace/wrap `projectStorage.ts`:

- `saveProjectToCloud(project)` — upsert project + panels + pages
- `loadProjectFromCloud(projectId)` — fetch project with related data
- `listUserProjects()` — fetch all projects for current user
- `deleteProjectFromCloud(projectId)` — cascade delete
- `saveVaultEntry(entry)` / `loadVaultEntries()` — vault CRUD

#### 5. Update App.tsx

- Wire save/load to cloud service instead of (or alongside) IndexedDB
- Auto-save writes to cloud (debounced, not every 30s — avoid hammering the API)
- Project list in ProjectManager fetches from Supabase
- Loading a project hydrates state from cloud data + image URLs

---

### Phase 3 — Polish

#### 6. Local Migration Tool

One-time migration for existing users:

- Detect existing IndexedDB projects on app load
- Prompt user to sign in and migrate
- Upload all base64 images to Storage bucket
- Save all projects/panels/vault to Postgres
- Clear local IndexedDB bloat after successful migration

#### 7. Offline Fallback

- Keep IndexedDB as a local cache for fast reads
- Queue writes when offline, sync when connection returns
- Conflict resolution: last-write-wins (simple, good enough for single-user)

#### 8. Storage Quota Management

- Set per-user storage limits (e.g., 500MB images, 50 projects)
- Show storage usage in settings screen
- Compress/resize images before upload if over threshold

---

## Files That Will Change

| File                                | Changes                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| `src/services/supabase.ts`          | Add real auth methods (signIn, signOut, onAuthStateChange) |
| `src/services/projectStorage.ts`    | Wrap with cloud sync, keep as local cache                  |
| `src/services/cloudStorage.ts`      | **New** — cloud CRUD operations                            |
| `src/App.tsx`                       | Wire auth state, swap save/load to cloud                   |
| `src/components/ProjectManager.tsx` | Fetch project list from cloud                              |
| `src/screens/WorkshopScreen.tsx`    | Upload vault images to Storage bucket                      |
| `src/screens/DirectorScreen.tsx`    | Store generated image URLs instead of base64               |
| `src/components/AuthModal.tsx`      | **New** — login/signup UI                                  |
| Supabase dashboard                  | Create tables, bucket, RLS policies, enable OAuth          |

---

## Why Not a Native App

- The web app already works on mobile (PWA with Add-to-Home-Screen)
- Supabase gives us auth, storage, and database without a second codebase
- Image generation requires network anyway (Gemini API) — no offline advantage
- No app store fees, no review process, instant deploys via Vercel
- A native app would need the same cloud backend, plus platform-specific UI code
