import type { ComponentType } from "react";
import { PATHS } from "./route-paths";

export type RouteGuard = "protected" | "publicOnly" | "public";
export type RouteLayout = "default" | "admin" | "plain";

export interface RouteConfig {
  path: string;
  component: () => Promise<{ default: ComponentType<Record<string, never>> }>;
  guard?: RouteGuard;
  layout?: RouteLayout;
  title?: string;
}

export const routes: RouteConfig[] = [
  { path: PATHS.HOME, component: () => import("@/pages/home"), guard: "public", layout: "default", title: "Home" },
  { path: "/test", component: () => import("@/pages/test"), guard: "public", layout: "default", title: "Test" },
  { path: "/risultati/:id", component: () => import("@/pages/results"), guard: "public", layout: "default", title: "Risultati" },
  { path: "/settore/:id", component: () => import("@/pages/sector"), guard: "public", layout: "default", title: "Settore" },
  { path: "/ruolo/:id", component: () => import("@/pages/ruolo"), guard: "public", layout: "default", title: "Ruolo" },
  { path: "/registra", component: () => import("@/pages/register"), guard: "publicOnly", layout: "default", title: "Registrazione" },
  { path: "/register", component: () => import("@/pages/register"), guard: "publicOnly", layout: "default", title: "Register" },
  { path: "/reset-password", component: () => import("@/pages/reset-password"), guard: "publicOnly", layout: "default", title: "Reset password" },
  { path: "/premium", component: () => import("@/pages/premium"), guard: "public", layout: "default", title: "Premium" },
  { path: "/premium/successo", component: () => import("@/pages/premium-success"), guard: "protected", layout: "default", title: "Premium" },
  { path: "/news/:id", component: () => import("@/pages/news-detail"), guard: "public", layout: "default", title: "News" },
  { path: "/news", component: () => import("@/pages/news"), guard: "public", layout: "default", title: "News" },
  { path: PATHS.PROFILE, component: () => import("@/pages/profilo"), guard: "protected", layout: "default", title: "Profilo" },
  { path: "/candidature", component: () => import("@/pages/applications"), guard: "protected", layout: "default", title: "Candidature" },
  { path: "/calendario", component: () => import("@/pages/calendar"), guard: "protected", layout: "default", title: "Calendario" },
  { path: "/bussola", component: () => import("@/pages/bussola"), guard: "protected", layout: "default", title: "La Bussola" },
  { path: "/bussola/specchio", component: () => import("@/pages/bussola-specchio"), guard: "protected", layout: "default", title: "Lo Specchio" },
  { path: "/bussola/blocco", component: () => import("@/pages/bussola-blocco"), guard: "protected", layout: "default", title: "Cosa ti blocca" },
  { path: PATHS.FRIENDS, component: () => import("@/pages/amici"), guard: "protected", layout: "default", title: "Amici" },
  { path: "/social", component: () => import("@/pages/social"), guard: "protected", layout: "default", title: "Social" },
  { path: "/utente/:id", component: () => import("@/pages/utente"), guard: "public", layout: "default", title: "Utente" },
  { path: "/wiki/:id", component: () => import("@/pages/wiki"), guard: "protected", layout: "default", title: "Wiki" },
  { path: "/roadmap/:id", component: () => import("@/pages/roadmap"), guard: "protected", layout: "default", title: "Roadmap" },
  { path: PATHS.ARCHIVE, component: () => import("@/pages/grafo-conoscenza"), guard: "protected", layout: "default", title: "Archivio" },
  { path: "/archivio/:id", component: () => import("@/pages/grafo"), guard: "protected", layout: "default", title: "Archivio" },
  { path: "/settori", component: () => import("@/pages/settori"), guard: "public", layout: "default", title: "Settori" },
  { path: "/ruoli", component: () => import("@/pages/ruoli"), guard: "public", layout: "default", title: "Ruoli" },
  { path: "/confronta", component: () => import("@/pages/confronta"), guard: "public", layout: "default", title: "Confronta" },
  { path: "/contatti", component: () => import("@/pages/contatti"), guard: "public", layout: "default", title: "Contatti" },
  { path: "/sitemap", component: () => import("@/pages/sitemap"), guard: "public", layout: "default", title: "Sitemap" },
  { path: "/chi-siamo", component: () => import("@/pages/chi-siamo"), guard: "public", layout: "default", title: "Chi siamo" },
  { path: "/come-funziona", component: () => import("@/pages/come-funziona"), guard: "public", layout: "default", title: "Come funziona" },
  { path: "/privacy-policy", component: () => import("@/pages/privacy-policy"), guard: "public", layout: "default", title: "Privacy" },
  { path: "/termini-di-servizio", component: () => import("@/pages/termini-di-servizio"), guard: "public", layout: "default", title: "Termini" },
  { path: "/crescita", component: () => import("@/pages/growth"), guard: "public", layout: "default", title: "Crescita" },
  { path: "/crescita/categoria/:cat", component: () => import("@/pages/crescita-categoria"), guard: "public", layout: "default", title: "Crescita" },
  { path: "/crescita/articolo/:slug", component: () => import("@/pages/crescita-articolo"), guard: "public", layout: "default", title: "Articolo" },
  { path: "/dashboard", component: () => import("@/pages/dashboard"), guard: "protected", layout: "default", title: "Dashboard" },
  { path: "/diario", component: () => import("@/pages/diario"), guard: "protected", layout: "default", title: "Diario" },
  { path: "/obiettivi", component: () => import("@/pages/obiettivi"), guard: "protected", layout: "default", title: "Obiettivi" },
  { path: "/routines", component: () => import("@/pages/routines"), guard: "protected", layout: "default", title: "Routine" },
  { path: "/mood", component: () => import("@/pages/mood"), guard: "protected", layout: "default", title: "Mood" },
  { path: PATHS.AFFILIATION, component: () => import("@/pages/affiliazione"), guard: "public", layout: "default", title: "Affiliazione" },
  { path: "/affiliazione/scuole", component: () => import("@/pages/affiliazione-scuole"), guard: "public", layout: "default", title: "Affiliazione scuole" },
  { path: "/affiliazione/universita", component: () => import("@/pages/affiliazione-universita"), guard: "public", layout: "default", title: "Affiliazione universita" },
  { path: "/affiliazione/agenzie-lavoro", component: () => import("@/pages/affiliazione-agenzie"), guard: "public", layout: "default", title: "Affiliazione agenzie" },
  { path: "/affiliazione/centri-formazione", component: () => import("@/pages/affiliazione-formazione"), guard: "public", layout: "default", title: "Affiliazione formazione" },
  { path: "/affiliazione/dashboard", component: () => import("@/pages/affiliazione-dashboard"), guard: "protected", layout: "default", title: "Dashboard affiliazione" },
  { path: "/affiliate", component: () => import("@/pages/affiliazione-dashboard"), guard: "protected", layout: "default", title: "Affiliate" },
  { path: "/colloquio/:id", component: () => import("@/pages/colloquio"), guard: "protected", layout: "default", title: "Colloquio" },
  { path: "/skills-gap/:id", component: () => import("@/pages/skills-gap"), guard: "protected", layout: "default", title: "Skills gap" },
  { path: "/coach", component: () => import("@/pages/coach"), guard: "public", layout: "default", title: "Coach" },
  { path: "/validatore-idea", component: () => import("@/pages/validatore-idea"), guard: "protected", layout: "default", title: "Validatore idea" },
  { path: "/percorso", component: () => import("@/pages/percorso"), guard: "protected", layout: "default", title: "Percorso" },
  { path: "/score/:userId", component: () => import("@/pages/score-card"), guard: "public", layout: "default", title: "Score" },
  { path: "/lavori", component: () => import("@/pages/lavori"), guard: "public", layout: "default", title: "Lavori" },
  { path: "/admin-home", component: () => import("@/pages/admin-home"), guard: "protected", layout: "admin", title: "Admin home" },
  { path: "/admin-metriche", component: () => import("@/pages/admin-metriche"), guard: "protected", layout: "admin", title: "Metriche admin" },
  { path: "/admin-status", component: () => import("@/pages/admin-status"), guard: "protected", layout: "admin", title: "Status admin" },
  { path: "/admin-agenti", component: () => import("@/pages/admin-agenti"), guard: "protected", layout: "admin", title: "Agenti admin" },
  { path: "/admin-qualita", component: () => import("@/pages/admin-qualita"), guard: "protected", layout: "admin", title: "Qualita admin" },
  { path: "/admin-cataloghi", component: () => import("@/pages/admin-cataloghi"), guard: "protected", layout: "admin", title: "Cataloghi admin" },
  { path: "/admin-crescita", component: () => import("@/pages/admin-crescita"), guard: "protected", layout: "admin", title: "Crescita admin" },
  { path: "/admin-rag", component: () => import("@/pages/admin-rag"), guard: "protected", layout: "admin", title: "RAG admin" },
  { path: "/admin-messaggi", component: () => import("@/pages/admin-messaggi"), guard: "protected", layout: "admin", title: "Messaggi admin" },
  { path: "/admin-affiliazione", component: () => import("@/pages/admin-affiliazione"), guard: "protected", layout: "admin", title: "Affiliazione admin" },
];
