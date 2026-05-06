import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  X, ChevronRight, ChevronLeft, CheckCircle2, Target,
  Calendar, Briefcase, Loader2, Sparkles, Laptop, Users, TrendingUp,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

interface Objective {
  text: string;
  category: string;
  dueDate: string;
}

const WORK_MODES = [
  { value: "dipendente", label: "Dipendente", icon: <Briefcase size={18} />, desc: "Lavoro in un'azienda con contratto stabile" },
  { value: "autonomo", label: "Autonomo", icon: <Laptop size={18} />, desc: "Libero professionista o imprenditore" },
  { value: "ibrido", label: "Ibrido", icon: <TrendingUp size={18} />, desc: "Mix tra lavoro dipendente e freelance" },
];

const OBJ_CATEGORIES = ["formazione", "networking", "candidatura", "skill", "altro"];
const STEP_LABELS = ["Modalità di lavoro", "I tuoi obiettivi", "Calendario automatico"];

interface PostTestWizardProps {
  userId: number;
  sessionId: number;
  topSectorName: string;
  onClose: () => void;
  onComplete: () => void;
}

export function PostTestWizard({ userId, sessionId, topSectorName, onClose, onComplete }: PostTestWizardProps) {
  const [step, setStep] = useState(0);
  const [workMode, setWorkMode] = useState("dipendente");
  const [objectives, setObjectives] = useState<Objective[]>([
    { text: "", category: "formazione", dueDate: "" },
    { text: "", category: "candidatura", dueDate: "" },
    { text: "", category: "skill", dueDate: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Array<{ text: string; dueDate: string }>>([]);

  function updateObj(idx: number, field: keyof Objective, val: string) {
    setObjectives((prev) => prev.map((o, i) => i === idx ? { ...o, [field]: val } : o));
  }

  const validObjectives = objectives.filter((o) => o.text.trim());

  async function handleFinish() {
    if (validObjectives.length === 0) return;
    setSaving(true);
    try {
      const results = await Promise.allSettled(
        validObjectives.map((obj) =>
          fetch(`${BASE}api/objectives`, {
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
      const saved = validObjectives.filter((_, i) => results[i].status === "fulfilled");
      setCreated(saved.map((o) => ({ text: o.text, dueDate: o.dueDate })));
      setStep(2);
    } catch {
      // fallback — show step 2 anyway
      setStep(2);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-lg"
      >
        <Card className="shadow-2xl border-0">
          <CardContent className="pt-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Passo {step + 1} di 3
                </p>
                <h2 className="text-lg font-bold mt-0.5">{STEP_LABELS[step]}</h2>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1.5 mb-6">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full flex-1 transition-colors duration-300 ${
                    i <= step ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              {/* Step 0: Work mode */}
              {step === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-3"
                >
                  <p className="text-sm text-muted-foreground">
                    Hai scoperto che il tuo settore ideale è <strong>{topSectorName}</strong>.
                    Come preferisci lavorare?
                  </p>
                  {WORK_MODES.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setWorkMode(m.value)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                        workMode === m.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        workMode === m.value ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                      }`}>
                        {m.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{m.label}</p>
                        <p className="text-xs text-muted-foreground">{m.desc}</p>
                      </div>
                      {workMode === m.value && (
                        <CheckCircle2 size={16} className="text-primary ml-auto" />
                      )}
                    </button>
                  ))}
                  <div className="flex justify-end pt-2">
                    <Button onClick={() => setStep(1)}>
                      Continua <ChevronRight size={16} className="ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 1: Objectives */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <p className="text-sm text-muted-foreground">
                    Definisci fino a 3 obiettivi concreti. Saranno sincronizzati automaticamente nel tuo calendario.
                  </p>
                  {objectives.map((obj, idx) => (
                    <div key={idx} className="space-y-2 p-3.5 rounded-xl border bg-muted/30">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {idx + 1}
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">Obiettivo {idx + 1}</span>
                        {idx > 0 && <span className="text-xs text-muted-foreground ml-auto">(opzionale)</span>}
                      </div>
                      <Input
                        placeholder={
                          idx === 0 ? "es. Completare un corso online in 3 settimane" :
                          idx === 1 ? "es. Inviare 5 candidature entro fine mese" :
                          "es. Aggiornarsi su Python e machine learning"
                        }
                        value={obj.text}
                        onChange={(e) => updateObj(idx, "text", e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={obj.category}
                          onChange={(e) => updateObj(idx, "category", e.target.value)}
                          className="text-xs border rounded-md px-2 py-1.5 bg-background"
                        >
                          {OBJ_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                          ))}
                        </select>
                        <Input
                          type="date"
                          value={obj.dueDate}
                          onChange={(e) => updateObj(idx, "dueDate", e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2">
                    <Button variant="outline" onClick={() => setStep(0)}>
                      <ChevronLeft size={16} className="mr-1" /> Indietro
                    </Button>
                    <Button
                      onClick={handleFinish}
                      disabled={saving || validObjectives.length === 0}
                    >
                      {saving
                        ? <><Loader2 size={14} className="animate-spin mr-1" /> Salvando…</>
                        : <><Target size={14} className="mr-1" /> Salva e vai al calendario</>
                      }
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Confirmation */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="flex flex-col items-center text-center py-3">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mb-3">
                      <CheckCircle2 size={28} className="text-emerald-500" />
                    </div>
                    <h3 className="text-lg font-bold">Fatto!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {created.length > 0
                        ? `${created.length} obiettivo${created.length > 1 ? "i" : ""} creato${created.length > 1 ? "i" : ""} e sincronizzato${created.length > 1 ? "i" : ""} nel calendario.`
                        : "Il tuo piano è pronto."}
                    </p>
                  </div>

                  {created.length > 0 && (
                    <div className="space-y-2">
                      {created.map((o, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900">
                          <Calendar size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">{o.text}</p>
                            {o.dueDate && (
                              <p className="text-xs text-muted-foreground">
                                Scadenza: {new Date(o.dueDate).toLocaleDateString("it-IT")}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-2">
                    <Button className="w-full" onClick={() => { window.location.href = `${BASE}calendario`; }}>
                      <Calendar size={14} className="mr-1.5" /> Vai al Calendario
                    </Button>
                    <Button variant="outline" className="w-full" onClick={onComplete}>
                      Torna ai risultati
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
