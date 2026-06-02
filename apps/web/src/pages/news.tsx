import { NewsGridSkeleton } from "@/components/skeletons/NewsCardSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { NewsCard, NewsDiagnosticsPanel, UpgradeCTA } from "@/features/news/NewsCards";
import {
  CATEGORY_CONFIG,
  NEWS_STALE_MS,
  readDiagnosticsFromError,
  readNewsErrorCode,
  type NewsFeedResponse,
  type NewsSubscriptionsResponse,
  type ProfileData,
} from "@/features/news/newsModels";
import { useWendyPageContext } from "@/hooks/useWendyPageContext";
import { deleteJson, getJson, postJson } from "@/lib/apiClient";
import { usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Newspaper, RefreshCw, Sparkles, Tag } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL || "/";

export default function News() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const newsLocale = (i18n.resolvedLanguage ?? i18n.language ?? "it").slice(0, 2);

  usePageMeta({
    title: t("seo.news.title"),
    description: t("seo.news.description"),
    path: "/news",
    type: "article",
  });

  const [activeTab, setActiveTab] = useState<string>("general");

  const { data: profile } = useQuery<ProfileData>({
    queryKey: ["profile", user?.id],
    queryFn: () => getJson<ProfileData>(`${BASE}api/profile/${user!.id}`),
    enabled: !!user?.id && user.id > 0,
    staleTime: 5 * 60_000,
  });

  const confirmedSector = profile?.exploredSectors?.find((s) => s.confirmed) ?? null;

  // ── Subscriptions ──────────────────────────────────────────────
  const { data: subsData } = useQuery<string[]>({
    queryKey: ["news-subscriptions", user?.id],
    queryFn: async () => {
      try {
        const json = await getJson<NewsSubscriptionsResponse>(`${BASE}api/news/subscriptions`);
        return json.subscriptions ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!user?.id && user.id > 0,
    staleTime: 60_000,
  });
  const subscriptions = subsData ?? [];
  const activeCategory = CATEGORY_CONFIG.find((cat) => cat.id === activeTab);
  const activeContextName =
    activeTab === "__sector__" && confirmedSector
      ? `Settore confermato: ${confirmedSector.name}; iscrizioni:${subscriptions.length}`
      : `Categoria news: ${activeCategory?.id ?? activeTab}; iscrizioni:${subscriptions.length}`;

  useWendyPageContext({
    page: "news",
    title: t("news.title"),
    entityType: "news",
    entityName: activeContextName,
    journeyType: user?.journeyType ?? undefined,
    sector: activeTab === "__sector__" ? confirmedSector?.name : undefined,
    capabilities: ["search_news", "get_user_profile", "search_rag"],
    fields: [
      `activeTab:${activeTab}`,
      `subscriptions:${subscriptions.length}`,
      confirmedSector ? `confirmedSector:${confirmedSector.name}` : "confirmedSector:none",
    ],
    actions: [
      "riassumi le notizie rilevanti per orientamento e crescita professionale",
      "collega trend e segnali deboli al settore o profilo dell'utente",
      "suggerisci categorie da seguire o articoli da salvare",
    ],
  });

  const subMutation = useMutation({
    mutationFn: async ({ category, subscribe }: { category: string; subscribe: boolean }) => {
      if (subscribe) {
        await postJson(`${BASE}api/news/subscriptions`, { category });
      } else {
        await deleteJson(`${BASE}api/news/subscriptions/${category}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-subscriptions"] });
    },
  });

  function toggleSubscription(category: string) {
    if (!user) return;
    const isSubscribed = subscriptions.includes(category);
    subMutation.mutate({ category, subscribe: !isSubscribed });
  }

  // ── Prefetch ──────────────────────────────────────────────────
  const feedMode = activeTab === "__sector__" ? "sector" : "category";
  const feedSubject = feedMode === "sector" ? confirmedSector?.name ?? "" : activeTab;
  const feedEnabled = feedMode === "category" || !!confirmedSector;
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const feedQuery = useInfiniteQuery({
    queryKey: ["news", "feed", feedMode, feedSubject, newsLocale],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const cursor = typeof pageParam === "string" ? pageParam : null;
      const localeParam = `&locale=${encodeURIComponent(newsLocale)}`;
      const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
      const endpoint = feedMode === "sector"
        ? `${BASE}api/news/sector/${encodeURIComponent(confirmedSector!.name)}?limit=12${localeParam}${cursorParam}`
        : `${BASE}api/news?category=${encodeURIComponent(activeTab)}&limit=12${localeParam}${cursorParam}`;
      const response = await getJson<NewsFeedResponse>(endpoint);

      if (response.status === "error" || response.source === "error") {
        throw Object.assign(new Error(response.error ?? "news_unavailable"), { body: response });
      }

      return response;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: feedEnabled,
    staleTime: NEWS_STALE_MS,
  });

  const displayNews = useMemo(() => {
    const seen = new Set<string>();
    return (feedQuery.data?.pages ?? []).flatMap((page) => page.news).filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [feedQuery.data?.pages]);

  const feedPages = feedQuery.data?.pages ?? [];
  const firstFeedPage = feedPages[0];
  const latestFeedPage = feedPages[feedPages.length - 1];
  const displaySource = latestFeedPage?.source ?? firstFeedPage?.source;
  const displayDiagnostics = latestFeedPage?.diagnostics ?? firstFeedPage?.diagnostics;
  const displayLoading = feedQuery.isLoading;
  const displayError = feedQuery.isError && displayNews.length === 0;
  const loadMoreError = feedQuery.isError && displayNews.length > 0 ? feedQuery.error : null;
  const effectiveDiagnostics = displayDiagnostics ?? readDiagnosticsFromError(feedQuery.error);
  const translationUnavailable = readNewsErrorCode(feedQuery.error) === "news_translation_unavailable";
  const retryDisplayNews = feedQuery.refetch;

  const subscribedCategories = CATEGORY_CONFIG.filter((c) => subscriptions.includes(c.id));

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const node = loadMoreRef.current;
    if (!node || !feedQuery.hasNextPage || feedQuery.isFetchingNextPage || displayLoading || displayError || loadMoreError) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void feedQuery.fetchNextPage();
      }
    }, { rootMargin: "600px 0px" });

    observer.observe(node);
    return () => observer.disconnect();
  }, [
    displayError,
    displayLoading,
    feedQuery.fetchNextPage,
    feedQuery.hasNextPage,
    feedQuery.isFetchingNextPage,
    loadMoreError,
  ]);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border">
        <div className="container mx-auto px-4 md:px-6 py-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide mb-4">
              <Newspaper className="h-4 w-4" />
              {t("news.badge")}
            </div>
            <h1 className="font-bold text-4xl text-foreground mb-3">{t("news.title")}</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">{t("news.subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-8">

        {/* Subscription bar */}
        {user && (
          <div className="mb-8 bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">{t("news.myCategories")}</span>
              {subscribedCategories.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-auto">
                  {subscribedCategories.length} {t("news.active")}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_CONFIG.map((cat) => {
                const isSubscribed = subscriptions.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleSubscription(cat.id)}
                    disabled={subMutation.isPending}
                    className={cn(
                      "flex min-h-11 items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all border",
                      isSubscribed
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-transparent text-muted-foreground border-border/40 hover:border-primary/30 hover:text-primary"
                    )}
                  >
                    <span>{cat.emoji}</span>
                    {t(`news.categories.${cat.id}`)}
                    {isSubscribed ? <Bell className="h-3 w-3 ml-0.5" /> : <BellOff className="h-3 w-3 ml-0.5 opacity-40" />}
                  </button>
                );
              })}
            </div>
            {subscribedCategories.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">{t("news.subscribeHint")}</p>
            )}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide">
          {confirmedSector && (
            <button
              onClick={() => setActiveTab("__sector__")}
              className={`flex-none flex min-h-11 items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border ${
                activeTab === "__sector__"
                  ? "bg-primary text-white shadow-sm border-primary"
                  : "bg-primary/8 border-primary/20 text-primary hover:bg-primary/15"
              }`}
            >
              <StarIcon />
              {confirmedSector.icon} {confirmedSector.name}
            </button>
          )}

          {CATEGORY_CONFIG.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`flex-none flex min-h-11 items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === cat.id
                  ? "bg-primary text-white shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
              }`}
            >
              <span>{cat.emoji}</span>
              {t(`news.categories.${cat.id}`)}
              {subscriptions.includes(cat.id) && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              )}
            </button>
          ))}
        </div>

        {activeTab === "__sector__" && confirmedSector && (
          <div className="flex items-center gap-3 mb-6 bg-primary/5 border border-primary/15 rounded-xl px-5 py-3">
            <span className="text-2xl">{confirmedSector.icon}</span>
            <div>
              <p className="font-semibold text-foreground text-sm">{t("news.sectorNewsTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {t("news.sectorNewsDesc", { name: confirmedSector.name })}
              </p>
            </div>
            <Badge className="ml-auto bg-primary/10 text-primary border-0 text-xs font-medium">
              {t("news.yourSector")}
            </Badge>
          </div>
        )}

        <div className="mb-8">
          {displayLoading
            ? <NewsGridSkeleton count={6} />
            : displayError ? (
              <div className="text-center py-12">
                <p className="mb-2 text-lg font-semibold text-foreground">
                  {translationUnavailable ? t("news.translationUnavailable.title") : t("news.loadError")}
                </p>
                {translationUnavailable && (
                  <p className="mx-auto mb-4 max-w-xl text-sm text-muted-foreground">
                    {t("news.translationUnavailable.desc")}
                  </p>
                )}
                <Button variant="outline" onClick={() => retryDisplayNews()} className="gap-2 rounded-full">
                  <RefreshCw className="h-4 w-4" /> {t("news.retry")}
                </Button>
                {effectiveDiagnostics && <NewsDiagnosticsPanel diagnostics={effectiveDiagnostics} />}
              </div>
            )
            : displayNews.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayNews.map((item) => (
                    <NewsCard key={item.id} item={item} showSave={!!user} />
                  ))}
                </div>
                <div ref={loadMoreRef} className="mt-8 flex min-h-16 flex-col items-center justify-center gap-3">
                  {loadMoreError && (
                    <p className="text-sm font-medium text-destructive" role="alert">
                      {t("news.loadMoreError")}
                    </p>
                  )}
                  {feedQuery.hasNextPage ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => feedQuery.fetchNextPage()}
                      disabled={feedQuery.isFetchingNextPage}
                      className="min-h-11 rounded-full px-5"
                    >
                      {feedQuery.isFetchingNextPage
                        ? t("news.loadingMore", { defaultValue: "Caricamento..." })
                        : t("news.loadMore", { defaultValue: "Carica altre notizie" })}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("news.feedComplete", { defaultValue: "Hai letto tutte le notizie disponibili." })}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Newspaper className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">{t("news.noResults")}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{t("news.noResultsHint")}</p>
                {effectiveDiagnostics && <NewsDiagnosticsPanel diagnostics={effectiveDiagnostics} />}
              </div>
            )}
        </div>

        {!displayLoading && displayNews.length > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-10">
            <Tag className="h-3 w-3" />
            {displaySource === "live"
              ? t("news.sourceLabel.live")
              : displaySource === "partial"
                ? t("news.sourceLabel.partial", { defaultValue: "Alcune fonti non sono disponibili: mostriamo le notizie caricate." })
                : displaySource === "auto_refresh"
                  ? t("news.sourceLabel.live")
                  : t("news.sourceLabel.static")}
            {user && <span className="ml-2">· {t("news.bookmarkHint")}</span>}
          </p>
        )}

        {!confirmedSector && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-xl text-foreground">{t("news.upgrade.sectionTitle")}</h2>
              <Badge className="bg-primary/10 text-primary border-0 text-xs">Premium</Badge>
            </div>
            <UpgradeCTA />
          </div>
        )}
      </div>
    </div>
  );
}

function StarIcon() {
  return (
    <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
