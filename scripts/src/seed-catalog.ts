/**
 * seed-catalog.ts — popola sectors e professions con dati di base.
 *
 * IDEMPOTENTE: usa ON CONFLICT DO NOTHING su (name) per sectors
 * e su (title, sector_id) per professions.
 *
 * Eseguire con:
 *   pnpm --filter @workspace/scripts run seed:catalog
 *
 * Dopo aver popolato i dati, eseguire il backfill degli embedding:
 *   POST /api/admin/agents/backfill (x-admin-key richiesta)
 */

import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

// ── Dati settori ─────────────────────────────────────────────────────────────

const SECTORS = [
  {
    name: "Tecnologia & Software",
    description: "Sviluppo software, intelligenza artificiale, cloud, cybersecurity e prodotti digitali.",
    riasecTypes: ["I", "R", "C"],
    skills: ["programmazione", "problem solving", "algoritmi", "cloud", "sicurezza informatica"],
    avgSalaryMin: 30000, avgSalaryMax: 85000,
    growthRate: 0.18, automationRisk: "low", scalability: "high",
    trend: "booming", timeToAutonomy: "2-4 anni",
    advantages: ["alta domanda", "lavoro remoto diffuso", "alta retribuzione"],
    disadvantages: ["aggiornamento continuo richiesto", "burnout frequente"],
    opportunities: ["AI engineer", "cloud architect", "product manager tech"],
    icon: "cpu", color: "#6366f1",
    workMode: ["dipendente", "autonomo", "ibrido"],
    autonomyScore: 8, stabilityScore: 7,
  },
  {
    name: "Marketing & Comunicazione",
    description: "Marketing digitale, content strategy, brand management, SEO/SEM e social media.",
    riasecTypes: ["E", "A", "S"],
    skills: ["copywriting", "SEO", "analytics", "social media", "storytelling"],
    avgSalaryMin: 22000, avgSalaryMax: 60000,
    growthRate: 0.12, automationRisk: "medium", scalability: "high",
    trend: "growing", timeToAutonomy: "1-3 anni",
    advantages: ["creatività valorizzata", "settori diversi", "freelance possibile"],
    disadvantages: ["mercato affollato", "ROI difficile da misurare"],
    opportunities: ["growth hacker", "CMO", "content strategist"],
    icon: "megaphone", color: "#f59e0b",
    workMode: ["dipendente", "autonomo", "ibrido"],
    autonomyScore: 7, stabilityScore: 6,
  },
  {
    name: "Finanza & Investimenti",
    description: "Analisi finanziaria, gestione portafogli, trading, corporate finance e fintech.",
    riasecTypes: ["C", "I", "E"],
    skills: ["analisi dati", "Excel avanzato", "modelli finanziari", "diritto societario"],
    avgSalaryMin: 28000, avgSalaryMax: 120000,
    growthRate: 0.08, automationRisk: "medium", scalability: "medium",
    trend: "stable", timeToAutonomy: "4-7 anni",
    advantages: ["alta remunerazione top-end", "stabilità", "internazionale"],
    disadvantages: ["orari intensi", "stress elevato", "entrata difficile"],
    opportunities: ["CFO", "portfolio manager", "fintech consultant"],
    icon: "trending-up", color: "#10b981",
    workMode: ["dipendente", "ibrido"],
    autonomyScore: 5, stabilityScore: 8,
  },
  {
    name: "Sanità & Life Sciences",
    description: "Medicina clinica, farmaceutica, biotecnologie, salute mentale e dispositivi medici.",
    riasecTypes: ["I", "S", "R"],
    skills: ["ricerca clinica", "biologia", "regolatoria", "farmacologia"],
    avgSalaryMin: 25000, avgSalaryMax: 90000,
    growthRate: 0.15, automationRisk: "low", scalability: "low",
    trend: "booming", timeToAutonomy: "6-10 anni",
    advantages: ["missione elevata", "stabilità", "ricerca innovativa"],
    disadvantages: ["formazione lunghissima", "responsabilità alta"],
    opportunities: ["biotech researcher", "health data scientist", "regulatory affairs"],
    icon: "heart-pulse", color: "#ef4444",
    workMode: ["dipendente"],
    autonomyScore: 4, stabilityScore: 9,
  },
  {
    name: "Istruzione & Formazione",
    description: "Insegnamento, e-learning, coaching professionale, formazione aziendale e EdTech.",
    riasecTypes: ["S", "A", "E"],
    skills: ["didattica", "curriculum design", "coaching", "comunicazione"],
    avgSalaryMin: 18000, avgSalaryMax: 50000,
    growthRate: 0.10, automationRisk: "low", scalability: "high",
    trend: "growing", timeToAutonomy: "2-4 anni",
    advantages: ["impatto sociale", "flessibilità", "scalabile online"],
    disadvantages: ["bassa retribuzione base", "saturazione in alcuni segmenti"],
    opportunities: ["e-learning creator", "corporate trainer", "EdTech founder"],
    icon: "graduation-cap", color: "#8b5cf6",
    workMode: ["dipendente", "autonomo", "ibrido"],
    autonomyScore: 8, stabilityScore: 7,
  },
  {
    name: "Design & UX",
    description: "Product design, UX research, UI design, design system e service design.",
    riasecTypes: ["A", "I", "E"],
    skills: ["Figma", "ricerca utenti", "prototipazione", "design thinking"],
    avgSalaryMin: 25000, avgSalaryMax: 75000,
    growthRate: 0.14, automationRisk: "low", scalability: "high",
    trend: "growing", timeToAutonomy: "2-4 anni",
    advantages: ["creatività + logica", "remoto possibile", "portfolio misurabile"],
    disadvantages: ["feedback soggettivi", "tool in rapida evoluzione"],
    opportunities: ["head of design", "design lead", "UX researcher"],
    icon: "palette", color: "#f43f5e",
    workMode: ["dipendente", "autonomo", "ibrido"],
    autonomyScore: 8, stabilityScore: 7,
  },
  {
    name: "Dati & Intelligenza Artificiale",
    description: "Data science, machine learning, data engineering, analytics e AI applicata.",
    riasecTypes: ["I", "C", "R"],
    skills: ["Python", "SQL", "machine learning", "statistica", "visualizzazione dati"],
    avgSalaryMin: 32000, avgSalaryMax: 95000,
    growthRate: 0.25, automationRisk: "low", scalability: "high",
    trend: "booming", timeToAutonomy: "3-5 anni",
    advantages: ["domanda altissima", "stipendi elevati", "trasversale a tutti i settori"],
    disadvantages: ["competenze molto specifiche richieste", "dati di qualità rari"],
    opportunities: ["ML engineer", "data architect", "AI product manager"],
    icon: "bar-chart-2", color: "#0ea5e9",
    workMode: ["dipendente", "autonomo", "ibrido"],
    autonomyScore: 7, stabilityScore: 8,
  },
  {
    name: "E-commerce & Retail",
    description: "Vendite online, marketplace, supply chain digitale, customer experience e omnichannel.",
    riasecTypes: ["E", "C", "S"],
    skills: ["marketplace management", "pricing", "logistics", "customer care"],
    avgSalaryMin: 20000, avgSalaryMax: 65000,
    growthRate: 0.11, automationRisk: "high", scalability: "high",
    trend: "growing", timeToAutonomy: "1-3 anni",
    advantages: ["risultati misurabili", "scalabilità globale", "entry rapida"],
    disadvantages: ["margini bassi", "alta competizione", "automazione crescente"],
    opportunities: ["e-commerce manager", "marketplace strategist", "DTC founder"],
    icon: "shopping-cart", color: "#f97316",
    workMode: ["dipendente", "autonomo", "ibrido"],
    autonomyScore: 7, stabilityScore: 5,
  },
  {
    name: "Legale & Compliance",
    description: "Diritto societario, GDPR, contrattualistica, IP, regolamentazione finanziaria.",
    riasecTypes: ["C", "E", "I"],
    skills: ["diritto commerciale", "contratti", "privacy", "regulatory"],
    avgSalaryMin: 28000, avgSalaryMax: 100000,
    growthRate: 0.07, automationRisk: "medium", scalability: "medium",
    trend: "stable", timeToAutonomy: "5-8 anni",
    advantages: ["alta remunerazione", "stabilità", "expertise trasferibile"],
    disadvantages: ["percorso lungo", "aggiornamento normativo continuo"],
    opportunities: ["general counsel", "DPO", "legal tech consultant"],
    icon: "scale", color: "#64748b",
    workMode: ["dipendente", "autonomo"],
    autonomyScore: 6, stabilityScore: 9,
  },
  {
    name: "Energia & Sostenibilità",
    description: "Energie rinnovabili, ESG, efficienza energetica, economia circolare e green tech.",
    riasecTypes: ["I", "R", "E"],
    skills: ["ingegneria energetica", "ESG reporting", "project management", "normativa ambientale"],
    avgSalaryMin: 26000, avgSalaryMax: 80000,
    growthRate: 0.20, automationRisk: "low", scalability: "medium",
    trend: "booming", timeToAutonomy: "4-6 anni",
    advantages: ["impatto positivo", "incentivi governativi", "crescita strutturale"],
    disadvantages: ["dipendenza da politiche", "cicli d'investimento lunghi"],
    opportunities: ["ESG analyst", "solar project manager", "sustainability director"],
    icon: "leaf", color: "#22c55e",
    workMode: ["dipendente", "ibrido"],
    autonomyScore: 6, stabilityScore: 7,
  },
  {
    name: "Logistica & Supply Chain",
    description: "Gestione magazzini, import/export, procurement, last-mile delivery e ottimizzazione.",
    riasecTypes: ["C", "R", "E"],
    skills: ["ERP", "lean manufacturing", "procurement", "gestione fornitori"],
    avgSalaryMin: 22000, avgSalaryMax: 70000,
    growthRate: 0.09, automationRisk: "high", scalability: "medium",
    trend: "stable", timeToAutonomy: "3-5 anni",
    advantages: ["ruolo strategico crescente", "internazionale", "diversificato"],
    disadvantages: ["sotto pressione post-pandemia", "automazione logistica avanzata"],
    opportunities: ["supply chain director", "procurement manager", "logistics tech"],
    icon: "truck", color: "#78716c",
    workMode: ["dipendente"],
    autonomyScore: 4, stabilityScore: 7,
  },
  {
    name: "Media & Intrattenimento",
    description: "Produzione audiovisiva, streaming, gaming, podcasting, giornalismo digitale.",
    riasecTypes: ["A", "E", "S"],
    skills: ["storytelling", "produzione video", "gestione comunità", "monetizzazione contenuti"],
    avgSalaryMin: 18000, avgSalaryMax: 70000,
    growthRate: 0.13, automationRisk: "medium", scalability: "high",
    trend: "growing", timeToAutonomy: "1-4 anni",
    advantages: ["alta creatività", "audience globale potenziale", "modalità ibride"],
    disadvantages: ["reddito instabile all'inizio", "saturazione contenuti"],
    opportunities: ["content creator", "game designer", "streaming producer"],
    icon: "play-circle", color: "#a855f7",
    workMode: ["dipendente", "autonomo", "ibrido"],
    autonomyScore: 9, stabilityScore: 4,
  },
  {
    name: "Risorse Umane & People Ops",
    description: "Talent acquisition, HR business partner, employer branding, L&D e people analytics.",
    riasecTypes: ["S", "E", "C"],
    skills: ["recruiting", "employer branding", "HR analytics", "sviluppo organizzativo"],
    avgSalaryMin: 22000, avgSalaryMax: 65000,
    growthRate: 0.10, automationRisk: "medium", scalability: "medium",
    trend: "growing", timeToAutonomy: "3-5 anni",
    advantages: ["impatto sulle persone", "trasversale a tutti i settori"],
    disadvantages: ["spesso visto come cost center", "burnout emotivo possibile"],
    opportunities: ["CHRO", "people analytics lead", "organizational designer"],
    icon: "users", color: "#06b6d4",
    workMode: ["dipendente", "ibrido"],
    autonomyScore: 6, stabilityScore: 7,
  },
  {
    name: "Immobiliare & PropTech",
    description: "Compravendita, property management, real estate investment e tecnologia immobiliare.",
    riasecTypes: ["E", "C", "R"],
    skills: ["valutazione immobiliare", "contrattualistica", "CRM", "analisi investimenti"],
    avgSalaryMin: 18000, avgSalaryMax: 80000,
    growthRate: 0.07, automationRisk: "medium", scalability: "medium",
    trend: "stable", timeToAutonomy: "2-4 anni",
    advantages: ["commissioni alte top-end", "autonomia elevata", "asset tangibili"],
    disadvantages: ["ciclicità mercato", "entrata lenta", "networking-dipendente"],
    opportunities: ["real estate advisor", "property manager", "PropTech founder"],
    icon: "building-2", color: "#d97706",
    workMode: ["dipendente", "autonomo"],
    autonomyScore: 8, stabilityScore: 5,
  },
  {
    name: "Consulting & Management",
    description: "Consulenza strategica, change management, project management e business transformation.",
    riasecTypes: ["E", "I", "C"],
    skills: ["problem solving strutturato", "presentazioni executive", "project management", "analisi"],
    avgSalaryMin: 28000, avgSalaryMax: 110000,
    growthRate: 0.09, automationRisk: "low", scalability: "medium",
    trend: "stable", timeToAutonomy: "4-6 anni",
    advantages: ["esposizione a molti settori", "alta remunerazione", "network forte"],
    disadvantages: ["ritmi intensi", "viaggi frequenti", "identità lavorativa ansiogena"],
    opportunities: ["partner consulting firm", "fractional COO", "independent advisor"],
    icon: "briefcase", color: "#1d4ed8",
    workMode: ["dipendente", "autonomo", "ibrido"],
    autonomyScore: 6, stabilityScore: 7,
  },
] as const;

// ── Dati professioni ──────────────────────────────────────────────────────────

// Mappa name → placeholder id (risolto a runtime)
const PROFESSIONS = [
  // Tecnologia & Software
  { sectorName: "Tecnologia & Software", title: "Software Developer", description: "Progetta e sviluppa applicazioni web, mobile e backend. Lavora con linguaggi come Python, JavaScript, Java.", riasecFit: ["I","R","C"], skills: ["programmazione","testing","git","API design","debugging"], salaryRange: "28k-80k€/anno", growthOutlook: "Molto alta domanda, +15% entro 2027.", autonomyScore: 7, stabilityScore: 8 },
  { sectorName: "Tecnologia & Software", title: "DevOps / Platform Engineer", description: "Gestisce infrastrutture cloud, CI/CD pipeline, containerizzazione e monitoring.", riasecFit: ["R","I","C"], skills: ["Kubernetes","Docker","Terraform","AWS/GCP","Linux"], salaryRange: "32k-90k€/anno", growthOutlook: "Domanda in forte crescita.", autonomyScore: 7, stabilityScore: 8 },
  { sectorName: "Tecnologia & Software", title: "Product Manager (Tech)", description: "Definisce la visione del prodotto, coordina design e sviluppo, gestisce la roadmap.", riasecFit: ["E","I","S"], skills: ["user research","roadmap planning","analytics","comunicazione"], salaryRange: "35k-90k€/anno", growthOutlook: "Ruolo centrale in tutte le aziende tech.", autonomyScore: 8, stabilityScore: 7 },
  { sectorName: "Tecnologia & Software", title: "Cybersecurity Analyst", description: "Identifica vulnerabilità, gestisce incidenti di sicurezza, implementa policy di protezione.", riasecFit: ["I","C","R"], skills: ["penetration testing","SIEM","incident response","networking"], salaryRange: "30k-85k€/anno", growthOutlook: "Crescita accelerata per cybercrime in aumento.", autonomyScore: 6, stabilityScore: 9 },
  { sectorName: "Tecnologia & Software", title: "QA / Test Engineer", description: "Garantisce la qualità del software tramite test manuali e automatizzati.", riasecFit: ["C","I","R"], skills: ["test automation","Selenium","CI/CD","analisi bug"], salaryRange: "24k-65k€/anno", growthOutlook: "Stabile, con crescita in automazione test.", autonomyScore: 6, stabilityScore: 7 },

  // Marketing & Comunicazione
  { sectorName: "Marketing & Comunicazione", title: "Digital Marketing Manager", description: "Pianifica e gestisce campagne digitali su tutti i canali (Google, Meta, email, SEO).", riasecFit: ["E","A","C"], skills: ["Google Ads","Meta Ads","SEO","analytics","A/B testing"], salaryRange: "24k-60k€/anno", growthOutlook: "Stabile con spostamento verso AI-marketing.", autonomyScore: 7, stabilityScore: 6 },
  { sectorName: "Marketing & Comunicazione", title: "Content Creator / Copywriter", description: "Produce contenuti scritti, video, podcast per brand e media. Specializzato per SEO o social.", riasecFit: ["A","E","S"], skills: ["scrittura creativa","SEO","storytelling","video editing"], salaryRange: "18k-50k€/anno", growthOutlook: "Alta offerta, vince chi ha una nicchia.", autonomyScore: 9, stabilityScore: 4 },
  { sectorName: "Marketing & Comunicazione", title: "Growth Hacker", description: "Sperimenta canali e tattiche di acquisizione per crescere rapidamente con budget limitato.", riasecFit: ["I","E","C"], skills: ["funnel optimization","SQL","A/B test","product analytics"], salaryRange: "28k-70k€/anno", growthOutlook: "Molto richiesto in startup e scale-up.", autonomyScore: 8, stabilityScore: 5 },
  { sectorName: "Marketing & Comunicazione", title: "Brand Manager", description: "Gestisce l'identità e la reputazione di un brand, coordina campagne e posizionamento.", riasecFit: ["E","A","C"], skills: ["brand strategy","ricerca di mercato","comunicazione","project management"], salaryRange: "26k-65k€/anno", growthOutlook: "Stabile in grandi aziende.", autonomyScore: 6, stabilityScore: 7 },

  // Finanza & Investimenti
  { sectorName: "Finanza & Investimenti", title: "Financial Analyst", description: "Analizza performance finanziarie, costruisce modelli di valutazione, supporta decisioni di investimento.", riasecFit: ["C","I","E"], skills: ["Excel avanzato","modelli DCF","PowerPoint","Bloomberg"], salaryRange: "28k-75k€/anno", growthOutlook: "Stabile, parziale automazione prevista.", autonomyScore: 5, stabilityScore: 8 },
  { sectorName: "Finanza & Investimenti", title: "Investment Analyst (VC/PE)", description: "Valuta startup o aziende per fondi di venture capital o private equity.", riasecFit: ["I","E","C"], skills: ["due diligence","valutazione startup","pitch analysis","networking"], salaryRange: "35k-100k€/anno", growthOutlook: "Selettivo ma ben retribuito.", autonomyScore: 7, stabilityScore: 6 },
  { sectorName: "Finanza & Investimenti", title: "Fintech Product Manager", description: "Gestisce prodotti finanziari digitali (app bancarie, pagamenti, cripto, insurance).", riasecFit: ["E","I","C"], skills: ["regulatory knowledge","UX","payment systems","agile"], salaryRange: "35k-90k€/anno", growthOutlook: "Settore in rapida espansione.", autonomyScore: 8, stabilityScore: 7 },

  // Sanità & Life Sciences
  { sectorName: "Sanità & Life Sciences", title: "Clinical Research Associate", description: "Monitora trial clinici, garantisce conformità ai protocolli GCP e agli standard regolatori.", riasecFit: ["I","C","S"], skills: ["GCP","ICH guidelines","data management","reportistica"], salaryRange: "28k-60k€/anno", growthOutlook: "Forte crescita nel biotech.", autonomyScore: 5, stabilityScore: 8 },
  { sectorName: "Sanità & Life Sciences", title: "Health Data Scientist", description: "Analizza dati clinici e di popolazione per migliorare diagnosi, trattamenti e politiche sanitarie.", riasecFit: ["I","C","R"], skills: ["Python","R","statistiche biomediche","EHR data"], salaryRange: "30k-75k€/anno", growthOutlook: "Domanda in crescita con digitalizzazione sanità.", autonomyScore: 6, stabilityScore: 8 },

  // Istruzione & Formazione
  { sectorName: "Istruzione & Formazione", title: "E-learning Designer", description: "Progetta corsi online, materiali didattici interattivi e percorsi di formazione digitale.", riasecFit: ["A","S","C"], skills: ["Articulate","instructional design","LMS","video production"], salaryRange: "22k-50k€/anno", growthOutlook: "In crescita con boom EdTech.", autonomyScore: 8, stabilityScore: 6 },
  { sectorName: "Istruzione & Formazione", title: "Corporate Trainer", description: "Progetta ed eroga formazione aziendale su soft skill, leadership e competenze tecniche.", riasecFit: ["S","E","A"], skills: ["facilitazione","curriculum design","coaching","public speaking"], salaryRange: "24k-55k€/anno", growthOutlook: "Stabile con spostamento verso L&D strategico.", autonomyScore: 8, stabilityScore: 6 },

  // Design & UX
  { sectorName: "Design & UX", title: "UX Designer", description: "Progetta esperienze digitali centrate sull'utente: ricerca, wireframe, prototipazione, test.", riasecFit: ["A","I","S"], skills: ["Figma","user research","usability testing","information architecture"], salaryRange: "26k-70k€/anno", growthOutlook: "Alta domanda in tutte le aziende digitali.", autonomyScore: 8, stabilityScore: 7 },
  { sectorName: "Design & UX", title: "Product Designer", description: "Combina UX e UI per definire l'interfaccia e il flusso di prodotti digitali.", riasecFit: ["A","I","C"], skills: ["Figma","design system","prototipazione","collaborazione cross-team"], salaryRange: "28k-75k€/anno", growthOutlook: "Figura centrale nei team di prodotto.", autonomyScore: 8, stabilityScore: 7 },
  { sectorName: "Design & UX", title: "Design Lead / Head of Design", description: "Guida il team di design, definisce la strategia visiva e collabora con C-level.", riasecFit: ["A","E","I"], skills: ["design leadership","strategia prodotto","mentoring","visual thinking"], salaryRange: "45k-95k€/anno", growthOutlook: "Ruolo senior stabile.", autonomyScore: 9, stabilityScore: 7 },

  // Dati & Intelligenza Artificiale
  { sectorName: "Dati & Intelligenza Artificiale", title: "Data Scientist", description: "Costruisce modelli predittivi e analizza grandi dataset per estrarre insight di business.", riasecFit: ["I","C","R"], skills: ["Python","machine learning","SQL","visualizzazione","statistica"], salaryRange: "32k-90k€/anno", growthOutlook: "Domanda in forte crescita.", autonomyScore: 7, stabilityScore: 8 },
  { sectorName: "Dati & Intelligenza Artificiale", title: "Data Engineer", description: "Progetta e mantiene pipeline di dati, data lake, warehouse e architetture ETL.", riasecFit: ["R","I","C"], skills: ["Spark","Airflow","dbt","cloud data platforms","SQL"], salaryRange: "34k-90k€/anno", growthOutlook: "Pre-requisito per qualsiasi iniziativa AI.", autonomyScore: 7, stabilityScore: 8 },
  { sectorName: "Dati & Intelligenza Artificiale", title: "ML Engineer", description: "Porta i modelli ML in produzione: training, deployment, monitoring e ottimizzazione.", riasecFit: ["I","R","C"], skills: ["MLflow","Docker","Python","LLM fine-tuning","system design"], salaryRange: "38k-100k€/anno", growthOutlook: "Tra i ruoli più richiesti del decennio.", autonomyScore: 7, stabilityScore: 8 },
  { sectorName: "Dati & Intelligenza Artificiale", title: "AI Product Manager", description: "Gestisce prodotti basati su AI/ML, traduce esigenze business in feature tecniche.", riasecFit: ["E","I","C"], skills: ["comprensione ML","roadmap","user research","metriche AI"], salaryRange: "40k-100k€/anno", growthOutlook: "Ruolo emergente e molto richiesto.", autonomyScore: 8, stabilityScore: 7 },
  { sectorName: "Dati & Intelligenza Artificiale", title: "Business Intelligence Analyst", description: "Sviluppa dashboard e report per supportare decisioni aziendali basate sui dati.", riasecFit: ["C","I","E"], skills: ["Power BI","Tableau","SQL","Excel","storytelling dati"], salaryRange: "26k-65k€/anno", growthOutlook: "Stabile con automazione parziale.", autonomyScore: 6, stabilityScore: 7 },

  // E-commerce & Retail
  { sectorName: "E-commerce & Retail", title: "E-commerce Manager", description: "Gestisce la presenza online di un brand: catalogo, pricing, campagne, UX e conversioni.", riasecFit: ["E","C","I"], skills: ["Shopify/WooCommerce","Google Analytics","pricing","SEO e-commerce"], salaryRange: "24k-60k€/anno", growthOutlook: "Stabile con crescita e-commerce globale.", autonomyScore: 7, stabilityScore: 6 },
  { sectorName: "E-commerce & Retail", title: "Category Manager", description: "Gestisce l'assortimento prodotti su marketplace (Amazon, ecc.), ottimizza listing e vendor.", riasecFit: ["C","E","I"], skills: ["Amazon Seller Central","analisi vendite","pricing","negoziazione"], salaryRange: "26k-60k€/anno", growthOutlook: "Crescita con espansione marketplace.", autonomyScore: 7, stabilityScore: 6 },

  // Legale & Compliance
  { sectorName: "Legale & Compliance", title: "Data Protection Officer (DPO)", description: "Supervisiona la conformità GDPR, gestisce richieste degli interessati e audit privacy.", riasecFit: ["C","I","S"], skills: ["GDPR","privacy by design","risk assessment","formazione"], salaryRange: "32k-75k€/anno", growthOutlook: "Obbligatorio per molte aziende, domanda stabile.", autonomyScore: 7, stabilityScore: 9 },
  { sectorName: "Legale & Compliance", title: "Legal Counsel (Startup/Tech)", description: "Gestisce contratti, IP, fundraising legale e compliance per aziende tech.", riasecFit: ["C","E","I"], skills: ["contratti","IP","startup law","M&A","investor relations"], salaryRange: "35k-90k€/anno", growthOutlook: "Alta domanda con proliferazione startup.", autonomyScore: 7, stabilityScore: 8 },

  // Energia & Sostenibilità
  { sectorName: "Energia & Sostenibilità", title: "Sustainability Manager / ESG", description: "Definisce e implementa strategie di sostenibilità, reporting ESG e riduzione carbon footprint.", riasecFit: ["I","E","S"], skills: ["ESG reporting","GHG accounting","supply chain sustainability","stakeholder management"], salaryRange: "28k-70k€/anno", growthOutlook: "Forte crescita con normative EU (CSRD).", autonomyScore: 7, stabilityScore: 7 },
  { sectorName: "Energia & Sostenibilità", title: "Renewable Energy Project Manager", description: "Coordina lo sviluppo di impianti fotovoltaici, eolici e di accumulo energetico.", riasecFit: ["R","I","E"], skills: ["project management","permitting","financial modelling","ingegneria energetica"], salaryRange: "30k-75k€/anno", growthOutlook: "Boom investimenti green in Europa.", autonomyScore: 6, stabilityScore: 7 },

  // Logistica & Supply Chain
  { sectorName: "Logistica & Supply Chain", title: "Supply Chain Manager", description: "Ottimizza il flusso di materiali e informazioni dalla produzione al cliente finale.", riasecFit: ["C","R","E"], skills: ["ERP","lean","forecasting","gestione fornitori","negoziazione"], salaryRange: "28k-70k€/anno", growthOutlook: "Stabile con investimenti in resilienza.", autonomyScore: 6, stabilityScore: 7 },
  { sectorName: "Logistica & Supply Chain", title: "Procurement Specialist", description: "Gestisce acquisti strategici, negozia con fornitori e ottimizza i costi di approvvigionamento.", riasecFit: ["C","E","R"], skills: ["negoziazione","contrattualistica","analisi spend","gestione RFQ"], salaryRange: "24k-60k€/anno", growthOutlook: "Stabile.", autonomyScore: 6, stabilityScore: 7 },

  // Media & Intrattenimento
  { sectorName: "Media & Intrattenimento", title: "Game Designer", description: "Progetta meccaniche di gioco, livelli e sistemi di progressione per videogiochi.", riasecFit: ["A","I","E"], skills: ["level design","game mechanics","prototipazione","Unity/Unreal"], salaryRange: "22k-65k€/anno", growthOutlook: "Mercato gaming in espansione.", autonomyScore: 8, stabilityScore: 5 },
  { sectorName: "Media & Intrattenimento", title: "Podcast / Video Producer", description: "Produce contenuti audio/video per brand, media o creator. Gestisce pre/post produzione.", riasecFit: ["A","E","S"], skills: ["audio editing","DaVinci Resolve","storytelling","distribuzione"], salaryRange: "18k-55k€/anno", growthOutlook: "Mercato creator in crescita.", autonomyScore: 9, stabilityScore: 4 },

  // Risorse Umane
  { sectorName: "Risorse Umane & People Ops", title: "Talent Acquisition Specialist", description: "Gestisce l'intero ciclo di recruiting: sourcing, screening, colloqui e onboarding.", riasecFit: ["S","E","C"], skills: ["LinkedIn Recruiter","ATS","employer branding","colloqui strutturati"], salaryRange: "22k-50k€/anno", growthOutlook: "Stabile con automazione sourcing.", autonomyScore: 7, stabilityScore: 7 },
  { sectorName: "Risorse Umane & People Ops", title: "People Analytics Manager", description: "Usa dati HR per supportare decisioni su engagement, turnover e performance.", riasecFit: ["I","C","S"], skills: ["HR analytics","Python/R","HRIS","storytelling dati"], salaryRange: "30k-65k€/anno", growthOutlook: "Ruolo in forte crescita.", autonomyScore: 7, stabilityScore: 7 },

  // Immobiliare
  { sectorName: "Immobiliare & PropTech", title: "Real Estate Agent", description: "Intermedia compravendite e locazioni immobiliari, gestisce relazioni con clienti e banche.", riasecFit: ["E","S","C"], skills: ["valutazione immobiliare","negoziazione","CRM","mutui"], salaryRange: "18k-80k€/anno (commissioni)", growthOutlook: "Stabile con digitalizzazione crescente.", autonomyScore: 9, stabilityScore: 5 },
  { sectorName: "Immobiliare & PropTech", title: "Property Manager", description: "Gestisce portafoglio immobiliare (manutenzione, inquilini, rendicontazione, compliance).", riasecFit: ["C","E","R"], skills: ["gestione contratti","manutenzione ordinaria","contabilità","CRM"], salaryRange: "22k-50k€/anno", growthOutlook: "Stabile.", autonomyScore: 7, stabilityScore: 7 },

  // Consulting
  { sectorName: "Consulting & Management", title: "Management Consultant", description: "Analizza processi aziendali e propone soluzioni strategiche a clienti corporate.", riasecFit: ["E","I","C"], skills: ["problem solving strutturato","Excel","slide executive","project management"], salaryRange: "30k-100k€/anno", growthOutlook: "Stabile con domanda in digital transformation.", autonomyScore: 6, stabilityScore: 7 },
  { sectorName: "Consulting & Management", title: "Project Manager (PMP)", description: "Pianifica, esegue e monitora progetti complessi, gestisce budget, team e stakeholder.", riasecFit: ["C","E","S"], skills: ["MS Project","agile/scrum","risk management","budget management"], salaryRange: "28k-75k€/anno", growthOutlook: "Alta domanda trasversale a tutti i settori.", autonomyScore: 7, stabilityScore: 8 },
  { sectorName: "Consulting & Management", title: "Business Analyst", description: "Traduce esigenze di business in requisiti funzionali, fa da ponte tra business e IT.", riasecFit: ["I","C","E"], skills: ["BPMN","requirements elicitation","SQL","analisi as-is/to-be"], salaryRange: "26k-65k€/anno", growthOutlook: "Stabile e trasversale.", autonomyScore: 7, stabilityScore: 8 },
  { sectorName: "Consulting & Management", title: "Fractional C-Level", description: "Offre expertise executive (CTO, CFO, CMO) part-time a PMI e startup che non possono permettersi un C-level fisso.", riasecFit: ["E","I","C"], skills: ["leadership","strategia","negoziazione","mentoring"], salaryRange: "50k-150k€/anno (autonomo)", growthOutlook: "Mercato emergente in forte crescita.", autonomyScore: 10, stabilityScore: 4 },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Avvio seed catalog...");

  // 1. Upsert settori
  console.log(`📋  Inserisco ${SECTORS.length} settori...`);
  for (const sector of SECTORS) {
    await db.execute(sql`
      INSERT INTO sectors (
        name, description, riasec_types, skills,
        avg_salary_min, avg_salary_max, growth_rate,
        automation_risk, scalability, trend, time_to_autonomy,
        advantages, disadvantages, opportunities,
        icon, color, work_mode, autonomy_score, stability_score
      ) VALUES (
        ${sector.name}, ${sector.description},
        ${JSON.stringify(sector.riasecTypes)}::jsonb,
        ${JSON.stringify(sector.skills)}::jsonb,
        ${sector.avgSalaryMin}, ${sector.avgSalaryMax}, ${sector.growthRate},
        ${sector.automationRisk}, ${sector.scalability}, ${sector.trend},
        ${sector.timeToAutonomy},
        ${JSON.stringify(sector.advantages)}::jsonb,
        ${JSON.stringify(sector.disadvantages)}::jsonb,
        ${JSON.stringify(sector.opportunities)}::jsonb,
        ${sector.icon}, ${sector.color},
        ${JSON.stringify(sector.workMode)}::jsonb,
        ${sector.autonomyScore}, ${sector.stabilityScore}
      )
      ON CONFLICT (name) DO UPDATE SET
        description      = EXCLUDED.description,
        growth_rate      = EXCLUDED.growth_rate,
        trend            = EXCLUDED.trend,
        updated_at       = NOW()
    `);
  }
  console.log("✅  Settori inseriti");

  // 2. Upsert professioni
  console.log(`👔  Inserisco ${PROFESSIONS.length} professioni...`);
  for (const prof of PROFESSIONS) {
    // Recupera sector_id dal nome
    const sectorRes = await db.execute<{ id: number }>(
      sql`SELECT id FROM sectors WHERE name = ${prof.sectorName} LIMIT 1`
    );
    const sectorId = sectorRes.rows[0]?.id;
    if (!sectorId) {
      console.warn(`⚠️   Settore non trovato: ${prof.sectorName}, skip ${prof.title}`);
      continue;
    }

    await db.execute(sql`
      INSERT INTO professions (
        title, sector, sector_id, description,
        riasec_fit, skills, salary_range, growth_outlook,
        autonomy_score, stability_score, is_active
      ) VALUES (
        ${prof.title}, ${prof.sectorName}, ${sectorId}, ${prof.description},
        ${JSON.stringify(prof.riasecFit)}, ${JSON.stringify(prof.skills)},
        ${prof.salaryRange}, ${prof.growthOutlook},
        ${prof.autonomyScore}, ${prof.stabilityScore}, true
      )
      ON CONFLICT (title, sector_id) DO UPDATE SET
        description    = EXCLUDED.description,
        growth_outlook = EXCLUDED.growth_outlook,
        is_active      = true
    `);
  }
  console.log("✅  Professioni inserite");

  console.log("🎉  Seed catalog completato!");
  console.log("👉  Ora esegui il backfill embeddings: POST /api/admin/agents/backfill");
}

main().catch((err) => {
  console.error("❌  seed-catalog failed:", err);
  process.exit(1);
});
