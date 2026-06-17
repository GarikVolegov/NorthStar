/**
 * /chi-sono — il profilo professionale completo dell'utente.
 *
 * Raccoglie TUTTA la profilazione in un posto solo: RIASEC dichiarato (dal test),
 * RIASEC rivelato (dal comportamento, via Bussola), tipi dominanti, settori
 * consigliati, e lo stato della Bussola (stage, blocco, ipotesi, energia).
 */
import { apiFetch } from "@/lib/api-fetch";
import { useCompass } from "@/features/compass/useCompass";
import { UserCircle, Compass, Target, Zap, Sparkles, ArrowRight, FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

const RIASEC: { key: string; label: string; blurb: string }[] = [
  { key: "R", label: "Pratico", blurb: "Fare, costruire, con le mani o gli strumenti" },
  { key: "I", label: "Indagatore", blurb: "Capire, analizzare, risolvere problemi" },
  { key: "A", label: "Creativo", blurb: "Immaginare, esprimere, dare forma" },
  { key: "S", label: "Sociale", blurb: "Aiutare, insegnare, stare con le persone" },
  { key: "E", label: "Intraprendente", blurb: "Guidare, convincere, intraprendere" },
  { key: "C", label: "Metodico", blurb: "Organizzare, ordinare, dare struttura" },
];

interface TestSession {
  id: number;
  primaryTypes: string[] | null;
  riasecScores: Record<string, number> | null;
  recommendations: Array<{ sectorId: number; sectorName: string; matchScore: number }> | null;
  createdAt: string;
}

function RiasecBars({ scores, max = 5 }: { scores: Record<string, number>; max?: number }) {
  return (
    <div className="space-y-2">
      {RIASEC.map(({ key, label, blurb }) => {
        const v = scores[key] ?? 0;
        const pct = Math.max(0, Math.min(100, (v / max) * 100));
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-sm font-medium" title={blurb}>{label}</span>
            <div className="h-2 flex-1 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">{Math.round(pct)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ChiSonoPage() {
  const { profile } = useCompass();
  const [session, setSession] = useState<TestSession | null>(null);
  const [loadingTest, setLoadingTest] = useState(true);

  useEffect(() => {
    void apiFetch(`${BASE}api/test-sessions/history`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: TestSession[]) => setSession(Array.isArray(rows) && rows.length > 0 ? rows[0]! : null))
      .catch(() => setSession(null))
      .finally(() => setLoadingTest(false));
  }, []);

  const declared = session?.riasecScores ?? null;
  const revealed = profile?.revealedRiasec ?? null;
  const hasRevealed = revealed && Object.values(revealed).some((v) => v > 0);
  const openHyp = (profile?.hypotheses ?? []).filter((h) => h.verdict !== "discarded");
  const energizers = profile?.energyProfile?.energizers ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <header className="flex items-center gap-3">
        <UserCircle className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Chi sono</h1>
          <p className="text-sm text-muted-foreground">Tutto il tuo profilo professionale in un posto solo.</p>
        </div>
      </header>

      {/* RIASEC dichiarato (dal test) */}
      <section className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Il tuo profilo RIASEC (dal test)</h2>
        </div>
        {loadingTest ? (
          <p className="text-sm text-muted-foreground">Carico i tuoi risultati…</p>
        ) : declared ? (
          <>
            <RiasecBars scores={declared} />
            {session?.primaryTypes && session.primaryTypes.length > 0 && (
              <p className="mt-3 text-sm">
                Tipi dominanti:{" "}
                {session.primaryTypes.map((t) => {
                  const r = RIASEC.find((x) => x.key === t.charAt(0).toUpperCase());
                  return <span key={t} className="mr-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{r?.label ?? t}</span>;
                })}
              </p>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <p className="text-sm text-muted-foreground">Non hai ancora fatto il test di personalità.</p>
            <Link href={`${BASE}test`} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
              <FlaskConical className="h-4 w-4" /> Fai il test (gratis)
            </Link>
          </div>
        )}
      </section>

      {/* RIASEC rivelato (dal comportamento) */}
      {hasRevealed && (
        <section className="rounded-xl border bg-card p-5">
          <div className="mb-1 flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Verso cosa ti muovi davvero</h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Non quello che dici di volere, ma dove ti spingi: dedotto dal tuo comportamento nella Bussola.
          </p>
          <RiasecBars scores={revealed!} />
        </section>
      )}

      {/* Settori consigliati */}
      {session?.recommendations && session.recommendations.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Settori più affini a te</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {session.recommendations.slice(0, 4).map((rec) => (
              <Link key={rec.sectorId} href={`${BASE}settore/${rec.sectorId}`}>
                <div className="group flex items-center justify-between rounded-lg border bg-card p-3 transition hover:border-primary/50">
                  <span className="text-sm font-medium">{rec.sectorName}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {Math.round(rec.matchScore)}%
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Stato della Bussola */}
      {profile && (
        <section className="rounded-xl border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">La tua direzione</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-muted px-3 py-1">Stage: <span className="font-medium">{profile.stage}</span></span>
            {profile.blockType !== "unknown" && (
              <span className="rounded-full bg-muted px-3 py-1">Blocco: <span className="font-medium">{profile.blockType}</span></span>
            )}
            <span className="rounded-full bg-muted px-3 py-1">{profile.signalCount} segnali</span>
          </div>

          {openHyp.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">Ipotesi di carriera</p>
              <ul className="space-y-1.5">
                {openHyp.map((h) => (
                  <li key={h.clusterId} className="flex items-center justify-between text-sm">
                    <span>{h.label}</span>
                    <span className="text-xs text-muted-foreground">{Math.round(h.confidence * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {energizers.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Zap className="h-4 w-4 text-primary" /> Cosa ti accende</p>
              <div className="flex flex-wrap gap-2">
                {energizers.map((e) => (
                  <span key={e} className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">{e}</span>
                ))}
              </div>
            </div>
          )}

          <Link href={`${BASE}bussola`} className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <Sparkles className="h-4 w-4" /> Continua nella Bussola
          </Link>
        </section>
      )}
    </div>
  );
}
