import { useState, useEffect, useCallback } from "react";
import { AdminShell } from "../components/AdminShell";

const BASE = import.meta.env.BASE_URL || "/";

interface DomainQuality {
  domain: string;
  total: number;
  avgEvalScore: number;
  avgSupervisorScore: number;
  rewrites: number;
  clarifications: number;
  uiTools: number;
}

interface SupervisorStat {
  domain: string;
  total: number;
  avgScoreBefore: number;
  avgScoreAfter: number;
}

interface QualityData {
  supervisorStats: SupervisorStat[];
  qualityStats: DomainQuality[];
  totals: {
    total: number;
    avgEvalScore: number;
    avgSupervisorScore: number;
    rewrites: number;
    clarifications: number;
    uiTools: number;
  };
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

export default function AdminQualityPage() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("northstar_admin_key") ?? "");
  const [data, setData] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchQuality = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/admin/quality`, {
        headers: { "x-admin-key": key },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as QualityData);
    } catch (err) {
      console.error("[admin-quality] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminKey) fetchQuality(adminKey);
  }, [adminKey, fetchQuality]);

  if (!adminKey) {
    return (
      <AdminShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <p className="text-gray-500">Inserisci la chiave admin per vedere la dashboard qualità.</p>
            <input
              type="password"
              placeholder="Admin API Key"
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = (e.target as HTMLInputElement).value;
                  localStorage.setItem("northstar_admin_key", val);
                  setAdminKey(val);
                }
              }}
            />
          </div>
        </div>
      </AdminShell>
    );
  }

  const t = data?.totals;

  return (
    <AdminShell>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Qualità Wendy
          </h1>
          <button
            onClick={() => fetchQuality(adminKey)}
            disabled={loading}
            className="rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Caricamento..." : "Aggiorna"}
          </button>
        </div>

        {/* Totali */}
        {t && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Totale conversazioni" value={t.total.toLocaleString()} />
            <StatCard label="Eval score medio" value={t.avgEvalScore ? (t.avgEvalScore * 100).toFixed(0) + "%" : "N/D"} />
            <StatCard label="Supervisor score medio" value={t.avgSupervisorScore ? (t.avgSupervisorScore * 100).toFixed(0) + "%" : "N/D"} />
            <StatCard label="Rewrite rate" value={t.total > 0 ? `${((t.rewrites / t.total) * 100).toFixed(1)}%` : "0%"} sub={`${t.rewrites} riscritte`} />
            <StatCard label="Chiarificazioni" value={t.total > 0 ? `${((t.clarifications / t.total) * 100).toFixed(1)}%` : "0%"} sub={`${t.clarifications} richieste`} />
            <StatCard label="UI tools usati" value={String(t.uiTools)} sub={`${t.total > 0 ? ((t.uiTools / t.total) * 100).toFixed(1) : 0}% dei turni`} />
          </div>
        )}

        {/* Per dominio */}
        {data?.qualityStats && data.qualityStats.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300">
              Metriche per dominio
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <th className="px-4 py-3 text-left">Dominio</th>
                    <th className="px-4 py-3 text-right">Turni</th>
                    <th className="px-4 py-3 text-right">Eval score</th>
                    <th className="px-4 py-3 text-right">Supervisor</th>
                    <th className="px-4 py-3 text-right">Rewrite</th>
                    <th className="px-4 py-3 text-right">Chiarif.</th>
                    <th className="px-4 py-3 text-right">UI tool</th>
                  </tr>
                </thead>
                <tbody>
                  {data.qualityStats.map((s) => (
                    <tr key={s.domain} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 capitalize">{s.domain}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{s.total}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{(s.avgEvalScore * 100).toFixed(0)}%</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{s.avgSupervisorScore ? `${(s.avgSupervisorScore * 100).toFixed(0)}%` : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={s.rewrites > 0 ? "text-amber-500 font-medium" : "text-gray-400"}>
                          {s.rewrites} ({(s.rewrites / Math.max(s.total, 1) * 100).toFixed(0)}%)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={s.clarifications > 0 ? "text-blue-500 font-medium" : "text-gray-400"}>
                          {s.clarifications}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={s.uiTools > 0 ? "text-green-500 font-medium" : "text-gray-400"}>
                          {s.uiTools}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Supervisor stats */}
        {data?.supervisorStats && data.supervisorStats.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300">
              Supervisor — score prima/dopo rewrite
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <th className="px-4 py-3 text-left">Dominio</th>
                    <th className="px-4 py-3 text-right">Rewrite totali</th>
                    <th className="px-4 py-3 text-right">Score prima (media)</th>
                    <th className="px-4 py-3 text-right">Score dopo (media)</th>
                    <th className="px-4 py-3 text-right">Miglioramento</th>
                  </tr>
                </thead>
                <tbody>
                  {data.supervisorStats.map((s) => {
                    const improvement = s.avgScoreAfter && s.avgScoreBefore
                      ? ((s.avgScoreAfter - s.avgScoreBefore) * 100).toFixed(1)
                      : "—";
                    const isPositive = s.avgScoreAfter && s.avgScoreAfter > s.avgScoreBefore;
                    return (
                      <tr key={s.domain} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 capitalize">{s.domain}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{s.total}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{s.avgScoreBefore ? `${(s.avgScoreBefore * 100).toFixed(0)}%` : "—"}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{s.avgScoreAfter ? `${(s.avgScoreAfter * 100).toFixed(0)}%` : "—"}</td>
                        <td className={`px-4 py-3 text-right font-medium ${isPositive ? "text-green-500" : "text-red-400"}`}>
                          {improvement !== "—" ? `${isPositive ? "+" : ""}${improvement}%` : improvement}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!data && loading && (
          <div className="text-center py-12 text-gray-400">Caricamento dati qualità...</div>
        )}
      </div>
    </AdminShell>
  );
}
