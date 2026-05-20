/**
 * useExecutionError — Hook per tracciare errori post-esecuzione.
 * Dopo ogni esecuzione di un programma/azione, registra e espone
 * lo stato dell'errore con definizione specifica di cosa è rotto.
 */

import { createError, type AppError } from "@/lib/error-codes";
import { eventBus } from "@/lib/event-bus";
import { useCallback, useRef, useState } from "react";

export interface ExecutionState {
  isExecuting: boolean;
  lastError: AppError | null;
  errorCount: number;
  lastSuccess: number | null;
  lastExecution: number | null;
}

export interface UseExecutionErrorReturn<TArgs extends unknown[], TReturn> {
  state: ExecutionState;
  execute: (...args: TArgs) => Promise<TReturn>;
  clearError: () => void;
  hasError: boolean;
  isCritical: boolean;
  recoveryAction: string | null;
}

const MAX_ERROR_HISTORY = 50;
let errorHistory: AppError[] = [];

export function useExecutionError<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options?: {
    onError?: (error: AppError) => void;
    onSuccess?: (result: TReturn) => void;
    label?: string;
  }
): UseExecutionErrorReturn<TArgs, TReturn> {
  const [state, setState] = useState<ExecutionState>({
    isExecuting: false,
    lastError: null,
    errorCount: 0,
    lastSuccess: null,
    lastExecution: null,
  });

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const execute = useCallback(
    async (...args: TArgs): Promise<TReturn> => {
      setState((prev) => ({
        ...prev,
        isExecuting: true,
        lastExecution: Date.now(),
      }));

      try {
        const result = await fnRef.current(...args);
        setState((prev) => ({
          ...prev,
          isExecuting: false,
          lastError: null,
          lastSuccess: Date.now(),
        }));
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = normalizeError(err);

        errorHistory.push(error);
        if (errorHistory.length > MAX_ERROR_HISTORY) {
          errorHistory = errorHistory.slice(-MAX_ERROR_HISTORY);
        }

        eventBus.emit("error:caught", error);

        setState((prev) => ({
          ...prev,
          isExecuting: false,
          lastError: error,
          errorCount: prev.errorCount + 1,
        }));

        options?.onError?.(error);
        throw error;
      }
    },
    [options?.onError, options?.onSuccess]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, lastError: null }));
  }, []);

  return {
    state,
    execute,
    clearError,
    hasError: state.lastError !== null,
    isCritical: state.lastError?.severity === "critical",
    recoveryAction: state.lastError?.recoveryAction ?? null,
  };
}

export function getErrorHistory(): AppError[] {
  return [...errorHistory];
}

export function clearErrorHistory(): void {
  errorHistory = [];
}

export function getRecentErrors(count = 5): AppError[] {
  return errorHistory.slice(-count);
}

function normalizeError(err: unknown): AppError {
  if (isAppError(err)) return err;

  if (err instanceof Response) {
    return mapHttpError(err);
  }

  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    if (message.includes("network") || message.includes("fetch")) {
      return createError("NETWORK_ERROR", { message: err.message });
    }
    if (message.includes("timeout")) {
      return createError("NETWORK_TIMEOUT", { message: err.message });
    }
    return createError("UNKNOWN_ERROR", { message: err.message });
  }

  if (typeof err === "string") {
    return createError("UNKNOWN_ERROR", { message: err });
  }

  return createError("UNKNOWN_ERROR", {
    message: "Errore sconosciuto",
    context: { raw: err },
  });
}

function isAppError(err: unknown): err is AppError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    "severity" in err &&
    "timestamp" in err
  );
}

function mapHttpError(response: Response): AppError {
  const status = response.status;
  if (status === 401) return createError("AUTH_TOKEN_EXPIRED");
  if (status === 403) return createError("AUTH_FORBIDDEN");
  if (status === 404) return createError("API_NOT_FOUND");
  if (status === 409) return createError("API_CONFLICT");
  if (status === 429) return createError("API_RATE_LIMITED");
  if (status >= 500) return createError("API_SERVER_ERROR");
  return createError("API_BAD_REQUEST");
}

export function createExecutionError(
  code: string,
  details?: { message?: string; context?: Record<string, unknown> }
): AppError {
  return createError(code, details);
}

export function getErrorSummary(): {
  total: number;
  critical: number;
  byCategory: Record<string, number>;
  lastHour: number;
} {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  return {
    total: errorHistory.length,
    critical: errorHistory.filter((e) => e.severity === "critical").length,
    byCategory: errorHistory.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    lastHour: errorHistory.filter((e) => now - e.timestamp < oneHour).length,
  };
}
