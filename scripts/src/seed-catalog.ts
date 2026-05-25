/**
 * seed-catalog.ts — popola sectors e professions con dati di base.
 *
 * IDEMPOTENTE: usa SELECT + INSERT/UPDATE (evita ON CONFLICT su colonne senza unique constraint).
 *
 * Eseguire con:
 *   pnpm --filter @workspace/scripts run seed:catalog
 *
 * Dopo il seed, generare gli embedding con:
 *   POST /api/admin/agents/backfill  (richiede Bearer token admin)
 */

import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { db, sectorsTable, professionsTable, educationPathsTable, professionEducationPathsTable } from "@workspace/db";

// ── Dati settori ─────────────────────────────────────────────────────────────

const SECTORS = [
  { name: "Tecnologia & Software",     description: "Sviluppo software, AI, cloud, cybersecurity e prodotti digitali.", riasecTypes: ["I","R","C"], skills: ["programmazione","problem solving","algoritmi","cloud","sicurezza informatica"], avgSalaryMin: 30000, avgSalaryMax: 85000, growthRate: 0.18, automationRisk: "low" as const, scalability: "high" as const, trend: "booming" as const, timeToAutonomy: "2-4 anni", advantages: ["alta domanda","lavoro remoto","alta retribuzione"], disadvantages: ["aggiornamento continuo","burnout"], opportunities: ["AI engineer","cloud architect","PM tech"], icon: "cpu", color: "#6366f1", workMode: ["dipendente","autonomo","ibrido"] as any, autonomyScore: 8, stabilityScore: 7 },
  { name: "Marketing & Comunicazione",  description: "Marketing digitale, content strategy, brand management, SEO/SEM e social media.", riasecTypes: ["E","A","S"], skills: ["copywriting","SEO","analytics","social media","storytelling"], avgSalaryMin: 22000, avgSalaryMax: 60000, growthRate: 0.12, automationRisk: "medium" as const, scalability: "high" as const, trend: "growing" as const, timeToAutonomy: "1-3 anni", advantages: ["creatività valorizzata","settori diversi","freelance possibile"], disadvantages: ["mercato affollato","ROI difficile"], opportunities: ["growth hacker","CMO","content strategist"], icon: "megaphone", color: "#f59e0b", workMode: ["dipendente","autonomo","ibrido"] as any, autonomyScore: 7, stabilityScore: 6 },
  { name: "Finanza & Investimenti",     description: "Analisi finanziaria, gestione portafogli, trading, corporate finance e fintech.", riasecTypes: ["C","I","E"], skills: ["analisi dati","Excel avanzato","modelli finanziari","diritto societario"], avgSalaryMin: 28000, avgSalaryMax: 120000, growthRate: 0.08, automationRisk: "medium" as const, scalability: "medium" as const, trend: "stable" as const, timeToAutonomy: "4-7 anni", advantages: ["alta remunerazione","stabilità","internazionale"], disadvantages: ["orari intensi","stress elevato"], opportunities: ["CFO","portfolio manager","fintech consultant"], icon: "trending-up", color: "#10b981", workMode: ["dipendente","ibrido"] as any, autonomyScore: 5, stabilityScore: 8 },
  { name: "Sanità & Life Sciences",     description: "Medicina clinica, farmaceutica, biotecnologie, salute mentale e dispositivi medici.", riasecTypes: ["I","S","R"], skills: ["ricerca clinica","biologia","regolatoria","farmacologia"], avgSalaryMin: 25000, avgSalaryMax: 90000, growthRate: 0.15, automationRisk: "low" as const, scalability: "low" as const, trend: "booming" as const, timeToAutonomy: "6-10 anni", advantages: ["missione elevata","stabilità","ricerca innovativa"], disadvantages: ["formazione lunghissima","responsabilità alta"], opportunities: ["biotech researcher","health data scientist","regulatory affairs"], icon: "heart-pulse", color: "#ef4444", workMode: ["dipendente"] as any, autonomyScore: 4, stabilityScore: 9 },
  { name: "Istruzione & Formazione",    description: "Insegnamento, e-learning, coaching professionale, formazione aziendale e EdTech.", riasecTypes: ["S","A","E"], skills: ["didattica","curriculum design","coaching","comunicazione"], avgSalaryMin: 18000, avgSalaryMax: 50000, growthRate: 0.10, automationRisk: "low" as const, scalability: "high" as const, trend: "growing" as const, timeToAutonomy: "2-4 anni", advantages: ["impatto sociale","flessibilità","scalabile online"], disadvantages: ["bassa retribuzione base","saturazione"], opportunities: ["e-learning creator","corporate trainer","EdTech founder"], icon: "graduation-cap", color: "#8b5cf6", workMode: ["dipendente","autonomo","ibrido"] as any, autonomyScore: 8, stabilityScore: 7 },
  { name: "Design & UX",               description: "Product design, UX research, UI design, design system e service design.", riasecTypes: ["A","I","E"], skills: ["Figma","ricerca utenti","prototipazione","design thinking"], avgSalaryMin: 25000, avgSalaryMax: 75000, growthRate: 0.14, automationRisk: "low" as const, scalability: "high" as const, trend: "growing" as const, timeToAutonomy: "2-4 anni", advantages: ["creatività + logica","remoto possibile","portfolio misurabile"], disadvantages: ["feedback soggettivi","tool in rapida evoluzione"], opportunities: ["head of design","design lead","UX researcher"], icon: "palette", color: "#f43f5e", workMode: ["dipendente","autonomo","ibrido"] as any, autonomyScore: 8, stabilityScore: 7 },
  { name: "Dati & Intelligenza Artificiale", description: "Data science, machine learning, data engineering, analytics e AI applicata.", riasecTypes: ["I","C","R"], skills: ["Python","SQL","machine learning","statistica","visualizzazione dati"], avgSalaryMin: 32000, avgSalaryMax: 95000, growthRate: 0.25, automationRisk: "low" as const, scalability: "high" as const, trend: "booming" as const, timeToAutonomy: "3-5 anni", advantages: ["domanda altissima","stipendi elevati","trasversale"], disadvantages: ["competenze molto specifiche","dati di qualità rari"], opportunities: ["ML engineer","data architect","AI product manager"], icon: "bar-chart-2", color: "#0ea5e9", workMode: ["dipendente","autonomo","ibrido"] as any, autonomyScore: 7, stabilityScore: 8 },
  { name: "E-commerce & Retail",        description: "Vendite online, marketplace, supply chain digitale, customer experience e omnichannel.", riasecTypes: ["E","C","S"], skills: ["marketplace management","pricing","logistics","customer care"], avgSalaryMin: 20000, avgSalaryMax: 65000, growthRate: 0.11, automationRisk: "high" as const, scalability: "high" as const, trend: "growing" as const, timeToAutonomy: "1-3 anni", advantages: ["risultati misurabili","scalabilità globale","entry rapida"], disadvantages: ["margini bassi","alta competizione"], opportunities: ["e-commerce manager","marketplace strategist","DTC founder"], icon: "shopping-cart", color: "#f97316", workMode: ["dipendente","autonomo","ibrido"] as any, autonomyScore: 7, stabilityScore: 5 },
  { name: "Legale & Compliance",        description: "Diritto societario, GDPR, contrattualistica, IP, regolamentazione finanziaria.", riasecTypes: ["C","E","I"], skills: ["diritto commerciale","contratti","privacy","regulatory"], avgSalaryMin: 28000, avgSalaryMax: 100000, growthRate: 0.07, automationRisk: "medium" as const, scalability: "medium" as const, trend: "stable" as const, timeToAutonomy: "5-8 anni", advantages: ["alta remunerazione","stabilità","expertise trasferibile"], disadvantages: ["percorso lungo","aggiornamento normativo continuo"], opportunities: ["general counsel","DPO","legal tech consultant"], icon: "scale", color: "#64748b", workMode: ["dipendente","autonomo"] as any, autonomyScore: 6, stabilityScore: 9 },
  { name: "Energia & Sostenibilità",    description: "Energie rinnovabili, ESG, efficienza energetica, economia circolare e green tech.", riasecTypes: ["I","R","E"], skills: ["ingegneria energetica","ESG reporting","project management","normativa ambientale"], avgSalaryMin: 26000, avgSalaryMax: 80000, growthRate: 0.20, automationRisk: "low" as const, scalability: "medium" as const, trend: "booming" as const, timeToAutonomy: "4-6 anni", advantages: ["impatto positivo","incentivi governativi","crescita strutturale"], disadvantages: ["dipendenza da politiche","cicli investimento lunghi"], opportunities: ["ESG analyst","solar project manager","sustainability director"], icon: "leaf", color: "#22c55e", workMode: ["dipendente","ibrido"] as any, autonomyScore: 6, stabilityScore: 7 },
  { name: "Logistica & Supply Chain",   description: "Gestione magazzini, import/export, procurement, last-mile delivery e ottimizzazione.", riasecTypes: ["C","R","E"], skills: ["ERP","lean manufacturing","procurement","gestione fornitori"], avgSalaryMin: 22000, avgSalaryMax: 70000, growthRate: 0.09, automationRisk: "high" as const, scalability: "medium" as const, trend: "stable" as const, timeToAutonomy: "3-5 anni", advantages: ["ruolo strategico crescente","internazionale","diversificato"], disadvantages: ["sotto pressione post-pandemia","automazione crescente"], opportunities: ["supply chain director","procurement manager","logistics tech"], icon: "truck", color: "#78716c", workMode: ["dipendente"] as any, autonomyScore: 4, stabilityScore: 7 },
  { name: "Media & Intrattenimento",    description: "Produzione audiovisiva, streaming, gaming, podcasting, giornalismo digitale.", riasecTypes: ["A","E","S"], skills: ["storytelling","produzione video","gestione comunità","monetizzazione contenuti"], avgSalaryMin: 18000, avgSalaryMax: 70000, growthRate: 0.13, automationRisk: "medium" as const, scalability: "high" as const, trend: "growing" as const, timeToAutonomy: "1-4 anni", advantages: ["alta creatività","audience globale","modalità ibride"], disadvantages: ["reddito instabile","saturazione contenuti"], opportunities: ["content creator","game designer","streaming producer"], icon: "play-circle", color: "#a855f7", workMode: ["dipendente","autonomo","ibrido"] as any, autonomyScore: 9, stabilityScore: 4 },
  { name: "Risorse Umane & People Ops", description: "Talent acquisition, HR business partner, employer branding, L&D e people analytics.", riasecTypes: ["S","E","C"], skills: ["recruiting","employer branding","HR analytics","sviluppo organizzativo"], avgSalaryMin: 22000, avgSalaryMax: 65000, growthRate: 0.10, automationRisk: "medium" as const, scalability: "medium" as const, trend: "growing" as const, timeToAutonomy: "3-5 anni", advantages: ["impatto sulle persone","trasversale a tutti i settori"], disadvantages: ["visto come cost center","burnout emotivo"], opportunities: ["CHRO","people analytics lead","organizational designer"], icon: "users", color: "#06b6d4", workMode: ["dipendente","ibrido"] as any, autonomyScore: 6, stabilityScore: 7 },
  { name: "Immobiliare & PropTech",     description: "Compravendita, property management, real estate investment e tecnologia immobiliare.", riasecTypes: ["E","C","R"], skills: ["valutazione immobiliare","contrattualistica","CRM","analisi investimenti"], avgSalaryMin: 18000, avgSalaryMax: 80000, growthRate: 0.07, automationRisk: "medium" as const, scalability: "medium" as const, trend: "stable" as const, timeToAutonomy: "2-4 anni", advantages: ["commissioni alte top-end","autonomia elevata","asset tangibili"], disadvantages: ["ciclicità mercato","networking-dipendente"], opportunities: ["real estate advisor","property manager","PropTech founder"], icon: "building-2", color: "#d97706", workMode: ["dipendente","autonomo"] as any, autonomyScore: 8, stabilityScore: 5 },
  { name: "Consulting & Management",    description: "Consulenza strategica, change management, project management e business transformation.", riasecTypes: ["E","I","C"], skills: ["problem solving strutturato","presentazioni executive","project management","analisi"], avgSalaryMin: 28000, avgSalaryMax: 110000, growthRate: 0.09, automationRisk: "low" as const, scalability: "medium" as const, trend: "stable" as const, timeToAutonomy: "4-6 anni", advantages: ["esposizione a molti settori","alta remunerazione","network forte"], disadvantages: ["ritmi intensi","viaggi frequenti"], opportunities: ["partner consulting","fractional COO","independent advisor"], icon: "briefcase", color: "#1d4ed8", workMode: ["dipendente","autonomo","ibrido"] as any, autonomyScore: 6, stabilityScore: 7 },
] as const;

// ── Professioni per settore ────────────────────────────────────────────────────

const PROFESSIONS: Array<{
  sectorName:    string;
  title:         string;
  description:   string;
  riasecFit:     string[];
  skills:        string[];
  salaryRange:   string;
  growthOutlook: string;
  autonomyScore: number;
  stabilityScore: number;
}> = [
  { sectorName: "Tecnologia & Software", title: "Software Developer", description: "Progetta e sviluppa applicazioni web, mobile e backend.", riasecFit: ["I","R","C"], skills: ["programmazione","testing","git","API design"], salaryRange: "28k-80k€/anno", growthOutlook: "Domanda molto alta, +15% entro 2027.", autonomyScore: 7, stabilityScore: 8 },
  { sectorName: "Tecnologia & Software", title: "DevOps / Platform Engineer", description: "Gestisce infrastrutture cloud, CI/CD pipeline e monitoring.", riasecFit: ["R","I","C"], skills: ["Kubernetes","Docker","Terraform","AWS/GCP"], salaryRange: "32k-90k€/anno", growthOutlook: "Domanda in forte crescita.", autonomyScore: 7, stabilityScore: 8 },
  { sectorName: "Tecnologia & Software", title: "Product Manager (Tech)", description: "Definisce la visione del prodotto, gestisce la roadmap.", riasecFit: ["E","I","S"], skills: ["user research","roadmap planning","analytics"], salaryRange: "35k-90k€/anno", growthOutlook: "Ruolo centrale in tutte le aziende tech.", autonomyScore: 8, stabilityScore: 7 },
  { sectorName: "Tecnologia & Software", title: "Cybersecurity Analyst", description: "Identifica vulnerabilità e gestisce incidenti di sicurezza.", riasecFit: ["I","C","R"], skills: ["penetration testing","SIEM","incident response"], salaryRange: "30k-85k€/anno", growthOutlook: "Crescita accelerata per cybercrime in aumento.", autonomyScore: 6, stabilityScore: 9 },
  { sectorName: "Tecnologia & Software", title: "QA / Test Engineer", description: "Garantisce la qualità del software tramite test automatizzati.", riasecFit: ["C","I","R"], skills: ["test automation","Selenium","CI/CD"], salaryRange: "24k-65k€/anno", growthOutlook: "Stabile, crescita in automazione test.", autonomyScore: 6, stabilityScore: 7 },

  { sectorName: "Marketing & Comunicazione", title: "Digital Marketing Manager", description: "Pianifica e gestisce campagne su Google, Meta, email, SEO.", riasecFit: ["E","A","C"], skills: ["Google Ads","Meta Ads","SEO","A/B testing"], salaryRange: "24k-60k€/anno", growthOutlook: "Stabile con spostamento verso AI-marketing.", autonomyScore: 7, stabilityScore: 6 },
  { sectorName: "Marketing & Comunicazione", title: "Content Creator / Copywriter", description: "Produce contenuti scritti, video, podcast per brand e media.", riasecFit: ["A","E","S"], skills: ["scrittura creativa","SEO","storytelling","video editing"], salaryRange: "18k-50k€/anno", growthOutlook: "Alta offerta, vince chi ha una nicchia.", autonomyScore: 9, stabilityScore: 4 },
  { sectorName: "Marketing & Comunicazione", title: "Growth Hacker", description: "Sperimenta canali e tattiche di acquisizione per crescere rapidamente.", riasecFit: ["I","E","C"], skills: ["funnel optimization","SQL","A/B test","product analytics"], salaryRange: "28k-70k€/anno", growthOutlook: "Molto richiesto in startup e scale-up.", autonomyScore: 8, stabilityScore: 5 },

  { sectorName: "Finanza & Investimenti", title: "Financial Analyst", description: "Analizza performance finanziarie e supporta decisioni di investimento.", riasecFit: ["C","I","E"], skills: ["Excel avanzato","modelli DCF","Bloomberg"], salaryRange: "28k-75k€/anno", growthOutlook: "Stabile, parziale automazione prevista.", autonomyScore: 5, stabilityScore: 8 },
  { sectorName: "Finanza & Investimenti", title: "Fintech Product Manager", description: "Gestisce prodotti finanziari digitali (app bancarie, pagamenti).", riasecFit: ["E","I","C"], skills: ["regulatory knowledge","UX","payment systems"], salaryRange: "35k-90k€/anno", growthOutlook: "Settore in rapida espansione.", autonomyScore: 8, stabilityScore: 7 },

  { sectorName: "Sanità & Life Sciences", title: "Clinical Research Associate", description: "Monitora trial clinici, garantisce conformità GCP.", riasecFit: ["I","C","S"], skills: ["GCP","ICH guidelines","data management"], salaryRange: "28k-60k€/anno", growthOutlook: "Forte crescita nel biotech.", autonomyScore: 5, stabilityScore: 8 },
  { sectorName: "Sanità & Life Sciences", title: "Health Data Scientist", description: "Analizza dati clinici per migliorare diagnosi e trattamenti.", riasecFit: ["I","C","R"], skills: ["Python","R","statistiche biomediche"], salaryRange: "30k-75k€/anno", growthOutlook: "Domanda in crescita con digitalizzazione sanità.", autonomyScore: 6, stabilityScore: 8 },

  { sectorName: "Istruzione & Formazione", title: "E-learning Designer", description: "Progetta corsi online e percorsi di formazione digitale.", riasecFit: ["A","S","C"], skills: ["Articulate","instructional design","LMS"], salaryRange: "22k-50k€/anno", growthOutlook: "In crescita con boom EdTech.", autonomyScore: 8, stabilityScore: 6 },
  { sectorName: "Istruzione & Formazione", title: "Corporate Trainer", description: "Progetta ed eroga formazione aziendale su soft e hard skill.", riasecFit: ["S","E","A"], skills: ["facilitazione","coaching","public speaking"], salaryRange: "24k-55k€/anno", growthOutlook: "Stabile con spostamento verso L&D strategico.", autonomyScore: 8, stabilityScore: 6 },

  { sectorName: "Design & UX", title: "UX Designer", description: "Progetta esperienze digitali centrate sull'utente.", riasecFit: ["A","I","S"], skills: ["Figma","user research","usability testing"], salaryRange: "26k-70k€/anno", growthOutlook: "Alta domanda in tutte le aziende digitali.", autonomyScore: 8, stabilityScore: 7 },
  { sectorName: "Design & UX", title: "Product Designer", description: "Combina UX e UI per definire l'interfaccia di prodotti digitali.", riasecFit: ["A","I","C"], skills: ["Figma","design system","prototipazione"], salaryRange: "28k-75k€/anno", growthOutlook: "Figura centrale nei team di prodotto.", autonomyScore: 8, stabilityScore: 7 },

  { sectorName: "Dati & Intelligenza Artificiale", title: "Data Scientist", description: "Costruisce modelli predittivi e analizza grandi dataset.", riasecFit: ["I","C","R"], skills: ["Python","machine learning","SQL","statistica"], salaryRange: "32k-90k€/anno", growthOutlook: "Domanda in forte crescita.", autonomyScore: 7, stabilityScore: 8 },
  { sectorName: "Dati & Intelligenza Artificiale", title: "Data Engineer", description: "Progetta pipeline di dati, data lake e architetture ETL.", riasecFit: ["R","I","C"], skills: ["Spark","Airflow","dbt","cloud data platforms"], salaryRange: "34k-90k€/anno", growthOutlook: "Pre-requisito per qualsiasi iniziativa AI.", autonomyScore: 7, stabilityScore: 8 },
  { sectorName: "Dati & Intelligenza Artificiale", title: "ML Engineer", description: "Porta modelli ML in produzione: training, deployment, monitoring.", riasecFit: ["I","R","C"], skills: ["MLflow","Docker","Python","LLM fine-tuning"], salaryRange: "38k-100k€/anno", growthOutlook: "Tra i ruoli più richiesti del decennio.", autonomyScore: 7, stabilityScore: 8 },
  { sectorName: "Dati & Intelligenza Artificiale", title: "AI Product Manager", description: "Gestisce prodotti basati su AI/ML, traduce esigenze business in feature.", riasecFit: ["E","I","C"], skills: ["comprensione ML","roadmap","user research"], salaryRange: "40k-100k€/anno", growthOutlook: "Ruolo emergente e molto richiesto.", autonomyScore: 8, stabilityScore: 7 },
  { sectorName: "Dati & Intelligenza Artificiale", title: "Business Intelligence Analyst", description: "Sviluppa dashboard e report per decisioni aziendali basate sui dati.", riasecFit: ["C","I","E"], skills: ["Power BI","Tableau","SQL","Excel"], salaryRange: "26k-65k€/anno", growthOutlook: "Stabile con automazione parziale.", autonomyScore: 6, stabilityScore: 7 },

  { sectorName: "E-commerce & Retail", title: "E-commerce Manager", description: "Gestisce la presenza online: catalogo, pricing, campagne, UX.", riasecFit: ["E","C","I"], skills: ["Shopify","Google Analytics","pricing","SEO"], salaryRange: "24k-60k€/anno", growthOutlook: "Stabile con crescita e-commerce globale.", autonomyScore: 7, stabilityScore: 6 },
  { sectorName: "E-commerce & Retail", title: "Category Manager", description: "Gestisce assortimento prodotti su marketplace, ottimizza listing.", riasecFit: ["C","E","I"], skills: ["Amazon Seller Central","analisi vendite","pricing"], salaryRange: "26k-60k€/anno", growthOutlook: "Crescita con espansione marketplace.", autonomyScore: 7, stabilityScore: 6 },

  { sectorName: "Legale & Compliance", title: "Data Protection Officer (DPO)", description: "Supervisiona la conformità GDPR e gestisce audit privacy.", riasecFit: ["C","I","S"], skills: ["GDPR","privacy by design","risk assessment"], salaryRange: "32k-75k€/anno", growthOutlook: "Obbligatorio per molte aziende, domanda stabile.", autonomyScore: 7, stabilityScore: 9 },
  { sectorName: "Legale & Compliance", title: "Legal Counsel (Startup/Tech)", description: "Gestisce contratti, IP, fundraising legale per aziende tech.", riasecFit: ["C","E","I"], skills: ["contratti","IP","startup law","M&A"], salaryRange: "35k-90k€/anno", growthOutlook: "Alta domanda con proliferazione startup.", autonomyScore: 7, stabilityScore: 8 },

  { sectorName: "Energia & Sostenibilità", title: "Sustainability Manager / ESG", description: "Definisce strategie di sostenibilità e reporting ESG.", riasecFit: ["I","E","S"], skills: ["ESG reporting","GHG accounting","supply chain sustainability"], salaryRange: "28k-70k€/anno", growthOutlook: "Forte crescita con normative EU (CSRD).", autonomyScore: 7, stabilityScore: 7 },
  { sectorName: "Energia & Sostenibilità", title: "Renewable Energy Project Manager", description: "Coordina lo sviluppo di impianti fotovoltaici ed eolici.", riasecFit: ["R","I","E"], skills: ["project management","permitting","financial modelling"], salaryRange: "30k-75k€/anno", growthOutlook: "Boom investimenti green in Europa.", autonomyScore: 6, stabilityScore: 7 },

  { sectorName: "Logistica & Supply Chain", title: "Supply Chain Manager", description: "Ottimizza il flusso di materiali dalla produzione al cliente.", riasecFit: ["C","R","E"], skills: ["ERP","lean","forecasting","gestione fornitori"], salaryRange: "28k-70k€/anno", growthOutlook: "Stabile con investimenti in resilienza.", autonomyScore: 6, stabilityScore: 7 },
  { sectorName: "Logistica & Supply Chain", title: "Procurement Specialist", description: "Gestisce acquisti strategici e negozia con fornitori.", riasecFit: ["C","E","R"], skills: ["negoziazione","contrattualistica","gestione RFQ"], salaryRange: "24k-60k€/anno", growthOutlook: "Stabile.", autonomyScore: 6, stabilityScore: 7 },

  { sectorName: "Media & Intrattenimento", title: "Game Designer", description: "Progetta meccaniche di gioco e sistemi di progressione.", riasecFit: ["A","I","E"], skills: ["level design","game mechanics","prototipazione","Unity/Unreal"], salaryRange: "22k-65k€/anno", growthOutlook: "Mercato gaming in espansione.", autonomyScore: 8, stabilityScore: 5 },
  { sectorName: "Media & Intrattenimento", title: "Podcast / Video Producer", description: "Produce contenuti audio/video per brand, media o creator.", riasecFit: ["A","E","S"], skills: ["audio editing","DaVinci Resolve","storytelling","distribuzione"], salaryRange: "18k-55k€/anno", growthOutlook: "Mercato creator in crescita.", autonomyScore: 9, stabilityScore: 4 },

  { sectorName: "Risorse Umane & People Ops", title: "Talent Acquisition Specialist", description: "Gestisce l'intero ciclo di recruiting: sourcing, screening, onboarding.", riasecFit: ["S","E","C"], skills: ["LinkedIn Recruiter","ATS","employer branding"], salaryRange: "22k-50k€/anno", growthOutlook: "Stabile con automazione sourcing.", autonomyScore: 7, stabilityScore: 7 },
  { sectorName: "Risorse Umane & People Ops", title: "People Analytics Manager", description: "Usa dati HR per supportare decisioni su engagement e turnover.", riasecFit: ["I","C","S"], skills: ["HR analytics","Python/R","HRIS"], salaryRange: "30k-65k€/anno", growthOutlook: "Ruolo in forte crescita.", autonomyScore: 7, stabilityScore: 7 },

  { sectorName: "Immobiliare & PropTech", title: "Real Estate Agent", description: "Intermedia compravendite e locazioni immobiliari.", riasecFit: ["E","S","C"], skills: ["valutazione immobiliare","negoziazione","CRM"], salaryRange: "18k-80k€/anno (commissioni)", growthOutlook: "Stabile con digitalizzazione crescente.", autonomyScore: 9, stabilityScore: 5 },
  { sectorName: "Immobiliare & PropTech", title: "Property Manager", description: "Gestisce portafoglio immobiliare (manutenzione, inquilini, compliance).", riasecFit: ["C","E","R"], skills: ["gestione contratti","manutenzione ordinaria","CRM"], salaryRange: "22k-50k€/anno", growthOutlook: "Stabile.", autonomyScore: 7, stabilityScore: 7 },

  { sectorName: "Consulting & Management", title: "Management Consultant", description: "Analizza processi aziendali e propone soluzioni strategiche.", riasecFit: ["E","I","C"], skills: ["problem solving strutturato","Excel","slide executive"], salaryRange: "30k-100k€/anno", growthOutlook: "Stabile con domanda in digital transformation.", autonomyScore: 6, stabilityScore: 7 },
  { sectorName: "Consulting & Management", title: "Project Manager (PMP)", description: "Pianifica ed esegue progetti complessi, gestisce budget e team.", riasecFit: ["C","E","S"], skills: ["MS Project","agile/scrum","risk management"], salaryRange: "28k-75k€/anno", growthOutlook: "Alta domanda trasversale a tutti i settori.", autonomyScore: 7, stabilityScore: 8 },
  { sectorName: "Consulting & Management", title: "Business Analyst", description: "Traduce esigenze di business in requisiti funzionali, fa da ponte tra business e IT.", riasecFit: ["I","C","E"], skills: ["BPMN","requirements elicitation","SQL"], salaryRange: "26k-65k€/anno", growthOutlook: "Stabile e trasversale.", autonomyScore: 7, stabilityScore: 8 },
  { sectorName: "Consulting & Management", title: "Fractional C-Level", description: "Offre expertise executive part-time a PMI e startup.", riasecFit: ["E","I","C"], skills: ["leadership","strategia","negoziazione","mentoring"], salaryRange: "50k-150k€/anno (autonomo)", growthOutlook: "Mercato emergente in forte crescita.", autonomyScore: 10, stabilityScore: 4 },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function upsertSector(s: typeof SECTORS[number]): Promise<number> {
  const [existing] = await db
    .select({ id: sectorsTable.id })
    .from(sectorsTable)
    .where(eq(sectorsTable.name, s.name))
    .limit(1);

  if (existing) {
    await db.update(sectorsTable).set({
      description:    s.description,
      riasecTypes:    s.riasecTypes as any,
      skills:         s.skills as any,
      avgSalaryMin:   s.avgSalaryMin,
      avgSalaryMax:   s.avgSalaryMax,
      growthRate:     s.growthRate,
      automationRisk: s.automationRisk,
      scalability:    s.scalability,
      trend:          s.trend,
      timeToAutonomy: s.timeToAutonomy,
      advantages:     s.advantages as any,
      disadvantages:  s.disadvantages as any,
      opportunities:  s.opportunities as any,
      icon:           s.icon,
      color:          s.color,
      workMode:       s.workMode as any,
      autonomyScore:  s.autonomyScore,
      stabilityScore: s.stabilityScore,
      updatedAt:      new Date(),
    }).where(eq(sectorsTable.id, existing.id));
    return existing.id;
  }

  const [inserted] = await db.insert(sectorsTable).values({
    name:           s.name,
    description:    s.description,
    riasecTypes:    s.riasecTypes as any,
    skills:         s.skills as any,
    avgSalaryMin:   s.avgSalaryMin,
    avgSalaryMax:   s.avgSalaryMax,
    growthRate:     s.growthRate,
    automationRisk: s.automationRisk,
    scalability:    s.scalability,
    trend:          s.trend,
    timeToAutonomy: s.timeToAutonomy,
    advantages:     s.advantages as any,
    disadvantages:  s.disadvantages as any,
    opportunities:  s.opportunities as any,
    icon:           s.icon,
    color:          s.color,
    workMode:       s.workMode as any,
    autonomyScore:  s.autonomyScore,
    stabilityScore: s.stabilityScore,
  }).returning({ id: sectorsTable.id });

  if (!inserted) {
    throw new Error(`Failed to insert sector: ${s.name}`);
  }

  return inserted.id;
}

async function upsertProfession(p: typeof PROFESSIONS[number], sectorId: number): Promise<void> {
  const [existing] = await db
    .select({ id: professionsTable.id })
    .from(professionsTable)
    .where(eq(professionsTable.title, p.title))
    .limit(1);

  if (existing) {
    await db.update(professionsTable).set({
      sector:        p.sectorName,
      sectorId,
      description:   p.description,
      riasecFit:     p.riasecFit as any,
      skills:        p.skills as any,
      salaryRange:   p.salaryRange,
      growthOutlook: p.growthOutlook,
      autonomyScore: p.autonomyScore,
      stabilityScore:p.stabilityScore,
      isActive:      true,
      updatedAt:     new Date(),
    }).where(eq(professionsTable.id, existing.id));
    return;
  }

  await db.insert(professionsTable).values({
    title:         p.title,
    sector:        p.sectorName,
    sectorId,
    description:   p.description,
    riasecFit:     p.riasecFit as any,
    skills:        p.skills as any,
    salaryRange:   p.salaryRange,
    growthOutlook: p.growthOutlook,
    autonomyScore: p.autonomyScore,
    stabilityScore:p.stabilityScore,
    isActive:      true,
    workModes:     [] as any,
  });
}

// ── Percorsi formativi ────────────────────────────────────────────────────────

const EDUCATION_PATHS = [
  { path: "Laurea Triennale in Informatica o Ingegneria del Software", type: "universitario" as const, duration: "3 anni", cost: "Gratuita con borsa / 1k-3k€/anno", steps: ["Matematica e logica di base","Programmazione (Python, Java)","Algoritmi e strutture dati","Reti e sistemi operativi","Progetto di tesi"], careerOutcomes: ["Software Developer","DevOps Engineer","Data Engineer"], sectorFit: ["Tecnologia & Software","Dati & Intelligenza Artificiale"] },
  { path: "Bootcamp Full-Stack Web Development (online o in-presenza)", type: "bootcamp" as const, duration: "12-20 settimane", cost: "5k-15k€ (spesso finanziabile o ISA)", steps: ["HTML, CSS e JavaScript base","React o Vue per il frontend","Node.js o Python per il backend","Database SQL e NoSQL","Progetto finale portfolio-ready"], careerOutcomes: ["Software Developer","Product Manager (Tech)"], sectorFit: ["Tecnologia & Software"] },
  { path: "Corso online Data Science (Coursera, edX, Kaggle)", type: "online" as const, duration: "6-12 mesi", cost: "0-500€ (audit gratuito su Coursera)", steps: ["Python fondamentali","Pandas e analisi dati","Statistica applicata","Machine Learning con scikit-learn","Progetto su dataset reale"], careerOutcomes: ["Data Scientist","Business Intelligence Analyst","ML Engineer"], sectorFit: ["Dati & Intelligenza Artificiale"] },
  { path: "MBA o Master in Business Administration", type: "universitario" as const, duration: "1-2 anni", cost: "10k-80k€ (dipende da università)", steps: ["Strategia aziendale","Finanza e contabilità","Marketing e vendite","Leadership e gestione team","Project finale / consulting project"], careerOutcomes: ["Management Consultant","Fractional C-Level","Financial Analyst"], sectorFit: ["Consulting & Management","Finanza & Investimenti"] },
  { path: "Certificazione Google Digital Marketing & E-commerce", type: "professionale" as const, duration: "6 mesi", cost: "Gratuita su Coursera", steps: ["Fondamenti di marketing digitale","SEO e SEM","Email marketing e analytics","E-commerce e retail","Certificazione finale"], careerOutcomes: ["Digital Marketing Manager","E-commerce Manager","Growth Hacker"], sectorFit: ["Marketing & Comunicazione","E-commerce & Retail"] },
  { path: "Percorso UX Design (Google UX Design Certificate o Interaction Design Foundation)", type: "online" as const, duration: "6-9 mesi", cost: "200-500€/anno abbonamento", steps: ["Ricerca utenti e personas","Wireframing e prototipazione","Testing con utenti","Figma avanzato","Portfolio con 3 case study"], careerOutcomes: ["UX Designer","Product Designer","Design Lead / Head of Design"], sectorFit: ["Design & UX"] },
  { path: "Corso ESG & Sostenibilità (Politecnico o provider specializzato)", type: "professionale" as const, duration: "3-6 mesi", cost: "2k-5k€", steps: ["Framework ESG (GRI, SASB, TCFD)","Carbon accounting e Scope 1/2/3","Rendicontazione non finanziaria (CSRD)","Engagement stakeholder","Progetto di sustainability report"], careerOutcomes: ["Sustainability Manager / ESG","Renewable Energy Project Manager"], sectorFit: ["Energia & Sostenibilità"] },
  { path: "Certificazione PMP (Project Management Professional)", type: "professionale" as const, duration: "3-6 mesi di studio + esame", cost: "500-800€ (esame + materiali)", steps: ["PMBOK Guide fondamenti","Agile e Scrum","Risk management","Budget e stakeholder management","Simulazioni esame PMP"], careerOutcomes: ["Project Manager (PMP)","Management Consultant","Supply Chain Manager"], sectorFit: ["Consulting & Management","Logistica & Supply Chain"] },
] as const;

async function upsertEducationPath(ep: typeof EDUCATION_PATHS[number]): Promise<number | null> {
  const [existing] = await db
    .select({ id: educationPathsTable.id })
    .from(educationPathsTable)
    .where(eq(educationPathsTable.path, ep.path))
    .limit(1);

  if (existing) {
    await db.update(educationPathsTable).set({
      type: ep.type, duration: ep.duration, cost: ep.cost,
      steps: ep.steps as any, careerOutcomes: ep.careerOutcomes as any,
      sectorFit: ep.sectorFit as any, isActive: true, updatedAt: new Date(),
    }).where(eq(educationPathsTable.id, existing.id));
    return existing.id;
  }

  const [inserted] = await db.insert(educationPathsTable).values({
    path: ep.path, type: ep.type, duration: ep.duration, cost: ep.cost,
    steps: ep.steps as any, careerOutcomes: ep.careerOutcomes as any,
    sectorFit: ep.sectorFit as any, isActive: true,
  }).returning({ id: educationPathsTable.id });
  return inserted?.id ?? null;
}

async function main() {
  console.log("🌱  Avvio seed catalog...");

  // Settori
  console.log(`📋  Inserisco/aggiorno ${SECTORS.length} settori...`);
  const sectorIdMap: Record<string, number> = {};
  for (const s of SECTORS) {
    const id = await upsertSector(s);
    sectorIdMap[s.name] = id;
    process.stdout.write(".");
  }
  console.log(`\n✅  Settori completati`);

  // Professioni
  console.log(`👔  Inserisco/aggiorno ${PROFESSIONS.length} professioni...`);
  let ok = 0; let skip = 0;
  for (const p of PROFESSIONS) {
    const sectorId = sectorIdMap[p.sectorName];
    if (!sectorId) { console.warn(`  ⚠️  Settore non trovato: ${p.sectorName}`); skip++; continue; }
    await upsertProfession(p, sectorId);
    ok++;
    process.stdout.write(".");
  }
  console.log(`\n✅  Professioni: ${ok} salvate, ${skip} saltate`);

  // Percorsi formativi
  console.log(`📚  Inserisco/aggiorno ${EDUCATION_PATHS.length} percorsi formativi...`);
  let epDone = 0;
  for (const ep of EDUCATION_PATHS) {
    const id = await upsertEducationPath(ep);
    if (id) { epDone++; process.stdout.write("."); }
  }
  console.log(`\n✅  Percorsi formativi: ${epDone} salvati`);

  // Profession → Education Paths mapping (by title e path)
  const PROF_EDU_LINKS: Array<{ professionTitle: string; pathName: string }> = [
    // Tecnologia & Software
    { professionTitle: "Software Developer",           pathName: "Laurea Triennale in Informatica o Ingegneria del Software" },
    { professionTitle: "Software Developer",           pathName: "Bootcamp Full-Stack Web Development (online o in-presenza)" },
    { professionTitle: "DevOps / Platform Engineer",   pathName: "Laurea Triennale in Informatica o Ingegneria del Software" },
    { professionTitle: "Product Manager (Tech)",       pathName: "Bootcamp Full-Stack Web Development (online o in-presenza)" },
    { professionTitle: "Product Manager (Tech)",       pathName: "MBA o Master in Business Administration" },
    { professionTitle: "Cybersecurity Analyst",        pathName: "Laurea Triennale in Informatica o Ingegneria del Software" },
    { professionTitle: "QA / Test Engineer",           pathName: "Bootcamp Full-Stack Web Development (online o in-presenza)" },
    // Dati & AI
    { professionTitle: "Data Scientist",               pathName: "Corso online Data Science (Coursera, edX, Kaggle)" },
    { professionTitle: "Machine Learning Engineer",    pathName: "Corso online Data Science (Coursera, edX, Kaggle)" },
    { professionTitle: "Business Intelligence Analyst",pathName: "Corso online Data Science (Coursera, edX, Kaggle)" },
    { professionTitle: "Data Engineer",                pathName: "Laurea Triennale in Informatica o Ingegneria del Software" },
    { professionTitle: "Data Engineer",                pathName: "Corso online Data Science (Coursera, edX, Kaggle)" },
    // Marketing & E-commerce
    { professionTitle: "Digital Marketing Manager",    pathName: "Certificazione Google Digital Marketing & E-commerce" },
    { professionTitle: "Growth Hacker",                pathName: "Certificazione Google Digital Marketing & E-commerce" },
    { professionTitle: "E-commerce Manager",           pathName: "Certificazione Google Digital Marketing & E-commerce" },
    // Design & UX
    { professionTitle: "UX Designer",                  pathName: "Percorso UX Design (Google UX Design Certificate o Interaction Design Foundation)" },
    { professionTitle: "Product Designer",             pathName: "Percorso UX Design (Google UX Design Certificate o Interaction Design Foundation)" },
    { professionTitle: "Design Lead / Head of Design", pathName: "Percorso UX Design (Google UX Design Certificate o Interaction Design Foundation)" },
    // Finance
    { professionTitle: "Financial Analyst",            pathName: "MBA o Master in Business Administration" },
    { professionTitle: "CFO / Direttore Finanziario",  pathName: "MBA o Master in Business Administration" },
    // Consulting & Management
    { professionTitle: "Management Consultant",        pathName: "MBA o Master in Business Administration" },
    { professionTitle: "Management Consultant",        pathName: "Certificazione PMP (Project Management Professional)" },
    { professionTitle: "Project Manager (PMP)",        pathName: "Certificazione PMP (Project Management Professional)" },
    // Energia & Sostenibilità
    { professionTitle: "Sustainability Manager / ESG", pathName: "Corso ESG & Sostenibilità (Politecnico o provider specializzato)" },
    { professionTitle: "Renewable Energy Project Manager", pathName: "Corso ESG & Sostenibilità (Politecnico o provider specializzato)" },
    { professionTitle: "Renewable Energy Project Manager", pathName: "Certificazione PMP (Project Management Professional)" },
    // Logistica
    { professionTitle: "Supply Chain Manager",         pathName: "Certificazione PMP (Project Management Professional)" },
  ];

  console.log(`🔗  Collego professioni ↔ percorsi formativi...`);
  let linksOk = 0; let linksSkip = 0;

  for (const link of PROF_EDU_LINKS) {
    const [prof] = await db
      .select({ id: professionsTable.id })
      .from(professionsTable)
      .where(eq(professionsTable.title, link.professionTitle))
      .limit(1);
    const [ep] = await db
      .select({ id: educationPathsTable.id })
      .from(educationPathsTable)
      .where(eq(educationPathsTable.path, link.pathName))
      .limit(1);

    if (!prof || !ep) { linksSkip++; continue; }

    // Idempotente: verifica se il link esiste già
    const [existing] = await db
      .select({ id: professionEducationPathsTable.id })
      .from(professionEducationPathsTable)
      .where(and(
        eq(professionEducationPathsTable.professionId, prof.id),
        eq(professionEducationPathsTable.educationPathId, ep.id),
      ))
      .limit(1);

    if (!existing) {
      await db.insert(professionEducationPathsTable).values({
        professionId:    prof.id,
        educationPathId: ep.id,
      });
    }
    linksOk++;
    process.stdout.write(".");
  }
  console.log(`\n✅  Link profession↔path: ${linksOk} creati/verificati, ${linksSkip} saltati (titolo non trovato)`);

  console.log("\n🎉  Seed completato!");
  console.log("👉  Prossimo passo: POST /api/admin/agents/backfill per generare gli embedding");
}

main().catch((err) => {
  console.error("❌  seed-catalog failed:", err);
  process.exit(1);
});
