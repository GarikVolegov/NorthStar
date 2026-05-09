/**
 * /affiliazione/dashboard — Pagina riservata agli utenti loggati
 * FRONTEND_RULES.md: lazy-loaded, ProtectedRoute wrappata in App.tsx
 */
import { AffiliateDashboard } from '@/components/affiliate/AffiliateDashboard';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function AffiliazioneDashboard() {
  return (
    <section className="container max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <nav className="text-xs text-muted-foreground mb-3">
          <span>Home</span>
          <span className="mx-1.5">›</span>
          <span>Affiliazione</span>
          <span className="mx-1.5">›</span>
          <span className="text-foreground font-medium">Dashboard</span>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight">La tua dashboard affiliazione</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitora guadagni, referral e richiedi il ritiro dei tuoi compensi.
        </p>
      </div>

      {/* Dashboard con ErrorBoundary locale — non fa crashare la pagina intera */}
      <ErrorBoundary>
        <AffiliateDashboard />
      </ErrorBoundary>
    </section>
  );
}
