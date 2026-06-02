import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { cn } from "@/lib/utils";
import { AlertCircle, Bell, BellOff, Bookmark, BookmarkCheck, Clock, ExternalLink, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import {
  CATEGORY_CONFIG,
  diagnosticTone,
  timeAgoLabel,
  type NewsFeedResponse,
  type NewsItem,
} from "./newsModels";

const DIAGNOSTIC_ACTION_LABELS: Record<NonNullable<NewsFeedResponse["diagnostics"]>["refreshAction"], string> = {
  wait_for_next_refresh: "Aggiornamento automatico in arrivo",
  wait_for_startup_pipeline: "Pipeline in avvio",
  check_provider_keys: "Controlla chiavi e limiti provider",
  configure_sources: "Configura le fonti news",
  retry_later: "Riprova tra poco",
};

const DIAGNOSTIC_STATUS_LABELS: Record<NonNullable<NewsFeedResponse["diagnostics"]>["providerStatus"], string> = {
  ready: "Fonti operative",
  degraded: "Fonti degradate",
  never_run: "Mai eseguito",
  stale: "Feed fermo",
  not_configured: "Fonti da configurare",
  unavailable: "Stato non disponibile",
};

function useNewsDynamicText(locale: string, key: string, source: string, context = "News UI copy") {
  return useDynamicTranslation({ locale, key, source, context });
}

function CategoryFallbackImage({ category, emoji, title, label }: { category: string; emoji: string; title: string; label: string }) {
  const config = CATEGORY_CONFIG.find((c) => c.id === category);
  return (
    <div
      className={`aspect-video bg-gradient-to-br ${config?.gradient ?? "from-muted to-muted/50"} flex items-center justify-center`}
      role="img"
      aria-label={`${label}: ${title}`}
    >
      <span className="text-4xl opacity-60" aria-hidden="true">{emoji}</span>
    </div>
  );
}

export function NewsDiagnosticsPanel({ diagnostics }: { diagnostics: NonNullable<NewsFeedResponse["diagnostics"]> }) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "it";
  const tone = diagnosticTone(diagnostics.providerStatus);
  const statusLabel = useNewsDynamicText(locale, `news.diagnostics.status.${diagnostics.providerStatus}`, DIAGNOSTIC_STATUS_LABELS[diagnostics.providerStatus]);
  const actionLabel = useNewsDynamicText(locale, `news.diagnostics.${diagnostics.refreshAction}`, DIAGNOSTIC_ACTION_LABELS[diagnostics.refreshAction]);
  const message = useNewsDynamicText(
    locale,
    "news.diagnostics.message",
    diagnostics.message,
    "News provider diagnostic message shown when the feed has issues",
  );
  const enabledSourcesLabel = useNewsDynamicText(locale, "news.diagnostics.enabledSources", "Fonti attive");
  const sourcesWithErrorsLabel = useNewsDynamicText(locale, "news.diagnostics.sourcesWithErrors", "Con errori");
  const lastAttemptLabel = useNewsDynamicText(locale, "news.diagnostics.lastAttempt", "Ultimo tentativo");
  const noAttemptLabel = useNewsDynamicText(locale, "news.diagnostics.noAttempt", "Non registrato");
  const lastRefreshErrorLabel = useNewsDynamicText(locale, "news.diagnostics.lastRefreshError", "Ultimo errore refresh");
  const lastAttemptValue = diagnostics.lastAttemptAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(diagnostics.lastAttemptAt))
    : noAttemptLabel;

  return (
    <div className={cn("mx-auto mt-5 max-w-xl rounded-2xl border px-5 py-4 text-left", tone)} role="status">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-background/70 px-2.5 py-1 text-xs font-semibold">
              {statusLabel}
            </span>
            <span className="rounded-full bg-background/70 px-2.5 py-1 text-xs font-medium">
              {actionLabel}
            </span>
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            {message}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-lg bg-background/65 px-3 py-2">
          <p className="text-muted-foreground">{enabledSourcesLabel}</p>
          <p className="font-semibold text-foreground">{diagnostics.enabledSources}</p>
        </div>
        <div className="rounded-lg bg-background/65 px-3 py-2">
          <p className="text-muted-foreground">{sourcesWithErrorsLabel}</p>
          <p className="font-semibold text-foreground">{diagnostics.sourcesWithErrors}</p>
        </div>
        <div className="rounded-lg bg-background/65 px-3 py-2">
          <p className="text-muted-foreground">{lastAttemptLabel}</p>
          <p className="font-semibold text-foreground">
            {lastAttemptValue}
          </p>
        </div>
      </div>
      {diagnostics.lastRefreshError && (
        <p className="mt-3 break-words rounded-lg bg-background/65 px-3 py-2 text-xs font-medium text-foreground">
          {lastRefreshErrorLabel}: {diagnostics.lastRefreshError}
        </p>
      )}
    </div>
  );
}

export function SubscribeToggle({ category, subscribed, onToggle }: { category: string; subscribed: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const config = CATEGORY_CONFIG.find((c) => c.id === category);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all border whitespace-nowrap",
        subscribed
          ? "bg-primary/10 text-primary border-primary/20"
          : "bg-transparent text-muted-foreground/50 border-border/40 hover:border-primary/30 hover:text-primary",
      )}
    >
      {subscribed ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
      <span className="hidden sm:inline">{config?.emoji}</span>
      {subscribed ? t("news.subscribed") : t("news.subscribe")}
    </button>
  );
}

export function NewsCard({ item, showSave = false }: { item: NewsItem; showSave?: boolean }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "it";
  const [imageFailed, setImageFailed] = useState(false);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { isNewsFavorite, getNewsFavoriteId, addFavorite, removeFavorite, isLoading } = useFavorites();
  const saved = isNewsFavorite(item.url);
  const favId = getNewsFavoriteId(item.url);
  const config = CATEGORY_CONFIG.find((c) => c.id === item.category);
  const detailHref = item.detailUrl ?? `/news/${item.id}`;
  const preview = item.preview ?? item.description;
  const sourceHref = item.sourceUrl ?? item.url;
  const fallbackImageLabel = useNewsDynamicText(locale, "news.card.fallbackImage", "Immagine notizia");
  const meaningSections = item.meaning?.sections ?? (item.meaning ? [
    { key: "audience" as const, body: item.meaning.audience ?? "" },
    { key: "happened" as const, body: item.meaning.happened ?? preview ?? "" },
    { key: "why" as const, body: item.meaning.whyItMatters },
    { key: "practical" as const, body: item.meaning.practicalNextStep ?? item.meaning.action ?? "" },
  ].filter((section) => section.body.trim().length > 0) : []);

  function toggleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    if (saved && favId !== undefined) {
      removeFavorite(favId);
    } else {
      addFavorite({
        type: "news",
        articleUrl: item.url,
        articleTitle: item.title,
        articleDescription: item.description,
        articleSource: item.source,
        articleCategory: item.category,
        ...(item.image ? { articleImage: item.image } : {}),
      });
    }
  }

  const catLabel = t(`news.categories.${item.category}`, { defaultValue: item.category });
  const tr = (key: string, opts?: Record<string, unknown>) => opts ? t(key, opts) : t(key);

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={() => navigate(detailHref)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(detailHref);
        }
      }}
      className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all group flex flex-col cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {item.image && !imageFailed ? (
        <div className="aspect-video overflow-hidden shrink-0">
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : (
        <CategoryFallbackImage category={item.category} emoji={config?.emoji ?? "NEWS"} title={item.title} label={fallbackImageLabel} />
      )}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs font-medium">{catLabel}</Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgoLabel(item.publishedAt, tr)}
            </span>
          </div>
          {showSave && user && (
            <button
              onClick={toggleSave}
              disabled={isLoading}
              title={saved ? t("news.removeFromSaved") : t("news.saveArticle")}
              className={cn(
                "shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                saved ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/5",
              )}
            >
              {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            </button>
          )}
        </div>
        <h3 className="font-semibold text-foreground leading-snug mb-2 line-clamp-3 text-[1.05rem]">
          {item.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4 flex-1">
          {preview}
        </p>
        {meaningSections.length > 0 && (
          <div className="mb-4 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2">
            <dl className="space-y-2">
              {meaningSections.map((section) => (
                <div key={section.key} className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase text-primary">{t(`news.meaning.${section.key}`)}</dt>
                  <dd className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-foreground/80">
                    {section.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        <div className="flex items-center justify-between mt-auto">
          <span className="text-xs text-muted-foreground font-medium">{item.source}</span>
          <a
            href={sourceHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md px-2"
          >
            {t("news.openSource")} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </article>
  );
}

export function UpgradeCTA() {
  const { t } = useTranslation();
  return (
    <div className="bg-gradient-to-r from-primary/5 via-background to-primary/5 border border-primary/15 rounded-2xl p-8 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-2xl mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-serif font-bold text-xl text-foreground mb-2">{t("news.upgrade.title")}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto leading-relaxed">
        {t("news.upgrade.desc")}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button asChild className="rounded-full font-medium">
          <Link href="/premium"><Sparkles className="h-4 w-4 mr-1.5" />{t("news.upgrade.discoverPremium")}</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full font-medium">
          <Link href="/test">{t("news.upgrade.takeTest")}</Link>
        </Button>
      </div>
    </div>
  );
}
