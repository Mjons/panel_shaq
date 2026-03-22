# Comic Critique Corner

## Concept

A built-in AI comic critic that reviews your finished comic pages and gives constructive feedback — composition, pacing, dialogue, visual storytelling — like a mentor in your pocket. After the critique, it nudges users toward the full desktop experience for polishing.

## Where It Lives

New section in the **Editor screen** sidebar, below the export buttons and above the history section. It's a post-export feature — you compose your pages, then ask for a critique before sharing.

Alternatively, it could be its own lightweight screen accessible from the Editor via a "Critique" button, but keeping it in the sidebar keeps the flow tight.

## UX Flow

```
┌─────────────────────────────────────┐
│  COMIC CRITIQUE CORNER        [✦]   │
│                                     │
│  Get AI feedback on your comic.     │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   CRITIQUE THIS PAGE         │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │   CRITIQUE ALL PAGES         │  │
│  └───────────────────────────────┘  │
│                                     │
│  ─ ─ ─ ─ after critique ─ ─ ─ ─   │
│                                     │
│  ✦ COMPOSITION                      │
│  The wide panel at the top draws    │
│  the eye but the 3 smaller panels   │
│  below compete for attention...     │
│                                     │
│  ✦ PACING                           │
│  The action sequence moves well     │
│  but consider adding a beat panel   │
│  between panels 3 and 4...          │
│                                     │
│  ✦ DIALOGUE                         │
│  Panel 2's speech bubble overlaps   │
│  the character's face — try moving  │
│  it to the upper-left...            │
│                                     │
│  ✦ VISUAL STORYTELLING              │
│  Strong establishing shot. The      │
│  camera angle shift in panel 3      │
│  effectively builds tension...      │
│                                     │
│  ✦ OVERALL                          │
│  Score: 7/10 — Solid first draft.   │
│  The story reads clearly and the    │
│  art style is consistent...         │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Want to polish it further?   │  │
│  │                               │  │
│  │  Download your .comic file    │  │
│  │  from the Share menu and      │  │
│  │  open it in Panelhaus.app     │  │
│  │  for the full desktop         │  │
│  │  editing experience.          │  │
│  │                               │  │
│  │  [GO TO SHARE & EXPORT →]     │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## How It Works

### 1. Capture the composed page(s) — no export needed

The Editor already has a `comicRef` (a React ref attached to the live DOM element that renders the composed comic page — panels in their layout grid, speech bubbles, everything). The existing `captureRef(comicRef, "png")` function screenshots this DOM element as a base64 PNG using `html-to-image`. This is the **exact same pipeline** used by "Export PNG" and "Share This Page", but the critique flow captures it silently — no file download is triggered, no export history entry is created.

**What the AI sees:** The fully rendered comic page exactly as it would appear in a PNG export — panel images positioned in the layout grid, speech/thought/SFX bubbles with text, panel borders, spacing, everything. It's not seeing raw panel images separately; it's seeing the finished composed page as a single image, which is what matters for critiquing layout, bubble placement, and visual flow.

**Multi-page:** For "Critique All Pages", the handler loops through each page (temporarily switching `selectedPageIdx`, waiting for React to repaint, then capturing), collecting a base64 PNG per page. This is the same loop used by the "Export All Pages as PNG" flow. The captures are then sent together to the API so the AI can assess cross-page pacing and story flow.

### 2. Send to Gemini for analysis

Use the existing `analyze-character` API endpoint pattern (image + prompt → text). The endpoint already handles base64 images with text prompts via Gemini 2.0 Flash.

For multi-page critique, send all page images in a single request so the AI can assess pacing and story flow across pages.

### 3. Display the structured critique

Parse the AI response into sections (Composition, Pacing, Dialogue, Visual Storytelling, Overall) and render them in the sidebar.

## Implementation

### New Service Function — `geminiService.ts`

```typescript
export const critiqueComic = async (
  pageImages: string[], // base64 PNG of each composed page
): Promise<string> => {
  // For single page, send to analyze-character endpoint (already handles image+prompt)
  // For multi-page, we need to send multiple images

  const prompt = `You are a comic book editor giving quick, constructive feedback. Review this comic page and critique it under these exact headings. Keep each section to 1-2 SHORT sentences — be direct, specific, and get to the point. Reference panels by position ("top panel", "bottom-right"). No fluff.

COMPOSITION
Panel layout, visual hierarchy, eye flow. What works, what doesn't.

PACING
Story rhythm and transitions. Any panels redundant or missing?

DIALOGUE
Bubble placement and readability. Any text issues?

VISUAL STORYTELLING
Camera angles, expressions, mood. Does it show or just tell?

OVERALL
Score out of 10. One strength, one concrete improvement.`;

  const { text } = await apiPost<{ text: string }>("analyze-character", {
    image: pageImages[0], // primary page
    prompt,
    // For multi-page: we'd need to extend the endpoint to accept multiple images
  });
  return text;
};
```

### Multi-Page Support

The current `analyze-character` endpoint accepts a single image. For critiquing all pages at once, two options:

**Option A — New `/api/critique-comic` endpoint:**
Accepts an array of page images. Sends all as inline data parts to Gemini in a single request. This gives the best critique since the AI sees the full story.

```typescript
// api/critique-comic.ts
const parts = pageImages.map((img) => {
  const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
  return { inlineData: { mimeType: match[1], data: match[2] } };
});
parts.push({ text: critiquePrompt });

const body = {
  contents: [{ parts }],
};
```

**Option B — Sequential single-page critiques:**
Critique each page individually using the existing endpoint. Simpler but loses cross-page story flow analysis. Not recommended.

**Recommendation: Option A.** A new endpoint is cleaner and gives much better results.

### Editor Screen Changes

**State:**

```typescript
const [critiqueText, setCritiqueText] = useState<string | null>(null);
const [isCritiquing, setIsCritiquing] = useState(false);
```

**Handler:**

```typescript
const handleCritique = async (allPages: boolean) => {
  if (!comicRef.current || isCritiquing) return;
  setIsCritiquing(true);
  setSelectedPanelId(null);
  setSelectedBubbleId(null);
  await waitForPaint();

  try {
    const pagesToCapture = allPages ? pages : [pages[selectedPageIdx]];
    const originalIdx = selectedPageIdx;
    const captures: string[] = [];

    for (let i = 0; i < pagesToCapture.length; i++) {
      if (allPages) {
        setSelectedPageIdx(i);
        await waitForPaint();
      }
      captures.push(await captureRef(comicRef, "png"));
    }

    if (allPages) setSelectedPageIdx(originalIdx);

    const critique = await critiqueComic(captures);
    setCritiqueText(critique);
  } catch (err) {
    console.error("Critique failed:", err);
    setCritiqueText("Critique failed — check your API key in Settings.");
  }
  setIsCritiquing(false);
};
```

**UI — Critique section in the sidebar:**

```tsx
{
  /* Comic Critique Corner */
}
<div className="bg-surface-container rounded-lg p-6 space-y-4">
  <h3 className="font-headline text-primary text-lg font-bold flex items-center gap-2">
    <Sparkles size={18} />
    CRITIQUE CORNER
  </h3>

  {!critiqueText ? (
    <div className="space-y-2">
      <p className="text-xs text-accent/50">
        Get AI feedback on your comic's composition, pacing, and storytelling.
      </p>
      <button onClick={() => handleCritique(false)} disabled={isCritiquing}>
        {isCritiquing ? "Analyzing..." : "CRITIQUE THIS PAGE"}
      </button>
      {pages.length > 1 && (
        <button onClick={() => handleCritique(true)} disabled={isCritiquing}>
          {isCritiquing ? "Analyzing..." : "CRITIQUE ALL PAGES"}
        </button>
      )}
    </div>
  ) : (
    <div className="space-y-4">
      {/* Parse and render critique sections */}
      {critiqueText
        .split(
          /\n(?=(?:COMPOSITION|PACING|DIALOGUE|VISUAL STORYTELLING|OVERALL)\b)/i,
        )
        .filter(Boolean)
        .map((section, i) => {
          const [heading, ...body] = section.split("\n");
          return (
            <div key={i}>
              <p className="font-label text-primary uppercase tracking-widest text-[9px] font-bold mb-1">
                ✦ {heading.trim()}
              </p>
              <p className="text-xs text-accent/60 leading-relaxed">
                {body.join(" ").trim()}
              </p>
            </div>
          );
        })}

      {/* Panelhaus CTA */}
      <div className="p-4 bg-primary/5 rounded-xl border border-primary/15 space-y-2">
        <p className="text-xs text-accent/70 leading-relaxed">
          Want to polish it further? Download your <strong>.comic</strong> file
          from the Share menu and open it in <strong>panelhaus.app</strong> for
          the full desktop editing experience — layers, effects, and pro tools.
        </p>
        <button onClick={() => onNavigate?.("share")}>
          GO TO SHARE & EXPORT →
        </button>
      </div>

      {/* Re-critique button */}
      <button onClick={() => setCritiqueText(null)}>
        ↻ Get Another Critique
      </button>
    </div>
  )}
</div>;
```

## Critique Prompt Details

The prompt is designed to be:

- **Structured** — exact headings so we can parse and style the response
- **Specific** — references actual panels by position
- **Concise** — 1-2 sentences per section, no fluff
- **Actionable** — one strength, one concrete fix

### What the AI Evaluates

| Category                | What It Looks At                                                    |
| ----------------------- | ------------------------------------------------------------------- |
| **Composition**         | Panel layout, visual hierarchy, eye flow, whitespace, grid balance  |
| **Pacing**              | Story rhythm, beat panels, action flow, transitions, page turns     |
| **Dialogue**            | Bubble placement, readability, text/art overlap, conversation flow  |
| **Visual Storytelling** | Camera angles, expressions, mood, backgrounds, show-don't-tell      |
| **Overall**             | Score out of 10, strongest element, biggest improvement opportunity |

## The Panelhaus Nudge

After every critique, show a subtle CTA card:

> Want to polish it further? Download your **.comic** file from the Share menu and open it in **panelhaus.app** for the full desktop editing experience — layers, effects, and pro tools.
>
> **[GO TO SHARE & EXPORT →]**

This is not aggressive — it's contextual. The user just got feedback on things they might want to fix, and the natural next step for serious editing is the desktop app. The button navigates to the Share tab where the .comic export lives.

## Files to Create/Modify

| File                            | Change                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `api/critique-comic.ts`         | New endpoint — accepts multiple page images, sends to Gemini with critique prompt |
| `src/services/geminiService.ts` | New `critiqueComic()` function                                                    |
| `src/screens/EditorScreen.tsx`  | Critique section in sidebar with buttons, response display, and Panelhaus CTA     |

## What This Does NOT Do

- No automated fixes (it tells you what to improve, not does it for you)
- No comparison critiques ("this version vs that version")
- No style-specific feedback (manga vs western vs indie)
- No per-panel breakdown (it critiques the page as a whole)
- No persistent critique history (session-only, regenerate anytime)

## Future Enhancements

- **Style-specific mode**: "Critique this as a manga" vs "Critique this as a western comic"
- **Before/after**: Critique, make changes, re-critique to see improvement
- **Panel-level feedback**: Tap a panel to get focused feedback on just that panel
- **Peer critique**: Share your comic with other users for human feedback (requires accounts)
- **Auto-fix suggestions**: "Move bubble to here" with a visual overlay showing the suggestion
