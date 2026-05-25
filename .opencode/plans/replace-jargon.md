# Piano sostituzione inglesismi/jargon → italiano

## Fase 1 — `locales/it/translation.json`

### 1a — Nav, Footer, Common

| Chiave | Vecchio | Nuovo |
|--------|---------|-------|
| `nav.news` | `"News"` | `"Notizie"` |
| `nav.premium` | `"Premium"` | `"Pro"` |
| `footer.links.test` | `"Il Test RIASEC"` | `"Il Test di Personalità"` |
| `footer.links.news` | `"News settoriali"` | `"Notizie settoriali"` |
| `footer.links.premium` | `"Piano Premium"` | `"Piano Pro"` |
| `common.aiRisk` | `"Rischio AI"` | `"Rischio automazione"` |
| `common.trend` | `"Trend mercato"` | `"Andamento mercato"` |

### 1b — Home

| Chiave | Vecchio | Nuovo |
|--------|---------|-------|
| `home.howItWorks.step1Desc` | `"inclinazioni RIASEC"` | `"inclinazioni professionali"` |
| `home.personalized` | *(OK)* | — |
| `home.news.title` | `"Ultime dal mondo del lavoro"` | *(OK)* |

### 1c — Test, Results

| Chiave | Vecchio | Nuovo |
|--------|---------|-------|
| `test.complete.subtitle` | `"profilo RIASEC"` | `"profilo"` |
| `results.riasecProfile` | `"Il tuo profilo RIASEC"` | `"Il tuo profilo"` |
| `results.matchScore` | `"{{score}}% compatibilità"` | *(OK)* |
| `results.trend` → valori | tutti `"trend"` → `"andamento"` | *(solo etichette)* |
| `results.marketTrend` | `"Trend mercato"` | `"Andamento mercato"` |
| `results.workModeSuggested` | `"profilo RIASEC"` → `"profilo"` | |
| `results.aiSection.title` | `"Analisi AI Approfondita"` | `"Analisi approfondita"` |
| `results.aiSection.planFree` | `"Piano gratuito"` | *(OK)* |
| `results.aiSection.planPremium` | `"Piano Premium"` | `"Piano Pro"` |
| `results.aiSection.premiumBadge` | `"Analisi Premium"` | `"Analisi Pro"` |
| `results.aiSection.upsellTitle` | `"Sblocca l'analisi completa"` | |
| `results.aiSection.upsellDesc` | `"Con Premium"` → `"Con Pro"` | |
| `results.aiSection.upsellBtn` | `"Sblocca"` | |
| `results.aiSection.dashboardLink` | `"Dashboard AI"` → `"Pannello di controllo"` | |

### 1d — Sector, Premium

| Chiave | Vecchio | Nuovo |
|--------|---------|-------|
| `sector.premiumTools` | `"Strumenti Premium"` | `"Strumenti Pro"` |
| `sector.wikiAI` | `"Wiki AI"` | `"Guida AI"` |
| `sector.roadmap` | `"Roadmap Dettagliata"` | `"Piano di crescita"` |
| `sector.roadmapDesc` | `"Piano step-by-step"` → `"Piano dettagliato"` | |
| `sector.automationRisk` | `"Rischio automazione"` | *(OK)* |
| `sector.deepenWithAI` | `"Approfondisci con l'AI"` | `"Approfondisci"` |
| `premium.badge` | `"NorthStar Premium"` | `"NorthStar Pro"` |
| `premium.planName` | `"Piano Premium"` | `"Piano Pro"` |
| `premium.features.wiki.title` | `"Wiki Personalizzata con AI"` | `"Guida personalizzata"` |
| `premium.features.roadmap.title` | `"Roadmap Dettagliata"` | `"Piano di crescita"` |
| `premium.features.roadmap.desc` | `"piano step-by-step"` | `"piano dettagliato"` |
| `premium.includes.roadmap` | `"Roadmap step-by-step"` | `"Piano di crescita"` |
| `premium.includes.wiki` | `"Wiki AI personalizzata"` | `"Guida AI personalizzata"` |

### 1e — Growth, News

| Chiave | Vecchio | Nuovo |
|--------|---------|-------|
| `growth.unlockDesc` | `"test RIASEC"` → `"test di personalità"` | |
| `growth.personalizedDesc` | `"tipo di personalità RIASEC"` → `"profilo"` | |
| `growth.ctaDesc` | `"test RIASEC + Cinque Spiriti"` → `"test"` | |
| `growth.discoverProfileDesc` | `"test RIASEC"` → `"test di personalità"` | |
| `news.title` | `"News dal mondo del lavoro"` | `"Notizie dal mondo del lavoro"` |
| `news.badge` | `"Aggiornamenti dal mondo del lavoro"` | *(OK)* |
| `news.subtitle` | `"Notizie aggiornate"` | *(OK)* |
| `news.loading` | `"Caricamento notizie"` → `"Caricamento…"` | |
| `news.upgrade.discoverPremium` | `"Scopri Premium"` → `"Scopri Pro"` | |
| `news.categories.business` | `"Business"` | `"Economia"` |

### 1f — Auth, Profile, Register

| Chiave | Vecchio | Nuovo |
|--------|---------|-------|
| `register.benefits.riasec` | `"profilo RIASEC"` → `"profilo"` | |

### 1g — ChiSiamo, ComeFunziona

| Chiave | Vecchio | Nuovo |
|--------|---------|-------|
| `chiSiamo.values[5].desc` | `"AI"` → `"intelligenza artificiale"` | *(prima occorrenza)* |
| `comeFunziona.badge` | `"Il metodo NorthStar"` | *(OK)* |
| `comeFunziona.steps[0].description` | `"modello RIASEC"` → `"modello di personalità"` | |
| `comeFunziona.steps[0].detail` | `"6 dimensioni (Realistico...)"` → *(OK)* | |
| `comeFunziona.steps[1].description` | `"profilo RIASEC"` → `"profilo"` | |
| `comeFunziona.steps[2].description` | `"rischio di automazione AI"` → `"rischio automazione"` | |
| `comeFunziona.steps[2].detail` | `"premium (Wiki, Roadmap, Grafo)"` → `"Pro (Guida, Piano, Mappa)"` | |
| `comeFunziona.spirits[3].key` | `"Focus"` | `"Concentrazione"` |
| `comeFunziona.spirits[3].desc` | `"Concentrazione profonda"` | *(OK — label cambia)* |
| `comeFunziona.faq[q0].a` | `"premium"` → `"Pro"` | |
| `comeFunziona.faq[q4].a` | `"rischio AI"` → `"rischio automazione"` | |
| `comeFunziona.faqTitle` | `"Hai ancora dubbi?"` *(OK)* | |
| `comeFunziona.faqBadge` | `"Domande frequenti"` *(OK)* | |
| `comeFunziona.privacyPoints[4]` | `"modelli AI"` → `"modelli di intelligenza artificiale"` | |

### 1h — Contatti

| Chiave | Vecchio | Nuovo |
|--------|---------|-------|
| `contatti.faq[q1].a` | `"Wiki AI"` → `"Guida AI"` | |
| `contatti.faq[q1].a` | `"Roadmap"` → `"Piano di crescita"` | |
| `contatti.faq[q1].a` | `"Premium"` → `"Pro"` | |
| `contatti.subjects.feedback.label` | `"Feedback e suggerimenti"` | `"Opinioni e suggerimenti"` |

### 1i — Roadmap, Grafo, Confronta, Sitemap

| Chiave | Vecchio | Nuovo |
|--------|---------|-------|
| `roadmap.title` | `"Roadmap"` | `"Piano di crescita"` |
| `roadmap.subtitle` | `"piano step-by-step"` | `"piano dettagliato"` |
| `roadmap.generate` | `"Genera roadmap"` | `"Genera piano"` |
| `roadmap.generating` | `"Generazione in corso…"` | *(OK)* |
| `roadmap.premiumRequired` | `"Funzione Premium"` | `"Funzione Pro"` |
| `roadmap.upgrade` | `"Passa a Premium"` | `"Passa a Pro"` |
| `roadmap.generateCta` | `"Genera la mia Roadmap"` | `"Genera il mio piano"` |
| `roadmap.building` | `"Costruendo la tua roadmap"` | `"Creazione del piano"` |
| `roadmap.buildingDesc` | `"L'AI sta analizzando"` | `"Stiamo analizzando"` |
| `roadmap.regenerate` | `"Rigenera la roadmap"` | `"Rigenera"` |
| `roadmap.detailed` | `"Roadmap Dettagliata"` | `"Piano di crescita"` |
| `grafo.title` | `"Grafo della Conoscenza"` | `"Mappa delle conoscenze"` |
| `grafo.chatDesc` | `"L'AI risponde"` → prima occ: `"L'intelligenza artificiale risponde"` | |
| `grafo.regenerate` | `"Rigenera"` *(OK)* | |
| `confronta.metrics.risk` | `"Rischio AI"` | `"Rischio automazione"` |
| `confronta.metrics.trend` | `"Trend"` | `"Andamento"` |
| `confronta.automationRisk` | `"Rischio automazione"` *(OK)* | |
| `confronta.marketTrend` | `"Trend di mercato"` | `"Andamento di mercato"` |
| `sitemap.groups.roadmap` | `"Roadmap di carriera"` | `"Piano di carriera"` |
| `sitemap.groups.grafo` | `"Grafo della conoscenza"` | `"Mappa delle conoscenze"` |
| `sitemap.groups.wiki` | `"Wiki per settore"` | `"Guide per settore"` |
| `sitemap.desc` | `"risorse premium"` → `"risorse Pro"` | |

### 1j — Dashboard, Candidature

| Chiave | Vecchio | Nuovo |
|--------|---------|-------|
| `dashboard.yourJourney` | `"Il tuo percorso"` *(OK)* | |
| `dashboard.sectorRoadmap` | `"Roadmap del settore"` | `"Piano di crescita"` |
| `dashboard.competenceGraph` | `"Grafo delle competenze"` | `"Mappa delle competenze"` |
| `dashboard.matchScore` | `"{{score}}% match"` | `"{{score}}% compatibilità"` |
| `candidature.rolePlaceholder` | `"es. UX Designer"` | `"es. Progettista UX"` |

### 1k — CV

| Chiave | Vecchio | Nuovo |
|--------|---------|-------|
| `cv.myResume` | `"Il mio Curriculum"` *(OK)* | |
| `cv.generateCv` | `"Genera CV"` | `"Genera curriculum"` |
| `cv.generatingDesc` | `"profilo RIASEC"` → `"profilo"` | |
| `cv.livePreview` | `"Preview live →"` | `"Anteprima →"` |
| `cv.previewTabMobile` | `"Anteprima"` *(OK)* | |
| `cv.featureCv` | `"CV Ottimizzato"` | `"Curriculum ottimizzato"` |
| `cv.atsScoreTitle` | `"Analizza compatibilità ATS"` *(OK)* | |
| `cv.tailorSteps[3]` | `"match ATS"` → `"compatibilità ATS"` | |
| `cv.atsSteps[1]` | `"keyword match"` → `"corrispondenza parole chiave"` | |
| `cv.atsTipUseTailor` | `"Adatta a Offerta"` *(OK)* | |

### 1l — Calendar, Affiliazione, SEO

| Chiave | Vecchio | Nuovo |
|--------|---------|-------|
| `calendar.wikiLabel` | `"Articoli Wiki"` | `"Guide"` |
| `calendar.roadmapLabel` | `"Roadmap di settore"` | `"Piano di settore"` |
| `calendar.premiumNote` | `"Passa a Premium"` → `"Passa a Pro"` | |
| `calendar.upgradePremium` | `"Passa a Premium →"` | `"Passa a Pro →"` |
| `calendar.premiumFeatureTitle` | `"Funzione Premium"` | `"Funzione Pro"` |
| `calendar.categories.training` | `"Formazione"` *(OK)* | |
| `calendar.categories.follow-up` | `"Follow-up"` | `"Verifica"` |
| `affiliazione.userBenefitsTitle` | *(OK)* | |
| `seo.home.description` | `"test RIASEC gratuito"` → `"test gratuito"` | |
| `seo.home.description` | `"rischio AI"` → `"rischio automazione"` | |
| `seo.sectors.description` | `"tipo RIASEC, rischio automazione AI"` → `"tipo, rischio automazione"` | |
| `seo.premium.title` | `"NorthStar Premium"` → `"NorthStar Pro"` | |
| `seo.premium.description` | `"Wiki AI"` → `"Guide AI"` | |
| `seo.premium.description` | `"roadmap"` → `"piani di crescita"` | |
| `seo.sectorDescSuffix` | *(OK)* | |

### 1m — PremiumSuccess, WorkMode

| Chiave | Vecchio | Nuovo |
|--------|---------|-------|
| `premiumSuccess.title` | `"Benvenuto in Premium!"` | `"Benvenuto in Pro!"` |
| `premiumSuccess.badge` | `"Benvenuto in Premium"` | `"Benvenuto in Pro"` |
| `premiumSuccess.desc` | `"accesso Premium"` → `"accesso Pro"` | |
| `premiumSuccess.activated` | `"Abbonamento attivato!"` *(OK)* | |
| `workMode.autonomo` | `"Autonomo/Freelance"` | `"Libero professionista"` |

---

## Fase 2 — File .tsx/.ts (testo hardcoded)

### `pages/dashboard.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 89 | `"Test RIASEC"` | `"Test di personalità"` |
| 91 | `"Career Coach AI"` | `"Consulente di carriera"` |
| 92 | `"Coach AI"` | `"Consulente AI"` |
| 95 | `"Gap Competenze"` | `"Competenze da sviluppare"` |
| 95 | desc: `"skill che ti mancano"` → `"cosa ti manca"` | |
| 97 | `"Career Coach AI"` | `"Consulente di carriera"` |
| 98 | `"Le mie candidature"` *(OK)* | |
| 101 | `"Valida la tua idea"` *(OK)* | |
| 102 | `"Business Coach AI"` | `"Consulente per la tua attività"` |
| 103 | `"Mercati in crescita"` *(OK)* | |
| 104 | `"Knowledge Graph"` | `"Mappa delle conoscenze"` |
| 107 | `"Profili RIASEC"` | `"Profili personalità"` |
| 115 | `"Report di crescita"` *(OK)* | |
| 262 | `"Premium"` badge | `"Pro"` |
| 312 | title: `"Dashboard AI — NorthStar"` | `"Pannello di controllo — NorthStar"` |
| 313 | `"analisi AI personalizzata"` | `"analisi personalizzata"` |
| 369 | `"Dashboard AI"` | `"Pannello di controllo"` |
| 371 | `"analisi AI personalizzata"` | `"analisi personalizzata"` |
| 413 | `"La tua dashboard AI"` | `"Il tuo pannello di controllo"` |
| 474 | `"Wiki AI"` | `"Guida AI"` |
| 475 | `"Roadmap"` | `"Piano di crescita"` |
| 507 | `"Analisi AI personalizzata"` | `"Analisi personalizzata"` |
| 565 | `"Con Premium"` → `"Con Pro"` | |
| 565 | `"l'AI consiglia"` → `"l'intelligenza artificiale consiglia"` | |
| 571 | `"Wiki AI"` | `"Guida AI"` |
| 572 | `"Roadmap"` | `"Piano di crescita"` |
| 573 | `"Knowledge Graph"` | `"Mappa delle conoscenze"` |

### `pages/home.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 99 | `"Test RIASEC"` | `"Test di personalità"` |
| 99 | `"Coach AI"` | `"Consulente AI"` |
| 121 | `"Coach AI"` | `"Consulente AI"` |
| 559 | `"Fai il test RIASEC"` | `"Fai il test"` |
| 561 | `"Ricevi una valutazione AI del tuo business"` | `"Valutazione con AI della tua attività"` |
| 562 | `"Profili RIASEC"` | `"Profili personalità"` |
| 630 | `"analisi AI"` → `"analisi"` | |
| 630 | `"test RIASEC gratuito"` → `"test gratuito"` | |
| 725 | `"Test RIASEC"` | `"Test di personalità"` |
| 727 | badge `"Premium"` | `"Pro"` |
| 727 | `"Coach AI"` | `"Consulente AI"` |
| 731 | badge `"AI"` | *(prima occ: `"intelligenza artificiale"`)* |
| 733 | `"Career Coach AI"` | `"Consulente di carriera"` |
| 738 | `"Business Coach AI"` | `"Consulente per la tua attività"` |
| 743 | `"Profili RIASEC"` | `"Profili personalità"` |
| 752 | `"Knowledge Graph"` | `"Mappa delle conoscenze"` |
| 938 | `"17 domande RIASEC"` | `"17 domande"` |
| 945 | `"Ottieni strumenti AI"` | `"Strumenti con AI"` |
| 946 | `"business validator"` | `"analisi idea"` |
| 946 | `"skill gap analysis"` | `"analisi competenze"` |

### `pages/coach.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 61 | `"Analizza il mio profilo RIASEC"` | `"Analizza il mio profilo"` |
| 86 | `"Career Coach AI"` | `"Consulente di carriera"` |
| 234 | `"Coach AI"` | `"Consulente AI"` |
| 305 | `"Conosco il tuo profilo RIASEC"` | `"Conosco il tuo profilo"` |
| 373 | placeholder `"Scrivi un messaggio al tuo coach"` | `"Scrivi un messaggio al tuo consulente"` |

### `pages/percorso.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 36 | `"Test RIASEC"` | `"Test di personalità"` |
| 36 | `"Coach AI"` | `"Consulente AI"` |
| 48 | `"Analisi skill gap"` | `"Analisi competenze"` |
| 71 | `"profili RIASEC"` | `"profili personalità"` |
| 83 | `"business angel o VC"` | `"investitore privato o fondo"` |

### `pages/skills-gap.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 77 | `"Generando il report finale"` | `"Preparazione del rapporto finale"` |
| 265 | placeholder `"Aggiungi skill personalizzata"` | `"Aggiungi competenza"` |

### `pages/results.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 846 | `"AI Validator"` | `"Analisi con AI"` |
| 1108 | `"NorthStar AI"` | `"NorthStar"` |

### `pages/sector.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 389 | `"Preparati con mock interview AI"` | `"Simulazione colloquio con AI"` |

### `pages/validatore-idea.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 364 | `"L'AI sta analizzando"` | `"L'intelligenza artificiale sta analizzando"` |
| 530 | `"L'AI analizza la tua idea"` | `"Analisi della tua idea"` |
| 610 | `"l'AI la struttura"` | `"analisi, struttura"` |
| 673 | `"Valida con AI"` | `"Analizza"` |

### `pages/colloquio.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 212 | `"Preparati al colloquio con l'AI"` | `"Preparati al colloquio"` |
| 233 | `"L'AI farà domande"` | `"Simulazione colloquio"` |

### `pages/roadmap.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 345 | `"Servizio AI non disponibile"` | `"Servizio non disponibile"` |
| 451 | `"L'AI analizza il tuo profilo"` | `"Analisi del profilo"` |

### `pages/lavori.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 103 | `"match con il tuo profilo RIASEC"` | `"compatibilità con il tuo profilo"` |
| 134 | `"AI Match"` | `"Compatibilità AI"` |
| 184 | `"match personalizzato"` | `"proposte personalizzate"` |

### `pages/certificato.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 106 | `"Verifica Certificato NFT"` | `"Verifica Certificato"` |
| 164 | `alt="Certificato NFT"` | `alt="Certificato"` |

### `pages/test.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 1016 | `"Orientamento AI"` | `"Orientamento"` |
| 29 | nome spirito: `"Focus"` | `"Concentrazione"` |

### `components/NftCertificateGallery.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 159 | `"Il mio certificato NorthStar NFT"` | `"Il mio certificato"` |
| 194 | `"I miei NFT"` | `"I miei certificati"` |
| 211 | `"Certificati NFT"` | `"Certificati"` |
| 231 | `"certificati NFT verificabili su blockchain"` | `"certificati verificabili"` |

### `components/layout/Navbar.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 311 | `"Coach AI"` | `"Consulente AI"` |

### `components/ui/spinner.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 9 | `aria-label="Loading"` | `aria-label="Caricamento"` |

### `components/ShareProfileButton.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 151 | `"Live preview"` | `"Anteprima"` |

### `components/OnboardingWizard.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 57 | `"Completare il test RIASEC"` | `"Completare il test"` |
| 62 | `"Inizia il test RIASEC"` | `"Inizia il test"` |
| 73 | `"identificare i gap"` | `"identificare le competenze da sviluppare"` |
| 78 | `"Vai alla dashboard AI"` | `"Vai al pannello di controllo"` |
| 89 | `"Validare la mia idea di business con l'AI validator"` | `"Analizzare la mia idea con l'intelligenza artificiale"` |
| 123 | `"Valutare startup nel mio settore"` | `"Valutare nuove imprese"` |
| 123 | `"con il validator"` | `"con l'analisi"` |

### `components/onboarding/OnboardingModal.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 36 | `{ value: "networking", label: "Networking" }` | `{ value: "networking", label: "Relazioni" }` |
| 115 | `"tutti gli strumenti AI"` | `"tutti gli strumenti"` |
| 234 | `"Roadmap AI"` | `"Piano di crescita"` |
| 236 | `"Coach AI"` | `"Consulente AI"` |
| 237 | `"Grafo Conoscenza"` | `"Mappa conoscenze"` |

### `components/wendy/WendyMessageFeedback.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 56 | `"Grazie per il feedback!"` | `"Grazie per la tua opinione!"` |

### `components/wendy/WendyGenerativeUI.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 260 | `"una checklist o un range salariale"` | `"una lista o una forbice salariale"` |
| 260 | `"Genera un componente UI interattivo"` | `"Crea un elemento interattivo"` |

### `contexts/AuthContext.tsx`

Nessun testo utente visibile da cambiare.

### `components/cv/CvSection.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 256 | `"Scegli il template"` | `"Scegli il modello"` |
| 294 | `"Genera con template"` | `"Genera con modello"` |
| 307 | `"CV generato con template"` | `"Curriculum generato con modello"` |
| 323 | `"Carica il tuo CV (PDF/TXT)"` | `"Carica il tuo curriculum (PDF/TXT)"` |
| 334 | `"Carica CV"` | `"Carica curriculum"` |
| 341 | `"Genera da profilo"` / `"Rigenera CV"` | `"Genera da profilo"` / `"Rigenera curriculum"` |
| 346 | `"Scarica in PDF, DOCX o JSON"` *(OK)* | |
| 346 | `"3 template"` → `"3 modelli"` | |
| 351 | `aria-label="Carica CV"` | `aria-label="Carica curriculum"` |

### `components/cv/CvGeneratorModal.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 178 | `"Modifica CV"` | `"Modifica curriculum"` |
| 63 | `"Scarica CV"` | `"Scarica curriculum"` |
| 488 | `"preview"` tab | `"anteprima"` |
| 1051 | `"Scarica PDF"` *(OK)* | |
| 1895 | `"PDF"` *(OK)* | |

### `components/cv/CvDownloadMenu.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 3 | `"PDF, DOCX, JSON"` *(OK)* | |
| 74 | `"PDF"` *(OK)* | |
| 75 | `"Template {template}"` | `"Modello {template}"` |

### `hooks/useWendyChat.ts`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 209 | `"Il servizio AI è momentaneamente non disponibile"` | `"Il servizio è momentaneamente non disponibile"` |

### `pages/grafo-conoscenza.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 1337 | `"L'AI legge tutti i tuoi elementi"` | `"L'intelligenza artificiale legge i tuoi elementi"` |
| 887 | `"PDF, MD, TXT"` *(OK)* | |

### `pages/affiliazione.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 241 | `"rischio AI"` | `"rischio automazione"` |
| 302 | `"rischio AI, trend"` | `"rischio automazione, andamento"` |

### `pages/admin-home.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 135 | `"generati dall'AI"` | `"generati automaticamente"` |
| 158 | `"generati da Tavily + AI"` | `"generati da fonti web"` |
| 172 | `"Modifica i prompt degli agenti AI"` | `"Modifica le istruzioni"` |

### `pages/score-card.tsx`

| Riga | Vecchio | Nuovo |
|------|---------|-------|
| 191 | `"Orientamento professionale guidato dall'AI"` | `"Orientamento professionale"` |

---

## Fase 3 — Altri file locale (en, fr, es, de)

Applicare le STESSE modifiche strutturali agli altri 4 file locale. In particolare:

### `locales/en/translation.json`

Tradurre in INGLESE corretto tutte le chiavi che ora hanno valori italiani. Esempi:
- `nav.premium` → `"Pro"`
- `nav.news` → `"News"` (OK in inglese)
- `footer.links.test` → `"Personality Test"`
- `results.riasecProfile` → `"Your Profile"`
- `sector.roadmap` → `"Growth Plan"`
- `roadmap.title` → `"Growth Plan"`
- `grafo.title` → `"Knowledge Map"`
- `comeFunziona.spirits[3].key` → `"Focus"` (OK in inglese)

### `locales/fr/translation.json`

Tradurre in FRANCESE:
- `nav.premium` → `"Pro"`
- `nav.news` → `"Actualités"`
- `footer.links.test` → `"Le Test de Personnalité"`
- `comeFunziona.spirits[3].key` → `"Concentration"`
- `roadmap.title` → `"Plan de croissance"`
- `grafo.title` → `"Carte des connaissances"`
- `sector.roadmap` → `"Plan de croissance"`
- `premium.planName` → `"Formule Pro"`
- `calendar.categories.follow-up` → `"Suivi"`

### `locales/es/translation.json`

Tradurre in SPAGNOLO:
- `nav.premium` → `"Pro"`
- `nav.news` → `"Noticias"`
- `footer.links.test` → `"El Test de Personalidad"`
- `comeFunziona.spirits[3].key` → `"Concentración"`
- `roadmap.title` → `"Plan de crecimiento"`
- `grafo.title` → `"Mapa de conocimientos"`
- `sector.roadmap` → `"Plan de crecimiento"`
- `premium.planName` → `"Plan Pro"`

### `locales/de/translation.json`

Tradurre in TEDESCO:
- `nav.premium` → `"Pro"`
- `nav.news` → `"Nachrichten"`
- `footer.links.test` → `"Der Persönlichkeitstest"`
- `comeFunziona.spirits[3].key` → `"Konzentration"`
- `roadmap.title` → `"Wachstumsplan"`
- `grafo.title` → `"Wissenskarte"`
- `sector.roadmap` → `"Wachstumsplan"`
- `premium.planName` → `"Pro-Plan"`
