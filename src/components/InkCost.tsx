import { useInkCosts } from "../services/inkCosts";

function readSettings(): { geminiApiKey: string; imageModel: "flash" | "pro" } {
  try {
    const s = JSON.parse(localStorage.getItem("panelshaq_settings") || "{}");
    return {
      geminiApiKey: s.geminiApiKey || "",
      imageModel: s.imageModel === "pro" ? "pro" : "flash",
    };
  } catch {
    return { geminiApiKey: "", imageModel: "flash" };
  }
}

// Inline cost badge shown on AI action buttons: "⚡N" for the action, or "Free"
// when the user is on BYOK (own key → no deduction). Image cost follows the
// selected model (flash/pro). Color is inherited from the parent button.
// Black outline so the orange ⚡ emoji stays legible on the orange/gradient buttons.
const OUTLINE = {
  textShadow:
    "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 2px #000",
};

export function InkCost({
  kind,
  suffix = "",
  outlined = false,
  className = "",
}: {
  kind: "text" | "image";
  /** Appended after the number (not shown for BYOK), e.g. "/ea" for batch actions. */
  suffix?: string;
  /** Add a black outline so the ⚡ stays visible on colored/gradient buttons. */
  outlined?: boolean;
  className?: string;
}) {
  const costs = useInkCosts();
  const { geminiApiKey, imageModel } = readSettings();

  if (geminiApiKey) {
    return (
      <span
        className={`text-[10px] font-bold uppercase opacity-70 ${className}`}
      >
        Free
      </span>
    );
  }

  const n =
    kind === "image"
      ? imageModel === "pro"
        ? costs.imagePro
        : costs.imageFlash
      : costs.text;

  return (
    <span
      className={`text-[11px] font-bold tabular-nums ${className}`}
      title={`Costs ${n} ink${suffix ? " per image" : ""}`}
      aria-label={`Costs ${n} ink${suffix ? " per image" : ""}`}
    >
      <span style={outlined ? OUTLINE : undefined}>⚡</span>
      {n}
      {suffix}
    </span>
  );
}
