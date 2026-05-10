/**
 * ErrorBoundary.tsx — apps/web
 *
 * Catch JavaScript errors nei sottoalberi React,
 * mostra un fallback UI ed evita che l'intera app crashi.
 *
 * Nota: in produzione sostituire con un componente più sofisticato
 * o con react-error-boundary.
 */

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // Log dell'errore (sostituire con Sentry / log remoto in produzione)
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center h-full text-center px-4"
        >
          <h2 className="text-lg font-semibold text-[#e57373] mb-2">
            Qualcosa è andato storto
          </h2>
          <p className="text-sm text-[#7db89a]/60 mb-4">
            Si è verificato un errore imprevisto. Ricarica la pagina per riprovare.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium rounded-lg
                       bg-[#c19e4a] text-[#0b0d14]
                       hover:bg-[#d4aa52] transition-colors"
          >
            Ricarica
          </button>
          {this.state.error && (
            <details className="mt-4 text-xs text-[#7db89a]/40 max-w-md">
              <summary className="cursor-pointer">Dettagli errore</summary>
              <pre className="mt-2 text-left overflow-x-auto">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}