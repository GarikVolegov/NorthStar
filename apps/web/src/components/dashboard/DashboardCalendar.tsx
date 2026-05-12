import { Link } from "wouter";
import { CalendarDays, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardEvent } from "@/hooks/useDashboardData";

const CATEGORY_LABELS: Record<string, string> = {
  study: "Studio",
  training: "Formazione",
  interview: "Colloquio",
  deadline: "Scadenza",
  task: "Attività",
  "follow-up": "Verifica",
};

const CATEGORY_COLORS: Record<string, string> = {
  study: "text-blue-400 bg-blue-400/10",
  training: "text-purple-400 bg-purple-400/10",
  interview: "text-emerald-400 bg-emerald-400/10",
  deadline: "text-red-400 bg-red-400/10",
  task: "text-amber-400 bg-amber-400/10",
  "follow-up": "text-primary bg-primary/10",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export function DashboardCalendar({ events }: { events: DashboardEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <CalendarDays className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">Prossimi eventi</h3>
        </div>
        <Link href="/calendario" className="text-xs text-primary font-semibold hover:underline shrink-0">
          Vedi calendario <ArrowRight className="w-3 h-3 inline ml-0.5" />
        </Link>
      </div>

      <div className="space-y-2">
        {events.map((e) => (
          <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
            <span className="text-xs font-semibold text-muted-foreground w-14 shrink-0">
              {formatDate(e.startAt)}
            </span>
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full shrink-0",
              CATEGORY_COLORS[e.category ?? "task"] ?? "text-muted-foreground bg-muted"
            )}>
              {CATEGORY_LABELS[e.category ?? "task"] ?? e.category}
            </span>
            <span className="text-sm text-foreground truncate">{e.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
