# Panel Shaq — Monetization & API Key Model Deep Dive

**Date:** 2026-03-20
**Context:** Currently the Gemini API key is set as a Vercel env var, meaning YOU pay for every user's AI generations. This doesn't scale.

---

## The Core Problem

Right now:

- Your Gemini API key is in Vercel env vars
- Every user's image generation, story polish, and panel breakdown costs you money
- No authentication — anyone with the URL can generate unlimited content
- No rate limiting — a bot could burn through your quota in minutes
- No way to track usage per user

**You're subsidizing every user's AI usage.** This needs to change before you share the link widely.

---

## Three Models to Consider

### Model A: BYOK (Bring Your Own Key)

**Users provide their own Gemini API key**

How it works:

- Remove the serverless proxy entirely (or make it optional)
- User enters their Gemini API key in Settings
- Key is stored in localStorage (or sessionStorage for better security)
- Client calls Gemini directly from the browser
- You pay nothing for AI usage

Pros:

- Zero cost to you
- Simple to implement (revert to the original direct-call geminiService)
- Users control their own spending
- No backend needed

Cons:

- Friction: users need a Google Cloud account + billing enabled + API key
- Most casual users won't do this — kills adoption
- API key in the browser is visible in DevTools (user's own key, their risk)
- Can't offer a free tier or trial

Best for: **Developer/power-user audience, early beta**

Implementation effort: **Half day** (revert geminiService to direct calls, keep the Settings API key field)

---

### Model B: Freemium with Credits

**Free tier with limited generations, paid plans for more**

How it works:

- Users sign up (Google OAuth — natural fit since you use Gemini)
- Free tier: 10 panel generations/month, 2 story polishes/day
- Pro tier ($5-10/month): 100 generations/month, unlimited polish, priority queue
- Unlimited tier ($20/month): unlimited everything, higher resolution, batch export
- Your serverless proxy tracks usage per user and enforces limits

Revenue math (rough):

- Gemini Flash image gen costs ~$0.01-0.03 per image
- 100 images/month = $1-3 cost per Pro user
- At $8/month Pro, that's $5-7 profit per paying user
- 1000 free users + 50 Pro users = ~$250-400/month revenue

Requires:

- User authentication (Firebase Auth or Supabase)
- Database for user accounts + usage tracking (Supabase, PlanetScale, or Vercel KV)
- Stripe integration for payments
- Usage metering middleware in API routes
- User dashboard showing remaining credits

Pros:

- Recurring revenue
- Free tier drives adoption
- You control the experience end-to-end
- Can offer premium features (higher res, more styles, priority queue)

Cons:

- Significant development effort (auth, payments, usage tracking)
- You're on the hook for uptime and API costs
- Need to handle billing edge cases (failed payments, refunds)
- Ongoing operational cost

Best for: **Consumer product with growth ambitions**

Implementation effort: **2-3 weeks**

---

### Model C: Hybrid (BYOK + Hosted)

**Free with your own key, OR pay us to use ours**

How it works:

- Default: user enters their own Gemini API key (BYOK) — free, unlimited
- Optional: users without a key can buy credit packs from you
  - $3 for 50 generations (one-time, no subscription)
  - $8 for 200 generations
  - $15 for 500 generations
- Credit packs use YOUR API key through the serverless proxy
- BYOK users bypass the proxy entirely

Pros:

- Low friction for power users (BYOK)
- Revenue from casual users who don't want to set up Google Cloud
- No subscription fatigue — pay-as-you-go
- Simpler than full freemium (no monthly billing cycles)
- You only pay API costs for paying users

Cons:

- Still need auth + payment processing for credit packs
- Two code paths (BYOK vs proxy) to maintain
- Harder to market than a simple free/paid split

Best for: **Best of both worlds — serves developers AND casual users**

Implementation effort: **1-2 weeks**

---

## Recommendation

### Start with Model A (BYOK), migrate to Model C (Hybrid)

**Phase 1 (now):** BYOK only

- Revert to client-side Gemini calls
- Keep the Settings API key field (it's useful now)
- Add a clear onboarding flow: "To use Panel Shaq, you need a Gemini API key"
- Link to a guide: "How to get your free Gemini API key" (Google gives free tier credits)
- Remove your API key from Vercel env vars — stop paying
- This unblocks sharing the app immediately with zero cost to you

**Phase 2 (when you have users):** Add Hybrid credit packs

- Add Google OAuth (Firebase Auth — free tier covers thousands of users)
- Add Stripe for one-time credit pack purchases
- Users without a BYOK key see "Buy 50 generations for $3" instead of the API key prompt
- Track usage per user in Vercel KV or Supabase

**Phase 3 (when you have paying users):** Full Freemium

- Convert credit packs to subscription tiers
- Add premium features (higher res export, more art styles, collaboration)
- Add usage analytics dashboard

---

## Phase 1 Implementation Plan (BYOK)

### What to change:

**1. Revert geminiService to direct Gemini calls**

- The serverless proxy (`api/*.ts`) becomes optional
- `geminiService.ts` reads the API key from Settings (localStorage)
- If no key is set, show the onboarding prompt

**2. Update Settings screen**

- Keep the API key field (it's the primary way to use the app now)
- Add "How to get a key" link
- Add "Test Connection" that pings Gemini directly
- Show usage warning: "Your key, your costs. Google offers a free tier."

**3. Add API key onboarding gate**

- On first visit (no key set), show a full-screen onboarding:

  ```
  Welcome to Panel Shaq!

  To create AI-powered comics, you'll need a Gemini API key.

  [How to get your free key →]
  [I already have a key → Enter it]
  ```

- Link to: https://aistudio.google.com/apikey
- Google gives free Gemini API credits — emphasize this

**4. Remove your Vercel API key**

- Delete `GEMINI_API_KEY` from Vercel environment variables
- Keep the `api/` routes in the codebase but don't require them
- They'll be useful again in Phase 2

**5. Add key validation**

- When user enters a key, test it immediately with a lightweight call
- Show green checkmark or red X
- Store in localStorage (acceptable since it's the user's own key)

### Files to change:

- `src/services/geminiService.ts` — add fallback to direct calls when no proxy available
- `src/screens/SettingsScreen.tsx` — improve the key entry UX
- `src/App.tsx` — add onboarding gate when no key is configured
- `src/components/OnboardingScreen.tsx` — new file, API key setup flow

### Estimated effort: Half day

---

## Pricing Research (if you go Freemium later)

### Comparable products:

| Product     | Free Tier           | Paid Tier       | Model                  |
| ----------- | ------------------- | --------------- | ---------------------- |
| Canva       | Limited AI features | $13/month Pro   | Subscription           |
| Midjourney  | None (was 25 free)  | $10/month Basic | Subscription           |
| Leonardo.ai | 150 tokens/day      | $12/month       | Subscription + credits |
| Pixton      | 6 comics            | $8/month        | Subscription           |
| Comic Life  | Free trial          | $30 one-time    | One-time purchase      |

### Suggested pricing (Phase 2+):

| Tier             | Price        | Includes                                 |
| ---------------- | ------------ | ---------------------------------------- |
| **Free (BYOK)**  | $0           | Unlimited with your own key              |
| **Starter Pack** | $3 one-time  | 50 AI generations                        |
| **Creator Pack** | $8 one-time  | 200 AI generations                       |
| **Studio Pack**  | $15 one-time | 500 AI generations                       |
| **Pro (later)**  | $8/month     | 200 generations/month + premium features |

---

## Cost Estimation

### Your costs per operation (Gemini API pricing):

| Operation        | Model              | Approx Cost |
| ---------------- | ------------------ | ----------- |
| Story Polish     | Gemini Pro (text)  | ~$0.001     |
| Panel Breakdown  | Gemini Pro (text)  | ~$0.002     |
| Image Generation | Gemini Flash Image | ~$0.01-0.03 |
| Final Render     | Gemini Flash Image | ~$0.01-0.03 |

### Per-comic cost (6 panels):

- 1 story polish: $0.001
- 1 panel breakdown: $0.002
- 6 image generations: $0.06-0.18
- 2 final renders: $0.02-0.06
- **Total: ~$0.08-0.25 per comic**

### At scale:

- 100 free users making 5 comics/month each = $40-125/month (if you subsidize)
- 100 BYOK users = $0/month to you
- 50 users buying $8 credit packs/month = $400/month revenue, ~$50-125 API cost

---

## Decision Matrix

| Factor            | BYOK       | Freemium  | Hybrid                |
| ----------------- | ---------- | --------- | --------------------- |
| Cost to you       | $0         | $$$       | $ (only paying users) |
| User friction     | High       | Low       | Medium                |
| Revenue potential | None       | High      | Medium                |
| Dev effort        | Low        | High      | Medium                |
| Time to launch    | Now        | 2-3 weeks | 1-2 weeks             |
| Best audience     | Developers | Everyone  | Mixed                 |

**Bottom line:** BYOK gets you to market immediately at zero cost. Add credit packs when you have users who ask for it. Don't build a payment system until you have demand.
