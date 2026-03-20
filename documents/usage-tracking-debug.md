# Usage Tracking Debug — Why Rows Don't Appear

## The Flow (How It Should Work)

```
User clicks "Generate Panels"
    ↓
Client: geminiService.ts → apiPost("generate-panels", ...)
    ↓  sends x-user-id header (from Supabase anonymous auth)
    ↓  sends x-api-key header (user's Gemini key)
    ↓
Server: api/generate-panels.ts
    ↓  checkUsage(req, "text") → reads/writes Supabase usage table
    ↓  calls Gemini REST API
    ↓  returns panels JSON
    ↓
Client: receives panels, renders them
```

## What's Actually Happening

### Problem 1: Proxy Fallback Bypasses API Routes Entirely

`geminiService.ts` has a `_proxyAvailable` flag (line 114):

```ts
let _proxyAvailable: boolean | null = null;
```

If the proxy ever returns 404 (even once, during a deploy), it sets:

```ts
_proxyAvailable = false;
```

After that, ALL subsequent `apiPost()` calls immediately throw `"proxy-unavailable"` WITHOUT ever hitting the server:

```ts
if (_proxyAvailable === false) {
  throw new Error("proxy-unavailable");
}
```

The catch handler then falls back to calling Gemini directly via the SDK:

```ts
} catch (error) {
  if (error?.message === "proxy-unavailable") {
    const ai = await getDirectAI();  // Direct SDK call — NO server, NO usage tracking
    ...
  }
}
```

**Result:** User's generations work fine (via direct SDK), but the API routes are never called, so Supabase never gets written to.

### Problem 2: Client May Not Have Supabase User ID

The `getUserId()` function (supabase.ts line 14) requires:

1. `VITE_SUPABASE_URL` env var to be baked into the client build
2. `VITE_SUPABASE_ANON_KEY` env var to be baked into the client build
3. Successful anonymous auth call to Supabase

If any of these fail, `getUserId()` returns `""`, and the `x-user-id` header is never sent. The server-side `checkUsage` sees no user ID and silently skips:

```ts
const userId = (req.headers["x-user-id"] as string) || "";
if (!userId) return null; // ← silently skip
```

### Problem 3: VITE\_ Env Vars Must Be Present at BUILD Time

Vite replaces `import.meta.env.VITE_*` at build time, not runtime. If the env vars weren't set when the Vercel build ran, they're baked in as empty strings forever until the next build.

Check: View source on the deployed site and search for `supabase.co`. If it's not there, the env vars weren't present at build time.

## Fixes Needed

### Fix 1: Remove the proxy fallback (or make it retry)

The `_proxyAvailable = false` flag is too sticky. Once set, the entire session bypasses the proxy. Options:

- **Remove the fallback entirely.** If proxy fails, show the error. Don't silently fall back to direct SDK.
- **Make it retry periodically.** Reset `_proxyAvailable` to `null` after N minutes.
- **Remove the flag.** Always try the proxy first. Only fall back per-request, not globally.

**Recommended: Remove the fallback.** The proxy works now. The fallback was added when the proxy was broken. It's now masking the proxy from being used.

### Fix 2: Rebuild after setting VITE\_ env vars

The `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set BEFORE the build runs. If you added them after the last deploy, trigger a new build:

```bash
git commit --allow-empty -m "Rebuild with Supabase env vars" && git push
```

### Fix 3: Add logging to confirm the flow

Temporarily add `console.log` in the client to verify:

- Is `getUserId()` returning a UUID?
- Is `_proxyAvailable` set to `false`?
- Is the `x-user-id` header being sent?

## Quick Test

Open browser console on the deployed site and run:

```js
const { getUserId } = await import("/src/services/supabase.ts");
const id = await getUserId();
console.log("User ID:", id);
```

If it returns empty string → Supabase client isn't configured (VITE\_ env vars missing at build time).
