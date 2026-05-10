/**
 * WebSocket server — mounts on an existing HTTP/HTTPS server.
 *
 * Usage (inside your API entrypoint):
 *
 *   import { createWsServer } from "@workspace/ws-server";
 *   const httpServer = app.listen(PORT);
 *   const wss = createWsServer(httpServer);
 *
 * Clients connect to  ws(s)://host/ws  with a JWT in the
 * query string:  ?token=<jwt>
 *
 * After authentication, each user gets a private channel stored in
 * activeConnections. Other parts of the server push events by calling:
 *
 *   wss.emit(userId, event);
 */

import { IncomingMessage, Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { ServerWsEvent, ClientWsEvent } from "@workspace/api-zod/ws-events";

// ─── JWT verification ─────────────────────────────────────────────────────
// We keep a lightweight inline verifier to avoid forcing a specific JWT
// library on the server package. Replace with your actual jwt.verify call.

function extractUserIdFromToken(token: string): number | null {
  try {
    // Standard JWT: header.payload.signature (base64url)
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const json = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(json) as { sub?: string | number; userId?: number };
    const raw = payload.userId ?? payload.sub;
    const id = typeof raw === "string" ? parseInt(raw, 10) : raw;
    return id && !isNaN(id) ? id : null;
  } catch {
    return null;
  }
}

function getTokenFromRequest(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? "/", "http://localhost");
  // Priority 1: query string  ?token=<jwt>
  const qToken = url.searchParams.get("token");
  if (qToken) return qToken;
  // Priority 2: Authorization: Bearer <jwt>
  const auth = req.headers["authorization"];
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

// ─── Connection registry ──────────────────────────────────────────────────

// One userId → Set of sockets (same user, multiple tabs)
const activeConnections = new Map<number, Set<WebSocket>>();

function addConnection(userId: number, ws: WebSocket): void {
  if (!activeConnections.has(userId)) {
    activeConnections.set(userId, new Set());
  }
  activeConnections.get(userId)!.add(ws);
}

function removeConnection(userId: number, ws: WebSocket): void {
  const sockets = activeConnections.get(userId);
  if (!sockets) return;
  sockets.delete(ws);
  if (sockets.size === 0) activeConnections.delete(userId);
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface NorthStarWss {
  /** Send a typed event to all open sockets of a given user. */
  emit(userId: number, event: ServerWsEvent): void;
  /** Returns true if the user has at least one active connection. */
  isOnline(userId: number): boolean;
  /** Total number of active connections (for metrics). */
  connectionCount(): number;
  /** Underlying ws WebSocketServer (for advanced use). */
  raw: WebSocketServer;
}

export function createWsServer(httpServer: Server): NorthStarWss {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  // ── Heartbeat: ping every 30 s, close dead sockets ──────────────────────
  const HEARTBEAT_INTERVAL = 30_000;
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      const annotated = ws as WebSocket & { _alive?: boolean };
      if (annotated._alive === false) {
        ws.terminate();
        return;
      }
      annotated._alive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);

  wss.on("close", () => clearInterval(heartbeat));

  // ── New connection ───────────────────────────────────────────────────────
  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const token = getTokenFromRequest(req);
    const userId = token ? extractUserIdFromToken(token) : null;

    if (!userId) {
      ws.close(4001, "Unauthorized: invalid or missing token");
      return;
    }

    const annotated = ws as WebSocket & { _alive?: boolean; _userId?: number };
    annotated._alive = true;
    annotated._userId = userId;

    addConnection(userId, ws);

    // Send initial pong to confirm handshake
    ws.send(JSON.stringify({ type: "pong" }));

    // ── Incoming messages from client ──────────────────────────────────────
    ws.on("message", (data) => {
      try {
        const raw = JSON.parse(data.toString()) as unknown;
        const parsed = ClientWsEvent.safeParse(raw);
        if (!parsed.success) return;
        if (parsed.data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("pong", () => {
      annotated._alive = true;
    });

    ws.on("close", () => {
      removeConnection(userId, ws);
    });

    ws.on("error", (err) => {
      console.error(`[ws] socket error for userId=${userId}:`, err.message);
      removeConnection(userId, ws);
    });
  });

  // ── NorthStarWss implementation ──────────────────────────────────────────
  return {
    raw: wss,

    emit(userId: number, event: ServerWsEvent): void {
      const sockets = activeConnections.get(userId);
      if (!sockets || sockets.size === 0) return;
      const payload = JSON.stringify(event);
      for (const socket of sockets) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(payload);
        }
      }
    },

    isOnline(userId: number): boolean {
      const sockets = activeConnections.get(userId);
      return Boolean(sockets && sockets.size > 0);
    },

    connectionCount(): number {
      let total = 0;
      for (const sockets of activeConnections.values()) {
        total += sockets.size;
      }
      return total;
    },
  };
}

// Re-export event types for convenience
export type { ServerWsEvent, ClientWsEvent } from "@workspace/api-zod/ws-events";
