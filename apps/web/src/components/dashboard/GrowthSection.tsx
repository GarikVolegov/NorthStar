import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { GrowthArticle } from "@/hooks/usePersonalizedArticles";
import { ArrowRight, BookOpen, Newspaper } from "lucide-react";
import { Link } from "wouter";
import { ArticleCard } from "./ArticleCard";

export function GrowthSection({
  articles,
  articlesLoading,
}: {
  articles: GrowthArticle[] | undefined;
  articlesLoading: boolean;
}) {
  return (
    <section className="py-10 bg-background border-b">
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
        ) : articles && articles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {articles.slice(0, 3).map((a) => <ArticleCard key={a.id} article={a} />)}
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
  );
}
