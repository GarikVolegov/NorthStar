import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { arrayRecords, fmtDuration, recordValue, stringList } from "./utils";

export function AgentLaunchResult({
  agentKey,
  pipelineKey,
  result,
}: {
  agentKey?: string;
  pipelineKey?: string;
  result: { ok: boolean; data: Record<string, unknown> };
}) {
  const key = pipelineKey ?? agentKey ?? "";
  const data = result.data;
  const isRunning =
    data.status === "running..." ||
    data.status === "running" ||
    data.status === "in_progress";
  const warnings = stringList(data.warnings);
  const collector = recordValue(data.collector);
  const enricher = recordValue(data.enricher);
  const publisher = recordValue(data.publisher);
  const created = arrayRecords(data.created);
  const missingCoverage = arrayRecords(publisher.missingCoverage);
  const sourceDiagnostics = arrayRecords(data.sourceDiagnostics);
  const topics = stringList(data.topics);
  const hasWarnings = warnings.length > 0;
  const tone = isRunning
    ? "border-info-muted bg-info-surface text-info"
    : !result.ok
    ? "border-danger-muted bg-danger-surface text-danger"
    : hasWarnings
      ? "border-warning-muted bg-warning-surface text-warning"
      : "border-success-muted bg-success-surface text-success";

  const headline = isRunning
    ? "Pipeline in esecuzione"
    : !result.ok
    ? "Run fallita"
    : hasWarnings
      ? "Run completata con warning"
      : "Run completata";

  if (isRunning) {
    return (
      <div className={cn("rounded-lg border p-3 text-sm", tone)}>
        <p className="font-semibold">{headline}</p>
        <p className="mt-1 text-xs opacity-80">
          Sto aspettando il risultato finale della pipeline.
        </p>
      </div>
    );
  }

  const metrics =
    key === "news-publishing" || key === "news-research"
      ? [
          ["Run ID", data.runId],
          ["Controllati", data.checked],
          ["News pubblicate", data.added],
          ["Collector raccolti", collector.totalCollected],
          ["Collector inseriti", collector.totalInserted],
          ["Enriched", enricher.enriched],
          ["Publisher trasferiti", publisher.transferred],
          ["Coverage mancante", missingCoverage.length],
        ]
      : key === "growth-research-review" || key === "growth-research"
        ? [
            ["Run ID", data.runId],
            ["Fonti tentate", data.attempted],
            ["Bozze create", data.added],
            ["Topic", topics.length],
          ]
        : key === "market-refresh"
          ? [
              ["Run ID", data.runId],
              ["Snapshot creati", data.snapshotsInserted],
              ["Snapshot aggiornati", data.snapshotsUpdated],
            ]
        : [
            ["Run ID", data.runId],
            ["Processati", data.processed],
            [
              "Creati",
              data.created ??
                data.added ??
                data.sectorsDone ??
                data.professionsDone,
            ],
            [
              "Durata",
              typeof data.durationMs === "number"
                ? fmtDuration(data.durationMs)
                : null,
            ],
          ];

  return (
    <div className={cn("rounded-lg border p-3 text-sm", tone)}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{headline}</p>
        {data.runId != null && (
          <span className="rounded bg-background/60 px-2 py-1 text-xs font-mono">
            #{String(data.runId)}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {metrics
          .filter(([, value]) => value != null && value !== "")
          .map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-md bg-background/60 p-2"
            >
              <p className="text-[11px] opacity-75">{String(label)}</p>
              <p className="font-semibold">{String(value)}</p>
            </div>
          ))}
      </div>

      {(key === "growth-research-review" || key === "growth-research") && topics.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold">Topic ricercati</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {topics.slice(0, 5).map((topic) => (
              <Badge key={topic} variant="outline" className="bg-background/60">
                {topic}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {(key === "growth-research-review" || key === "growth-research") && created.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold">Articoli creati</p>
          <div className="mt-1 space-y-1">
            {created.slice(0, 3).map((article, index) => (
              <p key={String(article.id ?? index)} className="text-xs">
                {String(
                  article.title ?? `Articolo #${article.id ?? index + 1}`,
                )}
              </p>
            ))}
          </div>
        </div>
      )}

      {(key === "news-publishing" || key === "news-research") && missingCoverage.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold">
            Settori senza abbastanza news reali
          </p>
          <div className="mt-1 space-y-1">
            {missingCoverage.slice(0, 5).map((item, index) => (
              <p key={String(item.sectorId ?? index)} className="text-xs">
                {String(
                  item.sectorName ?? `Settore #${item.sectorId ?? index + 1}`,
                )}
                : {String(item.realArticles ?? 0)} reali, ne mancano{" "}
                {String(item.needed ?? 0)}
              </p>
            ))}
          </div>
        </div>
      )}

      {(key === "news-publishing" || key === "news-research") && sourceDiagnostics.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold">Fonti news</p>
          <div className="mt-2 space-y-2">
            {sourceDiagnostics.map((source) => (
              <div
                key={String(source.key ?? source.label)}
                className="rounded-md border bg-background/60 p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">
                    {String(source.label ?? source.key ?? "Fonte")}
                  </span>
                  <Badge variant="outline" className="text-[11px]">
                    {String(source.status ?? "unknown")}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] opacity-75">
                  Raccolti: {String(source.collected ?? 0)}
                </p>
                {source.action != null && (
                  <p className="mt-1 text-xs">{String(source.action)}</p>
                )}
                {source.lastError != null && (
                  <p className="mt-1 break-words text-[11px] opacity-75">
                    {String(source.lastError)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mt-3 rounded-md border border-warning-muted bg-warning-surface p-2 text-warning">
          <p className="text-xs font-semibold">Warning</p>
          <ul className="mt-1 list-disc pl-4 text-xs">
            {warnings.slice(0, 4).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {!result.ok && data.error != null && (
        <p className="mt-3 break-words text-xs font-medium">
          {String(data.error)}
        </p>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium">
          Dati tecnici
        </summary>
        <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-background/70 p-2 text-[11px]">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
