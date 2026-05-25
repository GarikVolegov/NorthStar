/**
 * useWendyTabSync.ts — broadcast eventi Wendy tra tab dello stesso browser.
 *
 * Casi gestiti:
 *   - L'utente fa "Pulisci conversazione" in una tab → l'altra svuota la sua chat.
 *   - L'utente preme stop in una tab → le altre tab che stanno streamando si fermano.
 *
 * Non sincronizziamo i token in volo: ogni tab ha la propria SSE attiva
 * (più semplice, evita race condition di scrittura su localStorage).
 */
import { useEffect, useRef } from 'react';

export type WendyTabEvent =
  | { kind: 'cleared'; ts: number }
  | { kind: 'stop'; ts: number }
  | { kind: 'persisted'; ts: number };

const CHANNEL_NAME = 'wendy-sync';

function isWendyTabEvent(value: unknown): value is WendyTabEvent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.ts !== 'number') return false;
  return v.kind === 'cleared' || v.kind === 'stop' || v.kind === 'persisted';
}

interface UseWendyTabSyncOptions {
  onRemoteEvent?: (event: WendyTabEvent) => void;
  enabled?: boolean;
}

export interface UseWendyTabSyncReturn {
  broadcast: (event: Omit<WendyTabEvent, 'ts'>) => void;
}

export function useWendyTabSync({
  onRemoteEvent,
  enabled = true,
}: UseWendyTabSyncOptions = {}): UseWendyTabSyncReturn {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const handlerRef = useRef(onRemoteEvent);
  handlerRef.current = onRemoteEvent;

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    const listener = (e: MessageEvent) => {
      if (!isWendyTabEvent(e.data)) return;
      handlerRef.current?.(e.data);
    };
    channel.addEventListener('message', listener);
    return () => {
      channel.removeEventListener('message', listener);
      channel.close();
      channelRef.current = null;
    };
  }, [enabled]);

  return {
    broadcast: (event) => {
      const payload: WendyTabEvent = { ...event, ts: Date.now() } as WendyTabEvent;
      channelRef.current?.postMessage(payload);
    },
  };
}
