/**
 * Utility per verificare la disponibilità dell'integrazione OpenAI.
 *
 * Usato come pre-flight check nelle route SSE che chiamano OpenAI,
 * prima di aprire lo stream — così l'errore arriva come JSON 503
 * invece di un messaggio generico dentro lo stream SSE.
 */
import type { Response } from "express";

const NOT_CONFIGURED_MSG =
  "Il servizio AI non è disponibile. Attiva l'integrazione OpenAI su Replit (Tools → Integrations → OpenAI) e riavvia il server.";

export function isOpenAIConfigured(): boolean {
  return !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
}

/**
 * Se OpenAI non è configurato, invia un 503 JSON e restituisce true (= caller deve fare return).
 * Se è configurato, restituisce false (= proseguire normalmente).
 */
export function rejectIfOpenAINotConfigured(res: Response): boolean {
  if (!isOpenAIConfigured()) {
    res.status(503).json({
      error: NOT_CONFIGURED_MSG,
      code: "OPENAI_NOT_CONFIGURED",
    });
    return true;
  }
  return false;
}

/**
 * Messaggio di errore da usare nei blocchi catch delle route SSE.
 * Distingue tra "integrazione non configurata" e altri errori.
 */
export function openAIErrorMessage(err: unknown): string {
  if (
    err instanceof Error &&
    (err.message.includes("AI_INTEGRATIONS_OPENAI_BASE_URL") ||
      err.message.includes("AI_INTEGRATIONS_OPENAI_API_KEY"))
  ) {
    return NOT_CONFIGURED_MSG;
  }
  return "Errore nella generazione. Riprova.";
}
