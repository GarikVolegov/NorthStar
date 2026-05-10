-- ─────────────────────────────────────────────────────────────────────────────
-- NorthStar — Principio del minimo privilegio (Least Privilege)
--
-- Due ruoli separati:
--   northstar_app       → solo DML (SELECT, INSERT, UPDATE, DELETE)
--   northstar_migrator  → DDL completo (CREATE, ALTER, DROP) + DML
--
-- Esecuzione: una tantum da un superuser Postgres (es. in CI o setup iniziale)
-- NOTA: sostituire le password con valori sicuri da Secret Manager in produzione
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Ruolo applicazione (runtime) ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'northstar_app') THEN
    CREATE ROLE northstar_app LOGIN PASSWORD 'CHANGE_ME_APP_PASSWORD';
  END IF;
END$$;

-- ─── Ruolo migrazione (CI / deploy) ──────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'northstar_migrator') THEN
    CREATE ROLE northstar_migrator LOGIN PASSWORD 'CHANGE_ME_MIGRATOR_PASSWORD';
  END IF;
END$$;

-- ─── Schema target ───────────────────────────────────────────────────────────
-- Assicura che entrambi i ruoli possano accedere allo schema public
GRANT USAGE ON SCHEMA public TO northstar_app, northstar_migrator;

-- ─── Permessi northstar_migrator — DDL + DML completo ────────────────────────
GRANT ALL PRIVILEGES ON SCHEMA public TO northstar_migrator;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO northstar_migrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO northstar_migrator;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO northstar_migrator;

-- Default per tabelle create in futuro (es. nuove migrazioni)
ALTER DEFAULT PRIVILEGES FOR ROLE northstar_migrator IN SCHEMA public
  GRANT ALL ON TABLES TO northstar_migrator;
ALTER DEFAULT PRIVILEGES FOR ROLE northstar_migrator IN SCHEMA public
  GRANT ALL ON SEQUENCES TO northstar_migrator;

-- ─── Permessi northstar_app — solo DML, nessun DDL ───────────────────────────
-- SELECT, INSERT, UPDATE, DELETE su tutte le tabelle esistenti
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO northstar_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO northstar_app;

-- Default per tabelle create in futuro dalle migrazioni
ALTER DEFAULT PRIVILEGES FOR ROLE northstar_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO northstar_app;
ALTER DEFAULT PRIVILEGES FOR ROLE northstar_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO northstar_app;

-- ─── Revoca esplicita dei diritti DDL dall'app ────────────────────────────────
-- Anche se Postgres non concede DDL per default, lo esplicitiamo per chiarezza
REVOKE CREATE ON SCHEMA public FROM northstar_app;

-- ─── Verifica (output) ────────────────────────────────────────────────────────
SELECT
  r.rolname,
  r.rolcanlogin,
  r.rolcreatedb,
  r.rolsuper,
  r.rolcreaterole
FROM pg_roles r
WHERE r.rolname IN ('northstar_app', 'northstar_migrator')
ORDER BY r.rolname;
