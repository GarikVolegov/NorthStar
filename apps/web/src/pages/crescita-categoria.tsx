import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-fetch";
import { usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Clock, Filter, Search, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

interface Article {
  id: number;
  title: string;
  slug: string;
  category: string;
  description: string;
  tags: string[];
  difficulty: string;
  readTimeMinutes: number;
  viewCount: number;
}

interface Category {
  id: string;
  label: string;
  icon: string;
  description: string;
  count: number;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  base: "Base",
  intermedio: "Intermedio",
  avanzato: "Avanzato",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  base: "bg-emerald-100 text-emerald-700",
  intermedio: "bg-amber-100 text-amber-700",
  avanzato: "bg-rose-100 text-rose-700",
};

function ArticleCard({ article }: { article: Article }) {
  return (
    <Link href={`/crescita/articolo/${article.slug}`}>
      <div className="group rounded-2xl border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer flex flex-col h-full">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium",
              DIFFICULTY_COLORS[article.difficulty] ??
                DIFFICULTY_COLORS["base"],
            )}
          >
            {DIFFICULTY_LABELS[article.difficulty] ?? article.difficulty}
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> {article.readTimeMinutes} min
          </span>
          {article.viewCount > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {article.viewCount} letture
            </span>
          )}
        </div>
        <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors leading-snug">
          {article.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed flex-1 line-clamp-3">
          {article.description}
        </p>
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t">
            {article.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Leggi <ArrowRight className="w-3 h-3" />
        </div>
      </div>
    </Link>
  );
}

export default function CrescitaCategoria() {
  const { t } = useTranslation();
  const { cat } = useParams<{ cat: string }>();
  const [search, setSearch] = useState("");
  const [diffFilter, setDiffFilter] = useState("all");

  const { data: catData = [] } = useQuery<Category[]>({
    queryKey: ["crescita-categorie"],
    queryFn: () =>
      apiFetch(`${BASE}api/crescita/categorie`).then((r) => r.json()),
    staleTime: 1000 * 60 * 10,
  });

  const currentCat = catData.find((c) => c.id === cat);

  const { data, isLoading } = useQuery<{ articles: Article[]; total: number }>({
    queryKey: ["crescita", cat],
    queryFn: () =>
      apiFetch(`${BASE}api/crescita?category=${cat}&limit=50`).then((r) =>
        r.json(),
      ),
    staleTime: 1000 * 60 * 5,
    enabled: !!cat,
  });

  usePageMeta({
    title: `${currentCat?.label ?? "Categoria"} — Crescita Personale — NorthStar`,
    description:
      currentCat?.description ??
      "Articoli e guide di crescita personale su NorthStar.",
    canonicalPath: `/crescita/categoria/${cat}`,
  });

  const allArticles = data?.articles ?? [];

  const filtered = allArticles.filter((a) => {
    if (diffFilter !== "all" && a.difficulty !== diffFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (
        !a.title.toLowerCase().includes(s) &&
        !a.description.toLowerCase().includes(s) &&
        !a.tags.some((t) => t.toLowerCase().includes(s))
      )
        return false;
    }
    return true;
  });

  const allTags = Array.from(new Set(allArticles.flatMap((a) => a.tags))).slice(
    0,
    12,
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="py-12 md:py-16 bg-gradient-to-b from-primary/5 to-background border-b">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <Link
            href="/crescita"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-6 group"
          >
            ←{" "}
            {t("growth.backToGrowth", {
              defaultValue: "Torna alla Crescita Personale",
            })}
          </Link>
          <div className="flex items-center gap-4 mb-4">
            {currentCat && <span className="text-4xl">{currentCat.icon}</span>}
            <div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
                {currentCat?.label ?? "Categoria"}
              </h1>
              <p className="text-muted-foreground mt-1">
                {currentCat?.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="w-4 h-4" />
            {data?.total ?? 0}{" "}
            {t("growth.articlesInArea", {
              defaultValue: "articoli in questa area",
            })}
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="border-b bg-background sticky top-16 z-10">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder={t("growth.searchPlaceholder", {
                  defaultValue: "Cerca articoli…",
                })}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm rounded-xl w-48"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              {(["all", "base", "intermedio", "avanzato"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setDiffFilter(v)}
                  className={cn(
                    "px-3 py-1 rounded-xl border text-xs font-medium transition-colors",
                    diffFilter === v
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30",
                  )}
                >
                  {v === "all"
                    ? t("settori.all", { defaultValue: "Tutti" })
                    : DIFFICULTY_LABELS[v]}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} risultati
            </span>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 md:px-6 max-w-6xl py-10">
        <div className="flex gap-8">
          {/* Articles */}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border bg-card p-5 h-48 animate-pulse"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">
                  {t("growth.noArticlesFound", {
                    defaultValue: "Nessun articolo trovato",
                  })}
                </p>
                <p className="text-sm mt-1">
                  {t("growth.tryFilters", {
                    defaultValue: "Prova a cambiare i filtri",
                  })}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filtered.map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar: tags + other categories */}
          <aside className="hidden lg:block w-56 shrink-0 space-y-6">
            {allTags.length > 0 && (
              <div className="rounded-2xl border bg-card p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Tag
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((t) => (
                    <button
                      key={t}
                      onClick={() => setSearch(t)}
                      className="text-xs bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary px-2 py-1 rounded-lg transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Altre aree
              </p>
              <div className="space-y-1.5">
                {catData
                  .filter((c) => c.id !== cat && c.count > 0)
                  .slice(0, 6)
                  .map((c) => (
                    <Link key={c.id} href={`/crescita/categoria/${c.id}`}>
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                        <span className="text-base">{c.icon}</span>
                        <span className="truncate">{c.label}</span>
                        <span className="ml-auto text-xs">{c.count}</span>
                      </div>
                    </Link>
                  ))}
                <Link href="/crescita">
                  <div className="flex items-center gap-1 px-2 py-1.5 text-xs text-primary hover:underline cursor-pointer">
                    {t("growth.seeAll", { defaultValue: "Vedi tutti" })}{" "}
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
