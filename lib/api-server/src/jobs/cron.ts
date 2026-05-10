/**
 * Cron jobs del server.
 *
 * SCHEDULE:
 *   Collector  → ogni 6 ore  (0 * /6 * * *)
 *   Enricher   → ogni 2 ore  (0 * /2 * * *)  — subito dopo il collector
 *   Personalizer → ogni 3 ore
 *
 * L'enricher gira sfasato di 10 minuti rispetto al collector:
 *   Collector:    00:00, 06:00, 12:00, 18:00
 *   Enricher:     00:10, 02:10, 04:10 … (ogni 2h)
 *
 * In questo modo quando il collector ha appena depositato nuovi item,
 * l'enricher successivo li trova già pronti.
 */
import cron from "node-cron";
import { runCollector }   from "@workspace/integrations-openai-ai-server";
import { runEnricher }    from "@workspace/integrations-openai-ai-server";
import { runPersonalizer } from "@workspace/integrations-openai-ai-server";

// ── Collector: ogni 6 ore ─────────────────────────────────────────────────────
cron.schedule("0 */6 * * *", async () => {
  console.log("[cron] collector start");
  try {
    const result = await runCollector();
    console.log(`[cron] collector done — inserted ${result.totalInserted}`);

    // Dopo ogni collect, lancia subito l'enricher sui nuovi item
    // (piccolo delay per non sovraccaricare il DB)
    setTimeout(async () => {
      console.log("[cron] enricher post-collect start");
      try {
        const er = await runEnricher(30, 5);
        console.log(`[cron] enricher post-collect done — enriched ${er.enriched}`);
      } catch (err) {
        console.error("[cron] enricher post-collect error:", err);
      }
    }, 60_000); // 1 minuto dopo il collect
  } catch (err) {
    console.error("[cron] collector error:", err);
  }
});

// ── Enricher: ogni 2 ore (al minuto 10) ──────────────────────────────────────
cron.schedule("10 */2 * * *", async () => {
  console.log("[cron] enricher scheduled start");
  try {
    const result = await runEnricher(20, 5);
    console.log(`[cron] enricher done — enriched ${result.enriched}, filtered ${result.filtered}`);
  } catch (err) {
    console.error("[cron] enricher error:", err);
  }
});

// ── Personalizer: ogni 3 ore ──────────────────────────────────────────────────
cron.schedule("0 */3 * * *", async () => {
  console.log("[cron] personalizer start");
  try {
    await runPersonalizer();
    console.log("[cron] personalizer done");
  } catch (err) {
    console.error("[cron] personalizer error:", err);
  }
});
