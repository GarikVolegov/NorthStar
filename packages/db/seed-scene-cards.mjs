/**
 * seed-scene-cards.mjs — il deck de "Lo Specchio" (preferenze rivelate).
 *
 * Ogni card e' un MOMENTO di lavoro concreto e vivido (non una domanda astratta).
 * L'utente reagisce di pancia (accende / salvo / spegne) e il SERVER deriva i
 * dims RIASEC dai `riasec_weights` della scena (anti-gaming): per questo i pesi
 * NON vengono mai inviati al client. Contenuto pubblico, ZERO PII.
 *
 * Idempotente: inserisce una scena solo se non esiste gia' una con lo stesso
 * prompt. Rilanciarlo e' sicuro (top-up, mai duplicati).
 *
 * Uso:
 *   pnpm db:seed:scenes           (env-aware: legge .env poi .env.local)
 *   node packages/db/seed-scene-cards.mjs
 *
 * Legenda RIASEC: R=Pratico  I=Indagatore  A=Creativo  S=Sociale
 *                 E=Intraprendente  C=Metodico   (pesi 0..1)
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

/** Il deck. Ogni scena ha 1 dimensione dominante + 0-2 secondarie. */
const scenes = [
  // ── R · Pratico (costruire, riparare, sistemi tangibili) ──────────────────
  { prompt: "Un sistema e' andato giu' venerdi' sera. Hai 4 ore e le mani sulla tastiera per rimetterlo in piedi prima di lunedi'.", weights: { R: 0.9, I: 0.5 }, tags: ["incident", "infrastruttura", "pressione", "pratica"] },
  { prompt: "Smonti un dispositivo che non funziona, capisci come e' fatto dentro e lo rimetti insieme che gira meglio di prima.", weights: { R: 1.0, I: 0.6 }, tags: ["hardware", "riparare", "curiosita-tecnica"] },
  { prompt: "Hai un weekend e dei pezzi sparsi: costruisci con le tue mani un prototipo che alla fine si accende e funziona.", weights: { R: 1.0, A: 0.4 }, tags: ["prototipo", "making", "costruire"] },
  { prompt: "Sei in cantiere, all'aperto, con strumenti veri tra le mani: alla fine della giornata vedi cio' che hai costruito.", weights: { R: 1.0 }, tags: ["campo", "manualita", "concreto"] },
  { prompt: "L'impianto che nessun altro riusciva a far ripartire: ci metti mano, segui il guasto a ritroso e torna a funzionare.", weights: { R: 1.0, I: 0.3 }, tags: ["troubleshooting", "impianti", "riparare"] },

  // ── I · Indagatore (analizzare, ricercare, capire il perche') ─────────────
  { prompt: "Un bug compare solo 1 volta su 10.000. Passi il pomeriggio a formulare ipotesi e isolare la causa, finche' non lo inchiodi.", weights: { I: 1.0, C: 0.4 }, tags: ["debug", "analisi", "rigore"] },
  { prompt: "Davanti a te una montagna di dati grezzi. Cerchi il pattern nascosto che nessuno ha ancora visto.", weights: { I: 1.0, C: 0.5 }, tags: ["dati", "pattern", "ricerca"] },
  { prompt: "Una domanda aperta senza risposta pronta: leggi trenta fonti e costruisci tu, pezzo per pezzo, la spiegazione.", weights: { I: 1.0, A: 0.3 }, tags: ["ricerca", "approfondimento", "studio"] },
  { prompt: "Disegni l'architettura di un sistema: scegli i pezzi, decidi come si parlano, previeni i punti di rottura.", weights: { I: 0.8, R: 0.5, C: 0.4 }, tags: ["architettura", "design-tecnico", "sistemi"] },
  { prompt: "Ottimizzi un processo lento: misuri, capisci dov'e' il collo di bottiglia e lo porti da 10 secondi a un battito di ciglia.", weights: { I: 0.9, C: 0.6, R: 0.3 }, tags: ["performance", "ottimizzazione", "misura"] },
  { prompt: "Pensi come chi vuole entrare: cerchi la falla di sicurezza prima dei cattivi e la chiudi.", weights: { I: 0.9, R: 0.5, E: 0.3 }, tags: ["sicurezza", "investigazione", "rischio"] },

  // ── A · Creativo (estetica, espressione, inventare) ───────────────────────
  { prompt: "Tela bianca: devi inventare da zero l'identita' visiva di un prodotto che ancora non esiste.", weights: { A: 1.0, E: 0.3 }, tags: ["design", "brand", "creativita"] },
  { prompt: "Scrivi la storia di un marchio: ogni parola deve far sentire qualcosa a chi legge.", weights: { A: 0.9, S: 0.4 }, tags: ["scrittura", "storytelling", "comunicazione"] },
  { prompt: "Disegni l'interfaccia di un'app e la sposti di un pixel alla volta finche' tutto 'scorre' naturale.", weights: { A: 0.9, I: 0.4 }, tags: ["ui", "design", "dettaglio"] },
  { prompt: "Componi: musica, immagini o video per un progetto. L'estetica non e' un di piu', e' il punto.", weights: { A: 1.0 }, tags: ["arte", "estetica", "espressione"] },
  { prompt: "Curi l'esperienza di un evento: luci, ritmo, sorpresa. Ogni dettaglio deve emozionare chi entra.", weights: { A: 0.8, S: 0.6, E: 0.4 }, tags: ["esperienza", "evento", "regia"] },

  // ── S · Sociale (aiutare, insegnare, far crescere) ────────────────────────
  { prompt: "Un collega alle prime armi e' bloccato e frustrato. Ti siedi accanto e spieghi finche' non gli si illumina il volto.", weights: { S: 1.0, I: 0.3 }, tags: ["mentoring", "insegnare", "supporto"] },
  { prompt: "Un cliente arrabbiato al telefono. In dieci minuti lo ascolti, lo capisci e lo trasformi in un alleato.", weights: { S: 0.8, E: 0.6 }, tags: ["relazione", "ascolto", "conflitto"] },
  { prompt: "Tieni un workshop a venti persone e a un certo punto vedi che hanno finalmente capito. Quello sguardo ti riempie.", weights: { S: 0.9, E: 0.5 }, tags: ["formazione", "public-speaking", "impatto"] },
  { prompt: "Fai da guida a un gruppo: il loro progresso, non il tuo, e' la cosa che ti da' soddisfazione.", weights: { S: 1.0, E: 0.3 }, tags: ["coaching", "team", "crescita-altrui"] },
  { prompt: "Una persona in difficolta' si confida con te. La ascolti davvero e l'aiuti a vedere la sua strada.", weights: { S: 1.0 }, tags: ["ascolto", "cura", "empatia"] },

  // ── E · Intraprendente (guidare, convincere, rischiare, decidere) ─────────
  { prompt: "Sei davanti a tre investitori. Hai cinque minuti per convincerli a scommettere sulla tua idea.", weights: { E: 1.0, A: 0.3 }, tags: ["pitch", "persuasione", "startup"] },
  { prompt: "Negozi un accordo: leggi l'altra parte, fai la mossa giusta al momento giusto e chiudi.", weights: { E: 1.0, C: 0.3 }, tags: ["negoziazione", "vendita", "strategia"] },
  { prompt: "Lanci un prodotto tuo: scegli il prezzo, il messaggio, i primi clienti. Vince o perde sulle tue decisioni.", weights: { E: 1.0, A: 0.4 }, tags: ["business", "lancio", "iniziativa"] },
  { prompt: "Apri la tua attivita': metti i tuoi soldi su una scommessa che e' interamente tua.", weights: { E: 1.0, R: 0.3 }, tags: ["impresa", "rischio", "autonomia"] },
  { prompt: "Guidi un team verso una scadenza che sembra impossibile. Tieni la rotta, prendi le decisioni dure e ce la fate.", weights: { E: 0.9, S: 0.5, C: 0.4 }, tags: ["leadership", "team", "decisione"] },

  // ── C · Metodico (ordinare, strutturare, precisione, regole) ──────────────
  { prompt: "Prendi un archivio caotico e lo trasformi in un sistema dove ogni cosa ha il suo posto e si trova in due secondi.", weights: { C: 1.0, R: 0.3 }, tags: ["ordine", "organizzazione", "sistema"] },
  { prompt: "Controlli un bilancio riga per riga finche' ogni conto torna al centesimo. Quel pareggio ti da' pace.", weights: { C: 1.0, I: 0.3 }, tags: ["precisione", "numeri", "controllo"] },
  { prompt: "Documenti un processo passo dopo passo, cosi' che chiunque dopo di te possa rifarlo senza chiederti nulla.", weights: { C: 0.9, S: 0.4 }, tags: ["documentazione", "metodo", "chiarezza"] },
  { prompt: "Pianifichi un progetto complesso: tempi, dipendenze, rischi. Niente lasciato al caso.", weights: { C: 0.9, E: 0.5 }, tags: ["pianificazione", "project-management", "struttura"] },
  { prompt: "Tieni i registri perfetti: ogni transazione tracciata, ogni norma rispettata, zero sorprese in fase di verifica.", weights: { C: 1.0 }, tags: ["compliance", "rigore", "tracciabilita"] },

  // ── Blend / scelte di stile di lavoro (servono a separare le dimensioni) ──
  { prompt: "Stessa giornata, due modi: passarla in profondita' su un solo problema difficile, o saltare tra dieci cose diverse?", weights: { I: 0.6, C: 0.5 }, tags: ["focus", "stile-di-lavoro"] },
  { prompt: "Ti danno carta bianca senza istruzioni: ti accende la liberta' o ti mette ansia non avere una traccia?", weights: { A: 0.6, E: 0.5 }, tags: ["autonomia", "ambiguita", "stile-di-lavoro"] },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL non impostata (controlla .env.local). Stop.");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  let inserted = 0;
  let skipped = 0;
  for (const s of scenes) {
    try {
      const r = await client.query(
        `INSERT INTO scene_cards (prompt, riasec_weights, tags, active)
         SELECT $1, $2::jsonb, $3::text[], true
         WHERE NOT EXISTS (SELECT 1 FROM scene_cards WHERE prompt = $1)`,
        [s.prompt, JSON.stringify(s.weights), s.tags],
      );
      if (r.rowCount > 0) {
        inserted++;
        process.stdout.write(".");
      } else {
        skipped++;
        process.stdout.write("-");
      }
    } catch (e) {
      console.error(`\nErrore su scena "${s.prompt.slice(0, 40)}...":`, e.message);
    }
  }

  const { rows } = await client.query(`SELECT count(*)::int AS n FROM scene_cards WHERE active = true`);
  await client.end();
  console.log(`\nDeck Specchio: ${inserted} inserite, ${skipped} gia' presenti. Scene attive totali: ${rows[0]?.n ?? "?"}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
