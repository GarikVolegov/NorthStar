/**
 * usePageBus — wrapper React-idiomatic per eventBus.
 *
 * Astrae sottoscrizione/emissione su EventBus con cleanup automatico
 * via useEffect. Sostituisce il pattern `class PageModule extends ...`
 * della specifica originale (più semplice, più React-idiomatic, zero boilerplate).
 *
 * @example
 *   const bus = usePageBus("dashboard");
 *   useEffect(() => bus.subscribe("page:message", (e) => console.log(e.payload)), [bus]);
 *   bus.emit("page:message", { to: "wendy", body: "ciao" });
 *
 * @pattern Observer (wrapper di EventBus singleton)
 */
import { eventBus, type AppEvent, type EventName } from "@/lib/event-bus";
import { useCallback, useEffect, useMemo, useRef } from "react";

export interface PageBus {
  /** ID logico della pagina (es. "dashboard", "wendy-chat") — usato in payload e telemetry */
  readonly pageId: string;
  /** Emette un evento globale taggato con `source: pageId` */
  emit<T>(name: EventName, payload: T): void;
  /** Si sottoscrive a un evento. Restituisce una funzione di unsubscribe. */
  subscribe<T>(name: EventName, listener: (event: AppEvent<T>) => void): () => void;
}

/**
 * Hook React per accedere all'EventBus globale dal contesto di una pagina.
 *
 * Tutte le sottoscrizioni create via `bus.subscribe()` vengono automaticamente
 * pulite quando il componente smonta (via la callback restituita).
 *
 * Per emettere/sottoscrivere senza gestire manualmente cleanup, vedere `usePageModule`.
 */
export function usePageBus(pageId: string): PageBus {
  const unsubsRef = useRef<Array<() => void>>([]);

  const emit = useCallback(<T,>(name: EventName, payload: T) => {
    eventBus.emit<T & { __pageId?: string }>(name, { ...(payload as object), __pageId: pageId } as T & { __pageId?: string });
  }, [pageId]);

  const subscribe = useCallback(<T,>(name: EventName, listener: (event: AppEvent<T>) => void) => {
    const unsub = eventBus.on<T>(name, listener);
    unsubsRef.current.push(unsub);
    return unsub;
  }, []);

  // Cleanup di tutte le sottoscrizioni residue al dismount
  useEffect(() => {
    return () => {
      for (const unsub of unsubsRef.current) {
        try { unsub(); } catch { /* silent */ }
      }
      unsubsRef.current = [];
    };
  }, []);

  return useMemo<PageBus>(() => ({ pageId, emit, subscribe }), [pageId, emit, subscribe]);
}
