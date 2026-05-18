import {
  BarChart3,
  CheckCircle2,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PersistenceWarningBanner } from "./shared";
import type { WendyQualityOverview } from "./types";
import { fmtDuration, fmtPct, fmtScore, fmtShortDate } from "./utils";

type QualitySectionProps = {
  data: WendyQualityOverview | null;
  loading: boolean;
  days: string;
  onDaysChange: (days: string) => void;
  onRefresh: () => void;
  onOpenStatus: () => void;
};

export function QualitySection({
  data,
  loading,
  days,
  onDaysChange,
  onRefresh,
  onOpenStatus,
}: QualitySectionProps) {
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-serif font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Qualita Wendy
          </h3>
          <p className="text-sm text-muted-foreground">
            Score, rewrite, chiarificazioni, tool e conversazioni da rivedere.
          </p>
          {data?.generatedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Snapshot: {fmtShortDate(data.generatedAt)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={days}
            onChange={(event) => onDaysChange(event.target.value)}
            className="min-h-11 text-sm border rounded-lg px-3 bg-background"
            aria-label="Periodo qualita Wendy"
          >
            <option value="7">Ultimi 7 giorni</option>
            <option value="30">Ultimi 30 giorni</option>
          </select>
          <Button variant="outline" onClick={onRefresh} disabled={loading} className="min-h-11">
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Riprova
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="h-28 rounded-xl border bg-card animate-pulse" />
          ))}
        </div>
      ) : !data ? (
        <div className="p-10 text-center text-muted-foreground border rounded-xl bg-muted/20">
          Nessun dato qualita disponibile.
        </div>
      ) : (
        <>
          <PersistenceWarningBanner
            meta={data}
            title="Metriche qualita non affidabili"
            onRetry={onRefresh}
            onOpenStatus={onOpenStatus}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {[
              {
                label: "Score qualita",
                value: fmtScore(data.summary.avgEvalScore ?? data.summary.avgSupervisorScore),
                detail: `${data.summary.total.toLocaleString("it-IT")} turni`,
                icon: CheckCircle2,
              },
              {
                label: "Rewrite rate",
                value: fmtPct(data.summary.rewriteRate),
                detail: `${data.summary.rewrites} rewrite`,
                icon: RotateCcw,
              },
              {
                label: "Chiarificazioni",
                value: fmtPct(data.summary.clarificationRate),
                detail: `${data.summary.clarifications} richieste`,
                icon: MessageCircle,
              },
              {
                label: "Uso tool",
                value: fmtPct(data.summary.toolUsageRate),
                detail: `${data.summary.uiTools} turni con tool`,
                icon: Terminal,
              },
              {
                label: "Feedback negativo",
                value: fmtPct(data.summary.negativeFeedbackRate),
                detail: `${data.summary.negativeFeedback}/${data.summary.feedbackTotal} feedback`,
                icon: ShieldAlert,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="border rounded-xl p-4 bg-card">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold mt-2">{item.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.detail}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="border rounded-xl bg-card p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold">Alert qualita</p>
                  <p className="text-xs text-muted-foreground">Soglie calcolate in tempo reale</p>
                </div>
                <Badge variant={data.alerts.length > 0 ? "destructive" : "secondary"}>
                  {data.alerts.length} alert
                </Badge>
              </div>
              {data.alerts.length === 0 ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-800">
                  Nessun alert: Wendy e stabile nel periodo selezionato.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.alerts.slice(0, 6).map((alert) => (
                    <div
                      key={`${alert.title}-${alert.domain ?? "global"}`}
                      className={cn(
                        "rounded-lg border p-3",
                        alert.level === "critical"
                          ? "bg-red-50 border-red-200 text-red-900"
                          : "bg-amber-50 border-amber-200 text-amber-900",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold">{alert.title}</p>
                        <Badge variant="outline" className="capitalize bg-background/70">
                          {alert.level}
                        </Badge>
                      </div>
                      <p className="text-xs mt-1">{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border rounded-xl bg-card p-4">
              <p className="font-semibold mb-3">Motivi rewrite</p>
              {data.rewriteReasons.length === 0 ? (
                <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
                  Nessun motivo rewrite registrato.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.rewriteReasons.slice(0, 6).map((reason) => (
                    <div key={reason.reason} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                      <p className="text-sm break-words">{reason.reason}</p>
                      <Badge variant="outline" className="shrink-0">{reason.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border rounded-xl bg-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="font-semibold">Trend nel tempo</p>
                <p className="text-xs text-muted-foreground">Score, rewrite, chiarificazioni e latenza giornaliera</p>
              </div>
              <Badge variant="outline">{data.trends.length} giorni</Badge>
            </div>
            {data.trends.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground bg-muted/30 rounded-lg">
                Nessun trend disponibile nel periodo.
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {data.trends.slice(-9).map((day) => (
                  <div key={day.day} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {new Date(day.day).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                      </p>
                      <span className="text-xs text-muted-foreground">{day.total} turni</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <span>Score <strong>{fmtScore(day.avgEvalScore ?? day.avgSupervisorScore)}</strong></span>
                      <span>Rewrite <strong>{fmtPct(day.rewriteRate)}</strong></span>
                      <span>Chiarif. <strong>{fmtPct(day.clarificationRate)}</strong></span>
                      <span>Latenza <strong>{day.avgLatencyMs ? fmtDuration(day.avgLatencyMs) : "N/D"}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="border rounded-xl bg-card p-4">
              <p className="font-semibold mb-3">Domini deboli</p>
              {data.domains.length === 0 ? (
                <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
                  Nessun dominio misurato nel periodo.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.domains.slice(0, 8).map((domain) => (
                    <div key={domain.domain} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-sm capitalize truncate">{domain.domain}</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize",
                            domain.status === "healthy" && "bg-emerald-50 text-emerald-700",
                            domain.status === "attention" && "bg-amber-50 text-amber-700",
                            domain.status === "critical" && "bg-red-50 text-red-700",
                          )}
                        >
                          {domain.status}
                        </Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span>Score {fmtScore(domain.avgEvalScore ?? domain.avgSupervisorScore)}</span>
                        <span>{domain.total} turni</span>
                        <span>Rewrite {fmtPct(domain.rewriteRate)}</span>
                        <span>Tool {fmtPct(domain.toolUsageRate)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border rounded-xl bg-card p-4">
              <p className="font-semibold mb-3">Conversazioni problematiche</p>
              {data.problemConversations.length === 0 ? (
                <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
                  Nessuna conversazione problematica nel periodo.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.problemConversations.slice(0, 8).map((item) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.domain} / {item.intent}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Sessione #{item.sessionId ?? "N/D"} - {fmtShortDate(item.createdAt)}
                          </p>
                        </div>
                        <Badge variant={item.source === "feedback" ? "destructive" : "outline"} className="shrink-0">
                          {item.score != null ? fmtScore(item.score) : "feedback"}
                        </Badge>
                      </div>
                      <p className="text-xs mt-2 text-muted-foreground break-words">{item.snippet}</p>
                      {item.reason && (
                        <p className="text-xs mt-2 text-amber-700 break-words">Motivo: {item.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
