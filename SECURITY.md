# Security Policy

NorthStar accetta segnalazioni di vulnerabilita' in modo responsabile.

## Responsible Disclosure

Non aprire issue pubbliche, discussion o PR con dettagli sfruttabili. Scrivi a:

```text
security@northstar.app
```

Il canale `security@northstar.app` deve essere creato o aliasato fuori repo prima di annunciare pubblicamente questa policy.

## Cosa Includere

Per aiutarci a riprodurre e correggere rapidamente:

- impatto stimato e asset coinvolti;
- passi di riproduzione chiari;
- ambiente usato (browser, OS, account test, endpoint);
- payload o proof of concept minimo;
- log o screenshot con token, cookie, email e PII redatti;
- indicazione se pensi che dati utente siano stati esposti.

## SLA Iniziale

- Conferma di ricezione entro 3 giorni lavorativi.
- Primo aggiornamento di triage entro 7 giorni lavorativi.
- Aggiornamenti successivi quando cambia stato, impatto o mitigazione.

## Regole di Test

- Usa solo account e dati tuoi o ambienti esplicitamente autorizzati.
- Non esfiltrare, cancellare o modificare dati di altri utenti.
- Non fare denial of service, spam, social engineering o scansioni aggressive.
- Interrompi il test appena hai evidenza sufficiente della vulnerabilita'.

## PGP

PGP non ancora pubblicato. Non inventiamo chiavi nel repository: quando una chiave reale sara' disponibile, questa sezione andra' aggiornata con fingerprint e keyserver/copia armored.

## Scope

Sono in scope il codice applicativo, API, autenticazione, autorizzazione, gestione dati utente, CI/CD e configurazioni deployment di NorthStar. Sono fuori scope vulnerabilita' teoriche senza impatto dimostrabile, rate limit su ambienti locali e finding su dipendenze gia' note senza exploitability nel prodotto.
