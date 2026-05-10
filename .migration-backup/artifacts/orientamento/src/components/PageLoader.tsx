/**
 * PageLoader — skeleton anatomico usato come fallback Suspense per tutte le pagine.
 *
 * Struttura:
 *   • Barra superiore (simula la pill della navbar, già montata — nascosta)
 *   • Hero card (blocco principale above-the-fold)
 *   • Grid 3 card (sezione sotto l'hero, comune alla maggior parte delle pagine)
 *
 * Usa classi Tailwind + animate-pulse (già nel progetto).
 * Rispetta prefers-reduced-motion: con motion ridotta mostra le card
 * senza pulsazione, solo come placeholder statici.
 */
export function PageLoader() {
  return (
    <div
      className="w-full max-w-4xl mx-auto px-4 pt-6 pb-16 space-y-6"
      role="status"
      aria-label="Caricamento pagina"
      aria-busy="true"
    >
      {/* Hero card skeleton */}
      <div className="animate-pulse rounded-2xl bg-muted/40 border border-border/50 p-6 space-y-4">
        {/* Badge/tag */}
        <div className="h-5 w-20 rounded-full bg-muted/70" />
        {/* Titolo */}
        <div className="space-y-2">
          <div className="h-7 w-2/3 rounded-lg bg-muted/70" />
          <div className="h-7 w-1/2 rounded-lg bg-muted/60" />
        </div>
        {/* Sottotitolo */}
        <div className="space-y-1.5">
          <div className="h-4 w-full rounded bg-muted/50" />
          <div className="h-4 w-5/6 rounded bg-muted/50" />
          <div className="h-4 w-4/6 rounded bg-muted/40" />
        </div>
        {/* CTA button */}
        <div className="h-10 w-36 rounded-full bg-muted/60" />
      </div>

      {/* Grid 3 card skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl bg-muted/40 border border-border/50 p-4 space-y-3"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {/* Icona */}
            <div className="h-8 w-8 rounded-lg bg-muted/70" />
            {/* Label */}
            <div className="h-4 w-3/4 rounded bg-muted/60" />
            {/* Body */}
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded bg-muted/50" />
              <div className="h-3 w-5/6 rounded bg-muted/40" />
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">Caricamento in corso…</span>
    </div>
  );
}

export default PageLoader;
