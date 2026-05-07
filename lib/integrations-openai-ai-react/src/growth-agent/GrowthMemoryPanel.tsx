/**
 * GrowthMemoryPanel — displays the user's persistent coach memory.
 *
 * LAYOUT
 * ──────
 * Header: "La tua memoria" + [Aggiorna] button
 *
 * Desktop: table with columns:
 *   Tipo | Contenuto | Confidence | Ultimo visto
 *
 * Mobile (<640px): card list
 *
 * ROWS
 * ─────
 *  Fact row:    📬 blue badge · key: value · "X conferme" · timestamp
 *  Pattern row: 🧠 purple badge · description · confidence bar + % · timestamp
 *
 * CONFIDENCE BADGE COLORS
 * ───────────────────────
 *  >= 0.80  green   (alta)
 *  >= 0.65  amber   (media)
 *  <  0.65  gray    (bassa)
 *
 * USAGE
 * ──────
 *  <GrowthMemoryPanel token={jwt} />
 */
import React from "react";
import { useGrowthMemory, type MemoryFact, type MemoryPattern } from "./useGrowthMemory";

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1)  return "adesso";
  if (mins < 60) return `${mins} min fa`;
  if (hours < 24) return `${hours} ${hours === 1 ? "ora" : "ore"} fa`;
  if (days === 1) return "ieri";
  if (days < 30)  return `${days} giorni fa`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.80 ? "bg-emerald-500" :
    value >= 0.65 ? "bg-amber-400"  : "bg-gray-300";
  const label =
    value >= 0.80 ? "text-emerald-700" :
    value >= 0.65 ? "text-amber-700"   : "text-gray-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-medium tabular-nums ${label}`}>{pct}%</span>
    </div>
  );
}

const PATTERN_TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  limiting_belief:   { label: "Credenza limitante", emoji: "🚫", color: "bg-red-50 text-red-700 border-red-200" },
  strength:          { label: "Punto di forza",     emoji: "⭐",    color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  recurring_theme:   { label: "Tema ricorrente",    emoji: "🔄",    color: "bg-blue-50 text-blue-700 border-blue-200" },
  emotional_trigger: { label: "Trigger emotivo",    emoji: "⚡",    color: "bg-amber-50 text-amber-700 border-amber-200" },
  growth_edge:       { label: "Margine di crescita",emoji: "🌱",    color: "bg-purple-50 text-purple-700 border-purple-200" },
};

// ── Skeleton loader ───────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {["w-24", "w-48", "w-20", "w-16"].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className={`h-3 ${w} bg-gray-100 rounded`} />
        </td>
      ))}
    </tr>
  );
}

// ── Fact row ────────────────────────────────────────────────────────────────────

function FactRow({ fact }: { fact: MemoryFact }) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
      {/* Tipo */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          📬 Fatto
        </span>
      </td>

      {/* Contenuto */}
      <td className="px-4 py-3 text-sm text-gray-800">
        <span className="font-medium text-gray-500 mr-1">{fact.key}:</span>
        {fact.value}
      </td>

      {/* Confidence — facts use confirmedCount instead of a 0-1 score */}
      <td className="px-4 py-3">
        <span className="text-xs text-gray-500">
          {fact.confirmedCount} {fact.confirmedCount === 1 ? "conferma" : "conferme"}
        </span>
      </td>

      {/* Ultimo visto */}
      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
        {relativeTime(fact.updatedAt)}
      </td>
    </tr>
  );
}

// ── Pattern row ────────────────────────────────────────────────────────────────

function PatternRow({ pattern }: { pattern: MemoryPattern }) {
  const meta = PATTERN_TYPE_LABELS[pattern.patternType] ?? {
    label: pattern.patternType,
    emoji: "🧠",
    color: "bg-gray-50 text-gray-700 border-gray-200",
  };

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
      {/* Tipo */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}
        >
          {meta.emoji} {meta.label}
        </span>
      </td>

      {/* Contenuto */}
      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
        {pattern.description}
      </td>

      {/* Confidence bar */}
      <td className="px-4 py-3 min-w-[120px]">
        <ConfidenceBar value={pattern.confidence} />
      </td>

      {/* Ultimo visto */}
      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
        {relativeTime(pattern.updatedAt)}
        <span className="block text-gray-300">
          {pattern.observedCount}x osservato
        </span>
      </td>
    </tr>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────

interface GrowthMemoryPanelProps {
  token: string;
  apiBase?: string;
  className?: string;
}

export function GrowthMemoryPanel({ token, apiBase, className = "" }: GrowthMemoryPanelProps) {
  const { facts, patterns, isLoading, error, refresh } = useGrowthMemory({ token, apiBase });

  const isEmpty = !isLoading && facts.length === 0 && patterns.length === 0;
  const totalRows = facts.length + patterns.length;

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-base font-semibold text-gray-800">La tua memoria</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {isLoading ? "Caricamento…" : `${totalRows} ${totalRows === 1 ? "elemento" : "elementi"} memorizzati`}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 transition-all"
          title="Aggiorna"
        >
          <svg
            className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Aggiorna
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
          ⚠️ {error}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
            <span className="text-2xl">🧠</span>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Nessuna memoria ancora</p>
          <p className="text-xs text-gray-400 max-w-xs">
            Parla con il coach per iniziare a costruire il tuo profilo.
            Dopo 2+ messaggi il sistema estrae fatti e pattern automaticamente.
          </p>
        </div>
      )}

      {/* Table — desktop */}
      {!isEmpty && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {["Tipo", "Contenuto", "Confidence", "Ultimo visto"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                : (
                  <>
                    {facts.map((f) => <FactRow key={`f-${f.id}`} fact={f} />)}
                    {patterns.map((p) => <PatternRow key={`p-${p.id}`} pattern={p} />)}
                  </>
                )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
