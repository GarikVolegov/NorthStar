-- ─────────────────────────────────────────────────────────────────────────────
-- Verifica privilegi — eseguire dopo db-roles.sql per confermare la configurazione
-- Uso: psql -U postgres -d northstar -f scripts/verify-db-privileges.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Privilegi per tabella (schema public)
SELECT
  t.tablename,
  a.grantee,
  a.privilege_type,
  a.is_grantable
FROM information_schema.role_table_grants a
JOIN pg_tables t ON t.tablename = a.table_name
WHERE a.table_schema = 'public'
  AND a.grantee IN ('northstar_app', 'northstar_migrator')
ORDER BY t.tablename, a.grantee, a.privilege_type;

-- Verifica che northstar_app NON abbia DROP/ALTER/CREATE
-- (il risultato deve essere VUOTO per le righe privilege_type IN ('DROP','ALTER'))
SELECT
  a.grantee,
  a.privilege_type
FROM information_schema.role_table_grants a
WHERE a.table_schema = 'public'
  AND a.grantee = 'northstar_app'
  AND a.privilege_type NOT IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
ORDER BY a.privilege_type;
