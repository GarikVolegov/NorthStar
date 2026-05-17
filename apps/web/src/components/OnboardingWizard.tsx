/**
 * OnboardingWizard — wizard adattivo in 4 step per nuovi utenti.
 *
 * Step 0 — Chi sei?        (journeyType)
 * Step 1 — Cosa esplori?   (settori preferiti + skill goals)
 * Step 2 — Orizzonte       (timeline)
 * Step 3 — Sei pronto!     (recap + primo messaggio Wendy)
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  X, ChevronRight, ChevronLeft, CheckCircle2, Target,
  Loader2, Sparkles, HelpCircle, TrendingUp, Rocket,
  Building2, BarChart3, ArrowRight, Clock, Zap,
  Calendar, BookOpen, Briefcase,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";

const BASE = import.meta.env.BASE_URL || "/";

/* ── Types ─────────────────────────────────────────────── */
type JourneyId = "indeciso" | "dipendente" | "autonomo" | "azienda" | "investitore";
type Horizon   = "short" | "medium" | "open";

interface Sector { id: number; name: string; icon: string; trend: string }

interface OnboardingWizardProps {
  userId:              number;
  userName:            string;
  currentJourneyType?: string | null;
  sessionId?:          number | null;
  topSectorName?:      string | null;
  onClose:             () => void;
  onComplete:          (journeyType: JourneyId) => void;
}

/* ── Persona definitions ─────────────────────────────── */
const PERSONAS: Array<{
  id: JourneyId; icon: React.ElementType; label: string; tagline: string;
  color: string; bg: string; border: string; nextHref: string; nextLabel: string;
}> = [
  { id: "indeciso",   icon: HelpCircle,  label: "Non so ancora cosa fare", tagline: "Esploro possibilità", color: "text-primary", bg: "bg-primary/10", border: "border-primary/40", nextHref: "/test", nextLabel: "Inizia il test RIASEC" },
  { id: "dipendente", icon: TrendingUp,  label: "Voglio crescere nel lavoro", tagline: "Ho un impiego, voglio avanzare", color: "text-growth", bg: "bg-growth/10", border: "border-growth/40", nextHref: "/dashboard", nextLabel: "Vai alla dashboard" },
  { id: "autonomo",   icon: Rocket,      label: "Lavoro in proprio / startup", tagline: "Sono freelance o founder", color: "text-primary", bg: "bg-primary/10", border: "border-primary/40", nextHref: "/validatore-idea", nextLabel: "Valida la tua idea" },
  { id: "azienda",    icon: Building2,   label: "Cerco talenti per il mio team", tagline: "Assumo o valuto profili", color: "text-growth", bg: "bg-growth/10", border: "border-growth/40", nextHref: "/settori", nextLabel: "Esplora i profili" },
  { id: "investitore",icon: BarChart3,   label: "Valuto opportunità di mercato", tagline: "Analisi e investimenti", color: "text-primary", bg: "bg-primary/10", border: "border-primary/40", nextHref: "/settori", nextLabel: "Vedi i settori" },
];

const HORIZON_OPTIONS: Array<{ id: Horizon; icon: React.ElementType; label: string; sub: string }> = [
  { id: "short",  icon: Zap,      label: "Entro 1–3 mesi",    sub: "Ho urgenza, voglio risultati rapidi" },
  { id: "medium", icon: Calendar, label: "Entro 6–12 mesi",   sub: "Ho un piano, voglio costruire con calma" },
  { id: "open",   icon: BookOpen, label: "Sto esplorando",     sub: "Nessuna scadenza, solo curiosità" },
];

const SKILL_SUGGESTIONS = [
  "Python", "SQL", "Comunicazione", "Leadership", "Marketing digitale",
  "Machine Learning", "UX Design", "Project Management", "React", "Data Analysis",
  "Inglese professionale", "Public Speaking", "Excel avanzato", "AI prompting",
];

/* ── Progress bar ─────────────────────────────────────── */
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={cn(
          "h-1.5 rounded-full flex-1 transition-all duration-500",
          i <= step ? "bg-primary" : "bg-white/10",
        )} />
      ))}
    </div>
  );
}

const STEP_LABELS = ["Chi sei?", "Cosa esplori?", "Orizzonte", "Sei pronto!"];

/* ── Main wizard ──────────────────────────────────────── */
export function OnboardingWizard({
  userId, userName, currentJourneyType, topSectorName,
  onClose, onComplete,
}: OnboardingWizardProps) {
  const [step, setStep]               = useState(0);
  const [selectedJourney, setJourney] = useState<JourneyId>((currentJourneyType as JourneyId) || "indeciso");
  const [selectedSectors, setSectors] = useState<number[]>([]);
  const [skillGoals, setSkillGoals]   = useState<string[]>([]);
  const [skillInput, setSkillInput]   = useState("");
  const [horizon, setHorizon]         = useState<Horizon>("open");
  const [openNote, setOpenNote]       = useState("");
  const [saving, setSaving]           = useState(false);
  const [, setLocation]               = useLocation();

  const persona = PERSONAS.find((p) => p.id === selectedJourney) ?? PERSONAS[0];

  // Carica settori per la selezione
  const { data: sectorsData } = useQuery<{ sectors: Sector[] }>({
    queryKey: ["onboarding-sectors"],
    queryFn:  async () => { const r = await apiFetch(`${BASE}api/sectors`); if (!r.ok) return { sectors: [] }; return r.json(); },
    staleTime: 10 * 60 * 1000,
  });
  const sectors = sectorsData?.sectors ?? [];

  function toggleSector(id: number) {
    setSectors((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : prev.length < 3 ? [...prev, id] : prev,
    );
  }

  function addSkill(skill: string) {
    const s = skill.trim();
    if (!s || skillGoals.includes(s) || skillGoals.length >= 5) return;
    setSkillGoals((prev) => [...prev, s]);
    setSkillInput("");
  }

  function removeSkill(skill: string) {
    setSkillGoals((prev) => prev.filter((s) => s !== skill));
  }

  async function handleComplete() {
    setSaving(true);
    try {
      await apiFetch(`${BASE}api/onboarding/complete`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          journeyType:  selectedJourney,
          sectorIds:    selectedSectors,
          skillGoals,
          horizon,
          openNote:     openNote.trim() || undefined,
        }),
      });
    } catch {
      // non-blocking — l'utente va avanti comunque
    } finally {
      setSaving(false);
      setStep(3);
    }
  }

  const slideIn = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 } };
  const transition = { duration: 0.22, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 32 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 20 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full sm:max-w-lg flex flex-col"
      >
        <div className="rounded-t-3xl sm:rounded-2xl border border-white/10 bg-card shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[88vh]">
          {/* Drag handle mobile */}
          <div className="flex justify-center pt-2.5 pb-0 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-white/15" />
          </div>

          {/* Header */}
          <div className="hero-navy px-5 sm:px-6 pt-4 sm:pt-5 pb-4 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-0.5">
                  Passo {step + 1} di {STEP_LABELS.length}
                </p>
                <h2 className="text-lg font-bold text-white">{STEP_LABELS[step]}</h2>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <X size={16} />
              </button>
            </div>
            <ProgressBar step={step} total={STEP_LABELS.length} />
          </div>

          {/* Scrollable body */}
          <div className="px-5 sm:px-6 py-4 overflow-y-auto flex-1">
            <AnimatePresence mode="wait">

              {/* ── Step 0: Chi sei? ─────────────────────── */}
              {step === 0 && (
                <motion.div key="s0" {...slideIn} transition={transition} className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-3">
                    Ciao <strong className="text-foreground">{userName.split(" ")[0]}</strong>!
                    {topSectorName ? ` Il tuo profilo risuona con settori come ${topSectorName}.` : " "}
                    Qual è la tua situazione?
                  </p>
                  <div className="space-y-2">
                    {PERSONAS.map((p) => {
                      const Icon = p.icon;
                      const sel  = selectedJourney === p.id;
                      return (
                        <button key={p.id} onClick={() => setJourney(p.id)}
                          className={cn("w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-150",
                            sel ? `${p.border} bg-primary/5` : "border-border hover:border-white/20 hover:bg-white/3")}>
                          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all",
                            sel ? `${p.bg} border ${p.border}` : "bg-muted")}>
                            <Icon className={cn("w-5 h-5", sel ? p.color : "text-muted-foreground")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("font-semibold text-sm", sel ? "text-foreground" : "text-foreground/80")}>{p.label}</p>
                            <p className={cn("text-xs", sel ? p.color : "text-muted-foreground")}>{p.tagline}</p>
                          </div>
                          {sel && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Note libere opzionali */}
                  <div className="pt-2">
                    <Input
                      value={openNote}
                      onChange={(e) => setOpenNote(e.target.value.slice(0, 200))}
                      placeholder="(Opzionale) Aggiunge qualcosa per personalizzare Wendy…"
                      className="text-sm bg-muted/30"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button onClick={() => setStep(1)} className="rounded-full px-6 gap-2">
                      Continua <ChevronRight size={16} />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ── Step 1: Settori & skill ──────────────── */}
              {step === 1 && (
                <motion.div key="s1" {...slideIn} transition={transition} className="space-y-4">
                  <p className="text-sm text-muted-foreground">Seleziona fino a 3 settori che ti interessano (opzionale).</p>

                  {/* Settori */}
                  <div className="flex flex-wrap gap-2">
                    {sectors.slice(0, 15).map((s) => {
                      const sel = selectedSectors.includes(s.id);
                      return (
                        <button key={s.id} onClick={() => toggleSector(s.id)}
                          className={cn(
                            "text-xs px-3 py-1.5 rounded-full border font-medium transition-all",
                            sel ? "bg-primary/10 border-primary/50 text-primary" : "border-border text-muted-foreground hover:border-white/20 hover:text-foreground",
                          )}>
                          {s.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* Skill goals */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Skill che vuoi sviluppare (max 5):</p>
                    <div className="flex gap-2 mb-2">
                      <Input
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(skillInput); } }}
                        placeholder="Es. Python, UX Design…"
                        className="text-sm"
                      />
                      <Button size="sm" variant="outline" onClick={() => addSkill(skillInput)} disabled={!skillInput.trim() || skillGoals.length >= 5}>
                        +
                      </Button>
                    </div>
                    {/* Suggerimenti */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {SKILL_SUGGESTIONS.filter((s) => !skillGoals.includes(s)).slice(0, 8).map((s) => (
                        <button key={s} onClick={() => addSkill(s)} disabled={skillGoals.length >= 5}
                          className="text-xs px-2.5 py-1 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all">
                          + {s}
                        </button>
                      ))}
                    </div>
                    {/* Skill selezionate */}
                    {skillGoals.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {skillGoals.map((s) => (
                          <span key={s} className="flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/30 rounded-full px-3 py-1">
                            {s}
                            <button onClick={() => removeSkill(s)} className="hover:text-destructive ml-1">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between pt-1">
                    <Button variant="outline" onClick={() => setStep(0)} className="rounded-full gap-2"><ChevronLeft size={16} /> Indietro</Button>
                    <Button onClick={() => setStep(2)} className="rounded-full px-6 gap-2">Continua <ChevronRight size={16} /></Button>
                  </div>
                </motion.div>
              )}

              {/* ── Step 2: Orizzonte ────────────────────── */}
              {step === 2 && (
                <motion.div key="s2" {...slideIn} transition={transition} className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-3">
                    In che arco di tempo vuoi vedere risultati concreti?
                  </p>
                  <div className="space-y-2">
                    {HORIZON_OPTIONS.map((h) => {
                      const Icon = h.icon;
                      const sel  = horizon === h.id;
                      return (
                        <button key={h.id} onClick={() => setHorizon(h.id)}
                          className={cn("w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all",
                            sel ? "border-primary/50 bg-primary/5" : "border-border hover:border-white/20")}>
                          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                            sel ? "bg-primary/10 border border-primary/30" : "bg-muted")}>
                            <Icon className={cn("w-5 h-5", sel ? "text-primary" : "text-muted-foreground")} />
                          </div>
                          <div>
                            <p className={cn("font-semibold text-sm", sel ? "text-foreground" : "text-foreground/80")}>{h.label}</p>
                            <p className="text-xs text-muted-foreground">{h.sub}</p>
                          </div>
                          {sel && <CheckCircle2 size={16} className="text-primary ml-auto shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-between pt-2">
                    <Button variant="outline" onClick={() => setStep(1)} className="rounded-full gap-2"><ChevronLeft size={16} /> Indietro</Button>
                    <Button onClick={handleComplete} disabled={saving} className="rounded-full px-6 gap-2">
                      {saving ? <><Loader2 size={14} className="animate-spin" /> Salvo…</> : <><Target size={14} /> Configura NorthStar</>}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ── Step 3: Sei pronto! ──────────────────── */}
              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="space-y-5">
                  {/* Success */}
                  <div className="flex flex-col items-center text-center py-2">
                    <motion.div
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 20 }}
                      className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mb-4"
                    >
                      <CheckCircle2 size={32} className="text-primary" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-foreground">NorthStar è tuo</h3>
                    <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">
                      Dashboard, Wendy e il catalogo sono personalizzati per <strong className={cn("font-semibold", persona.color)}>{persona.label.toLowerCase()}</strong>.
                    </p>
                  </div>

                  {/* Recap chips */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: Briefcase, label: "Percorso",  value: persona.label.split(" ")[0] },
                      { icon: Clock,     label: "Orizzonte", value: HORIZON_OPTIONS.find((h) => h.id === horizon)?.label ?? "" },
                      { icon: Sparkles,  label: "Settori",   value: selectedSectors.length > 0 ? `${selectedSectors.length} scelti` : "Da esplorare" },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                        <Icon className="w-4 h-4 text-primary mx-auto mb-1" />
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                        <p className="text-xs font-bold text-foreground mt-0.5 truncate">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Wendy message hint */}
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-start gap-3">
                    <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground leading-relaxed">
                      <strong>Wendy ti sta aspettando</strong> — appena arrivi sulla dashboard ti darà il benvenuto con un messaggio personalizzato e 3 suggerimenti concreti per iniziare.
                    </p>
                  </div>

                  {/* CTA */}
                  <Link href="/dashboard">
                    <div onClick={() => onComplete(selectedJourney)}
                      className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground font-bold rounded-full py-3 hover:bg-primary/90 transition-all cursor-pointer">
                      Vai alla dashboard <ArrowRight size={16} />
                    </div>
                  </Link>
                  <button onClick={() => onComplete(selectedJourney)}
                    className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                    Esplora prima il catalogo →
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
