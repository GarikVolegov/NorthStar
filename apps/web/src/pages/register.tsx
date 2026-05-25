/**
 * register.tsx — Redirect a /sign-up (Clerk).
 *
 * La registrazione è ora gestita interamente da Clerk.
 * Manteniamo questa route per compatibilità con link esistenti.
 */
import { Redirect } from "wouter";

export default function Register() {
  const query = typeof window !== "undefined" ? window.location.search : "";
  return <Redirect to={`/sign-up${query}`} />;
}
