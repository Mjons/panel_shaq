import { useCallback, useMemo, useRef, useState } from "react";

// P7 — hold-to-talk. Client-only via the Web Speech API (no server, no ink). It
// needs a secure context + mic permission and isn't in every browser (notably
// flaky inside wallet in-app webviews), so it's FEATURE-DETECTED: the mic button
// only renders when `supported` is true. onText receives the running transcript
// so the composer fills in live as the user speaks; they review before sending.

// The Web Speech types aren't in the default TS lib, so this uses `any` on the
// SpeechRecognition surface deliberately.
function getSR(): any {
  if (typeof window === "undefined") return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

export function useVoiceInput(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const supported = useMemo(
    () => !!getSR() && typeof window !== "undefined" && !!window.isSecureContext,
    [],
  );

  const start = useCallback(() => {
    if (!supported || recRef.current) return;
    const SR = getSR();
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++)
        t += e.results[i][0]?.transcript ?? "";
      onText(t);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    rec.onerror = () => {
      setListening(false);
      recRef.current = null;
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      setListening(false);
    }
  }, [supported, onText]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  return { supported, listening, start, stop };
}
