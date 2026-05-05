#!/usr/bin/env bash
# =============================================================================
# NorthStar — Generatore di secret per il deploy
#
# Genera JWT_SECRET, ADMIN_KEY e le chiavi VAPID, poi stampa un blocco
# pronto da copiare in Replit Secrets o nel tuo file .env.
#
# Utilizzo:
#   pnpm run secrets              # stampa i valori pronti da copiare
#   pnpm run secrets:env          # salva anche in .env (non committare!)
# Oppure direttamente:
#   bash scripts/generate-secrets.sh
#   bash scripts/generate-secrets.sh --env
# =============================================================================

set -euo pipefail

SAVE_ENV=false
if [[ "${1:-}" == "--env" ]]; then
  SAVE_ENV=true
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NorthStar — Generazione secret"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── JWT_SECRET ────────────────────────────────────────────────────
echo "  Generazione JWT_SECRET..."
JWT_SECRET=$(openssl rand -hex 48)

# ── ADMIN_KEY ─────────────────────────────────────────────────────
echo "  Generazione ADMIN_KEY..."
ADMIN_KEY=$(openssl rand -hex 32)

# ── VAPID keys ────────────────────────────────────────────────────
echo "  Generazione chiavi VAPID (Web Push)..."

# Assicura che web-push sia disponibile
if ! command -v npx &>/dev/null; then
  echo "  ✗ npx non trovato — installa Node.js e riprova." >&2
  exit 1
fi

VAPID_OUTPUT=$(npx --yes web-push generate-vapid-keys --json 2>/dev/null)
VAPID_PUBLIC=$(echo "$VAPID_OUTPUT" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).publicKey)")
VAPID_PRIVATE=$(echo "$VAPID_OUTPUT" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).privateKey)")

# ── Output ────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Copia questi valori nei Replit Secrets (o nel tuo .env):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "JWT_SECRET=$JWT_SECRET"
echo "ADMIN_KEY=$ADMIN_KEY"
echo "VAPID_PUBLIC_KEY=$VAPID_PUBLIC"
echo "VAPID_PRIVATE_KEY=$VAPID_PRIVATE"
echo "VAPID_EMAIL=support@example.com   # <-- sostituisci con il tuo indirizzo"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Variabili da configurare manualmente (vedi .env.example):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  DATABASE_URL            — Replit PostgreSQL (Tools → Database)"
echo "  STRIPE_SECRET_KEY       — https://dashboard.stripe.com/apikeys"
echo "  STRIPE_WEBHOOK_SECRET   — https://dashboard.stripe.com/webhooks"
echo "  STRIPE_PUBLISHABLE_KEY  — https://dashboard.stripe.com/apikeys"
echo "  GNEWS_API_KEY           — https://gnews.io"
echo "  TAVILY_API_KEY          — https://tavily.com"
echo "  RESEND_API_KEY          — https://resend.com"
echo "  GOOGLE_CLIENT_ID        — https://console.cloud.google.com"
echo "  AI_INTEGRATIONS_OPENAI_* — Replit: Tools → Integrations → OpenAI"
echo ""

# ── Salva in .env (opzionale) ─────────────────────────────────────
if [[ "$SAVE_ENV" == true ]]; then
  ENV_FILE=".env"
  echo "  Scrittura in $ENV_FILE..."

  # Aggiorna o aggiunge le variabili nel file .env
  update_env() {
    local key="$1"
    local val="$2"
    if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
      # Sostituisce la riga esistente (sed compatibile macOS e Linux)
      sed -i.bak "s|^${key}=.*|${key}=${val}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
    else
      echo "${key}=${val}" >> "$ENV_FILE"
    fi
  }

  update_env "JWT_SECRET"       "$JWT_SECRET"
  update_env "ADMIN_KEY"        "$ADMIN_KEY"
  update_env "VAPID_PUBLIC_KEY" "$VAPID_PUBLIC"
  update_env "VAPID_PRIVATE_KEY" "$VAPID_PRIVATE"

  echo "  ✓ Valori scritti in $ENV_FILE"
  echo ""
  echo "  ⚠  Non committare mai il file .env — aggiungilo al .gitignore."
  echo ""
fi
