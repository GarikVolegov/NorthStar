import { CalendarioEventoModal } from "@/components/calendario/CalendarioEventoModal";
import { PushOptInBanner } from "@/components/calendario/PushOptInBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useWendyPageContext } from "@/hooks/useWendyPageContext";
import { apiFetch } from "@/lib/api-fetch";
import { ApiClientError, deleteJson, getJson } from "@/lib/apiClient";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameMonth,
  isToday, parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { it } from "date-fns/locale";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft, ChevronRight,
  Circle,
  Clock,
  Download,
  Loader2,
  PauseCircle,
  Plus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

export type EventCategory = "study" | "training" | "interview" | "deadline" | "task" | "follow-up";
export type EventPriority = "low" | "medium" | "high";
export type EventStatus = "todo" | "in-progress" | "done" | "postponed";

export interface CalendarReminder {
  id?: number;
  minutesBefore: number;
  enabled: boolean;
}

export interface CalendarEvent {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  category: EventCategory;
  priority: EventPriority;
  status: EventStatus;
  color: string | null;
  tags: string[];
  linkedSectorId: number | null;
  linkedGoal: string | null;
  linkedContentIds: number[];
  isRecurring: boolean;
  recurrenceRule: string | null;
  reminders: CalendarReminder[];
}

type ViewMode = "month" | "week" | "day";
type CalendarPageLabels = {
  addEvent: string;
  allDay: string;
  dayEmpty: string;
};

const CATEGORY_META: Record<EventCategory, { label: string; color: string; bg: string }> = {
  study:      { label: "Studio",      color: "text-blue-700",   bg: "bg-blue-100 border-blue-300" },
  training:   { label: "Formazione",  color: "text-purple-700", bg: "bg-purple-100 border-purple-300" },
  interview:  { label: "Colloquio",   color: "text-emerald-700",bg: "bg-emerald-100 border-emerald-300" },
  deadline:   { label: "Scadenza",    color: "text-red-700",    bg: "bg-red-100 border-red-300" },
  task:       { label: "Attività",    color: "text-amber-700",  bg: "bg-amber-100 border-amber-300" },
  "follow-up":{ label: "Follow-up",  color: "text-pink-700",   bg: "bg-pink-100 border-pink-300" },
};

const PRIORITY_META: Record<EventPriority, { label: string; dot: string }> = {
  low:    { label: "Bassa",  dot: "bg-slate-400" },
  medium: { label: "Media",  dot: "bg-amber-400" },
  high:   { label: "Alta",   dot: "bg-red-500" },
};

const STATUS_ICONS: Record<EventStatus, React.ReactNode> = {
  "todo":        <Circle className="h-3 w-3 text-slate-400" />,
  "in-progress": <PauseCircle className="h-3 w-3 text-amber-500" />,
  "done":        <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
  "postponed":   <AlertCircle className="h-3 w-3 text-red-400" />,
};

function getEventColor(event: CalendarEvent): string {
  return CATEGORY_META[event.category]?.bg ?? "bg-gray-100 border-gray-300";
}

function apiErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

export default function Calendario() {
  const { i18n } = useTranslation();
  const activeLanguage = (i18n.resolvedLanguage ?? i18n.language ?? "it").slice(0, 2);
  const pageTitle = useDynamicTranslation({
    locale: activeLanguage,
    key: "calendar.page.title",
    source: "Calendario",
    context: "Calendar page title",
  });
  const pageSubtitle = useDynamicTranslation({
    locale: activeLanguage,
    key: "calendar.page.subtitle",
    source: "Pianifica sessioni, scadenze e obiettivi",
    context: "Calendar page subtitle",
  });
  const viewLabels: Record<ViewMode, string> = {
    month: useDynamicTranslation({
      locale: activeLanguage,
      key: "calendar.view.month",
      source: "Mese",
      context: "Calendar view switcher label",
    }),
    week: useDynamicTranslation({
      locale: activeLanguage,
      key: "calendar.view.week",
      source: "Settimana",
      context: "Calendar view switcher label",
    }),
    day: useDynamicTranslation({
      locale: activeLanguage,
      key: "calendar.view.day",
      source: "Giorno",
      context: "Calendar view switcher label",
    }),
  };
  const exportTitle = useDynamicTranslation({
    locale: activeLanguage,
    key: "calendar.actions.exportTitle",
    source: "Esporta in Google Calendar / iCal",
    context: "Calendar export button title",
  });
  const exportLabel = useDynamicTranslation({
    locale: activeLanguage,
    key: "calendar.actions.exportIcs",
    source: "Esporta .ics",
    context: "Calendar export button label",
  });
  const newEventLabel = useDynamicTranslation({
    locale: activeLanguage,
    key: "calendar.actions.newEvent",
    source: "Nuovo evento",
    context: "Calendar create event button label",
  });
  const exportFailureMessage = useDynamicTranslation({
    locale: activeLanguage,
    key: "calendar.error.exportFailed",
    source: "Non siamo riusciti a esportare il calendario. Riprova tra poco.",
    context: "Calendar export failure message",
  });
  const previousPeriodLabel = useDynamicTranslation({
    locale: activeLanguage,
    key: "calendar.nav.previous",
    source: "Periodo precedente",
    context: "Calendar previous period aria label",
  });
  const todayLabel = useDynamicTranslation({
    locale: activeLanguage,
    key: "calendar.nav.today",
    source: "Vai a oggi",
    context: "Calendar today navigation button label",
  });
  const nextPeriodLabel = useDynamicTranslation({
    locale: activeLanguage,
    key: "calendar.nav.next",
    source: "Periodo successivo",
    context: "Calendar next period aria label",
  });
  const loadUnavailableTitle = useDynamicTranslation({
    locale: activeLanguage,
    key: "calendar.error.unavailableTitle",
    source: "Calendario non disponibile",
    context: "Calendar load error title",
  });
  const loadFallbackMessage = useDynamicTranslation({
    locale: activeLanguage,
    key: "calendar.error.loadFallback",
    source: "Non siamo riusciti a caricare gli eventi.",
    context: "Calendar load fallback error message",
  });
  const loadPreservedMessage = useDynamicTranslation({
    locale: activeLanguage,
    key: "calendar.error.loadPreserved",
    source: "Gli eventi non sono stati sostituiti da uno stato vuoto.",
    context: "Calendar load error assurance",
  });
  const retryLoadLabel = useDynamicTranslation({
    locale: activeLanguage,
    key: "calendar.actions.retryLoad",
    source: "Riprova caricamento calendario",
    context: "Calendar load retry button label",
  });
  const categoryLabels: Record<EventCategory, string> = {
    study: useDynamicTranslation({
      locale: activeLanguage,
      key: "calendar.categories.study",
      source: "Studio",
      context: "Calendar category label",
    }),
    training: useDynamicTranslation({
      locale: activeLanguage,
      key: "calendar.categories.training",
      source: "Formazione",
      context: "Calendar category label",
    }),
    interview: useDynamicTranslation({
      locale: activeLanguage,
      key: "calendar.categories.interview",
      source: "Colloquio",
      context: "Calendar category label",
    }),
    deadline: useDynamicTranslation({
      locale: activeLanguage,
      key: "calendar.categories.deadline",
      source: "Scadenza",
      context: "Calendar category label",
    }),
    task: useDynamicTranslation({
      locale: activeLanguage,
      key: "calendar.categories.task",
      source: "Attivita",
      context: "Calendar category label",
    }),
    "follow-up": useDynamicTranslation({
      locale: activeLanguage,
      key: "calendar.categories.followUp",
      source: "Follow-up",
      context: "Calendar category label",
    }),
  };
  const pageLabels: CalendarPageLabels = {
    addEvent: useDynamicTranslation({
      locale: activeLanguage,
      key: "calendar.actions.addEvent",
      source: "Aggiungi evento",
      context: "Calendar empty day add event button label",
    }),
    allDay: useDynamicTranslation({
      locale: activeLanguage,
      key: "calendar.event.allDay",
      source: "Tutto il giorno",
      context: "Calendar event all-day label",
    }),
    dayEmpty: useDynamicTranslation({
      locale: activeLanguage,
      key: "calendar.day.empty",
      source: "Nessun evento per questo giorno",
      context: "Calendar empty day message",
    }),
  };

  useWendyPageContext({
    page: 'calendario',
    title: pageTitle,
    capabilities: ['navigate', 'create_calendar_event', 'fill_form'],
    fields: ['event.title', 'event.date', 'event.category', 'event.notes'],
    actions: [pageLabels.addEvent, 'Pianifica settimana', 'Apri giorno'],
  });
  const { user, isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const [, routerNavigate] = useLocation();
  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showPushBanner, setShowPushBanner] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem("push_banner_dismissed");
    if (!dismissed && isLoggedIn) {
      setTimeout(() => setShowPushBanner(true), 1000);
    }
  }, [isLoggedIn]);

  const { from, to } = getDateRange(view, currentDate);

  const { data, isLoading, isError, error, refetch } = useQuery<{ events: CalendarEvent[] }>({
    queryKey: ["calendar-events", user?.id, from.toISOString(), to.toISOString()],
    queryFn: async () => {
      if (!user?.id) return { events: [] };
      return getJson<{ events: CalendarEvent[] }>(
        `${BASE}api/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}`,
      );
    },
    enabled: !!user?.id,
  });

  const events: CalendarEvent[] = data?.events ?? [];

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await deleteJson(`${BASE}api/calendar/events/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
  });

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setEditingEvent(null);
    setModalOpen(true);
  };

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEvent(event);
    setModalOpen(true);
  };

  const navigate = (dir: 1 | -1) => {
    if (view === "month") setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (view === "week") setCurrentDate(dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(dir === 1 ? addDays(currentDate, 1) : subDays(currentDate, 1));
  };

  const handleExportCalendar = async () => {
    setExportError(null);
    setIsExporting(true);

    try {
      const response = await apiFetch(`${BASE}api/calendar/export.ics`);
      if (!response.ok) {
        throw new Error(`calendar export failed: ${response.status}`);
      }

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "northstar-calendar.ics";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch {
      setExportError(exportFailureMessage);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) routerNavigate("/");
  }, [isLoggedIn, routerNavigate]);

  if (!isLoggedIn) return null;

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {showPushBanner && (
        <PushOptInBanner
          onDismiss={() => {
            setShowPushBanner(false);
            localStorage.setItem("push_banner_dismissed", "1");
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            {pageTitle}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{pageSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border bg-card overflow-hidden text-sm">
            {(["month", "week", "day"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-4 py-1.5 font-medium transition-colors capitalize",
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {viewLabels[v]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void handleExportCalendar()}
            disabled={isExporting}
            title={exportTitle}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary border border-border hover:border-primary/30 rounded-full px-3 py-1.5 transition-all disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {exportLabel}
          </button>
          <Button size="sm" className="rounded-full gap-1" onClick={() => { setEditingEvent(null); setSelectedDate(new Date()); setModalOpen(true); }}>
            <Plus className="h-4 w-4" /> {newEventLabel}
          </Button>
        </div>
      </div>

      {exportError && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {exportError}
        </div>
      )}

      {/* Calendar navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          aria-label={previousPeriodLabel}
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold capitalize">
            {view === "month" && format(currentDate, "MMMM yyyy", { locale: it })}
            {view === "week" && `${format(startOfWeek(currentDate, { locale: it }), "d MMM", { locale: it })} – ${format(endOfWeek(currentDate, { locale: it }), "d MMM yyyy", { locale: it })}`}
            {view === "day" && format(currentDate, "EEEE d MMMM yyyy", { locale: it })}
          </h2>
          <button
          type="button"
          aria-label={todayLabel}
            onClick={() => setCurrentDate(new Date())}
            className="text-xs px-3 py-1 rounded-full border hover:bg-muted transition-colors text-muted-foreground"
          >
            {todayLabel}
          </button>
        </div>
        <button
          type="button"
          aria-label={nextPeriodLabel}
          onClick={() => navigate(1)}
          className="p-2 rounded-full hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 space-y-2">
              <p className="font-semibold">{loadUnavailableTitle}</p>
              <p>
                {apiErrorMessage(error, loadFallbackMessage)}
                {" "}{loadPreservedMessage}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => void refetch()}
              >
                {retryLoadLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {view === "month" && (
            <MonthView
              currentDate={currentDate}
              events={events}
              onDayClick={handleDayClick}
              onEventClick={handleEventClick}
            />
          )}
          {view === "week" && (
            <WeekView
              currentDate={currentDate}
              events={events}
              onDayClick={handleDayClick}
              onEventClick={handleEventClick}
            />
          )}
          {view === "day" && (
            <DayView
              currentDate={currentDate}
              events={events}
              onEventClick={handleEventClick}
              onNewEvent={() => { setEditingEvent(null); setSelectedDate(currentDate); setModalOpen(true); }}
              labels={pageLabels}
              categoryLabels={categoryLabels}
            />
          )}
        </>
      )}

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-3">
        {(Object.entries(CATEGORY_META) as [EventCategory, typeof CATEGORY_META[EventCategory]][]).map(([key, meta]) => (
          <div key={key} className={cn("flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border", meta.bg, meta.color)}>
            {categoryLabels[key]}
          </div>
        ))}
      </div>

      <CalendarioEventoModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingEvent(null);
        }}
        userId={user!.id}
        defaultDate={selectedDate ?? new Date()}
        editingEvent={editingEvent}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["calendar-events"] })}
        onDeleted={(id) => deleteMutation.mutateAsync(id).then(() => undefined)}
      />
    </div>
  );
}

function getDateRange(view: ViewMode, date: Date): { from: Date; to: Date } {
  if (view === "month") {
    const start = startOfWeek(startOfMonth(date), { locale: it });
    const end = endOfWeek(endOfMonth(date), { locale: it });
    return { from: start, to: end };
  } else if (view === "week") {
    return { from: startOfWeek(date, { locale: it }), to: endOfWeek(date, { locale: it }) };
  } else {
    return { from: startOfDay(date), to: endOfDay(date) };
  }
}

function eventOverlapsDay(event: CalendarEvent, day: Date): boolean {
  const eventStart = parseISO(event.startAt);
  const eventEnd = parseISO(event.endAt);
  return eventStart <= endOfDay(day) && eventEnd >= startOfDay(day);
}

function MonthView({ currentDate, events, onDayClick, onEventClick }: {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (d: Date) => void;
  onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void;
}) {
  const start = startOfWeek(startOfMonth(currentDate), { locale: it });
  const end = endOfWeek(endOfMonth(currentDate), { locale: it });

  const days: Date[] = [];
  let d = start;
  while (!isBefore(end, d)) {
    days.push(d);
    d = addDays(d, 1);
  }

  const weekdays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b">
        {weekdays.map((w) => (
          <div key={w} className="text-center text-xs font-semibold text-muted-foreground py-2">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayEvents = events.filter((e) => eventOverlapsDay(e, day));
          const notCurrentMonth = !isSameMonth(day, currentDate);
          return (
            <div
              key={i}
              onClick={() => onDayClick(day)}
              className={cn(
                "min-h-[90px] md:min-h-[110px] p-1.5 border-r border-b cursor-pointer hover:bg-muted/50 transition-colors",
                notCurrentMonth && "opacity-40",
                isToday(day) && "bg-primary/5",
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-full text-sm font-medium flex items-center justify-center mb-1",
                isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground",
              )}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <EventChip key={ev.id} event={ev} onClick={(e) => onEventClick(ev, e)} />
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground pl-1">+{dayEvents.length - 3} altri</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ currentDate, events, onDayClick, onEventClick }: {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (d: Date) => void;
  onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void;
}) {
  const start = startOfWeek(currentDate, { locale: it });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b">
        {days.map((day) => (
          <div
            key={day.toISOString()}
            onClick={() => onDayClick(day)}
            className={cn(
              "text-center py-3 cursor-pointer hover:bg-muted/50 transition-colors border-r last:border-r-0",
              isToday(day) && "bg-primary/5",
            )}
          >
            <div className="text-xs text-muted-foreground capitalize">{format(day, "EEE", { locale: it })}</div>
            <div className={cn(
              "w-8 h-8 rounded-full text-sm font-semibold flex items-center justify-center mx-auto mt-0.5",
              isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground",
            )}>
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 min-h-[400px]">
        {days.map((day) => {
          const dayEvents = events.filter((e) => eventOverlapsDay(e, day));
          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                "p-2 border-r last:border-r-0 cursor-pointer hover:bg-muted/30 transition-colors",
                isToday(day) && "bg-primary/5",
              )}
            >
              <div className="space-y-1">
                {dayEvents.map((ev) => (
                  <EventChip key={ev.id} event={ev} onClick={(e) => onEventClick(ev, e)} showTime />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ currentDate, events, onEventClick, onNewEvent, labels, categoryLabels }: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void;
  onNewEvent: () => void;
  labels: CalendarPageLabels;
  categoryLabels: Record<EventCategory, string>;
}) {
  const dayEvents = events
    .filter((e) => eventOverlapsDay(e, currentDate))
    .sort((a, b) => parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime());

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className={cn("px-4 py-3 border-b", isToday(currentDate) && "bg-primary/5")}>
        <h3 className="font-semibold capitalize">{format(currentDate, "EEEE d MMMM yyyy", { locale: it })}</h3>
        <p className="text-sm text-muted-foreground">{dayEvents.length} evento{dayEvents.length !== 1 ? "i" : ""}</p>
      </div>
      <div className="p-4 space-y-3 min-h-[300px]">
        {dayEvents.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm">{labels.dayEmpty}</p>
            <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={onNewEvent}>
              <Plus className="h-3.5 w-3.5 mr-1" /> {labels.addEvent}
            </Button>
          </div>
        ) : (
          dayEvents.map((ev) => (
            <div
              key={ev.id}
              onClick={(e) => onEventClick(ev, e)}
              className={cn(
                "flex items-start gap-3 p-3 rounded-xl border cursor-pointer hover:shadow-sm transition-all",
                getEventColor(ev),
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">{ev.title}</span>
                  <div className={cn("w-2 h-2 rounded-full shrink-0", PRIORITY_META[ev.priority].dot)} />
                  {STATUS_ICONS[ev.status]}
                </div>
                {ev.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ev.description}</p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {ev.allDay ? "Tutto il giorno" : `${format(parseISO(ev.startAt), "HH:mm")} – ${format(parseISO(ev.endAt), "HH:mm")}`}
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="text-xs shrink-0">{categoryLabels[ev.category]}</Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EventChip({ event, onClick, showTime }: {
  event: CalendarEvent;
  onClick: (e: React.MouseEvent) => void;
  showTime?: boolean;
}) {
  const meta = CATEGORY_META[event.category];
  return (
    <div
      onClick={onClick}
      className={cn(
        "text-xs px-1.5 py-0.5 rounded truncate cursor-pointer border font-medium flex items-center gap-1",
        meta.bg, meta.color,
      )}
    >
      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", PRIORITY_META[event.priority].dot)} />
      <span className="truncate">
        {showTime && !event.allDay && `${format(parseISO(event.startAt), "HH:mm")} `}
        {event.title}
      </span>
    </div>
  );
}
