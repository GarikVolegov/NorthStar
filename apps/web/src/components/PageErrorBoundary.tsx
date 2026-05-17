/**
 * PageErrorBoundary — Error boundary specifico per pagina.
 * Cattura errori di rendering e fornisce una definizione specifica
 * di cosa è rotto, con azione di recovery contestuale.
 */

import { Component, type ReactNode, type ErrorInfo } from "react";
import { createError, type AppError, getRecoveryLabel } from "@/lib/error-codes";
import { eventBus } from "@/lib/event-bus";

interface Props {
  children: ReactNode;
  pageName: string;
  fallback?: ReactNode;
  onError?: (error: AppError, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: AppError | null;
  errorInfo: ErrorInfo | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    const appError = normalizeRenderError(error);
    return { hasError: true, error: appError, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const appError = normalizeRenderError(error);
    this.setState({ hasError: true, error: appError, errorInfo });
    eventBus.emit("error:caught", {
      ...appError,
      context: {
        ...appError.context,
        page: this.props.pageName,
        componentStack: errorInfo.componentStack,
      },
    });
    this.props.onError?.(appError, errorInfo);
  }

  handleRecovery = () => {
    const { error } = this.state;
    if (!error) return;

    switch (error.recoveryAction) {
      case "reload_page":
        window.location.reload();
        break;
      case "redirect_login":
        window.location.href = "/login";
        break;
      case "redirect_home":
        window.location.href = "/";
        break;
      case "retry":
        this.setState({ hasError: false, error: null, errorInfo: null });
        break;
      default:
        this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <DefaultErrorFallback error={this.state.error} pageName={this.props.pageName} onRecovery={this.handleRecovery} />;
    }
    return this.props.children;
  }
}

function DefaultErrorFallback({
  error,
  pageName,
  onRecovery,
}: {
  error: AppError;
  pageName: string;
  onRecovery: () => void;
}) {
  const lang: "IT" | "EN" = "IT";
  const recoveryLabel = getRecoveryLabel(error, lang);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-red-200/50 bg-red-50/50 p-8 dark:border-red-900/30 dark:bg-red-950/20">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
        <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h3 className="mb-1 text-lg font-semibold text-red-900 dark:text-red-100">
        Errore in {pageName}
      </h3>
      <p className="mb-1 text-sm text-red-700 dark:text-red-300">
        {error.messageIT}
      </p>
      <p className="mb-4 font-mono text-xs text-red-500 dark:text-red-400">
        [{error.code}]
      </p>
      {error.details && (
        <p className="mb-4 max-w-md text-center text-xs text-red-600 dark:text-red-400">
          {error.details}
        </p>
      )}
      {recoveryLabel && (
        <button
          onClick={onRecovery}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
        >
          {recoveryLabel}
        </button>
      )}
      {typeof error.context?.componentStack === "string" && error.context.componentStack && (
        <details className="mt-4 w-full max-w-lg">
          <summary className="cursor-pointer text-xs text-red-500 dark:text-red-400">
            Dettagli tecnici
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-red-100 p-3 text-xs text-red-800 dark:bg-red-950 dark:text-red-300">
            {error.context.componentStack}
          </pre>
        </details>
      )}
    </div>
  );
}

function normalizeRenderError(error: Error): AppError {
  const message = error.message.toLowerCase();

  if (message.includes("network") || message.includes("fetch")) {
    return createError("RENDER_PAGE_FAILED", { message: error.message });
  }

  if (message.includes("not found") || message.includes("404")) {
    return createError("API_NOT_FOUND", { message: error.message });
  }

  if (message.includes("unauthorized") || message.includes("401")) {
    return createError("AUTH_UNAUTHORIZED", { message: error.message });
  }

  return createError("RENDER_COMPONENT_FAILED", { message: error.message });
}
