import { useState } from "react";
import { Bell, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";

const BASE = import.meta.env.BASE_URL || "/";

interface Props {
  onDismiss: () => void;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i);
  return bytes.buffer;
}

export function PushOptInBanner({ onDismiss }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleEnable = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      onDismiss();
      return;
    }
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { onDismiss(); return; }

      const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
      if (!VAPID_PUBLIC) { onDismiss(); return; }

      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC);

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys) { onDismiss(); return; }

      const keysMap = json.keys as Record<string, string>;
      const p256dh = keysMap["p256dh"];
      const auth = keysMap["auth"];
      if (!p256dh || !auth) { onDismiss(); return; }

      await apiFetch(`${BASE}api/push/subscribe`, {
        method: "POST",
        body: JSON.stringify({ endpoint: json.endpoint, p256dh, auth }),
      });

      setDone(true);
      setTimeout(onDismiss, 2000);
    } catch {
      onDismiss();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border bg-primary/5 border-primary/20 p-4">
      <Bell className="h-5 w-5 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        {done ? (
          <p className="text-sm font-medium text-primary">Notifiche push attivate!</p>
        ) : (
          <>
            <p className="text-sm font-semibold">Attiva le notifiche push</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ricevi promemoria direttamente nel browser, anche quando NorthStar non è aperto.
            </p>
          </>
        )}
      </div>
      {!done && (
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" className="rounded-full text-xs h-7 px-3" onClick={handleEnable} disabled={loading}>
            {loading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Attiva
          </Button>
          <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground p-1 rounded-full transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
