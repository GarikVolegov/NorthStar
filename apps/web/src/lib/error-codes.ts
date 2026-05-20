/**
 * Error Codes — Catalogo completo errori con definizioni specifiche.
 * Ogni errore ha: codice, messaggio IT/EN, severità, azione di recovery.
 */

export type ErrorSeverity = "critical" | "error" | "warning" | "info";

export interface ErrorDefinition {
  code: string;
  messageIT: string;
  messageEN: string;
  severity: ErrorSeverity;
  recoveryAction: string;
  category: ErrorCategory;
}

export type ErrorCategory =
  | "auth"
  | "network"
  | "api"
  | "ai"
  | "validation"
  | "storage"
  | "render"
  | "state"
  | "permission"
  | "payment"
  | "websocket"
  | "unknown";

export const ERROR_DEFINITIONS: Record<string, ErrorDefinition> = {
  // ── Auth Errors ──
  AUTH_TOKEN_EXPIRED: {
    code: "AUTH_TOKEN_EXPIRED",
    messageIT: "Sessione scaduta. Effettua nuovamente l'accesso.",
    messageEN: "Session expired. Please log in again.",
    severity: "error",
    recoveryAction: "redirect_login",
    category: "auth",
  },
  AUTH_TOKEN_INVALID: {
    code: "AUTH_TOKEN_INVALID",
    messageIT: "Token di autenticazione non valido.",
    messageEN: "Invalid authentication token.",
    severity: "error",
    recoveryAction: "redirect_login",
    category: "auth",
  },
  AUTH_UNAUTHORIZED: {
    code: "AUTH_UNAUTHORIZED",
    messageIT: "Non hai i permessi per accedere a questa risorsa.",
    messageEN: "You do not have permission to access this resource.",
    severity: "error",
    recoveryAction: "redirect_home",
    category: "permission",
  },
  AUTH_FORBIDDEN: {
    code: "AUTH_FORBIDDEN",
    messageIT: "Accesso negato. Questa funzionalità richiede un piano Premium.",
    messageEN: "Access denied. This feature requires a Premium plan.",
    severity: "error",
    recoveryAction: "upgrade_premium",
    category: "permission",
  },
  AUTH_NOT_FOUND: {
    code: "AUTH_NOT_FOUND",
    messageIT: "Utente non trovato.",
    messageEN: "User not found.",
    severity: "error",
    recoveryAction: "redirect_register",
    category: "auth",
  },

  // ── Network Errors ──
  NETWORK_OFFLINE: {
    code: "NETWORK_OFFLINE",
    messageIT: "Nessuna connessione internet. Verifica la tua connessione.",
    messageEN: "No internet connection. Check your connection.",
    severity: "critical",
    recoveryAction: "retry",
    category: "network",
  },
  NETWORK_TIMEOUT: {
    code: "NETWORK_TIMEOUT",
    messageIT: "La richiesta ha impiegato troppo tempo. Riprova.",
    messageEN: "Request timed out. Please try again.",
    severity: "error",
    recoveryAction: "retry",
    category: "network",
  },
  NETWORK_ERROR: {
    code: "NETWORK_ERROR",
    messageIT: "Errore di rete. Impossibile connettersi al server.",
    messageEN: "Network error. Unable to connect to server.",
    severity: "error",
    recoveryAction: "retry",
    category: "network",
  },

  // ── API Errors ──
  API_NOT_FOUND: {
    code: "API_NOT_FOUND",
    messageIT: "La risorsa richiesta non è stata trovata.",
    messageEN: "The requested resource was not found.",
    severity: "error",
    recoveryAction: "redirect_home",
    category: "api",
  },
  API_SERVER_ERROR: {
    code: "API_SERVER_ERROR",
    messageIT: "Errore del server. Riprova più tardi.",
    messageEN: "Server error. Please try again later.",
    severity: "critical",
    recoveryAction: "retry_later",
    category: "api",
  },
  API_BAD_REQUEST: {
    code: "API_BAD_REQUEST",
    messageIT: "Richiesta non valida. Verifica i dati inseriti.",
    messageEN: "Bad request. Please check your input.",
    severity: "error",
    recoveryAction: "fix_input",
    category: "validation",
  },
  API_RATE_LIMITED: {
    code: "API_RATE_LIMITED",
    messageIT: "Troppe richieste. Attendi un momento prima di riprovare.",
    messageEN: "Too many requests. Please wait a moment before trying again.",
    severity: "warning",
    recoveryAction: "wait_retry",
    category: "api",
  },
  API_CONFLICT: {
    code: "API_CONFLICT",
    messageIT: "Conflitto: la risorsa è stata modificata da un'altra sessione.",
    messageEN: "Conflict: the resource was modified by another session.",
    severity: "warning",
    recoveryAction: "refresh_retry",
    category: "api",
  },

  // ── AI Errors ──
  AI_SERVICE_UNAVAILABLE: {
    code: "AI_SERVICE_UNAVAILABLE",
    messageIT: "Servizio AI non disponibile. Riprova più tardi.",
    messageEN: "AI service unavailable. Please try again later.",
    severity: "error",
    recoveryAction: "retry_later",
    category: "ai",
  },
  AI_TIMEOUT: {
    code: "AI_TIMEOUT",
    messageIT: "L'AI ha impiegato troppo tempo per rispondere. Riprova.",
    messageEN: "AI response timed out. Please try again.",
    severity: "error",
    recoveryAction: "retry",
    category: "ai",
  },
  AI_INVALID_RESPONSE: {
    code: "AI_INVALID_RESPONSE",
    messageIT: "Risposta dell'AI non valida. Riprova.",
    messageEN: "Invalid AI response. Please try again.",
    severity: "error",
    recoveryAction: "retry",
    category: "ai",
  },
  AI_EMPTY_RESPONSE: {
    code: "AI_EMPTY_RESPONSE",
    messageIT: "L'AI non ha generato alcun contenuto. Riprova.",
    messageEN: "AI generated no content. Please try again.",
    severity: "error",
    recoveryAction: "retry",
    category: "ai",
  },
  AI_STREAM_ERROR: {
    code: "AI_STREAM_ERROR",
    messageIT: "Errore durante lo streaming AI. Connessione interrotta.",
    messageEN: "Error during AI streaming. Connection interrupted.",
    severity: "error",
    recoveryAction: "retry",
    category: "ai",
  },
  AI_COST_EXCEEDED: {
    code: "AI_COST_EXCEEDED",
    messageIT: "Limite di utilizzo AI raggiunto. Riprova domani.",
    messageEN: "AI usage limit reached. Please try again tomorrow.",
    severity: "warning",
    recoveryAction: "wait_daily_reset",
    category: "ai",
  },

  // ── Validation Errors ──
  VALIDATION_REQUIRED: {
    code: "VALIDATION_REQUIRED",
    messageIT: "Campo obbligatorio.",
    messageEN: "Required field.",
    severity: "error",
    recoveryAction: "fix_input",
    category: "validation",
  },
  VALIDATION_FORMAT: {
    code: "VALIDATION_FORMAT",
    messageIT: "Formato non valido.",
    messageEN: "Invalid format.",
    severity: "error",
    recoveryAction: "fix_input",
    category: "validation",
  },
  VALIDATION_LENGTH: {
    code: "VALIDATION_LENGTH",
    messageIT: "Lunghezza non valida.",
    messageEN: "Invalid length.",
    severity: "error",
    recoveryAction: "fix_input",
    category: "validation",
  },
  VALIDATION_RANGE: {
    code: "VALIDATION_RANGE",
    messageIT: "Valore fuori dal range consentito.",
    messageEN: "Value out of allowed range.",
    severity: "error",
    recoveryAction: "fix_input",
    category: "validation",
  },

  // ── Storage Errors ──
  STORAGE_FULL: {
    code: "STORAGE_FULL",
    messageIT: "Memoria locale piena. Libera spazio e riprova.",
    messageEN: "Local storage full. Free up space and try again.",
    severity: "warning",
    recoveryAction: "clear_storage",
    category: "storage",
  },
  STORAGE_READ_ERROR: {
    code: "STORAGE_READ_ERROR",
    messageIT: "Impossibile leggere i dati salvati.",
    messageEN: "Unable to read saved data.",
    severity: "error",
    recoveryAction: "retry",
    category: "storage",
  },
  STORAGE_WRITE_ERROR: {
    code: "STORAGE_WRITE_ERROR",
    messageIT: "Impossibile salvare i dati.",
    messageEN: "Unable to save data.",
    severity: "error",
    recoveryAction: "retry",
    category: "storage",
  },

  // ── Render Errors ──
  RENDER_COMPONENT_FAILED: {
    code: "RENDER_COMPONENT_FAILED",
    messageIT: "Errore nel rendering del componente.",
    messageEN: "Component rendering error.",
    severity: "critical",
    recoveryAction: "reload_page",
    category: "render",
  },
  RENDER_PAGE_FAILED: {
    code: "RENDER_PAGE_FAILED",
    messageIT: "Errore nel caricamento della pagina.",
    messageEN: "Page loading error.",
    severity: "critical",
    recoveryAction: "reload_page",
    category: "render",
  },

  // ── State Errors ──
  STATE_SYNC_FAILED: {
    code: "STATE_SYNC_FAILED",
    messageIT: "Sincronizzazione dello stato fallita.",
    messageEN: "State synchronization failed.",
    severity: "error",
    recoveryAction: "refresh_retry",
    category: "state",
  },
  STATE_INVALID: {
    code: "STATE_INVALID",
    messageIT: "Stato dell'applicazione non valido.",
    messageEN: "Invalid application state.",
    severity: "critical",
    recoveryAction: "reload_page",
    category: "state",
  },
  STATE_MISMATCH: {
    code: "STATE_MISMATCH",
    messageIT: "Disallineamento dei dati tra le pagine.",
    messageEN: "Data mismatch between pages.",
    severity: "warning",
    recoveryAction: "refresh_retry",
    category: "state",
  },

  // ── Payment Errors ──
  PAYMENT_FAILED: {
    code: "PAYMENT_FAILED",
    messageIT: "Pagamento fallito. Verifica i dati della carta.",
    messageEN: "Payment failed. Check your card details.",
    severity: "error",
    recoveryAction: "retry_payment",
    category: "payment",
  },
  PAYMENT_CANCELLED: {
    code: "PAYMENT_CANCELLED",
    messageIT: "Pagamento annullato.",
    messageEN: "Payment cancelled.",
    severity: "info",
    recoveryAction: "none",
    category: "payment",
  },
  SUBSCRIPTION_EXPIRED: {
    code: "SUBSCRIPTION_EXPIRED",
    messageIT: "Abbonamento scaduto. Rinnova per continuare.",
    messageEN: "Subscription expired. Renew to continue.",
    severity: "error",
    recoveryAction: "renew_subscription",
    category: "payment",
  },

  // ── WebSocket Errors ──
  WS_CONNECTION_LOST: {
    code: "WS_CONNECTION_LOST",
    messageIT: "Connessione in tempo reale persa. Riconnessione in corso...",
    messageEN: "Real-time connection lost. Reconnecting...",
    severity: "warning",
    recoveryAction: "auto_reconnect",
    category: "websocket",
  },
  WS_FAILED_TO_CONNECT: {
    code: "WS_FAILED_TO_CONNECT",
    messageIT: "Impossibile stabilire la connessione in tempo reale.",
    messageEN: "Unable to establish real-time connection.",
    severity: "error",
    recoveryAction: "retry",
    category: "websocket",
  },

  // ── Save/Operation Errors ──
  SAVE_FAILED: {
    code: "SAVE_FAILED",
    messageIT: "Impossibile salvare le modifiche. Riprova.",
    messageEN: "Unable to save changes. Please try again.",
    severity: "error",
    recoveryAction: "retry",
    category: "api",
  },
  DELETE_FAILED: {
    code: "DELETE_FAILED",
    messageIT: "Impossibile eliminare. Riprova.",
    messageEN: "Unable to delete. Please try again.",
    severity: "error",
    recoveryAction: "retry",
    category: "api",
  },
  UPLOAD_FAILED: {
    code: "UPLOAD_FAILED",
    messageIT: "Caricamento fallito. Riprova.",
    messageEN: "Upload failed. Please try again.",
    severity: "error",
    recoveryAction: "retry",
    category: "api",
  },

  // ── Test/Session Errors ──
  TEST_SESSION_EXPIRED: {
    code: "TEST_SESSION_EXPIRED",
    messageIT: "Sessione del test scaduta. Ricomincia il test.",
    messageEN: "Test session expired. Restart the test.",
    severity: "error",
    recoveryAction: "restart_test",
    category: "state",
  },
  TEST_SUBMISSION_FAILED: {
    code: "TEST_SUBMISSION_FAILED",
    messageIT: "Invio del test fallito. I tuoi progressi sono salvati.",
    messageEN: "Test submission failed. Your progress is saved.",
    severity: "error",
    recoveryAction: "retry",
    category: "api",
  },

  // ── Roadmap Errors ──
  ROADMAP_GENERATION_FAILED: {
    code: "ROADMAP_GENERATION_FAILED",
    messageIT: "Generazione roadmap fallita. Riprova.",
    messageEN: "Roadmap generation failed. Please try again.",
    severity: "error",
    recoveryAction: "retry",
    category: "ai",
  },
  ROADMAP_NOT_FOUND: {
    code: "ROADMAP_NOT_FOUND",
    messageIT: "Roadmap non trovata.",
    messageEN: "Roadmap not found.",
    severity: "error",
    recoveryAction: "redirect_home",
    category: "api",
  },

  // ── Graph/Knowledge Errors ──
  GRAPH_LOAD_FAILED: {
    code: "GRAPH_LOAD_FAILED",
    messageIT: "Caricamento del grafo fallito.",
    messageEN: "Graph loading failed.",
    severity: "error",
    recoveryAction: "retry",
    category: "api",
  },
  GRAPH_NODE_NOT_FOUND: {
    code: "GRAPH_NODE_NOT_FOUND",
    messageIT: "Nodo del grafo non trovato.",
    messageEN: "Graph node not found.",
    severity: "error",
    recoveryAction: "refresh_retry",
    category: "api",
  },

  // ── Unknown ──
  UNKNOWN_ERROR: {
    code: "UNKNOWN_ERROR",
    messageIT: "Si è verificato un errore inaspettato.",
    messageEN: "An unexpected error occurred.",
    severity: "critical",
    recoveryAction: "reload_page",
    category: "unknown",
  },
} as const;

export function getErrorDefinition(code: string): ErrorDefinition {
  return ERROR_DEFINITIONS[code] ?? ERROR_DEFINITIONS.UNKNOWN_ERROR ?? {
    code: "UNKNOWN_ERROR",
    messageIT: "Si è verificato un errore inaspettato.",
    messageEN: "An unexpected error occurred.",
    severity: "critical",
    recoveryAction: "reload_page",
    category: "unknown",
  };
}

export function createError(
  code: string,
  details?: { message?: string; context?: Record<string, unknown> }
): AppError {
  const definition = getErrorDefinition(code);
  return {
    code: definition.code,
    messageIT: definition.messageIT,
    messageEN: definition.messageEN,
    severity: definition.severity,
    recoveryAction: definition.recoveryAction,
    category: definition.category,
    details: details?.message ?? null,
    context: details?.context ?? null,
    timestamp: Date.now(),
  };
}

export interface AppError {
  code: string;
  messageIT: string;
  messageEN: string;
  severity: ErrorSeverity;
  recoveryAction: string;
  category: ErrorCategory;
  details: string | null;
  context: Record<string, unknown> | null;
  timestamp: number;
}

export function isErrorCritical(error: AppError): boolean {
  return error.severity === "critical";
}

export function isRecoverable(error: AppError): boolean {
  return error.recoveryAction !== "none";
}

export function getRecoveryLabel(error: AppError, lang: "IT" | "EN" = "IT"): string {
  const labels: Record<string, { IT: string; EN: string }> = {
    retry: { IT: "Riprova", EN: "Retry" },
    retry_later: { IT: "Riprova più tardi", EN: "Try again later" },
    redirect_login: { IT: "Accedi", EN: "Log in" },
    redirect_home: { IT: "Torna alla Home", EN: "Go to Home" },
    redirect_register: { IT: "Registrati", EN: "Register" },
    upgrade_premium: { IT: "Passa a Premium", EN: "Upgrade to Premium" },
    fix_input: { IT: "Correggi i dati", EN: "Fix input" },
    wait_retry: { IT: "Attendi e riprova", EN: "Wait and retry" },
    refresh_retry: { IT: "Aggiorna e riprova", EN: "Refresh and retry" },
    reload_page: { IT: "Ricarica la pagina", EN: "Reload page" },
    clear_storage: { IT: "Libera memoria", EN: "Clear storage" },
    auto_reconnect: { IT: "Riconnessione...", EN: "Reconnecting..." },
    restart_test: { IT: "Ricomincia il test", EN: "Restart test" },
    retry_payment: { IT: "Riprova il pagamento", EN: "Retry payment" },
    renew_subscription: { IT: "Rinnova abbonamento", EN: "Renew subscription" },
    wait_daily_reset: { IT: "Riprova domani", EN: "Try again tomorrow" },
    none: { IT: "", EN: "" },
  };
  return labels[error.recoveryAction]?.[lang] ?? "Riprova";
}
