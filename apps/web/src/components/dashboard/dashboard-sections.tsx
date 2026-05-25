import { DashboardCandidateSearch } from "@/components/dashboard/DashboardCandidateSearch";
import { DashboardCareerPipeline } from "@/components/dashboard/DashboardCareerPipeline";
import { DashboardIdeaValidator } from "@/components/dashboard/DashboardIdeaValidator";
import { DashboardMarketInsights } from "@/components/dashboard/DashboardMarketInsights";
import { DashboardPersonality } from "@/components/dashboard/DashboardPersonality";
import { ArrowRight, BrainCircuit, Briefcase, Map, MessageSquare, Mic2, Network } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";

export type JourneyId = "indeciso" | "dipendente" | "autonomo" | "azienda" | "investitore";

interface SessionDetail {
  id: number;
  riasecScores: Record<string, number>;
  primaryTypes: string[];
  spiritScores: Record<string, number>;
  recommendations: Array<{ sectorId: number; sectorName: string; matchScore: number; matchReason: string }>;
  createdAt: string;
}

const BASE = import.meta.env.BASE_URL || "/";

export interface DashboardSectionProps {
  userId: number;
  journeyType: JourneyId;
  sessionDetail: SessionDetail | null;
  sessionId: number | null;
  isPremium: boolean;
  topSectorId?: number;
}

type SectionRenderer = (props: DashboardSectionProps) => ReactNode;

interface SectionDef {
  key: string;
  render: SectionRenderer;
  condition?: (props: DashboardSectionProps) => boolean;
}

const JOURNEY_LABELS: Record<JourneyId, { title: string; subtitle: string }> = {
  indeciso:    { title: "Il tuo profilo", subtitle: "Scopri le tue inclinazioni professionali" },
  dipendente:  { title: "La tua carriera", subtitle: "Pipeline delle tue candidature" },
  autonomo:    { title: "La tua idea", subtitle: "Valida e sviluppa la tua attività" },
  azienda:     { title: "Il tuo team", subtitle: "Trova i profili giusti per la tua azienda" },
  investitore: { title: "Il tuo mercato", subtitle: "Analisi e trend dei settori" },
};

function HighlightSection({ journeyType, sessionDetail, sessionId }: DashboardSectionProps) {
  const meta = JOURNEY_LABELS[journeyType];

  if (journeyType === "indeciso") {
    if (!sessionDetail) return null;
    return (
      <section>
        <Header title={meta.title} subtitle={meta.subtitle} icon={BrainCircuit}>
          {sessionId && (
            <Link href={`/risultati/${sessionId}`} className="ml-auto">
              <div className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold hover:gap-2 transition-all">
                Dettaglio <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          )}
        </Header>
        <DashboardPersonality
          riasecScores={sessionDetail.riasecScores}
          spiritScores={sessionDetail.spiritScores}
          primaryTypes={sessionDetail.primaryTypes}
        />
      </section>
    );
  }

  if (journeyType === "dipendente") {
    return (
      <section>
        <Header title={meta.title} subtitle={meta.subtitle} icon={BrainCircuit} />
        <DashboardCareerPipeline />
      </section>
    );
  }

  if (journeyType === "autonomo") {
    return (
      <section>
        <Header title={meta.title} subtitle={meta.subtitle} icon={BrainCircuit} />
        <DashboardIdeaValidator />
      </section>
    );
  }

  if (journeyType === "azienda") {
    return (
      <section>
        <Header title={meta.title} subtitle={meta.subtitle} icon={BrainCircuit} />
        <DashboardCandidateSearch />
      </section>
    );
  }

  if (journeyType === "investitore") {
    return (
      <section>
        <Header title={meta.title} subtitle={meta.subtitle} icon={BrainCircuit} />
        <DashboardMarketInsights />
      </section>
    );
  }

  return null;
}

function PersonalitySection({ sessionDetail }: { sessionDetail: SessionDetail | null }) {
  if (!sessionDetail) return null;

  return (
    <section>
      <Header title="Il tuo profilo di personalità" subtitle="Scopri le tue inclinazioni professionali" icon={BrainCircuit}>
        {sessionDetail.id && (
          <Link href={`/risultati/${sessionDetail.id}`} className="ml-auto">
            <div className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold hover:gap-2 transition-all">
              Dettaglio <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        )}
      </Header>
      <DashboardPersonality
        riasecScores={sessionDetail.riasecScores}
        spiritScores={sessionDetail.spiritScores}
        primaryTypes={sessionDetail.primaryTypes}
      />
    </section>
  );
}

function FeatureCard({ icon: Icon, title, subtitle, href, description, buttonText }: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  href: string;
  description: string;
  buttonText: string;
}) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-bold text-xl text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Link href={href} className="ml-auto">
          <span className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold hover:gap-2 transition-all">
            {buttonText} <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </section>
  );
}

function FeatureSections({ journeyType, topSectorId }: { journeyType: JourneyId; topSectorId?: number }) {
  const features = FEATURE_MAP[journeyType];
  if (!features) return null;

  const visible = features.filter((f) => {
    if (f.hrefTemplate && !topSectorId) return false;
    return true;
  });

  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((f) => {
        const resolvedHref = f.hrefTemplate
          ? f.hrefTemplate.replace("{sectorId}", String(topSectorId))
          : (f.href ?? "#");
        return (
          <FeatureCard
            key={f.key}
            icon={f.icon}
            title={f.title}
            subtitle={f.subtitle}
            href={resolvedHref}
            description={f.description}
            buttonText={f.buttonText}
          />
        );
      })}
    </>
  );
}

const FEATURE_MAP: Record<JourneyId, Array<{
  key: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  href?: string;
  hrefTemplate?: string;
  description: string;
  buttonText: string;
}> | null> = {
  indeciso: [
    {
      key: "wiki",
      icon: MessageSquare,
      title: "Guida AI",
      subtitle: "Chiedi tutto sul tuo settore",
      hrefTemplate: `${BASE}wiki/{sectorId}`,
      description: "Poni domande sul tuo settore e ricevi risposte approfondite dall'intelligenza artificiale. Scopri trend, competenze richieste e opportunità di carriera.",
      buttonText: "Fai una domanda",
    },
    {
      key: "grafo",
      icon: Network,
      title: "Mappa delle conoscenze",
      subtitle: "Organizza note, competenze e risorse",
      href: "/archivio",
      description: "Crea e collega note, skills, strumenti e certificazioni in un grafo interattivo. Visualizza le connessioni tra le tue conoscenze e scopri nuovi collegamenti.",
      buttonText: "Apri grafo",
    },
  ],
  dipendente: [
    {
      key: "colloquio",
      icon: Mic2,
      title: "Simulatore Colloquio",
      subtitle: "Allenati con domande reali del tuo settore",
      hrefTemplate: `${BASE}colloquio/{sectorId}`,
      description: "L'AI simula un colloquio HR con domande specifiche per il tuo settore. Ricevi feedback e un punteggio finale per migliorare le tue performance.",
      buttonText: "Simula ora",
    },
    {
      key: "candidature",
      icon: Briefcase,
      title: "Le mie candidature",
      subtitle: "Pipeline completa delle candidature",
      href: "/candidature",
      description: "Gestisci le tue candidature con un sistema Kanban. Tieni traccia di salvataggi, application, colloqui e offerte in un colpo d'occhio.",
      buttonText: "Gestisci",
    },
  ],
  autonomo: [
    {
      key: "wiki",
      icon: MessageSquare,
      title: "Ricerca mercati",
      subtitle: "Analisi AI dei settori",
      hrefTemplate: `${BASE}wiki/{sectorId}`,
      description: "Poni domande sui settori che ti interessano e ottieni analisi dettagliate su mercati, concorrenza e opportunità di business.",
      buttonText: "Ricerca",
    },
    {
      key: "grafo",
      icon: Network,
      title: "Rete di conoscenze",
      subtitle: "Connetti idee e risorse",
      href: "/archivio",
      description: "Mappa le connessioni tra settori, competenze e opportunità. Crea una rete di conoscenze per supportare le tue decisioni strategiche.",
      buttonText: "Apri rete",
    },
  ],
  azienda: [
    {
      key: "grafo",
      icon: Network,
      title: "Analisi settori",
      subtitle: "Mappa competenze e ruoli",
      href: "/archivio",
      description: "Esplora le connessioni tra settori, competenze e profili professionali per individuare i talenti migliori per la tua azienda.",
      buttonText: "Esplora",
    },
    {
      key: "roadmap",
      icon: Map,
      title: "Sviluppo talenti",
      subtitle: "Percorsi di crescita per il tuo team",
      hrefTemplate: `${BASE}roadmap/{sectorId}`,
      description: "Analizza i percorsi formativi disponibili per ogni settore e costruisci piani di sviluppo su misura per i tuoi collaboratori.",
      buttonText: "Vedi percorsi",
    },
  ],
  investitore: [
    {
      key: "wiki",
      icon: MessageSquare,
      title: "Ricerca settori",
      subtitle: "Analisi AI approfondita",
      hrefTemplate: `${BASE}wiki/{sectorId}`,
      description: "Interroga l'AI per ottenere analisi dettagliate su trend di mercato, crescita settoriale e opportunità di investimento.",
      buttonText: "Analizza",
    },
    {
      key: "roadmap",
      icon: Map,
      title: "Trend di crescita",
      subtitle: "Evoluzione dei settori",
      hrefTemplate: `${BASE}roadmap/{sectorId}`,
      description: "Visualizza l'evoluzione dei settori, i percorsi di sviluppo e le competenze emergenti per identificare le aree a più alto potenziale.",
      buttonText: "Vedi trend",
    },
  ],
};

function Header({ title, subtitle, icon: Icon, children }: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <h2 className="font-bold text-xl text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

const SECTION_DEFS: SectionDef[] = [
  {
    key: "highlight",
    render: (p) => <HighlightSection {...p} />,
  },
  {
    key: "features",
    render: (p) => (
      <FeatureSections
        journeyType={p.journeyType}
        {...(p.topSectorId !== undefined ? { topSectorId: p.topSectorId } : {})}
      />
    ),
  },
  {
    key: "personality",
    render: (p) => <PersonalitySection sessionDetail={p.sessionDetail} />,
    condition: (p) => p.journeyType !== "indeciso" && !!p.sessionDetail,
  },
];

export function DashboardSectionRenderer(props: DashboardSectionProps) {
  return (
    <div className="space-y-8">
      {SECTION_DEFS.map(({ key, render, condition }) => {
        if (condition && !condition(props)) return null;
        return <div key={key}>{render(props)}</div>;
      })}
    </div>
  );
}
