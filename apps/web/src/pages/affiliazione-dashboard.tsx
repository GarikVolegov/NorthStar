/**
 * /affiliazione/dashboard — B2B Dashboard per il percorso Azienda
 * Unifica: affiliazione, reclutamento, analisi mercato
 */
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { Building2, TrendingUp, Users, BarChart3, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectorFreshnessBadge } from "@/components/sector/SectorFreshnessBadge";
import { AffiliateDashboard } from "@/components/affiliate/AffiliateDashboard";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function AffiliazioneDashboard() {
  const { user } = useAuth();
  const journeyType = user?.journeyType;
  const isAzienda = journeyType === "azienda";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

      {/* ── Header B2B ──────────────────────────── */}
      <div>
        <nav className="text-xs text-muted-foreground mb-3">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <span className="mx-1.5">›</span>
          {isAzienda && (
            <>
              <Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
              <span className="mx-1.5">›</span>
            </>
          )}
          <span className="text-foreground font-medium">Area B2B</span>
        </nav>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isAzienda ? "La tua area aziendale" : "Dashboard affiliazione"}
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {isAzienda
                  ? "Recluta, analizza il mercato e monitora le tue inserzioni"
                  : "Monitora guadagni, referral e richiedi il ritiro dei tuoi compensi"}
              </p>
            </div>
          </div>

          {!isAzienda && (
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href="/percorso">
                <Sparkles className="w-4 h-4 mr-1.5" /> Attiva profilo azienda
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* ── Stats B2B ───────────────────────────── */}
      {isAzienda && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Users className="h-4 w-4" />
                Profili esplorati
              </div>
              <p className="text-2xl font-bold">21</p>
              <p className="text-xs text-muted-foreground mt-0.5">28 settori disponibili</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <BarChart3 className="h-4 w-4" />
                Settori analizzati
              </div>
              <p className="text-2xl font-bold">28</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                con <SectorFreshnessBadge className="inline-flex" />
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="h-4 w-4" />
                Crescita media settori
              </div>
              <p className="text-2xl font-bold text-growth">+4.2%</p>
              <p className="text-xs text-muted-foreground mt-0.5">Dato mercato italiano</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Quick Actions ────────────────────────── */}
      {isAzienda && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/settori">
            <div className="group rounded-2xl border border-border bg-card p-5 flex items-center gap-4 hover:border-primary/30 transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground text-sm">Esplora profili personalità</p>
                <p className="text-xs text-muted-foreground mt-0.5">Trova i candidati ideali per ogni settore</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
          <Link href="/news">
            <div className="group rounded-2xl border border-border bg-card p-5 flex items-center gap-4 hover:border-primary/30 transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground text-sm">Tendenze mercato</p>
                <p className="text-xs text-muted-foreground mt-0.5">Notizie e trend HR del mercato del lavoro</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
        </div>
      )}

      {/* ── Affiliate Dashboard ──────────────────── */}
      <div>
        {isAzienda && (
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Programma affiliazione</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}
        <ErrorBoundary>
          <AffiliateDashboard />
        </ErrorBoundary>
      </div>

    </div>
  );
}
