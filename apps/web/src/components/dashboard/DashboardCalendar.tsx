import { useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, CalendarDays, ArrowRight } from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, format, addMonths, subMonths, isToday,
} from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { DashboardEvent } from "@/hooks/useDashboardData";

const CATEGORY_DOT: Record<string, string> = {
  study:      "bg-blue-400",
  training:   "bg-violet-400",
  interview:  "bg-emerald-400",
  deadline:   "bg-red-400",
  task:       "bg-amber-400",
  "follow-up":"bg-primary",
};

const CATEGORY_LABEL: Record<string, string> = {
  study: "Studio", training: "Formazione", interview: "Colloquio",
  deadline: "Scadenza", task: "Attività", "follow-up": "Verifica",
};

function getEventsForDay(events: DashboardEvent[], day: Date): DashboardEvent[] {
  return events.filter((e) => isSameDay(new Date(e.startAt), day));
}

export function DashboardCalendar({ events }: { events: DashboardEvent[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd     = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const allDays    = eachDayOfInterval({ start: calStart, end: calEnd });

  const selectedEvents = selectedDay ? getEventsForDay(events, selectedDay) : [];

  const dayNames = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  return (
    <div className="rounded-2xl border bg-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <CalendarDays className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm leading-tight">Calendario</h3>
            <p className="text-xs text-muted-foreground capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: it })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setCurrentMonth(subMonths(currentMonth, 1)); setSelectedDay(null); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setCurrentMonth(addMonths(currentMonth, 1)); setSelectedDay(null); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground/60 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {allDays.map((day) => {
          const dayEvents = getEventsForDay(events, day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDay = isToday(day);
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDay(isSameDay(selectedDay ?? new Date(0), day) ? null : day)}
              className={cn(
                "relative flex flex-col items-center py-1.5 rounded-lg transition-all text-xs font-medium",
                !isCurrentMonth && "opacity-30",
                isTodayDay && !isSelected && "bg-primary/10 text-primary font-bold",
                isSelected && "bg-primary text-primary-foreground",
                !isTodayDay && !isSelected && isCurrentMonth && "hover:bg-muted text-foreground",
              )}
            >
              <span>{format(day, "d")}</span>
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 h-1.5">
                  {dayEvents.slice(0, 3).map((e, i) => (
                    <span
                      key={i}
                      className={cn(
                        "w-1 h-1 rounded-full",
                        isSelected ? "bg-primary-foreground/70" : (CATEGORY_DOT[e.category ?? "task"] ?? "bg-muted-foreground/50")
                      )}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day events */}
      {selectedDay && (
        <div className="mt-4 border-t border-border pt-3 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground mb-2 capitalize">
            {format(selectedDay, "EEEE d MMMM", { locale: it })}
          </p>
          {selectedEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic">Nessun evento</p>
          ) : (
            selectedEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-2">
                <span className={cn("w-2 h-2 rounded-full shrink-0", CATEGORY_DOT[e.category ?? "task"] ?? "bg-muted-foreground/50")} />
                <span className="text-xs text-foreground truncate">{e.title}</span>
                <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                  {CATEGORY_LABEL[e.category ?? "task"] ?? e.category}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Footer */}
      <Link href="/calendario" className="flex items-center gap-1 text-xs text-primary font-semibold mt-4 hover:gap-1.5 transition-all">
        Apri calendario completo <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
