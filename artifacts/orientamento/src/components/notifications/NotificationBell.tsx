import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, X, CheckCheck, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Locale } from "date-fns";
import { it, enUS, es, fr, de } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";

const BASE = import.meta.env.BASE_URL || "/";

const DATE_LOCALES: Record<string, Locale> = { it, en: enUS, es, fr, de };

interface NotificationLog {
  id: number;
  title: string;
  body: string | null;
  isRead: boolean;
  sentAt: string;
  eventId: number | null;
}

interface Props {
  userId: number;
}

export function NotificationBell({ userId }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_LOCALES[i18n.language] ?? it;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const { data } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/notifications?limit=15`);
      return res.json();
    },
    enabled: !!userId,
    refetchInterval: 60_000,
  });

  const notifications: NotificationLog[] = data?.notifications ?? [];
  const unreadCount: number = data?.unreadCount ?? 0;

  const readMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiFetch(`${BASE}api/notifications/${id}/read`, { method: "POST" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const readAllMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(`${BASE}api/notifications/read-all`, { method: "POST" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors"
        aria-label={t("notifiche.title")}
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-popover shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">{t("notifiche.title")}</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  {t("notifiche.newBadge", { count: unreadCount })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => readAllMutation.mutate()}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded transition-colors"
                >
                  <CheckCheck className="h-3 w-3" /> {t("notifiche.markAllRead")}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                <p className="text-sm text-muted-foreground">{t("notifiche.empty")}</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.isRead && readMutation.mutate(n.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
                    !n.isRead && "bg-primary/5",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Calendar className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm leading-snug", !n.isRead ? "font-semibold" : "font-normal")}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.body}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(parseISO(n.sentAt), "d MMM, HH:mm", { locale: dateLocale })}
                      </p>
                    </div>
                    {!n.isRead && (
                      <span className="w-2 h-2 bg-primary rounded-full mt-1 shrink-0" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
