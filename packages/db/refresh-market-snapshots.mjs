/**
 * refresh-market-snapshots.mjs — pipeline FRESHNESS della domanda di mercato.
 *
 * Popola job_posting_snapshots con dati REALI e AGGIORNATI per ogni professione
 * attiva. Due fonti, con fallback automatico:
 *   1. Adzuna (conteggi annunci ESATTI) se ADZUNA_APP_ID + ADZUNA_APP_KEY ci sono.
 *   2. Tavily web + OpenAI (stima fondata su fonti web) altrimenti.
 *
 * Onesto: la colonna `source` distingue 'adzuna' (reale) da 'web_estimate'
 * (stima). Idempotente: upsert su (role_title, period, geography, source).
 * growthRate = variazione % vs lo snapshot del periodo precedente, se esiste.
 *
 * Uso:
 *   pnpm db:refresh:market                 # tutte le professioni, fonte auto
 *   node packages/db/refresh-market-snapshots.mjs --limit 3
 *   node packages/db/refresh-market-snapshots.mjs --source web
 *   node packages/db/refresh-market-snapshots.mjs --source adzuna
 *
 * PRIVACY: solo aggregati anonimi (nessun PII, nessun annuncio singolo).
 */
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
dotenv.config({ path: resolve(repoRoot, ".env") });
dotenv.config({ path: resolve(repoRoot, ".env.local"), override: true });

const { Client } = pg;

// ── args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function argValue(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const LIMIT = Number(argValue("--limit", "0")) || 0;      // 0 = tutte
const SOURCE_MODE = argValue("--source", "auto");          // auto | adzuna | web
const GEOGRAPHY = "IT";
const PERIOD = new Date().toISOString().slice(0, 7);       // 'YYYY-MM'

const ADZUNA_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_KEY = process.env.ADZUNA_APP_KEY;
const TAVILY_KEY = process.env.TAVILY_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const adzunaReady = Boolean(ADZUNA_ID && ADZUNA_KEY);
const webReady = Boolean(TAVILY_KEY && OPENAI_KEY);

function chosenSource() {
  if (SOURCE_MODE === "adzuna") return adzunaReady ? "adzuna" : null;
  if (SOURCE_MODE === "web") return webReady ? "web" : null;
  // auto: preferisci Adzuna (reale), altrimenti web
  if (adzunaReady) return "adzuna";
  if (webReady) return "web";
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function prevPeriod(period) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1)); // m-1 è il mese corrente (0-based) → -1 ancora
  return d.toISOString().slice(0, 7);
}

// ── Provider: Adzuna (conteggi reali) ───────────────────────────────────────
async function fetchAdzuna(roleTitle) {
  const url = new URL("https://api.adzuna.com/v1/api/jobs/it/search/1");
  url.searchParams.set("app_id", ADZUNA_ID);
  url.searchParams.set("app_key", ADZUNA_KEY);
  url.searchParams.set("what", roleTitle);
  url.searchParams.set("results_per_page", "1");
  url.searchParams.set("content-type", "application/json");
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Adzuna ${res.status}`);
  const data = await res.json();
  return {
    source: "adzuna",
    count: Math.max(0, Math.round(Number(data.count ?? 0))),
    avgSalaryMin: data.salary_min != null ? Math.round(Number(data.salary_min)) : null,
    avgSalaryMax: data.salary_max != null ? Math.round(Number(data.salary_max)) : null,
    topSkills: [],
    growthRate: null,
  };
}

// ── Provider: Tavily web + OpenAI (stima fondata) ───────────────────────────
async function tavilySearch(query) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: TAVILY_KEY, query, max_results: 5, search_depth: "basic" }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map((r) => `${r.title}: ${r.content}`).join("\n\n").slice(0, 6000);
}

async function openaiExtract(roleTitle, sectorName, webContext) {
  const prompt = `Sei un analista del mercato del lavoro italiano. Sulla base ESCLUSIVAMENTE delle fonti web qui sotto, stima la domanda ATTUALE in Italia per il ruolo "${roleTitle}"${sectorName ? ` (settore: ${sectorName})` : ""}.
Rispondi SOLO con JSON valido con questa forma:
{"count": <intero stima annunci attivi/mese in Italia>, "avgSalaryMin": <intero EUR/anno o null>, "avgSalaryMax": <intero EUR/anno o null>, "growthRate": <numero -50..50 variazione % stimata o null>, "topSkills": [<max 8 skill richieste>]}
Se le fonti non bastano per un campo, usa null (o stima prudente per count). Non inventare numeri assurdi.

FONTI WEB:
${webContext || "(nessuna fonte utile)"}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    source: "web_estimate",
    count: Math.max(0, Math.round(num(parsed.count) ?? 0)),
    avgSalaryMin: num(parsed.avgSalaryMin) != null ? Math.round(num(parsed.avgSalaryMin)) : null,
    avgSalaryMax: num(parsed.avgSalaryMax) != null ? Math.round(num(parsed.avgSalaryMax)) : null,
    growthRate: num(parsed.growthRate),
    topSkills: Array.isArray(parsed.topSkills) ? parsed.topSkills.filter((s) => typeof s === "string").slice(0, 8) : [],
  };
}

async function fetchWeb(roleTitle, sectorName) {
  const ctx = await tavilySearch(`domanda lavoro ${roleTitle} Italia ${PERIOD} annunci richiesta mercato`);
  return openaiExtract(roleTitle, sectorName, ctx);
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  const source = chosenSource();
  if (!source) {
    console.error(`Nessuna fonte disponibile per --source ${SOURCE_MODE}. ` +
      `Adzuna ready=${adzunaReady}, Web ready=${webReady}. ` +
      `Imposta ADZUNA_APP_ID/ADZUNA_APP_KEY oppure TAVILY_API_KEY/OPENAI_API_KEY.`);
    process.exit(1);
  }
  console.log(`Refresh mercato — fonte: ${source} · periodo: ${PERIOD} · geo: ${GEOGRAPHY}` +
    (LIMIT ? ` · limit: ${LIMIT}` : ""));

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows: professions } = await client.query(
    `SELECT p.id, p.title, p.sector_id, p.skills, s.name AS sector_name
     FROM professions p LEFT JOIN sectors s ON s.id = p.sector_id
     WHERE p.is_active = true
     ORDER BY p.id` + (LIMIT ? ` LIMIT ${LIMIT}` : ""),
  );

  let ok = 0, fail = 0;
  for (const p of professions) {
    const roleTitle = String(p.title).toLowerCase();
    try {
      let snap;
      if (source === "adzuna") {
        snap = await fetchAdzuna(p.title);
        // skill reali del ruolo come proxy (Adzuna non le espone facilmente)
        if (Array.isArray(p.skills) && p.skills.length) snap.topSkills = p.skills.slice(0, 8);
      } else {
        snap = await fetchWeb(p.title, p.sector_name);
      }

      // growthRate vs periodo precedente (se non già stimato dalla fonte)
      if (snap.growthRate == null) {
        const { rows: prev } = await client.query(
          `SELECT count FROM job_posting_snapshots
           WHERE role_title = $1 AND geography = $2 AND period = $3 AND source = $4 LIMIT 1`,
          [roleTitle, GEOGRAPHY, prevPeriod(PERIOD), snap.source],
        );
        if (prev[0] && prev[0].count > 0) {
          snap.growthRate = Math.round(((snap.count - prev[0].count) / prev[0].count) * 1000) / 10;
        }
      }

      await client.query(
        `INSERT INTO job_posting_snapshots
           (role_title, sector_id, profession_id, count, period, geography, top_skills, avg_salary_min, avg_salary_max, growth_rate, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (role_title, period, geography, source) DO UPDATE SET
           sector_id = EXCLUDED.sector_id, profession_id = EXCLUDED.profession_id,
           count = EXCLUDED.count, top_skills = EXCLUDED.top_skills,
           avg_salary_min = EXCLUDED.avg_salary_min, avg_salary_max = EXCLUDED.avg_salary_max,
           growth_rate = EXCLUDED.growth_rate`,
        [roleTitle, p.sector_id, p.id, snap.count, PERIOD, GEOGRAPHY,
         snap.topSkills, snap.avgSalaryMin, snap.avgSalaryMax, snap.growthRate, snap.source],
      );
      ok++;
      process.stdout.write(`.`);
      await sleep(source === "adzuna" ? 300 : 800); // rate-limit gentile
    } catch (e) {
      fail++;
      process.stdout.write(`x`);
      console.error(`\n  [${p.title}] ${e.message}`);
    }
  }

  const { rows: tot } = await client.query(
    `SELECT count(*)::int n FROM job_posting_snapshots WHERE period = $1`, [PERIOD]);
  await client.end();
  console.log(`\nFatto: ${ok} ok, ${fail} falliti. Snapshot nel periodo ${PERIOD}: ${tot[0]?.n ?? "?"}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
