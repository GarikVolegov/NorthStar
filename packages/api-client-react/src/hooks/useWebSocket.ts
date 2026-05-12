/**
 * useWebSocket — generic auto-reconnect WebSocket hook.
 *
 * Features:
 *  - Exponential backoff reconnection (up to MAX_DELAY_MS)
 *  - Automatic ping every PING_INTERVAL_MS to keep the connection alive
 *  - Typed event dispatch via onMessage callback
 *  - Auth via first message (no token in URL)
 *  - Cleans up on unmount
 *
 * Usage:
 *
 *   const { send, readyState } = useWebSocket({
 *     url: `wss://api.example.com/ws`,
 *     authToken: jwt,
 *     onMessage: (event) => console.log(event),
 *   });
 */

import { useEffect, useRef, useCallback, useState } from "react";

export type WsReadyState = "connecting" | "open" | "closing" | "closed";

export interface UseWebSocketOptions<TEvent = unknown> {
  /** Full WebSocket URL (without auth token in query string). */
  url: string | null;
  /** JWT sent as first message for authentication (never in URL). */
  authToken?: string | null;
  /** Called with every parsed JSON message from the server. */
  onMessage?: (event: TEvent) => void;
  /** Called when the socket opens. */
  onOpen?: () => void;
  /** Called when the socket closes (not on reconnect — only final close). */
  onClose?: () => void;
  /** Called on unrecoverable errors. */
  onError?: (err: Event) => void;
  /** Max reconnect attempts before giving up. Default: 10 */
  maxRetries?: number;
}

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
const PING_INTERVAL_MS = 25_000;

export function useWebSocket<TEvent = unknown>({
  url,
  authToken,
  onMessage,
  onOpen,
  onClose,
  onError,
  maxRetries = 10,
}: UseWebSocketOptions<TEvent>) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const [readyState, setReadyState] = useState<WsReadyState>("closed");

  // Keep callbacks/values in refs so reconnect closure always has latest version
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  const authTokenRef = useRef(authToken);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { authTokenRef.current = authToken; }, [authToken]);

  const clearPing = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const startPing = useCallback((ws: WebSocket) => {
    clearPing();
    pingTimerRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL_MS);
  }, [clearPing]);

  const connect = useCallback(() => {
    if (!url || !isMountedRef.current) return;

    setReadyState("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) { ws.close(); return; }
      retryCountRef.current = 0;
      setReadyState("open");
      const token = authTokenRef.current;
      if (token) {
        ws.send(JSON.stringify({ type: "auth", token }));
      }
      startPing(ws);
      onOpenRef.current?.();
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as TEvent;
        const msg = data as Record<string, unknown>;
        if (msg["type"] === "pong" || msg["type"] === "auth_ok") return;
        onMessageRef.current?.(data);
      } catch {
        // Ignore non-JSON frames
      }
    };

    ws.onclose = () => {
      if (!isMountedRef.current) return;
      clearPing();
      setReadyState("closed");

      if (retryCountRef.current >= maxRetries) {
        onCloseRef.current?.();
        return;
      }

      // Exponential backoff
      const delay = Math.min(
        BASE_DELAY_MS * 2 ** retryCountRef.current,
        MAX_DELAY_MS,
      );
      retryCountRef.current += 1;

      reconnectTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) connect();
      }, delay);
    };

    ws.onerror = (err) => {
      onErrorRef.current?.(err);
    };
  }, [url, maxRetries, startPing, clearPing]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      clearPing();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close(1000, "Component unmounted");
    };
  }, [connect]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send, readyState };
}
