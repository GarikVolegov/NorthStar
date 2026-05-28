---
layer: domain
status: draft
runtime: true
owner: garik
links_to: [[Career-Coaching-IT]], [[../20_Product/Subsystems/RAG-Pipeline]]
tags: [L2, domain, market, italy]
updated: 2026-05-28
---

# Job Market — Italia (IT)

## Mercato target iniziale
Italia, profili IT (dev, data, devops, security, PM tech). Espansione EU post product-market fit.

## Sorgenti dati
- Job posting aggregati (LinkedIn, InfoJobs, indeed) → `jobPostingSnapshotsTable` (snapshot mensili)
- Skill cooccurrence estratta dai posting → `skillCooccurrencesTable`
- Weak signals → `weakSignalsTable`
- (Vedi schema completo in [[../20_Product/Subsystems/RAG-Pipeline]])

## Dimensioni che il prodotto modella
- **Ruolo** (`roleTitle`) — junior/mid/senior dev frontend, backend, fullstack, data engineer, …
- **Geografia** (`geography`) — Milano, Roma, Torino, remote-IT, remote-EU
- **Seniority** (years_exp band)
- **Stack/skill** — nodi del grafo skill cooccurrence
- **RAL band** (TBD — non sempre presente nei posting)

## Stagionalità nota
- Q1 picco posting post-budget aziendale
- Agosto crollo
- Settembre-Ottobre secondo picco

## TODO
- Validare coverage delle fonti dati (quanti posting/mese effettivamente entrano in `jobPostingSnapshotsTable`)
- Definire policy refresh weak signals
