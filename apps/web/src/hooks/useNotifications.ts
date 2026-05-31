import { useAuth } from "@/contexts/AuthContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getJson, postJson } from "@/lib/apiClient";
import { API_ENDPOINTS, withParams } from "@/lib/constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

export type NotificationSource =
  | "system"
  | "wendy"
  | "monthly_ritual"
  | "calendar"
  | "agent"
  | "pipeline"
  | "social"
  | "proactive_insight";
export type NotificationSeverity = "info" | "success" | "warning" | "urgent";

export interface AppNotification {
  id: number;
  userId?: number;
  source: NotificationSource;
  type?: string;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  iconKey: string;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown>;
  readAt: string | null;
  openedAt?: string | null;
  dismissedAt?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
  nextCursor: number | null;
}

const EMPTY_RESPONSE: NotificationsResponse = {
  notifications: [],
  unreadCount: 0,
  nextCursor: null,
};

function notificationUrl(path: string, id: number) {
  return withParams(path, { id });
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const { user, token } = useAuth();
  const userId = user?.id ?? null;
  const ws = useWebSocket(token, userId);
  const enabled = Boolean(userId);

  const query = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: async () => getJson<NotificationsResponse>(API_ENDPOINTS.notification.list),
    enabled,
    refetchInterval: enabled && !ws.isConnected ? 60_000 : false,
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });

  useEffect(() => {
    if (!enabled) return;
    return ws.on<AppNotification>("notification:new", (notification) => {
      queryClient.setQueryData<NotificationsResponse>(["notifications"], (current) => {
        const base = current ?? EMPTY_RESPONSE;
        if (base.notifications.some((item) => item.id === notification.id)) return base;
        return {
          ...base,
          notifications: [notification, ...base.notifications],
          unreadCount: base.unreadCount + (notification.readAt ? 0 : 1),
        };
      });
      toast(notification.title, {
        description: notification.body ?? undefined,
        action: notification.ctaUrl && notification.ctaLabel
          ? { label: notification.ctaLabel, onClick: () => { window.location.href = notification.ctaUrl!; } }
          : undefined,
      });
    });
  }, [enabled, queryClient, ws]);

  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; notificationId?: unknown } | null;
      if (data?.type !== "notification:opened" || typeof data.notificationId !== "number") return;
      void postJson(notificationUrl(API_ENDPOINTS.notification.open, data.notificationId)).then(invalidate).catch(() => {});
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [enabled]);

  const markReadMutation = useMutation({
    mutationFn: (id: number) => postJson(notificationUrl(API_ENDPOINTS.notification.markRead, id)),
    onSuccess: invalidate,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => postJson(API_ENDPOINTS.notification.markAllRead),
    onSuccess: invalidate,
  });

  const openMutation = useMutation({
    mutationFn: (id: number) => postJson(notificationUrl(API_ENDPOINTS.notification.open, id)),
    onSuccess: invalidate,
  });

  const dismissMutation = useMutation({
    mutationFn: (id: number) => postJson(notificationUrl(API_ENDPOINTS.notification.dismiss, id)),
    onSuccess: invalidate,
  });

  return {
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    markRead: (id: number) => markReadMutation.mutate(id),
    markAllRead: () => markAllReadMutation.mutate(),
    openNotification: (id: number) => openMutation.mutate(id),
    dismiss: (id: number) => dismissMutation.mutate(id),
  };
}
