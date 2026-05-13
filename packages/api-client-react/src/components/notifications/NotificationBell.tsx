/**
 * NotificationBell
 *
 * Componente campanella da inserire nella navbar/header.
 * Mostra un badge rosso con il count delle notifiche non lette.
 * Cliccando apre un dropdown animato con la lista delle notifiche.
 *
 * Usage:
 *   import { NotificationBell } from "@/components/notifications/NotificationBell";
 *   // In header:
 *   <NotificationBell />
 *
 * Il componente gestisce autonomamente lo stato SSE tramite useNotifications.
 * Non serve passargli props — si connette da solo.
 */
import { useRef, useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef     = useRef<HTMLDivElement>(null);
  const buttonRef       = useRef<HTMLButtonElement>(null);
  const {
    notifications,
    unreadCount,
    pendingIds,
    actions,
  } = useNotifications();

  // Chiudi dropdown cliccando fuori
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Chiudi con Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div className="relative">
      {/* Bottone campanella */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifiche${unreadCount > 0 ? ` (${unreadCount} non lette)` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative p-2 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-foreground/[0.06]
                   transition-colors focus-visible:outline focus-visible:outline-2
                   focus-visible:outline-[hsl(var(--muted-foreground))] focus-visible:outline-offset-2"
      >
        <Bell className="w-5 h-5" />

        {/* Badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={  { scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1
                         bg-blue-500 text-[hsl(var(--foreground))] text-[10px] font-bold
                         rounded-full flex items-center justify-center pointer-events-none"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={dropdownRef}
            key="dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={  { opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-label="Notifiche"
            className="
              absolute right-0 top-full mt-2 w-[340px] z-50
              bg-[hsl(var(--background))] border border-foreground/[0.08] rounded-xl
              shadow-[0_12px_40px_oklch(0_0_0/0.45)]
              overflow-hidden
            "
          >
            {/* Header dropdown */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/[0.06]">
              <span className="text-[13px] font-semibold text-[hsl(var(--foreground))]">
                Notifiche
                {unreadCount > 0 && (
                  <span className="ml-2 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">({unreadCount})</span>
                )}
              </span>
              {notifications.length > 0 && (
                <span className="text-[11px] text-[hsl(var(--muted-foreground) / 0.8)]">
                  {notifications.length} {notifications.length === 1 ? "nuova" : "nuove"}
                </span>
              )}
            </div>

            {/* Lista notifiche */}
            <div className="max-h-[380px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <Bell className="w-8 h-8 text-[hsl(var(--muted-foreground) / 0.8)] mb-3" />
                  <p className="text-[13px] text-[hsl(var(--muted-foreground))]">Nessuna notifica</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground) / 0.8)] mt-1">
                    Le richieste di connessione appariranno qui
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {notifications.map((n) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={  { opacity: 0, height: 0 }}
                      transition={{ duration: 0.22 }}
                      style={{ overflow: "hidden" }}
                    >
                      <NotificationItem
                        notification={n}
                        accepting={pendingIds[n.id] === "accepting"}
                        declining={pendingIds[n.id] === "declining"}
                        onAccept={actions.acceptRequest}
                        onDecline={actions.declineRequest}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-foreground/[0.06]">
                <a
                  href="/amici?tab=richieste"
                  className="text-[12px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--chart-3))] transition-colors"
                >
                  Vedi tutte le richieste →
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
