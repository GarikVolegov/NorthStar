/**
 * /affiliazione/dashboard and /affiliate - private C2C referral dashboard.
 */
import { AffiliateDashboard } from "@/components/affiliate/AffiliateDashboard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HandCoins, HeartHandshake } from "lucide-react";
import { Link } from "wouter";

export default function AffiliazioneDashboard() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <nav className="text-xs text-muted-foreground mb-3">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground font-medium">Invita amici</span>
        </nav>

        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <HandCoins className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invita amici</h1>
            <p className="text-muted-foreground text-sm mt-0.5 max-w-2xl">
              Condividi NorthStar con persone che conosci e ricevi il 20% sugli abbonamenti rinnovati dagli amici invitati.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex gap-3 text-sm text-muted-foreground">
        <HeartHandshake className="h-5 w-5 shrink-0 text-primary mt-0.5" />
        <p>
          Le commissioni coprono prima una soglia pari a un mese Premium; tutto quello che supera la soglia diventa ritirabile dal wallet.
        </p>
      </div>

      <ErrorBoundary>
        <AffiliateDashboard />
      </ErrorBoundary>
    </div>
  );
}
