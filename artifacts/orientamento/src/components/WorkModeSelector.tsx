import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase, Laptop, GitMerge, HelpCircle, ChevronDown, ChevronUp, ArrowRight, CheckCircle2,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

const BASE = import.meta.env.BASE_URL || "/";

export type WorkPreference = "dipendente" | "autonomo" | "ibrido" | "unknown";

const WORK_MODE_OPTIONS: Array<{
  value: WorkPreference;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  selectedColor: string;
}> = [
  {
    value: "dipendente",
    label: "Dipendente",
    sublabel: "Lavoratore dipendente",
    icon: <Briefcase className="w-6 h-6" />,
    description: "Contratto fisso, stipendio mensile, team strutturato e carriera in azienda.",
    color: "border-blue-200 hover:border-blue-400 hover:bg-blue-50/50",
    selectedColor: "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20",
  },
  {
    value: "autonomo",
    label: "Autonomo / Freelance",
    sublabel: "Libero professionista",
    icon: <Laptop className="w-6 h-6" />,
    description: "Lavoro per conto proprio, clienti multipli, piena libertà di orari e progetto.",
    color: "border-violet-200 hover:border-violet-400 hover:bg-violet-50/50",
    selectedColor: "border-violet-500 bg-violet-50 ring-2 ring-violet-500/20",
  },
  {
    value: "ibrido",
    label: "Ibrido",
    sublabel: "Flessibilità mista",
    icon: <GitMerge className="w-6 h-6" />,
    description: "Combina stabilità e autonomia: consulenza, part-time, contratti flessibili.",
    color: "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50",
    selectedColor: "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20",
  },
  {
    value: "unknown",
    label: "Non lo so ancora",
    sublabel: "Aiutami a scegliere",
    icon: <HelpCircle className="w-6 h-6" />,
    description: "Non hai ancora le idee chiare? Ti mostriamo un confronto per aiutarti a decidere.",
    color: "border-amber-200 hover:border-amber-400 hover:bg-amber-50/50",
    selectedColor: "border-amber-500 bg-amber-50 ring-2 ring-amber-500/20",
  },
];

const COMPARISON_ROWS: Array<{
  dimension: string;
  dipendente: string;
  autonomo: string;
  icon: string;
}> = [
  {
    dimension: "Libertà",
    dipendente: "Limitata — orari e progetti decisi dall'azienda",
    autonomo: "Massima — scegli clienti, orari e modalità",
    icon: "🕊️",
  },
  {
    dimension: "Stabilità",
    dipendente: "Alta — stipendio fisso, contributi automatici",
    autonomo: "Variabile — dipende dai clienti e dal mercato",
    icon: "⚖️",
  },
  {
    dimension: "Rischio finanziario",
    dipendente: "Basso — protezioni contrattuali e TFR",
    autonomo: "Alto — no reddito garantito nei periodi vuoti",
    icon: "📉",
  },
  {
    dimension: "Gestione clienti",
    dipendente: "Non richiesta — ci pensa l'azienda",
    autonomo: "Essenziale — devi trovare e mantenere i clienti",
    icon: "🤝",
  },
  {
    dimension: "Orari",
    dipendente: "Strutturati — solitamente 9-18 in sede o smart",
    autonomo: "Flessibili — ma richiedono autodisciplina",
    icon: "⏰",
  },
  {
    dimension: "Crescita economica",
    dipendente: "Graduale — aumenti e promozioni aziendali",
    autonomo: "Potenzialmente alta — scala con clienti e tariffe",
    icon: "📈",
  },
  {
    dimension: "Complessità amm.",
    dipendente: "Bassa — busta paga gestita dall'azienda",
    autonomo: "Alta — Partita IVA, fatture, tasse, contributi",
    icon: "🗂️",
  },
  {
    dimension: "Comunità",
    dipendente: "Alta — colleghi, team, cultura aziendale",
    autonomo: "Dipende da te — rischio isolamento senza sforzo",
    icon: "👥",
  },
];

interface WorkModeSelectorProps {
  suggestedMode?: WorkPreference;
  suggestedLabel?: string;
  initialValue?: WorkPreference;
  onSelect: (mode: WorkPreference) => void;
  isPending?: boolean;
}

export function WorkModeSelector({
  suggestedMode,
  suggestedLabel,
  initialValue,
  onSelect,
  isPending,
}: WorkModeSelectorProps) {
  const [selected, setSelected] = useState<WorkPreference | null>(initialValue ?? null);
  const [showComparison, setShowComparison] = useState(false);

  const handleSelect = (mode: WorkPreference) => {
    setSelected(mode);
    if (mode === "unknown") {
      setShowComparison(true);
    }
  };

  const handleConfirm = () => {
    if (selected) onSelect(selected);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-3">
          Come vuoi lavorare?
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          La tua preferenza influenza il ranking dei settori consigliati e i percorsi di carriera mostrati.
        </p>
        {suggestedMode && suggestedLabel && (
          <div className="inline-flex items-center gap-2 mt-4 bg-primary/5 border border-primary/20 rounded-full px-4 py-2 text-sm">
            <span className="text-primary font-medium">💡 Il tuo profilo RIASEC suggerisce:</span>
            <Badge variant="secondary" className="capitalize font-semibold">{suggestedLabel}</Badge>
          </div>
        )}
      </div>

      {/* Option Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {WORK_MODE_OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className={cn(
                "flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer",
                isSelected ? opt.selectedColor : opt.color,
              )}
            >
              <div className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-foreground">{opt.label}</span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mb-1">{opt.sublabel}</p>
                <p className="text-sm text-foreground/70 leading-relaxed">{opt.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Comparison panel for "Non lo so ancora" */}
      {selected === "unknown" && (
        <div className="mb-6 rounded-2xl border bg-card overflow-hidden animate-in fade-in slide-in-from-top-2 duration-500">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span>📊</span> Confronto Dipendente vs Autonomo
            </span>
            {showComparison ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showComparison && (
            <div className="border-t">
              {/* Personality suggestion */}
              {suggestedMode && suggestedMode !== "unknown" && (
                <div className="px-5 py-4 bg-primary/5 border-b flex items-start gap-3">
                  <span className="text-xl">🔭</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">
                      Il tuo profilo RIASEC tende verso: <span className="text-primary capitalize">{suggestedLabel}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Questo non è un giudizio definitivo — è un punto di partenza per la riflessione. La scelta finale spetta solo a te.
                    </p>
                  </div>
                </div>
              )}

              {/* Comparison table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-36">Dimensione</th>
                      <th className="px-4 py-3 text-center min-w-[180px]">
                        <div className="flex flex-col items-center gap-1">
                          <Briefcase className="w-4 h-4 text-blue-500" />
                          <span className="font-semibold text-blue-700">Dipendente</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center min-w-[180px]">
                        <div className="flex flex-col items-center gap-1">
                          <Laptop className="w-4 h-4 text-violet-500" />
                          <span className="font-semibold text-violet-700">Autonomo</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {COMPARISON_ROWS.map((row) => (
                      <tr key={row.dimension} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                          <span className="mr-1.5">{row.icon}</span>
                          {row.dimension}
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground text-xs leading-relaxed">
                          {row.dipendente}
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground text-xs leading-relaxed">
                          {row.autonomo}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Choose anyway CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 px-5 py-4 border-t bg-muted/20">
                <p className="text-xs text-muted-foreground self-center mr-2 shrink-0">Scegli comunque:</p>
                <button
                  onClick={() => { setSelected("dipendente"); setShowComparison(false); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl border-2 border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors text-sm font-semibold"
                >
                  <Briefcase className="w-4 h-4" /> Dipendente
                </button>
                <button
                  onClick={() => { setSelected("autonomo"); setShowComparison(false); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl border-2 border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors text-sm font-semibold"
                >
                  <Laptop className="w-4 h-4" /> Autonomo
                </button>
                <button
                  onClick={() => { setSelected("ibrido"); setShowComparison(false); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl border-2 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors text-sm font-semibold"
                >
                  <GitMerge className="w-4 h-4" /> Ibrido
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm button */}
      {selected && (
        <div className="flex justify-center animate-in fade-in duration-300">
          <Button
            size="lg"
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-full px-10"
          >
            Conferma preferenza <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function WorkModeBadge({
  modes,
  size = "sm",
}: {
  modes: Array<"dipendente" | "autonomo" | "ibrido"> | null | undefined;
  size?: "xs" | "sm";
}) {
  if (!modes || modes.length === 0) return null;

  const MODE_STYLES: Record<string, string> = {
    dipendente: "bg-blue-50 text-blue-700 border-blue-200",
    autonomo: "bg-violet-50 text-violet-700 border-violet-200",
    ibrido: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  const MODE_LABELS: Record<string, string> = {
    dipendente: "Dipendente",
    autonomo: "Autonomo",
    ibrido: "Ibrido",
  };

  const textSize = size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";

  return (
    <div className="flex flex-wrap gap-1">
      {modes.map((mode) => (
        <span
          key={mode}
          className={cn(
            "inline-flex items-center rounded-full border font-medium",
            textSize,
            MODE_STYLES[mode] ?? "bg-muted text-muted-foreground border-border",
          )}
        >
          {MODE_LABELS[mode] ?? mode}
        </span>
      ))}
    </div>
  );
}

export function useWorkPreference(userId: number | undefined) {
  const [workPreference, setWorkPreference] = React.useState<WorkPreference>("unknown");
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!userId) return;
    apiFetch(`${BASE}api/users/me/work-preference`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.workPreference) setWorkPreference(d.workPreference as WorkPreference);
      })
      .catch(() => {});
  }, [userId]);

  const save = React.useCallback(async (mode: WorkPreference) => {
    setIsLoading(true);
    try {
      const res = await apiFetch(`${BASE}api/users/me/work-preference`, {
        method: "PATCH",
        body: JSON.stringify({ workPreference: mode }),
      });
      if (res.ok) setWorkPreference(mode);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { workPreference, setWorkPreference, save, isLoading };
}
