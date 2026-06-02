/**
 * refresh-eurostat-sectors.mjs — crescita/trend REALI dei settori da Eurostat.
 *
 * Sostituisce i `trend`/`growth_rate` finora indicativi con dati REALI di
 * occupazione (Eurostat nama_10_a64, occupati per attività NACE, Italia).
 * Ogni settore NorthStar è mappato a un codice NACE difendibile; trend e
 * growth_rate (CAGR) derivano dalla variazione reale degli occupati.
 *
 * Prudente (lezione ESCO): aggiorna SOLO i settori con mapping definito e dato
 * disponibile; stampa before→after; non tocca i settori non mappati.
 * Nessuna key, nessun PII (statistiche pubbliche aggregate UE).
 *
 * Uso: pnpm db:refresh:eurostat   |   node packages/db/refresh-eurostat-sectors.mjs --dry
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
const DRY = process.argv.includes("--dry");

// Mapping curato settore NorthStar → codice NACE (Eurostat nama_10_a64).
const NACE_BY_SECTOR = {
  "Tecnologia & Software":            "J",        // Information and communication
  "Dati & Intelligenza Artificiale":  "J",
  "Media & Intrattenimento":          "J",        // J58-60 (publishing/broadcasting) dentro J
  "Finanza & Investimenti":           "K",        // Financial and insurance
  "Sanità & Life Sciences":           "Q",        // Human health and social work
  "Istruzione & Formazione":          "P",        // Education
  "Energia & Sostenibilità":          "D",        // Electricity, gas, steam
  "Logistica & Supply Chain":         "H",        // Transportation and storage
  "Immobiliare & PropTech":           "L68",      // Real estate
  "E-commerce & Retail":              "G",        // Wholesale and retail trade
  "Legale & Compliance":              "M69_M70",  // Legal, accounting, management
  "Consulting & Management":          "M69_M70",
  "Risorse Umane & People Ops":       "N",        // Administrative and support services
  "Marketing & Comunicazione":        "M73",      // Advertising and market research
  "Design & UX":                      "M74_M75",  // Other professional, scientific, technical
};

const YEARS = ["2018", "2019", "2020", "2021", "2022", "2023", "2024"];

function trendFromGrowth(totalPct) {
  if (totalPct > 12) return "booming";
  if (totalPct > 4) return "growing";
  if (totalPct > -4) return "stable";
  return "declining";
}

async function fetchEurostat(codes) {
  const u = new URL("https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nama_10_a64_e");
  u.searchParams.set("format", "JSON");
  u.searchParams.set("geo", "IT");
  u.searchParams.set("na_item", "EMP_DC");
  u.searchParams.set("unit", "THS_PER");
  for (const c of codes) u.searchParams.append("nace_r2", c);
  for (const y of YEARS) u.searchParams.append("time", y);
  const res = await fetch(u, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Eurostat ${res.status}`);
  const j = await res.json();
  if (!j.value) throw new Error("Eurostat: risposta senza dati");

  const naceCat = j.dimension.nace_r2.category;
  const timeCat = j.dimension.time.category;
  const timeKeys = Object.keys(timeCat.index).sort();
  const T = timeKeys.length;

  // Per ogni NACE: serie {anno: valore}, poi primo/ultimo anno con dato.
  const out = {};
  for (const code of Object.keys(naceCat.index)) {
    const series = [];
    for (const y of timeKeys) {
      const flat = naceCat.index[code] * T + timeCat.index[y];
      const v = j.value[flat];
      if (typeof v === "number") series.push({ year: Number(y), value: v });
    }
    if (series.length >= 2) {
      const first = series[0], last = series[series.length - 1];
      const span = last.year - first.year || 1;
      const totalPct = ((last.value - first.value) / first.value) * 100;
      const cagr = Math.pow(last.value / first.value, 1 / span) - 1;
      out[code] = { totalPct, cagr, from: first.year, to: last.year };
    }
  }
  return out;
}

async function main() {
  const codes = [...new Set(Object.values(NACE_BY_SECTOR))];
  const growth = await fetchEurostat(codes);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let updated = 0, skipped = 0;
  for (const [sectorName, nace] of Object.entries(NACE_BY_SECTOR)) {
    const g = growth[nace];
    if (!g) { console.log(`  - ${sectorName}: nessun dato NACE ${nace} → salto`); skipped++; continue; }

    const trend = trendFromGrowth(g.totalPct);
    // Crescita REALE in PUNTI PERCENTUALI (variazione occupati nel periodo), 1 dec.
    // Convenzione DB/display: i componenti mostrano `${growthRate}%`, quindi il
    // valore è già in %, non una frazione (prima 0.18 veniva mostrato come "0,18%").
    const growthRate = Math.round(g.totalPct * 10) / 10;

    const { rows: before } = await client.query(
      `SELECT trend, growth_rate FROM sectors WHERE name = $1 LIMIT 1`, [sectorName]);
    if (before.length === 0) { console.log(`  ? ${sectorName}: settore non trovato → salto`); skipped++; continue; }

    console.log(`  ${sectorName} [NACE ${nace}, occupati ${g.from}→${g.to} ${g.totalPct >= 0 ? "+" : ""}${g.totalPct.toFixed(1)}%]: ` +
      `trend ${before[0].trend}→${trend}, growth ${before[0].growth_rate}→${growthRate}`);

    if (!DRY) {
      await client.query(`UPDATE sectors SET trend = $1, growth_rate = $2 WHERE name = $3`,
        [trend, growthRate, sectorName]);
    }
    updated++;
  }

  await client.end();
  console.log(`\n${DRY ? "[DRY] " : ""}Eurostat: ${updated} settori ${DRY ? "da aggiornare" : "aggiornati"}, ${skipped} saltati. Fonte: Eurostat nama_10_a64 (occupati, Italia).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
