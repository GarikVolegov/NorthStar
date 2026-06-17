/**
 * clerk-config.ts — risoluzione della publishable key Clerk + flag "configurato".
 *
 * Clerk è il gatekeeper dell'auth frontend. Se la publishable key non è
 * impostata (es. ambiente e2e/CI senza chiavi, o deploy mal configurato), il
 * provider non si carica mai e `useUser().isLoaded` resta false per sempre:
 * senza questo flag le ProtectedRoute resterebbero bloccate su uno spinner
 * infinito invece di mandare l'utente al /sign-in.
 */
const env = import.meta.env as unknown as Record<string, unknown>;

export const clerkPublishableKey =
  typeof env.VITE_CLERK_PUBLISHABLE_KEY === "string"
    ? env.VITE_CLERK_PUBLISHABLE_KEY
    : "";

/** Clerk è utilizzabile solo con una publishable key valida (`pk_...`). */
export function isClerkConfigured(): boolean {
  return clerkPublishableKey.startsWith("pk_");
}
