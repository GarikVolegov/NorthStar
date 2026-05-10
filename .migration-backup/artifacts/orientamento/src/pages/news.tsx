import React, { useState, useEffect } from "react";
import { usePageMeta } from "@/lib/seo";
import { NewsGridSkeleton } from "@/components/skeletons/NewsCardSkeleton";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Newspaper, ExternalLink, Clock, Tag, Sparkles, RefreshCw, Bookmark, BookmarkCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL || "/";

interface NewsItem {
  id: string; title: string; description: string;
  source: string; url: string; publishedAt: string;
  image: string | null; category: string; sector: string | null;
  tags: string[]; relevance: number; plan: "free" | "premium";
}

interface ProfileData {
  exploredSectors: Array<{ sectorId: number; name: string; icon: string; confirmed: boolean }>;
}

const FREE_CATEGORIES = [
  { id: "general",    emoji: "🌍" },
  { id: "technology", emoji: "💻" },
  { id: "business",   emoji: "📈" },
  { id: "science",    emoji: "🔬" },
  { id: "health",     emoji: "❤️" },
  { id: "finance",    emoji: "💰" },
  { id: "education",  emoji: "🎓" },
] as const;

const NEWS_STALE_MS = 15 * 60_000; // 15 minutes

function timeAgoLabel(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return t("news.timeAgo.lessThan1h");
  if (h === 1) return t("news.timeAgo.1h");
  if (h < 24) return t("news.timeAgo.hours", { h });
  const d = Math.floor(h / 24);
  return d === 1 ? t("news.timeAgo.yesterday") : t("news.timeAgo.days", { d });
}

function NewsCard({ item, showSave = false }: { item: NewsItem; showSave?: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isNewsFavorite, getNewsFavoriteId, addFavorite, removeFavorite, isLoading } = useFavorites();
  const saved = isNewsFavorite(item.url);
  const favId = getNewsFavoriteId(item.url);

  function toggleSave(e: React.MouseEvent) {
    e.preventDefault();
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
        articleImage: item.image ?? undefined,
        articleCategory: item.category,
      });
    }
  }

  const catLabel = t(`news.categories.${item.category}`, { defaultValue: item.category });

  return (
    <article className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all group flex flex-col">
      {item.image && (
        <div className="aspect-video overflow-hidden shrink-0">
          <img
            src={item.image}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs font-medium">{catLabel}</Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgoLabel(item.publishedAt, t)}
            </span>
          </div>
          {showSave && user && (
            <button
              onClick={toggleSave}
              disabled={isLoading}
              title={saved ? t("news.removeFromSaved") : t("news.saveArticle")}
              className={cn(
                "shrink-0 p-1.5 rounded-lg transition-colors",
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
          {item.description}
        </p>
        <div className="flex items-center justify-between mt-auto">
          <span className="text-xs text-muted-foreground font-medium">{item.source}</span>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            {t("common.readMore")} <ExternalLink className="h-3 w-3" />
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

  usePageMeta({
    title: t("seo.news.title"),
    description: t("seo.news.description"),
    path: "/news",
    type: "article",
  });

  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("general");

  const { data: profile } = useQuery<ProfileData>({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/profile/${user!.id}`);
      return res.json();
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const confirmedSector = profile?.exploredSectors?.find((s) => s.confirmed) ?? null;

  /**
   * Prefetch all free categories in the background at page mount.
   * This means every tab click after the first is instant — the data is
   * already in the TanStack Query cache and keepPreviousData below ensures
   * the current tab stays visible during any background revalidation.
   */
  useEffect(() => {
    FREE_CATEGORIES.forEach(({ id }) => {
      queryClient.prefetchQuery({
        queryKey: ["news", id],
        queryFn: async () => {
          const res = await fetch(`${BASE}api/news?category=${id}&limit=6`);
          if (!res.ok) throw new Error("error");
          return res.json() as Promise<{ news: NewsItem[]; source: "live" | "static" }>;
        },
        staleTime: NEWS_STALE_MS,
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefetch sector news as soon as the confirmed sector is known
  useEffect(() => {
    if (!confirmedSector) return;
    queryClient.prefetchQuery({
      queryKey: ["news", "sector", confirmedSector.name],
      queryFn: async () => {
        const res = await fetch(`${BASE}api/news/sector/${encodeURIComponent(confirmedSector.name)}?limit=6`);
        if (!res.ok) throw new Error();
        return res.json() as Promise<{ news: NewsItem[]; source: "live" | "static" }>;
      },
      staleTime: NEWS_STALE_MS,
    });
  }, [confirmedSector?.name, queryClient]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["news", activeTab],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/news?category=${activeTab}&limit=6`);
      if (!res.ok) throw new Error("error");
      return res.json() as Promise<{ news: NewsItem[]; source: "live" | "static" }>;
    },
    enabled: activeTab !== "__sector__",
    staleTime: NEWS_STALE_MS,
    // keepPreviousData: the current category's articles stay visible
    // while the next category's data loads — no skeleton flash on tab switch.
    placeholderData: keepPreviousData,
  });

  const { data: sectorNewsData, isLoading: sectorLoading } = useQuery({
    queryKey: ["news", "sector", confirmedSector?.name],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/news/sector/${encodeURIComponent(confirmedSector!.name)}?limit=6`);
      if (!res.ok) throw new Error();
      return res.json() as Promise<{ news: NewsItem[]; source: "live" | "static" }>;
    },
    enabled: !!confirmedSector,
    staleTime: NEWS_STALE_MS,
    placeholderData: keepPreviousData,
  });

  const displayNews = activeTab === "__sector__" ? (sectorNewsData?.news ?? []) : (data?.news ?? []);
  const displaySource = activeTab === "__sector__" ? sectorNewsData?.source : data?.source;
  const displayLoading = activeTab === "__sector__" ? (sectorLoading && !!confirmedSector) : isLoading;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border">
        <div className="container mx-auto px-4 md:px-6 py-12">
          <div className="max-w-2xl">
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
              <Star className="h-3.5 w-3.5 fill-current" />
              {confirmedSector.icon} {confirmedSector.name}
            </button>
          )}

          {FREE_CATEGORIES.map((cat) => (
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
            : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayNews.map((item) => (
                  <NewsCard key={item.id} item={item} showSave={!!user} />
                ))}
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
