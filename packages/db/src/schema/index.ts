/**
 * ⚠️  REGOLA 0 — Prima di modificare questo file o qualsiasi schema leggi:
 *   → DB_RULES.md  (Database Change Policy: naming, migration, seed, FK, rollback)
 *
 * Qualsiasi aggiunta di tabella, colonna, indice o relazione
 * richiede la Pre-Flight Checklist presente in DB_RULES.md.
 * Non esistono modifiche "piccole" che non richiedano quel controllo.
 *
 * ⚠️  DUAL SERVER NOTA: api-server (8080) e northstar-server (3001) condividono
 * lo stesso DB. Le migrazioni Drizzle devono essere eseguite da UN SOLO
 * processo alla volta. Usa pg_advisory_lock() nel migration runner.
 * Vedi packages/db/README.md per il codice di esempio.
 */

export * from "./users";
export * from "./userProfiles";
export * from "./testSessions";
export * from "./sectors";
export * from "./professions";
export * from "./educationPaths";
export * from "./professionEducationPaths";
export * from "./userObjectives";
export * from "./userFavorites";
export * from "./knowledge";
export * from "./newsArticles";
export * from "./growthArticles";
export * from "./agentReview";
export * from "./agentPrompts";
export * from "./adminCatalogDrafts";
// agentLogs.ts removed — table merged into agentReview.ts as agentRunsTable.
// Run the following SQL to backfill and drop the old table if it still exists:
//   INSERT INTO agent_runs SELECT * FROM agent_logs;
//   DROP TABLE agent_logs;
// ── Affiliate system ──────────────────────────────────────────────────
export * from "./affiliateAccounts";
export * from "./affiliateCommissions";
export * from "./affiliateReferrals";   // ← Fase 1: referral confermati
export * from "./affiliateWithdrawals";
export * from "./affiliationLeads";
// ── Audit (append-only) ───────────────────────────────────────────────
export * from "./auditLog";             // ← Fase 1: log immutabile
// ── Other ─────────────────────────────────────────────────────────────
export * from "./businessIdeas";
export * from "./calendar";
export * from "./appNotifications";
export * from "./certifications";
export * from "./coachMemory";
export * from "./coachSessions";
export * from "./contactMessages";
export * from "./conversations";
export * from "./discoveryItems";
export * from "./discoverySourcesTable";
export * from "./friendships";
export * from "./linkedinImports";
export * from "./messages";
export * from "./nftCertificates";
export * from "./objectiveComments";
export * from "./pageContextSnapshots";
export * from "./responseFeedback";
export * from "./sessionSummaries";
export * from "./voiceSessions";
export * from "./routingLogs";
export * from "./qualityMetrics";
export * from "./chatMessages";
export * from "./social";
export * from "./communities";
export * from "./diary";
// ── AI Cost tracking & request logging ──────────────────────────────
export * from "./llmUsage";
export * from "./aiRequestLog";
export * from "./aiCostLog";
export * from "./wendyFeedback";
export * from "./wendyConfigOverrides";
export * from "./wendyBrain";
export * from "./userKeys";
export * from "./userBadges";
export * from "./weeklyLeaderboard";
// ── Search ──────────────────────────────────────────────────────
export * from "./search";
export * from "./appSearchIndex";
// ── News Subscriptions ─────────────────────────────────────────
export * from "./newsSubscriptions";
// ── Agenti AI dipendenti ──────────────────────────────────────────────────
export * from "./agentEmployees";
export * from "./pipelineRuns";
export * from "./monthlyRitual";
// ── Step 7: SaaS maturo — subscription, workspace, collab, briefing ─────
export * from "./subscription";
export * from "./workspace";
export * from "./workspaceMember";
export * from "./sharedPlan";
export * from "./planComment";
export * from "./mentorRelationship";
export * from "./wendyBriefing";
// ── Phase 4: Feedback Loop / Optimizer ───────────────────────────
export * from "./wendyOptimizerProposals";
// ── Step 6: RAG, Weak Signals, Job Market Intelligence ─────────
export * from "./ragSource";
export * from "./ragChunk";
export * from "./ragRoutingKey";
export * from "./weakSignal";
export * from "./jobPostingSnapshot";
export * from "./skillCooccurrence";
export * from "./proactiveInsight";
// ── 360° User Profiling System ──────────────────────────────────
export * from "./userPsychologicalProfile";  // Big Five, cronotype, stile decisionale
export * from "./userMotivationalProfile";   // SDT, McClelland, Schwartz values
export * from "./userBehavioralSignals";     // Segnali passivi aggregati settimanali
export * from "./userProfilingConsents";     // Consenso GDPR granulare per dimensione
// ── AaaS: Ritual Engine + Dashboard (Fase 1) ────────────────────
export * from "./userRoutines";              // Routine autonome per utente (job monitor, market report, …)
export * from "./routineExecutions";         // Storico risultati esecuzioni (feed in-app)
export * from "./userDashboardLayout";       // Layout widget dashboard personalizzabile
export * from "./userNavigationPreferences"; // Preferenze barra alta personalizzabile
// ── Discovery Engine (Ondata 1 — percorso "indeciso") ────────────
export * from "./userDiscoverySignals";      // Segnali real-time di scoperta per utente
export * from "./commitmentReadiness";       // Score 0-100 di prontezza alla scelta
export * from "./moodCheckins";              // Check-in emozionale "Mood-to-Action"
