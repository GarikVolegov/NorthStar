# 🌟 NorthStar

> Piattaforma SaaS di orientamento professionale con AI agent, test RIASEC, CV builder e sistema di affiliazione.

**La documentazione completa è in [`replit.md`](./replit.md)** — è la fonte di verità sull’architettura, le regole e il setup.

---

## ⚠️ Regola 0 — quale RULES leggere PRIMA di toccare codice

Prima di modificare qualsiasi area del progetto, apri **sempre** il file di regole specifico.

| Area di lavoro | File da leggere |
|---|---|
| Backend API / Express / router / middleware / auth | [`API_RULES.md`](./API_RULES.md) |
| Database / Drizzle ORM / migrations / seed | [`DB_RULES.md`](./DB_RULES.md) |
| Frontend React / UI / Tailwind / Vite | [`FRONTEND_RULES.md`](./FRONTEND_RULES.md) |
| AI agent / OpenAI / Wendy / prompt | [`AI_RULES.md`](./AI_RULES.md) |
| Git / branching / commit / PR | [`GIT_RULES.md`](./GIT_RULES.md) |

---

## 🚀 Setup in 3 comandi

```bash
cp .env.example .env   # compila i valori
pnpm install
pnpm dev               # server :3001 + web :5173
```

Vedi [`replit.md`](./replit.md) per Docker Compose, migrazioni DB, variabili d’ambiente e tutto il resto.
