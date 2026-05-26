import type { DashboardEvent, DashboardObjective } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";
import {
  addDays,
  format,
  isAfter,
  isSameDay,
  startOfDay,
} from "date-fns";
import { it } from "date-fns/locale";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Link } from "wouter";

const CATEGORY_TONE: Record<string, string> = {
  study: "border-blue-200 bg-blue-50 text-blue-700",
  training: "border-violet-200 bg-violet-50 text-violet-700",
  interview: "border-emerald-200 bg-emerald-50 text-emerald-700",
  deadline: "border-red-200 bg-red-50 text-red-700",
  task: "border-amber-200 bg-amber-50 text-amber-700",
  "follow-up": "border-primary/20 bg-primary/10 text-primary",
  objective: "border-sky-200 bg-sky-50 text-sky-700",
};

const CATEGORY_LABEL: Record<string, string> = {
  study: "Studio",
  training: "Formazione",
  interview: "Colloquio",
  deadline: "Scadenza",
  task: "Attivita",
  "follow-up": "Verifica",
  objective: "Obiettivo",
};

type TimelineItem = {
  id: string;
  title: string;
  category: string;
  startAt: string;
  kind: "event" | "objective" | "preset";
};

function buildPresetEvents(): TimelineItem[] {
  const timelineStart = startOfDay(new Date());
  return [
    {
      id: "preset:-1",
      title: "Revisione obiettivi",
      category: "task",
      startAt: addDays(timelineStart, 1).toISOString(),
      kind: "preset",
    },
    {
      id: "preset:-2",
      title: "Focus crescita",
      category: "training",
      startAt: addDays(timelineStart, 3).toISOString(),
      kind: "preset",
    },
    {
      id: "preset:-3",
      title: "Check progressi",
      category: "follow-up",
      startAt: addDays(timelineStart, 5).toISOString(),
      kind: "preset",
    },
  ];
}

function objectiveDate(objective: DashboardObjective, fallbackIndex: number): Date {
  if (objective.dueDate) {
    return new Date(`${objective.dueDate}T12:00:00`);
  }
  return addDays(startOfDay(new Date()), Math.min(fallbackIndex, 6));
}

function buildTimelineItems(events: DashboardEvent[], objectives: DashboardObjective[]): TimelineItem[] {
  const eventItems: TimelineItem[] = events.map((event) => ({
    id: `event:${event.id}`,
    title: event.title,
    category: event.category ?? "task",
    startAt: event.startAt,
    kind: "event",
  }));

  const objectiveItems: TimelineItem[] = objectives
    .filter((objective) => !objective.completed)
    .map((objective, index) => ({
      id: `objective:${objective.id}`,
      title: objective.text,
      category: "objective",
      startAt: objectiveDate(objective, index).toISOString(),
      kind: "objective",
    }));

  return [...eventItems, ...objectiveItems].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

function getNextItem(items: TimelineItem[]): TimelineItem | null {
  const now = new Date();
  return items.find((item) => isAfter(new Date(item.startAt), now)) ?? items[0] ?? null;
}

function getItemsForDay(items: TimelineItem[], day: Date): TimelineItem[] {
  return items.filter((item) => isSameDay(new Date(item.startAt), day));
}

function describeItem(item: TimelineItem | null, isPresetPlan: boolean): string {
  if (!item) return "Nessuna azione programmata per questa settimana.";
  const date = new Date(item.startAt);
  const category = CATEGORY_LABEL[item.category] ?? "Evento";
  const prefix = isPresetPlan ? "Traccia predefinita" : category;
  return `${prefix}: ${item.title}, ${format(date, "EEEE d MMMM", { locale: it })}.`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatWeekdayLabel(day: Date): string {
  return capitalize(format(day, "EEE", { locale: it }).replace(".", ""));
}

export function DashboardWeekTimeline({
  events,
  objectives = [],
}: {
  events: DashboardEvent[];
  objectives?: DashboardObjective[];
}) {
  const isPresetPlan = events.length === 0 && objectives.length === 0;
  const timelineItems = isPresetPlan ? buildPresetEvents() : buildTimelineItems(events, objectives);
  const nextItem = getNextItem(timelineItems);
  const timelineStart = startOfDay(new Date());
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(timelineStart, index));

  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <CalendarClock className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm leading-tight">Timeline settimanale</h3>
            <p className="text-xs text-muted-foreground">
              Eventi della settimana e prossima azione.
            </p>
          </div>
        </div>
        <Link href="/calendario" className="text-xs text-primary font-semibold hover:underline shrink-0">
          Gestisci
        </Link>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {weekDays.map((day) => {
              const dayItems = getItemsForDay(timelineItems, day);
              return (
                <div key={day.toISOString()} className="min-h-12 flex flex-col items-center justify-end gap-1">
                  {dayItems.slice(0, 2).map((item) => (
                    <span
                      key={item.id}
                      className={cn(
                        "max-w-full rounded-full border px-2 py-1 text-[10px] font-semibold leading-none truncate",
                        CATEGORY_TONE[item.category] ?? "border-border bg-muted text-muted-foreground"
                      )}
                      title={item.title}
                    >
                      {item.title}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-7 items-center">
            {weekDays.map((day, index) => {
              const isCurrentDay = isSameDay(day, new Date());
              const hasItems = getItemsForDay(timelineItems, day).length > 0;
              const weekdayLabel = formatWeekdayLabel(day);
              return (
                <div
                  key={day.toISOString()}
                  aria-label={`${weekdayLabel} ${format(day, "d MMMM", { locale: it })}`}
                  className="relative flex flex-col items-center gap-2"
                >
                  <div className="absolute top-4 left-1/2 right-0 h-0.5 bg-border" />
                  {index > 0 && <div className="absolute top-4 left-0 right-1/2 h-0.5 bg-border" />}
                  {index === weekDays.length - 1 && (
                    <ArrowRight className="absolute top-[9px] right-0 w-3.5 h-3.5 text-border" />
                  )}
                  <div
                    className={cn(
                      "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold bg-card",
                      isCurrentDay ? "border-primary text-primary shadow-sm" : "border-border text-muted-foreground",
                      hasItems && !isCurrentDay ? "border-foreground/30 text-foreground" : ""
                    )}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-semibold text-muted-foreground">
                      {weekdayLabel}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {format(day, "MMM", { locale: it })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-muted/25 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Prossimo evento
        </p>
        <p className="text-sm font-semibold text-foreground">
          {nextItem?.title ?? "Nessuna azione"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {describeItem(nextItem, isPresetPlan)}
        </p>
      </div>
    </section>
  );
}
