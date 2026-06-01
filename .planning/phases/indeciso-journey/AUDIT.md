# AUDIT — Riconciliazione con la base verde (2026-06-01)

> I 4 PLAN originali sono stati scritti su una base più vecchia. La base verde
> (`claude/dazzling-shamir-c08e92`, ora mergiata in questo worktree) contiene già
> metà delle feature. Questo audit mappa cosa esiste, come riusarlo, e ridefinisce
> lo scope reale. **Scelta utente: "Bussola unificante + tool mancanti".**

## Cosa esiste GIÀ (riusare, NON duplicare)

| Sistema esistente | File | Stato | Riuso per la Bussola |
|---|---|---|---|
| **Try-a-Day** (Simulatore "una giornata in...") | `packages/ai-server/src/try-a-day.ts`, `apps/web/src/components/role/TryADaySection.tsx`, `simulated_days` table, route `/api/simulated-days` | **WIRED** (in pagine ruolo) | Sorgente segnale: `debrief.radar {energy, interest, perceivedCompetence, valuesAlignment}` + `suggestions {similar, opposite}` |
| **Skill Bridge** (Ponte competenze) | `apps/web/src/components/profile/SkillBridgeMap/`, route `/api/user/skill-bridge` | WIRED (profilo) | Sorgente segnale: adiacenze skill→professioni |
| **Diario degli Indizi** (Dossier Energia) | `diary_entries(entryType:"indizi")`, `promptPayload` energia/curiosità, route `/api/diary` | WIRED | Sorgente segnale: energia/curiosità per dimensione |
| **Test RIASEC** | `test_sessions` (`riasecScores`, `recommendations`), route `/api/test-sessions` | WIRED | Baseline RIASEC *dichiarato* |
| Routine/Rituali | `userRoutines`, `routineExecutions`, `monthlyRitual` + `routines.tsx` | WIRED | Candidato riuso per **Career Spike** (uno spike ≈ una routine a termine) — da valutare in fase Spike |
| Wendy intelligence | `wendy-neural`, `wendy-intelligence` (capability-matrix, decision-policy) | WIRED | La persona-indeciso si innesta qui, non in un nuovo intent |

## Cosa MANCA davvero (qui si costruisce)

1. **La Bussola** — il layer unificante assente. I sistemi sopra producono segnali *scollegati*; nessuno li fonde in un profilo direzionale (`stage` + confidence per ipotesi + `blockType`). **È il pezzo a più alta leva.**
2. **Lo Specchio** — deck scene-swipe a preferenze rivelate. Non esiste.
3. **Il Torneo** — eliminazione a coppie. Non esiste.
4. **Il Career Spike** — micro-esperimento reversibile con kill-criterion. Non esiste (forse riusabile su `userRoutines`).
5. **Il Diagnostico del blocco** — tipizza l'indecisione. Non esiste.

## Architettura rivista

```
        ┌─────────────── FONTI SEGNALE (già esistenti, lette dagli adapter) ───────────────┐
        │  test_sessions   simulated_days(debrief)   diary_entries(indizi)   skill_bridge   │
        └───────────────────────────────────┬──────────────────────────────────────────────┘
                                             │  recomputeCompass() adapters
   ┌─────── NUOVI capture-tool ───────┐      ▼
   │ Specchio · Torneo · Spike · Blocco│──► compass_signals ──► compass_profiles (stage, hypotheses, blockType)
   └───────────────────────────────────┘                              │
                                                                       ▼
                                                      /bussola hub + Wendy modalità indeciso
```

- `compass_signals`: stream append-only SOLO per i nuovi capture-tool (gli esistenti si leggono diretti, non si duplicano).
- `recomputeCompass()`: fonde segnali nuovi + adapter sulle 4 fonti esistenti → `compass_profiles`.
- **Non** si tocca la logica interna di try-a-day/diary/skill-bridge: la Bussola li *consuma* in sola lettura.

## Scope di esecuzione (rivisto)

- **F1 (questa)**: schema Bussola (`compass_profiles`, `compass_signals`, `scene_cards`) + `recomputeCompass()` con adapter sulle 4 fonti + `/api/compass` + tool Wendy + hub `/bussola` + **Diagnostico blocco** + **Lo Specchio**.
- **F2**: **Torneo** (nuovo) — il Simulatore esiste già, si limita ad agganciare le sue reazioni alla Bussola.
- **F3**: già coperta da Skill Bridge → solo wiring del segnale `bridge` nella Bussola.
- **F4**: **Career Spike** (valutare riuso `userRoutines`).

DB_RULES.md (REGOLA 0) rispettato: snake_case plurale, `created_at`/`updated_at` + trigger, FK ON DELETE esplicito, migration idempotente via `pnpm db:generate`.
