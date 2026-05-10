/**
 * AdminRecentItems — tabella degli ultimi item raccolti.
 *
 * Colonne:
 *   - Tipo (badge colorato)
 *   - Titolo (cliccabile, apre URL)
 *   - Fonte (collectorSource)
 *   - Enriched (badge verde / grigio)
 *   - Score
 *   - Data
 *
 * Features:
 *   - Filtro per collectorSource
 *   - Filtro per isEnriched
 *   - Sort per data (default: desc)
 */
import React, { useState, useMemo } from "react";
import type { AdminItem } from "./useAdminData";

interface Props {
  items:     AdminItem[];
  isLoading: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  news:         "bg-blue-100 text-blue-700",
  opportunity:  "bg-green-100 text-green-700",
  formation:    "bg-purple-100 text-purple-700",
  growth:       "bg-amber-100 text-amber-700",
  sector_trend: "bg-rose-100 text-rose-700",
};

export const AdminRecentItems: React.FC<Props> = ({ items, isLoading }) => {
  const [sourceFilter,   setSourceFilter]   = useState("all");
  const [enrichedFilter, setEnrichedFilter] = useState<"all" | "yes" | "no">("all");

  const sources = useMemo(() => {
    const s = new Set(items.map((i) => i.collectorSource));
    return ["all", ...Array.from(s).sort()];
  }, [items]);

  const filtered = useMemo(() => items.filter((item) => {
    if (sourceFilter !== "all" && item.collectorSource !== sourceFilter) return false;
    if (enrichedFilter === "yes" && !item.isEnriched) return false;
    if (enrichedFilter === "no"  &&  item.isEnriched) return false;
    return true;
  }), [items, sourceFilter, enrichedFilter]);

  return (
    <div className="rounded-2xl border bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-gray-900">📝 Item recenti</h2>
          <p className="text-xs text-gray-400">Ultimi 20 item raccolti dal sistema</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Source filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {sources.map((s) => <option key={s} value={s}>{s === "all" ? "Tutte le fonti" : s}</option>)}
          </select>
          {/* Enriched filter */}
          <select
            value={enrichedFilter}
            onChange={(e) => setEnrichedFilter(e.target.value as "all" | "yes" | "no")}
            className="rounded-lg border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="all">Tutti</option>
            <option value="yes">✨ Arricchiti</option>
            <option value="no">⏳ Raw</option>
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">Nessun item trovato con questi filtri.</p>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 border-b">
                <th className="pb-2 pr-3 font-medium">Tipo</th>
                <th className="pb-2 pr-3 font-medium">Titolo</th>
                <th className="pb-2 pr-3 font-medium">Fonte</th>
                <th className="pb-2 pr-3 font-medium">GPT</th>
                <th className="pb-2 pr-3 font-medium">Score</th>
                <th className="pb-2 font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition">
                  <td className="py-2 pr-3">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${TYPE_COLORS[item.type] ?? "bg-gray-100 text-gray-600"}`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="py-2 pr-3 max-w-xs">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-800 hover:text-indigo-600 line-clamp-1 transition"
                    >
                      {item.title}
                    </a>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="text-gray-400 font-mono">{item.collectorSource}</span>
                  </td>
                  <td className="py-2 pr-3">
                    {item.isEnriched
                      ? <span className="text-green-600">✨ sì</span>
                      : <span className="text-gray-300">⏳ raw</span>}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="text-gray-500">{(item.relevanceScore ?? 0).toFixed(2)}</span>
                  </td>
                  <td className="py-2">
                    <span className="text-gray-400">
                      {item.publishedAt
                        ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(new Date(item.publishedAt))
                        : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
