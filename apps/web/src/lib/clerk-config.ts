/**
 * clerk-config.ts — risoluzione della publishable key Clerk + flag "configurato".
 *
 * Clerk è il gatekeeper dell'auth frontend. Se la publishable key non è
 * impostata (es. ambiente e2e/CI senza chiavi, o deploy mal configurato), il
 * provider non si carica mai e `useUser().isLoaded` resta false per sempre:
 * senza questo flag le ProtectedRoute resterebbero bloccate su uno spinner
 * infinito invece di mandare l'utente al /sign-in.
 */
// Injected at build time by vite.config.ts `define` (sourced from the repo-root
// VITE_CLERK_PUBLISHABLE_KEY or the legacy NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).
// Read the literal `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY` expression so the
// define replacement applies — same pattern as VITE_SENTRY_RELEASE in sentry.ts.
const rawKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

export const clerkPublishableKey = typeof rawKey === "string" ? rawKey : "";

/** Clerk è utilizzabile solo con una publishable key valida (`pk_...`). */
export function isClerkConfigured(): boolean {
  return clerkPublishableKey.startsWith("pk_");
}
