/**
 * WebSocket server — mounts on an existing HTTP/HTTPS server.
 *
 * Usage (inside your API entrypoint):
 *
 *   import { createWsServer } from "@workspace/ws-server";
 *   const httpServer = app.listen(PORT);
 *   const wss = createWsServer(httpServer);
 *
 * Clients connect to  ws(s)://host/ws  without a token in the URL.
 * Authentication is performed via the first message:
 *
 *   { "type": "auth", "token": "<jwt>" }
 *
 * The server verifies the JWT signature via jsonwebtoken.
 * See JWT_SECRET env var.
 *
 * After authentication, each user gets a private channel stored in
 * activeConnections. Other parts of the server push events by calling:
 *
 *   wss.emit(userId, event);
 */

import { IncomingMessage, Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { verify, type JwtPayload } from "jsonwebtoken";
import { ServerWsEvent, ClientWsEvent } from "@workspace/api-zod/ws-events";

// ─── JWT verification ─────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("[ws] JWT_SECRET not configured — cannot start server");
  process.exit(1);
}

function extractUserIdFromToken(token: string): number | null {
  if (!JWT_SECRET) return null;
  try {
    const payload = verify(token, JWT_SECRET) as JwtPayload & { userId?: number };
    return payload.userId ?? null;
  } catch {
    return null;
  }
}

function getTokenFromRequest(req: IncomingMessage): string | null {
  const auth = req.headers["authorization"];
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

// ─── Connection registry ──────────────────────────────────────────────────

const activeConnections = new Map<number, Set<WebSocket>>();
const pendingAuth = new Set<WebSocket>();

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
  emit(userId: number, event: ServerWsEvent): void;
  isOnline(userId: number): boolean;
  connectionCount(): number;
  raw: WebSocketServer;
}

export function createWsServer(httpServer: Server): NorthStarWss {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  // ── Heartbeat: ping every 30 s, close dead sockets ──────────────────────
  const HEARTBEAT_INTERVAL = 30_000;
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      const annotated = ws as WebSocket & { _alive?: boolean; _userId?: number };
      if (annotated._alive === false) {
        if (annotated._userId) removeConnection(annotated._userId, ws);
        pendingAuth.delete(ws);
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
    // Check Authorization header first (server-side clients)
    const headerToken = getTokenFromRequest(req);
    if (headerToken) {
      const userId = extractUserIdFromToken(headerToken);
      if (!userId) {
        ws.close(4001, "Unauthorized: invalid token");
        return;
      }
      const annotated = ws as WebSocket & { _alive?: boolean; _userId?: number };
      annotated._alive = true;
      annotated._userId = userId;
      addConnection(userId, ws);
      ws.send(JSON.stringify({ type: "pong" }));
      setupMessageHandler(ws, userId);
      return;
    }

    // Browser clients: wait for auth message
    pendingAuth.add(ws);
    const annotated = ws as WebSocket & { _alive?: boolean; _userId?: number };
    annotated._alive = true;

    let authenticated = false;

    ws.on("message", function onFirstMessage(data: Buffer) {
      try {
        const raw = JSON.parse(data.toString()) as Record<string, unknown>;
        if (raw?.type === "auth" && typeof raw?.token === "string") {
          const userId = extractUserIdFromToken(raw.token);
          if (!userId) {
            ws.close(4001, "Unauthorized: invalid token");
            return;
          }
          authenticated = true;
          annotated._userId = userId;
          pendingAuth.delete(ws);
          addConnection(userId, ws);
          ws.send(JSON.stringify({ type: "auth_ok" }));
          ws.removeListener("message", onFirstMessage);
          setupMessageHandler(ws, userId);
        } else {
          ws.close(4001, "Unauthorized: send auth first");
        }
      } catch {
        ws.close(4001, "Unauthorized: invalid message");
      }
    });

    // Timeout: if no auth within 10s, close
    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        pendingAuth.delete(ws);
        ws.close(4001, "Unauthorized: auth timeout");
      }
    }, 10_000);

    ws.once("close", () => {
      clearTimeout(authTimeout);
      pendingAuth.delete(ws);
      if (annotated._userId) removeConnection(annotated._userId, ws);
    });

    ws.on("error", () => {
      clearTimeout(authTimeout);
      pendingAuth.delete(ws);
      if (annotated._userId) removeConnection(annotated._userId, ws);
    });
  });

  function setupMessageHandler(ws: WebSocket, userId: number) {
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
      const annotated = ws as WebSocket & { _alive?: boolean };
      annotated._alive = true;
    });

    ws.on("close", () => {
      removeConnection(userId, ws);
    });

    ws.on("error", () => {
      removeConnection(userId, ws);
    });
  }

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

export type { ServerWsEvent, ClientWsEvent } from "@workspace/api-zod/ws-events";
