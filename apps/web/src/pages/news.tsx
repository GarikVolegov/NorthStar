import { NewsGridSkeleton } from "@/components/skeletons/NewsCardSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { useWendyPageContext } from "@/hooks/useWendyPageContext";
import { deleteJson, getJson, postJson } from "@/lib/apiClient";
import { usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Bookmark, BookmarkCheck, Clock, ExternalLink, Newspaper, RefreshCw, Sparkles, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

interface NewsItem {
  id: string; title: string; preview?: string; description: string;
  source: string; sourceUrl?: string; url: string; detailUrl?: string; publishedAt: string;
  image: string | null; category: string; sector: string | null;
  tags: string[]; relevance: number; plan: "free" | "premium";
}

interface ProfileData {
  exploredSectors: Array<{ sectorId: number; name: string; icon: string; confirmed: boolean }>;
}

interface NewsSubscriptionsResponse {
  subscriptions?: string[];
}

const CATEGORY_CONFIG = [
  { id: "general",    emoji: "🌍", gradient: "from-blue-500/20 to-blue-600/10" },
  { id: "technology", emoji: "💻", gradient: "from-cyan-500/20 to-blue-600/10" },
  { id: "business",   emoji: "📈", gradient: "from-emerald-500/20 to-green-600/10" },
  { id: "science",    emoji: "🔬", gradient: "from-purple-500/20 to-violet-600/10" },
  { id: "health",     emoji: "❤️", gradient: "from-rose-500/20 to-red-600/10" },
  { id: "finance",    emoji: "💰", gradient: "from-amber-500/20 to-yellow-600/10" },
  { id: "education",  emoji: "🎓", gradient: "from-indigo-500/20 to-blue-600/10" },
] as const;

const NEWS_STALE_MS = 15 * 60_000;

function timeAgoLabel(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return t("news.timeAgo.lessThan1h");
  if (h === 1) return t("news.timeAgo.1h");
  if (h < 24) return t("news.timeAgo.hours", { h });
  const d = Math.floor(h / 24);
  return d === 1 ? t("news.timeAgo.yesterday") : t("news.timeAgo.days", { d });
}

function CategoryFallbackImage({ category, emoji }: { category: string; emoji: string }) {
  const config = CATEGORY_CONFIG.find((c) => c.id === category);
  return (
    <div className={`aspect-video bg-gradient-to-br ${config?.gradient ?? "from-muted to-muted/50"} flex items-center justify-center`}>
      <span className="text-4xl opacity-60">{emoji}</span>
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
          : "bg-transparent text-muted-foreground/50 border-border/40 hover:border-primary/30 hover:text-primary"
      )}
    >
      {subscribed ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
      <span className="hidden sm:inline">{config?.emoji}</span>
      {subscribed ? t("news.subscribed") : t("news.subscribe")}
    </button>
  );
}

function NewsCard({ item, showSave = false }: { item: NewsItem; showSave?: boolean }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { isNewsFavorite, getNewsFavoriteId, addFavorite, removeFavorite, isLoading } = useFavorites();
  const saved = isNewsFavorite(item.url);
  const favId = getNewsFavoriteId(item.url);
  const config = CATEGORY_CONFIG.find((c) => c.id === item.category);
  const detailHref = item.detailUrl ?? `/news/${item.id}`;
  const preview = item.preview ?? item.description;
  const sourceHref = item.sourceUrl ?? item.url;

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
      {item.image ? (
        <div className="aspect-video overflow-hidden shrink-0">
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      ) : (
        <CategoryFallbackImage category={item.category} emoji={config?.emoji ?? "📰"} />
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
                saved ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/5"
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
        <div className="flex items-center justify-between mt-auto">
          <span className="text-xs text-muted-foreground font-medium">{item.source}</span>
          <a
            href={sourceHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md px-2"
          >
            Fonte <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </article>
  );
}

function UpgradeCTA() {
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

export default function News() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();

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
  useEffect(() => {
    CATEGORY_CONFIG.forEach(({ id }) => {
      queryClient.prefetchQuery({
        queryKey: ["news", id],
        queryFn: () => getJson<{ news: NewsItem[]; source: "live" | "static" }>(`${BASE}api/news?category=${id}&limit=12`),
        staleTime: NEWS_STALE_MS,
      });
    });
  }, []);

  useEffect(() => {
    if (!confirmedSector) return;
    queryClient.prefetchQuery({
      queryKey: ["news", "sector", confirmedSector.name],
      queryFn: () => getJson<{ news: NewsItem[]; source: "live" | "static" }>(
        `${BASE}api/news/sector/${encodeURIComponent(confirmedSector.name)}?limit=12`,
      ),
      staleTime: NEWS_STALE_MS,
    });
  }, [confirmedSector?.name, queryClient]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["news", activeTab],
    queryFn: () => getJson<{ news: NewsItem[]; source: "live" | "static" }>(`${BASE}api/news?category=${activeTab}&limit=12`),
    enabled: activeTab !== "__sector__",
    staleTime: NEWS_STALE_MS,
    placeholderData: keepPreviousData,
  });

  const { data: sectorNewsData, isLoading: sectorLoading } = useQuery({
    queryKey: ["news", "sector", confirmedSector?.name],
    queryFn: () => getJson<{ news: NewsItem[]; source: "live" | "static" }>(
      `${BASE}api/news/sector/${encodeURIComponent(confirmedSector!.name)}?limit=12`,
    ),
    enabled: !!confirmedSector,
    staleTime: NEWS_STALE_MS,
    placeholderData: keepPreviousData,
  });

  const displayNews = activeTab === "__sector__" ? (sectorNewsData?.news ?? []) : (data?.news ?? []);
  const displaySource = activeTab === "__sector__" ? sectorNewsData?.source : data?.source;
  const displayLoading = activeTab === "__sector__" ? (sectorLoading && !!confirmedSector) : isLoading;

  const subscribedCategories = CATEGORY_CONFIG.filter((c) => subscriptions.includes(c.id));

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
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
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
              className={`flex-none flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border ${
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
              className={`flex-none flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
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

        {isError && activeTab !== "__sector__" && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">{t("news.loadError")}</p>
            <Button variant="outline" onClick={() => refetch()} className="gap-2 rounded-full">
              <RefreshCw className="h-4 w-4" /> {t("news.retry")}
            </Button>
          </div>
        )}

        <div className="mb-8">
          {displayLoading
            ? <NewsGridSkeleton count={6} />
            : displayNews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayNews.map((item) => (
                  <NewsCard key={item.id} item={item} showSave={!!user} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Newspaper className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">{t("news.noResults")}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{t("news.noResultsHint")}</p>
              </div>
            )}
        </div>

        {!displayLoading && displayNews.length > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-10">
            <Tag className="h-3 w-3" />
            {displaySource === "live" ? t("news.sourceLabel.live") : t("news.sourceLabel.static")}
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
