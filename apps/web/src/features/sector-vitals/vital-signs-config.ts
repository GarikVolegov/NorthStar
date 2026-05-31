import {
  Activity,
  Gauge,
  Thermometer,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { VitalKey, VitalStatus } from "@workspace/api-client-react";

export const VITAL_ORDER: VitalKey[] = ["pulse", "oxygen", "temperature", "pressure", "adrenaline"];

export interface VitalSignMeta {
  label: string;
  plainLabel: string;
  unit: string;
  description: string;
  sourceLabel: string;
  icon: LucideIcon;
}

export const VITAL_SIGN_META: Record<VitalKey, VitalSignMeta> = {
  pulse: {
    label: "Pulse",
    plainLabel: "Domanda",
    unit: "post",
    description: "Ritmo della domanda di lavoro nel settore negli ultimi 12 mesi.",
    sourceLabel: "job_posting_snapshots",
    icon: Activity,
  },
  oxygen: {
    label: "Oxygen",
    plainLabel: "Varieta ruoli",
    unit: "ruoli",
    description: "Ampiezza dei ruoli disponibili e comparsa di nuovi titoli professionali.",
    sourceLabel: "job_posting_snapshots + weak_signals",
    icon: Wind,
  },
  temperature: {
    label: "Temperature",
    plainLabel: "Attenzione",
    unit: "cit.",
    description: "Intensita editoriale e formativa da news e articoli growth collegati al settore.",
    sourceLabel: "news_articles + growth_articles",
    icon: Thermometer,
  },
  pressure: {
    label: "Pressure",
    plainLabel: "Pressione",
    unit: "ruoli",
    description: "Proxy di competizione: distribuzione dei role title quando non sono presenti aziende/employer.",
    sourceLabel: "job_posting_snapshots role competition proxy",
    icon: Gauge,
  },
  adrenaline: {
    label: "Adrenaline",
    plainLabel: "Segnali emergenti",
    unit: "pts",
    description: "Forza media dei segnali deboli emergenti sopra soglia.",
    sourceLabel: "weak_signals emerging strength",
    icon: Zap,
  },
};

export const STATUS_STYLES: Record<VitalStatus, { label: string; badge: string; stroke: string; fill: string }> = {
  green: {
    label: "stabile",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    stroke: "#059669",
    fill: "#d1fae5",
  },
  yellow: {
    label: "da monitorare",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    stroke: "#d97706",
    fill: "#fef3c7",
  },
  red: {
    label: "critico",
    badge: "border-red-200 bg-red-50 text-red-700",
    stroke: "#dc2626",
    fill: "#fee2e2",
  },
};
