#!/bin/bash
set -e

echo "▶ [post-merge] Installazione dipendenze Node.js..."
pnpm install --frozen-lockfile

echo "▶ [post-merge] Installazione dipendenze Python (AI service)..."
pip install -q -r artifacts/ai-agents/requirements.txt

echo "▶ [post-merge] Applicazione schema database..."
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo ""
  echo "✗  [post-merge] DATABASE_URL non impostato — schema DB saltato."
  echo ""
  echo "   Per creare il database:"
  echo "     1. Vai su Tools → Database in Replit"
  echo "     2. Clicca 'Create a database'"
  echo "     3. DATABASE_URL verrà impostato automaticamente nei Secrets"
  echo "     4. Riavvia il server o riesegui: bash scripts/post-merge.sh"
  echo ""
else
  pnpm --filter @workspace/db push
fi

echo "✓ [post-merge] Completato."

# ── Suggerimento: variabili generate automaticamente ──────────────────────────
MISSING_SECRETS=()
[[ -z "${JWT_SECRET:-}" ]]       && MISSING_SECRETS+=("JWT_SECRET")
[[ -z "${ADMIN_KEY:-}" ]]        && MISSING_SECRETS+=("ADMIN_KEY")
[[ -z "${VAPID_PUBLIC_KEY:-}" ]] && MISSING_SECRETS+=("VAPID_PUBLIC_KEY")
[[ -z "${VAPID_PRIVATE_KEY:-}" ]] && MISSING_SECRETS+=("VAPID_PRIVATE_KEY")

if [[ ${#MISSING_SECRETS[@]} -gt 0 ]]; then
  echo ""
  echo "⚠  [post-merge] Alcune variabili generate automaticamente non sono impostate:"
  for k in "${MISSING_SECRETS[@]}"; do
    echo "     • $k"
  done
  echo ""
  echo "   Esegui: pnpm run secrets"
  echo "   poi copia i valori nei Replit Secrets (Tools → Secrets)."
  echo ""
fi
