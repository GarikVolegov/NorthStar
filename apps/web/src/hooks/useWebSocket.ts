import { useCallback, useEffect, useRef, useState } from "react";

type EventHandler = (payload: unknown) => void;
type TypedEventHandler<T> = (payload: T) => void;

type WebSocketEnvelope = {
  type: string;
  payload?: unknown;
};

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

function parseWebSocketEnvelope(value: MessageEvent["data"]): WebSocketEnvelope | null {
  try {
    const parsed = JSON.parse(String(value)) as unknown;
    if (typeof parsed !== "object" || parsed === null || !("type" in parsed)) {
      return null;
    }

    const envelope = parsed as { type?: unknown; payload?: unknown };
    return typeof envelope.type === "string"
      ? { type: envelope.type, payload: envelope.payload }
      : null;
  } catch {
    return null;
  }
}

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
      const data = parseWebSocketEnvelope(event.data);
      if (!data) return;

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

  const on = useCallback(<T = unknown>(
    eventType: string,
    handler: TypedEventHandler<T>,
  ) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set());
    }
    const wrapped: EventHandler = (payload) => handler(payload as T);
    handlersRef.current.get(eventType)!.add(wrapped);
    return () => {
      handlersRef.current.get(eventType)?.delete(wrapped);
    };
  }, []);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { isConnected, on, send };
}
