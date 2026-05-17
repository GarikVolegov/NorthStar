/**
 * register.tsx — Redirect a /sign-up (Clerk).
 *
 * La registrazione è ora gestita interamente da Clerk.
 * Manteniamo questa route per compatibilità con link esistenti.
 */
import { Redirect } from "wouter";

export default function Register() {
  return <Redirect to="/sign-up" />;
}
