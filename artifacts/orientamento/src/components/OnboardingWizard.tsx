import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  X, ChevronRight, ChevronLeft, CheckCircle2, Target,
  Calendar, Loader2, Sparkles, HelpCircle, TrendingUp,
  Rocket, Building2, BarChart3, ArrowRight, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";

const BASE = import.meta.env.BASE_URL || "/";

/* ── Types ─────────────────────────────────────────────── */
type JourneyId = "indeciso" | "dipendente" | "autonomo" | "azienda" | "investitore";

interface Objective {
  text: string;
  category: string;
  dueDate: string;
}

interface OnboardingWizardProps {
  userId: number;
  userName: string;
  currentJourneyType?: string | null;
  sessionId?: number | null;
  topSectorName?: string | null;
  onClose: () => void;
  onComplete: (journeyType: JourneyId) => void;
}

/* ── Persona definitions ─────────────────────────────── */
const PERSONAS: Array<{
  id: JourneyId;
  icon: React.ElementType;
  label: string;
  tagline: string;
  color: string;
  bg: string;
  border: string;
  defaultObjectives: Array<{ text: string; category: string }>;
  nextHref: string;
  nextLabel: string;
}> = [
  {
    id: "indeciso",
    icon: HelpCircle,
    label: "Indeciso",
    tagline: "Non so ancora cosa fare",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/40",
    defaultObjectives: [
      { text: "Completare il test RIASEC per capire i miei punti di forza", category: "formazione" },
      { text: "Esplorare almeno 3 settori professionali che mi interessano", category: "formazione" },
      { text: "Parlare con un professionista del mio settore di interesse", category: "networking" },
    ],
    nextHref: "/test",
    nextLabel: "Inizia il test RIASEC",
  },
  {
    id: "dipendente",
    icon: TrendingUp,
    label: "Dipendente che vuole crescere",
    tagline: "Ho un lavoro e voglio avanzare",
    color: "text-[#A8D5BA]",
    bg: "bg-[#A8D5BA]/10",
    border: "border-[#A8D5BA]/40",
    defaultObjectives: [
      { text: "Completare l'analisi delle mie competenze e identificare i gap", category: "skill" },
      { text: "Fare una sessione di simulazione colloquio entro 2 settimane", category: "candidatura" },
      { text: "Aggiornare il CV e candidarmi a 3 posizioni target", category: "candidatura" },
    ],
    nextHref: "/dashboard",
    nextLabel: "Vai alla dashboard AI",
  },
  {
    id: "autonomo",
    icon: Rocket,
    label: "Autonomo che vuole scalare",
    tagline: "Lavoro in proprio e voglio crescere",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/40",
    defaultObjectives: [
      { text: "Validare la mia idea di business con l'AI validator", category: "altro" },
      { text: "Identificare i 3 mercati più promettenti per la mia attività", category: "formazione" },
      { text: "Creare un piano di acquisizione clienti per il prossimo trimestre", category: "altro" },
    ],
    nextHref: "/validatore-idea",
    nextLabel: "Valida la tua idea",
  },
  {
    id: "azienda",
    icon: Building2,
    label: "Azienda in cerca di talenti",
    tagline: "Cerco il profilo giusto per il mio team",
    color: "text-[#A8D5BA]",
    bg: "bg-[#A8D5BA]/10",
    border: "border-[#A8D5BA]/40",
    defaultObjectives: [
      { text: "Definire i profili RIASEC ideali per le posizioni aperte", category: "altro" },
      { text: "Analizzare i settori in crescita per orientare il recruiting", category: "formazione" },
      { text: "Pubblicare la prima offerta sulla piattaforma", category: "candidatura" },
    ],
    nextHref: "/settori",
    nextLabel: "Esplora i profili",
  },
  {
    id: "investitore",
    icon: BarChart3,
    label: "Investitore",
    tagline: "Valuto opportunità di mercato",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/40",
    defaultObjectives: [
      { text: "Analizzare i 5 settori con maggiore crescita in Italia", category: "formazione" },
      { text: "Identificare opportunità di investimento nel mercato del lavoro", category: "altro" },
      { text: "Valutare startup nel mio settore di interesse con il validator", category: "altro" },
    ],
    nextHref: "/settori",
    nextLabel: "Vedi i settori in crescita",
  },
];

const OBJ_CATEGORIES = ["formazione", "networking", "candidatura", "skill", "altro"];
const STEPS = ["Il tuo profilo", "I tuoi obiettivi", "Sei pronto!"];

/* ── Progress bar ─────────────────────────────────────── */
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 rounded-full flex-1 transition-all duration-500",
            i <= step ? "bg-primary" : "bg-white/10"
          )}
        />
      ))}
    </div>
  );
}

/* ── Main wizard ──────────────────────────────────────── */
export function OnboardingWizard({
  userId,
  userName,
  currentJourneyType,
  sessionId,
  topSectorName,
  onClose,
  onComplete,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [selectedJourney, setSelectedJourney] = useState<JourneyId>(
    (currentJourneyType as JourneyId) || "indeciso"
  );
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const persona = PERSONAS.find((p) => p.id === selectedJourney) ?? PERSONAS[0];

  function handleSelectJourney(id: JourneyId) {
    setSelectedJourney(id);
    // pre-fill objectives when journey changes
    const p = PERSONAS.find((x) => x.id === id)!;
    setObjectives(
      p.defaultObjectives.map((o) => ({
        text: o.text,
        category: o.category,
        dueDate: "",
      }))
    );
  }

  function updateObj(idx: number, field: keyof Objective, val: string) {
    setObjectives((prev) => prev.map((o, i) => (i === idx ? { ...o, [field]: val } : o)));
  }

  async function handleSaveJourney() {
    try {
      await apiFetch(`${BASE}api/profile/${userId}/journey-type`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyType: selectedJourney }),
      });
    } catch {
      // non-blocking
    }
  }

  async function handleFinish() {
    setSaving(true);
    try {
      const validObjs = objectives.filter((o) => o.text.trim());
      const results = await Promise.allSettled(
        validObjs.map((obj) =>
          apiFetch(`${BASE}api/objectives`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              text: obj.text.trim(),
              category: obj.category,
              dueDate: obj.dueDate || null,
            }),
          })
        )
      );
      setSavedCount(results.filter((r) => r.status === "fulfilled").length);
    } catch {
      setSavedCount(0);
    } finally {
      setSaving(false);
      setStep(2);
    }
  }

  async function goToStep1() {
    await handleSaveJourney();
    // pre-fill objectives if empty
    if (objectives.length === 0) {
      setObjectives(
        persona.defaultObjectives.map((o) => ({
          text: o.text,
          category: o.category,
          dueDate: "",
        }))
      );
    }
    setStep(1);
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg"
      >
        <div className="rounded-2xl border border-white/10 bg-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="hero-navy px-6 pt-6 pb-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-0.5">
                  Passo {step + 1} di {STEPS.length}
                </p>
                <h2 className="text-lg font-bold text-white">{STEPS[step]}</h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={16} />
              </button>
            </div>
            <ProgressBar step={step} total={STEPS.length} />
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <AnimatePresence mode="wait">

              {/* ── Step 0: Journey type ────────────────── */}
              {step === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-3"
                >
                  <p className="text-sm text-muted-foreground mb-4">
                    Ciao <strong className="text-foreground">{userName.split(" ")[0]}</strong>!
                    {topSectorName
                      ? ` Il tuo profilo si adatta bene a settori come ${topSectorName}. `
                      : " "}
                    Quale tra questi descrive meglio la tua situazione?
                  </p>

                  <div className="space-y-2">
                    {PERSONAS.map((p) => {
                      const Icon = p.icon;
                      const isSelected = selectedJourney === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleSelectJourney(p.id)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-150",
                            isSelected
                              ? `${p.border} bg-primary/5`
                              : "border-border hover:border-white/20 hover:bg-white/3"
                          )}
                        >
                          <div className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all",
                            isSelected ? `${p.bg} border ${p.border}` : "bg-muted"
                          )}>
                            <Icon className={cn("w-5 h-5", isSelected ? p.color : "text-muted-foreground")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("font-semibold text-sm", isSelected ? "text-foreground" : "text-foreground/80")}>
                              {p.label}
                            </p>
                            <p className={cn("text-xs", isSelected ? p.color : "text-muted-foreground")}>
                              {p.tagline}
                            </p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 size={16} className="text-primary shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-end pt-3">
                    <Button onClick={goToStep1} className="rounded-full px-6 gap-2">
                      Continua <ChevronRight size={16} />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ── Step 1: Objectives ──────────────────── */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <p className="text-sm text-muted-foreground">
                    Abbiamo pre-compilato 3 obiettivi per il tuo percorso da{" "}
                    <strong className={cn("font-semibold", persona.color)}>{persona.label}</strong>.
                    Modificali o confermali — li troverai nel tuo calendario.
                  </p>

                  <div className="space-y-3">
                    {objectives.map((obj, idx) => (
                      <div key={idx} className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0">
                            {idx + 1}
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">
                            Obiettivo {idx + 1}
                            {idx > 0 && <span className="ml-1 opacity-60">(modificabile)</span>}
                          </span>
                        </div>
                        <Input
                          value={obj.text}
                          onChange={(e) => updateObj(idx, "text", e.target.value)}
                          className="text-sm bg-background/50"
                          placeholder="Descrivi il tuo obiettivo…"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={obj.category}
                            onChange={(e) => updateObj(idx, "category", e.target.value)}
                            className="text-xs border border-border rounded-md px-2.5 py-1.5 bg-background text-foreground"
                          >
                            {OBJ_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c.charAt(0).toUpperCase() + c.slice(1)}
                              </option>
                            ))}
                          </select>
                          <Input
                            type="date"
                            value={obj.dueDate}
                            onChange={(e) => updateObj(idx, "dueDate", e.target.value)}
                            className="text-xs bg-background/50"
                            placeholder="Scadenza (opz.)"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between pt-1">
                    <Button variant="outline" onClick={() => setStep(0)} className="rounded-full gap-2">
                      <ChevronLeft size={16} /> Indietro
                    </Button>
                    <Button
                      onClick={handleFinish}
                      disabled={saving || objectives.filter((o) => o.text.trim()).length === 0}
                      className="rounded-full px-6 gap-2"
                    >
                      {saving ? (
                        <><Loader2 size={14} className="animate-spin" /> Salvando…</>
                      ) : (
                        <><Target size={14} /> Salva e procedi</>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ── Step 2: Confirmation ────────────────── */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5"
                >
                  {/* Success checkmark */}
                  <div className="flex flex-col items-center text-center py-2">
                    <motion.div
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 20 }}
                      className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mb-4"
                    >
                      <CheckCircle2 size={32} className="text-primary" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-foreground">Sei pronto!</h3>
                    <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">
                      Il tuo percorso da{" "}
                      <strong className={cn("font-semibold", persona.color)}>{persona.label}</strong>{" "}
                      è configurato.
                      {savedCount > 0 && ` ${savedCount} obiettiv${savedCount > 1 ? "i" : "o"} salvat${savedCount > 1 ? "i" : "o"} nel calendario.`}
                    </p>
                  </div>

                  {/* Recap chips */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: MapPin,      label: "Percorso",    value: persona.label },
                      { icon: Target,      label: "Obiettivi",   value: `${savedCount} salvati` },
                      { icon: Sparkles,    label: "Strumenti",   value: "Personalizzati" },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                        <Icon className="w-4 h-4 text-primary mx-auto mb-1" />
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                        <p className="text-xs font-bold text-foreground mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Primary CTA */}
                  <Link href={persona.nextHref}>
                    <div
                      onClick={() => onComplete(selectedJourney)}
                      className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground font-bold rounded-full py-3 hover:bg-primary/90 transition-all cursor-pointer"
                    >
                      {persona.nextLabel} <ArrowRight size={16} />
                    </div>
                  </Link>

                  {/* Secondary */}
                  <div className="flex gap-2">
                    <Link href="/calendario" className="flex-1">
                      <div
                        onClick={() => onComplete(selectedJourney)}
                        className="flex items-center justify-center gap-1.5 w-full border border-border rounded-full py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-white/20 transition-all cursor-pointer"
                      >
                        <Calendar size={14} /> Calendario
                      </div>
                    </Link>
                    <button
                      onClick={() => onComplete(selectedJourney)}
                      className="flex-1 border border-border rounded-full py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
                    >
                      Vai alla home
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
