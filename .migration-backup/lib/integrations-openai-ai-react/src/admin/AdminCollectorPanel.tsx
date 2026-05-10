/**
 * AdminCollectorPanel — pannello per lanciare manualmente il collector
 * e visualizzare i risultati dell'ultimo run.
 *
 * Sezioni:
 *   - Bottone "Lancia Collector"
 *   - Progress indicator durante il run
 *   - Risultato: totalCollected, totalInserted, durationMs
 *   - BySource breakdown: barra per ogni fonte
 *   - Errori (se presenti)
 */
import React from "react";
import type { CollectorStats } from "./useAdminData";

interface Props {
  stats:      CollectorStats | null;
  isRunning:  boolean;
  onTrigger:  () => void;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const AdminCollectorPanel: React.FC<Props> = ({ stats, isRunning, onTrigger }) => {
  const maxItems = stats ? Math.max(...Object.values(stats.bySource), 1) : 1;

  return (
    <div className="rounded-2xl border bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900">⚡️ Collector</h2>
          <p className="text-xs text-gray-400">Raccoglie contenuti da tutte le fonti RSS</p>
        </div>
        <button
          onClick={onTrigger}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition"
        >
          {isRunning ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              In esecuzione...
            </>
          ) : (
            <>▶ Lancia ora</>
          )}
        </button>
      </div>

      {/* Running indicator */}
      {isRunning && (
        <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-indigo-700">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Raccolta in corso da tutte le fonti...
          </div>
          <div className="mt-2 w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      )}

      {/* Last run result */}
      {stats && !isRunning && (
        <div className="space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Raccolti",  value: stats.totalCollected, color: "text-indigo-600" },
              { label: "Inseriti",  value: stats.totalInserted,  color: "text-green-600" },
              { label: "Durata",    value: formatMs(stats.durationMs), color: "text-gray-700" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-gray-50 p-3 text-center">
                <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>

          {/* By source breakdown */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Item per fonte</p>
            <div className="space-y-1.5">
              {Object.entries(stats.bySource)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count]) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500 w-32 truncate font-mono">{name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-indigo-400 rounded-full transition-all"
                        style={{ width: `${(count / maxItems) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-gray-600 w-8 text-right font-medium">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Errors */}
          {stats.errors.length > 0 && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">⚠️ Errori ({stats.errors.length})</p>
              <ul className="space-y-0.5">
                {stats.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-600 font-mono">{err}</li>
                ))}
              </ul>
            </div>
          )}

          {stats.ranAt && (
            <p className="text-[10px] text-gray-300 text-right">
              Eseguito il {new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(stats.ranAt))}
            </p>
          )}
        </div>
      )}

      {!stats && !isRunning && (
        <p className="text-sm text-gray-400 text-center py-4">
          Nessun run manuale questa sessione. Il collector gira automaticamente ogni 6 ore.
        </p>
      )}
    </div>
  );
};
