// DEV-ONLY mock of the <haus-switcher> web component.
//
// The real component is served from https://panelhaus.app/embed/hausbar.js
// (owned by another team, not live yet). This stub lets us verify placement,
// sizing, and the full-screen drawer locally. It is loaded ONLY under
// import.meta.env.DEV (see main.tsx) and is never part of a prod build.
//
// It is intentionally a rough approximation — the real switcher's exact links
// and styling live in the upstream embed. Remove nothing here for prod; the
// dev guard already keeps it out.

const SIBLINGS = [
  {
    key: "universe",
    label: "Panel Haus Universe",
    href: "https://panelhaus.app/universe",
  },
  {
    key: "panelhaus",
    label: "Panelhaus (Desktop)",
    href: "https://panelhaus.app",
  },
  {
    key: "shaq",
    label: "Panel Haus Mobile",
    href: "https://m.panelhaus.app",
  },
  { key: "memes", label: "MemeGen", href: "https://memegen.panelhaus.app" },
];

class HausSwitcherMock extends HTMLElement {
  connectedCallback() {
    const current = this.getAttribute("current") || "";
    const root = this.attachShadow({ mode: "open" });

    root.innerHTML = `
      <style>
        :host { display: inline-flex; align-items: center; gap: 8px; font-family: "Space Grotesk", system-ui, sans-serif; }
        button.trigger {
          display: inline-flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border: 0; border-radius: 9px; cursor: pointer;
          background: rgba(255,145,0,0.12); color: #ff9100; font-size: 18px; line-height: 1;
          transition: background .15s, transform .15s;
        }
        button.trigger:hover { background: rgba(255,145,0,0.22); }
        button.trigger:active { transform: scale(.9); }
        a.logo {
          font-weight: 800; font-style: italic; text-transform: uppercase; letter-spacing: -.04em;
          font-size: 15px; color: #ff9100; text-decoration: none; white-space: nowrap;
        }
        a.logo .dot { font-size: 8px; opacity: .5; }
        .mock-badge {
          font-size: 7px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
          color: #ff9100; opacity: .5; border: 1px solid rgba(255,145,0,.3); border-radius: 4px; padding: 1px 3px;
        }
        /* full-screen drawer */
        .scrim {
          position: fixed; inset: 0; z-index: 9999; background: rgba(5,10,22,.85);
          backdrop-filter: blur(6px); display: none; flex-direction: column; padding: 24px;
        }
        .scrim[open] { display: flex; }
        .scrim header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
        .scrim h2 { color: #ff9100; font-weight: 800; font-style: italic; text-transform: uppercase; margin: 0; font-size: 20px; }
        .scrim button.close { background: none; border: 0; color: #c8e6c9; font-size: 26px; cursor: pointer; }
        .grid { display: grid; gap: 12px; }
        .grid a {
          display: flex; align-items: center; gap: 12px; padding: 18px; border-radius: 14px;
          background: rgba(255,255,255,.04); color: #FFF3D2; text-decoration: none; font-weight: 700;
          text-transform: uppercase; letter-spacing: .04em; font-size: 14px;
        }
        .grid a[aria-current="true"] { background: rgba(255,145,0,.18); color: #ff9100; }
        .grid a:hover { background: rgba(255,145,0,.1); }
      </style>

      <button class="trigger" part="trigger" aria-label="Switch Panel Haus app" title="Switch app (mock)">⊞</button>
      <a class="logo" href="https://panelhaus.app/universe" target="_blank" rel="noopener noreferrer">
        PANELHAUS<span class="dot">.app</span>
      </a>
      <span class="mock-badge">mock</span>

      <div class="scrim" role="dialog" aria-modal="true" aria-label="Panel Haus apps">
        <header>
          <h2>Panel Haus</h2>
          <button class="close" aria-label="Close">×</button>
        </header>
        <div class="grid">
          ${SIBLINGS.map(
            (s) =>
              `<a href="${s.href}" target="_blank" rel="noopener noreferrer"${
                s.key === current ? ' aria-current="true"' : ""
              }>${s.label}${s.key === current ? " — you are here" : ""}</a>`,
          ).join("")}
        </div>
      </div>
    `;

    const scrim = root.querySelector<HTMLDivElement>(".scrim")!;
    root
      .querySelector(".trigger")!
      .addEventListener("click", () => scrim.setAttribute("open", ""));
    root
      .querySelector(".close")!
      .addEventListener("click", () => scrim.removeAttribute("open"));
    scrim.addEventListener("click", (e) => {
      if (e.target === scrim) scrim.removeAttribute("open");
    });
  }
}

if (!customElements.get("haus-switcher")) {
  customElements.define("haus-switcher", HausSwitcherMock);
}
