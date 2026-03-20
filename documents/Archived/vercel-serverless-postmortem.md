# Vercel Serverless Postmortem

How we debugged and fixed `FUNCTION_INVOCATION_FAILED` on all API routes.

---

## Symptom

Every API route returned `500 FUNCTION_INVOCATION_FAILED` on Vercel. The health check in Settings (client-side SDK call) worked fine, but server-side routes crashed before executing any code. Desktop appeared to work because the client had a direct-to-Gemini fallback that silently bypassed the broken proxy.

---

## Root Causes (3 layered issues)

### 1. `_utils.ts` excluded from bundle

**What happened:** We created `api/_utils.ts` as a shared helper file. Vercel's convention treats files prefixed with `_` as private — they're excluded from the serverless bundle. But the compiled routes still had `import { ... } from "./_utils"`, so at runtime:

```
ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/api/_utils'
```

**Fix attempt:** Renamed to `api/shared.ts` — but that created a new problem: Vercel deployed it as its own route (`/api/shared`).

**Fix attempt 2:** Moved to `lib/api-utils.ts` outside the `api/` directory — but Vercel's bundler only includes files _within_ the `api/` directory for each function. External imports are not resolved.

**Final fix:** Inlined all helpers directly into each route file. Zero local imports.

### 2. `@google/genai` SDK crashes in Vercel runtime

**What happened:** Even after fixing the import issue, functions using `import { GoogleGenAI } from "@google/genai"` crashed with:

```
ReferenceError: exports is not defined in ES module scope
```

The package.json has `"type": "module"`, so Node treats `.js` files as ESM. But the `@google/genai` SDK outputs CommonJS-style `exports` assignments that are invalid in ESM context. Vercel's bundler doesn't reconcile this.

**Final fix:** Replaced all SDK usage with direct `fetch()` calls to the Gemini REST API (`https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`). Zero dependency on `@google/genai` in server code.

### 3. `"framework": "vite"` in vercel.json

**What happened:** Early on, `vercel.json` had `"framework": "vite"` which told Vercel to treat the project as a static Vite site. This interfered with serverless function detection and deployment.

**Fix:** Removed the `framework` field. Vercel auto-detects the build from `buildCommand` and `outputDirectory`.

---

## What We Tried (in order)

| #   | Attempt                                                | Result                          | Why it failed                                       |
| --- | ------------------------------------------------------ | ------------------------------- | --------------------------------------------------- |
| 1   | `api/_utils.ts` shared helpers                         | `ERR_MODULE_NOT_FOUND`          | `_` prefix = excluded from bundle                   |
| 2   | Rename to `api/shared.ts`                              | Deployed as `/api/shared` route | Every file in `api/` becomes a route                |
| 3   | Move to `lib/api-utils.ts`                             | `ERR_MODULE_NOT_FOUND`          | Vercel doesn't bundle files outside `api/`          |
| 4   | Add `api/tsconfig.json` with `module: commonjs`        | No effect                       | Vercel uses its own bundler, ignores local tsconfig |
| 5   | Add `"functions"` config with `@vercel/node@3` runtime | No effect                       | Runtime wasn't the issue                            |
| 6   | Remove `"framework": "vite"`                           | Partial help                    | Fixed detection but SDK still crashed               |
| 7   | Self-contained function with `GoogleGenAI` SDK         | `exports is not defined`        | ESM/CJS mismatch with `"type": "module"`            |
| 8   | REST API via `fetch()` + fully inlined helpers         | **Works**                       | No SDK, no imports, no bundling issues              |

---

## Final Architecture

```
api/
  health.ts          — self-contained, uses fetch() to Gemini REST API
  generate-panels.ts — self-contained, uses fetch() to Gemini REST API
  polish-story.ts    — self-contained, uses fetch() to Gemini REST API
  insert-panel.ts    — self-contained, uses fetch() to Gemini REST API
  generate-image.ts  — self-contained, uses fetch() to Gemini REST API
  final-render.ts    — self-contained, uses fetch() to Gemini REST API
```

Each file:

- Has ONLY `import type { VercelRequest, VercelResponse } from "@vercel/node"`
- Defines its own `getApiKey()`, `geminiText()` or `geminiImage()` inline
- Uses `fetch()` against `https://generativelanguage.googleapis.com/v1beta/`
- Zero shared files, zero SDK dependencies

---

## Lessons Learned

1. **Vercel serverless functions are aggressively isolated.** Don't assume you can share code between them via imports — each function is bundled independently.

2. **`_` prefix means "don't deploy as a route" but ALSO "don't include in other bundles."** There's no way to have a shared non-route file inside `api/`.

3. **`"type": "module"` in package.json affects serverless functions too.** If your SDK outputs CJS but your project is ESM, the function will crash at import time.

4. **The `@google/genai` SDK doesn't work in Vercel serverless.** Use the REST API directly. It's actually simpler — just `fetch()` with JSON body.

5. **Client-side fallbacks can mask server-side failures.** Desktop worked because the client had a direct-to-Gemini fallback. Mobile didn't have the key in localStorage yet, so it relied on the broken proxy. This delayed diagnosis.

6. **`FUNCTION_INVOCATION_FAILED` means the function crashed before returning.** It's always an import/bundling/syntax issue, not a logic error. Check Vercel logs with `vercel logs <domain>`.
