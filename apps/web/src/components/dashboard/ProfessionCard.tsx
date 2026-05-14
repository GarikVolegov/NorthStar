import { TrendingUp, DollarSign } from "lucide-react";
import type { ProfessionResult } from "@/hooks/useAgentAnalysis";

export function ProfessionCard({ p, index }: { p: ProfessionResult; index: number }) {
  return (
    <div className="rounded-2xl border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full mb-1.5">
            #{index + 1}
          </div>
          <h3 className="font-semibold text-foreground leading-snug">{p.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{p.sector}</p>
        </div>
        {p.growthOutlook && (
          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-growth bg-growth/10 border border-growth/20 rounded-full px-2.5 py-0.5">
            <TrendingUp className="w-3 h-3" /> {p.growthOutlook}
          </span>
        )}
      </div>

      {p.salaryRange && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <DollarSign className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium text-foreground">{p.salaryRange}</span>
        </div>
      )}

      {p.skills && p.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {p.skills.slice(0, 4).map((sk) => (
            <span key={sk} className="text-xs bg-primary/8 text-primary rounded-full px-2.5 py-0.5 font-medium">
              {sk}
            </span>
          ))}
        </div>
      )}

      {p.riasecAlignment && (
        <p className="text-xs text-muted-foreground leading-relaxed">{p.riasecAlignment}</p>
      )}
    </div>
  );
}
