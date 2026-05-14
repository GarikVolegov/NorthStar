import { LayoutGrid } from "lucide-react";
import { ToolCard } from "./ToolCard";
import type { ToolItem } from "./ToolCard";
export type { ToolItem };

export function ToolsGrid({ tools }: { tools: ToolItem[] }) {
  return (
    <section className="py-12 bg-card border-b">
      <div className="container mx-auto px-4 md:px-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium mb-2">
              <LayoutGrid className="w-3.5 h-3.5" /> Tutti gli strumenti
            </div>
            <h2 className="text-2xl font-serif font-bold text-foreground">
              Le tue funzionalità
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Tutto quello che NorthStar mette a tua disposizione, in un colpo d'occhio.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {tools.map((tool) => (
            <ToolCard key={tool.href + tool.title} tool={tool} />
          ))}
        </div>
      </div>
    </section>
  );
}
