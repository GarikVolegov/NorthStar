import { useAuth } from "@/contexts/AuthContext";
import { useWendyPageContext } from "@/hooks/useWendyPageContext";
import { getJson } from "@/lib/apiClient";
import { usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Clock, Lock, Sparkles, Star, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

interface Category {
  id: string;
  label: string;
  icon: string;
  description: string;
  count: number;
}

interface Article {
  id: number;
  title: string;
  slug: string;
  category: string;
  description: string;
  tags: string[];
  difficulty: string;
  readTimeMinutes: number;
}

interface PerTeData {
  articles: Article[];
  hasProfile: boolean;
  personalization?: "profile" | "generic";
  types?: string[];
  italianTypes?: string[];
  status?: "ok" | "empty" | "error";
}

const RIASEC_LABELS: Record<string, string> = {
  R: "Realistico",
  I: "Investigativo",
  A: "Artistico",
  S: "Sociale",
  E: "Imprenditoriale",
  C: "Convenzionale",
};

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

function CategoryCard({ cat }: { cat: Category }) {
  return (
    <Link href={`/crescita/categoria/${cat.id}`}>
      <div className="group rounded-2xl border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer h-full">
        <div className="flex items-start justify-between mb-3">
          <span className="text-3xl">{cat.icon}</span>
          {cat.count > 0 && (
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {cat.count} {cat.count === 1 ? "articolo" : "articoli"}
            </span>
          )}
        </div>
        <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
          {cat.label}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {cat.description}
        </p>
        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Esplora <ArrowRight className="w-3 h-3" />
        </div>
      </div>
    </Link>
  );
}

function ArticleCard({ article, recommended }: { article: Article; recommended?: boolean }) {
  return (
    <Link href={`/crescita/articolo/${article.slug}`}>
      <div className="group rounded-2xl border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer h-full flex flex-col relative overflow-hidden">
        {recommended && (
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-semibold px-2.5 py-1 rounded-bl-xl flex items-center gap-1">
            <Star className="w-2.5 h-2.5 fill-current" /> {/* translates via parent */}
          </div>
        )}
        <div className="flex items-center gap-2 mb-3">
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", DIFFICULTY_COLORS[article.difficulty] ?? DIFFICULTY_COLORS["base"])}>
            {DIFFICULTY_LABELS[article.difficulty] ?? article.difficulty}
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> {article.readTimeMinutes} min
          </span>
        </div>
        <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          {article.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
          {article.description}
        </p>
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {article.tags.slice(0, 3).map(t => (
              <span key={t} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function PerTeSection({ userId }: { userId: number }) {
  const { data, isLoading, isError } = useQuery<PerTeData>({
    queryKey: ["crescita-per-te", userId],
    queryFn: () => getJson<PerTeData>(`${BASE}api/crescita/per-te`),
    staleTime: 1000 * 60 * 10,
  });

  if (isLoading) {
    return (
      <section className="py-14 border-b">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <div className="flex items-center gap-3 mb-6">
            <Star className="w-5 h-5 text-primary fill-primary" />
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="py-14 border-b">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-6">
            <h3 className="font-serif font-semibold text-lg text-foreground mb-1">
              Non riesco a caricare i contenuti di crescita adesso.
            </h3>
            <p className="text-sm text-muted-foreground">
              Riprova tra poco: evitiamo di mostrarti consigli non verificati.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!data) return null;

  if (!data.hasProfile && data.articles.length > 0) {
    return (
      <section className="py-14 border-b">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-4 h-4 text-primary" />
                <h2 className="text-2xl font-serif font-bold text-foreground">Contenuti di crescita in evidenza</h2>
              </div>
              <p className="text-muted-foreground text-sm">
                Una selezione generale dalla libreria NorthStar. Completa il test per ottenere suggerimenti basati sul tuo profilo reale.
              </p>
            </div>
            <Link href="/test" className="text-sm font-medium text-primary hover:underline flex items-center gap-1 self-start sm:self-auto">
              Fai il test <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.articles.map(a => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!data.hasProfile) {
    return (
      <section className="py-14 border-b">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/3 p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Star className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center md:text-left flex-1">
              <h3 className="font-serif font-semibold text-lg text-foreground mb-1">
                Costruisci il tuo profilo di crescita
              </h3>
              <p className="text-sm text-muted-foreground">
                Fai il test RIASEC per permetterci di distinguere i consigli personalizzati dalla libreria generale.
              </p>
            </div>
            <Link href="/test">
              <button className="flex-shrink-0 bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2">
                Fai il test <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!data.articles.length) return null;

  const typeLabels = (data.types ?? []).map(t => RIASEC_LABELS[t] ?? t);

  return (
    <section className="py-14 border-b">
      <div className="container mx-auto px-4 md:px-6 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-primary fill-primary" />
              <h2 className="text-2xl font-serif font-bold text-foreground">Per te</h2>
            </div>
            <p className="text-muted-foreground text-sm">
              Selezionati in base al tuo profilo{" "}
              {typeLabels.length > 0 && (
                <span className="font-medium text-foreground">
                  {typeLabels.join(" · ")}
                </span>
              )}
            </p>
          </div>
          <Link href="/profilo" className="text-sm font-medium text-primary hover:underline flex items-center gap-1 self-start sm:self-auto">
            Il tuo profilo <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.articles.map(a => (
            <ArticleCard key={a.id} article={a} recommended />
          ))}
        </div>
      </div>
    </section>
  );
}

function NoProfileTeaser() {
  return (
    <section className="py-14 border-b">
      <div className="container mx-auto px-4 md:px-6 max-w-6xl">
        <div className="rounded-2xl border border-dashed border-muted-foreground/20 bg-muted/30 p-8 flex flex-col md:flex-row items-center gap-6">
          <div className="flex-shrink-0 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <div className="text-center md:text-left flex-1">
            <h3 className="font-serif font-semibold text-lg text-foreground mb-1">
              Costruisci il tuo profilo di crescita
            </h3>
            <p className="text-sm text-muted-foreground">
              Accedi o registrati, poi completa il test: i suggerimenti personalizzati arrivano solo quando esiste un profilo reale.
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Link href="/accedi">
              <button className="border border-primary text-primary px-5 py-2.5 rounded-full text-sm font-medium hover:bg-primary/5 transition-colors">
                Accedi
              </button>
            </Link>
            <Link href="/registrati">
              <button className="bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity">
                Registrati
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Crescita() {
  const { t } = useTranslation();
  usePageMeta({
    title: t("growth.pageTitle", { defaultValue: "Crescita Personale — NorthStar" }),
    description: t("growth.pageDesc", { defaultValue: "Una knowledge base di articoli, guide ed esercizi pratici su abitudini, mindset, motivazione, disciplina e sviluppo professionale." }),
    canonicalPath: "/crescita",
  });

  const { user, isLoggedIn } = useAuth();

  const { data: catData = [], isError: categoriesError } = useQuery<Category[]>({
    queryKey: ["crescita-categorie"],
    queryFn: () => getJson<Category[]>(`${BASE}api/crescita/categorie`),
    staleTime: 1000 * 60 * 10,
  });

  const { data: recentData, isError: recentError } = useQuery<{ articles: Article[] }>({
    queryKey: ["crescita-recent"],
    queryFn: async () => {
      const data = await getJson<{ articles?: Article[] }>(`${BASE}api/crescita?limit=6`);
      return { articles: Array.isArray(data?.articles) ? data.articles : [] };
    },
    staleTime: 1000 * 60 * 5,
  });

  const totalArticles = catData.reduce((sum, c) => sum + c.count, 0);
  const totalCategories = catData.filter(c => c.count > 0).length;
  const recentArticles = recentData?.articles ?? [];
  const growthLoadError = categoriesError || recentError;

  useWendyPageContext({
    page: "crescita",
    title: t("growth.title"),
    entityName: `Knowledge base crescita: ${totalCategories} aree, ${totalArticles} articoli`,
    journeyType: user?.journeyType ?? undefined,
    capabilities: ["search_growth_articles", "get_user_profile", "search_rag"],
    fields: [
      `totalCategories:${totalCategories}`,
      `totalArticles:${totalArticles}`,
      `recentArticles:${recentArticles.length}`,
      isLoggedIn ? "authState:logged-in" : "authState:guest",
    ],
    actions: [
      "aiuta l'utente a scegliere un'area di crescita da cui partire",
      "collega articoli e esercizi al profilo RIASEC o al percorso corrente",
      "suggerisci il prossimo contenuto o il test se manca il profilo",
    ],
  });

  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="py-12 md:py-24 bg-gradient-to-b from-primary/5 to-background border-b">
        <div className="container mx-auto px-5 md:px-6 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-5 md:mb-6">
            <Sparkles className="w-4 h-4" />
            {t("growth.badge", { defaultValue: "Crescita Personale" })}
          </div>
          <h1 className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-3 md:mb-4 leading-tight">
            {t("growth.title")} <span className="text-primary">{t("growth.titleHighlight")}</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-6 md:mb-8">
            {t("growth.subtitle")}
          </p>
          <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BookOpen className="w-4 h-4 text-primary" />
              <span><strong className="text-foreground">{totalArticles}</strong> {t("growth.articles")}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span><strong className="text-foreground">{totalCategories}</strong> {t("growth.stats.areas")}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>{t("growth.stats.updated")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Personalized section */}
      {isLoggedIn && user ? (
        <PerTeSection userId={user.id} />
      ) : (
        <NoProfileTeaser />
      )}

      {/* Categories */}
      <section className="py-10 md:py-14">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          {growthLoadError && (
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-6 mb-8">
              <h2 className="font-serif font-semibold text-lg text-foreground mb-1">
                Non riesco a caricare i contenuti di crescita adesso.
              </h2>
              <p className="text-sm text-muted-foreground">
                Riprova tra poco: questa pagina non usa contenuti finti quando l'API non risponde.
              </p>
            </div>
          )}
          <div className="mb-6 md:mb-8">
            <h2 className="text-xl md:text-2xl font-serif font-bold text-foreground mb-1">{t("growth.exploreByArea", { defaultValue: "Esplora per area" })}</h2>
            <p className="text-sm md:text-base text-muted-foreground">{t("growth.exploreByAreaDesc", { defaultValue: "Scegli il tema su cui vuoi lavorare adesso." })}</p>
          </div>
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          >
            {catData.map(cat => (
              <motion.div
                key={cat.id}
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } }}
              >
                <CategoryCard cat={cat} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Recent articles */}
      {recentArticles.length > 0 && (
        <section className="py-14 bg-muted/30 border-t border-b">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-serif font-bold text-foreground mb-1">{t("growth.latestArticles", { defaultValue: "Ultimi articoli" })}</h2>
                <p className="text-muted-foreground">{t("growth.latestArticlesDesc", { defaultValue: "I contenuti aggiunti più di recente." })}</p>
              </div>
              <Link href="/crescita/categoria/autoconsapevolezza" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                {t("growth.seeAll", { defaultValue: "Vedi tutti" })} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
            >
              {recentArticles.map(a => (
                <motion.div
                  key={a.id}
                  variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } }}
                >
                  <ArticleCard article={a} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl text-center">
          <div className="rounded-3xl bg-primary/5 border border-primary/20 p-10">
            <h2 className="text-2xl font-serif font-bold text-foreground mb-3">
              {t("growth.ctaTitle", { defaultValue: "Non sai da dove iniziare?" })}
            </h2>
            <p className="text-muted-foreground mb-6">
              {t("growth.ctaDesc", { defaultValue: "Fai il test RIASEC + Cinque Spiriti: capire chi sei è sempre il primo passo." })}
            </p>
            <Link href="/test">
              <button className="bg-primary text-primary-foreground px-6 py-3 rounded-full font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2">
                {t("growth.startJourney", { defaultValue: "Inizia il percorso" })} <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
