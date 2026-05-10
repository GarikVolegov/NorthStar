/**
 * RiasecProfileCard — Passo 2 del profilo NorthStar.
 *
 * Mostra il risultato RIASEC dell'utente:
 *  - Radar chart SVG puro (6 assi, no librerie esterne)
 *  - Top-3 tipi con emoji, nome, descrizione breve
 *  - Settori consigliati con barra match %
 *  - Badge "test vecchio" se > 90 giorni
 *  - CTA "Rifai il test"
 *  - Stato vuoto se nessun test completato
 *
 * Props:
 *   token      JWT
 *   apiBase    default '/api'
 *   onRetake   callback per navigare al test
 *   className
 */
import React, { useEffect, useState } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

export interface RiasecResult {
  riasecScores:   Record<string, number>; // { R: 12, I: 8, A: 15, ... }
  primaryTypes:   string[];               // ['A', 'R', 'I']
  profileSummary: string;
  recommendations: Array<{
    sectorId:    number;
    sectorName:  string;
    matchScore:  number;
    matchReason: string;
  }>;
  dominantSpirit: string;
  createdAt:      string; // ISO
}

// ── RIASEC meta-data ───────────────────────────────────────────────────────────

const RIASEC_META: Record<string, { label: string; emoji: string; color: string; description: string }> = {
  R: {
    label:       "Realistico",
    emoji:       "🔧",
    color:       "#f97316", // orange-500
    description: "Ami lavorare con le mani, strumenti, macchine. Pratico e concreto.",
  },
  I: {
    label:       "Investigativo",
    emoji:       "🔬",
    color:       "#6366f1", // indigo-500
    description: "Ami analizzare, ricercare e risolvere problemi complessi.",
  },
  A: {
    label:       "Artistico",
    emoji:       "🎨",
    color:       "#ec4899", // pink-500
    description: "Espressivo, creativo, ami idee originali e ambienti flessibili.",
  },
  S: {
    label:       "Sociale",
    emoji:       "🤝",
    color:       "#22c55e", // green-500
    description: "Ti piace aiutare, insegnare, lavorare con le persone.",
  },
  E: {
    label:       "Intraprendente",
    emoji:       "🚀",
    color:       "#eab308", // yellow-500
    description: "Leadership, persuasione, obiettivi ambiziosi e risultati.",
  },
  C: {
    label:       "Convenzionale",
    emoji:       "📊",
    color:       "#14b8a6", // teal-500
    description: "Ami ordine, precisione, dati, sistemi e procedure chiare.",
  },
};

const RIASEC_ORDER = ["R", "I", "A", "S", "E", "C"];

// ── SVG Radar Chart ──────────────────────────────────────────────────────────────

function RadarChart({ scores }: { scores: Record<string, number> }) {
  const SIZE   = 200;
  const CENTER = SIZE / 2;
  const RADIUS = 78;
  const keys   = RIASEC_ORDER;
  const n      = keys.length;
  const max    = Math.max(...Object.values(scores), 1);

  // Angle: start from top (-90°), go clockwise
  function angle(i: number) { return (i / n) * 2 * Math.PI - Math.PI / 2; }
  function point(i: number, r: number) {
    return { x: CENTER + r * Math.cos(angle(i)), y: CENTER + r * Math.sin(angle(i)) };
  }

  // Grid rings (3 levels: 33%, 66%, 100%)
  const rings = [0.33, 0.66, 1].map((pct) =>
    keys.map((_, i) => point(i, RADIUS * pct)).map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z"
  );

  // Axis lines
  const axes = keys.map((_, i) => ({ from: { x: CENTER, y: CENTER }, to: point(i, RADIUS) }));

  // Data polygon
  const dataPoints = keys.map((k, i) => {
    const val = scores[k] ?? 0;
    return point(i, (val / max) * RADIUS);
  });
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE} height={SIZE}
      aria-label="Grafico RIASEC"
      className="overflow-visible"
    >
      {/* Grid rings */}
      {rings.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#e5e7eb" strokeWidth={0.8} />
      ))}

      {/* Axis lines */}
      {axes.map((ax, i) => (
        <line
          key={i}
          x1={ax.from.x} y1={ax.from.y}
          x2={ax.to.x}   y2={ax.to.y}
          stroke="#e5e7eb" strokeWidth={0.8}
        />
      ))}

      {/* Data filled polygon */}
      <path d={dataPath} fill="#6366f1" fillOpacity={0.25} stroke="#6366f1" strokeWidth={1.5} strokeLinejoin="round" />

      {/* Data dot on each axis */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#6366f1" />
      ))}

      {/* Labels outside */}
      {keys.map((k, i) => {
        const meta = RIASEC_META[k]!;
        const lp   = point(i, RADIUS + 18);
        return (
          <text
            key={k}
            x={lp.x} y={lp.y}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fontWeight={600}
            fill={meta.color}
          >
            {k}
          </text>
        );
      })}
    </svg>
  );
}

// ── Match bar ────────────────────────────────────────────────────────────────────────

function MatchBar({ score, label }: { score: number; label: string }) {
  const pct = Math.min(Math.round(score), 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium truncate max-w-[70%]">{label}</span>
        <span className="font-semibold text-primary">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Staleness badge ─────────────────────────────────────────────────────────────────

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

// ── Main component ───────────────────────────────────────────────────────────────

export interface RiasecProfileCardProps {
  token:      string;
  apiBase?:   string;
  onRetake?:  () => void;
  className?: string;
}

export function RiasecProfileCard({
  token,
  apiBase = "/api",
  onRetake,
  className = "",
}: RiasecProfileCardProps) {
  const [result,  setResult]  = useState<RiasecResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/users/me/riasec`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 404) { setResult(null); setLoading(false); return; }
        if (!res.ok) throw new Error(await res.text());
        setResult(await res.json() as RiasecResult);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore");
      } finally { setLoading(false); }
    })();
  }, [token, apiBase]);

  // ── Loading
  if (loading) return (
    <div className="flex h-40 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  // ── Error
  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
  );

  // ── Empty state
  if (!result) return (
    <div className={`rounded-xl border border-dashed border-border p-8 text-center ${className}`}>
      <p className="text-3xl mb-3">🧭</p>
      <p className="text-sm font-medium">Nessun test completato</p>
      <p className="text-xs text-muted-foreground mt-1 mb-4">
        Completa il test RIASEC per scoprire il tuo profilo professionale
      </p>
      {onRetake && (
        <button
          onClick={onRetake}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Inizia il test →
        </button>
      )}
    </div>
  );

  const days     = daysSince(result.createdAt);
  const isStale  = days > 90;
  const top3     = result.primaryTypes.slice(0, 3);
  const topRecs  = result.recommendations.slice(0, 4);

  return (
    <div className={`space-y-5 ${className}`}>

      {/* Header + staleness */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Il tuo profilo RIASEC</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Test completato {days === 0 ? "oggi" : `${days} giorni fa`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isStale && (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-medium text-amber-700">
              ⚠️ Potrebbe essere datato
            </span>
          )}
          {onRetake && (
            <button
              onClick={onRetake}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              Rifai il test
            </button>
          )}
        </div>
      </div>

      {/* Radar + Top-3 */}
      <div className="flex flex-col sm:flex-row items-center gap-6">

        {/* Radar chart */}
        <div className="flex-shrink-0">
          <RadarChart scores={result.riasecScores} />
        </div>

        {/* Top-3 type cards */}
        <div className="flex-1 w-full space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">I tuoi 3 tipi dominanti</p>
          {top3.map((key, rank) => {
            const meta = RIASEC_META[key];
            if (!meta) return null;
            return (
              <div
                key={key}
                className="flex items-center gap-3 rounded-xl border border-border p-3"
                style={{ borderLeftWidth: 3, borderLeftColor: meta.color }}
              >
                <span className="text-xl flex-shrink-0">{meta.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold" style={{ color: meta.color }}>{key}</span>
                    <span className="text-xs font-semibold">{meta.label}</span>
                    {rank === 0 && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0 text-[9px] font-semibold text-primary">#1</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{meta.description}</p>
                </div>
                <span className="text-lg font-bold tabular-nums flex-shrink-0" style={{ color: meta.color }}>
                  {result.riasecScores[key] ?? 0}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Profile summary */}
      {result.profileSummary && (
        <div className="rounded-xl bg-muted/50 px-4 py-3">
          <p className="text-xs font-medium mb-1">🧠 La tua sintesi</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{result.profileSummary}</p>
        </div>
      )}

      {/* Sector recommendations */}
      {topRecs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Settori consigliati
          </p>
          {topRecs.map((rec) => (
            <div key={rec.sectorId}>
              <MatchBar score={rec.matchScore} label={rec.sectorName} />
              {rec.matchReason && (
                <p className="text-[10px] text-muted-foreground mt-0.5 ml-0.5">{rec.matchReason}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Spirit type */}
      {result.dominantSpirit && (
        <div className="flex items-center gap-2 rounded-xl border border-border px-4 py-3">
          <span className="text-lg">✨</span>
          <div>
            <p className="text-xs text-muted-foreground">Spirit type</p>
            <p className="text-sm font-semibold capitalize">{result.dominantSpirit}</p>
          </div>
        </div>
      )}
    </div>
  );
}
