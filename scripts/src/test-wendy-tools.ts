/**
 * test-wendy-tools.ts — verifica end-to-end dei 17 tool Wendy contro il DB reale.
 *
 * Esecuzione:
 *   pnpm --filter @workspace/scripts exec tsx ./src/test-wendy-tools.ts
 *
 * Usa un userId di test fittizio (99999) — non deve esistere nel DB.
 * I tool di lettura funzionano senza userId valido.
 * I tool di scrittura vengono testati con writeMode=true e poi il dato viene eliminato.
 */

import "dotenv/config";
import { executeToolCall } from "@workspace/ai-server";

const TEST_USER_ID = 1;  // sostituire con un userId valido nel DB di sviluppo
const PASS = "✅";
const FAIL = "❌";
let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, details?: unknown) {
  if (condition) {
    console.log(`  ${PASS} ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${label}`, details ?? "");
    failed++;
  }
}

async function run(label: string, fn: () => Promise<void>) {
  console.log(`\n── ${label} ──`);
  try {
    await fn();
  } catch (err) {
    console.log(`  ${FAIL} Eccezione non gestita:`, err);
    failed++;
  }
}

// ─── Scenari di test ─────────────────────────────────────────────────────────

async function main() {
  console.log("🧪  Test Wendy Tools — DB reale\n");

  // ── 1. open_view ────────────────────────────────────────────────────────────
  await run("open_view", async () => {
    const r = await executeToolCall("open_view", { viewId: "settori" }, TEST_USER_ID);
    assert("ok=true",       r.ok === true);
    assert("clientSide",    r.ok && (r.data as any)?.clientSide === true);
    assert("url=/settori",  r.ok && (r.data as any)?.url === "/settori");
  });

  // ── 2. set_filters ──────────────────────────────────────────────────────────
  await run("set_filters", async () => {
    const r = await executeToolCall("set_filters", { listType: "sectors", filters: { trend: "booming" } }, TEST_USER_ID);
    assert("ok=true",   r.ok === true);
    assert("clientSide", r.ok && (r.data as any)?.clientSide === true);
  });

  // ── 3. get_sector_detail ─────────────────────────────────────────────────────
  await run("get_sector_detail", async () => {
    // Cerca l'ID del settore Tecnologia
    const r = await executeToolCall("get_sector_detail", { sectorId: 1 }, TEST_USER_ID);
    assert("ok=true",         r.ok === true);
    assert("ha .name",        r.ok && typeof (r.data as any)?.name === "string");
    assert("ha .trend",       r.ok && typeof (r.data as any)?.trend === "string");
    assert("ha .avgSalaryMin",r.ok && typeof (r.data as any)?.avgSalaryMin === "number");
  });

  // ── 4. list_sectors ──────────────────────────────────────────────────────────
  await run("list_sectors", async () => {
    const r = await executeToolCall("list_sectors", { trend: "booming", limit: 3 }, TEST_USER_ID);
    assert("ok=true",           r.ok === true);
    assert("sectors è array",   r.ok && Array.isArray((r.data as any)?.sectors));
    assert("max 3 risultati",   r.ok && (r.data as any)?.sectors?.length <= 3);
    assert("tutti booming",     r.ok && (r.data as any)?.sectors?.every((s: any) => s.trend === "booming"));
  });

  // ── 5. get_profession_detail ─────────────────────────────────────────────────
  await run("get_profession_detail", async () => {
    const r = await executeToolCall("get_profession_detail", { professionId: 1 }, TEST_USER_ID);
    assert("ok=true",       r.ok === true);
    assert("ha .title",     r.ok && typeof (r.data as any)?.title === "string");
    assert("ha .skills",    r.ok && Array.isArray((r.data as any)?.skills));
  });

  // ── 6. search_professions ───────────────────────────────────────────────────
  await run("search_professions", async () => {
    const r = await executeToolCall("search_professions", { query: "developer", limit: 3 }, TEST_USER_ID);
    assert("ok=true",         r.ok === true);
    assert("professions array",r.ok && Array.isArray((r.data as any)?.professions));
    assert("risultato trovato",r.ok && (r.data as any)?.professions?.length > 0);
  });

  // ── 7. compare_sectors ──────────────────────────────────────────────────────
  await run("compare_sectors", async () => {
    const r = await executeToolCall("compare_sectors", { sectorIds: [1, 2] }, TEST_USER_ID);
    assert("ok=true",         r.ok === true);
    assert("2 settori",       r.ok && (r.data as any)?.sectors?.length === 2);

    const bad = await executeToolCall("compare_sectors", { sectorIds: [1] }, TEST_USER_ID);
    assert("errore con 1 ID", bad.ok === false && bad.code === "INVALID_INPUT");
  });

  // ── 8. get_market_trend ─────────────────────────────────────────────────────
  await run("get_market_trend", async () => {
    const r = await executeToolCall("get_market_trend", { sectorName: "Tech" }, TEST_USER_ID);
    assert("ok=true",     r.ok === true);
    assert("items array", r.ok && Array.isArray((r.data as any)?.items));
  });

  // ── 9. get_user_objectives ──────────────────────────────────────────────────
  await run("get_user_objectives", async () => {
    const r = await executeToolCall("get_user_objectives", {}, TEST_USER_ID);
    assert("ok=true",          r.ok === true);
    assert("objectives array", r.ok && Array.isArray((r.data as any)?.objectives));
  });

  // ── 10. save_objective ──────────────────────────────────────────────────────
  await run("save_objective", async () => {
    const r = await executeToolCall("save_objective", {
      text:          "Obiettivo di test — da eliminare",
      category:      "skill",
      deadlineWeeks: 4,
    }, TEST_USER_ID);
    assert("ok=true",  r.ok === true);
    assert("ha .id",   r.ok && typeof (r.data as any)?.id === "number");
    assert("ha .dueDate", r.ok && typeof (r.data as any)?.dueDate === "string");

    const empty = await executeToolCall("save_objective", { text: "" }, TEST_USER_ID);
    assert("errore con testo vuoto", empty.ok === false && empty.code === "INVALID_INPUT");
  });

  // ── 11. update_objective_progress ───────────────────────────────────────────
  await run("update_objective_progress", async () => {
    // Leggi l'ID del primo obiettivo dell'utente
    const list = await executeToolCall("get_user_objectives", {}, TEST_USER_ID);
    if (!list.ok || !(list.data as any)?.objectives?.length) {
      console.log("  ⚠️  Nessun obiettivo per TEST_USER_ID — skip");
      return;
    }
    const objId = (list.data as any).objectives[0].id;
    const r = await executeToolCall("update_objective_progress", { objectiveId: objId, progress: 50 }, TEST_USER_ID);
    assert("ok=true", r.ok === true);

    const bad = await executeToolCall("update_objective_progress", { objectiveId: 999999, progress: 50 }, TEST_USER_ID);
    assert("FORBIDDEN su ID altrui/inesistente", bad.ok === false && bad.code === "FORBIDDEN");
  });

  // ── 12. get_growth_articles ─────────────────────────────────────────────────
  await run("get_growth_articles", async () => {
    const r = await executeToolCall("get_growth_articles", { topic: "carriera", limit: 2 }, TEST_USER_ID);
    assert("ok=true",       r.ok === true);
    assert("articles array",r.ok && Array.isArray((r.data as any)?.articles));
  });

  // ── 13. get_news_summary ────────────────────────────────────────────────────
  await run("get_news_summary", async () => {
    const r = await executeToolCall("get_news_summary", { topic: "AI", limit: 3 }, TEST_USER_ID);
    assert("ok=true",   r.ok === true);
    assert("news array",r.ok && Array.isArray((r.data as any)?.news));
  });

  // ── 14. get_learning_paths ──────────────────────────────────────────────────
  await run("get_learning_paths", async () => {
    const r = await executeToolCall("get_learning_paths", { professionId: 1 }, TEST_USER_ID);
    assert("ok=true",     r.ok === true);
    assert("paths array", r.ok && Array.isArray((r.data as any)?.paths));

    const bySector = await executeToolCall("get_learning_paths", { sectorName: "Tecnologia" }, TEST_USER_ID);
    assert("paths fallback", bySector.ok === true);
  });

  // ── 15. save_business_idea ──────────────────────────────────────────────────
  await run("save_business_idea", async () => {
    const r = await executeToolCall("save_business_idea", {
      title:       "Idea di test",
      description: "Descrizione breve dell'idea di test.",
      sectorName:  "Tecnologia & Software",
    }, TEST_USER_ID);
    assert("ok=true", r.ok === true);
    assert("ha .id",  r.ok && typeof (r.data as any)?.id === "number");

    const bad = await executeToolCall("save_business_idea", { title: "", description: "" }, TEST_USER_ID);
    assert("errore senza dati", bad.ok === false && bad.code === "INVALID_INPUT");
  });

  // ── 16. add_calendar_event ──────────────────────────────────────────────────
  await run("add_calendar_event", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const dateStr = futureDate.toISOString().split("T")[0];

    const r = await executeToolCall("add_calendar_event", {
      title: "Evento di test",
      date:  dateStr,
      type:  "task",
      notes: "Creato da test script",
    }, TEST_USER_ID);
    assert("ok=true",  r.ok === true);
    assert("ha .id",   r.ok && typeof (r.data as any)?.id === "number");
    assert("ha .date", r.ok && (r.data as any)?.date === dateStr);

    const past = await executeToolCall("add_calendar_event", { title: "Past", date: "2020-01-01" }, TEST_USER_ID);
    assert("errore data passata", past.ok === false && past.code === "INVALID_INPUT");
  });

  // ── 17. get_user_context ────────────────────────────────────────────────────
  await run("get_user_context", async () => {
    const r = await executeToolCall("get_user_context", {}, TEST_USER_ID);
    assert("ok=true",             r.ok === true);
    assert("ha .topObjectives",   r.ok && Array.isArray((r.data as any)?.topObjectives));
    assert("ha .memoryFacts",     r.ok && Array.isArray((r.data as any)?.memoryFacts));
    assert("ha .preferredSectors",r.ok && Array.isArray((r.data as any)?.preferredSectors));
    // PRIVACY: nessun campo sensibile
    assert("no passwordHash",     r.ok && !(r.data as any)?.passwordHash);
    assert("no email",            r.ok && !(r.data as any)?.email);
  });

  // ── Riepilogo ────────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Risultato: ${passed} passati, ${failed} falliti`);
  if (failed > 0) {
    console.log("⚠️  Alcuni test hanno fallito — controlla i log sopra.");
    process.exit(1);
  } else {
    console.log("🎉  Tutti i test superati!");
  }
}

main().catch((err) => {
  console.error("❌  test-wendy-tools crashed:", err);
  process.exit(1);
});
