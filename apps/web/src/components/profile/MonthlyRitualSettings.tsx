import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useMonthlyRitualActions, useMonthlyRitualArchive, useMonthlyRitualCurrent } from "@/hooks/useMonthlyRitual";
import { apiFetch } from "@/lib/api-fetch";
import { Bell, Loader2, MoonStar } from "lucide-react";
import { useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) bytes[i] = rawData.charCodeAt(i);
  return bytes.buffer;
}

export function MonthlyRitualSettings() {
  const { data } = useMonthlyRitualCurrent();
  const { data: archive } = useMonthlyRitualArchive();
  const actions = useMonthlyRitualActions();
  const [pushLoading, setPushLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  const preferences = data?.preferences ?? { ritualEnabled: true, emailReminderEnabled: false };

  async function enablePush() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    const vapidPublic = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidPublic) return;

    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic),
      });
      const json = subscription.toJSON();
      const keys = json.keys as Record<string, string> | undefined;
      if (!json.endpoint || !keys?.p256dh || !keys.auth) return;

      await apiFetch(`${BASE}api/push/subscribe`, {
        method: "POST",
        body: JSON.stringify({ endpoint: json.endpoint, p256dh: keys.p256dh, auth: keys.auth }),
      });
      setPushEnabled(true);
    } finally {
      setPushLoading(false);
    }
  }

  return (
    <div className="space-y-4 pb-2">
      <div className="flex items-start gap-3 rounded-md border border-border bg-background/70 p-3">
        <MoonStar className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Notte della Fondazione</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Il 7 di ogni mese NorthStar propone una Rotta del Mese e una Scintilla 24h.
          </p>
        </div>
      </div>

      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-foreground">Rito mensile</span>
          <span className="block text-xs text-muted-foreground">Mostra il rito quando arriva il giorno 7.</span>
        </span>
        <Switch
          checked={preferences.ritualEnabled}
          onCheckedChange={(checked) => actions.updatePreferences.mutate({ ritualEnabled: checked })}
          aria-label="Rito mensile"
        />
      </label>

      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-foreground">Email di vigilia</span>
          <span className="block text-xs text-muted-foreground">Ricevi il promemoria il giorno 6.</span>
        </span>
        <Switch
          checked={preferences.emailReminderEnabled}
          onCheckedChange={(checked) => actions.updatePreferences.mutate({ emailReminderEnabled: checked })}
          aria-label="Email di vigilia"
        />
      </label>

      <Button
        type="button"
        variant={pushEnabled ? "secondary" : "outline"}
        size="sm"
        className="w-full justify-center gap-2 rounded-md"
        onClick={enablePush}
        disabled={pushLoading || pushEnabled}
      >
        {pushLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
        {pushEnabled ? "Push attive" : "Abilita push del rito"}
      </Button>

      {archive?.runs?.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Archivio</p>
          <div className="space-y-2">
            {archive.runs.slice(0, 3).map((run) => (
              <div key={run.id} className="rounded-md border border-border bg-background/60 px-3 py-2">
                <p className="text-sm font-medium text-foreground">{run.ritualMonth} - {run.routeTitle}</p>
                <p className="text-xs text-muted-foreground">{run.challengeLabel}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
