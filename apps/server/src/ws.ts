import Redis from "ioredis";
import type { NorthStarWss, ServerWsEvent } from "@workspace/ws-server";
import { rootLogger } from "./middleware/logger";
import { resolveRedisUrl } from "./lib/redis-url";

let _wss: NorthStarWss | null = null;

// ─── Fan-out cross-istanza via Redis pub/sub ────────────────────────────────
// La mappa delle connessioni WS è in-memory PER ISTANZA: dietro un load
// balancer, un evento generato sull'istanza A non raggiunge un utente connesso
// all'istanza B. Si pubblica ogni emit su un canale Redis e OGNI istanza lo
// consegna ai propri socket locali (inclusa l'origine → niente doppie consegne).
const WS_EMIT_CHANNEL = "ws:emit";
let publisher: Redis | null = null;
let bridgeReady = false;

function makeRedis(url: string): Redis {
  return new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => (times > 10 ? null : Math.min(times * 200, 2000)),
  });
}

function initRedisBridge(): void {
  if (bridgeReady) return;
  const url = resolveRedisUrl();
  if (!url || process.env.NODE_ENV === "test") return; // fail-open: solo locale

  try {
    publisher = makeRedis(url);
    publisher.on("error", (err) =>
      rootLogger.warn({ err }, "[ws-bridge] publisher error"),
    );

    const subscriber = makeRedis(url);
    subscriber.on("error", (err) =>
      rootLogger.warn({ err }, "[ws-bridge] subscriber error"),
    );
    subscriber.on("message", (_channel, raw) => {
      try {
        const { userId, event } = JSON.parse(raw) as {
          userId: number;
          event: ServerWsEvent;
        };
        _wss?.emit(userId, event); // consegna ai socket LOCALI di questa istanza
      } catch (err) {
        rootLogger.warn({ err }, "[ws-bridge] messaggio non valido");
      }
    });
    void subscriber.subscribe(WS_EMIT_CHANNEL).then(
      () => {
        bridgeReady = true;
        rootLogger.info("[ws-bridge] fan-out Redis attivo");
      },
      (err) => {
        rootLogger.warn({ err }, "[ws-bridge] subscribe fallita, fallback locale");
        publisher = null;
      },
    );
  } catch (err) {
    rootLogger.warn({ err }, "[ws-bridge] init fallita, fallback locale");
    publisher = null;
  }
}

export function setWss(wss: NorthStarWss): void {
  _wss = wss;
  initRedisBridge();
}

export function getWss(): NorthStarWss | null {
  return _wss;
}

/**
 * Invia un evento WS a un utente, con fan-out cross-istanza.
 * - Bridge Redis attivo → pubblica sul canale; ogni istanza (inclusa questa)
 *   consegna ai propri socket via la subscription (consegna singola).
 * - Redis non disponibile / non configurato → consegna solo localmente
 *   (comportamento attuale, nessuna regressione single-instance).
 * È il path da preferire a `getWss()?.emit()` per qualsiasi nuovo emit.
 */
export function emitToUser(userId: number, event: ServerWsEvent): void {
  if (publisher && bridgeReady) {
    publisher
      .publish(WS_EMIT_CHANNEL, JSON.stringify({ userId, event }))
      .catch((err) => {
        rootLogger.warn({ err }, "[ws-bridge] publish fallita, consegna locale");
        _wss?.emit(userId, event);
      });
    return;
  }
  _wss?.emit(userId, event);
}
