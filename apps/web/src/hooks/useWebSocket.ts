import { useEffect, useRef, useCallback, useState } from "react";

type EventHandler = (payload: any) => void;

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

export function useWebSocket(token: string | null, userId: number | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const reconnectIdxRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [isConnected, setIsConnected] = useState(false);

  const getWsUrl = useCallback(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws`;
  }, []);

  const connect = useCallback(() => {
    if (!token || !userId) return;

    const url = getWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "auth_ok" || data.type === "pong") {
          if (data.type === "auth_ok") {
            setIsConnected(true);
            reconnectIdxRef.current = 0;
          }
          return;
        }

        const handlers = handlersRef.current.get(data.type);
        if (handlers) {
          for (const handler of handlers) {
            handler(data.payload ?? data);
          }
        }
      } catch { }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [token, userId, getWsUrl]);

  const scheduleReconnect = useCallback(() => {
    const idx = reconnectIdxRef.current;
    if (idx >= RECONNECT_DELAYS.length) return;
    const delay = RECONNECT_DELAYS[idx];
    reconnectIdxRef.current = idx + 1;
    reconnectTimerRef.current = setTimeout(connect, delay);
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const on = useCallback((eventType: string, handler: EventHandler) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set());
    }
    handlersRef.current.get(eventType)!.add(handler);
    return () => {
      handlersRef.current.get(eventType)?.delete(handler);
    };
  }, []);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { isConnected, on, send };
}
