import { db, sectorsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const SECTORS = [
  {
    name: "Tecnologia & Digitale",
    description:
      "Sviluppo software, piattaforme digitali, cloud, automazione e prodotti digitali. Un settore in costante evoluzione che offre opportunità globali e alta scalabilità.",
    riasecTypes: ["I", "R", "C"],
    skills: ["Programmazione", "Problem solving", "Pensiero logico", "Apprendimento continuo", "Architettura software"],
    avgSalaryMin: 35000,
    avgSalaryMax: 120000,
    growthRate: 28,
    automationRisk: "low" as const,
    scalability: "high" as const,
    trend: "booming" as const,
    timeToAutonomy: "12-24 mesi con formazione intensiva",
    advantages: [
      "Altissima domanda globale",
      "Possibilità di lavorare da remoto",
      "Stipendi competitivi",
      "Crescita rapida di carriera",
    ],
    disadvantages: [
      "Aggiornamento continuo necessario",
      "Alta competitività",
      "Rischio saturazione entry-level",
    ],
    opportunities: ["AI Engineer", "Full Stack Developer", "Product Manager", "DevOps Engineer", "No-code Specialist"],
    icon: "code",
    color: "#6366f1",
  },
  {
    name: "Cybersecurity",
    description:
      "Protezione di sistemi, reti, dati e infrastrutture digitali. Settore in crescita costante con forte domanda di professionisti affidabili e alta utilità strategica.",
    riasecTypes: ["I", "C", "R"],
    skills: ["Analisi delle minacce", "Penetration testing", "Risk management", "Compliance", "Precisione"],
    avgSalaryMin: 40000,
    avgSalaryMax: 130000,
    growthRate: 32,
    automationRisk: "low" as const,
    scalability: "high" as const,
    trend: "booming" as const,
    timeToAutonomy: "12-18 mesi con certificazioni OSCP/CompTIA",
    advantages: [
      "Domanda in forte crescita",
      "Stipendi molto elevati",
      "Alta importanza strategica",
      "Possibilità remote work",
    ],
    disadvantages: [
      "Stress elevato",
      "Certificazioni spesso costose",
      "Responsabilità alta",
    ],
    opportunities: ["SOC Analyst", "Ethical Hacker", "Penetration Tester", "Security Architect", "Incident Response Specialist"],
    icon: "shield",
    color: "#ef4444",
  },
  {
    name: "Data & Analytics",
    description:
      "Analisi dati, business intelligence, data science e data engineering. Settore utile per decisioni basate sui numeri, in crescita con la trasformazione digitale.",
    riasecTypes: ["I", "C", "R"],
    skills: ["SQL", "Python", "Statistica", "Visualizzazione dati", "Machine learning"],
    avgSalaryMin: 32000,
    avgSalaryMax: 110000,
    growthRate: 25,
    automationRisk: "low" as const,
    scalability: "high" as const,
    trend: "booming" as const,
    timeToAutonomy: "12-24 mesi con portfolio dati",
    advantages: [
      "Alta domanda trasversale",
      "Base per ruoli AI avanzati",
      "Buona retribuzione",
      "Applicabile in tutti i settori",
    ],
    disadvantages: [
      "Rischio di ruoli ripetitivi",
      "Necessità di forte precisione",
      "Formazione tecnica richiesta",
    ],
    opportunities: ["Data Analyst", "Data Scientist", "BI Analyst", "Data Engineer", "Analytics Consultant"],
    icon: "bar-chart-2",
    color: "#0ea5e9",
  },
  {
    name: "Fintech",
    description:
      "Finanza digitale, pagamenti innovativi, banking tecnologico e wealth tech. Unisce tecnologia e finanza con forte potenziale di scalabilità e prodotto ad alto valore.",
    riasecTypes: ["E", "I", "C"],
    skills: ["Analisi finanziaria", "Conoscenza prodotti finanziari", "UX per finanza", "Blockchain", "Risk analysis"],
    avgSalaryMin: 38000,
    avgSalaryMax: 140000,
    growthRate: 22,
    automationRisk: "medium" as const,
    scalability: "high" as const,
    trend: "booming" as const,
    timeToAutonomy: "12-24 mesi con esperienza banking/tech",
    advantages: [
      "Settore ad alto valore",
      "Forte innovazione",
      "Stipendi competitivi",
      "Scalabilità dei prodotti",
    ],
    disadvantages: [
      "Regolamentazione forte",
      "Mercato sensibile a cicli economici",
      "Richiede precisione elevata",
    ],
    opportunities: ["Fintech Product Manager", "Blockchain Developer", "Risk Analyst", "ESG Finance Specialist", "Robo-advisor Specialist"],
    icon: "credit-card",
    color: "#8b5cf6",
  },
  {
    name: "Green Economy & Sostenibilità",
    description:
      "Rinnovabili, efficienza energetica, ESG, economia circolare e transizione ecologica. Settore strategico nel medio-lungo periodo con forte attenzione agli investimenti pubblici.",
    riasecTypes: ["R", "I", "S"],
    skills: ["Analisi energetica", "Normativa ESG", "Gestione progetti", "Sostenibilità", "Reporting ambientale"],
    avgSalaryMin: 30000,
    avgSalaryMax: 95000,
    growthRate: 20,
    automationRisk: "low" as const,
    scalability: "medium" as const,
    trend: "booming" as const,
    timeToAutonomy: "12-24 mesi con certificazioni green",
    advantages: [
      "Impatto reale e misurabile",
      "Supporto politico e finanziario",
      "Crescita di lungo periodo",
      "Alta coerenza etica",
    ],
    disadvantages: [
      "Dipendenza da incentivi e normative",
      "Mercato ancora disomogeneo",
      "Lunghi cicli decisionali",
    ],
    opportunities: ["Sustainability Manager", "ESG Consultant", "Energy Analyst", "Renewables Engineer", "Carbon Analyst"],
    icon: "leaf",
    color: "#22c55e",
  },
  {
    name: "Sanità & Healthcare Digitale",
    description:
      "Telemedicina, salute digitale, biotecnologie e servizi per il benessere. Settore ad alta rilevanza sociale con forte domanda e impatto su una società che invecchia.",
    riasecTypes: ["S", "I", "R"],
    skills: ["Empatia", "Conoscenze mediche", "Analisi clinica", "Comunicazione", "Gestione dati sanitari"],
    avgSalaryMin: 30000,
    avgSalaryMax: 150000,
    growthRate: 18,
    automationRisk: "low" as const,
    scalability: "medium" as const,
    trend: "growing" as const,
    timeToAutonomy: "3-6 anni (percorso formativo incluso)",
    advantages: [
      "Impatto sociale enorme",
      "Sicurezza occupazionale",
      "Varietà di specializzazioni",
      "Crescita costante",
    ],
    disadvantages: [
      "Formazione lunga e costosa",
      "Alto stress emotivo",
      "Regole forti e responsabilità",
    ],
    opportunities: ["Digital Health Specialist", "Telemedicine Coordinator", "Health Data Analyst", "Biotech PM", "Wellness Coach"],
    icon: "heart",
    color: "#ec4899",
  },
  {
    name: "Istruzione & Formazione",
    description:
      "Scuole, piattaforme educative, orientamento, tutoraggio e formazione aziendale. Per chi vuole trasmettere conoscenza e aiutare gli altri a crescere, anche in formato digitale e scalabile.",
    riasecTypes: ["S", "A", "E"],
    skills: ["Comunicazione", "Empatia", "Progettazione didattica", "Creatività", "Facilitazione"],
    avgSalaryMin: 22000,
    avgSalaryMax: 80000,
    growthRate: 14,
    automationRisk: "low" as const,
    scalability: "medium" as const,
    trend: "growing" as const,
    timeToAutonomy: "1-2 anni con certificazioni",
    advantages: [
      "Impatto duraturo sulle persone",
      "Alta stabilità lavorativa",
      "Varietà di contesti operativi",
      "Mercato edtech in espansione",
    ],
    disadvantages: [
      "Stipendi pubblici spesso bassi",
      "Alto investimento emotivo",
      "Budget spesso limitati",
    ],
    opportunities: ["Instructional Designer", "EdTech Specialist", "Career Advisor", "Training Manager", "Learning Experience Designer"],
    icon: "book-open",
    color: "#3b82f6",
  },
  {
    name: "Marketing & Growth",
    description:
      "Branding, advertising, crescita utenti, contenuti, social e performance marketing. Settore dinamico e creativo, altamente scalabile se collegato a prodotti digitali.",
    riasecTypes: ["A", "E", "S"],
    skills: ["Creatività", "Analisi dati", "Copywriting", "SEO/SEM", "Strategia di crescita"],
    avgSalaryMin: 25000,
    avgSalaryMax: 100000,
    growthRate: 16,
    automationRisk: "medium" as const,
    scalability: "high" as const,
    trend: "growing" as const,
    timeToAutonomy: "6-12 mesi con portfolio",
    advantages: [
      "Alta soddisfazione creativa",
      "Velocità di impatto",
      "Forte domanda nei prodotti digitali",
      "Possibilità freelance",
    ],
    disadvantages: [
      "Forte competizione",
      "Metriche in continuo cambiamento",
      "Rischio saturazione in alcuni ruoli",
    ],
    opportunities: ["Growth Marketer", "Brand Strategist", "Content Strategist", "Performance Marketer", "Demand Gen Specialist"],
    icon: "trending-up",
    color: "#f59e0b",
  },
  {
    name: "E-commerce & Retail Digitale",
    description:
      "Vendita online, marketplace, D2C, operations digitali e customer journey. Collega marketing, prodotto, logistica e dati in un ecosistema scalabile e misurabile.",
    riasecTypes: ["E", "A", "C"],
    skills: ["Gestione catalogo", "CRM", "Analytics e-commerce", "UX commerciale", "Logistica digitale"],
    avgSalaryMin: 25000,
    avgSalaryMax: 90000,
    growthRate: 15,
    automationRisk: "medium" as const,
    scalability: "high" as const,
    trend: "growing" as const,
    timeToAutonomy: "6-18 mesi con esperienza pratica",
    advantages: [
      "Settore comprensibile e concreto",
      "Alta scalabilità con automazione",
      "Misurabilità immediata dei risultati",
      "Accesso globale al mercato",
    ],
    disadvantages: [
      "Margini sotto pressione",
      "Dipendenza dalle piattaforme",
      "Forte competizione sui prezzi",
    ],
    opportunities: ["E-commerce Manager", "Marketplace Specialist", "CRO Specialist", "D2C Brand Manager", "Growth Operator"],
    icon: "shopping-bag",
    color: "#f97316",
  },
  {
    name: "Logistica & Supply Chain",
    description:
      "Magazzino evoluto, trasporti, operations e pianificazione. Settore centrale per l'economia reale, sempre più digitale e data-driven con l'industria 4.0.",
    riasecTypes: ["C", "R", "E"],
    skills: ["Pianificazione operativa", "Gestione scorte", "ERP", "Procurement", "Analisi costi"],
    avgSalaryMin: 28000,
    avgSalaryMax: 90000,
    growthRate: 12,
    automationRisk: "medium" as const,
    scalability: "medium" as const,
    trend: "growing" as const,
    timeToAutonomy: "1-2 anni con esperienza ops",
    advantages: [
      "Alta domanda nelle aziende manifatturiere",
      "Digitalizzazione rapida del settore",
      "Ruoli concreti e misurabili",
      "Trasversale a tutti i settori",
    ],
    disadvantages: [
      "Stress operativo elevato",
      "Coordinamento costante",
      "Margini ridotti in alcuni contesti",
    ],
    opportunities: ["Supply Chain Analyst", "Logistics Manager", "Operations Manager", "Warehouse Automation Specialist", "Demand Planner"],
    icon: "truck",
    color: "#64748b",
  },
  {
    name: "Ingegneria & Sistemi Tecnici",
    description:
      "Meccanica, elettrica, impiantistica, automazione e progettazione tecnica. Settore solido e tradizionalmente stabile, in evoluzione verso industria 4.0 e automazione avanzata.",
    riasecTypes: ["R", "I", "C"],
    skills: ["CAD/CAE", "Matematica applicata", "Analisi strutturale", "Problem solving tecnico", "Automazione"],
    avgSalaryMin: 32000,
    avgSalaryMax: 110000,
    growthRate: 11,
    automationRisk: "low" as const,
    scalability: "medium" as const,
    trend: "stable" as const,
    timeToAutonomy: "2-4 anni con laurea ingegneristica",
    advantages: [
      "Alta stabilità occupazionale",
      "Ruoli concreti e rispettati",
      "Export e internazionalizzazione",
      "Base per ruoli manageriali",
    ],
    disadvantages: [
      "Cicli lenti in alcuni comparti",
      "Richiede basi tecniche solide",
      "Aggiornamento costante",
    ],
    opportunities: ["Mechanical Engineer", "Automation Engineer", "Plant Engineer", "Systems Engineer", "Industrial Designer"],
    icon: "settings",
    color: "#78716c",
  },
  {
    name: "Turismo & Hospitality",
    description:
      "Ospitalità, viaggi, esperienze, luxury service e travel tech. Settore umano e relazionale con forte potenziale esperienziale, ma sensibile alla stagionalità.",
    riasecTypes: ["S", "A", "E"],
    skills: ["Customer service", "Lingue straniere", "Organizzazione eventi", "Revenue management", "Relazioni interpersonali"],
    avgSalaryMin: 22000,
    avgSalaryMax: 75000,
    growthRate: 13,
    automationRisk: "medium" as const,
    scalability: "medium" as const,
    trend: "growing" as const,
    timeToAutonomy: "6-12 mesi con esperienza diretta",
    advantages: [
      "Alta soddisfazione relazionale",
      "Varietà di contesti internazionali",
      "Settore in ripresa post-pandemia",
      "Esperienza e cultura",
    ],
    disadvantages: [
      "Forte stagionalità",
      "Dipendenza da geopolitica",
      "Orari spesso intensi",
    ],
    opportunities: ["Hospitality Manager", "Travel Designer", "Luxury Experience Curator", "Event Planner", "Tourism Consultant"],
    icon: "map-pin",
    color: "#06b6d4",
  },
  {
    name: "Consulenza & Strategia",
    description:
      "Consulenza direzionale, trasformazione aziendale, business strategy e operations. Palestra per carriera ad alto livello, richiede pensiero analitico e comunicazione forte.",
    riasecTypes: ["E", "I", "C"],
    skills: ["Pensiero analitico", "Comunicazione executive", "Problem solving strutturato", "Presentazioni", "Project management"],
    avgSalaryMin: 35000,
    avgSalaryMax: 200000,
    growthRate: 14,
    automationRisk: "low" as const,
    scalability: "high" as const,
    trend: "growing" as const,
    timeToAutonomy: "2-4 anni con esperienza Big4 o boutique",
    advantages: [
      "Alta visibilità strategica",
      "Network di alto livello",
      "Stipendi molto elevati",
      "Acceleratore di carriera",
    ],
    disadvantages: [
      "Pressione e orari intensi",
      "Alta competitività",
      "Frequenti trasferte",
    ],
    opportunities: ["Strategy Consultant", "Business Analyst", "Transformation Consultant", "Management Consultant", "Operations Consultant"],
    icon: "briefcase",
    color: "#1e293b",
  },
  {
    name: "Risorse Umane & People Operations",
    description:
      "Recruiting, talent acquisition, sviluppo persone e HR analytics. Settore in trasformazione digitale che richiede equilibrio tra dati e relazioni umane.",
    riasecTypes: ["S", "C", "E"],
    skills: ["Intervista e selezione", "Employer branding", "HR analytics", "Formazione interna", "Comunicazione empatica"],
    avgSalaryMin: 25000,
    avgSalaryMax: 85000,
    growthRate: 13,
    automationRisk: "medium" as const,
    scalability: "medium" as const,
    trend: "growing" as const,
    timeToAutonomy: "1-2 anni con esperienza recruiting",
    advantages: [
      "Lavoro con le persone",
      "Impatto diretto sulla cultura aziendale",
      "Sempre più data-driven",
      "Trasversale a tutti i settori",
    ],
    disadvantages: [
      "A volte sottovalutato",
      "Richiede alta sensibilità relazionale",
      "Equilibrio difficile tra empatia e KPI",
    ],
    opportunities: ["Recruiter", "Talent Acquisition Specialist", "HR Business Partner", "People Ops Specialist", "L&D Specialist"],
    icon: "users",
    color: "#a855f7",
  },
  {
    name: "Design & Creatività Digitale",
    description:
      "UX/UI, product design, brand, motion e contenuti digitali. Settore molto creativo che diventa scalabile se collegato a prodotto e tecnologia.",
    riasecTypes: ["A", "E", "I"],
    skills: ["Figma/Adobe", "UX Research", "Pensiero visivo", "Prototipazione", "Storytelling visivo"],
    avgSalaryMin: 25000,
    avgSalaryMax: 90000,
    growthRate: 15,
    automationRisk: "medium" as const,
    scalability: "high" as const,
    trend: "growing" as const,
    timeToAutonomy: "6-18 mesi con portfolio solido",
    advantages: [
      "Alta soddisfazione espressiva",
      "Possibilità freelance globale",
      "Settore in espansione digitale",
      "Creatività valorizzata",
    ],
    disadvantages: [
      "Forte competizione",
      "Rischio di svalutazione del lavoro",
      "Portfolio essenziale",
    ],
    opportunities: ["UX/UI Designer", "Product Designer", "Motion Designer", "Brand Designer", "Creative Strategist"],
    icon: "palette",
    color: "#f59e0b",
  },
  {
    name: "Immobiliare & Property",
    description:
      "Compravendita, gestione asset, proptech e investimenti immobiliari. Interessante per chi ama il mondo tangibile con competenze commerciali e patrimoniali.",
    riasecTypes: ["E", "C", "R"],
    skills: ["Negoziazione", "Valutazione immobiliare", "Diritto immobiliare", "Analisi mercato", "CRM commerciale"],
    avgSalaryMin: 25000,
    avgSalaryMax: 120000,
    growthRate: 9,
    automationRisk: "medium" as const,
    scalability: "medium" as const,
    trend: "stable" as const,
    timeToAutonomy: "1-2 anni con rete commerciale",
    advantages: [
      "Alta remunerazione su risultati",
      "Asset tangibili e comprensibili",
      "Buona autonomia professionale",
      "Mercato sempre attivo",
    ],
    disadvantages: [
      "Mercato ciclico",
      "Barriere economiche alte",
      "Dipendenza dai tassi di interesse",
    ],
    opportunities: ["Real Estate Advisor", "Property Manager", "Investment Analyst", "Leasing Specialist", "Proptech Specialist"],
    icon: "home",
    color: "#d97706",
  },
  {
    name: "Agroalimentare & Food Industry",
    description:
      "Produzione, qualità, export e innovazione alimentare. Settore centrale per l'Italia con stabilità, connessione all'identità territoriale e potenziale di internazionalizzazione.",
    riasecTypes: ["R", "C", "S"],
    skills: ["Controllo qualità", "Normativa alimentare", "Export management", "Supply chain food", "Innovazione di prodotto"],
    avgSalaryMin: 24000,
    avgSalaryMax: 80000,
    growthRate: 10,
    automationRisk: "medium" as const,
    scalability: "medium" as const,
    trend: "stable" as const,
    timeToAutonomy: "1-2 anni con specializzazione",
    advantages: [
      "Settore strategico per l'Italia",
      "Stabilità occupazionale",
      "Export in crescita",
      "Connessione con identità culturale",
    ],
    disadvantages: [
      "Filiera complessa",
      "Margini variabili",
      "Stagionalità in alcune funzioni",
    ],
    opportunities: ["Quality Manager", "Food Technologist", "Export Manager", "AgriTech Specialist", "Product Development Specialist"],
    icon: "wheat",
    color: "#84cc16",
  },
  {
    name: "Gaming & Esports",
    description:
      "Giochi digitali, community, competizioni, prodotti interattivi e intrattenimento. Settore creativo collegato a design, marketing e tecnologia con audience globale.",
    riasecTypes: ["A", "E", "I"],
    skills: ["Game design", "Programmazione Unity/Unreal", "Community management", "Monetizzazione", "Narrazione"],
    avgSalaryMin: 22000,
    avgSalaryMax: 90000,
    growthRate: 17,
    automationRisk: "low" as const,
    scalability: "high" as const,
    trend: "growing" as const,
    timeToAutonomy: "12-24 mesi con portfolio giochi",
    advantages: [
      "Settore appassionante",
      "Audience globale enorme",
      "Alta creatività richiesta",
      "Possibilità di indie e startup",
    ],
    disadvantages: [
      "Settore volatile",
      "Dipendenza da trend e pubblico",
      "Competizione internazionale alta",
    ],
    opportunities: ["Game Designer", "Game Developer", "Community Manager", "Esports Manager", "Monetization Specialist"],
    icon: "gamepad-2",
    color: "#7c3aed",
  },
  {
    name: "Legal Tech & Servizi Legali Digitali",
    description:
      "Automazione legale, documenti digitali, compliance e contract tech. Interessante per chi vuole combinare precisione normativa e tecnologia con grande efficienza.",
    riasecTypes: ["C", "I", "E"],
    skills: ["Diritto applicato", "Contract management", "Compliance", "Automazione documentale", "Privacy GDPR"],
    avgSalaryMin: 30000,
    avgSalaryMax: 110000,
    growthRate: 16,
    automationRisk: "medium" as const,
    scalability: "high" as const,
    trend: "growing" as const,
    timeToAutonomy: "2-3 anni con specializzazione legale/tech",
    advantages: [
      "Alta precisione valorizzata",
      "Automazione ad alto impatto",
      "Settore con pochi concorrenti",
      "Stipendi sopra la media legale",
    ],
    disadvantages: [
      "Complessità normativa",
      "Cambiamento lento in alcuni contesti",
      "Richiede doppia competenza",
    ],
    opportunities: ["Legal Operations Specialist", "Legal Tech Consultant", "Compliance Analyst", "Contract Manager", "Privacy Specialist"],
    icon: "scale",
    color: "#0f172a",
  },
  {
    name: "Biotech & Life Sciences",
    description:
      "Ricerca biologica, farmaceutica, genetica e diagnostica avanzata. Settore ad alta intensità di conoscenza con ottimo potenziale di lungo periodo per chi ama la ricerca.",
    riasecTypes: ["I", "C", "R"],
    skills: ["Biologia molecolare", "Analisi dati scientifici", "Gestione trial clinici", "Regulatory affairs", "Laboratorio"],
    avgSalaryMin: 30000,
    avgSalaryMax: 130000,
    growthRate: 19,
    automationRisk: "low" as const,
    scalability: "medium" as const,
    trend: "booming" as const,
    timeToAutonomy: "4-6 anni con laurea e specializzazione",
    advantages: [
      "Impatto sulla salute globale",
      "Alta specializzazione riconosciuta",
      "Settore in forte investimento",
      "Internazionalizzazione facile",
    ],
    disadvantages: [
      "Percorso formativo lungo",
      "Richiede rigore scientifico alto",
      "Cicli di ricerca molto lenti",
    ],
    opportunities: ["Biotech Researcher", "Lab Specialist", "Pharma Project Manager", "Clinical Data Specialist", "Genomics Analyst"],
    icon: "flask-conical",
    color: "#14b8a6",
  },
  {
    name: "Finanza & Investimenti",
    description:
      "Banca, finanza personale, trading, private equity e gestione patrimoniale. Per chi vuole operare nel mondo dei numeri e delle strategie finanziarie con alto potenziale di guadagno.",
    riasecTypes: ["C", "E", "I"],
    skills: ["Analisi quantitativa", "Gestione del rischio", "Excel e Bloomberg", "Comunicazione executive", "Disciplina"],
    avgSalaryMin: 35000,
    avgSalaryMax: 250000,
    growthRate: 10,
    automationRisk: "medium" as const,
    scalability: "high" as const,
    trend: "stable" as const,
    timeToAutonomy: "2-4 anni con certificazioni CFA/CFP",
    advantages: [
      "Stipendi molto elevati",
      "Trasferibilità internazionale",
      "Network esclusivi",
      "Sviluppo analitico avanzato",
    ],
    disadvantages: [
      "Alta pressione e lunghi orari",
      "Competizione per posizioni top",
      "Cultura aziendale spesso rigida",
    ],
    opportunities: ["Financial Analyst", "Investment Manager", "Portfolio Manager", "Fintech Advisor", "ESG Finance Specialist"],
    icon: "bar-chart",
    color: "#1d4ed8",
  },
];

const EXPECTED_COUNT = SECTORS.length;

export async function seedSectors() {
  const existing = await db.select().from(sectorsTable);

  if (existing.length >= EXPECTED_COUNT) return;

  if (existing.length > 0) {
    await db.delete(sectorsTable);
  }

  await db.insert(sectorsTable).values(SECTORS);
}

type CareerStep = { step: number; title: string; description: string };

const DIPENDENTI_STEPS: Record<string, CareerStep[]> = {
  "Tecnologia & Digitale": [
    { step: 1, title: "Formazione tecnica", description: "Consegui una laurea in informatica, ingegneria del software o frequenta un bootcamp intensivo. Acquisisci le basi di programmazione, algoritmi e sistemi." },
    { step: 2, title: "Stage o primo ruolo junior", description: "Entra in azienda come junior developer o IT trainee. L'obiettivo è imparare il ciclo di sviluppo, lavorare in team e costruire il tuo primo portfolio professionale." },
    { step: 3, title: "Specializzazione tecnica", description: "Scegli un'area: frontend, backend, cloud, DevOps o mobile. Approfondisci framework e strumenti richiesti dai team che vuoi raggiungere." },
    { step: 4, title: "Ruolo senior e leadership tecnica", description: "Con 3-5 anni di esperienza, diventa Senior Developer o Tech Lead. Guida decisioni architetturali e mentora i colleghi junior." },
    { step: 5, title: "Staff Engineer o Engineering Manager", description: "Scegli tra percorso tecnico avanzato (Staff/Principal Engineer) o gestionale (Engineering Manager). Entrambi richiedono forte reputazione e visione strategica." },
  ],
  "Cybersecurity": [
    { step: 1, title: "Certificazioni di base", description: "Inizia con CompTIA Security+, CEH o OSCP. Studia reti, sistemi operativi, crittografia e principi di sicurezza informatica." },
    { step: 2, title: "Analista SOC junior", description: "Lavora in un Security Operations Center come analista L1/L2. Monitora alert, gestisci incidenti e impara a usare SIEM, EDR e strumenti di threat hunting." },
    { step: 3, title: "Specializzazione", description: "Scegli un verticale: penetration testing, cloud security, incident response, compliance o security architecture. Ottieni certificazioni avanzate (OSCP, CISSP, CISM)." },
    { step: 4, title: "Senior Security Analyst o Architect", description: "Con 4-6 anni di esperienza, guida audit, definisci policy aziendali e progetta architetture sicure. Diventa punto di riferimento tecnico per il team." },
    { step: 5, title: "CISO o Security Manager", description: "Raggiungi il ruolo di Chief Information Security Officer o Security Manager. Gestisci budget, team e strategie di sicurezza a livello aziendale." },
  ],
  "Data & Analytics": [
    { step: 1, title: "Formazione analitica", description: "Studia statistica, matematica applicata, Python o R. Un percorso universitario in statistica, informatica o economia quantitativa è un ottimo punto di partenza." },
    { step: 2, title: "Junior Data Analyst", description: "Lavora con dataset reali in azienda. Impara a usare SQL, BI tools (Tableau, Power BI) e a comunicare insight ai decision maker." },
    { step: 3, title: "Specializzazione in Data Science o Engineering", description: "Approfondisci machine learning (Scikit-learn, TensorFlow) o pipeline dati (Spark, Airflow, dbt). Scegli la direzione più adatta al tuo profilo." },
    { step: 4, title: "Senior Data Scientist o Data Engineer", description: "Guida progetti di modellazione predittiva o architetture dati complesse. Collabori strettamente con prodotto, engineering e business." },
    { step: 5, title: "Head of Data o Data Lead", description: "Coordina il team data, definisci la data strategy aziendale e assicura qualità e governance dei dati. Ruolo chiave nelle aziende data-driven." },
  ],
  "Fintech": [
    { step: 1, title: "Formazione finance e tech", description: "Studia economia, finanza o ingegneria gestionale con competenze tech (Python, SQL, prodotti finanziari digitali). Un MBA o master specialistico accelera il percorso." },
    { step: 2, title: "Ruolo entry-level in banking o fintech startup", description: "Entra come analista, junior product manager o sviluppatore in una banca o startup fintech. Comprendi processi regolatori, KYC, pagamenti digitali." },
    { step: 3, title: "Specializzazione in un verticale fintech", description: "Scegli tra payments, lending, RegTech, blockchain, wealth management o open banking. Costruisci competenze verticali sempre più rare e richieste." },
    { step: 4, title: "Product Manager o Risk Manager senior", description: "Guida lo sviluppo di prodotti finanziari o gestisci rischi regolatori. Coordina team cross-funzionali e dialoga con stakeholder istituzionali." },
    { step: 5, title: "Director of Product o Chief Risk Officer", description: "Raggiungi la leadership di prodotto o risk a livello aziendale. Definisci roadmap strategiche, parla con investitori e board, governi team estesi." },
  ],
  "Green Economy & Sostenibilità": [
    { step: 1, title: "Formazione ambientale o ingegneristica", description: "Studia ingegneria ambientale, economia verde, scienze naturali o sustainability management. Le certificazioni ESG (SASB, GRI) aumentano la competitività." },
    { step: 2, title: "Analista ESG o Energy junior", description: "Lavora in società di consulenza, utility o corporate come analista ESG, energy analyst o sustainability coordinator. Raccogli dati, redigi report, monitora KPI green." },
    { step: 3, title: "Specializzazione", description: "Scegli tra energia rinnovabile, carbon accounting, economia circolare, ESG reporting o procurement sostenibile. La specializzazione ti distingue in un mercato in rapida crescita." },
    { step: 4, title: "Sustainability Manager", description: "Coordina progetti di transizione energetica o sostenibilità aziendale. Gestisci relazioni con enti pubblici, certificatori e fornitori green." },
    { step: 5, title: "Head of ESG o Chief Sustainability Officer", description: "Guida la strategia sostenibile dell'azienda, riporti al board e rappresenti l'azienda con investitori e stakeholder istituzionali." },
  ],
  "Sanità & Healthcare Digitale": [
    { step: 1, title: "Percorso formativo specialistico", description: "Completa la laurea in medicina, infermieristica, biotecnologie o healthcare management. Per ruoli digitali, integra competenze in informatica medica o salute digitale." },
    { step: 2, title: "Tirocinio e primo incarico", description: "Lavora in ospedale, clinica o azienda healthcare come medico junior, infermiere, health data analyst o coordinatore telemedicina. Costruisci esperienza clinica o gestionale." },
    { step: 3, title: "Specializzazione clinica o digitale", description: "Scegli una specializzazione medica, oppure orienta la carriera verso la salute digitale (EHR, telemedicina, AI clinica). Consegui master o dottorati specialistici." },
    { step: 4, title: "Senior clinico o responsabile area", description: "Diventa specialista senior, referente di reparto o responsabile di area healthcare digitale. Coordini team e gestisci percorsi terapeutici o progetti innovativi." },
    { step: 5, title: "Primario, Direttore Sanitario o Health Director", description: "Raggiungi la leadership clinica o manageriale: primario, direttore sanitario, country manager per healthcare company o responsabile dell'innovazione digitale." },
  ],
  "Istruzione & Formazione": [
    { step: 1, title: "Laurea e abilitazione all'insegnamento", description: "Consegui una laurea magistrale nella disciplina di interesse e, per il settore pubblico, l'abilitazione all'insegnamento (TFA, concorso). Per il privato, certificazioni formative sono sufficienti." },
    { step: 2, title: "Docente junior o formatore", description: "Insegna in scuole, accademie o aziende. Impara a progettare percorsi didattici, gestire l'aula e adattare i contenuti a diversi pubblici." },
    { step: 3, title: "Specializzazione", description: "Scegli un focus: EdTech, corporate training, coaching, instructional design o formazione manageriale. Le competenze digitali (LMS, e-learning) sono sempre più richieste." },
    { step: 4, title: "Senior Trainer o Learning Designer", description: "Progetta programmi formativi strutturati, misura i risultati di apprendimento e collabori con HR e management per allineare la formazione agli obiettivi aziendali." },
    { step: 5, title: "Head of Learning o Responsabile Formazione", description: "Guida la funzione formazione dell'organizzazione, definisci budget, fornitori e strategia L&D. Diventi punto di riferimento per lo sviluppo delle persone." },
  ],
  "Marketing & Growth": [
    { step: 1, title: "Formazione in marketing e comunicazione", description: "Studia marketing, comunicazione o economia. Integra con certificazioni Google, Meta, HubSpot e padronanza degli strumenti digitali fondamentali." },
    { step: 2, title: "Junior Marketer o Copywriter", description: "Lavora in agenzia o azienda gestendo campagne, contenuti social, email marketing o SEO. Sviluppa senso del brand e capacità analitiche sui dati di performance." },
    { step: 3, title: "Specializzazione", description: "Scegli un verticale: performance marketing, brand strategy, content marketing, growth hacking o demand generation. La specializzazione accelera la progressione salariale." },
    { step: 4, title: "Marketing Manager o Growth Lead", description: "Gestisci budget, team e strategie di acquisizione e retention. Dialoga con prodotto e sales, misura ROI e ottimizza il funnel continuamente." },
    { step: 5, title: "CMO o Head of Marketing", description: "Guida tutta la funzione marketing, definisci il posizionamento del brand, lavori a stretto contatto con CEO e board per la crescita aziendale." },
  ],
  "E-commerce & Retail Digitale": [
    { step: 1, title: "Formazione digitale e commerciale", description: "Studia marketing digitale, economia del commercio o gestione d'impresa. Impara le piattaforme: Shopify, Amazon, Google Ads, Meta Ads, analytics." },
    { step: 2, title: "E-commerce Specialist junior", description: "Gestisci catalogo, campagne paid o customer journey in un e-commerce. Impara le dinamiche di conversion rate, carrelli abbandonati e logistica digitale." },
    { step: 3, title: "Specializzazione", description: "Approfondisci marketplace management, CRO (Conversion Rate Optimization), D2C brand management o omnichannel strategy. Costruisci expertise difficilmente replicabile." },
    { step: 4, title: "E-commerce Manager", description: "Coordina tutti i canali digitali di vendita, gestisci team e agenzie, lavori su roadmap prodotto e strategia pricing. Sei responsabile del P&L del canale online." },
    { step: 5, title: "Head of Digital Commerce o Digital Director", description: "Guidi la trasformazione digitale del retail, definisci investimenti, piattaforme e modelli di business omnicanale. Riporti al C-suite e guidi team estesi." },
  ],
  "Logistica & Supply Chain": [
    { step: 1, title: "Formazione in logistica o economia", description: "Studia logistica, ingegneria gestionale o economia aziendale. Certificazioni APICS (CPIM, CSCP) sono molto valorizzate nel settore." },
    { step: 2, title: "Operativo o Supply Chain Analyst junior", description: "Lavora in magazzino, operations o pianificazione. Impara ERP (SAP, Oracle), gestione scorte, procurement e coordinamento fornitori." },
    { step: 3, title: "Specializzazione", description: "Scegli tra demand planning, warehouse management, procurement strategico, last mile delivery o supply chain digitale. La specializzazione apre ruoli senior più veloci." },
    { step: 4, title: "Logistics Manager o Operations Manager", description: "Gestisci team operativi, ottimizza costi e processi, coordina fornitori e hub logistici. Sei responsabile di KPI come fill rate, lead time e costo per spedizione." },
    { step: 5, title: "VP Supply Chain o Chief Operations Officer", description: "Guida la strategia supply chain dell'azienda, gestisci investimenti in tecnologia, fornitori strategici e rischi di approvvigionamento globale." },
  ],
  "Ingegneria & Sistemi Tecnici": [
    { step: 1, title: "Laurea ingegneristica", description: "Consegui una laurea in ingegneria meccanica, elettrica, gestionale, civile o aerospaziale. La formazione accademica è il requisito fondamentale per quasi tutti i ruoli tecnici." },
    { step: 2, title: "Progettista o ingegnere junior", description: "Entra in azienda come progettista CAD, ingegnere di processo o quality engineer. Impara gli strumenti tecnici del settore e lavora sotto la guida di senior engineer." },
    { step: 3, title: "Specializzazione tecnica", description: "Approfondisci un'area: automazione industriale, ingegneria strutturale, termotecnica, progettazione meccanica o digital twin. Le certificazioni (ISO, PMP) accelerano la progressione." },
    { step: 4, title: "Senior Engineer o Technical Lead", description: "Guida progetti complessi, coordina team tecnici e interfacciti con clienti e fornitori. Diventa il riferimento tecnico per il tuo dominio di specializzazione." },
    { step: 5, title: "Technical Director o Plant Manager", description: "Gestisci impianti produttivi, stabilimenti o interi dipartimenti di ingegneria. Combina competenze tecniche e manageriali per guidare innovazione e produttività." },
  ],
  "Turismo & Hospitality": [
    { step: 1, title: "Formazione turistica e linguistica", description: "Studia scienze del turismo, hospitality management o lingue straniere. Stage in strutture alberghiere o agenzie fin dagli studi per costruire esperienza pratica." },
    { step: 2, title: "Receptionist o operatore turistico junior", description: "Lavora in hotel, resort, agenzia viaggi o tour operator. Gestisci check-in, prenotazioni, customer service e impara i processi operativi dell'ospitalità." },
    { step: 3, title: "Specializzazione", description: "Scegli tra revenue management, luxury hospitality, eventi e congressi, travel tech o incoming tourism. La specializzazione apre ruoli con maggiore responsabilità e retribuzione." },
    { step: 4, title: "Hotel Manager o Senior Travel Consultant", description: "Gestisci un reparto o una struttura. Coordini team, ottimizzi occupazione e revenue, crei esperienze di alto livello per i clienti." },
    { step: 5, title: "General Manager o Hospitality Director", description: "Guida una struttura alberghiera, una catena o una destinazione turistica. Gestisci P&L, brand positioning e relazioni con tour operator e investitori." },
  ],
  "Consulenza & Strategia": [
    { step: 1, title: "Laurea con eccellenza", description: "Studia economia, gestionale, giurisprudenza o ingegneria in università di prestigio. Il GPA e le attività extracurriculari contano molto per le selezioni in Big4 e top boutique." },
    { step: 2, title: "Analyst in Big4 o boutique strategica", description: "Entra come Analyst/Consultant junior. Lavori su progetti multi-settore: analisi, benchmarking, presentazioni per C-suite. Il primo anno è una palestra intensiva." },
    { step: 3, title: "Senior Associate o Consultant", description: "Gestisci workstream autonomi, conduci interviste con clienti e guidi team di analisti. Costruisci expertise verticale in uno o due settori prioritari." },
    { step: 4, title: "Manager", description: "Gestisci interi progetti e relazioni con i clienti. Sei responsabile della qualità del lavoro e dello sviluppo del team. Il networking interno ed esterno diventa fondamentale." },
    { step: 5, title: "Partner o Director", description: "Porta business nuovo, guida practice, costruisci relazioni con clienti chiave. Il ruolo di Partner è il culmine del percorso consulenziale e richiede forte leadership commerciale." },
  ],
  "Risorse Umane & People Operations": [
    { step: 1, title: "Formazione in psicologia o economia", description: "Studia psicologia del lavoro, economia aziendale o sociologia. Un master in HR management o people analytics accelera l'accesso ai ruoli più qualificati." },
    { step: 2, title: "HR Assistant o Recruiter junior", description: "Lavora in azienda o agenzia di recruiting. Gestisci annunci, screening CV, colloqui telefonici e onboarding. Impara i processi HR fondamentali." },
    { step: 3, title: "Specializzazione HR", description: "Scegli un verticale: talent acquisition, HRBP, learning & development, compensation & benefits o people analytics. La specializzazione apre percorsi senior più definiti." },
    { step: 4, title: "HR Manager o HR Business Partner", description: "Gestisci la funzione HR per un'area aziendale. Supporti i manager sulle decisioni relative alle persone, gestisci performance review e sviluppo organizzativo." },
    { step: 5, title: "HR Director o Chief People Officer", description: "Guida la strategia people dell'organizzazione: cultura, talento, retention e sviluppo. Riporti al CEO e fai parte del board. Ruolo di impatto organizzativo elevato." },
  ],
  "Design & Creatività Digitale": [
    { step: 1, title: "Formazione in design", description: "Frequenta una scuola di design (Politecnico, IED, NABA) o un corso specialistico online. Padroneggia Figma, Adobe Suite e i principi di UX/UI e design thinking." },
    { step: 2, title: "Junior Designer (stage o primo ruolo)", description: "Entra in agenzia o azienda come junior UX/UI designer o visual designer. Lavora su progetti reali, costruisci il portfolio e impara a ricevere feedback dai senior." },
    { step: 3, title: "Specializzazione", description: "Scegli un focus: product design, UX research, motion design, brand identity o design system. La specializzazione aumenta il tuo valore sul mercato in modo significativo." },
    { step: 4, title: "Senior Designer o Design Lead", description: "Guida la direzione creativa di prodotti o campagne. Mentora designer junior, collabori con product manager e engineering per decisioni di design strategiche." },
    { step: 5, title: "Head of Design o Creative Director", description: "Guida il design di prodotto o brand a livello aziendale. Definisci il visual language, la strategia UX e costruisci una cultura del design nell'organizzazione." },
  ],
  "Immobiliare & Property": [
    { step: 1, title: "Abilitazione e formazione professionale", description: "Ottieni l'abilitazione all'esercizio della professione di agente immobiliare (patentino). Studia diritto immobiliare, catasto, contratti e valutazione degli asset." },
    { step: 2, title: "Agente immobiliare junior", description: "Lavora in un'agenzia o network (Tecnocasa, RE/MAX, Coldwell Banker). Gestisci mandati, visita immobili, conduci trattative sotto supervisione e costruisci la tua rete." },
    { step: 3, title: "Specializzazione", description: "Scegli tra residenziale di pregio, commerciale, investimenti istituzionali, property management o proptech. La specializzazione aumenta commissioni e clientela qualificata." },
    { step: 4, title: "Senior Advisor o Property Manager", description: "Gestisci un portafoglio clienti consolidato, conduci trattative complesse e coordini aspetti legali, tecnici e finanziari delle operazioni immobiliari." },
    { step: 5, title: "Broker o Head of Real Estate", description: "Apri o gestisci un'agenzia, guida team di agenti, sviluppa partnership con investitori e fondi immobiliari. Combini leadership commerciale e gestione patrimoniale." },
  ],
  "Agroalimentare & Food Industry": [
    { step: 1, title: "Formazione specialistica", description: "Studia scienze e tecnologie alimentari, agraria, chimica industriale o economia agricola. Università come Bologna, Milano, Parma e Napoli offrono percorsi di eccellenza." },
    { step: 2, title: "Tecnologo o Quality Control junior", description: "Lavora in produzione, laboratorio o qualità in un'azienda alimentare. Impara le normative HACCP, ISO 22000, gestisci controlli di processo e audit fornitori." },
    { step: 3, title: "Specializzazione", description: "Scegli tra export management, qualità e certificazioni, ricerca e sviluppo prodotto, supply chain food o marketing del food. L'export è un verticale in forte crescita per il Made in Italy." },
    { step: 4, title: "Quality Manager o Export Manager", description: "Gestisci la qualità di fabbrica o i mercati esteri. Coordini team, relazioni con distributori internazionali e autorità regolatorie. Viaggi frequenti soprattutto nell'export." },
    { step: 5, title: "Direttore Qualità o R&D Director", description: "Guida la strategia di qualità e innovazione dell'azienda. Definisci roadmap prodotto, gestisci investimenti in R&D e rappresenti l'azienda in contesti istituzionali." },
  ],
  "Gaming & Esports": [
    { step: 1, title: "Formazione in game design o sviluppo", description: "Frequenta un corso in game design, programmazione (Unity, Unreal) o computer science. Portfolio di giochi sviluppati in autonomia vale quanto un titolo accademico." },
    { step: 2, title: "Junior Game Developer o Designer", description: "Entra in uno studio (startup indie o publisher) come developer, level designer o QA tester. I primi progetti insegnano pipeline produttiva, iterazione e lavoro di squadra." },
    { step: 3, title: "Specializzazione", description: "Scegli tra gameplay programming, narrative design, game art, monetizzazione, community management o esports operations. La specializzazione definisce il tuo percorso nel settore." },
    { step: 4, title: "Senior Developer o Lead Designer", description: "Guida lo sviluppo di feature complesse o l'intera direzione creativa di un titolo. Mentora team, collabori con producer e marketing per lanciare prodotti di qualità." },
    { step: 5, title: "Game Director o Studio Head", description: "Guida la visione creativa di un titolo o l'intero studio. Gestisci budget, team, publisher e strategy di lancio. Il networking nella community gaming è essenziale." },
  ],
  "Legal Tech & Servizi Legali Digitali": [
    { step: 1, title: "Laurea in giurisprudenza con formazione tech", description: "Consegui una laurea magistrale in giurisprudenza e integra con corsi di legal design, privacy, contract management o automazione documentale. Il doppio profilo è il tuo vantaggio." },
    { step: 2, title: "Junior Legal Ops o Compliance Analyst", description: "Lavora in un legal department corporate, LPO (Legal Process Outsourcing) o studio legale innovativo. Gestisci contratti, NDA, GDPR compliance e automazione documentale." },
    { step: 3, title: "Specializzazione", description: "Scegli tra contract tech, privacy GDPR, regulatory compliance, legal project management o e-discovery. La specializzazione in aree ad alto impatto (AI regulation, fintech legal) è molto premiata." },
    { step: 4, title: "Legal Tech Senior Specialist o Legal Counsel", description: "Gestisci processi legali complessi, implementi soluzioni tech nel legal workflow e collabori con IT, compliance e business. Diventi il ponte tra diritto e tecnologia." },
    { step: 5, title: "Head of Legal Operations o General Counsel", description: "Guida la funzione legale dell'organizzazione, definisci la strategia di legal ops, gestisci budget, fornitori tech e team legale interno. Riporti al C-suite." },
  ],
  "Biotech & Life Sciences": [
    { step: 1, title: "Laurea magistrale e dottorato", description: "Studia biologia molecolare, biotecnologie, farmacia, chimica o medicina. Il dottorato di ricerca (PhD) è spesso richiesto per ruoli scientifici avanzati in R&D." },
    { step: 2, title: "Ricercatore o Lab Analyst junior", description: "Lavora in laboratorio, CRO (Contract Research Organization) o università. Gestisci esperimenti, analisi dati scientifici e report tecnici. Pubblica su riviste peer-reviewed." },
    { step: 3, title: "Specializzazione scientifica", description: "Approfondisci genomica, bioinformatica, sviluppo farmaceutico, diagnostica avanzata o regulatory affairs. Le competenze in AI applicata alle life sciences sono sempre più richieste." },
    { step: 4, title: "Senior Scientist o Project Manager", description: "Guida progetti di ricerca o clinical trials, coordina team scientifici e gestisci relazioni con CRO, enti regolatori (EMA, FDA) e partner accademici." },
    { step: 5, title: "Principal Scientist o R&D Director", description: "Definisci la strategia di ricerca e sviluppo, gestisci pipeline di prodotti, budget e collaborazioni scientifiche internazionali. Sei il punto di riferimento scientifico dell'organizzazione." },
  ],
  "Finanza & Investimenti": [
    { step: 1, title: "Laurea in economia o finanza", description: "Studia economia, finanza aziendale o matematica finanziaria. Le università Bocconi, LUISS e i politecnici sono percorsi preferiti. Considera subito la certificazione CFA." },
    { step: 2, title: "Analyst in Investment Banking o Asset Management", description: "Entra come Analyst in una banca d'investimento, asset manager, PE o hedge fund. Modellazione finanziaria, valutazioni DCF e presentazioni per clienti istituzionali saranno la quotidianità." },
    { step: 3, title: "Associate", description: "Dopo 2-3 anni, avanza ad Associate. Gestisci deal, coordini analisti e sviluppi relazioni con clienti. Considera un MBA top o la certificazione CFA Level III per accelerare." },
    { step: 4, title: "VP o Portfolio Manager", description: "Gestisci portafogli o team di deal, hai ownership su transazioni o strategie di investimento. Il tuo track record diventa il principale asset per avanzare ulteriormente." },
    { step: 5, title: "Director o Managing Director", description: "Porta relazioni e business ai massimi livelli, gestisci team e contribuisci alla strategia della firma. Il networking con CEO, CFO e investitori istituzionali è il cuore del ruolo." },
  ],
};

export async function patchDipendentiSteps() {
  const sectors = await db.select({ id: sectorsTable.id, name: sectorsTable.name, dipendentiSteps: sectorsTable.dipendentiSteps }).from(sectorsTable);
  for (const sector of sectors) {
    const existing = sector.dipendentiSteps as CareerStep[] | null;
    if (existing && existing.length > 0) continue; // already patched
    const steps = DIPENDENTI_STEPS[sector.name];
    if (!steps) continue;
    await db.update(sectorsTable).set({ dipendentiSteps: steps }).where(eq(sectorsTable.id, sector.id));
  }
}

export async function patchWorkModeFields() {
  // Idempotent: re-applies per-sector work-mode data on every startup.
  // Needed because migration 0003 runs UPDATE clauses before seed data is inserted on fresh DBs.
  const techSteps = JSON.stringify([
    { step: 1, title: "Costruisci un portfolio pubblico", description: "Crea progetti personali o open source che dimostrino le tue competenze tecniche." },
    { step: 2, title: "Definisci la tua specializzazione", description: "Scegli una nicchia (es. backend Node.js, mobile Flutter) per distinguerti dal mercato." },
    { step: 3, title: "Acquisisci i primi clienti", description: "Parti da piattaforme come Upwork o Fiverr, poi costruisci relazioni dirette con aziende." },
    { step: 4, title: "Gestisci la parte fiscale", description: "Apri una Partita IVA regime forfettario e tieni traccia delle spese deducibili." },
    { step: 5, title: "Scala verso tariffe premium", description: "Con la reputazione costruita, aumenta le tariffe orarie e seleziona clienti di qualità." },
  ]);
  await db.execute(sql`UPDATE sectors SET work_mode = '["dipendente","ibrido"]'::json, autonomy_score = 6, stability_score = 7, client_acquisition_required = false, remote_friendly = true, freelance_steps = ${techSteps}::json WHERE LOWER(name) LIKE '%tecnolog%' OR LOWER(name) LIKE '%cybersecurity%'`);

  const healthSteps = JSON.stringify([
    { step: 1, title: "Ottieni le certificazioni necessarie", description: "Le professioni sanitarie richiedono abilitazioni specifiche. Verifica i requisiti per la tua specializzazione." },
    { step: 2, title: "Apri uno studio privato", description: "Registra l'attività, trova uno spazio adeguato e rispetta i requisiti sanitari locali." },
    { step: 3, title: "Costruisci una rete di referral", description: "Collabora con medici di base e altri specialisti che possono indirizzarti pazienti." },
    { step: 4, title: "Gestione amministrativa", description: "Assicurazione professionale, fatturazione e gestione agenda sono fondamentali in autonomia." },
    { step: 5, title: "Crescita e specializzazione", description: "Differenziati con corsi di aggiornamento e costruisci una reputazione online." },
  ]);
  await db.execute(sql`UPDATE sectors SET work_mode = '["dipendente"]'::json, autonomy_score = 3, stability_score = 9, client_acquisition_required = false, remote_friendly = false, freelance_steps = ${healthSteps}::json WHERE LOWER(name) LIKE '%salut%' OR LOWER(name) LIKE '%sanit%' OR LOWER(name) LIKE '%healthcare%' OR LOWER(name) LIKE '%benessere%'`);

  const creativeSteps = JSON.stringify([
    { step: 1, title: "Costruisci il tuo brand creativo", description: "Crea un portfolio online (Behance, sito personale) che rappresenti il tuo stile unico." },
    { step: 2, title: "Scegli le tue piattaforme", description: "Individua dove sono i tuoi clienti ideali: agenzie, startup, privati, mercati internazionali." },
    { step: 3, title: "Definisci i tuoi pacchetti", description: "Proponi offerte chiare con prezzi trasparenti per evitare negoziazioni infinite." },
    { step: 4, title: "Costruisci relazioni a lungo termine", description: "Un cliente fidelizzato vale molto più di dieci clienti occasionali. Cura il post-progetto." },
    { step: 5, title: "Diversifica le fonti di reddito", description: "Affianca ai servizi prodotti digitali (template, corsi) per reddito passivo." },
  ]);
  await db.execute(sql`UPDATE sectors SET work_mode = '["autonomo","ibrido"]'::json, autonomy_score = 9, stability_score = 4, client_acquisition_required = true, remote_friendly = true, freelance_steps = ${creativeSteps}::json WHERE LOWER(name) LIKE '%creativit%' OR LOWER(name) LIKE '%design%' OR LOWER(name) LIKE '%gaming%' OR LOWER(name) LIKE '%esport%'`);

  const entrepreneurSteps = JSON.stringify([
    { step: 1, title: "Valida la tua idea di business", description: "Testa il mercato con un MVP prima di investire risorse significative." },
    { step: 2, title: "Costituisci la struttura legale", description: "Scegli la forma giuridica adatta (Partita IVA, SRL, SAS) in base al progetto." },
    { step: 3, title: "Trova i primi clienti o investitori", description: "Il bootstrapping o il pre-seed da angel investor sono percorsi complementari." },
    { step: 4, title: "Costruisci il team", description: "Identifica i ruoli chiave mancanti e recluta collaboratori o co-fondatori." },
    { step: 5, title: "Scala e consolida", description: "Con trazione dimostrata, cerca funding istituzionale o reinvesti i profitti per crescere." },
  ]);
  await db.execute(sql`UPDATE sectors SET work_mode = '["autonomo"]'::json, autonomy_score = 10, stability_score = 4, client_acquisition_required = true, remote_friendly = true, freelance_steps = ${entrepreneurSteps}::json WHERE LOWER(name) LIKE '%imprenditor%' OR LOWER(name) LIKE '%business%'`);

  const consultingSteps = JSON.stringify([
    { step: 1, title: "Costruisci una specializzazione verticale", description: "I consulenti generalisti faticano. Scegli un settore o un problema specifico su cui essere l'esperto di riferimento." },
    { step: 2, title: "Crea contenuti di valore", description: "Pubblica insights su LinkedIn, scrivi articoli o un blog per costruire autorevolezza." },
    { step: 3, title: "Costruisci la tua rete professionale", description: "Il networking è fondamentale in consulenza. Il 70% dei mandati arriva da referral." },
    { step: 4, title: "Struttura la tua offerta", description: "Definisci metodologie, deliverable e pricing chiari per ogni servizio." },
    { step: 5, title: "Scala con collaboratori", description: "Quando hai più richieste di quante ne puoi gestire, associa junior o freelance specializzati." },
  ]);
  await db.execute(sql`UPDATE sectors SET work_mode = '["ibrido","autonomo"]'::json, autonomy_score = 7, stability_score = 6, client_acquisition_required = true, remote_friendly = true, freelance_steps = ${consultingSteps}::json WHERE LOWER(name) LIKE '%consulenz%' OR LOWER(name) LIKE '%strateg%' OR LOWER(name) LIKE '%marketing%'`);

  const dataSteps = JSON.stringify([
    { step: 1, title: "Consolida l'expertise tecnica", description: "Approfondisci un'area specifica (data engineering, ML, BI) per diventare punto di riferimento." },
    { step: 2, title: "Costruisci un portfolio di analisi", description: "Pubblica analisi su dataset pubblici, partecipa a Kaggle, scrivi su Medium o Towards Data Science." },
    { step: 3, title: "Offri consulenze per progetto", description: "Inizia con piccoli mandati di analisi dati per aziende che non hanno un team interno." },
    { step: 4, title: "Automatizza con strumenti SaaS", description: "Usa tool come Metabase, Looker Studio o Tableau per scalare le tue analisi senza aumentare le ore." },
    { step: 5, title: "Passa a retainer mensili", description: "Proponi abbonamenti mensili per reporting continuo: reddito ricorrente e relazioni stabili." },
  ]);
  await db.execute(sql`UPDATE sectors SET work_mode = '["ibrido"]'::json, autonomy_score = 5, stability_score = 6, client_acquisition_required = false, remote_friendly = true, freelance_steps = ${dataSteps}::json WHERE LOWER(name) LIKE '%data%' OR LOWER(name) LIKE '%analytic%' OR LOWER(name) LIKE '%fintech%' OR LOWER(name) LIKE '%finanz%'`);

  const hrSteps = JSON.stringify([
    { step: 1, title: "Accumula esperienza in azienda", description: "Prima di andare in proprio, costruisci 3-5 anni di esperienza in strutture organizzate." },
    { step: 2, title: "Diventa un esperto riconosciuto", description: "Pubblica, parla a convegni, costruisci una reputazione nel tuo ambito specifico." },
    { step: 3, title: "Avvia la consulenza part-time", description: "Mantieni la stabilità del lavoro dipendente mentre costruisci i primi clienti." },
    { step: 4, title: "Formalizza l'attività", description: "Apri Partita IVA, definisci contratti standard e gestisci la privacy dei dati (GDPR)." },
    { step: 5, title: "Costruisci un team", description: "Quando il volume cresce, associa collaboratori specializzati per diversificare i servizi." },
  ]);
  await db.execute(sql`UPDATE sectors SET work_mode = '["dipendente","ibrido"]'::json, autonomy_score = 4, stability_score = 8, client_acquisition_required = false, remote_friendly = false, freelance_steps = ${hrSteps}::json WHERE LOWER(name) LIKE '%risorse umane%' OR LOWER(name) LIKE '%istruzione%' OR LOWER(name) LIKE '%formazione%' OR LOWER(name) LIKE '%logistic%'`);

  const defaultSteps = JSON.stringify([
    { step: 1, title: "Consolida le competenze chiave", description: "Approfondisci le competenze tecniche e trasversali richieste nel settore prima di muoverti in autonomia." },
    { step: 2, title: "Costruisci il tuo network", description: "Le opportunità in autonomia arrivano spesso dalle persone che conosci. Investi nelle relazioni professionali." },
    { step: 3, title: "Inizia con progetti part-time", description: "Testa il mercato mantenendo la sicurezza di un reddito fisso finché non hai abbastanza clienti." },
    { step: 4, title: "Formalizza la tua attività", description: "Apri Partita IVA (regime forfettario se il fatturato lo permette) e gestisci la contabilità." },
    { step: 5, title: "Scala e differenzia", description: "Aumenta le tariffe, seleziona clienti migliori e aggiungi servizi complementari alla tua offerta." },
  ]);
  await db.execute(sql`UPDATE sectors SET freelance_steps = ${defaultSteps}::json WHERE freelance_steps::text = '[]' OR freelance_steps IS NULL`);
}
