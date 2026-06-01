import { and, eq } from "drizzle-orm";
import { db, discoverySourcesTable } from "@workspace/db";

export type NewsProviderStatus =
  | "ready"
  | "degraded"
  | "never_run"
  | "stale"
  | "not_configured"
  | "unavailable";

export type NewsRefreshAction =
  | "wait_for_next_refresh"
  | "wait_for_startup_pipeline"
  | "check_provider_keys"
  | "configure_sources"
  | "retry_later";

export type NewsProviderDiagnostics = {
  status: NewsProviderStatus;
  providerStatus: NewsProviderStatus;
  lastAttemptAt: string | null;
  lastFetchAt: string | null;
  enabledSources: number;
  sourcesWithErrors: number;
  totalFetched: number;
  stalenessMs: number | null;
  refreshAction: NewsRefreshAction;
  nextAction: NewsRefreshAction;
  actionLabel: string;
  message: string;
  lastError?: string | null;
  lastRefreshError?: string;
};

const NEWS_PROVIDER_STALE_MS = 12 * 60 * 60 * 1000;

const ACTION_LABELS: Record<NewsRefreshAction, string> = {
  wait_for_next_refresh: "Attendi prossimo refresh",
  wait_for_startup_pipeline: "Avvia pipeline news",
  check_provider_keys: "Controlla chiavi provider",
  configure_sources: "Configura fonti news",
  retry_later: "Riprova piu tardi",
};

function diagnostic(input: {
  providerStatus: NewsProviderStatus;
  lastAttemptAt: Date | null;
  enabledSources: number;
  sourcesWithErrors: number;
  totalFetched: number;
  refreshAction: NewsRefreshAction;
  message: string;
  lastError?: string | null;
}): NewsProviderDiagnostics {
  const lastFetchAt = input.lastAttemptAt?.toISOString() ?? null;
  const stalenessMs = input.lastAttemptAt
    ? Math.max(0, Date.now() - input.lastAttemptAt.getTime())
    : null;

  return {
    status: input.providerStatus,
    providerStatus: input.providerStatus,
    lastAttemptAt: lastFetchAt,
    lastFetchAt,
    enabledSources: input.enabledSources,
    sourcesWithErrors: input.sourcesWithErrors,
    totalFetched: input.totalFetched,
    stalenessMs,
    refreshAction: input.refreshAction,
    nextAction: input.refreshAction,
    actionLabel: ACTION_LABELS[input.refreshAction],
    message: input.message,
    ...(input.lastError ? { lastError: input.lastError } : {}),
  };
}

export async function buildNewsProviderDiagnostics(): Promise<NewsProviderDiagnostics> {
  try {
    const rows = await db
      .select({
        name: discoverySourcesTable.name,
        sourceType: discoverySourcesTable.sourceType,
        enabled: discoverySourcesTable.enabled,
        lastFetchAt: discoverySourcesTable.lastFetchAt,
        lastError: discoverySourcesTable.lastError,
        totalFetched: discoverySourcesTable.totalFetched,
      })
      .from(discoverySourcesTable)
      .where(and(
        eq(discoverySourcesTable.itemType, "news"),
        eq(discoverySourcesTable.enabled, true),
      ))
      .limit(50);

    const enabledSources = rows.length;
    const sourcesWithErrors = rows.filter((row) => Boolean(row.lastError?.trim())).length;
    const totalFetched = rows.reduce((sum, row) => sum + (Number(row.totalFetched) || 0), 0);
    const lastAttempt = rows
      .map((row) => row.lastFetchAt)
      .filter((date): date is Date => date instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const lastError = rows.find((row) => row.lastError?.trim())?.lastError?.trim() ?? null;

    if (enabledSources === 0) {
      return diagnostic({
        providerStatus: "not_configured",
        lastAttemptAt: null,
        enabledSources,
        sourcesWithErrors,
        totalFetched,
        refreshAction: "configure_sources",
        message: "Nessuna fonte news attiva: configura GNews, Tavily o feed RSS dalla console admin.",
      });
    }

    if (sourcesWithErrors > 0) {
      return diagnostic({
        providerStatus: "degraded",
        lastAttemptAt: lastAttempt,
        enabledSources,
        sourcesWithErrors,
        totalFetched,
        refreshAction: "check_provider_keys",
        message: "Alcune fonti news hanno segnalato errori: controlla chiavi provider, rate limit o URL sorgente.",
        lastError,
      });
    }

    if (!lastAttempt) {
      return diagnostic({
        providerStatus: "never_run",
        lastAttemptAt: null,
        enabledSources,
        sourcesWithErrors,
        totalFetched,
        refreshAction: "wait_for_startup_pipeline",
        message: "Le fonti news sono configurate, ma la pipeline non ha ancora registrato un fetch.",
      });
    }

    const stale = Date.now() - lastAttempt.getTime() > NEWS_PROVIDER_STALE_MS;
    if (stale) {
      return diagnostic({
        providerStatus: "stale",
        lastAttemptAt: lastAttempt,
        enabledSources,
        sourcesWithErrors,
        totalFetched,
        refreshAction: "retry_later",
        message: "La pipeline news non aggiorna da diverse ore: verifica cron e provider se il feed resta fermo.",
      });
    }

    return diagnostic({
      providerStatus: "ready",
      lastAttemptAt: lastAttempt,
      enabledSources,
      sourcesWithErrors,
      totalFetched,
      refreshAction: "wait_for_next_refresh",
      message: "Le fonti news risultano attive; il feed si aggiornera al prossimo ciclo utile.",
    });
  } catch {
    return diagnostic({
      providerStatus: "unavailable",
      lastAttemptAt: null,
      enabledSources: 0,
      sourcesWithErrors: 0,
      totalFetched: 0,
      refreshAction: "retry_later",
      message: "Non riesco a leggere lo stato delle fonti news in questo momento.",
    });
  }
}
