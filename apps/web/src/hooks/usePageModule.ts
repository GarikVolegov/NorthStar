/**
 * usePageModule — astrazione React-idiomatic del PageModule della specifica.
 *
 * Sostituisce la `abstract class PageModule` Java-style con un hook che:
 *  1. emette `page:mounted`/`page:unmounted` per analytics e debug cross-tab
 *  2. fornisce il `PageBus` per comunicazione inter-pagina
 *  3. opzionalmente sottoscrive listener per messaggi targeted
 *
 * @example
 *   function DashboardPage() {
 *     const { bus } = usePageModule({
 *       pageId: "dashboard",
 *       onMessage: (e) => console.log("dashboard ricevuto:", e.payload),
 *     });
 *     return <button onClick={() => bus.emit("page:message", { to: "wendy", text: "ciao" })}>Saluta Wendy</button>;
 *   }
 *
 * @pattern Observer + Lifecycle hook
 * @see usePageBus per il livello più basso
 */
import { useEffect } from "react";
import { usePageBus, type PageBus } from "./usePageBus";
import type { AppEvent } from "@/lib/event-bus";

export interface UsePageModuleOptions {
  /** Identificatore stabile della pagina (es. "dashboard", "wendy-chat") */
  pageId: string;
  /** Callback opzionale invocata quando un altro modulo emette `page:message` */
  onMessage?: (event: AppEvent<unknown>) => void;
  /** Se true, NON emette eventi `page:mounted/unmounted` (default false) */
  silent?: boolean;
}

export interface PageModule {
  /** Il bus React-friendly per emettere/sottoscrivere eventi */
  bus: PageBus;
}

/**
 * Hook lifecycle-aware per registrare una pagina nel sistema di messaging globale.
 * Le sottoscrizioni e i mount/unmount events vengono gestiti automaticamente.
 */
export function usePageModule(options: UsePageModuleOptions): PageModule {
  const { pageId, onMessage, silent = false } = options;
  const bus = usePageBus(pageId);

  // Emetti page:mounted al primo render e page:unmounted al cleanup
  useEffect(() => {
    if (!silent) {
      bus.emit("page:mounted", { pageId, timestamp: Date.now() });
    }
    return () => {
      if (!silent) {
        bus.emit("page:unmounted", { pageId, timestamp: Date.now() });
      }
    };
  }, [pageId, silent, bus]);

  // Sottoscrizione opzionale a messaggi targeted via page:message
  useEffect(() => {
    if (!onMessage) return;
    return bus.subscribe<unknown>("page:message", (event) => {
      // Filtra messaggi destinati a questa pagina: payload.to === pageId
      const payload = event.payload as { to?: string } | undefined;
      if (payload?.to && payload.to !== pageId) return;
      onMessage(event);
    });
  }, [pageId, onMessage, bus]);

  return { bus };
}
