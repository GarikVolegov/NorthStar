/**
 * /bussola — RIMOSSA come pagina dedicata.
 *
 * La casa dell'utente indeciso è ora UNA sola: la dashboard, che incorpora già
 * <BussolaHome/> (vedi dashboard.tsx, ramo `isIndeciso`). Niente logiche
 * duplicate: qui restiamo solo come redirect, così i link storici a /bussola
 * (es. percorso indeciso, scorciatoie) atterrano sull'unica esperienza curata.
 * Gli strumenti di dettaglio (/bussola/specchio, /torneo, /spike, /blocco)
 * restano route a sé: sono esperienze full-screen lanciate dalla dashboard.
 */
import { Redirect } from "wouter";

export default function BussolaPage() {
  return <Redirect to="/dashboard" />;
}
