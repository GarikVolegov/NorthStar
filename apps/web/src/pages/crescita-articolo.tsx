import { useState } from "react";
import { usePageMeta } from "@/lib/seo";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Bookmark, BookmarkCheck, ArrowRight, Clock, BarChart2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { TTSButton } from "@/components/ui/tts-button";

const BASE = import.meta.env.BASE_URL || "/";

interface RelatedArticle {
  id: number;
  title: string;
  slug: string;
  category: string;
  description: string;
  readTimeMinutes: number;
  difficulty: string;
}

interface ArticleDetail {
  id: number;
  title: string;
  slug: string;
  category: string;
  description: string;
  content: string;
  tags: string[];
  difficulty: string;
  personalityMatches: string[];
  sectorLinks: string[];
  readTimeMinutes: number;
  viewCount: number;
  updatedAt: string;
  related: RelatedArticle[];
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

const CATEGORY_ICONS: Record<string, string> = {
  autoconsapevolezza: "🧠", motivazione: "🔥", abitudini: "🔄",
  "disciplina-e-focus": "🎯", "gestione-del-tempo": "⏱️",
  "emozioni-e-mentalita": "💭", "obiettivi-e-visione": "🌟",
  resilienza: "💪", comunicazione: "💬", "identita-personale": "🪞",
  "crescita-professionale": "📈", "benessere-mentale": "🌿",
  "carriera-e-scelte-di-vita": "🧭",
};

function renderContent(content: string): React.ReactNode {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-xl font-serif font-bold text-foreground mt-8 mb-3 first:mt-0">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("**") && line.endsWith("**") && !line.slice(2, -2).includes("**")) {
      elements.push(
        <p key={i} className="font-semibold text-foreground mt-4 mb-1">{line.slice(2, -2)}</p>
      );
    } else if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={i} className="list-disc list-outside ml-5 space-y-1.5 my-3">
          {items.map((item, j) => (
            <li key={j} className="text-muted-foreground text-base leading-relaxed"
              dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>') }} />
          ))}
        </ul>
      );
      continue;
    } else if (line.trim() === "") {
      // skip blank lines
    } else {
      elements.push(
        <p key={i} className="text-muted-foreground leading-relaxed my-2"
          dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>') }} />
      );
    }
    i++;
  }
  return elements;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

export default function CrescitaArticolo() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const { isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const { data: article, isLoading, error } = useQuery<ArticleDetail>({
    queryKey: ["crescita-articolo", slug],
    queryFn: () => fetch(`${BASE}api/crescita/${slug}`).then(async r => {
      if (!r.ok) throw new Error("not found");
      return r.json();
    }),
    staleTime: 1000 * 60 * 5,
    enabled: !!slug,
    retry: false,
  });

  usePageMeta({
    title: article ? `${article.title} — Crescita Personale — NorthStar` : "Articolo — NorthStar",
    description: article?.description ?? "",
    canonicalPath: `/crescita/articolo/${slug}`,
  });

  async function toggleSave() {
    if (!isLoggedIn || !article) return;
    setSaveLoading(true);
    try {
      const res = await fetch(`${BASE}api/crescita/${article.id}/salva`, { method: "POST" });
      const data = await res.json();
      setSaved(data.saved);
      queryClient.invalidateQueries({ queryKey: ["crescita-salvati"] });
    } finally {
      setSaveLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 md:px-6 max-w-3xl py-20 text-center text-muted-foreground">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 opacity-40" />
        {t("common.loading", { defaultValue: "Caricamento…" })}
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="container mx-auto px-4 md:px-6 max-w-3xl py-20 text-center">
        <p className="text-muted-foreground">{t("growth.articleNotFound", { defaultValue: "Articolo non trovato." })}</p>
        <Link href="/crescita">
          <Button variant="outline" className="mt-4 rounded-full">← {t("growth.backToLibrary", { defaultValue: "Torna alla libreria" })}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">

      {/* Breadcrumb */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl py-3 flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Link href="/crescita" className="hover:text-primary transition-colors">{t("growth.title", { defaultValue: "Crescita Personale" })}</Link>
          <span>/</span>
          <Link href={`/crescita/categoria/${article.category}`} className="hover:text-primary transition-colors capitalize">
            {CATEGORY_ICONS[article.category]} {article.category.replace(/-/g, " ")}
          </Link>
          <span>/</span>
          <span className="text-foreground truncate max-w-[200px]">{article.title}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 max-w-4xl py-10">
        <div className="flex gap-10">

          {/* Main content */}
          <article className="flex-1 min-w-0">

            {/* Header */}
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", DIFFICULTY_COLORS[article.difficulty] ?? DIFFICULTY_COLORS["base"])}>
                  {DIFFICULTY_LABELS[article.difficulty] ?? article.difficulty}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {article.readTimeMinutes} min di lettura
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <BarChart2 className="w-3 h-3" /> {article.viewCount} letture
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4 leading-tight">
                {article.title}
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed border-l-4 border-primary/30 pl-4">
                {article.description}
              </p>

              <div className="flex items-center justify-between mt-6 pt-4 border-t flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    Aggiornato il {fmtDate(article.updatedAt)}
                  </span>
                  <TTSButton text={`${article.title}. ${article.description}. ${article.content.replace(/#{1,6}\s|[*_~`]/g, "")}`} />
                </div>
                <Button
                  variant={saved ? "default" : "outline"}
                  size="sm"
                  className="rounded-full gap-2"
                  onClick={toggleSave}
                  disabled={saveLoading || !isLoggedIn}
                  title={!isLoggedIn ? "Accedi per salvare" : undefined}
                >
                  {saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                  {saved ? t("news.saved") : t("news.save")}
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="prose-northstar text-base leading-relaxed">
              {renderContent(article.content)}
            </div>

            {/* Tags */}
            {article.tags.length > 0 && (
              <div className="mt-10 pt-6 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Tag</p>
                <div className="flex flex-wrap gap-2">
                  {article.tags.map(t => (
                    <Link key={t} href={`/crescita/categoria/${article.category}`}>
                      <span className="text-sm bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary px-3 py-1 rounded-full cursor-pointer transition-colors">
                        {t}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Connections */}
            {(article.sectorLinks.length > 0 || article.personalityMatches.length > 0) && (
              <div className="mt-8 rounded-2xl border bg-muted/30 p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground">Contenuto collegato a</p>
                {article.sectorLinks.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Aree</p>
                    <div className="flex flex-wrap gap-2">
                      {article.sectorLinks.map(s => (
                        <Link key={s} href="/settori">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full hover:opacity-80 transition-opacity cursor-pointer">
                            {s}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {article.personalityMatches.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Profili RIASEC</p>
                    <div className="flex flex-wrap gap-2">
                      {article.personalityMatches.map(p => (
                        <span key={p} className="text-xs bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full capitalize">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CTA save */}
            {!isLoggedIn && (
              <div className="mt-8 rounded-2xl border bg-primary/5 border-primary/20 p-6 text-center">
                <p className="font-semibold text-foreground mb-1">{t("growth.saveArticleTitle", { defaultValue: "Salva questo articolo" })}</p>
                <p className="text-sm text-muted-foreground mb-4">{t("growth.saveArticleDesc", { defaultValue: "Accedi per salvare i contenuti e ritrovarli nel tuo profilo." })}</p>
                <Link href="/test">
                  <Button className="rounded-full">{t("growth.startJourney", { defaultValue: "Inizia il percorso" })}</Button>
                </Link>
              </div>
            )}
          </article>

          {/* Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0 space-y-5 pt-1">

            {/* Save */}
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("growth.actions", { defaultValue: "Azioni" })}</p>
              <Button
                variant={saved ? "default" : "outline"}
                size="sm"
                className="w-full rounded-xl gap-2"
                onClick={toggleSave}
                disabled={saveLoading || !isLoggedIn}
              >
                {saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                {saved ? t("growth.articleSaved", { defaultValue: "Articolo salvato" }) : t("growth.saveArticleBtn", { defaultValue: "Salva articolo" })}
              </Button>
              {!isLoggedIn && (
                <p className="text-xs text-muted-foreground mt-2 text-center">{t("growth.loginToSave", { defaultValue: "Accedi per salvare" })}</p>
              )}
            </div>

            {/* Info */}
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("growth.details", { defaultValue: "Dettagli" })}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("growth.category", { defaultValue: "Categoria" })}</span>
                  <Link href={`/crescita/categoria/${article.category}`}>
                    <span className="font-medium text-primary hover:underline cursor-pointer capitalize">
                      {CATEGORY_ICONS[article.category]} {article.category.replace(/-/g, " ")}
                    </span>
                  </Link>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("growth.level", { defaultValue: "Livello" })}</span>
                  <span className="font-medium">{DIFFICULTY_LABELS[article.difficulty]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("growth.reading", { defaultValue: "Lettura" })}</span>
                  <span className="font-medium">{article.readTimeMinutes} min</span>
                </div>
              </div>
            </div>

            {/* Related */}
            {article.related.length > 0 && (
              <div className="rounded-2xl border bg-card p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("growth.readAlso", { defaultValue: "Leggi anche" })}</p>
                <div className="space-y-3">
                  {article.related.map(r => (
                    <Link key={r.id} href={`/crescita/articolo/${r.slug}`}>
                      <div className="group cursor-pointer">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-snug">
                          {r.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {r.readTimeMinutes} min
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link href={`/crescita/categoria/${article.category}`}>
                  <div className="flex items-center gap-1 text-xs text-primary mt-3 pt-3 border-t hover:underline cursor-pointer">
                    {t("growth.allArticles", { defaultValue: "Tutti gli articoli" })} <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
              </div>
            )}

            {/* CTA */}
            <div className="rounded-2xl border bg-primary/5 border-primary/20 p-4 text-center">
              <p className="text-sm font-semibold text-foreground mb-2">{t("growth.discoverProfile", { defaultValue: "Scopri il tuo profilo" })}</p>
              <p className="text-xs text-muted-foreground mb-3">{t("growth.discoverProfileDesc", { defaultValue: "Fai il test RIASEC per trovare la direzione giusta." })}</p>
              <Link href="/test">
                <Button size="sm" className="w-full rounded-xl">
                  {t("growth.doTest", { defaultValue: "Fai il test" })}
                </Button>
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
