import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BrainCircuit, CalendarDays, Check, Clock3, Compass, Pencil, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

export type ProfilingDimension =
  | "big_five"
  | "values"
  | "motivation"
  | "linguistic"
  | "behavioral_passive"
  | "chronotype";

export interface ProfilingConsent {
  dimension: ProfilingDimension;
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
}

export interface PsychologicalProfilePayload {
  ocean?: {
    openness?: number | null;
    conscientiousness?: number | null;
    extraversion?: number | null;
    agreeableness?: number | null;
    neuroticism?: number | null;
  };
  oceanSource?: "explicit" | "inferred" | "hybrid" | null;
  oceanConfidence?: number | null;
  chronotype?: "morning" | "intermediate" | "evening" | null;
  chronotypeConfidence?: number | null;
  decisionStyle?: "analytical" | "directive" | "intuitive" | "collaborative" | null;
  riskTolerance?: "conservative" | "moderate" | "bold" | null;
  communicationStyle?: "concise" | "detailed" | "visual" | "narrative" | null;
  sdt?: {
    autonomy?: number | null;
    competence?: number | null;
    relatedness?: number | null;
  };
  mcclelland?: {
    achievement?: number | null;
    affiliation?: number | null;
    power?: number | null;
  };
  primarySdtNeed?: "autonomy" | "competence" | "relatedness" | null;
  schwartz?: Record<string, number | null | undefined>;
  primaryValues?: string[];
  sourceLabel?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PsychologicalProfileResponse {
  profile: PsychologicalProfilePayload;
  consents: ProfilingConsent[];
}

export interface PsychologicalProfilePatch {
  profile?: Partial<PsychologicalProfilePayload>;
  consents?: Partial<Record<ProfilingDimension, true>>;
}

const OCEAN_LABELS = {
  openness: "Apertura",
  conscientiousness: "Coscienziosità",
  extraversion: "Estroversione",
  agreeableness: "Gradevolezza",
  neuroticism: "Neuroticismo",
} as const;

const VALUE_LABELS: Record<string, string> = {
  self_direction: "Autonomia e curiosità",
  stimulation: "Novità e stimolo",
  hedonism: "Piacere",
  achievement: "Successo",
  power: "Influenza",
  security: "Sicurezza",
  conformity: "Regole",
  tradition: "Tradizione",
  benevolence: "Benevolenza",
  universalism: "Giustizia",
};

const SDT_LABELS = {
  autonomy: "Autonomia",
  competence: "Competenza",
  relatedness: "Relazioni",
} as const;

const CHRONOTYPE_LABELS = {
  morning: "Mattutino",
  intermediate: "Intermedio",
  evening: "Serale",
} as const;

const DECISION_LABELS = {
  analytical: "Analitico",
  directive: "Direttivo",
  intuitive: "Intuitivo",
  collaborative: "Collaborativo",
} as const;

const RISK_LABELS = {
  conservative: "Conservativo",
  moderate: "Moderato",
  bold: "Audace",
} as const;

const COMMUNICATION_LABELS = {
  concise: "Conciso",
  detailed: "Dettagliato",
  visual: "Visivo",
  narrative: "Narrativo",
} as const;

function pct(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

function formatDate(iso?: string | null) {
  if (!iso) return "Mai aggiornato";
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function hasAnyProfile(profile: PsychologicalProfilePayload) {
  return !!(
    profile.ocean ||
    profile.primaryValues?.length ||
    profile.sdt ||
    profile.chronotype ||
    profile.decisionStyle ||
    profile.riskTolerance ||
    profile.communicationStyle
  );
}

function Meter({ label, value, tone }: { label: string; value: number | null | undefined; tone: string }) {
  const width = pct(value);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{width}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          role="meter"
          aria-label={`${label}: ${width}%`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={width}
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${Math.max(4, width)}%` }}
        />
      </div>
    </div>
  );
}

export function PsychologicalProfileCard({
  data,
  onOverride,
  isSaving = false,
}: {
  data: PsychologicalProfileResponse;
  onOverride: (patch: PsychologicalProfilePatch) => Promise<void> | void;
  isSaving?: boolean;
}) {
  const profile = data.profile;
  const [editing, setEditing] = useState(false);
  const [decisionStyle, setDecisionStyle] = useState(profile.decisionStyle ?? "");
  const [riskTolerance, setRiskTolerance] = useState(profile.riskTolerance ?? "");
  const [communicationStyle, setCommunicationStyle] = useState(profile.communicationStyle ?? "");
  const [chronotype, setChronotype] = useState(profile.chronotype ?? "");
  const [error, setError] = useState<string | null>(null);

  const radarData = useMemo(
    () =>
      Object.entries(OCEAN_LABELS).map(([key, label]) => ({
        key,
        subject: label,
        value: pct(profile.ocean?.[key as keyof typeof OCEAN_LABELS]),
      })),
    [profile.ocean],
  );
  const hasOcean = radarData.some((item) => item.value > 0);

  async function submitOverride() {
    setError(null);
    const patch: PsychologicalProfilePatch = { profile: {}, consents: {} };
    if (decisionStyle && decisionStyle !== profile.decisionStyle) {
      patch.profile!.decisionStyle = decisionStyle as NonNullable<PsychologicalProfilePayload["decisionStyle"]>;
      patch.consents!.behavioral_passive = true;
    }
    if (riskTolerance && riskTolerance !== profile.riskTolerance) {
      patch.profile!.riskTolerance = riskTolerance as NonNullable<PsychologicalProfilePayload["riskTolerance"]>;
      patch.consents!.behavioral_passive = true;
    }
    if (communicationStyle && communicationStyle !== profile.communicationStyle) {
      patch.profile!.communicationStyle = communicationStyle as NonNullable<PsychologicalProfilePayload["communicationStyle"]>;
      patch.consents!.behavioral_passive = true;
    }
    if (chronotype && chronotype !== profile.chronotype) {
      patch.profile!.chronotype = chronotype as NonNullable<PsychologicalProfilePayload["chronotype"]>;
      patch.consents!.chronotype = true;
    }

    if (Object.keys(patch.profile ?? {}).length === 0) {
      setEditing(false);
      return;
    }

    try {
      await onOverride(patch);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore salvataggio");
    }
  }

  if (!hasAnyProfile(profile)) {
    return (
      <section className="rounded-2xl border bg-card p-5 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border bg-muted/50">
          <BrainCircuit className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="text-base font-semibold text-foreground">Profilo Psicologico</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Profilo psicologico non ancora disponibile. I dati appariranno qui dopo quiz, consensi o osservazioni Wendy.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <BrainCircuit className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight text-foreground">Profilo Psicologico</h2>
              <p className="text-xs text-muted-foreground">Aggiornato il {formatDate(profile.updatedAt)}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.sourceLabel && (
              <span className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                {profile.sourceLabel}
              </span>
            )}
            {typeof profile.oceanConfidence === "number" && (
              <span className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Confidenza {pct(profile.oceanConfidence)}%
              </span>
            )}
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2 rounded-full" onClick={() => setEditing((v) => !v)}>
          <Pencil className="h-3.5 w-3.5" />
          Correggi questo
        </Button>
      </div>

      {editing && (
        <div className="mb-5 rounded-xl border bg-muted/20 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Stile decisionale
              <select className="rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={decisionStyle} onChange={(event) => setDecisionStyle(event.target.value)}>
                <option value="">Non impostato</option>
                {Object.entries(DECISION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Tolleranza rischio
              <select className="rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={riskTolerance} onChange={(event) => setRiskTolerance(event.target.value)}>
                <option value="">Non impostata</option>
                {Object.entries(RISK_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Comunicazione
              <select className="rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={communicationStyle} onChange={(event) => setCommunicationStyle(event.target.value)}>
                <option value="">Non impostata</option>
                {Object.entries(COMMUNICATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Cronotipo
              <select className="rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={chronotype} onChange={(event) => setChronotype(event.target.value)}>
                <option value="">Non impostato</option>
                {Object.entries(CHRONOTYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Annulla</Button>
            <Button type="button" size="sm" className="gap-2" disabled={isSaving} onClick={() => void submitOverride()}>
              <Check className="h-3.5 w-3.5" />
              Salva correzione
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
        {hasOcean && (
          <div className="rounded-xl border bg-background/60 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Big Five</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="65%">
                  <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.6} />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.18} strokeWidth={1.6} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.chronotype && (
              <div className="rounded-xl border bg-background/60 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" /> Cronotipo
                </div>
                <p className="font-semibold text-foreground">{CHRONOTYPE_LABELS[profile.chronotype]}</p>
              </div>
            )}
            {profile.decisionStyle && (
              <div className="rounded-xl border bg-background/60 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Compass className="h-3.5 w-3.5" /> Decisioni
                </div>
                <p className="font-semibold text-foreground">{DECISION_LABELS[profile.decisionStyle]}</p>
              </div>
            )}
          </div>

          {profile.primaryValues && profile.primaryValues.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valori core</p>
              <div className="flex flex-wrap gap-2">
                {profile.primaryValues.slice(0, 3).map((value) => (
                  <span key={value} className="rounded-full border bg-growth/10 px-3 py-1 text-xs font-medium text-foreground">
                    {VALUE_LABELS[value] ?? value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.sdt && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profilo motivazionale</p>
              <div className="space-y-3">
                <Meter label={SDT_LABELS.autonomy} value={profile.sdt.autonomy} tone="bg-primary/70" />
                <Meter label={SDT_LABELS.competence} value={profile.sdt.competence} tone="bg-growth/70" />
                <Meter label={SDT_LABELS.relatedness} value={profile.sdt.relatedness} tone="bg-info/70" />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            Ultimo aggiornamento: {formatDate(profile.updatedAt)}
          </div>
        </div>
      </div>
    </section>
  );
}
