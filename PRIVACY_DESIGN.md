# PRIVACY_DESIGN.md — NorthStar

> Design document per la conformità GDPR (Regolamento UE 2016/679).
> Ultimo aggiornamento: 2026-05-14

---

## 1. Categorie di dati trattati

| Categoria | Esempi | Tabelle interessate |
|-----------|--------|---------------------|
| **Identità** | nome, email, username, avatar | `users` |
| **Autenticazione** | password hash, Google ID, token JWT | `users` |
| **Biografici** | città, bio, cvText, cvJson | `users` |
| **Obiettivi** | test RIASEC, obiettivi personali, progresso | `test_sessions`, `test_results`, `user_objectives`, `objective_comments` |
| **Conversazioni AI** | chat con coach, sessioni vocali, messaggi | `coach_sessions`, `voice_sessions`, `messages`, `conversations`, `coach_memory_facts`, `coach_memory_patterns`, `session_summaries` |
| **Contenuti utente** | business ideas, certificazioni, candidature | `business_ideas`, `certifications`, `job_applications`, `linkedin_imports` |
| **Social** | amicizie, chat messaggi | `friendships`, `chat_messages` |
| **Finanziari** | subscription Stripe, storico pagamenti | `users.stripe_customer_id`, `users.stripe_subscription_id` |
| **Affiliazione** | referral code, commissioni, payout | `affiliate_accounts`, `affiliate_commissions`, `affiliate_withdrawals`, `affiliate_referrals` |
| **Tecnici** | IP (hash), User-Agent, metriche | `audit_log` |
| **Comunicazioni** | richieste contatto, newsletter | `contact_messages` |

## 2. Basi legali del trattamento

| Base legale (Art. 6 GDPR) | Finalità | Dati coinvolti |
|---------------------------|----------|----------------|
| **Consenso** (Art. 6.1.a) | Creazione account, onboarding, matching professionale | Dati identità, biografici, obiettivi |
| **Esecuzione contratto** (Art. 6.1.b) | Erogazione servizio premium, affiliazione | Dati finanziari, affiliazione |
| **Legittimo interesse** (Art. 6.1.f) | Miglioramento AI, analytics, sicurezza | Conversazioni AI, tecnici (anonimizzati) |
| **Obbligo legale** (Art. 6.1.c) | Fatturazione, retention finanziaria (7 anni) | Dati finanziari, audit_log |

## 3. Durata della conservazione (retention)

| Categoria | Durata | Motivazione |
|-----------|--------|-------------|
| Profilo utente (attivo) | Finché l'account è attivo | Necessario per erogare il servizio |
| Conversazioni AI | 12 mesi dal completamento | Miglioramento modello + continuità coaching |
| Coach memory | 12 mesi dall'ultimo aggiornamento | Contesto tra sessioni |
| Dati finanziari | 7 anni | Obbligo fiscale (Art. 22 DPR 600/73) |
| Audit log | 7 anni | Sicurezza + GDPR accountability |
| Account cancellato (soft-delete) | 90 giorni | Periodo di ripensamento (Art. 7.3 GDPR) |
| Cookie / analytics | 12 mesi | Legittimo interesse |

## 4. Misure tecniche

### 4.1 Encryption at rest
- **Database**: AWS RDS / Railway Postgres — encryption at rest AES-256 (trasparente)
- **Chat messaggi**: crittografia end-to-end con chiavi per-utente (`chat_messages.encrypted_content`, `iv`)
- **Backup DB**: cifrati con chiave gestita dal provider

### 4.2 Encryption in transit
- **HTTPS**: TLS 1.2+ su tutti gli endpoint (nginx termina TLS)
- **Postgres**: connessioni cifrate (SSL/TLS)
- **Redis**: autenticazione con password, in produzione in VPC privato
- **OpenAI API**: traffico HTTPS, nessun dato usato per training (opt-out API)

### 4.3 Hashing e pseudonimizzazione
- **Password**: bcrypt con costo 12 (`users.password_hash`)
- **IP addresses**: SHA-256 con salt (`audit_log.ip_address`) tramite `hashIp()`
- **Email in audit**: mai memorizzate — solo `actorId` FK verso users
- **Google ID**: memorizzato ma non esposto in API pubbliche

### 4.4 Controllo accessi
- **Autenticazione**: JWT con expiry 7 giorni
- **Autorizzazione**: middleware `requireAuth`, `requirePremium`, `requireAdmin`
- **Admin API key**: `x-admin-key` header con chiave condivisa
- **Rate limiting**: globale (100/min), auth (10/15min), AI (30/min per utente, 20/min per IP)

### 4.5 Separazione dei ruoli DB
| Ruolo | Variabile | Permessi | Uso |
|-------|-----------|----------|-----|
| `northstar_app` | `DATABASE_URL` | DML (SELECT, INSERT, UPDATE, DELETE) | Runtime app |
| `northstar_migrator` | `DATABASE_URL_MIGRATOR` | DDL + DML | Solo CI/deploy |

## 5. Ciclo di vita dei dati (Data Lifecycle)

### 5.1 Creazione
- Registrazione → record `users` con consenso esplicito
- Privacy policy accettata al signup (checkbox obbligatoria)
- Cookie banner con opt-in per non-essenziali

### 5.2 Esportazione
- Endpoint `GET /api/account/export` (autenticato)
- Formato: JSON strutturato con tutti i dati personali
- Includi: profilo, obiettivi, sessioni coach, messaggi, dati affiliazione

### 5.3 Rettifica
- `PATCH /api/profile` — modifica dati personali
- `PATCH /api/users/:id/privacy` — visibilità profilo

### 5.4 Cancellazione (right to be forgotten)
- `DELETE /api/account` → soft-delete immediato:
  - Nome → "Utente Eliminato"
  - Email → `deleted-{id}-{timestamp}@anon.northstar.app`
  - Password hash → null
  - Google ID → null
  - `deleted_at` → timestamp corrente su tutte le tabelle PII
- Purge definitivo dopo 90 giorni (cron job):
  - Hard-delete dei dati relazionati
  - `purged_at` set su `users` (traccia audit)
  - Audit log conservato (7 anni per accountability)

### 5.5 Portabilità
- `GET /api/account/export` genera un dump JSON completo in formato strutturato
- L'utente può richiedere il trasferimento a terze parti

## 6. Data residency
- **Attuale**: Railway (US region) / Replit (US region)
- **Target EU**: migrazione a provider con regioni EU (ovest Europa)
- **Servizi interessati**: Postgres, Redis, Object Storage
- **Timeline**: vedi roadmap operativa

## 7. Data Processing Agreement (DPA)
- **OpenAI**: DPA disponibile su richiesta (Enterprise agreement)
- **Stripe**: DPA incluso nei T&C
- **Railway**: DPA disponibile per tier Enterprise
- **Resend**: DPA per servizio email

## 8. Data Protection Impact Assessment (DPIA)
> AI coaching è considerato trattamento ad alto rischio (Art. 35 GDPR).
> DPIA semplificato:

### Rischi identificati
1. **Decisioni automatizzate**: il coach AI non prende decisioni legali/finanziarie — fornisce raccomandazioni. Umano-in-the-loop per azioni critiche.
2. **Dati sensibili**: l'utente potrebbe volontariamente condividere dati sanitari nelle chat AI. Nessun profiling basato su dati sensibili.
3. **Minori**: servizio vietato a <16 anni (verifica email obbligatoria).

### Mitigazioni
- AI supervision: supervisor agent valuta ogni risposta prima dell'invio
- Feedback loop: utente può valutare ogni risposta
- Opt-out: disattivazione AI coaching in qualsiasi momento
- Anonimizzazione training: nessun dato utente usato per fine-tuning OpenAI

## 9. Notifiche data breach (Art. 33-34 GDPR)
- **Tempo**: notifica Garante entro 72 ore
- **Contenuto**: natura breach, categorie dati, numero interessati, misure adottate
- **Agli interessati**: se rischio elevato per diritti e libertà
- **Responsabile**: CTO/Data Protection Officer designato

## 10. Verifiche periodiche
- [ ] Annuale: review categorie dati e retention
- [ ] Annuale: test esportazione e cancellazione
- [ ] Annuale: aggiornamento questo documento
- [ ] Ad ogni nuova feature che tratta dati personali: Preliminary Privacy Check
