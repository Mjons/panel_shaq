import { useEffect, useState } from "react";
import { Trophy, Palette, Coins, Gift, ChevronRight, Loader2 } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { Smudge } from "./Smudge";
import { track } from "../services/analytics";
import {
  submitShipClaim,
  getShipIdentity,
  type ClaimApplication,
} from "../services/shipClaim";

// GTD ship-claim sheet (mobile port of Comic-Pro2's CreatorInviteModal).
// Copy is VERBATIM from desktop — the two apps must not contradict each other
// publicly. The claim grants nothing now: it locks a whitelist spot only, and
// everyone who ships is auto-approved ("reviewed within 24 hours" is framing).
//
// The invite only fires for SIGNED-IN users (gated in fireShipClaimOnce), so
// by the time this renders an identity exists. Still imports zero Clerk —
// identity comes from the shipClaim holder, keeping this file mountable
// anywhere (the buyCredits-sheet convention).

type View = "invite" | "apply" | "done";

const CHOICE_QS = [
  {
    key: "made",
    q: "What did you just make?",
    opts: ["Comic", "Meme", "Brand content", "Other"],
  },
  {
    key: "audience",
    q: "Who do you create for?",
    opts: ["Myself", "A brand or client", "A community I run"],
  },
  {
    key: "platform",
    q: "Where do you post?",
    opts: ["X", "TikTok", "Instagram", "Discord", "Nowhere yet"],
  },
  {
    key: "cadence",
    q: "How often do you ship?",
    opts: ["Daily", "Weekly", "Now and then"],
  },
] as const;

type AnswerKey = (typeof CHOICE_QS)[number]["key"] | "goal" | "handle" | "wallet";
type Answers = Partial<Record<AnswerKey, string>>;

function Reward({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
        {icon}
      </span>
      <span>
        <span className="block font-headline font-bold text-accent">{title}</span>
        <span className="block text-sm text-accent/60">{desc}</span>
      </span>
    </li>
  );
}

export function ShipClaimSheet({
  isOpen,
  source,
  onClose,
}: {
  isOpen: boolean;
  source: string;
  onClose: (view: View) => void;
}) {
  const [view, setView] = useState<View>("invite");
  const [answers, setAnswers] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  // Fresh form each time the sheet opens; prefill the wallet when Clerk knows it.
  useEffect(() => {
    if (!isOpen) return;
    setView("invite");
    const wallet = getShipIdentity()?.wallet;
    setAnswers(wallet ? { wallet } : {});
    setSubmitting(false);
    setFailed(false);
  }, [isOpen]);

  const setAnswer = (key: AnswerKey, value: string) =>
    setAnswers((a) => ({ ...a, [key]: value }));

  const choicesDone = CHOICE_QS.every((q) => answers[q.key]);
  const wallet = (answers.wallet || "").trim();
  const walletValid = !wallet || /^0x[a-fA-F0-9]{40}$/.test(wallet);
  const canSubmit = choicesDone && walletValid && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    track("ship_claim_submitted", {
      source,
      made: answers.made || "",
      audience: answers.audience || "",
      platform: answers.platform || "",
      cadence: answers.cadence || "",
      has_goal: !!(answers.goal || "").trim(),
      has_handle: !!(answers.handle || "").trim(),
      has_wallet: !!wallet,
      signed_in: !!getShipIdentity(),
    });
    // The done view is EARNED, not unconditional: only a confirmed server write
    // gets it. On failure we keep the user here with their answers intact, and
    // shipClaim has already cleared the shown-flag so a later ship re-prompts.
    const stored = await submitShipClaim(answers as ClaimApplication, source);
    setSubmitting(false);
    if (!stored) {
      setFailed(true);
      return;
    }
    setView("done");
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => onClose(view)}
      title={view === "apply" ? "Apply for your GTD spot" : undefined}
    >
      {view === "invite" && (
        <div className="space-y-5">
          <div className="flex flex-col items-center text-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary">
              <Trophy size={28} className="text-background" />
            </span>
            <h2 className="font-headline text-2xl font-bold text-accent">
              You're a creator now.
            </h2>
            <p className="text-sm text-accent/70 leading-relaxed">
              You just shipped your first piece. That makes you a real UGC
              creator — and it earns you a{" "}
              <span className="font-semibold text-primary">guaranteed spot</span>{" "}
              on the Smudgies drop whitelist.
            </p>
          </div>

          <div className="flex justify-center">
            <Smudge pose="cheering" size={72} />
          </div>

          <div>
            <p className="text-center text-[10px] uppercase tracking-widest text-accent/40 mb-3">
              Your GTD whitelist unlocks
            </p>
            <ul className="space-y-3">
              <Reward
                icon={<Palette size={18} />}
                title="Pro tools"
                desc="The full studio, unlocked."
              />
              <Reward
                icon={<Coins size={18} />}
                title="500 AI credits"
                desc="On the house, to keep creating."
              />
              <Reward
                icon={<Gift size={18} />}
                title="Your own Smudgie"
                desc="Full of surprises."
              />
            </ul>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => {
                track("ship_claim_started", { source });
                setView("apply");
              }}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary py-3.5 px-6 font-headline font-bold text-background transition-all active:scale-[0.98]"
            >
              Claim my GTD spot <ChevronRight size={16} />
            </button>
            <p className="text-center text-[11px] text-accent/40">
              Spots are limited and reviewed. Takes about a minute.
            </p>
          </div>
        </div>
      )}

      {view === "apply" && (
        <div className="space-y-5">
          {CHOICE_QS.map((q) => (
            <div key={q.key}>
              <p className="text-sm font-semibold text-accent mb-2">{q.q}</p>
              <div className="flex flex-wrap gap-2">
                {q.opts.map((opt) => {
                  const selected = answers[q.key] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setAnswer(q.key, opt)}
                      className={`min-h-[44px] rounded-full border px-4 py-2 text-sm transition-all active:scale-[0.97] ${
                        selected
                          ? "border-primary bg-primary/15 text-primary font-semibold"
                          : "border-outline/20 bg-surface text-accent/80"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <p className="text-sm font-semibold text-accent mb-2">
              What do you want out of the Smudgies drop?{" "}
              <span className="font-normal text-accent/40">(optional)</span>
            </p>
            <textarea
              rows={2}
              value={answers.goal || ""}
              onChange={(e) => setAnswer("goal", e.target.value)}
              placeholder="A sentence is plenty."
              className="w-full rounded-lg border border-outline/20 bg-surface p-3 text-sm text-accent placeholder:text-accent/30 focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-accent mb-2">
              X handle <span className="font-normal text-accent/40">(optional)</span>
            </p>
            <input
              type="text"
              value={answers.handle || ""}
              onChange={(e) => setAnswer("handle", e.target.value)}
              placeholder="@you"
              className="w-full rounded-lg border border-outline/20 bg-surface p-3 text-sm text-accent placeholder:text-accent/30 focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-accent mb-2">
              Ethereum address{" "}
              <span className="font-normal text-accent/40">(optional)</span>
            </p>
            <input
              type="text"
              value={answers.wallet || ""}
              onChange={(e) => setAnswer("wallet", e.target.value)}
              placeholder="0x…"
              spellCheck={false}
              autoComplete="off"
              className={`w-full rounded-lg border bg-surface p-3 text-sm text-accent placeholder:text-accent/30 focus:outline-none ${
                walletValid
                  ? "border-outline/20 focus:border-primary"
                  : "border-red-500/70"
              }`}
            />
            <p
              className={`mt-1.5 text-xs ${walletValid ? "text-accent/40" : "text-red-400"}`}
            >
              {walletValid
                ? "This is where your Smudgie mints at the drop. No wallet yet? Add it later."
                : "That doesn't look like an ETH address (0x + 40 characters)."}
            </p>
          </div>

          <div className="space-y-2 pb-2">
            {failed && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-center text-xs text-red-300">
                We couldn't save your application. Your answers are still here, so
                give it another go.
              </p>
            )}
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 px-6 font-headline font-bold text-background transition-all active:scale-[0.98] disabled:opacity-40"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting
                ? "Submitting…"
                : failed
                  ? "Try again"
                  : "Submit application"}
            </button>
            {!choicesDone && (
              <p className="text-center text-[11px] text-accent/40">
                Answer the four quick ones above.
              </p>
            )}
          </div>
        </div>
      )}

      {view === "done" && (
        <div className="space-y-5">
          <div className="flex flex-col items-center text-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary">
              <Trophy size={28} className="text-background" />
            </span>
            <h2 className="font-headline text-2xl font-bold text-accent">
              You're on the list.
            </h2>
            <p className="text-sm text-accent/70 leading-relaxed">
              Application in. GTD spots are reviewed within 24 hours — we'll
              email you before the{" "}
              <span className="font-semibold text-primary">Smudgies drop</span>,
              where you'll unlock Pro tools, 500 AI credits, and your Smudgie.
            </p>
          </div>
          <button
            onClick={() => onClose("done")}
            className="w-full rounded-xl bg-primary py-3.5 px-6 font-headline font-bold text-background transition-all active:scale-[0.98]"
          >
            Back to creating
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
