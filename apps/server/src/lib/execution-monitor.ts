/**
 * execution-monitor.ts — sistema strutturato di error capture + diagnostica.
 *
 * Complementa Pino (che logga line-by-line) aggregando errori in un report
 * strutturato con `rootCauseAnalysis` + `repairSuggestions` lookup tabellare.
 *
 * NON sostituisce `lib/monitor.ts` (metrics ring-buffer) — lo affianca per
 * un'angolazione diversa: "cosa è rotto e perché", non "quanti errori".
 *
 * Storage: in-memory ring buffer (ultimi 200 errori). Reset al restart server.
 * Per persistenza long-term → integrare con Sentry/Datadog in futuro.
 *
 * @pattern Singleton + Ring Buffer
 */
import { rootLogger } from "../middleware/logger";

const log = rootLogger.child({ component: "execution-monitor" });

// ── Tipi ──────────────────────────────────────────────────────────────────────

export interface ComponentError {
  /** Path file dove l'errore è stato catturato (es. "routes/admin.ts") */
  file:        string;
  /** Nome funzione/handler (es. "POST /api/admin/X") */
  function:    string;
  /** Numero riga sorgente, se noto */
  line?:       number;
  /** Message dell'errore originale */
  message:     string;
  /** Codice errore strutturato (es. "ECONNREFUSED", "TIMEOUT", "VALIDATION") */
  code?:       string;
  /** Stack trace, se disponibile */
  stackTrace:  string;
  /** Timestamp di cattura ISO */
  capturedAt:  string;
  /** Conteggio occorrenze dedotto da `file:function:code` */
  occurrences: number;
}

export interface ErrorReport {
  /** Timestamp generazione report */
  timestamp:         string;
  /** Tutti gli errori unici nel ring-buffer (deduplicati per file:function:code) */
  errors:            ComponentError[];
  /** File con almeno 1 errore */
  brokenComponents:  string[];
  /** Analisi euristica: errore più frequente, classificazione causa */
  rootCauseAnalysis: string;
  /** Suggerimenti di riparazione lookup per pattern noti */
  repairSuggestions: string[];
  /** Totale errori catturati (pre-deduplicazione) */
  totalCaptured:     number;
}

interface CaptureContext {
  file:     string;
  function: string;
  line?:    number;
  code?:    string;
}

// ── Pattern → suggerimento di riparazione ─────────────────────────────────────

const REPAIR_PATTERNS: Array<{ match: RegExp; suggestion: string }> = [
  { match: /ECONNREFUSED.*:6379/i,   suggestion: "Redis non raggiungibile — verifica REDIS_URL e che il servizio sia up" },
  { match: /ECONNREFUSED/i,          suggestion: "Connessione TCP rifiutata — verifica host/porta del servizio chiamato" },
  { match: /ETIMEDOUT|TIMEOUT/i,     suggestion: "Timeout di rete — aumentare il timeout o verificare la latenza dell'upstream" },
  { match: /ENOTFOUND/i,             suggestion: "DNS lookup fallito — controlla hostname e configurazione DNS" },
  { match: /JWT|invalid token|jsonwebtoken/i, suggestion: "Token JWT non valido o scaduto — controlla JWT_SECRET e claim del token" },
  { match: /DATABASE|relation .* does not exist/i, suggestion: "Schema DB out-of-sync — esegui `pnpm migrate` nel package db" },
  { match: /OPENAI_API_KEY|OpenAI/i, suggestion: "Configurazione OpenAI mancante o quota esaurita — verifica chiave e fatturazione" },
  { match: /OPENROUTER/i,            suggestion: "Configurazione OpenRouter — verifica OPENROUTER_API_KEY e modello richiesto" },
  { match: /STRIPE/i,                suggestion: "Errore Stripe — verifica chiave + webhook signature secret" },
  { match: /Cannot find module/i,    suggestion: "Modulo mancante — esegui `pnpm install` e verifica gli import" },
];

function suggestRepair(error: ComponentError): string | null {
  const haystack = `${error.message} ${error.code ?? ""} ${error.stackTrace}`;
  for (const { match, suggestion } of REPAIR_PATTERNS) {
    if (match.test(haystack)) {
      return `[${error.file}:${error.function}] ${suggestion}`;
    }
  }
  return null;
}

// ── Singleton ─────────────────────────────────────────────────────────────────

class ExecutionMonitor {
  private static instance: ExecutionMonitor | null = null;
  private buffer: ComponentError[] = [];
  private readonly maxSize = 200;
  private totalCaptured = 0;

  static getInstance(): ExecutionMonitor {
    if (!ExecutionMonitor.instance) {
      ExecutionMonitor.instance = new ExecutionMonitor();
    }
    return ExecutionMonitor.instance;
  }

  /**
   * Cattura un errore strutturato. Deduplicazione automatica su `file:function:code`.
   * Fire-and-forget: non blocca mai il chiamante.
   */
  capture(error: unknown, ctx: CaptureContext): void {
    this.totalCaptured++;

    const message = error instanceof Error ? error.message : String(error);
    const stack   = error instanceof Error ? (error.stack ?? "") : "";
    const code    = ctx.code ?? this.inferCode(error);

    const dedupKey = `${ctx.file}::${ctx.function}::${code ?? "noCode"}`;
    const existing = this.buffer.find((e) =>
      `${e.file}::${e.function}::${e.code ?? "noCode"}` === dedupKey,
    );

    if (existing) {
      existing.occurrences++;
      existing.capturedAt = new Date().toISOString();
      return;
    }

    const componentError: ComponentError = {
      file:        ctx.file,
      function:    ctx.function,
      message,
      stackTrace:  stack.slice(0, 2000),
      capturedAt:  new Date().toISOString(),
      occurrences: 1,
      ...(ctx.line === undefined ? {} : { line: ctx.line }),
      ...(code === undefined ? {} : { code }),
    };

    this.buffer.push(componentError);
    if (this.buffer.length > this.maxSize) this.buffer.shift();

    log.warn({ file: ctx.file, fn: ctx.function, code, message }, "[execution-monitor] error captured");
  }

  getReport(): ErrorReport {
    return {
      timestamp:         new Date().toISOString(),
      errors:            [...this.buffer].sort((a, b) => b.occurrences - a.occurrences),
      brokenComponents:  [...new Set(this.buffer.map((e) => e.file))],
      rootCauseAnalysis: this.analyzeRootCause(),
      repairSuggestions: this.buildSuggestions(),
      totalCaptured:     this.totalCaptured,
    };
  }

  clear(): void {
    this.buffer = [];
    this.totalCaptured = 0;
    log.info("[execution-monitor] cleared");
  }

  private inferCode(error: unknown): string | undefined {
    if (typeof error === "object" && error !== null) {
      const e = error as { code?: unknown };
      if (typeof e.code === "string") return e.code;
    }
    return undefined;
  }

  private analyzeRootCause(): string {
    if (this.buffer.length === 0) return "Nessun errore rilevato — sistema sano";

    const top = [...this.buffer].sort((a, b) => b.occurrences - a.occurrences)[0];
    if (!top) return "Nessun errore rilevato";
    const totalUnique = this.buffer.length;
    const topPct = Math.round((top.occurrences / this.totalCaptured) * 100);

    return `Errore più frequente: ${top.code ?? "uncoded"} in ${top.file}:${top.function} ` +
           `(${top.occurrences} occorrenze, ${topPct}% del totale catturato). ` +
           `Errori unici totali: ${totalUnique}.`;
  }

  private buildSuggestions(): string[] {
    const suggestions = new Set<string>();
    for (const err of this.buffer) {
      const s = suggestRepair(err);
      if (s) suggestions.add(s);
    }
    if (suggestions.size === 0 && this.buffer.length > 0) {
      suggestions.add("Nessun pattern noto matched — controllare manualmente gli stack trace nel report");
    }
    return [...suggestions];
  }
}

export const executionMonitor = ExecutionMonitor.getInstance();

/**
 * Helper per integrare facilmente la cattura in try/catch o middleware:
 *
 *   try { ... }
 *   catch (e) {
 *     captureError(e, { file: "routes/admin.ts", function: "GET /stats" });
 *     throw e;
 *   }
 */
export function captureError(error: unknown, ctx: CaptureContext): void {
  executionMonitor.capture(error, ctx);
}
