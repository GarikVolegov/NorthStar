import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  HelpCircle,
  Rocket,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { ElementType } from "react";

export type JourneyId =
  | "indeciso"
  | "dipendente"
  | "autonomo"
  | "azienda"
  | "investitore";

export type Horizon = "short" | "medium" | "open";

export interface Sector {
  id: number;
  name: string;
  icon: string;
  trend: string;
}

export interface OnboardingWizardProps {
  userId: number;
  userName: string;
  currentJourneyType?: string | null;
  sessionId?: number | null;
  topSectorName?: string | null;
  onClose: () => void;
  onComplete: (journeyType: JourneyId) => void;
}

export const PERSONAS: Array<{
  id: JourneyId;
  icon: ElementType;
  label: string;
  tagline: string;
  color: string;
  bg: string;
  border: string;
  nextHref: string;
  nextLabel: string;
}> = [
  {
    id: "indeciso",
    icon: HelpCircle,
    label: "Non so ancora cosa fare",
    tagline: "Esploro possibilita",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/40",
    nextHref: "/test",
    nextLabel: "Inizia il test RIASEC",
  },
  {
    id: "dipendente",
    icon: TrendingUp,
    label: "Voglio crescere nel lavoro",
    tagline: "Ho un impiego, voglio avanzare",
    color: "text-growth",
    bg: "bg-growth/10",
    border: "border-growth/40",
    nextHref: "/dashboard",
    nextLabel: "Vai alla dashboard",
  },
  {
    id: "autonomo",
    icon: Rocket,
    label: "Lavoro in proprio / startup",
    tagline: "Sono freelance o founder",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/40",
    nextHref: "/validatore-idea",
    nextLabel: "Valida la tua idea",
  },
  {
    id: "azienda",
    icon: Building2,
    label: "Cerco talenti per il mio team",
    tagline: "Assumo o valuto profili",
    color: "text-growth",
    bg: "bg-growth/10",
    border: "border-growth/40",
    nextHref: "/settori",
    nextLabel: "Esplora i profili",
  },
  {
    id: "investitore",
    icon: BarChart3,
    label: "Valuto opportunita di mercato",
    tagline: "Analisi e investimenti",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/40",
    nextHref: "/settori",
    nextLabel: "Vedi i settori",
  },
];

export const DEFAULT_PERSONA = PERSONAS[0]!;

export const HORIZON_OPTIONS: Array<{
  id: Horizon;
  icon: ElementType;
  label: string;
  sub: string;
}> = [
  {
    id: "short",
    icon: Zap,
    label: "Entro 1-3 mesi",
    sub: "Ho urgenza, voglio risultati rapidi",
  },
  {
    id: "medium",
    icon: Calendar,
    label: "Entro 6-12 mesi",
    sub: "Ho un piano, voglio costruire con calma",
  },
  {
    id: "open",
    icon: BookOpen,
    label: "Sto esplorando",
    sub: "Nessuna scadenza, solo curiosita",
  },
];

export const SKILL_SUGGESTIONS = [
  "Python",
  "SQL",
  "Comunicazione",
  "Leadership",
  "Marketing digitale",
  "Machine Learning",
  "UX Design",
  "Project Management",
  "React",
  "Data Analysis",
  "Inglese professionale",
  "Public Speaking",
  "Excel avanzato",
  "AI prompting",
];

export const STEP_LABELS = [
  "Chi sei?",
  "Cosa esplori?",
  "Orizzonte",
  "Sei pronto!",
];
