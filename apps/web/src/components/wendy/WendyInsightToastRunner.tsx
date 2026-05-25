import { useWendyInsightToast } from "@/hooks/useWendyInsightToast";

/**
 * Componente "headless" che attiva i toast in-app per gli insight proattivi.
 * Renderizzato dentro WendyProvider (e dunque AuthProvider + QueryClientProvider).
 */
export function WendyInsightToastRunner(): null {
  useWendyInsightToast();
  return null;
}
