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
  { key: "DATABASE_URL",   description: "Connessione PostgreSQL — necessaria per tutto" },
  { key: "ADMIN_KEY",      description: "Chiave di accesso alle route /admin/*" },
  { key: "JWT_SECRET",     description: "Secret JWT — senza questo tutti i token vengono invalidati ad ogni restart" },
  { key: "GROQ_API_KEY",   description: "Groq — provider primario AI (streaming chat, json extraction, research)" },
];

const OPTIONAL: EnvEntry[] = [
  // ── AI Provider ─────────────────────────────────────────────────────────────
  { key: "ANTHROPIC_API_KEY",     description: "Anthropic Claude — agent_analysis (RIASEC+Spiriti). Senza questo l'analisi profilo cade su OpenAI" },
  { key: "OPENAI_API_KEY",        description: "OpenAI — embedding (obbligatorio per RAG) + fallback universale se Groq/Anthropic sono giù" },
  // ── AI Router overrides (hot-swap senza redeploy) ───────────────────────────
  { key: "AI_STREAMING_PROVIDER", description: "Override provider streaming_chat (groq|openai|anthropic|google). Default: groq" },
  { key: "AI_JSON_PROVIDER",      description: "Override provider json_extraction (groq|openai). Default: groq" },
  { key: "AI_RESEARCH_PROVIDER",  description: "Override provider research job (groq|openai). Default: groq" },
  { key: "AI_AGENT_PROVIDER",     description: "Override provider agent_analysis (anthropic|openai). Default: anthropic" },
  { key: "AI_MODEL_OVERRIDE",     description: "Override globale del modello AI (es. gpt-4o, llama-3.3-70b). Sovrascrive il default del provider selezionato" },
  // ── Pagamenti ────────────────────────────────────────────────────────────────
  { key: "STRIPE_SECRET_KEY",               description: "Stripe — checkout e abbonamenti disabilitati" },
  { key: "STRIPE_WEBHOOK_SECRET",           description: "Stripe webhooks — eventi pagamento non processati" },
  // ── News & Research ──────────────────────────────────────────────────────────
  { key: "GNEWS_API_KEY",                   description: "GNews — scheduler notizie disabilitato" },
  { key: "TAVILY_API_KEY",                  description: "Tavily — scheduler ricerca settoriale disabilitato" },
  // ── Email & Push ─────────────────────────────────────────────────────────────
  { key: "RESEND_API_KEY",                  description: "Resend — email reminder e digest settimanale disabilitati" },
  { key: "EMAIL_FROM",                      description: "Email mittente verificato (es. noreply@tuodominio.eu)" },
  { key: "VAPID_PUBLIC_KEY",                description: "Web Push — notifiche push disabilitate" },
  { key: "VAPID_PRIVATE_KEY",               description: "Web Push — notifiche push disabilitate" },
  { key: "VAPID_EMAIL",                     description: "Web Push — notifiche push disabilitate" },
  // ── Auth & CORS ──────────────────────────────────────────────────────────────
  { key: "GOOGLE_CLIENT_ID",                description: "Google OAuth — login con Google disabilitato" },
  { key: "CORS_ORIGIN",                     description: "Origin frontend in produzione (es. https://northstar.app) — senza questo CORS è aperto solo a localhost:5000" },
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

  // --- AI Router summary ---
  const aiProvider = process.env.AI_STREAMING_PROVIDER ?? "groq";
  const hasGroq = !!process.env.GROQ_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  console.log(`\n  [AI ROUTER]`);
  console.log(`  streaming_chat  → ${aiProvider}  ${hasGroq ? "✓" : "⚠ GROQ_API_KEY mancante"}`);
  console.log(`  agent_analysis  → ${process.env.AI_AGENT_PROVIDER ?? "anthropic"}  ${hasAnthropic ? "✓" : "⚠ ANTHROPIC_API_KEY mancante (fallback openai)"}`);
  console.log(`  embedding       → openai  ${hasOpenAI ? "✓" : "✗ OPENAI_API_KEY mancante — RAG disabilitato"}`);
  console.log(`  json_extraction → ${process.env.AI_JSON_PROVIDER ?? "groq"}  ${hasGroq ? "✓" : "⚠ GROQ_API_KEY mancante"}`);
  console.log(`  research        → ${process.env.AI_RESEARCH_PROVIDER ?? "groq"}  ${hasGroq ? "✓" : "⚠ GROQ_API_KEY mancante"}`);

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
