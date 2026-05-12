import { Link } from "wouter";
import { BookOpen, ArrowRight } from "lucide-react";

interface GrowthArticle {
  title: string;
  slug: string;
  area?: string;
  readTime?: string;
}

export function DashboardGrowth({ articles }: { articles?: GrowthArticle[] }) {
  if (!articles || articles.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <BookOpen className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">Per te</h3>
          <p className="text-xs text-muted-foreground">Articoli consigliati per il tuo percorso</p>
        </div>
        <Link href="/crescita" className="text-xs text-primary font-semibold hover:underline shrink-0">
          Esplora <ArrowRight className="w-3 h-3 inline ml-0.5" />
        </Link>
      </div>

      <div className="space-y-2">
        {articles.map((a) => (
          <Link key={a.slug} href={`/crescita/articolo/${a.slug}`}>
            <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{a.title}</p>
                {a.readTime && (
                  <p className="text-xs text-muted-foreground">{a.readTime}</p>
                )}
              </div>
              {a.area && (
                <span className="text-xs text-muted-foreground shrink-0">{a.area}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
