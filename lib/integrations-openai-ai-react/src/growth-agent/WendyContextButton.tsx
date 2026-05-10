/**
 * WendyContextButton v2 — saves PageContextSnapshot on click.
 *
 * CHANGES vs v1:
 * - Accepts `token` prop to call usePageContextSnapshot and persist
 *   every contextual click to the DB for analytics.
 * - Token is optional: if omitted, snapshot saving is silently skipped.
 *
 * All other behaviour unchanged.
 */
import React, { useCallback } from "react";
import { useWendyPageContext }     from "./WendyPageContext";
import { usePageContextSnapshot } from "./usePageContextSnapshot";

export interface WendyContextButtonProps {
  pageId: string;
  pageLabel: string;
  pageData: Record<string, unknown>;
  promptTemplate: string;
  onAskWendy: (prompt: string) => void;
  /** JWT token — used to persist the snapshot; optional */
  token?: string;
  variant?: "pill" | "icon" | "inline";
  className?: string;
}

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
  token,
  variant = "pill",
  className = "",
}: WendyContextButtonProps) {
  const { setPageContext }            = useWendyPageContext();
  const { save: saveSnapshot }        = usePageContextSnapshot(token ?? "");

  const handleClick = useCallback(() => {
    const prompt = interpolate(promptTemplate, pageData);

    // 1. Update global context (GrowthChatPanel reads this)
    setPageContext({ pageId, pageLabel, data: pageData });

    // 2. Persist snapshot for analytics (fire-and-forget, only if token provided)
    if (token) saveSnapshot({ pageId, pageData, promptUsed: prompt });

    // 3. Open panel + pre-fill prompt
    onAskWendy(prompt);
  }, [pageId, pageLabel, pageData, promptTemplate, onAskWendy, token, setPageContext, saveSnapshot]);

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
