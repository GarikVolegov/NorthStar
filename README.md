# NorthStar

> La documentazione completa del progetto è in [`replit.md`](./replit.md).

---

## ⚠️ Regola 0 — quale RULES leggere PRIMA di toccare codice

Prima di modificare qualsiasi parte del progetto, apri **sempre** il file di regole specifico per l'area su cui stai lavorando. Non esistono eccezioni.

| Area di lavoro | File da leggere |
|---|---|
| Backend API / Express / router / middleware / auth | [`API_RULES.md`](./API_RULES.md) |
| Database / Drizzle ORM / migrations / seed | [`DB_RULES.md`](./DB_RULES.md) |
| Frontend React / UI / Tailwind / Vite / Next.js | [`FRONTEND_RULES.md`](./FRONTEND_RULES.md) |
| Integrazioni AI / OpenAI / Wendy / agenti / prompt | [`AI_RULES.md`](./AI_RULES.md) |
| Git / branching / commit message / PR | [`GIT_RULES.md`](./GIT_RULES.md) |

**Se una modifica tocca più aree** (es. nuova feature AI con endpoint + UI):
1. Leggi prima [`API_RULES.md`](./API_RULES.md) e [`DB_RULES.md`](./DB_RULES.md) per la parte server.
2. Poi [`AI_RULES.md`](./AI_RULES.md) per prompt e integrazione OpenAI.
3. Infine [`FRONTEND_RULES.md`](./FRONTEND_RULES.md) per l'implementazione UI.
4. Usa [`GIT_RULES.md`](./GIT_RULES.md) per commit e PR.

Questi file sono la fonte di verità sull'architettura di NorthStar: **nessuna feature va implementata ignorandoli.**
