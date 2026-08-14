import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  Share2,
  Wallet,
  Bell,
  ImagePlus,
  Trash2,
} from "lucide-react";
import { CreatorCard, tierFor, CARD_ZOOM, CARD_ZOOM_MAX } from "../components/creatorCard/CreatorCard";
import {
  STEPS,
  ASK_STEPS,
  EARNERS,
  DISCORD_INVITE_URL,
  GTD_POINTS_REQUIRED_FALLBACK,
  type Step,
} from "../components/creatorCard/steps";
import { MintWalletSheet } from "../components/creatorCard/MintWalletSheet";
import {
  GtdUnlockCelebration,
  useGtdCelebration,
} from "../components/creatorCard/GtdUnlockCelebration";
import { useCardArt } from "../components/creatorCard/useCardArt";
import {
  renderCardToBlob,
  inlineArt,
  shareCard,
  buildCaption,
  buildXIntentUrl,
} from "../components/creatorCard/cardShare";
import {
  fetchCardState,
  recordCardAction,
  joinProgram,
  startDiscordClaim,
  setMintReminder,
  getCachedCardState,
  type CardState,
  type CardActionId,
} from "../services/creatorCard";
import { useToast } from "../components/Toast";
import { track } from "../services/analytics";
import { emitBalance } from "../services/credits";

/**
 * The Creator Card — mobile port of Comic-Pro2's CreatorCardModal.
 *
 * TWO ENDPOINTS ONLY:
 *   GET  card state  -> everything this screen renders, in ONE call. The SERVER
 *        also records any newly-satisfied verified step (the Discord claim, two
 *        referrals, a contest entry, a first generation) BEFORE answering — so
 *        there is no client-side verify sweep here, deliberately. Upstream had
 *        one and deleted it: it replicated server state across racing endpoints
 *        and reliably missed the auto-claim right after the OAuth return.
 *   POST action      -> record a click-initiated ask (the honour asks + the
 *        connected-but-unclaimed claim edge).
 *
 * If you find yourself adding a third call to "check" whether something is
 * done, it belongs in the server's sweep instead.
 */

type RowState = "done" | "soon" | "locked" | "go" | "copy" | "todo";

export function CreatorCardScreen({ onBack }: { onBack: () => void }) {
  const { addToast } = useToast();
  const [data, setData] = useState<CardState | null>(getCachedCardState());
  const [loading, setLoading] = useState(!getCachedCardState());
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [showMintWallet, setShowMintWallet] = useState(false);
  const [copiedFlash, setCopiedFlash] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [downloadedShare, setDownloadedShare] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [exportArt, setExportArt] = useState<string | null>(null);

  const seed = data?.artSeed ?? null;
  const { artUrl, hasCustomArt, zoom, changeZoom, uploadArt, clearArt } =
    useCardArt(seed);

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const next = await fetchCardState();
    setLoading(false);
    if (!next) return;
    setData(next);
    // Anything the server's sweep newly recorded on THIS load. This is how the
    // claim, and everything queued behind it, announces itself after the Discord
    // return.
    for (const a of next.awarded || []) {
      addToast(
        a.action === "claim_card"
          ? "Card claimed, welcome in"
          : `+${a.points} points`,
        "success",
      );
    }
  }, [addToast]);

  useEffect(() => {
    track("creator_card_opened", {});
    void load();
  }, [load]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  // ── Derived ────────────────────────────────────────────────────────────────
  const points = data?.balance ?? 0;
  const breakdown = data?.breakdown ?? {};
  const member = !!data?.member;
  const joinReady = !!data?.joinReady;
  const discordReady = !!data?.discordReady;
  const discordConnected = !!data?.discordConnected;
  const referralCount = data?.referralCount ?? 0;
  const walletAddress = data?.walletAddress ?? null;
  const gtdPointsRequired =
    data?.gtdPointsRequired ?? GTD_POINTS_REQUIRED_FALLBACK;
  const gtdUnlocked = points >= gtdPointsRequired;

  const isDone = useCallback(
    // Any pointed step with a recorded grant counts as done — asks AND the
    // funnel steps. Pips + tier still read from ASK_STEPS only, so the card
    // keeps exactly four dots.
    (step: Step) =>
      step.points != null && (breakdown[`card_action_${step.id}`] ?? 0) > 0,
    [breakdown],
  );

  // The card is SEALED until claimed — and a non-member has no card at all.
  // Reads the LEDGER, not a status column, because that is what the server
  // records the claim against; anything else lets the UI and the server
  // disagree about who is claimed.
  const cardLocked = !member || (breakdown.card_action_claim_card ?? 0) === 0;

  const stepState = (step: Step): RowState => {
    // FIRST, ahead of the lock: anyone who earned a step keeps their tick.
    // Points are never clawed back, so a paid row must never grey out.
    if (isDone(step)) return "done";
    // 'soon' outranks 'locked': mint isn't blocked BY the claim, it doesn't
    // exist yet, and claiming will not change that.
    if (step.kind === "soon") return "soon";
    // THE GATE. The server refuses these anyway, so leaving them pressable
    // would just produce an error toast after the fact.
    if (step.id !== "claim_card" && cardLocked) return "locked";
    if (step.kind === "go") return "go";
    if (step.id === "claim_card" && !discordReady) return "soon";
    // Refer-two stays tappable at zero referrals, because the tap is "copy my
    // link" — the thing you do to make progress — not a claim.
    if (step.id === "refer_friends") return "copy";
    return "todo";
  };

  const completed = ASK_STEPS.filter(isDone).length;
  const tier = tierFor(completed, ASK_STEPS.length);
  const pct = Math.round((completed / ASK_STEPS.length) * 100);
  const referralLink = data?.referralCode
    ? `https://panelhaus.app/?ref=${data.referralCode}`
    : null;

  const [showGtd, dismissGtd] = useGtdCelebration({
    open: !loading,
    unlocked: gtdUnlocked,
    joinReady,
    walletAddress,
    seed,
  });

  // ── Actions ────────────────────────────────────────────────────────────────
  const patch = (next: Partial<CardState>) =>
    setData((prev) => (prev ? { ...prev, ...next } : prev));

  /** Honour asks are optimistic: light the pip now, settle in the background. */
  const recordHonor = (step: Step) => {
    const pts = step.points ?? 0;
    patch({
      balance: points + pts,
      breakdown: { ...breakdown, [`card_action_${step.id}`]: pts },
    });
    void (async () => {
      const r = await recordCardAction(step.id as CardActionId);
      if (r.ok) {
        patch({ balance: r.balance ?? points + pts });
        addToast(`+${r.awarded ?? pts} points`, "success");
        track("creator_card_action", { action: step.id });
      } else {
        // RELOAD server truth rather than restoring a captured snapshot — a
        // snapshot revert can resurrect a pre-sweep state and wipe awards that
        // landed in between, which upstream saw live as steps un-marking.
        void load();
        addToast(r.error || "Could not record that", "error");
      }
    })();
  };

  const startClaim = async () => {
    setBusyAction("claim_card");
    track("creator_card_claim_started", {});
    const r = await startDiscordClaim();
    setBusyAction(null);
    if (r.url) {
      // Full-page navigation: we come back via ?creatorCard=1&discord=…, and the
      // next state load records the claim server-side.
      window.location.href = r.url;
      return;
    }
    addToast(r.error || "Could not start Discord connect", "error");
  };

  const doJoin = async () => {
    setBusyAction("join");
    const r = await joinProgram();
    setBusyAction(null);
    if (!r.ok) {
      addToast(r.error || "Could not join", "error");
      return;
    }
    addToast(
      r.bonusGranted ? `Welcome in, +${r.bonusGranted} credits` : "Welcome in",
      "success",
    );
    track("creator_program_joined", { bonus: r.bonusGranted ?? 0 });

    // The join bonus landed in the SHARED ink balance, so tell the nav chip now
    // rather than leaving it stale until something else refetches.
    if (typeof r.newBalance === "number") emitBalance(r.newBalance);

    // ⚠️ REVEAL THE CARD NOW; let the refresh land behind it. Do NOT gate this
    // on load().
    //
    // Awaiting the refresh made joining look broken for ~10 seconds. Two
    // expensive calls run back to back: /join is already several round trips
    // (balance, status, addCredits, markJoined, cache bust), and the state load
    // that follows triggers Panel Haus's sweep, which on a FIRST join records up
    // to four actions SEQUENTIALLY because awardPoints row-locks user_points.
    // Meanwhile the screen still said "Join the Creator Program", so the button
    // read as having done nothing.
    //
    // Membership is already true server-side by this point, so flipping it here
    // is accurate rather than hopeful. The sweep's awards arrive a moment later
    // and toast themselves. Same pattern the honour asks use.
    patch({ member: true });
    void load();
  };

  const copyLink = async () => {
    if (!referralLink) {
      addToast("Your referral link isn't ready yet, reopen in a moment", "info");
      return;
    }
    try {
      await navigator.clipboard.writeText(referralLink);
      // Only after the write RESOLVES, so the pulse cannot claim a copy the
      // catch below is about to report as failed.
      if (flashTimer.current) clearTimeout(flashTimer.current);
      setCopiedFlash(true);
      flashTimer.current = setTimeout(() => setCopiedFlash(false), 550);
      addToast("Link copied, send it to a friend", "success");
    } catch {
      addToast("Could not copy", "error");
    }
  };

  /**
   * Render the card and hand it to the OS share sheet.
   *
   * The +15 is credited ONLY when the sheet reports a real share. A cancel earns
   * nothing, and the download fallback earns nothing until they actually take it
   * to X — see the "Post on X" button that appears after a download.
   */
  const shareMyCard = async () => {
    const step = STEPS.find((s) => s.id === "share_card")!;
    if (sharing) return;
    setSharing(true);
    setDownloadedShare(false);
    try {
      // Swap the art for a data URL BEFORE rasterising — html-to-image cannot
      // reliably re-fetch a background on a pseudo-element, and that is exactly
      // what silently shipped art-less cards upstream.
      //
      // ⚠️ flushSync, NOT a bare setState. React would batch the update and the
      // very next line would rasterise the PREVIOUS render — the card without
      // its inlined art — which is the exact bug this inlining exists to
      // prevent, except now it would fail silently and intermittently depending
      // on whether React happened to commit before the rAFs below.
      const inlined = await inlineArt(artUrl);
      flushSync(() => setExportArt(inlined));
      // Let the swapped art paint. renderCardToBlob waits two frames itself.
      const node = exportRef.current;
      if (!node) throw new Error("Could not render your card");
      const blob = await renderCardToBlob(node);
      const result = await shareCard(blob);
      if (result === "shared") {
        addToast("Card shared", "success");
        track("creator_card_shared", { result });
        if (!isDone(step)) recordHonor(step);
      } else if (result === "downloaded") {
        setDownloadedShare(true);
        addToast("Card saved. Post it on X to earn the points.", "info");
        track("creator_card_shared", { result });
      }
      // "cancelled" — say nothing, credit nothing.
    } catch (e) {
      addToast((e as Error).message || "Could not share your card", "error");
    } finally {
      setExportArt(null);
      setSharing(false);
    }
  };

  /** The download fallback's follow-through: opening the composer is the same
   *  "I went to post it" signal the share sheet gives, so it credits. */
  const postOnX = () => {
    const step = STEPS.find((s) => s.id === "share_card")!;
    window.open(
      buildXIntentUrl(buildCaption({ handle: data?.discordUsername, points })),
      "_blank",
      "noopener",
    );
    setDownloadedShare(false);
    if (!isDone(step)) recordHonor(step);
  };

  const handleStep = (step: Step) => {
    if (busyAction) return;
    const state = stepState(step);
    // AHEAD of the refer short-circuit: this earns its keep on the honour branch
    // below, which opens a tab BEFORE the POST the server would refuse. Without
    // it a stale render would send someone to X and only then toast an error.
    if (state === "locked" || state === "soon") return;
    // ABOVE the isDone guard on purpose: copying the link is the whole
    // interaction and must survive completion, because every friend past the
    // first two is another +10.
    if (step.id === "refer_friends") return void copyLink();
    if (step.id === "contest") {
      // Discord, not an in-app entry flow — that is where contests are announced
      // and where the rules are. This tap does NOT tick the box: `contest` stays
      // server-verified against a real entry.
      window.open(DISCORD_INVITE_URL, "_blank", "noopener");
      return;
    }
    if (step.id === "first_creation") {
      onBack();
      return;
    }
    if (isDone(step)) return;
    if (step.id === "claim_card") {
      if (!discordReady) return;
      // Connected but unclaimed edge — the ledger row is missing even though
      // Discord is linked, so ask the server to record it.
      if (discordConnected) {
        setBusyAction(step.id);
        void recordCardAction("claim_card").then((r) => {
          setBusyAction(null);
          if (r.ok) void load();
          else addToast(r.error || "Could not record that", "error");
        });
        return;
      }
      return void startClaim();
    }
    if (step.id === "share_card") return void shareMyCard();
    // Remaining honour ask: open X, credit optimistically.
    if (step.href) window.open(step.href, "_blank", "noopener");
    recordHonor(step);
  };

  // ── Mint reminder ──────────────────────────────────────────────────────────
  const [reminderEmail, setReminderEmail] = useState("");
  const [savingReminder, setSavingReminder] = useState(false);
  useEffect(() => {
    if (data?.mintReminder.email) setReminderEmail(data.mintReminder.email);
  }, [data?.mintReminder.email]);

  const saveReminder = async (optIn: boolean) => {
    setSavingReminder(true);
    const r = await setMintReminder(optIn, optIn ? reminderEmail : undefined);
    setSavingReminder(false);
    if (!r.ok) {
      addToast(r.error || "Could not save that", "error");
      return;
    }
    patch({
      mintReminder: { optedIn: !!r.optedIn, email: r.email ?? null },
    });
    addToast(r.optedIn ? "You're on the list" : "Reminder turned off", "success");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-outline/10 bg-background/95 px-4 py-3 backdrop-blur"
              style={{ paddingTop: "calc(var(--sat) + 0.75rem)" }}>
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full active:bg-accent/10"
          aria-label="Back"
        >
          <ArrowLeft size={20} className="text-accent" />
        </button>
        <h1 className="font-headline text-lg font-bold text-accent">
          Creator Card
        </h1>
      </header>

      <div className="px-5 py-6 space-y-6">
        {loading ? (
          <CardSkeleton />
        ) : !data ? (
          <p className="text-center text-sm text-accent/50">
            Couldn&apos;t load your card. Pull down to try again.
          </p>
        ) : (
          <>
            {/* The card */}
            <div className="mx-auto w-full max-w-[280px]">
              <CreatorCard
                tier={tier}
                points={points}
                handle={data.discordUsername}
                artUrl={cardLocked ? null : artUrl}
                zoom={zoom}
                completed={completed}
                totalSteps={ASK_STEPS.length}
                memberId={null}
                locked={cardLocked}
              />
            </div>

            {/* Off-screen export node. Kept IN LAYOUT (not display:none) because
                html-to-image cannot rasterise a node with no box. */}
            <div
              aria-hidden="true"
              style={{
                position: "fixed",
                left: "-10000px",
                top: 0,
                width: "450px",
                pointerEvents: "none",
              }}
            >
              <div ref={exportRef}>
                <CreatorCard
                  tier={tier}
                  points={points}
                  handle={data.discordUsername}
                  artUrl={exportArt || artUrl}
                  zoom={zoom}
                  completed={completed}
                  totalSteps={ASK_STEPS.length}
                  memberId={null}
                  // The export node must be FLAT — html-to-image rasterises the
                  // live transform, so a tilted card is captured skewed.
                  disableTilt
                />
              </div>
            </div>

            {!member ? (
              <JoinPitch
                busy={busyAction === "join"}
                joinReady={joinReady}
                onJoin={doJoin}
              />
            ) : (
              <>
                {/* Card art controls. A VISIBLE control, unlike desktop's
                    hover-only overlay — on touch there is no hover, so a
                    hover-revealed affordance is simply undiscoverable. */}
                <div className="flex items-center justify-center gap-4 text-sm">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-accent/60 active:text-accent"
                  >
                    <ImagePlus size={16} />
                    {hasCustomArt ? "Change image" : "Use your own image"}
                  </button>
                  {hasCustomArt && (
                    <button
                      onClick={clearArt}
                      className="flex items-center gap-1.5 text-accent/50 active:text-accent"
                    >
                      <Trash2 size={16} />
                      Restore
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try {
                      const warning = await uploadArt(file);
                      if (warning) addToast(warning, "info");
                    } catch (err) {
                      addToast((err as Error).message, "error");
                    }
                  }}
                />
                {hasCustomArt && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-accent/50 shrink-0">Framing</span>
                    <input
                      type="range"
                      min={CARD_ZOOM}
                      max={CARD_ZOOM_MAX}
                      value={zoom}
                      onChange={(e) => changeZoom(parseInt(e.target.value, 10))}
                      className="flex-1 accent-primary"
                      aria-label="Card art framing"
                    />
                  </div>
                )}

                {/* Progress */}
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-accent/60">
                      {completed} of {ASK_STEPS.length} asks
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-accent">
                      {pct}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-highest">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Share */}
                <button
                  onClick={shareMyCard}
                  disabled={sharing || cardLocked}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-outline/30
                             py-2.5 text-sm font-semibold text-accent disabled:opacity-40"
                >
                  {sharing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Share2 size={16} />
                  )}
                  {sharing ? "Rendering…" : "Share this card"}
                </button>
                {downloadedShare && (
                  <button
                    onClick={postOnX}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary
                               py-2.5 text-sm font-bold text-background"
                  >
                    <ExternalLink size={16} />
                    Post on X
                  </button>
                )}

                {/* The rows */}
                <ol className="space-y-2">
                  {STEPS.map((step) => (
                    <StepRow
                      key={step.id}
                      step={step}
                      state={stepState(step)}
                      busy={busyAction === step.id}
                      discordReady={discordReady}
                      referralCount={referralCount}
                      copiedFlash={copiedFlash && step.id === "refer_friends"}
                      onTap={() => handleStep(step)}
                    />
                  ))}
                </ol>

                {/* ── More ways to earn ───────────────────────────────────
                    Read-only, and rendered OUTSIDE the step list so it can
                    never affect the pips or the tier — the tier is what the
                    mint allowlist is ranked on.

                    Members only, for the same reason the mint band is: these
                    award on the next load from history Panel Haus already
                    holds, so showing them to a non-member dangles a reward
                    behind an ask they have not made. */}
                <div className="border-t border-outline/10 pt-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-accent/50">
                      More ways to earn
                    </span>
                    <span className="shrink-0 text-[11px] text-accent/40">
                      added automatically
                    </span>
                  </div>
                  {/* Says WHERE, and that is not decoration. Only the credit
                      engine is reachable from this app — the rest verify against
                      Panel Haus's own projects, vault and orders (see EARNERS in
                      steps.ts). They pay into the same shared balance, so they
                      belong on the card; without this line "Finish a comic +50"
                      reads as a promise mobile cannot keep. */}
                  <p className="mt-1 text-[11px] leading-snug text-accent/40">
                    Your points are shared with panelhaus.app — these pay wherever
                    you earn them.
                  </p>
                  <ul className="mt-2.5 space-y-2">
                    {EARNERS.map((earner) => {
                      const earned = (breakdown[earner.id] ?? 0) > 0;
                      return (
                        <li
                          key={earner.id}
                          className="flex items-baseline justify-between gap-3 text-[13px] leading-snug"
                        >
                          <span className={earned ? "text-accent/70" : "text-accent/45"}>
                            {earned && (
                              <Check
                                size={12}
                                strokeWidth={3}
                                className="mr-1 inline-block align-baseline text-emerald-500"
                              />
                            )}
                            {earner.label}
                          </span>
                          <span
                            className={`shrink-0 font-semibold tabular-nums ${
                              earned ? "text-emerald-500" : "text-accent/45"
                            }`}
                          >
                            +{earner.points}
                            {earner.suffix && (
                              <span className="font-normal text-accent/40">
                                {" "}
                                {earner.suffix}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Mint wallet + reminder band */}
                {joinReady && (
                  <div className="space-y-5 rounded-lg border border-outline/20 bg-surface-container/60 p-4">
                    <MintWalletRow
                      walletAddress={walletAddress}
                      gtdUnlocked={gtdUnlocked}
                      gtdPointsRequired={gtdPointsRequired}
                      points={points}
                      onAdd={() => setShowMintWallet(true)}
                      onCopy={async () => {
                        if (!walletAddress) return;
                        try {
                          await navigator.clipboard.writeText(walletAddress);
                          addToast("Mint wallet copied", "success");
                        } catch {
                          addToast("Could not copy", "error");
                        }
                      }}
                    />

                    <div className="border-t border-outline/10 pt-4">
                      <div className="flex items-center gap-2">
                        <Bell size={14} className="text-primary shrink-0" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-accent/70">
                          Remind me before the mint
                        </span>
                      </div>
                      {data.mintReminder.optedIn ? (
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="text-sm text-accent/60">
                            You&apos;re on the list, we&apos;ll email you before the
                            mint.
                          </p>
                          <button
                            onClick={() => saveReminder(false)}
                            disabled={savingReminder}
                            className="shrink-0 text-xs text-accent/40 underline underline-offset-2"
                          >
                            Turn off
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          <p className="text-sm text-accent/60">
                            Email me when the Smudge mint goes live
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="email"
                              inputMode="email"
                              autoComplete="email"
                              value={reminderEmail}
                              onChange={(e) => setReminderEmail(e.target.value)}
                              placeholder="you@example.com"
                              aria-label="Email address for the mint reminder"
                              className="min-w-0 flex-1 rounded-lg border border-outline/30 bg-background
                                         px-3 py-2 text-sm text-accent placeholder:text-accent/30
                                         focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <button
                              onClick={() => saveReminder(true)}
                              disabled={savingReminder || !reminderEmail}
                              className="shrink-0 rounded-lg bg-primary px-4 text-sm font-bold text-background
                                         disabled:opacity-40"
                            >
                              {savingReminder ? "…" : "Save"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <MintWalletSheet
        isOpen={showMintWallet}
        onClose={() => setShowMintWallet(false)}
        onAttached={(addr) => patch({ walletAddress: addr })}
      />

      <GtdUnlockCelebration
        open={showGtd}
        points={points}
        onAddWallet={() => {
          dismissGtd();
          setShowMintWallet(true);
        }}
        onDismiss={dismissGtd}
      />
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="mx-auto aspect-[5/7] w-full max-w-[280px] animate-pulse rounded bg-surface-container" />
      <div className="space-y-2">
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg bg-surface-container"
          />
        ))}
      </div>
    </div>
  );
}

/** Non-member view. The asks list is deliberately NOT shown: a column of rows
 *  they cannot action reads as broken, and nothing here should imply they are
 *  already participating. Joining is the consent gate that starts the server's
 *  sweep, so this screen is load-bearing, not decoration. */
function JoinPitch({
  busy,
  joinReady,
  onJoin,
}: {
  busy: boolean;
  joinReady: boolean;
  onJoin: () => void;
}) {
  return (
    <div>
      <h2 className="font-headline text-lg font-bold text-accent">
        Claim your Creator Card
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-accent/60">
        The Creator Card is your place in the Panel Haus Creator Program.
      </p>
      <ul className="mt-4 space-y-2">
        {[
          "Your own card art, dealt when you join",
          "Points for every ask you complete",
          "Better mint position as the card levels",
        ].map((line) => (
          <li key={line} className="flex items-start gap-2.5 text-sm text-accent/70">
            <Check size={16} className="mt-0.5 shrink-0 text-primary" strokeWidth={3} />
            {line}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onJoin}
        disabled={!joinReady || busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3
                   font-headline font-bold text-background disabled:opacity-40"
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <ArrowRight size={16} />
        )}
        {busy ? "Joining…" : "Join the Creator Program"}
      </button>
      <p className="mt-2 text-center text-xs text-accent/40">
        {joinReady ? "Free to join." : "The Creator Program isn't open yet"}
      </p>
    </div>
  );
}

function StepRow({
  step,
  state,
  busy,
  discordReady,
  referralCount,
  copiedFlash,
  onTap,
}: {
  step: Step;
  state: RowState;
  busy: boolean;
  discordReady: boolean;
  referralCount: number;
  copiedFlash: boolean;
  onTap: () => void;
}) {
  const locked = state === "locked";
  const done = state === "done";
  const soon = state === "soon";
  const inert = locked || soon || busy;
  const shown = step.displayPoints ?? step.points;

  // The refer row's hint carries live progress, because "click to copy" alone
  // never tells you how close you are.
  let hint = step.hint;
  if (step.id === "claim_card" && !discordReady && step.hintOff) hint = step.hintOff;
  if (step.id === "refer_friends") {
    hint = done
      ? `${referralCount} joined, click to copy your link again`
      : `Click to copy your link · ${referralCount} of 2 joined`;
  }
  if (locked) {
    // Desktop puts this in a title= tooltip, which does not exist on touch.
    hint = discordReady
      ? "Claim your card first"
      : "Claim your card first. Discord isn't configured yet";
  }

  return (
    <li>
      <button
        type="button"
        onClick={onTap}
        disabled={inert}
        aria-disabled={inert}
        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors
          min-h-[56px]
          ${done ? "border-primary/30 bg-primary/5" : "border-outline/20 bg-surface-container/40"}
          ${inert ? "opacity-45" : "active:border-primary/60"}`}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold
            ${done ? "bg-primary text-background" : "bg-surface-container-highest text-accent/60"}`}
        >
          {done ? (
            <Check size={14} strokeWidth={3} />
          ) : locked || soon ? (
            <Lock size={12} />
          ) : (
            step.n
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-accent">
            {step.label}
          </span>
          <span className="mt-0.5 block text-xs leading-snug text-accent/50">
            {hint}
          </span>
          {step.subHint && !locked && (
            <span className="mt-0.5 block text-xs text-accent/35">
              {step.subHint}
            </span>
          )}
          {step.id === "refer_friends" && !locked && (
            <span className="mt-0.5 block text-xs text-accent/35">
              +10 more points for every friend after the first two
            </span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {shown != null && (
            <span
              className={`text-sm font-bold tabular-nums ${done ? "text-primary" : "text-accent/50"}`}
            >
              +{shown}
            </span>
          )}
          {busy ? (
            <Loader2 size={16} className="animate-spin text-accent/40" />
          ) : step.id === "refer_friends" && !locked ? (
            copiedFlash ? (
              <Check size={16} className="text-primary" />
            ) : (
              <Copy size={16} className="text-accent/30" />
            )
          ) : step.kind === "go" && !done && !locked ? (
            <ArrowRight size={16} className="text-accent/30" />
          ) : !done && !inert ? (
            <ExternalLink size={16} className="text-accent/30" />
          ) : null}
        </span>
      </button>
    </li>
  );
}

/** The mint-wallet row: locked → actionable → settled. */
function MintWalletRow({
  walletAddress,
  gtdUnlocked,
  gtdPointsRequired,
  points,
  onAdd,
  onCopy,
}: {
  walletAddress: string | null;
  gtdUnlocked: boolean;
  gtdPointsRequired: number;
  points: number;
  onAdd: () => void;
  onCopy: () => void;
}) {
  if (walletAddress) {
    // Settled. Shows the address IN FULL, deliberately: this is the one place a
    // member can verify where an unrecoverable NFT is going, and a truncation
    // hides exactly the middle characters a wrong-wallet mistake lives in.
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Wallet size={14} className="shrink-0 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-accent/70">
            Mint wallet
          </span>
        </div>
        <button
          onClick={onCopy}
          className="flex w-full items-start gap-2 text-left"
          aria-label="Copy your mint wallet address"
        >
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500">
            <Check size={10} className="text-white" strokeWidth={4} />
          </span>
          <span className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed text-accent/70">
            {walletAddress}
          </span>
          <Copy size={14} className="mt-0.5 shrink-0 text-accent/30" />
        </button>
        <p className="text-xs leading-snug text-accent/40">
          Locked in. To change it,{" "}
          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-accent/60 underline underline-offset-2"
          >
            open a Discord ticket
          </a>
          .
        </p>
      </div>
    );
  }

  if (gtdUnlocked) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="flex items-center gap-2">
            <Wallet size={14} className="shrink-0 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">
              Secure your spot
            </span>
          </span>
          <span className="text-[11px] font-semibold text-primary">
            limited spots available
          </span>
        </div>
        <p className="text-xs leading-snug text-accent/60">
          The wallet your Smudgie gets sent to.
        </p>
        <button
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5
                     text-sm font-bold text-background"
        >
          <Wallet size={16} />
          Add mint wallet
        </button>
      </div>
    );
  }

  // Locked. The copy has ONE job: say this is earnable. Every ask sums to 80 and
  // the gate is 100, so a member with every pip lit still lands here — on a
  // finished-looking card, a padlock with no explanation reads as a bug.
  //
  // ⚠️ It deliberately NAMES NO EARNERS. Upstream this once ended "Enter a
  // contest (+20) or make something (+15)", i.e. two action names and two point
  // values hardcoded in prose, which went stale the moment the economy moved.
  // Both numbers here are derived.
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Lock size={14} className="shrink-0 text-accent/40" />
        <span className="text-xs font-semibold uppercase tracking-wide text-accent/60">
          Mint wallet
        </span>
      </div>
      <p className="text-xs leading-snug text-accent/50">
        Unlocks at {gtdPointsRequired} points. {gtdPointsRequired - points} more to
        go. Limited spots available.
      </p>
    </div>
  );
}
