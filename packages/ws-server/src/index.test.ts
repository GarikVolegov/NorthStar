import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import { WebSocket } from "ws";
import jwt from "jsonwebtoken";
const { sign } = jwt;

type NorthStarWss = import("./index").NorthStarWss;

let createWsServer: (...args: any[]) => NorthStarWss;
let wss: NorthStarWss;
let httpServer: Server;
let port: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-key-32-chars-minimum!!!";
  process.env.LOG_LEVEL = "silent";
  const mod = await import("./index");
  createWsServer = mod.createWsServer;

  httpServer = createServer();
  wss = createWsServer(httpServer);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      port = (httpServer.address() as any).port;
      resolve();
    });
  });
});

afterAll(() => {
  wss?.raw?.close();
  httpServer?.close();
});

describe("WebSocket Server", () => {
  it("rejects unauthenticated connections", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    ws.on("error", () => {}); // Suppress connection errors
    await expect(
      new Promise((_, reject) => {
        ws.on("unexpected-response", () => reject(new Error("unexpected response")));
        ws.on("close", (code) => {
          if (code !== 1000) reject(new Error(`closed with code ${code}`));
        });
        setTimeout(() => reject(new Error("timeout")), 2000);
      }),
    ).rejects.toThrow();
    ws.close();
  });

  it("authenticates via Authorization header", async () => {
    const token = sign({ userId: 42 }, process.env.JWT_SECRET!);
    const ws = new WebSocket(`ws://localhost:${port}/ws`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "ping" }));
      });
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "pong") {
          expect(wss.isOnline(42)).toBe(true);
          resolve();
        }
      });
      ws.on("error", reject);
      setTimeout(() => reject(new Error("timeout")), 2000);
    });
    ws.close();
  });

  it("authenticates via auth message", async () => {
    const token = sign({ userId: 99 }, process.env.JWT_SECRET!);
    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "auth", token }));
      });
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_ok") {
          expect(wss.isOnline(99)).toBe(true);
          resolve();
        }
      });
      ws.on("error", reject);
      setTimeout(() => reject(new Error("timeout")), 2000);
    });
    ws.close();
  });

  it("rejects invalid tokens", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`, {
      headers: { Authorization: "Bearer invalid-token" },
    });

    await new Promise<void>((resolve, reject) => {
      ws.on("close", (code) => {
        expect(code).toBe(4001);
        resolve();
      });
      ws.on("error", reject);
      setTimeout(() => reject(new Error("timeout")), 2000);
    });
  });

  it("emits events to connected users", async () => {
    const token = sign({ userId: 7 }, process.env.JWT_SECRET!);
    const ws = new WebSocket(`ws://localhost:${port}/ws`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => {
        wss.emit(7, { type: "test_event", data: { hello: "world" } } as any);
      });
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "test_event") {
          expect(msg.data.hello).toBe("world");
          resolve();
        }
      });
      ws.on("error", reject);
      setTimeout(() => reject(new Error("timeout")), 2000);
    });
    ws.close();
  });

  it("reports isOnline correctly", () => {
    expect(wss.isOnline(999)).toBe(false);
    expect(wss.connectionCount()).toBeGreaterThanOrEqual(0);
  });
});
