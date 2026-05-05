#!/bin/bash
set -e

echo "▶ [post-merge] Installazione dipendenze Node.js..."
pnpm install --frozen-lockfile

echo "▶ [post-merge] Installazione dipendenze Python (AI service)..."
pip install -q -r artifacts/ai-agents/requirements.txt

echo "▶ [post-merge] Applicazione schema database..."
pnpm --filter @workspace/db push

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
