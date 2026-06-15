import { useEffect, useRef, useState } from "react";
import { MEME_TEXT_ZONES } from "../data/memeTextZones";

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
//   /c/from-meme?stub=1&template=uno-draw-25-cards   → ANY template in the registry
//   /c/from-meme?stub=1&template=drake-hotline-bling&img=<url>&w=&h=
//        → point at ANY image (e.g. a real generated meme Blob) to test alignment
// The template image + aspect come from the MEME_TEXT_ZONES registry (the single
// source of truth), so every calibrated template works in the stub with no extra
// per-template config. Bundled images live in public/templates/.
function buildStubPayload(params: URLSearchParams): HandoffPayload {
  const tpl = params.get("template") || "drake-hotline-bling";
  const entry = MEME_TEXT_ZONES[tpl];
  const imgOverride = params.get("img");
  // Zones are normalized, so only the aspect matters; synthesize w/h from it.
  const aspect = entry?.aspect || 1;
  const stubW = 1024;
  const stubH = Math.round(stubW / aspect);
  return {
    v: 1,
    memeImageUrl:
      imgOverride || (entry ? `/templates/${entry.image}` : "/sample.png"),
    memeImageDimensions: {
      width: Number(params.get("w")) || stubW,
      height: Number(params.get("h")) || stubH,
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
