import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";
import { usePageMeta } from "@/lib/seo";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Newspaper,
  RefreshCw,
  Tag,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useRoute } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

interface NewsDetailItem {
  id: string;
  title: string;
  preview: string;
  description: string;
  content: string;
  source: string;
  sourceUrl: string;
  url: string;
  publishedAt: string;
  image: string | null;
  category: string;
  sector: string | null;
  tags: string[];
  relevance: number;
  meaning?: {
    sections?: Array<{
      key: "audience" | "happened" | "why" | "practical";
      body: string;
    }>;
  };
}

function formatDate(value: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function renderContent(content: string) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      if (line.startsWith("### ")) {
        return (
          <h2
            key={`${line}-${index}`}
            className="mt-8 text-xl font-semibold text-foreground"
          >
            {line.replace(/^###\s+/, "")}
          </h2>
        );
      }

      return (
        <p
          key={`${line}-${index}`}
          className="text-base leading-8 text-muted-foreground"
        >
          {line}
        </p>
      );
    });
}

function renderMeaningSections(
  sections: NonNullable<NewsDetailItem["meaning"]>["sections"],
  t: (key: string) => string,
) {
  return sections?.map((section) => (
    <section key={section.key}>
      <h2 className="mt-8 text-xl font-semibold text-foreground">
        {t(`news.meaning.${section.key}`)}
      </h2>
      <p className="text-base leading-8 text-muted-foreground">
        {section.body}
      </p>
    </section>
  ));
}

export default function NewsDetail() {
  const { t, i18n } = useTranslation();
  const [, params] = useRoute("/news/:id");
  const id = params?.id;
  const newsLocale = (i18n.resolvedLanguage ?? i18n.language ?? "it").slice(0, 2);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["news-detail", id, newsLocale],
    queryFn: async () => {
      const localeParam = `?locale=${encodeURIComponent(newsLocale)}`;
      const res = await apiFetch(`${BASE}api/news/article/${id}${localeParam}`);
      if (!res.ok) throw new Error("news detail error");
      return res.json() as Promise<{ article: NewsDetailItem }>;
    },
    enabled: Boolean(id),
    retry: false,
  });

  const article = data?.article;

  usePageMeta({
    title: article?.title ?? t("news.title"),
    description:
      article?.preview ?? article?.description ?? t("seo.news.description"),
    path: id ? `/news/${id}` : "/news",
    type: "article",
    ...(article?.image ? { image: article.image } : {}),
    ...(article?.title ? { imageAlt: article.title } : {}),
  });

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto max-w-4xl px-4 py-10">
          <div className="h-11 w-32 rounded-full bg-muted animate-pulse mb-8" />
          <div className="aspect-video rounded-2xl bg-muted animate-pulse mb-8" />
          <div className="h-10 w-3/4 rounded bg-muted animate-pulse mb-4" />
          <div className="h-5 w-full rounded bg-muted animate-pulse mb-2" />
          <div className="h-5 w-5/6 rounded bg-muted animate-pulse" />
        </div>
      </main>
    );
  }

  if (isError || !article) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
          <Newspaper className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
          <h1 className="mb-2 text-2xl font-semibold text-foreground">
            {t("news.detail.unavailableTitle")}
          </h1>
          <p className="mb-6 text-muted-foreground">
            {t("news.detail.unavailableDesc")}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="min-h-11 gap-2 rounded-full"
            >
              <RefreshCw className="h-4 w-4" />
              {t("news.retry")}
            </Button>
            <Button asChild className="min-h-11 rounded-full">
              <Link href="/news">{t("news.detail.backToNews")}</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <article className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
        <Button
          asChild
          variant="ghost"
          className="mb-6 min-h-11 rounded-full px-0 hover:bg-transparent"
        >
          <Link
            href="/news"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("news.detail.backToNews")}
          </Link>
        </Button>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{article.category}</Badge>
          {article.sector && <Badge variant="outline">{article.sector}</Badge>}
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            {formatDate(article.publishedAt, i18n.resolvedLanguage ?? i18n.language ?? "it")}
          </span>
        </div>

        <h1 className="mb-4 text-3xl font-bold leading-tight text-foreground md:text-5xl">
          {article.title}
        </h1>

        <p className="mb-8 text-lg leading-8 text-muted-foreground md:text-xl">
          {article.preview || article.description}
        </p>

        {article.image ? (
          <div className="mb-8 aspect-video overflow-hidden rounded-2xl border border-border bg-muted">
            <img
              src={article.image}
              alt={article.title}
              className="h-full w-full object-cover"
              loading="eager"
            />
          </div>
        ) : (
          <div className="mb-8 aspect-video rounded-2xl border border-border bg-muted/60 flex items-center justify-center">
            <Newspaper className="h-14 w-14 text-muted-foreground/40" />
          </div>
        )}

        <div className="mb-10 flex flex-wrap items-center gap-3 border-y border-border py-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{article.source}</span>
          {article.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              {tag}
            </span>
          ))}
        </div>

        <div className="space-y-4">
          {article.meaning?.sections?.length
            ? renderMeaningSections(article.meaning.sections, t)
            : renderContent(article.content)}
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <p className="mb-4 text-sm text-muted-foreground">
            {t("news.detail.sourceNote")}
          </p>
          <Button asChild className="min-h-11 rounded-full">
            <a
              href={article.sourceUrl || article.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("news.detail.readSource")}
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </article>
    </main>
  );
}
