import { Link } from "wouter";
import { ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GrowthArticle } from "@/hooks/usePersonalizedArticles";

const DIFF_LABEL: Record<string, string> = {
  base: "Base", intermedio: "Intermedio", avanzato: "Avanzato",
};
const DIFF_COLOR: Record<string, string> = {
  base: "text-emerald-700 bg-emerald-50 border-emerald-200",
  intermedio: "text-amber-700 bg-amber-50 border-amber-200",
  avanzato: "text-rose-700 bg-rose-50 border-rose-200",
};

export function ArticleCard({ article }: { article: GrowthArticle }) {
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
