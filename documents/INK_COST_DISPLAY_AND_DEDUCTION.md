# Ink Cost — Display & Deduction Map

How Panel Haus Mobile shows what each AI action costs, and how that cost is
actually deducted from the shared Panel Haus ink balance. Single source of truth
for "what spends ink and how much."

> Companion docs: `CLERK_CREDITS_INTEGRATION_BUILD_PLAN.md` (auth + credit wiring),
> `CREDIT_PURCHASE_INAPP_PLAN.md` (buying more ink).

---

## TL;DR

- **Every AI call charges ink.** Two prices: **image** (model-dependent) and **text** (flat).
- **Image cost follows the Settings image model:** `flash` = `INK_COST_IMAGE_FLASH` (default **1**),
  `pro` = `INK_COST_IMAGE_PRO` (default **2**).
- **Text cost is flat:** `INK_COST_TEXT` (default **1**), regardless of the image model setting.
- **The number on the button = the number actually charged.** Both come from the same env vars:
  the badge reads them via `GET /api/ink-costs`; the routes reserve them server-side.
- **BYOK** (own Gemini key in Settings) → no deduction; the badge shows **"Free"**.
- **Admins** → not deducted (handled Panel Haus–side in `reserve`), but the badge still shows the
  nominal cost (display is the same for everyone).

---

## Where ink is spent (complete map)

Each row is one client function in `src/services/geminiService.ts` → one self-contained route in
`api/` → one (or more) UI buttons that now carry an `<InkCost>` badge.

| UI action | Screen | Client fn | Route | Kind | Default cost |
|---|---|---|---|---|---|
| Generate Panels | Workshop | `generatePanelPrompts` | `generate-panels` | text | ⚡1 |
| Polish | Workshop | `polishStory` | `polish-story` | text | ⚡1 |
| Auto-Describe (analyze upload) | Workshop | `analyzeCharacterImage` | `analyze-character` | text | ⚡1 |
| Analyze Image | Vault | `analyzeCharacterImage` | `analyze-character` | text | ⚡1 |
| Generate (asset reference image) | Vault | `generateReferenceImage` → `generatePanelImage` | `generate-image` | image | ⚡1 / ⚡2 |
| Generate / GEN / REGEN (per panel) | Director | `generatePanelImage` | `generate-image` | image | ⚡1 / ⚡2 |
| Generate All | Director | `generatePanelImage` (loop) | `generate-image` | image | ⚡1 / ⚡2 **each** |
| Insert Panel | Director | `generateInsertedPanelPrompt` | `insert-panel` | text | ⚡1 |
| Bake Panel Dialogue (final render) | Editor | `finalNaturalRender` | `final-render` | image | ⚡1 / ⚡2 |
| Suggest Dialogue / Try Again | Editor | `suggestDialogue` | `suggest-dialogue` | text | ⚡1 |
| Critique This Page / All Pages | Editor | `critiqueComic` | `critique-comic` | text | ⚡1 |

**Not an AI call → no ink, no badge:**
- **Layout** (LayoutScreen) — maps grid templates locally, no Gemini call.
- **GIF export** — rendered client-side on canvas.
- **"Get Another Critique"** — only resets the panel to show the buttons again; the spend happens when
  you click Critique again.
- Meme handoff (`/c/from-meme`) — anonymous, no Clerk, no credits.

> Note: **Generate All** is the only multi-spend button, so its badge reads `⚡N/each` to signal the
> cost is multiplied by the number of panels generated.

---

## How the displayed number stays equal to the charge

There is exactly one source of truth — the `INK_COST_*` env vars — read in two places:

```
INK_COST_TEXT / INK_COST_IMAGE_FLASH / INK_COST_IMAGE_PRO   (Vercel env)
        │                                   │
        ▼                                   ▼
GET /api/ink-costs  ──► useInkCosts() ──► <InkCost>      api/<route> ──► reserveInk(amount, ...)
   (display)              (badge)            (button)        (actual charge @ Panel Haus)
```

- `api/ink-costs.ts` returns `{ text, imageFlash, imagePro }` straight from the env.
- `src/services/inkCosts.ts` (`useInkCosts`) fetches it once, caches it module-level, defaults to
  `{ text:1, imageFlash:1, imagePro:2 }` if the fetch fails.
- `src/components/InkCost.tsx` renders `⚡{n}`:
  - `kind="image"` picks `imagePro` vs `imageFlash` from the user's `panelshaq_settings.imageModel`.
  - `kind="text"` always uses `text`.
  - BYOK (`panelshaq_settings.geminiApiKey` set) → renders **"Free"**.
  - `outlined` wraps **only the ⚡ emoji** in a black text-shadow so it stays legible on orange/gradient
    buttons; the number renders normally. Used on the orange Director GEN/REGEN, Generate All, and
    Workshop Generate Panels buttons.

Because both the badge and the server read the same env vars, the displayed cost can never drift from
the charge. To change a price, change the env var — display and deduction move together.

---

## Deduction mechanics (server)

Each route is **self-contained** (Vercel can't share local files — see `CLAUDE.md`), so the credit
gate is inlined per route. Flow for a non-BYOK, Clerk-authed request:

1. `verifyClerkBearer(req)` — verify the Clerk `Authorization: Bearer` token; no/invalid token → `401`.
2. `inkAmount` = the env value for this route's kind (text routes: `INK_COST_TEXT`; image routes:
   `INK_COST_IMAGE_PRO` if `req.body.model === "pro"`, else `INK_COST_IMAGE_FLASH`).
3. `reserveInk(bearer, inkAmount, action, idempotencyKey)` → `POST {PANELHAUS_API_BASE}/api/credits/reserve`
   - `402 INSUFFICIENT_CREDITS` → return `402` (UI shows the out-of-ink upsell).
   - `429 WEEKLY_LIMIT_REACHED` → return `429`.
   - non-200 → `502`.
4. Run Gemini.
5. On Gemini failure → `refundInk(bearer, inkAmount, sameIdempotencyKey, "gemini failed")` (idempotent,
   bound to the reserve). Net charge = 0 on failure.

**BYOK short-circuit:** if `x-api-key` is present, the route skips Clerk + reserve/refund entirely and
calls Gemini with the user's key. **BYOK still honors the selected model:** `geminiModel` is derived from
`req.body.model` (`pro` → `GEMINI_IMAGE_MODEL_PRO`, else `GEMINI_IMAGE_MODEL_FLASH`) *before* the BYOK
branch, and the client always sends `model: getImageModel()` regardless of auth path. So a BYOK user on
"Pro" generates with the pro Gemini model on their own key — the only differences vs shared-ink are no
deduction and a "Free" badge.

**Admin:** the bypass lives Panel Haus–side in `reserve` (`isAdminUser` + `AI_ADMIN_RATE_LIMIT_BYPASS`),
so reserve returns success without deducting. The mobile routes don't special-case admins.

**Legacy (Clerk unconfigured):** if `CLERK_SECRET_KEY` is unset, text/image routes fall back to the old
anonymous daily limiter (`checkUsage`) — no shared credits.

---

## Free users vs upgraded users

Ink is the **shared Panel Haus balance** — identical to desktop:

- **Free tier** gets Panel Haus's free credit allotment (refreshes per Panel Haus's reset schedule).
- **Upgrading on Panel Haus** (e.g. Founder Pass / boosters) raises the same balance the mobile app reads
  and spends. There is no separate mobile economy.
- The Settings → Account panel shows the live balance + the tier label (`Free Tier`, `Founder Pass`, …)
  and links to `panelhaus.app/pricing` to get more.

---

## Settings balance loads instantly (shared cache)

The nav ink chip and the Settings Account panel both read from a shared module cache in
`src/services/credits.ts`:

- `fetchAccount(token)` fetches balance + tier from `/api/credits-balance` and writes them to
  `cachedCredits` / `cachedTier`.
- `emitBalance(n)` (fired by `apiPost` after every successful reserve) updates the cache + notifies
  subscribers, so the number stays in sync as you generate.
- The **nav chip mounts at startup**, so it primes the cache early.
- **Settings seeds its initial state from `getCachedBalance()` / `getCachedTier()`** — so when you open
  Settings the balance/tier render immediately from cache, then refresh in the background instead of
  showing a spinner each time.

---

## Env vars (recap)

| Var | Default | Effect |
|---|---|---|
| `INK_COST_TEXT` | `1` | Charge for every text/vision route. |
| `INK_COST_IMAGE_FLASH` | `1` | Charge for image routes when model = `flash`. |
| `INK_COST_IMAGE_PRO` | `2` | Charge for image routes when model = `pro`. |
| `GEMINI_IMAGE_MODEL_FLASH` | `gemini-2.5-flash-image` | Gemini model for the flash tier. |
| `GEMINI_IMAGE_MODEL_PRO` | `gemini-3.1-flash-image-preview` | Gemini model for the pro tier. |

Changing any `INK_COST_*` updates **both** the on-button badge and the actual deduction (they share the
source). No code change needed to reprice.
