import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Trash2,
  Bell,
  Crown,
  AlertTriangle,
  ExternalLink,
  BookOpen,
  Map,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type {
  CalendarEvent,
  EventCategory,
  EventPriority,
  EventStatus,
} from "@/pages/calendar";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL || "/";

const PREMIUM_REMINDER_MINUTES = [10, 30, 120, 1440];
const FREE_REMINDER_MINUTES = [30, 120];

const eventFormSchema = z.object({
  title: z.string().min(1, "Titolo obbligatorio").max(200),
  description: z.string().max(2000).optional(),
  startDate: z.string().min(1, "Data obbligatoria"),
  startTime: z.string().optional(),
  endDate: z.string().min(1, "Data obbligatoria"),
  endTime: z.string().optional(),
  allDay: z.boolean().default(false),
  category: z.enum([
    "study",
    "training",
    "interview",
    "deadline",
    "task",
    "follow-up",
  ] as const),
  priority: z.enum(["low", "medium", "high"] as const),
  status: z.enum(["todo", "in-progress", "done", "postponed"] as const),
  linkedGoal: z.string().max(500).optional(),
  linkedSectorId: z.string().optional(),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
  defaultDate: Date;
  editingEvent: CalendarEvent | null;
  onSaved: () => void;
  onDeleted: (id: number) => void;
}

interface Sector {
  id: number;
  name: string;
  icon: string;
}

interface Objective {
  id: number;
  text: string;
  category: string;
  completed: boolean;
}

export function CalendarioEventoModal({
  open,
  onOpenChange,
  userId,
  defaultDate,
  editingEvent,
  onSaved,
  onDeleted,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [reminderToggles, setReminderToggles] = useState<
    Record<number, boolean>
  >({});
  const [showUpgradeHint, setShowUpgradeHint] = useState(false);

  const { data: quotaData } = useQuery({
    queryKey: ["calendar-quota"],
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/calendar/quota`);
      if (!res.ok) return { isPremium: false };
      return res.json() as Promise<{
        isPremium: boolean;
        eventCount: number;
        eventLimit: number | null;
      }>;
    },
    enabled: !!userId,
  });
  const isPremium = !!quotaData?.isPremium;
  const allowedReminders = isPremium
    ? PREMIUM_REMINDER_MINUTES
    : FREE_REMINDER_MINUTES;

  const { data: sectors = [] } = useQuery<Sector[]>({
    queryKey: ["sectors-list"],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/sectors`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data as Sector[]) ?? [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: objectives = [] } = useQuery<Objective[]>({
    queryKey: ["objectives-me"],
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/objectives/me`);
      if (!res.ok) return [];
      return res.json() as Promise<Objective[]>;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const activeObjectives = objectives.filter((o) => !o.completed);

  const dateStr = format(defaultDate, "yyyy-MM-dd");
  const timeStr = format(defaultDate, "HH:mm");

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      startDate: dateStr,
      startTime: timeStr,
      endDate: dateStr,
      endTime: format(
        new Date(defaultDate.getTime() + 60 * 60 * 1000),
        "HH:mm",
      ),
      allDay: false,
      category: "task",
      priority: "medium",
      status: "todo",
      linkedGoal: "",
      linkedSectorId: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editingEvent) {
      const start = new Date(editingEvent.startAt);
      const end = new Date(editingEvent.endAt);
      form.reset({
        title: editingEvent.title,
        description: editingEvent.description ?? "",
        startDate: format(start, "yyyy-MM-dd"),
        startTime: format(start, "HH:mm"),
        endDate: format(end, "yyyy-MM-dd"),
        endTime: format(end, "HH:mm"),
        allDay: editingEvent.allDay,
        category: editingEvent.category,
        priority: editingEvent.priority,
        status: editingEvent.status,
        linkedGoal: editingEvent.linkedGoal ?? "",
        linkedSectorId: editingEvent.linkedSectorId?.toString() ?? "",
      });
      const toggles: Record<number, boolean> = {};
      PREMIUM_REMINDER_MINUTES.forEach((m) => {
        toggles[m] = false;
      });
      editingEvent.reminders.forEach((r) => {
        toggles[r.minutesBefore] = r.enabled;
      });
      setReminderToggles(toggles);
    } else {
      form.reset({
        title: "",
        description: "",
        startDate: dateStr,
        startTime: timeStr,
        endDate: dateStr,
        endTime: format(
          new Date(defaultDate.getTime() + 60 * 60 * 1000),
          "HH:mm",
        ),
        allDay: false,
        category: "task",
        priority: "medium",
        status: "todo",
        linkedGoal: "",
        linkedSectorId: "",
      });
      setReminderToggles({});
    }
    setShowUpgradeHint(false);
  }, [open, editingEvent, dateStr, timeStr]);

  const toggleReminder = (minutes: number) => {
    if (!isPremium && !FREE_REMINDER_MINUTES.includes(minutes)) {
      setShowUpgradeHint(true);
      return;
    }
    setReminderToggles((prev) => ({ ...prev, [minutes]: !prev[minutes] }));
  };

  const buildPayload = (values: EventFormValues) => {
    const localToUtc = (date: string, time: string) =>
      new Date(`${date}T${time || "00:00"}`).toISOString();

    const startAt = values.allDay
      ? `${values.startDate}T00:00:00.000Z`
      : localToUtc(values.startDate, values.startTime || "00:00");
    const endAt = values.allDay
      ? `${values.endDate}T23:59:59.000Z`
      : localToUtc(values.endDate, values.endTime || "23:59");

    const reminders = PREMIUM_REMINDER_MINUTES.filter(
      (m) => reminderToggles[m],
    ).map((m) => ({ minutesBefore: m, enabled: true }));

    return {
      title: values.title,
      description: values.description || null,
      startAt,
      endAt,
      allDay: values.allDay,
      category: values.category,
      priority: values.priority,
      status: values.status,
      linkedGoal: values.linkedGoal || null,
      linkedSectorId: values.linkedSectorId
        ? parseInt(values.linkedSectorId, 10)
        : null,
      reminders,
    };
  };

  const onSubmit = async (values: EventFormValues) => {
    setSaving(true);
    try {
      const payload = buildPayload(values);
      const url = editingEvent
        ? `${BASE}api/calendar/events/${editingEvent.id}`
        : `${BASE}api/calendar/events`;
      const method = editingEvent ? "PATCH" : "POST";

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === "FREE_LIMIT_REACHED") {
          toast({
            title: t("calendar.freeLimitTitle"),
            description: data.message,
            variant: "destructive",
          });
        } else if (data.code === "PREMIUM_REQUIRED") {
          toast({
            title: t("calendar.premiumFeatureTitle"),
            description: t("calendar.premiumFeatureDesc"),
            variant: "destructive",
          });
        } else {
          toast({
            title: t("calendar.errorTitle"),
            description: data.error || t("calendar.errorSaving"),
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: editingEvent
          ? t("calendar.eventUpdated")
          : t("calendar.eventCreated"),
        description: values.title,
      });
      onSaved();
      onOpenChange(false);
    } catch {
      toast({ title: t("calendar.networkError"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const allDay = form.watch("allDay");
  const selectedSectorId = form.watch("linkedSectorId");
  const selectedSector = sectors.find(
    (s) => s.id.toString() === selectedSectorId,
  );

  const reminderLabels: Record<number, string> = {
    10: t("calendar.remindersLabels.10"),
    30: t("calendar.remindersLabels.30"),
    120: t("calendar.remindersLabels.120"),
    1440: t("calendar.remindersLabels.1440"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingEvent ? t("calendar.editEvent") : t("calendar.newEvent")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div>
            <Label htmlFor="title">{t("calendar.title")}</Label>
            <Input
              id="title"
              {...form.register("title")}
              placeholder={t("calendar.titlePlaceholder")}
              className="mt-1"
            />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive mt-1">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">{t("calendar.description")}</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              rows={2}
              placeholder={t("calendar.descPlaceholder")}
              className="mt-1 resize-none"
            />
          </div>

          {/* All day toggle */}
          <div className="flex items-center gap-3">
            <Switch
              id="allDay"
              checked={form.watch("allDay")}
              onCheckedChange={(v) => form.setValue("allDay", v)}
            />
            <Label htmlFor="allDay" className="cursor-pointer">
              {t("calendar.allDay")}
            </Label>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("calendar.startDate")}</Label>
              <Input
                type="date"
                {...form.register("startDate")}
                className="mt-1"
              />
            </div>
            {!allDay && (
              <div>
                <Label>{t("calendar.startTime")}</Label>
                <Input
                  type="time"
                  {...form.register("startTime")}
                  className="mt-1"
                />
              </div>
            )}
            <div>
              <Label>{t("calendar.endDate")}</Label>
              <Input
                type="date"
                {...form.register("endDate")}
                className="mt-1"
              />
            </div>
            {!allDay && (
              <div>
                <Label>{t("calendar.endTime")}</Label>
                <Input
                  type="time"
                  {...form.register("endTime")}
                  className="mt-1"
                />
              </div>
            )}
          </div>

          {/* Category, Priority, Status */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{t("calendar.category")}</Label>
              <Select
                value={form.watch("category")}
                onValueChange={(v) =>
                  form.setValue("category", v as EventCategory)
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="study">
                    {t("calendar.categories.study")}
                  </SelectItem>
                  <SelectItem value="training">
                    {t("calendar.categories.training")}
                  </SelectItem>
                  <SelectItem value="interview">
                    {t("calendar.categories.interview")}
                  </SelectItem>
                  <SelectItem value="deadline">
                    {t("calendar.categories.deadline")}
                  </SelectItem>
                  <SelectItem value="task">
                    {t("calendar.categories.task")}
                  </SelectItem>
                  <SelectItem value="follow-up">
                    {t("calendar.categories.follow-up")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("calendar.priority")}</Label>
              <Select
                value={form.watch("priority")}
                onValueChange={(v) =>
                  form.setValue("priority", v as EventPriority)
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    {t("calendar.priorities.low")}
                  </SelectItem>
                  <SelectItem value="medium">
                    {t("calendar.priorities.medium")}
                  </SelectItem>
                  <SelectItem value="high">
                    {t("calendar.priorities.high")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("calendar.status")}</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(v) => form.setValue("status", v as EventStatus)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">
                    {t("calendar.statuses.todo")}
                  </SelectItem>
                  <SelectItem value="in-progress">
                    {t("calendar.statuses.in-progress")}
                  </SelectItem>
                  <SelectItem value="done">
                    {t("calendar.statuses.done")}
                  </SelectItem>
                  <SelectItem value="postponed">
                    {t("calendar.statuses.postponed")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linked sector */}
          <div>
            <Label>{t("calendar.linkedSector")}</Label>
            <Select
              value={form.watch("linkedSectorId") || "none"}
              onValueChange={(v) =>
                form.setValue("linkedSectorId", v === "none" ? "" : v)
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t("calendar.noSector")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("calendar.noSector")}</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Premium content suggestion when sector is selected */}
          {selectedSector && (
            <div
              className={cn(
                "rounded-xl border p-3 space-y-2",
                isPremium
                  ? "bg-primary/5 border-primary/20"
                  : "bg-muted/40 border-muted",
              )}
            >
              {isPremium ? (
                <>
                  <p className="text-xs font-semibold text-primary flex items-center gap-1">
                    <Crown className="h-3 w-3" />{" "}
                    {t("calendar.suggestedContent", {
                      name: selectedSector.name,
                    })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`${BASE}wiki`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <BookOpen className="h-3 w-3" /> {t("calendar.wikiLabel")}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    <a
                      href={`${BASE}roadmap`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Map className="h-3 w-3" /> {t("calendar.roadmapLabel")}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    <a
                      href={`${BASE}crescita`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />{" "}
                      {t("calendar.growthLabel")}
                    </a>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Crown className="h-3 w-3 text-amber-500" />
                  <span>
                    {
                      t("calendar.premiumNote", {
                        name: selectedSector.name,
                      }).split(selectedSector.name)[0]
                    }
                    <a
                      href={`${BASE}premium`}
                      className="font-semibold text-amber-600 hover:underline"
                    >
                      Premium
                    </a>
                    {
                      t("calendar.premiumNote", {
                        name: selectedSector.name,
                      }).split("Premium")[1]
                    }
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Linked goal */}
          <div>
            <Label>{t("calendar.linkedGoal")}</Label>
            {activeObjectives.length > 0 ? (
              <Select
                value={form.watch("linkedGoal") || "none"}
                onValueChange={(v) =>
                  form.setValue("linkedGoal", v === "none" ? "" : v)
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue
                    placeholder={t("calendar.linkedGoalPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("calendar.noGoal")}</SelectItem>
                  {activeObjectives.map((o) => (
                    <SelectItem key={o.id} value={o.text}>
                      {o.text.length > 60 ? `${o.text.slice(0, 57)}…` : o.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="linkedGoal"
                {...form.register("linkedGoal")}
                placeholder={t("calendar.linkedGoalInput")}
                className="mt-1"
              />
            )}
            {activeObjectives.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("calendar.addGoalsHint")}
              </p>
            )}
          </div>

          {/* Reminders */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-4 w-4 text-primary" />
              <Label>{t("calendar.reminders")}</Label>
            </div>
            <div className="space-y-2">
              {PREMIUM_REMINDER_MINUTES.map((minutes) => {
                const isAllowed = allowedReminders.includes(minutes);
                const isActive = !!reminderToggles[minutes];
                return (
                  <div
                    key={minutes}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-lg border",
                      !isAllowed && "opacity-60",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{reminderLabels[minutes]}</span>
                      {!isAllowed && (
                        <Badge
                          variant="outline"
                          className="text-xs gap-1 text-amber-600 border-amber-300"
                        >
                          <Crown className="h-3 w-3" /> Premium
                        </Badge>
                      )}
                    </div>
                    <Switch
                      checked={isActive}
                      onCheckedChange={() => toggleReminder(minutes)}
                      disabled={!isAllowed}
                    />
                  </div>
                );
              })}
            </div>
            {showUpgradeHint && (
              <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  {t("calendar.premiumReminders")}{" "}
                  <a
                    href={`${BASE}premium`}
                    className="font-semibold underline"
                  >
                    {t("calendar.upgradePremium")}
                  </a>
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            {editingEvent && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                onClick={() => onDeleted(editingEvent.id)}
              >
                <Trash2 className="h-4 w-4" /> {t("calendar.delete")}
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                {t("calendar.cancel")}
              </Button>
              <Button type="submit" disabled={saving} className="rounded-full">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingEvent
                  ? t("calendar.saveChanges")
                  : t("calendar.createEvent")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
