# ⚠️  REGOLA 0 — Prima di modificare questo file leggi:
#   → API_RULES.md   (variabili d'ambiente, porte, auth)
#   → DB_RULES.md    (DATABASE_URL, migrations)
#
# Dockerfile — apps/server (NorthStar Express API)
#
# Build multi-stage:
#   Stage 1 (builder)  — installa deps + compila TypeScript
#   Stage 2 (runtime)  — solo node_modules prod + dist/
#
# Utilizzo:
#   docker build -f apps/server/Dockerfile -t northstar-server .
#   docker run -p 3001:3001 --env-file .env northstar-server

# ─────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Installa pnpm globalmente
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copia i manifest prima del codice (sfrutta layer cache Docker)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY lib/db/package.json       ./lib/db/

# Installa TUTTE le dipendenze (incluse dev per il build TS)
RUN pnpm install --frozen-lockfile

# Copia il codice sorgente
COPY apps/server/  ./apps/server/
COPY lib/          ./lib/
COPY tsconfig.json ./

# Compila TypeScript
RUN pnpm --filter @northstar/server run build

# ─────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Non girare mai come root in produzione
RUN addgroup -S northstar && adduser -S northstar -G northstar

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copia solo i manifest per installare le dipendenze di produzione
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY lib/db/package.json       ./lib/db/

# Solo prod deps
RUN pnpm install --frozen-lockfile --prod

# Copia il dist compilato dallo stage builder
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Imposta permessi
RUN chown -R northstar:northstar /app
USER northstar

# Health check interno al container
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

EXPOSE 3001

CMD ["node", "apps/server/dist/index.js"]
