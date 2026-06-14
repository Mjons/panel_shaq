import {
  SignedIn,
  SignedOut,
  SignInButton,
  useAuth,
  useUser,
  useClerk,
} from "@clerk/clerk-react";
import { User, LogOut, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { onBalanceChange, fetchBalance } from "../services/credits";

// Live ink-balance chip. Fetches once when signed in, then updates instantly when
// a generation pushes a new balance (apiPost -> emitBalance). Shows a loading
// placeholder while the first fetch is in flight so the chip never pops in/out.
function InkChip() {
  const { getToken, isSignedIn } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let alive = true;
    getToken().then((t) => {
      if (t && alive)
        fetchBalance(t).then((c) => {
          if (alive && c !== null) setCredits(c);
        });
    });
    const off = onBalanceChange((c) => {
      if (alive) setCredits(c);
    });
    return () => {
      alive = false;
      off();
    };
  }, [isSignedIn, getToken]);

  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent/80 px-2.5 py-1 rounded-lg bg-surface-container border border-outline/10"
      title="Ink balance"
      aria-label={credits === null ? "Loading ink balance" : `${credits} ink`}
    >
      <span aria-hidden>⚡</span>
      {credits === null ? (
        <span
          className="inline-block w-5 h-3.5 rounded bg-accent/20 animate-pulse"
          aria-hidden
        />
      ) : (
        <span>{credits}</span>
      )}
    </span>
  );
}

function truncateWallet(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

// Custom account menu — a plain user icon (not Clerk's default avatar) that opens
// a small dropdown showing the identity you signed in with (email OR wallet
// address) and a Sign out action.
function AccountMenu({ onSettings }: { onSettings: () => void }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const email = user?.primaryEmailAddress?.emailAddress;
  const wallet = user?.web3Wallets?.[0]?.web3Wallet;
  const isWallet = !email && !!wallet;
  const identity = email || (wallet ? truncateWallet(wallet) : "Account");

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container border border-outline/20 text-accent/70 hover:text-primary hover:border-primary/40 active:scale-90 transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <User size={18} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-xl bg-surface-container border border-outline/20 shadow-2xl overflow-hidden z-[80]"
        >
          <div className="px-4 py-3 border-b border-outline/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent/40">
              {isWallet ? "Wallet" : email ? "Signed in" : "Account"}
            </p>
            <p
              className={`text-sm text-accent/90 break-all mt-0.5 ${
                isWallet ? "font-mono" : ""
              }`}
            >
              {identity}
            </p>
          </div>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSettings();
            }}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-accent/80 hover:bg-surface-container-high hover:text-primary transition-colors text-left border-b border-outline/10"
          >
            <Settings size={16} />
            Settings
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut({ redirectUrl: "/" });
            }}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-accent/80 hover:bg-surface-container-high hover:text-primary transition-colors text-left"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// Top-nav account cluster. Only rendered when Clerk is enabled (a publishable key
// is set) — so it always runs inside <ClerkProvider>. Signed out → a "Sign in"
// button that opens Clerk's modal (Google / Email / MetaMask, ordered in the
// Clerk dashboard). Signed in → ink chip + the custom account menu.
export function AccountControls({ onSettings }: { onSettings: () => void }) {
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button
            className="text-sm font-semibold text-primary hover:opacity-80 active:scale-90 transition px-3 py-1.5 rounded-lg border border-primary/40"
            aria-label="Sign in"
          >
            Sign in
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <InkChip />
        <AccountMenu onSettings={onSettings} />
      </SignedIn>
    </>
  );
}
