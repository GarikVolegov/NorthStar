/**
 * NotificationItem
 *
 * Singolo item notifica nel dropdown.
 * Renderizza:
 *  - Avatar con fallback iniziali
 *  - Messaggio contestuale al tipo (friend_request, ecc.)
 *  - Bottoni azione inline (Accetta / Rifiuta per friend_request)
 *  - Data relativa ("2 ore fa", "ieri", ...)
 */
import { UserCheck, UserX } from "lucide-react";
import type { AppNotification } from "@/hooks/useNotifications";

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "adesso";
  if (mins  < 60) return `${mins}m fa`;
  if (hours < 24) return `${hours}h fa`;
  if (days  < 7)  return `${days}g fa`;
  return new Date(isoDate).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        width={36}
        height={36}
        loading="lazy"
        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center flex-shrink-0">
      <span className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">{initials}</span>
    </div>
  );
}

export interface NotificationItemProps {
  notification: AppNotification;
  onAccept:  (friendshipId: number, notificationId: string) => void;
  onDecline: (friendshipId: number, notificationId: string) => void;
  accepting: boolean;
  declining: boolean;
}

export function NotificationItem({
  notification,
  onAccept,
  onDecline,
  accepting,
  declining,
}: NotificationItemProps) {
  if (notification.type === "friend_request") {
    return (
      <div className="flex items-start gap-3 px-4 py-3 hover:bg-foreground/[0.03] transition-colors">
        <Avatar name={notification.from.name} avatarUrl={notification.from.avatarUrl} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-[hsl(var(--foreground))] leading-snug">
            <span className="font-semibold text-[hsl(var(--foreground))]">{notification.from.name}</span>
            {" "}
            vuole connettersi con te
            {notification.from.sectorName && (
              <span className="text-[hsl(var(--muted-foreground))]"> · {notification.from.sectorName}</span>
            )}
          </p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground) / 0.8)] mt-0.5">{relativeTime(notification.sentAt)}</p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => onAccept(notification.friendshipId, notification.id)}
              disabled={accepting || declining}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold
                         bg-[hsl(var(--muted))] text-[hsl(var(--chart-3))] hover:bg-[hsl(var(--muted))] transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {accepting ? (
                <span className="w-3 h-3 border border-[hsl(var(--chart-3))]/30 border-t-[hsl(var(--chart-3))] rounded-full animate-spin" />
              ) : (
                <UserCheck className="w-3 h-3" />
              )}
              Accetta
            </button>
            <button
              onClick={() => onDecline(notification.friendshipId, notification.id)}
              disabled={declining || accepting}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium
                         text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/10 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {declining ? (
                <span className="w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />
              ) : (
                <UserX className="w-3 h-3" />
              )}
              Rifiuta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback per tipi futuri
  return null;
}
