/**
 * WendyContextButton — "Chiedi a Wendy" floating action button.
 *
 * Place this next to any meaningful UI element. When clicked it:
 *   1. Writes the current page context to WendyPageContext
 *   2. Pre-builds a context-aware prompt from the provided `promptTemplate`
 *   3. Calls `onAskWendy(prompt)` so the parent can open the chat panel
 *      and pre-fill the input.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Example — on RIASEC results page:
 *
 *   <WendyContextButton
 *     pageId="riasec-results"
 *     pageLabel="Risultati RIASEC"
 *     pageData={{ topTypes: ['I','A','E'], scores: { I:85, A:72 } }}
 *     promptTemplate="Guardando i miei risultati RIASEC (tipi: {topTypes}), quali carriere mi consigli?"
 *     onAskWendy={(prompt) => openWendyPanel(prompt)}
 *   />
 *
 * Example — on Career detail page:
 *
 *   <WendyContextButton
 *     pageId="career-detail"
 *     pageLabel="Dettaglio Carriera"
 *     pageData={{ careerName: 'UX Designer', matchScore: 88 }}
 *     promptTemplate="Sto guardando la carriera {careerName} (match {matchScore}%). È adatta al mio profilo?"
 *     onAskWendy={(prompt) => openWendyPanel(prompt)}
 *   />
 */
import React, { useCallback } from "react";
import { useWendyPageContext } from "./WendyPageContext";

export interface WendyContextButtonProps {
  /** Stable page identifier */
  pageId: string;
  /** Shown in button tooltip */
  pageLabel: string;
  /** Data snapshot for this page — injected into prompt + saved to DB */
  pageData: Record<string, unknown>;
  /**
   * Template string for the pre-filled prompt.
   * Use {key} placeholders that match keys in pageData.
   * Example: "Parliamo della carriera {careerName}!"
   */
  promptTemplate: string;
  /** Called with the resolved prompt string when the user clicks */
  onAskWendy: (prompt: string) => void;
  /** Button variant (default: 'pill') */
  variant?: "pill" | "icon" | "inline";
  className?: string;
}

/** Interpolates {key} placeholders with values from `data`. */
function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = data[key];
    if (Array.isArray(val)) return val.join(', ');
    return val != null ? String(val) : `{${key}}`;
  });
}

const VARIANT_STYLES = {
  pill: [
    "inline-flex items-center gap-1.5 rounded-full border border-primary/40",
    "bg-primary/10 hover:bg-primary/20 px-3 py-1 text-xs font-medium text-primary",
    "transition-colors cursor-pointer select-none",
  ].join(" "),
  icon: [
    "flex h-8 w-8 items-center justify-center rounded-full border border-primary/40",
    "bg-primary/10 hover:bg-primary/20 text-primary transition-colors cursor-pointer",
  ].join(" "),
  inline: [
    "inline-flex items-center gap-1 text-xs font-medium text-primary",
    "hover:underline cursor-pointer",
  ].join(" "),
};

export function WendyContextButton({
  pageId,
  pageLabel,
  pageData,
  promptTemplate,
  onAskWendy,
  variant = "pill",
  className = "",
}: WendyContextButtonProps) {
  const { setPageContext } = useWendyPageContext();

  const handleClick = useCallback(() => {
    // 1. Write context so GrowthChatPanel can read it
    setPageContext({ pageId, pageLabel, data: pageData });
    // 2. Build the interpolated prompt
    const prompt = interpolate(promptTemplate, pageData);
    // 3. Delegate to parent (open panel + pre-fill input)
    onAskWendy(prompt);
  }, [pageId, pageLabel, pageData, promptTemplate, onAskWendy, setPageContext]);

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Chiedi a Wendy riguardo: ${pageLabel}`}
      className={[VARIANT_STYLES[variant], className].join(" ")}
      aria-label={`Chiedi a Wendy riguardo: ${pageLabel}`}
    >
      <span aria-hidden>🧠</span>
      {variant !== "icon" && <span>Chiedi a Wendy</span>}
    </button>
  );
}
