---
created: "2026-06-09"
status: exploration
---

# Pausing coach-tip timers while a menu is open

## The ask

When a user has a menu open (a bottom sheet, the Help sheet, the Project
Manager, the Vault entry editor), a Smudge **coach tip** can pop up on top of
it. We want to **pause the tip timer** while a menu is open, and resume it once
the menu closes — so tips never interrupt or render over an open menu.

**Short answer: yes, this is very doable.** The tip scheduler is already a
single module-global queue, so we only need (a) a pause/resume switch on that
queue and (b) a way for menus to flip it. The wiring is small. The main design
decisions are _what counts as "a menu"_ and _what to do with a tip that is
already on screen_ when a menu opens.

---

## How the timer works today

All coach-tip scheduling lives in module-level state in
[src/components/Tip.tsx](src/components/Tip.tsx#L30-L93):

- `queue` — coach tips waiting to show, one registered per mounted `<Tip mode="coach">`.
- `currentlyShowing` — id of the tip on screen, or `null`.
- `cooldownTimer` — the `setTimeout` handle that fires `showNext()`.
- `COOLDOWN_MS = 30_000`, `FIRST_TIP_DELAY_MS = 8_000`.

Flow:

1. A `<Tip mode="coach">` mounts → `registerCoachTip()` pushes to `queue` and calls `tryShowNext()` ([Tip.tsx:65](src/components/Tip.tsx#L65)).
2. `tryShowNext()` ([Tip.tsx:47](src/components/Tip.tsx#L47)) computes the wait (8s first-ever, else `30s − elapsed`) and schedules `cooldownTimer = setTimeout(showNext, wait)`.
3. `showNext()` ([Tip.tsx:39](src/components/Tip.tsx#L39)) shifts the next tip off the queue and calls its `show()` (which `setVisible(true)`).
4. Dismiss ("Got it") → `markCoachTipDismissed()` records `lastShownAt` and schedules the next tip after another cooldown.

So there is exactly **one timer** to gate, and it lives in one place. That is the
lucky part.

---

## What's missing: a global "a menu is open" signal

Menus today are all **local component state**, with no shared notion of "open":

| Menu                 | Owner                                                                  | Open state             |
| -------------------- | ---------------------------------------------------------------------- | ---------------------- |
| Generic bottom sheet | [BottomSheet.tsx](src/components/BottomSheet.tsx)                      | `isOpen` prop          |
| Help & About         | [Navigation.tsx:200](src/components/Navigation.tsx#L200) → `HelpSheet` | `showHelp`             |
| Project Manager      | [App.tsx:655](src/App.tsx#L655)                                        | `isProjectManagerOpen` |
| Vault entry editor   | [VaultScreen.tsx:541](src/screens/VaultScreen.tsx#L541)                | `isModalOpen`          |

There is no `useContext`/global flag that says "something modal is up." We need
to introduce one — or, more cheaply, have each menu poke the tip module directly
on open/close.

---

## The z-index gotcha (why pausing the timer isn't the whole story)

Coach cards render through a **portal to `document.body` at `z-[9999]`**
([Tip.tsx:309](src/components/Tip.tsx#L309), [Tip.tsx:357](src/components/Tip.tsx#L357)).
Menu overlays sit far lower — the bottom sheet scrim is `z-[80]` and the panel
`z-[90]` ([BottomSheet.tsx:37](src/components/BottomSheet.tsx#L37),
[BottomSheet.tsx:44](src/components/BottomSheet.tsx#L44)).

Consequence: **a tip that is already visible will float on top of an open
menu.** Pausing the _timer_ only prevents _new_ tips from appearing. So "pause
the timer when a menu is open" has two sub-cases:

1. **No tip showing yet** — pausing the timer is sufficient. ✅ (the common case)
2. **A tip is already showing when the menu opens** — the timer is irrelevant;
   the card is already mounted at z-9999. We must decide: leave it (it overlaps
   the menu), or hide-and-requeue it.

The user's phrasing ("pause the timer") targets case 1, which is also the
frequent one (tips fire on a 30s cadence; the odds a tip is mid-display exactly
when a menu opens are low). But the doc should call this out so we choose
deliberately.

---

## Proposed design

### 1. Add a pause switch to the tip module

In [Tip.tsx](src/components/Tip.tsx), add a ref-counted suppression flag next to
the existing queue state. Ref-counting (not a boolean) matters because menus can
stack/overlap and we must only resume when the **last** one closes.

```ts
let suppressDepth = 0;

export function pauseCoachTips() {
  suppressDepth++;
  // Freeze the pending timer so it can't fire while a menu is up.
  if (cooldownTimer) {
    clearTimeout(cooldownTimer);
    cooldownTimer = null;
  }
}

export function resumeCoachTips() {
  suppressDepth = Math.max(0, suppressDepth - 1);
  if (suppressDepth === 0) tryShowNext(); // re-arm from where we left off
}
```

Then gate the scheduler — one line at the top of `tryShowNext()`
([Tip.tsx:47](src/components/Tip.tsx#L47)):

```ts
function tryShowNext() {
  if (suppressDepth > 0) return; // ← new
  if (currentlyShowing) return;
  // ...unchanged
}
```

Because `lastShownAt` is only stamped on dismiss, clearing the timer on pause and
re-running `tryShowNext()` on resume naturally recomputes the remaining wait — the
cooldown effectively _pauses_ rather than _resets_, which is the desired
behavior. (Worth a sanity check during implementation: confirm a tip mid-wait
resumes with roughly its remaining time, not a fresh 30s.)

### 2. Have menus flip the switch

Cleanest single chokepoint: **`BottomSheet`** — most menus already use it. Add an
effect:

```ts
useEffect(() => {
  if (!isOpen) return;
  pauseCoachTips();
  return () => resumeCoachTips();
}, [isOpen]);
```

That one effect covers every `BottomSheet` consumer. Menus that **don't** go
through `BottomSheet` (e.g. `HelpSheet`, `ProjectManager` if they render their
own overlay) need the same 4-line effect keyed on their own open flag. Audit:
grep for the overlay components and add the effect to each, or — better — route
them through `BottomSheet` so there's a single source of truth.

### 3. (Optional) Handle the already-showing case

If we also want case 2, give `pauseCoachTips()` the ability to retract a live
tip: when `currentlyShowing` is set, call the showing `<Tip>`'s `setVisible(false)`
and push its id back onto the front of the `queue` (without `markSeen`), then let
resume re-show it. This needs the registry to keep a `hide()` handle per tip
alongside `show()`. More moving parts — recommend deferring unless overlap is
observed in practice.

---

## Effort & risk

- **Scope:** ~15 lines in [Tip.tsx](src/components/Tip.tsx) + a 4-line effect per
  menu surface (one if everything funnels through `BottomSheet`).
- **Risk:** low. The change is additive and gated behind `suppressDepth`; when no
  menu is open, behavior is byte-for-byte identical to today. The one thing to
  verify is the ref-count balance (every `pause` has exactly one `resume`, even on
  unmount-while-open) — the effect-cleanup pattern above guarantees it.
- **Type-check only:** `npm run lint` (`tsc --noEmit`) is the gate; there are no
  tests.

## Open questions

1. **Scope of "menu":** just bottom sheets, or also transient popovers/dropdowns
   inside the Director/Editor screens? Anything with a backdrop should probably
   count.
2. **Already-showing tip:** leave it overlapping, or retract+requeue (case 2
   above)? Recommend: leave it for v1, revisit if it looks bad.
3. **Toasts/other overlays:** out of scope here — they're a separate system and
   don't use the `<Tip>` queue.
