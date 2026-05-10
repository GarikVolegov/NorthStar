/**
 * WendyPageContext — React context that any page in the app can populate
 * to give Wendy awareness of what the user is currently looking at.
 *
 * ─────────────────────────────────────────────────────────────────────
 * SETUP (app root or layout):
 *
 *   <WendyPageContextProvider>
 *     <App />
 *   </WendyPageContextProvider>
 *
 * ─────────────────────────────────────────────────────────────────────
 * USAGE (in any page component):
 *
 *   const { setPageContext, clearPageContext } = useWendyPageContext();
 *
 *   // When the page loads / data changes:
 *   useEffect(() => {
 *     setPageContext({
 *       pageId: 'riasec-results',
 *       pageLabel: 'Risultati RIASEC',
 *       data: { topTypes: ['I','A','E'], scores: { I:85, A:72 } },
 *     });
 *     return () => clearPageContext();
 *   }, [riasecResult]);
 *
 * ─────────────────────────────────────────────────────────────────────
 * The context value is automatically forwarded to Wendy via
 * WendyContextButton (see WendyContextButton.tsx).
 */
import React, {
  createContext, useContext, useState, useCallback,
  type ReactNode,
} from "react";

export interface WendyPageContextValue {
  /** Stable page identifier (e.g. 'riasec-results', 'cv-builder') */
  pageId: string;
  /** Human-readable label shown on the button tooltip */
  pageLabel: string;
  /** Arbitrary page-specific data passed to the AI prompt */
  data: Record<string, unknown>;
}

interface WendyPageContextState {
  context: WendyPageContextValue | null;
  setPageContext: (ctx: WendyPageContextValue) => void;
  clearPageContext: () => void;
}

const WendyPageCtx = createContext<WendyPageContextState>({
  context: null,
  setPageContext: () => {},
  clearPageContext: () => {},
});

export function WendyPageContextProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<WendyPageContextValue | null>(null);

  const setPageContext  = useCallback((ctx: WendyPageContextValue) => setContext(ctx), []);
  const clearPageContext = useCallback(() => setContext(null), []);

  return (
    <WendyPageCtx.Provider value={{ context, setPageContext, clearPageContext }}>
      {children}
    </WendyPageCtx.Provider>
  );
}

/** Hook — use inside any component that wants to read or write the page context. */
export function useWendyPageContext() {
  return useContext(WendyPageCtx);
}
