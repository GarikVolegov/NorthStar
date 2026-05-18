import { useQuery } from "@tanstack/react-query";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar, Clock, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";

const BASE = import.meta.env.BASE_URL || "/";

const CATEGORY_COLORS: Record<string, string> = {
  study:      "bg-blue-100 border-blue-300 text-blue-700",
  training:   "bg-purple-100 border-purple-300 text-purple-700",
  interview:  "bg-emerald-100 border-emerald-300 text-emerald-700",
  deadline:   "bg-red-100 border-red-300 text-red-700",
  task:       "bg-amber-100 border-amber-300 text-amber-700",
  "follow-up":"bg-pink-100 border-pink-300 text-pink-700",
};

const PRIORITY_DOT: Record<string, string> = {
  low:    "bg-slate-400",
  medium: "bg-amber-400",
  high:   "bg-red-500",
};

const CATEGORY_LABELS: Record<string, string> = {
  study: "Studio", training: "Form.", interview: "Colloquio",
  deadline: "Scadenza", task: "Attività", "follow-up": "Follow-up",
};

function formatEventDate(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return `Oggi ${format(d, "HH:mm")}`;
  if (isTomorrow(d)) return `Domani ${format(d, "HH:mm")}`;
  return format(d, "d MMM, HH:mm", { locale: it });
}

interface UpcomingEvent {
  id: number;
  title: string;
  startAt: string;
  priority: string;
  category: string;
}

interface Props {
  userId: number;
  limit?: number;
  className?: string;
}

export function ProssimiEventi({ userId, limit = 5, className }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["calendar-upcoming", userId, limit],
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/calendar/upcoming?limit=${limit}`);
      if (!res.ok) throw new Error("Errore caricamento eventi");
      return res.json();
    },
    enabled: !!userId,
    refetchInterval: 5 * 60_000,
  });

  const events: UpcomingEvent[] = Array.isArray(data) ? data : (data?.events ?? []);

  return (
    <div className={cn("rounded-xl border bg-card", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Prossimi eventi</h3>
        </div>
        <Link href="/calendario" className="text-xs text-primary hover:underline flex items-center gap-0.5">
          Vedi tutti <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="divide-y">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <div className="py-8 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">Nessun evento in programma</p>
            <Link href="/calendario" className="text-xs text-primary hover:underline mt-1 block">
              Aggiungi il primo evento →
            </Link>
          </div>
        ) : (
          events.map((ev) => (
            <Link key={ev.id} href="/calendario" className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
              <div className={cn("w-1.5 h-10 rounded-full shrink-0", PRIORITY_DOT[ev.priority] ?? "bg-slate-300")} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ev.title}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{formatEventDate(ev.startAt)}</span>
                </div>
              </div>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full border font-medium shrink-0",
                CATEGORY_COLORS[ev.category] ?? "bg-gray-100 text-gray-700 border-gray-200",
              )}>
                {CATEGORY_LABELS[ev.category] ?? ev.category}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
