import { useState } from "react";
import { Wallet, Check, Loader2, AlertTriangle } from "lucide-react";
import { BottomSheet } from "../BottomSheet";
import { attachMintWallet } from "../../services/creatorCard";
import { track } from "../../services/analytics";

/**
 * The mint-wallet sheet — paste, review, confirm, receipt.
 *
 * WHY THREE STEPS FOR ONE FIELD. The address is where an unrecoverable NFT gets
 * sent, and it CANNOT BE EDITED afterwards (changing it is a support ticket by
 * design — a self-service edit on that field is an obvious attack surface). The
 * server's only automatic defence is an EIP-55 format check, and that check is
 * PARTIAL: the checksum lives in the capitalisation, so a mistyped character is
 * caught in a checksummed address and sails straight through an all-lowercase
 * one. Anyone pasting from MetaMask or a block explorer is protected; anyone
 * typing it by hand in lowercase is not.
 *
 * So the confirm step IS the real guard, which is why it shows the address in
 * FULL and unbroken. Do not truncate it to 0x1234…abcd to save space — the
 * middle characters are exactly where a wrong-wallet mistake lives.
 *
 * No signature and no wallet connector: the server accepts an unsigned pasted
 * address by deliberate product decision, so demanding one here would cost a
 * popup for zero security and contradict the sheet's own "No sign in" promise.
 */

type View = "input" | "confirm" | "done";

export function MintWalletSheet({
  isOpen,
  onClose,
  onAttached,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Fired with the stored (lowercased) address so the card can settle. */
  onAttached: (address: string) => void;
}) {
  const [view, setView] = useState<View>("input");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const reset = () => {
    setView("input");
    setAddress("");
    setBusy(false);
    setError(null);
    setSaved(null);
  };

  const close = () => {
    onClose();
    // Defer so the sheet's exit animation doesn't visibly snap back to step 1.
    setTimeout(reset, 300);
  };

  // Local check is SHAPE ONLY — deliberately not EIP-55. The server's viem
  // check is checksum-aware and is the real gate; a stricter local regex would
  // reject valid addresses, and re-implementing the checksum here would give two
  // sources of truth for the one field that must not have two.
  const looksLikeAddress = /^0x[a-fA-F0-9]{40}$/.test(address.trim());

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await attachMintWallet(address.trim());
    setBusy(false);
    if (r.ok && r.walletAddress) {
      setSaved(r.walletAddress);
      setView("done");
      onAttached(r.walletAddress);
      track("mint_wallet_attached", {});
      return;
    }
    // Back to the input on a rejection so the address stays editable. The
    // server's message is more specific than anything we could infer from the
    // code alone (it names the actual reason), so surface it verbatim.
    setError(r.error || "Could not attach that wallet");
    setView("input");
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={close} title="Mint wallet">
      {view === "input" && (
        <div className="space-y-4">
          <div>
            <h3 className="font-headline text-lg font-bold text-accent">
              Where should your Smudgie mint?
            </h3>
            <p className="mt-2 text-sm text-accent/60 leading-relaxed">
              This is the address your Smudgie will be sent to. It cannot be
              changed later without a support ticket, so use a wallet you control
              and intend to keep.
            </p>
          </div>

          <div>
            <label
              htmlFor="mint-wallet-address"
              className="block text-xs font-semibold uppercase tracking-wide text-accent/50 mb-1.5"
            >
              Wallet address
            </label>
            <input
              id="mint-wallet-address"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={64}
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Paste your wallet address (0x…)"
              className="w-full rounded-lg bg-background border border-outline/30 px-3 py-3
                         font-mono text-sm text-accent placeholder:text-accent/30
                         focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {error && (
              <p className="mt-2 flex items-start gap-2 text-sm text-red-400">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                {error}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={!looksLikeAddress}
            onClick={() => setView("confirm")}
            className="w-full rounded-lg bg-primary py-3 font-headline font-bold text-background
                       disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            Review
          </button>

          <p className="text-center text-xs text-accent/40">
            No sign in, no transaction, no gas.
          </p>
        </div>
      )}

      {view === "confirm" && (
        <div className="space-y-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-primary" />
            <h3 className="font-headline text-lg font-bold text-accent">
              Check this carefully.
            </h3>
          </div>
          <p className="text-sm text-accent/60 leading-relaxed">
            Your Smudgie will be sent here. To change it you will need to open a
            support ticket, so make sure every character is right.
          </p>

          {/* IN FULL, and break-all rather than truncate: 42 mono characters do
              not fit a phone, and truncating would undo the entire point of
              showing it. It wraps instead. */}
          <p className="rounded-lg bg-background border border-outline/30 px-3 py-3
                        font-mono text-sm text-accent break-all leading-relaxed">
            {address.trim()}
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-3
                       font-headline font-bold text-background disabled:opacity-60"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? "Locking it in…" : "Yes, lock it in"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setView("input")}
            className="w-full py-2 text-sm text-accent/50 disabled:opacity-40"
          >
            Back
          </button>
        </div>
      )}

      {view === "done" && (
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500">
            <Check size={26} className="text-white" strokeWidth={3} />
          </span>
          <h3 className="font-headline text-lg font-bold text-accent">
            Mint wallet locked in
          </h3>
          <p className="font-mono text-xs text-accent/60 break-all leading-relaxed">
            {saved}
          </p>
          <p className="text-sm text-accent/60 leading-relaxed">
            Your Smudgie will be sent here. To change it you will need to open a
            support ticket, so keep this wallet.
          </p>
          <button
            type="button"
            onClick={close}
            className="w-full rounded-lg bg-primary py-3 font-headline font-bold text-background"
          >
            Done
          </button>
        </div>
      )}

      {view === "input" && (
        <div className="mt-6 flex items-center gap-2 text-xs text-accent/40">
          <Wallet size={14} className="shrink-0" />
          Only you can see this. It is used once, at mint.
        </div>
      )}
    </BottomSheet>
  );
}
