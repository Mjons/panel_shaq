import React from "react";
import { X, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useCoachTipSuppression } from "./Tip";

const DOCS_URL = "https://docs.panelhaus.app";

const faqs: { q: string; a: string }[] = [
  {
    q: "Do I need to know how to draw?",
    a: "No. AI generates the art. You bring the idea.",
  },
  {
    q: "What does it cost?",
    a: "You start free with a limited number of AI credits. Each generation uses credits, and you can top up anytime.",
  },
  {
    q: "Can I use my own API key?",
    a: "Yes. Add your own Google Gemini key for free, unlimited generation. You pay the provider directly, and there are no limits on our end.",
  },
  {
    q: "Where are my images stored?",
    a: "On your own device. Your work stays yours.",
  },
  {
    q: "What can I export?",
    a: "A PNG (still image) or a GIF (animated), ready to share anywhere.",
  },
];

const steps = [
  "Choose a character.",
  "Type your story. Polish it with AI if you want.",
  "Generate your panels.",
  "Choose your layout.",
  "Add your dialogue, then bake it in.",
  "Export as a PNG or a GIF, and share it.",
];

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="font-label text-primary uppercase tracking-[0.15em] text-[10px] font-bold mb-2">
    {children}
  </p>
);

export const HelpSheet = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  useCoachTipSuppression(open);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80]"
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            className="fixed bottom-0 left-0 right-0 z-[90] mx-auto w-full max-w-lg max-h-[88vh] flex flex-col bg-[#0B1326] rounded-t-3xl border-t border-surface-container shadow-2xl"
            style={{ paddingBottom: "var(--sab, 0px)" }}
            role="dialog"
            aria-modal="true"
            aria-label="Help and About"
          >
            {/* Grabber + header */}
            <div className="flex-shrink-0 px-6 pt-3 pb-4 border-b border-surface-container">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-accent/20" />
              <div className="flex items-center justify-between">
                <h2 className="font-headline font-bold text-xl text-primary italic uppercase tracking-tight">
                  Help &amp; About
                </h2>
                <button
                  onClick={onClose}
                  className="text-accent/60 hover:text-primary transition-colors active:scale-90 duration-200 p-1"
                  aria-label="Close help"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 text-sm text-accent/80 leading-relaxed">
              {/* About */}
              <section>
                <SectionLabel>About Panel Haus</SectionLabel>
                <p className="font-headline font-bold text-lg text-accent mb-2">
                  Make anything. No drawing required.
                </p>
                <p>
                  Panel Haus turns your ideas into comics, memes, and gifs in
                  minutes, with AI doing the heavy lifting. Pick a character,
                  tell a story, and you have something to share. It is the
                  easiest way to go from "I have an idea" to "look what I made,"
                  right from your phone.
                </p>
              </section>

              {/* How to use */}
              <section>
                <SectionLabel>How to use</SectionLabel>
                <p className="font-bold text-accent mb-1">
                  Make a comic in under 10 minutes.
                </p>
                <p className="mb-4">
                  You do not need to draw, and you do not need a plan.
                </p>
                <ol className="space-y-2">
                  {steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary font-bold text-xs">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 p-3 rounded-xl bg-surface-container/80 border border-outline/10">
                  <p>
                    <strong className="text-accent">What "bake" means:</strong>{" "}
                    on mobile, instead of keeping your text as an editable
                    layer, Panel Haus runs another AI pass that draws the words
                    right into the image, so each panel comes out finished and
                    share-ready. Bake last, once the panel art is final.
                  </p>
                </div>
                <p className="mt-3">
                  <strong className="text-accent">Want movement?</strong> Use
                  the GIF Studio to bring your panels to life as an animated
                  GIF, then share that instead of a still.
                </p>
              </section>

              {/* FAQ */}
              <section>
                <SectionLabel>FAQ</SectionLabel>
                <div className="space-y-4">
                  {faqs.map((item) => (
                    <div key={item.q}>
                      <p className="font-bold text-accent">{item.q}</p>
                      <p className="text-accent/70">{item.a}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Full docs */}
              <section>
                <SectionLabel>Full docs</SectionLabel>
                <p className="mb-3">
                  Want the full guide? Visit the docs for everything: the
                  editor, panels and layouts, speech bubbles, AI generation,
                  contests, and more.
                </p>
                <a
                  href={DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-background font-headline font-bold uppercase tracking-wide text-sm hover:opacity-80 transition-opacity active:scale-95 duration-200"
                >
                  Open docs.panelhaus.app
                  <ExternalLink size={16} />
                </a>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
