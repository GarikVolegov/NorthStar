/**
 * Startup environment variable health check.
 *
 * Run this before the server starts to surface missing configuration clearly
 * instead of crashing mid-boot with cryptic errors.
 *
 * - REQUIRED vars: server refuses to start if any are absent.
 * - OPTIONAL vars: server starts, but affected features are disabled (logged as warnings).
 */

interface EnvEntry {
  key: string;
  description: string;
}

const REQUIRED: EnvEntry[] = [
  { key: "DATABASE_URL",  description: "Connessione PostgreSQL — necessaria per tutto" },
  { key: "ADMIN_KEY",     description: "Chiave di accesso alle route /admin/*" },
  { key: "AI_AGENTS_URL", description: "Python AI Service — Wiki, Roadmap e Grafo RAG non funzionano senza" },
];

const OPTIONAL: EnvEntry[] = [
  { key: "JWT_SECRET",                      description: "Secret JWT — senza questo i token scadono ad ogni restart" },
  { key: "STRIPE_SECRET_KEY",               description: "Stripe — checkout e abbonamenti disabilitati" },
  { key: "STRIPE_WEBHOOK_SECRET",           description: "Stripe webhooks — eventi pagamento non processati" },
  { key: "GNEWS_API_KEY",                   description: "GNews — scheduler notizie disabilitato" },
  { key: "TAVILY_API_KEY",                  description: "Tavily — scheduler ricerca disabilitato" },
  { key: "RESEND_API_KEY",                  description: "Resend — email reminder e digest settimanale disabilitati" },
  { key: "VAPID_PUBLIC_KEY",                description: "Web Push — notifiche push disabilitate" },
  { key: "VAPID_PRIVATE_KEY",               description: "Web Push — notifiche push disabilitate" },
  { key: "VAPID_EMAIL",                     description: "Web Push — notifiche push disabilitate" },
  { key: "GOOGLE_CLIENT_ID",                description: "Google OAuth — login con Google disabilitato" },
  { key: "AI_INTEGRATIONS_OPENAI_BASE_URL", description: "Integrazione Replit OpenAI — Wiki AI, Roadmap, Growth Research disabilitati" },
  { key: "AI_INTEGRATIONS_OPENAI_API_KEY",  description: "Integrazione Replit OpenAI — necessaria insieme a AI_INTEGRATIONS_OPENAI_BASE_URL" },
];

export interface StartupCheckResult {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

export function runStartupCheck(): StartupCheckResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  const separator = "─".repeat(60);

  console.log(`\n${separator}`);
  console.log("  NorthStar — Verifica variabili d'ambiente");
  console.log(separator);

  // --- Required ---
  console.log("\n  [REQUIRED]");
  for (const entry of REQUIRED) {
    const present = !!process.env[entry.key];
    const icon = present ? "✓" : "✗";
    console.log(`  ${icon}  ${entry.key.padEnd(28)} ${present ? "ok" : `MANCANTE — ${entry.description}`}`);
    if (!present) missing.push(entry.key);
  }

  // --- Optional ---
  console.log("\n  [OPTIONAL]");
  for (const entry of OPTIONAL) {
    const present = !!process.env[entry.key];
    const icon = present ? "✓" : "⚠";
    console.log(`  ${icon}  ${entry.key.padEnd(28)} ${present ? "ok" : `non impostato — ${entry.description}`}`);
    if (!present) warnings.push(entry.key);
  }

  console.log(`\n${separator}`);

  if (missing.length > 0) {
    console.error(
      `\n  ✗ AVVIO BLOCCATO — ${missing.length} variabil${missing.length === 1 ? "e richiesta mancante" : "i richieste mancanti"}:`,
    );
    for (const key of missing) {
      const entry = REQUIRED.find((e) => e.key === key)!;
      console.error(`     • ${key}: ${entry.description}`);
    }
    console.error(
      "\n  Imposta le variabili mancanti nei Replit Secrets e riavvia il server.\n",
    );
  } else if (warnings.length > 0) {
    console.warn(
      `\n  ⚠  Server avviato — ${warnings.length} funzionalit${warnings.length === 1 ? "à opzionale disabilitata" : "à opzionali disabilitate"}.\n`,
    );
  } else {
    console.log("\n  ✓  Tutte le variabili configurate. Buona partenza!\n");
  }

  return { ok: missing.length === 0, missing, warnings };
}
