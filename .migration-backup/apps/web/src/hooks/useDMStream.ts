/**
 * useDMStream.ts
 *
 * SSE hook — si connette a /api/dm/conversations/:userId/stream
 * e appende ogni nuovo messaggio direttamente nella cache React Query
 * senza invalidare l'intera query (zero re-fetch, zero flicker).
 *
 * Reconnect automatico: se la connessione cade, riprova dopo 3s (max 5 volte).
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { networkKeys, type DmMessage } from './useNetwork';

export function useDMStream(toUserId: number | null, lastMessageId: number | null) {
  const qc = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toUserId) return;

    function connect() {
      const url = `/api/dm/conversations/${toUserId}/stream${
        lastMessageId ? `?after=${lastMessageId}` : ''
      }`;

      const es = new EventSource(url, { withCredentials: true });
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as { type: string; message?: DmMessage };
          if (data.type === 'message' && data.message) {
            qc.setQueryData<{ messages: DmMessage[]; hasMore: boolean; oldestId: number | null }>(
              networkKeys.messages(toUserId!),
              (old) => {
                if (!old) return old;
                // Evita duplicati (es. dopo reconnect)
                const exists = old.messages.some((m) => m.id === data.message!.id);
                if (exists) return old;
                return { ...old, messages: [...old.messages, data.message!] };
              },
            );
          }
          // ping: nessuna azione
        } catch { /* ignora parse error */ }
      };

      es.onerror = () => {
        es.close();
        if (retryCount.current < 5) {
          retryTimer.current = setTimeout(() => {
            retryCount.current += 1;
            connect();
          }, 3000);
        }
      };

      es.onopen = () => {
        retryCount.current = 0; // reset su connessione riuscita
      };
    }

    connect();

    return () => {
      esRef.current?.close();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toUserId]);
}
