import { apiFetch } from "@/lib/api-fetch";
import { useCallback, useEffect, useState } from "react";
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

interface NeuralActivation {
  id?: number;
  requestId: string;
  itemKind: string;
  itemRef: string;
  label: string;
  score: number;
  selected: boolean;
  createdAt?: string;
}

interface NeuralEdge {
  id: number;
  sourceItemKind: string;
  sourceItemRef: string;
  targetItemKind: string;
  targetItemRef: string;
  relationType: string;
  weight: number;
  decayScore: number;
  evidenceCount: number;
  status: "candidate" | "active" | "archived";
}

interface NeuralData {
  activations: NeuralActivation[];
  edges: NeuralEdge[];
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function AdminQualityPage() {
  const [adminKey, setAdminKey] = useState(
    () => localStorage.getItem("northstar_admin_key") ?? "",
  );
  const [data, setData] = useState<QualityData | null>(null);
  const [neuralData, setNeuralData] = useState<NeuralData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchQuality = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const auth = { Authorization: `Bearer ${key}` };
      const res = await apiFetch(`${BASE}api/admin/quality`, {
        headers: auth,
      });
      const [recentRes, edgesRes] = await Promise.all([
        apiFetch(`${BASE}api/admin/wendy-brain/neural/recent?limit=20`, {
          headers: auth,
        }),
        apiFetch(`${BASE}api/admin/wendy-brain/neural/edges?status=candidate&limit=20`, {
          headers: auth,
        }),
      ]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as QualityData);
      setNeuralData({
        activations: recentRes.ok ? ((await recentRes.json()) as { activations: NeuralActivation[] }).activations : [],
        edges: edgesRes.ok ? ((await edgesRes.json()) as { edges: NeuralEdge[] }).edges : [],
      });
    } catch (err) {
      console.error("[admin-quality] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const reviewNeuralEdge = useCallback(async (id: number, action: "approve" | "reject") => {
    if (!adminKey) return;
    try {
      const res = await apiFetch(`${BASE}api/admin/wendy-brain/neural/edges/${id}/${action}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchQuality(adminKey);
    } catch (err) {
      console.error("[admin-quality] neural edge review error:", err);
    }
  }, [adminKey, fetchQuality]);

  useEffect(() => {
    if (adminKey) fetchQuality(adminKey);
  }, [adminKey, fetchQuality]);

  if (!adminKey) {
    return (
      <AdminShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              Inserisci la chiave admin per vedere la dashboard qualità.
            </p>
            <input
              type="password"
              placeholder="Admin API Key"
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm"
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
          <h1 className="text-xl font-semibold text-foreground">
            Qualità Wendy
          </h1>
          <button
            onClick={() => fetchQuality(adminKey)}
            disabled={loading}
            className="rounded-lg bg-muted px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            {loading ? "Caricamento..." : "Aggiorna"}
          </button>
        </div>

        {/* Totali */}
        {t && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Totale conversazioni"
              value={t.total.toLocaleString()}
            />
            <StatCard
              label="Eval score medio"
              value={
                t.avgEvalScore ? (t.avgEvalScore * 100).toFixed(0) + "%" : "N/D"
              }
            />
            <StatCard
              label="Supervisor score medio"
              value={
                t.avgSupervisorScore
                  ? (t.avgSupervisorScore * 100).toFixed(0) + "%"
                  : "N/D"
              }
            />
            <StatCard
              label="Rewrite rate"
              value={
                t.total > 0
                  ? `${((t.rewrites / t.total) * 100).toFixed(1)}%`
                  : "0%"
              }
              sub={`${t.rewrites} riscritte`}
            />
            <StatCard
              label="Chiarificazioni"
              value={
                t.total > 0
                  ? `${((t.clarifications / t.total) * 100).toFixed(1)}%`
                  : "0%"
              }
              sub={`${t.clarifications} richieste`}
            />
            <StatCard
              label="UI tools usati"
              value={String(t.uiTools)}
              sub={`${t.total > 0 ? ((t.uiTools / t.total) * 100).toFixed(1) : 0}% dei turni`}
            />
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border text-sm font-medium text-foreground">
              Wendy Neural - attivazioni recenti
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {(neuralData?.activations ?? []).length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={3}>
                        Nessuna attivazione neurale registrata.
                      </td>
                    </tr>
                  ) : (
                    (neuralData?.activations ?? []).slice(0, 10).map((item, idx) => (
                      <tr key={`${item.requestId}-${item.itemRef}-${idx}`} className="border-b border-border hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{item.label}</div>
                          <div className="max-w-[320px] truncate text-xs text-muted-foreground">{item.itemRef}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{item.itemKind}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {(item.score * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border text-sm font-medium text-foreground">
              Wendy Neural - edge candidati
            </div>
            <div className="divide-y divide-border">
              {(neuralData?.edges ?? []).length === 0 ? (
                <div className="px-4 py-4 text-sm text-muted-foreground">
                  Nessun edge candidato da revisionare.
                </div>
              ) : (
                (neuralData?.edges ?? []).slice(0, 8).map((edge) => (
                  <div key={edge.id} className="p-4">
                    <div className="text-sm font-medium text-foreground">
                      {edge.sourceItemKind} {"->"} {edge.targetItemKind}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <span className="block truncate">{edge.sourceItemRef}</span>
                      <span className="block truncate">{edge.targetItemRef}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">
                        peso {(edge.weight * edge.decayScore * 100).toFixed(0)}% · evidenze {edge.evidenceCount}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => reviewNeuralEdge(edge.id, "reject")}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                        >
                          Archivia
                        </button>
                        <button
                          onClick={() => reviewNeuralEdge(edge.id, "approve")}
                          className="rounded-lg bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                        >
                          Approva
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Per dominio */}
        {data?.qualityStats && data.qualityStats.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border text-sm font-medium text-foreground">
              Metriche per dominio
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground uppercase">
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
                    <tr
                      key={s.domain}
                      className="border-b border-border hover:bg-muted/50"
                    >
                      <td className="px-4 py-3 font-medium text-foreground capitalize">
                        {s.domain}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {s.total}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {(s.avgEvalScore * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {s.avgSupervisorScore
                          ? `${(s.avgSupervisorScore * 100).toFixed(0)}%`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            s.rewrites > 0
                              ? "text-warning font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          {s.rewrites} (
                          {((s.rewrites / Math.max(s.total, 1)) * 100).toFixed(
                            0,
                          )}
                          %)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            s.clarifications > 0
                              ? "text-info font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          {s.clarifications}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            s.uiTools > 0
                              ? "text-success font-medium"
                              : "text-muted-foreground"
                          }
                        >
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
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border text-sm font-medium text-foreground">
              Supervisor — score prima/dopo rewrite
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                    <th className="px-4 py-3 text-left">Dominio</th>
                    <th className="px-4 py-3 text-right">Rewrite totali</th>
                    <th className="px-4 py-3 text-right">
                      Score prima (media)
                    </th>
                    <th className="px-4 py-3 text-right">Score dopo (media)</th>
                    <th className="px-4 py-3 text-right">Miglioramento</th>
                  </tr>
                </thead>
                <tbody>
                  {data.supervisorStats.map((s) => {
                    const improvement =
                      s.avgScoreAfter && s.avgScoreBefore
                        ? ((s.avgScoreAfter - s.avgScoreBefore) * 100).toFixed(
                            1,
                          )
                        : "—";
                    const isPositive =
                      s.avgScoreAfter && s.avgScoreAfter > s.avgScoreBefore;
                    return (
                      <tr
                        key={s.domain}
                        className="border-b border-border hover:bg-muted/50"
                      >
                        <td className="px-4 py-3 font-medium text-foreground capitalize">
                          {s.domain}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {s.total}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {s.avgScoreBefore
                            ? `${(s.avgScoreBefore * 100).toFixed(0)}%`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {s.avgScoreAfter
                            ? `${(s.avgScoreAfter * 100).toFixed(0)}%`
                            : "—"}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-medium ${isPositive ? "text-success" : "text-danger"}`}
                        >
                          {improvement !== "—"
                            ? `${isPositive ? "+" : ""}${improvement}%`
                            : improvement}
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
          <div className="text-center py-12 text-muted-foreground">
            Caricamento dati qualità...
          </div>
        )}
      </div>
    </AdminShell>
  );
}
