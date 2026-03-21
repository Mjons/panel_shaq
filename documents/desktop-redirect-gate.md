# Desktop Redirect Gate

## Problem

Panel Shaq (`panelhaus.app`) is a mobile-first PWA. Desktop visitors get a functional but suboptimal experience — the UI is designed for touch, portrait viewports, and on-the-go comic creation. Meanwhile, Panel Haus Desktop is the full-featured desktop editing tool. When someone visits `panelhaus.app` from a desktop browser, we should guide them toward the right tool.

## Solution

Show a full-screen interstitial gate when a desktop user-agent is detected. The gate:

1. Explains the difference between the mobile app and the desktop app
2. Links them to `panelhaus.app` (the desktop app / marketing site)
3. Gives them a countdown timer to auto-redirect, with an option to stay on the mobile version

## Design

### Gate Screen

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                        PANELHAUS                                │
│                                                                 │
│              ─────────────────────────────                      │
│                                                                 │
│           Looks like you're on a desktop.                       │
│                                                                 │
│   panelhaus.app is our mobile-first comic creator —             │
│   built for phones and tablets. Quick stories,                  │
│   AI-generated panels, tap-and-go editing.                      │
│                                                                 │
│   For the full desktop experience with advanced                 │
│   layout tools, layer editing, and export options:              │
│                                                                 │
│          ┌─────────────────────────────────┐                    │
│          │   OPEN PANEL HAUS DESKTOP  →    │                    │
│          │       panelhaus.app             │                    │
│          └─────────────────────────────────┘                    │
│                                                                 │
│       Redirecting in 10... 9... 8...                            │
│                                                                 │
│       ┌───────────────────────────────────┐                     │
│       │   Stay on mobile version anyway   │                     │
│       └───────────────────────────────────┘                     │
│                                                                 │
│   ─────────────────────────────────────────                     │
│                                                                 │
│   MOBILE APP                  DESKTOP APP                       │
│   panelhaus.app               panelhaus.app                     │
│   ✦ AI story generation       ✦ Full layer editor               │
│   ✦ Quick panel creation      ✦ Advanced layout tools           │
│   ✦ Touch-friendly editing    ✦ High-res export                 │
│   ✦ Speech bubbles & text     ✦ Import .panelhaus packages      │
│   ✦ On-the-go workflows       ✦ Professional finishing          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Behavior

- **Detection:** Check `navigator.userAgent` and `window.innerWidth`. Show gate if width ≥ 1024px and no touch capability (`!navigator.maxTouchPoints`). This avoids false positives on tablets with keyboards.
- **Countdown:** Starts at 10 seconds, counts down visually. At 0, redirects to `https://panelhaus.app`.
- **"Stay on mobile version":** Cancels the countdown, dismisses the gate, stores `panelshaq_desktop_gate_dismissed` in localStorage so it doesn't show again this session.
- **"Open Panel Haus Desktop" button:** Immediately navigates to `https://panelhaus.app`.
- **Don't show if:** User has previously dismissed (`localStorage` flag exists), or if the user arrived via a direct deep link to a shared comic (check for route params like `/share/` or `/view/`).
- **Style:** Full-screen overlay, `bg-surface/95` backdrop, centered content. Uses the same design tokens as the rest of the app. Subtle fade-in animation.

### Countdown Display

The countdown should feel unhurried, not aggressive:

```
Redirecting to the desktop app in 10 seconds...
```

The number ticks down once per second. A subtle progress bar or circular timer could accompany it. The tone is informational, not pushy — the user should feel like they're being helped, not blocked.

## Implementation

### Where to add it

In `src/App.tsx`, render the gate as a conditional overlay above the main app content. The app still loads behind it — if they click "stay", there's no loading delay.

### Detection Hook

```tsx
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const wide = window.innerWidth >= 1024;
    const noTouch = !navigator.maxTouchPoints;
    setIsDesktop(wide && noTouch);
  }, []);

  return isDesktop;
};
```

### Gate Component

```tsx
const DesktopRedirectGate = ({ onStay }: { onStay: () => void }) => {
  const [seconds, setSeconds] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          window.location.href = "https://panelhaus.app";
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleStay = () => {
    localStorage.setItem("panelshaq_desktop_gate_dismissed", "1");
    onStay();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-surface/95 flex items-center justify-center animate-fade-in">
      <div className="max-w-lg mx-auto px-8 text-center">
        <h1 className="font-display text-3xl text-accent mb-2">PANELHAUS</h1>
        <div className="w-16 h-px bg-primary/40 mx-auto mb-8" />

        <p className="text-accent/80 text-lg mb-2">
          Looks like you're on a desktop.
        </p>
        <p className="text-accent/50 text-sm leading-relaxed mb-8">
          panelhaus.app is our mobile-first comic creator — built for phones and
          tablets. For the full desktop experience with advanced layout tools,
          layer editing, and export options:
        </p>

        <a
          href="https://panelhaus.app"
          className="inline-block w-full py-4 bg-primary text-surface font-label uppercase tracking-[0.15em] text-sm rounded-xl mb-4 hover:bg-primary/90 transition-colors"
        >
          Open Panel Haus Desktop →
          <span className="block text-xs opacity-60 mt-1 normal-case tracking-normal">
            panelhaus.app
          </span>
        </a>

        <p className="text-accent/30 text-xs mb-6">
          Redirecting in {seconds} second{seconds !== 1 ? "s" : ""}...
        </p>

        <button
          onClick={handleStay}
          className="text-accent/40 hover:text-accent/70 text-sm underline underline-offset-4 transition-colors"
        >
          Stay on the mobile version anyway
        </button>

        <div className="mt-12 grid grid-cols-2 gap-8 text-left text-xs text-accent/40">
          <div>
            <p className="font-label uppercase tracking-[0.15em] text-accent/60 mb-2">
              Mobile App
            </p>
            <ul className="space-y-1">
              <li>✦ AI story generation</li>
              <li>✦ Quick panel creation</li>
              <li>✦ Touch-friendly editing</li>
              <li>✦ Speech bubbles & text</li>
              <li>✦ On-the-go workflows</li>
            </ul>
          </div>
          <div>
            <p className="font-label uppercase tracking-[0.15em] text-accent/60 mb-2">
              Desktop App
            </p>
            <ul className="space-y-1">
              <li>✦ Full layer editor</li>
              <li>✦ Advanced layout tools</li>
              <li>✦ High-res export</li>
              <li>✦ Import .panelhaus packages</li>
              <li>✦ Professional finishing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### Integration in App.tsx

```tsx
const App = () => {
  const isDesktop = useIsDesktop();
  const [gateOpen, setGateOpen] = useState(
    () => !localStorage.getItem("panelshaq_desktop_gate_dismissed"),
  );

  return (
    <>
      {isDesktop && gateOpen && (
        <DesktopRedirectGate onStay={() => setGateOpen(false)} />
      )}
      {/* ...existing app content... */}
    </>
  );
};
```

## What This Does NOT Do

- Does not block mobile or tablet users in any way
- Does not prevent desktop users from using the app — they can always click "stay"
- Does not persist the redirect preference across devices (localStorage only)
- Does not change any routing or app structure
- Does not affect shared/embedded comic links (deep links bypass the gate)

## Edge Cases

| Scenario                                   | Behavior                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| Tablet with keyboard attached              | `maxTouchPoints > 0` → no gate shown                                         |
| Desktop with touchscreen                   | `maxTouchPoints > 0` → no gate shown (these users likely want the mobile UX) |
| Narrow desktop window (< 1024px)           | No gate shown — they're already in a mobile-like viewport                    |
| User resizes window after load             | Gate only checks on mount — no jarring mid-session popups                    |
| User clears localStorage                   | Gate will show again next visit                                              |
| Direct link to `/share/...` or `/view/...` | Gate skipped — they're here for specific content                             |

## Future Considerations

- **Smart detection:** If the user has Panel Haus Desktop installed locally, detect the WebSocket server on `ws://127.0.0.1:9876` and offer a "Open in Desktop App" deep link instead of just sending them to the website.
- **QR code:** Show a QR code on the gate so desktop visitors can quickly open `panelhaus.app` on their phone instead.
- **Analytics:** Track how many desktop visitors stay vs. redirect to understand if this gate is helpful or annoying.
