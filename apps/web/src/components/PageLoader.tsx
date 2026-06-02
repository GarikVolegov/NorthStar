import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { useTranslation } from "react-i18next";

/**
 * PageLoader - skeleton anatomico usato come fallback Suspense per tutte le pagine.
 *
 * Struttura:
 * - Hero card above-the-fold
 * - Grid 3 card, comune alla maggior parte delle pagine
 *
 * Usa classi Tailwind + animate-pulse gia' nel progetto.
 */
export function PageLoader() {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "it").slice(0, 2);
  const statusLabel = useDynamicTranslation({
    locale,
    key: "pageLoader.status",
    source: "Caricamento pagina",
    context: "Accessible label for the full-page loading skeleton",
  });
  const srOnlyLabel = useDynamicTranslation({
    locale,
    key: "pageLoader.srOnly",
    source: "Caricamento in corso...",
    context: "Screen-reader only text while a page is loading",
  });

  return (
    <div
      className="w-full max-w-4xl mx-auto px-4 pt-6 pb-16 space-y-6"
      role="status"
      aria-label={statusLabel}
      aria-busy="true"
    >
      <div className="animate-pulse rounded-2xl bg-muted/40 border border-border/50 p-6 space-y-4">
        <div className="h-5 w-20 rounded-full bg-muted/70" />
        <div className="space-y-2">
          <div className="h-7 w-2/3 rounded-lg bg-muted/70" />
          <div className="h-7 w-1/2 rounded-lg bg-muted/60" />
        </div>
        <div className="space-y-1.5">
          <div className="h-4 w-full rounded bg-muted/50" />
          <div className="h-4 w-5/6 rounded bg-muted/50" />
          <div className="h-4 w-4/6 rounded bg-muted/40" />
        </div>
        <div className="h-10 w-36 rounded-full bg-muted/60" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl bg-muted/40 border border-border/50 p-4 space-y-3"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="h-8 w-8 rounded-lg bg-muted/70" />
            <div className="h-4 w-3/4 rounded bg-muted/60" />
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded bg-muted/50" />
              <div className="h-3 w-5/6 rounded bg-muted/40" />
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">{srOnlyLabel}</span>
    </div>
  );
}

export default PageLoader;
