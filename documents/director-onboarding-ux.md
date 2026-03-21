# Director Screen Onboarding UX

## Problem

When users land on the Panel Director with generated panels, there's no context about what this screen is for or what they should do. They see a grid of panel cards with generate buttons but no guidance on the workflow.

Key confusions:

- Users might think they need to finalize layouts here (they don't — that's the Layout screen)
- Users might not understand they can edit descriptions, reorder, insert, or remove panels before generating images
- The relationship between "planning panels" and "generating images" isn't clear
- New users don't know the overall flow: Workshop → Director → Layout → Editor

## Solution

Add a contextual instruction banner at the top of the Director screen when panels exist. It should be:

- Brief and scannable — not a wall of text
- Dismissible — experienced users shouldn't be nagged
- Workflow-aware — make it clear where they are in the process

## Design

### Instruction Banner

Appears between the header and the panel grid, only when panels exist.

```
┌─────────────────────────────────────────────────────────────┐
│  ✦ STEP 2 OF 4 — PLAN YOUR PANELS                    [✕]  │
│                                                             │
│  This is your storyboard. Review and tweak each panel's     │
│  description, then generate images when you're happy.       │
│  Don't worry about page layout yet — that's the next step.  │
│                                                             │
│  You can:                                                   │
│  • Edit any panel's description, camera angle, or mood      │
│  • Insert new panels between existing ones                  │
│  • Generate images one at a time or all at once             │
│  • Regenerate any image you're not satisfied with           │
│                                                             │
│  When you're ready → CONTINUE TO LAYOUTS                    │
└─────────────────────────────────────────────────────────────┘
```

### Behavior

- **Show when:** `panels.length > 0` and user has NOT dismissed it
- **Dismiss:** Click the X. Store `panelshaq_director_onboarding_dismissed` in localStorage
- **Don't show:** If already dismissed OR if panels already have images (returning user who knows the flow)
- **Style:** Subtle — uses `bg-surface-container/50` with a left border accent, not a loud alert

### Step Indicator

The "Step 2 of 4" label reinforces the full flow:

1. **Workshop** — Write your story, set up characters
2. **Director** — Plan and generate panel images ← you are here
3. **Layout** — Arrange panels into pages
4. **Editor** — Add speech bubbles and final touches

This step indicator could eventually appear on all screens as a breadcrumb, but for now just show it here where the confusion is worst.

## Implementation

### Where to add it

In `src/screens/DirectorScreen.tsx`, between the header section (line ~1194) and the panel grid (line ~1260).

### Component

```tsx
const DirectorOnboarding = ({ onDismiss }: { onDismiss: () => void }) => (
  <div className="mb-8 p-5 bg-surface-container/50 border-l-4 border-primary/60 rounded-r-xl relative">
    <button
      onClick={onDismiss}
      className="absolute top-3 right-3 text-accent/30 hover:text-accent/60 transition-colors"
    >
      <X size={16} />
    </button>
    <p className="font-label text-primary uppercase tracking-[0.2em] text-[10px] font-bold mb-2">
      Step 2 of 4 — Plan Your Panels
    </p>
    <p className="text-accent/70 text-sm leading-relaxed mb-3">
      This is your storyboard. Review and tweak each panel's description, then
      generate images when you're happy with the plan.
      <span className="text-accent/50"> Page layout comes next.</span>
    </p>
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-accent/40">
      <span>• Edit descriptions & camera settings</span>
      <span>• Insert or remove panels</span>
      <span>• Generate one-by-one or all at once</span>
      <span>• Regenerate any image</span>
    </div>
  </div>
);
```

### State

```tsx
const [showOnboarding, setShowOnboarding] = useState(() => {
  return !localStorage.getItem("panelshaq_director_onboarding_dismissed");
});

const dismissOnboarding = () => {
  setShowOnboarding(false);
  localStorage.setItem("panelshaq_director_onboarding_dismissed", "1");
};
```

### Show condition

```tsx
{
  panels.length > 0 && showOnboarding && !panels.some((p) => p.image) && (
    <DirectorOnboarding onDismiss={dismissOnboarding} />
  );
}
```

The `!panels.some(p => p.image)` check means: if a user already has generated images, they clearly know what they're doing — don't show the banner.

## What This Does NOT Do

- No changes to the panel cards themselves
- No tooltips or interactive tutorials
- No changes to other screens (Workshop, Layout, Editor)
- No persistent onboarding state beyond a single localStorage flag

## Future Consideration

If this pattern works well, similar lightweight banners could be added to Layout ("Arrange your panels into comic pages") and Editor ("Add speech bubbles and finishing touches"). But start with Director only — it's the screen where users are most lost.
