import { Switch } from "@/components/ui/switch";
import { getJson, patchJson } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/lib/constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Mail, Smartphone } from "lucide-react";

interface NotificationPreferences {
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  inAppEnabled: true,
  pushEnabled: true,
  emailEnabled: false,
};

export function NotificationSettings() {
  const queryClient = useQueryClient();
  const query = useQuery<{ preferences: NotificationPreferences }>({
    queryKey: ["notification-preferences"],
    queryFn: () => getJson(API_ENDPOINTS.notification.preferences),
  });
  const preferences = query.data?.preferences ?? DEFAULT_PREFERENCES;
  const update = useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      patchJson<{ preferences: NotificationPreferences }>(API_ENDPOINTS.notification.preferences, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <div className="space-y-4 pb-2">
      <div className="flex items-start gap-3 rounded-md border border-border bg-background/70 p-3">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Centro Notifiche</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Le notifiche in-app restano sempre disponibili come inbox affidabile.
          </p>
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 opacity-70">
        <span>
          <span className="block text-sm font-medium text-foreground">Inbox NorthStar</span>
          <span className="block text-xs text-muted-foreground">Cronologia persistente nel menu profilo.</span>
        </span>
        <Switch checked={preferences.inAppEnabled} disabled aria-label="Inbox NorthStar" />
      </label>

      <label className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-start gap-2">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="block text-sm font-medium text-foreground">Push browser</span>
            <span className="block text-xs text-muted-foreground">Mostra avvisi quando il browser lo consente.</span>
          </span>
        </span>
        <Switch
          checked={preferences.pushEnabled}
          onCheckedChange={(checked) => update.mutate({ pushEnabled: checked })}
          aria-label="Push browser"
        />
      </label>

      <label className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-start gap-2">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="block text-sm font-medium text-foreground">Email importanti</span>
            <span className="block text-xs text-muted-foreground">Solo rituali, sicurezza e reminder ad alta priorita'.</span>
          </span>
        </span>
        <Switch
          checked={preferences.emailEnabled}
          onCheckedChange={(checked) => update.mutate({ emailEnabled: checked })}
          aria-label="Email importanti"
        />
      </label>
    </div>
  );
}
