/**
 * bussola-spike.tsx — PLACEHOLDER di Fase 1.
 *
 * Gli "Spike" (micro-esperimenti reversibili) sono la Fase 2 della Bussola:
 * richiedono la tabella career_spikes + il backend /api/spikes, non ancora
 * recuperati. Questa pagina evita link rotti da BussolaHome finché la Fase 2
 * non sostituisce questo file con la versione reale (presente su 9c9a450).
 */
import { ArrowLeft, FlaskConical } from "lucide-react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

export default function SpikePlaceholderPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6 text-center">
      <FlaskConical className="mx-auto h-10 w-10 text-primary" />
      <h1 className="text-2xl font-bold">I tuoi Spike</h1>
      <p className="text-muted-foreground">
        Gli <strong>spike</strong> — micro-esperimenti reversibili di un paio di
        settimane per testare una direzione prima di puntarci — arrivano a breve.
      </p>
      <p className="text-sm text-muted-foreground">
        Intanto puoi continuare a far emergere la tua direzione dallo Specchio e
        dal Torneo.
      </p>
      <Link
        href={`${BASE}dashboard`}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
      >
        <ArrowLeft className="h-4 w-4" /> Torna alla Bussola
      </Link>
    </div>
  );
}
