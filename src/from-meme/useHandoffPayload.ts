import { useEffect, useRef, useState } from "react";

// Consumes a MemeGen handoff token cross-origin from the browser.
//
// The token store lives on PanelHaus (Upstash Redis). consume is a single-use
// atomic GETDEL, has no secret, and PH serves Access-Control-Allow-Origin: *
// on /api/*, so we can call it directly from Panel Haus Mobile. Because it's single-use, we
// cache the payload to sessionStorage so refresh / back-button / StrictMode
// double-mount don't trigger a second (410) consume.

// Consume goes through our own same-origin serverless proxy (api/handoff-consume),
// which calls panelhaus.app server-to-server. This avoids the cross-origin CORS
// preflight that the upstream consume endpoint rejects (it 405s OPTIONS).
const CONSUME_URL = "/api/handoff-consume";

const CACHE_KEY = "panelshaq_meme_handoff";

export interface HandoffPayload {
  v: number;
  memeImageUrl: string;
  memeImageDimensions: { width: number; height: number };
  memeImageMime: string;
  templateId: string;
  templateLabel: string;
  originUser: string | null;
  createdAt?: string;
}

export type HandoffState =
  | { status: "loading" }
  | { status: "ready"; payload: HandoffPayload; token: string }
  | {
      status: "error";
      kind: "no-token" | "expired" | "network";
      message: string;
    };

// Dev-only stub so the UI can be iterated without a live MemeGen token.
//   /c/from-meme?stub=1                              → Drake template image
//   /c/from-meme?stub=1&template=change-my-mind      → another bundled template
//   /c/from-meme?stub=1&template=drake-hotline-bling&img=<url>&w=&h=
//        → point at ANY image (e.g. a real generated meme Blob) to test alignment
// Bundled template images live in public/templates/ (used by the admin gallery too).
const STUB_TEMPLATES: Record<string, { url: string; w: number; h: number }> = {
  "drake-hotline-bling": {
    url: "/templates/drake-hotline-bling.jpg",
    w: 1200,
    h: 1200,
  },
  "distracted-boyfriend": {
    url: "/templates/distracted-boyfriend.jpg",
    w: 1200,
    h: 800,
  },
  "change-my-mind": { url: "/templates/change-my-mind.jpg", w: 482, h: 361 },
  "two-buttons": { url: "/templates/two-buttons.jpg", w: 600, h: 908 },
};

function buildStubPayload(params: URLSearchParams): HandoffPayload {
  const tpl = params.get("template") || "drake-hotline-bling";
  const known = STUB_TEMPLATES[tpl];
  const imgOverride = params.get("img");
  return {
    v: 1,
    memeImageUrl: imgOverride || known?.url || "/sample.png",
    memeImageDimensions: {
      width: Number(params.get("w")) || known?.w || 1024,
      height: Number(params.get("h")) || known?.h || 1024,
    },
    memeImageMime: "image/jpeg",
    templateId: tpl,
    templateLabel: tpl,
    originUser: "web3:0xstubwallet0000000000000000000000000000",
  };
}

function readCache(token: string): HandoffPayload | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.token === token && parsed?.payload) {
      return parsed.payload as HandoffPayload;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCache(token: string, payload: HandoffPayload) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ token, payload }));
  } catch {
    /* sessionStorage full / unavailable — non-fatal */
  }
}

function isValidPayload(p: unknown): p is HandoffPayload {
  const x = p as HandoffPayload | undefined;
  return !!x && x.v === 1 && typeof x.memeImageUrl === "string";
}

export function useHandoffPayload(): HandoffState {
  const [state, setState] = useState<HandoffState>({ status: "loading" });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return; // guard StrictMode double-invoke
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);

    if (import.meta.env.DEV && params.get("stub")) {
      setState({
        status: "ready",
        payload: buildStubPayload(params),
        token: `stub:${params.get("template") || "drake-hotline-bling"}`,
      });
      return;
    }

    const token = params.get("h");
    if (!token) {
      setState({
        status: "error",
        kind: "no-token",
        message:
          "No meme link found. Make a meme on MemeGen and tap “add text”.",
      });
      return;
    }

    // Cache-first: survives refresh, back-button, and StrictMode remount.
    const cached = readCache(token);
    if (cached) {
      setState({ status: "ready", payload: cached, token });
      return;
    }

    (async () => {
      try {
        const res = await fetch(CONSUME_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (res.status === 410) {
          setState({
            status: "error",
            kind: "expired",
            message: "This meme link has already been used or expired.",
          });
          return;
        }
        if (!res.ok) {
          setState({
            status: "error",
            kind: "network",
            message: `Couldn't load your meme (error ${res.status}).`,
          });
          return;
        }

        const data = await res.json().catch(() => null);
        const payload = data?.payload;
        if (!isValidPayload(payload)) {
          setState({
            status: "error",
            kind: "expired",
            message: "This meme link is invalid or has expired.",
          });
          return;
        }

        writeCache(token, payload);
        setState({ status: "ready", payload, token });
      } catch {
        setState({
          status: "error",
          kind: "network",
          message: "Network error loading your meme. Check your connection.",
        });
      }
    })();
  }, []);

  return state;
}
