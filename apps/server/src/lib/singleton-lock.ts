import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { rootLogger } from "../middleware/logger";
import { resolveRedisUrl } from "./redis-url";

const INSTANCE_ID = randomUUID();

interface LeaderOptions {
  /** Durata del lock in ms; rinnovato a metà intervallo. Default 30s. */
  ttlMs?: number;
}

/**
 * Esegue `onElected` UNA sola volta, e solo sull'istanza che vince l'elezione
 * del leader via Redis (lock `leader:<name>`). Serve a non far girare gli
 * stessi scheduler di background su OGNI replica (spesa LLM/insert ×N) quando
 * l'app è scalata orizzontalmente.
 *
 * FAIL-OPEN: senza Redis configurato (o in test), oppure se Redis è
 * irraggiungibile entro una breve grace, `onElected` viene eseguito comunque →
 * un deploy single-instance o con Redis giù si comporta esattamente come prima.
 *
 * Auto-correzione: il leader rinnova il lock ad ogni poll; se muore, il TTL
 * scade e un'altra istanza subentra al poll successivo (max ~ttlMs di ritardo).
 *
 * Limite noto: gli scheduler avviati da `onElected` non vengono fermati se la
 * leadership viene persa a runtime (gli `setInterval` non sono interrompibili);
 * la perdita avviene solo se il rinnovo fallisce ripetutamente (Redis down).
 */
export function runWhenLeader(
  name: string,
  onElected: () => void,
  { ttlMs = 30_000 }: LeaderOptions = {},
): void {
  const url = resolveRedisUrl();
  if (!url || process.env.NODE_ENV === "test") {
    // Nessun Redis / test → assunzione single-instance: esegui direttamente.
    onElected();
    return;
  }

  const key = `leader:${name}`;
  const client = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => (times > 10 ? null : Math.min(times * 200, 2000)),
  });
  client.on("error", (err) =>
    rootLogger.warn({ err, name }, "[leader] Redis error"),
  );

  let started = false;
  let redisReachable = false;

  const elect = (reason: string) => {
    if (started) return;
    started = true;
    rootLogger.info(
      { name, instance: INSTANCE_ID, reason },
      "[leader] avvio scheduler di background",
    );
    onElected();
  };

  const poll = async () => {
    try {
      const acquired = await client.set(key, INSTANCE_ID, "PX", ttlMs, "NX");
      redisReachable = true;
      if (acquired === "OK") {
        elect("elected");
        return;
      }
      // Lock già preso: rinnova se siamo noi i proprietari, altrimenti resta dormiente.
      const owner = await client.get(key);
      if (owner === INSTANCE_ID) {
        await client.pexpire(key, ttlMs);
        elect("renewed");
      }
    } catch (err) {
      rootLogger.warn({ err, name }, "[leader] poll fallito");
    }
  };

  // Grace: se entro 5s non abbiamo MAI raggiunto Redis, fail-open ed esegui
  // (nessuna regressione su single-instance / Redis giù). Se invece Redis è
  // raggiungibile e un'altra istanza è leader, NON eleggiamo (niente duplicati).
  const failOpen = setTimeout(() => {
    if (!started && !redisReachable) elect("fail-open (redis unreachable)");
  }, 5_000);
  failOpen.unref?.();

  const timer = setInterval(() => void poll(), Math.max(1_000, Math.floor(ttlMs / 2)));
  timer.unref?.();
  void poll();
}
