import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectorIcon } from "@/lib/sector-icon";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import {
  ArrowRight, BookOpen, CheckCircle2, ChevronRight, Circle, Clock,
  ExternalLink, GitBranch, Map, Newspaper, Sparkles, Target, TrendingUp, User,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

type LatestRec = { sectorId: number; sectorName: string; matchScore: number; matchReason: string };
type LatestResult = { sessionId: number; workPreference: string; recommendations: LatestRec[]; confirmedSectorId: number | null };

type SectorDetail = {
  id: number; name: string; icon: string; description: string;
  trend: string; growthRate: number; avgSalaryMin: number; avgSalaryMax: number;
};

type GrowthArticle = {
  id: number; title: string; description: string; slug: string;
  category: string; readTimeMinutes: number | null; difficulty: string;
};

type Objective = {
  id: number; text: string; category: string;
  progress: number; completed: boolean; dueDate: string | null;
};

const DIFF_LABEL: Record<string, string> = {
  base: "Base", intermedio: "Intermedio", avanzato: "Avanzato",
};
const DIFF_COLOR: Record<string, string> = {
  base: "text-emerald-700 bg-emerald-50 border-emerald-200",
  intermedio: "text-amber-700 bg-amber-50 border-amber-200",
  avanzato: "text-rose-700 bg-rose-50 border-rose-200",
};

function useSectorDetail(sectorId: number | null) {
  return useQuery<SectorDetail>({
    queryKey: ["sector-detail", sectorId],
    enabled: !!sectorId,
    queryFn: async () => {
      const res = await fetch(`${BASE}api/sectors/${sectorId}`);
      if (!res.ok) throw new Error("Errore settore");
      return res.json();
    },
    staleTime: 600_000,
  });
}

function usePersonalizedArticles() {
  return useQuery<{ articles: GrowthArticle[]; hasProfile: boolean }>({
    queryKey: ["crescita-per-te-dashboard"],
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/crescita/per-te`);
      if (!res.ok) throw new Error("Errore articoli");
      return res.json();
    },
    staleTime: 300_000,
    retry: false,
  });
}

function useObjectives() {
  return useQuery<Objective[]>({
    queryKey: ["objectives-dashboard"],
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/objectives/me`);
      if (!res.ok) throw new Error("Errore obiettivi");
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });
}

function ArticleCard({ article }: { article: GrowthArticle }) {
  const diff = DIFF_COLOR[article.difficulty] ?? DIFF_COLOR["base"];
  const diffLabel = DIFF_LABEL[article.difficulty] ?? article.difficulty;
  return (
    <Link href={`/crescita/articolo/${article.slug}`}>
      <div className="group flex flex-col h-full rounded-2xl border bg-card hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer p-5">
        <div className="flex items-center justify-between mb-3">
          <span className={cn("text-xs font-semibold border rounded-full px-2.5 py-0.5", diff)}>
            {diffLabel}
          </span>
          {article.readTimeMinutes && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" /> {article.readTimeMinutes} min
            </span>
          )}
        </div>
        <h3 className="font-semibold text-foreground leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors flex-1">
          {article.title}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
          {article.description}
        </p>
        <div className="flex items-center gap-1 text-xs font-medium text-primary mt-auto">
          Leggi <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </Link>
  );
}

function ObjectiveRow({ obj }: { obj: Objective }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0">
      <div className={cn(
        "shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
        obj.completed ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground",
      )}>
        {obj.completed
          ? <CheckCircle2 className="w-4 h-4" />
          : <Circle className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium leading-snug truncate", obj.completed && "line-through text-muted-foreground")}>
          {obj.text}
        </p>
        {!obj.completed && obj.progress > 0 && (
          <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden w-24">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${obj.progress}%` }} />
          </div>
        )}
      </div>
      {!obj.completed && (
        <span className="shrink-0 text-xs font-semibold text-primary">{obj.progress}%</span>
      )}
    </div>
  );
}

interface UserDashboardProps {
  userName: string;
  latestResult: LatestResult;
}

export function UserDashboard({ userName, latestResult }: UserDashboardProps) {
  const { confirmedSectorId, sessionId, recommendations } = latestResult;
  const { data: sector, isLoading: sectorLoading } = useSectorDetail(confirmedSectorId);
  const { data: articlesData, isLoading: articlesLoading } = usePersonalizedArticles();
  const { data: objectives, isLoading: objectivesLoading } = useObjectives();

  const confirmedRec = recommendations.find((r) => r.sectorId === confirmedSectorId);
  const sectorName = sector?.name ?? confirmedRec?.sectorName ?? "Il tuo settore";

  const completedCount = objectives?.filter((o) => o.completed).length ?? 0;
  const totalCount = objectives?.length ?? 0;
  const inProgressObjectives = objectives?.filter((o) => !o.completed).slice(0, 3) ?? [];

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500">

      {/* Hero welcome banner */}
      <section className="relative py-12 md:py-16 overflow-hidden border-b bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary/5 blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-primary/5 blur-3xl translate-y-1/2 -translate-x-1/4" />
        </div>
        <div className="container mx-auto px-5 md:px-6 max-w-5xl relative z-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Il tuo percorso
          </div>
          <h1 className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-2 leading-tight">
            Bentornato, <span className="text-primary italic">{userName}</span> ✦
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl">
            Ecco il riepilogo del tuo percorso e i prossimi passi consigliati.
          </p>
        </div>
      </section>

      {/* Confirmed sector card + quick links */}
      <section className="py-10 bg-background border-b">
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <h2 className="text-xl font-serif font-bold text-foreground mb-5">
            Il tuo percorso confermato
          </h2>
          {sectorLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
              {/* Icon + name */}
              <div className="flex items-center gap-4 flex-1">
                <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
                  <SectorIcon name={sector?.icon} size={32} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Confermato</span>
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-foreground leading-tight">{sectorName}</h3>
                  {sector?.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 max-w-md">{sector.description}</p>
                  )}
                  {confirmedRec && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 rounded-full px-3 py-1">
                      <TrendingUp className="w-3 h-3" /> {confirmedRec.matchScore}% di compatibilità
                    </div>
                  )}
                </div>
              </div>
              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
                <Link href={`/roadmap/${confirmedSectorId}`}>
                  <Button className="w-full rounded-xl gap-2">
                    <Map className="w-4 h-4" /> Roadmap del settore
                  </Button>
                </Link>
                <Link href={`/grafo/${confirmedSectorId}`}>
                  <Button variant="outline" className="w-full rounded-xl gap-2">
                    <GitBranch className="w-4 h-4" /> Grafo delle competenze
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Il tuo progresso — objectives */}
      <section className="py-10 bg-card border-b">
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium mb-2">
                <Target className="w-3.5 h-3.5" /> Il tuo progresso
              </div>
              <h2 className="text-xl font-serif font-bold text-foreground">
                {objectivesLoading ? "Obiettivi" : totalCount > 0 ? `${completedCount} / ${totalCount} obiettivi completati` : "I tuoi obiettivi"}
              </h2>
            </div>
            <Link href="/profilo">
              <div className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
                Gestisci <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </div>

          {objectivesLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
            </div>
          ) : totalCount === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <Target className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm mb-3">Non hai ancora obiettivi. Creane uno dal tuo profilo.</p>
              <Link href="/profilo">
                <Button variant="outline" size="sm" className="rounded-xl">Vai al profilo</Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border bg-background overflow-hidden">
              {/* Progress bar */}
              {totalCount > 0 && (
                <div className="px-5 pt-4 pb-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground font-medium">Avanzamento complessivo</span>
                    <span className="text-xs font-bold text-primary">{Math.round((completedCount / totalCount) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-700"
                      style={{ width: `${Math.round((completedCount / totalCount) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="px-5 py-2">
                {inProgressObjectives.length > 0 ? (
                  inProgressObjectives.map(obj => <ObjectiveRow key={obj.id} obj={obj} />)
                ) : (
                  <p className="py-4 text-center text-sm text-emerald-700 font-medium">
                    <CheckCircle2 className="w-4 h-4 inline mr-1.5 mb-0.5" />
                    Tutti gli obiettivi completati!
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Recommendations summary */}
      <section className="py-10 bg-background border-b">
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-serif font-bold text-foreground">I tuoi risultati</h2>
            <Link href={`/risultati/${sessionId}`}>
              <div className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
                Dettaglio completo <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendations.map((rec, i) => (
              <Link key={rec.sectorId} href={`/settore/${rec.sectorId}`}>
                <div className={cn(
                  "group flex items-start gap-3 p-4 rounded-2xl border bg-card hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer h-full",
                  rec.sectorId === confirmedSectorId && "border-primary/40 bg-primary/5",
                )}>
                  <div className="shrink-0 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-sm font-serif font-bold">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground leading-tight mb-0.5 group-hover:text-primary transition-colors">
                      {rec.sectorName}
                      {rec.sectorId === confirmedSectorId && (
                        <span className="ml-2 text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">✓ Scelto</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{rec.matchReason}</p>
                    <div className="mt-1.5 text-xs font-semibold text-primary">{rec.matchScore}% match</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Crescita consigliata */}
      <section className="py-10 bg-card border-b">
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium mb-2">
                <BookOpen className="w-3.5 h-3.5" /> Crescita consigliata
              </div>
              <h2 className="text-xl font-serif font-bold text-foreground">Articoli per il tuo profilo</h2>
            </div>
            <Link href="/crescita">
              <div className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
                Vedi tutti <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </div>

          {articlesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
            </div>
          ) : articlesData?.articles && articlesData.articles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {articlesData.articles.slice(0, 3).map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <Newspaper className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Gli articoli personalizzati saranno disponibili a breve.</p>
              <Link href="/crescita">
                <Button variant="outline" size="sm" className="mt-4 rounded-xl">Esplora la sezione Crescita</Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Profile link */}
      <section className="py-8 bg-background">
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <Link href="/profilo">
            <div className="flex items-center justify-between p-5 rounded-2xl border bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">Il tuo profilo</p>
                  <p className="text-sm text-muted-foreground">Impostazioni account, preferenze e settori salvati</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
