import type { DashboardEvent, DashboardObjective } from "@/hooks/useDashboardData";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { cn } from "@/lib/utils";
import {
  addDays,
  format,
  isAfter,
  isSameDay,
  startOfDay,
  type Locale,
} from "date-fns";
import { enUS, it } from "date-fns/locale";
import { ArrowRight, CalendarClock } from "lucide-react";
import { useTranslation } from "react-i18next";
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

type TimelineItem = {
  id: string;
  title: string;
  category: string;
  startAt: string;
  kind: "event" | "objective";
};

function useDashboardLocale(): string {
  const { i18n } = useTranslation();
  return i18n.resolvedLanguage || i18n.language || "it";
}

function getDateLocale(locale: string) {
  return locale.toLowerCase().startsWith("it") ? it : enUS;
}

function useTimelineCopy(locale: string) {
  return {
    title: useDynamicTranslation({
      locale,
      key: "dashboard.weekTimeline.title",
      source: "Timeline settimanale",
      context: "Dashboard weekly timeline title",
    }),
    subtitle: useDynamicTranslation({
      locale,
      key: "dashboard.weekTimeline.subtitle",
      source: "Eventi della settimana e prossima azione.",
      context: "Dashboard weekly timeline subtitle",
    }),
    manage: useDynamicTranslation({
      locale,
      key: "dashboard.weekTimeline.manage",
      source: "Gestisci",
      context: "Dashboard weekly timeline link to calendar management",
    }),
    nextLabel: useDynamicTranslation({
      locale,
      key: "dashboard.weekTimeline.nextLabel",
      source: "Prossimo evento",
      context: "Dashboard weekly timeline next item label",
    }),
    emptyTitle: useDynamicTranslation({
      locale,
      key: "dashboard.weekTimeline.empty.title",
      source: "Nessuna azione programmata questa settimana",
      context: "Dashboard weekly timeline empty state title",
    }),
    emptyCopy: useDynamicTranslation({
      locale,
      key: "dashboard.weekTimeline.empty.copy",
      source: "Aggiungi un evento o assegna una scadenza a un obiettivo per vedere il piano reale della settimana.",
      context: "Dashboard weekly timeline empty state guidance",
    }),
    emptyCta: useDynamicTranslation({
      locale,
      key: "dashboard.weekTimeline.empty.cta",
      source: "Apri calendario",
      context: "Dashboard weekly timeline empty state CTA",
    }),
    fallbackCategory: useDynamicTranslation({
      locale,
      key: "dashboard.weekTimeline.categories.event",
      source: "Evento",
      context: "Dashboard weekly timeline fallback category label",
    }),
    categories: {
      study: useDynamicTranslation({ locale, key: "dashboard.weekTimeline.categories.study", source: "Studio", context: "Dashboard weekly timeline category label" }),
      training: useDynamicTranslation({ locale, key: "dashboard.weekTimeline.categories.training", source: "Formazione", context: "Dashboard weekly timeline category label" }),
      interview: useDynamicTranslation({ locale, key: "dashboard.weekTimeline.categories.interview", source: "Colloquio", context: "Dashboard weekly timeline category label" }),
      deadline: useDynamicTranslation({ locale, key: "dashboard.weekTimeline.categories.deadline", source: "Scadenza", context: "Dashboard weekly timeline category label" }),
      task: useDynamicTranslation({ locale, key: "dashboard.weekTimeline.categories.task", source: "Attivita", context: "Dashboard weekly timeline category label" }),
      "follow-up": useDynamicTranslation({ locale, key: "dashboard.weekTimeline.categories.follow-up", source: "Verifica", context: "Dashboard weekly timeline category label" }),
      objective: useDynamicTranslation({ locale, key: "dashboard.weekTimeline.categories.objective", source: "Obiettivo", context: "Dashboard weekly timeline category label" }),
    },
  };
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

function describeItem(
  item: TimelineItem | null,
  categoryLabels: Record<string, string>,
  fallbackCategory: string,
  dateLocale: Locale,
): string {
  if (!item) return "";
  const date = new Date(item.startAt);
  const category = categoryLabels[item.category] ?? fallbackCategory;
  return `${category}: ${item.title}, ${format(date, "EEEE d MMMM", { locale: dateLocale })}.`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatWeekdayLabel(day: Date, dateLocale: Locale): string {
  return capitalize(format(day, "EEE", { locale: dateLocale }).replace(".", ""));
}

export function DashboardWeekTimeline({
  events,
  objectives = [],
}: {
  events: DashboardEvent[];
  objectives?: DashboardObjective[];
}) {
  const locale = useDashboardLocale();
  const dateLocale = getDateLocale(locale);
  const copy = useTimelineCopy(locale);
  const timelineItems = buildTimelineItems(events, objectives);
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
            <h3 className="font-semibold text-foreground text-sm leading-tight">{copy.title}</h3>
            <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
          </div>
        </div>
        <Link href="/calendario" className="text-xs text-primary font-semibold hover:underline shrink-0">
          {copy.manage}
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
                        CATEGORY_TONE[item.category] ?? "border-border bg-muted text-muted-foreground",
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
              const weekdayLabel = formatWeekdayLabel(day, dateLocale);
              return (
                <div
                  key={day.toISOString()}
                  aria-label={`${weekdayLabel} ${format(day, "d MMMM", { locale: dateLocale })}`}
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
                      hasItems && !isCurrentDay ? "border-foreground/30 text-foreground" : "",
                    )}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-semibold text-muted-foreground">
                      {weekdayLabel}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {format(day, "MMM", { locale: dateLocale })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {nextItem ? (
        <div className="rounded-xl border bg-muted/25 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            {copy.nextLabel}
          </p>
          <p className="text-sm font-semibold text-foreground">
            {nextItem.title}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {describeItem(nextItem, copy.categories, copy.fallbackCategory, dateLocale)}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-muted/20 p-3">
          <p className="text-sm font-semibold text-foreground">{copy.emptyTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{copy.emptyCopy}</p>
          <Link href="/calendario" className="mt-2 inline-flex text-xs font-semibold text-primary hover:underline">
            {copy.emptyCta}
          </Link>
        </div>
      )}
    </section>
  );
}
