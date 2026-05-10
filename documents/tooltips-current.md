---
created: "2026-05-10"
status: snapshot
---

# Tooltip Catalog — Current State

Snapshot of every `<Tip>` rendered in the app today, pulled from [src/screens/](src/screens/). Two modes:

- **coach** — auto-shows once, queues with a 30 s cooldown, dismissed via "Got it", remembered in `localStorage`.
- **help** — persistent `?` button, opens on tap, dismissed by tapping outside.

Component source: [src/components/Tip.tsx](src/components/Tip.tsx).

Total: **17 tips** — 10 coach, 7 help.

---

## Workshop screen — [src/screens/WorkshopScreen.tsx](src/screens/WorkshopScreen.tsx)

| ID              | Mode  | Text                                                                                                                                                                                                                           |
| --------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `smudge-intro`  | coach | Hey, I'm Smudge — the sponge. I'll pop up with tips as you go. First things first: don't forget to give your project a title up top!\n\nTap 'Got it' to dismiss me. You can turn tips off anytime in Settings.                 |
| `style-ref`     | coach | Tap the orange ⊕ to create a new character blueprint. The more detail you add (name, look, personality), the more consistent your character will stay across every panel. _(rendered as JSX with an inline `PlusCircle` icon)_ |
| `cast-tags`     | help  | Tap a name to insert it into your story at the cursor.                                                                                                                                                                         |
| `polish`        | coach | Optional — Polish runs your draft through AI to add cinematic flair (mood, sensory detail, pacing) while keeping your characters and intent. Your original text gets replaced, so save a copy if you love it.                  |
| `auto-describe` | help  | Analyzes the uploaded image to write a visual description for you.                                                                                                                                                             |

---

## Director screen — [src/screens/DirectorScreen.tsx](src/screens/DirectorScreen.tsx)

| ID               | Mode  | Text                                                                                                                                                                        |
| ---------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aspect-ratio`   | coach | Pick the panel's shape — Tall (9:16) for vertical drama, Square (1:1) for balance, Wide (16:9) for cinematic moments. Shape changes the whole feel of the shot.             |
| `camera-lens`    | coach | Pick the lens like a real photographer would — Portrait 85mm for tight close-ups with creamy backgrounds, Fish-eye for chaotic drama, Wide for sweeping establishing shots. |
| `ref-limit`      | help  | Max 5 references per panel. Deselect one to add more.                                                                                                                       |
| `collapsed-refs` | help  | Tap to see your backgrounds, props, and vehicles from the Vault.                                                                                                            |
| `insert-panel`   | help  | Add new panels between existing ones to expand your story.                                                                                                                  |

---

## Layout screen — [src/screens/LayoutScreen.tsx](src/screens/LayoutScreen.tsx)

| ID              | Mode  | Text                                                                                                                                                                                         |
| --------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format-toggle` | coach | Comic mode lays panels out as traditional grid pages — perfect for print or static reading. Webtoon mode flows everything into a single vertical strip — built for endless mobile scrolling. |

---

## Editor screen — [src/screens/EditorScreen.tsx](src/screens/EditorScreen.tsx)

| ID                 | Mode  | Text                                                                                                                                                                                         |
| ------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editor-gestures`  | coach | On any panel: drag to reposition, pinch to zoom, two-finger tap to rotate by your step size, double-tap to open it fullscreen for fine detail work.                                          |
| `panel-lock`       | coach | Lock a panel to freeze its position and zoom — handy when you've got it framed just right and don't want to bump it. Bubbles on top still move freely.                                       |
| `suggest-dialogue` | coach | Press this and I'll review your laid-out comic, then suggest dialogue, thoughts and SFX for each panel. Tap Apply on any line to drop it in as a bubble — then bake it right into the image. |
| `bake-btn`         | coach | Once you're happy with your bubbles, hit Bake to fuse them permanently into the panel image. Download a clean copy first if you want to keep the bubble-free version.                        |
| `ai-critique`      | help  | Get AI feedback on your page's pacing, composition, and dialogue.                                                                                                                            |

---

## Vault screen — [src/screens/VaultScreen.tsx](src/screens/VaultScreen.tsx)

| ID                    | Mode | Text                                                                                   |
| --------------------- | ---- | -------------------------------------------------------------------------------------- |
| `vault-generate`      | help | AI creates a reference image from your name and description.                           |
| `personality-vs-desc` | help | Description = how they look. Personality = how they act (optional, for story context). |

---

## Settings notes

Tips can be globally turned off via the `panelshaq_tips_disabled` flag, and individually re-shown by clearing `panelshaq_tips_seen` (`resetAllTips()` in [Tip.tsx:25](src/components/Tip.tsx#L25)). Settings UI for both lives in [src/screens/SettingsScreen.tsx](src/screens/SettingsScreen.tsx).

## What's NOT included here

- Native `title=` / `aria-label=` attributes (browser tooltips, accessibility labels) — those exist throughout the codebase but aren't rendered as Smudge coach/help cards.
- Toast notifications, bottom-sheet help text, and onboarding modals — different patterns, not part of the `<Tip>` system.
