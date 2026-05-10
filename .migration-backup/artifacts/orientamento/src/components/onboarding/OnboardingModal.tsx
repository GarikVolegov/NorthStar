import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { ArrowRight, Target, BookOpen, Map, Network, BrainCircuit, CheckCircle2, X } from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

interface Recommendation {
  sectorId: number;
  sectorName: string;
  matchScore: number;
}

interface OnboardingModalProps {
  sessionId: string;
  recommendations: Recommendation[];
  riasecTypes: string[];
  dominantSpirit: string;
}

const SPIRIT_META: Record<string, { emoji: string; label: string }> = {
  shen: { emoji: "✨", label: "Presenza" },
  hun:  { emoji: "🌙", label: "Visione" },
  po:   { emoji: "⚡", label: "Istinto" },
  yi:   { emoji: "🔮", label: "Focus" },
  zhi:  { emoji: "🔥", label: "Tenacia" },
};

const CATEGORY_OPTIONS = [
  { value: "formazione", label: "Formazione" },
  { value: "certificazione", label: "Certificazione" },
  { value: "networking", label: "Networking" },
  { value: "esperienza", label: "Esperienza" },
];

const TOTAL_STEPS = 4;

export function OnboardingModal({ sessionId, recommendations, riasecTypes, dominantSpirit }: OnboardingModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [objectiveText, setObjectiveText] = useState("");
  const [objectiveCategory, setObjectiveCategory] = useState("formazione");
  const [objectiveDue, setObjectiveDue] = useState("");
  const [objectiveSaved, setObjectiveSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem("northstar_onboarding_done");
    if (!done) {
      const timer = setTimeout(() => setOpen(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  function finish() {
    localStorage.setItem("northstar_onboarding_done", "1");
    setOpen(false);
  }

  async function saveObjective() {
    if (!objectiveText.trim()) return;
    setSaving(true);
    try {
      await fetch(`${BASE}api/objectives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text: objectiveText.trim(),
          category: objectiveCategory,
          dueDate: objectiveDue || null,
        }),
      });
      setObjectiveSaved(true);
    } catch { /* ignore */ }
    setSaving(false);
  }

  const spirit = SPIRIT_META[dominantSpirit];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        <button
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted transition-colors z-10"
          onClick={finish}
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="px-6 pt-6 pb-5">
          <div className="text-xs text-muted-foreground mb-4">Passo {step} di {TOTAL_STEPS}</div>

          {/* Step 1 — Test completato */}
          {step === 1 && (
            <div className="text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h2 className="text-xl font-bold mb-2">Hai completato il test!</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Ecco il tuo profilo professionale. Salvalo per accedere a tutti gli strumenti AI.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {riasecTypes.slice(0, 3).map((t) => (
                  <Badge key={t} variant="outline" className="text-base font-bold px-3 py-1">{t}</Badge>
                ))}
                {spirit && (
                  <Badge variant="secondary" className="px-3 py-1">
                    {spirit.emoji} {spirit.label}
                  </Badge>
                )}
              </div>
              <Button className="w-full" size="lg" onClick={() => setStep(2)}>
                Continua <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 2 — Settore ideale */}
          {step === 2 && (
            <div>
              <div className="text-3xl mb-3 text-center">🎯</div>
              <h2 className="text-xl font-bold mb-1 text-center">Il tuo settore ideale</h2>
              <p className="text-sm text-muted-foreground mb-5 text-center">
                Basandoci sul tuo profilo, ti consigliamo questi settori
              </p>
              <div className="space-y-3 mb-5">
                {recommendations.slice(0, 3).map((rec) => (
                  <Link key={rec.sectorId} href={`/settore/${rec.sectorId}`} onClick={finish}>
                    <div className="flex items-center justify-between rounded-xl border p-3 hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer">
                      <div>
                        <p className="font-semibold text-sm">{rec.sectorName}</p>
                        <p className="text-xs text-muted-foreground">{rec.matchScore}% compatibilità</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${rec.matchScore}%` }} />
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <Button className="w-full" onClick={() => setStep(3)}>
                Continua <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 3 — Primo obiettivo */}
          {step === 3 && (
            <div>
              <div className="text-3xl mb-3 text-center">📋</div>
              <h2 className="text-xl font-bold mb-1 text-center">Imposta il tuo primo obiettivo</h2>
              <p className="text-sm text-muted-foreground mb-5 text-center">
                Cosa vuoi raggiungere nei prossimi 3 mesi?
              </p>
              {objectiveSaved ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold">Obiettivo salvato!</p>
                  <p className="text-sm text-muted-foreground mt-1">Lo trovi nel tuo profilo.</p>
                  <Button className="mt-5 w-full" onClick={() => setStep(4)}>
                    Continua <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs mb-1.5 block">Obiettivo</Label>
                    <Input
                      placeholder="es. Completare un corso di Python"
                      value={objectiveText}
                      onChange={(e) => setObjectiveText(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Categoria</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORY_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => setObjectiveCategory(c.value)}
                          className={`rounded-lg border py-2 text-xs font-medium transition-colors ${
                            objectiveCategory === c.value ? "bg-primary text-primary-foreground border-primary" : "hover:border-primary/40"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Scadenza (opzionale)</Label>
                    <Input type="date" value={objectiveDue} onChange={(e) => setObjectiveDue(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={saveObjective} disabled={!objectiveText.trim() || saving}>
                      {saving ? "Salvataggio…" : "Crea obiettivo"}
                    </Button>
                    <Button variant="ghost" onClick={() => setStep(4)}>Salta</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4 — Cosa fare adesso */}
          {step === 4 && (
            <div>
              <div className="text-3xl mb-3 text-center">🚀</div>
              <h2 className="text-xl font-bold mb-1 text-center">Cosa fare adesso?</h2>
              <p className="text-sm text-muted-foreground mb-5 text-center">
                Hai tutto quello che ti serve. Inizia il tuo percorso!
              </p>
              {recommendations[0] && (
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { href: `/roadmap/${recommendations[0].sectorId}`, icon: <Map className="w-4 h-4" />, label: "Roadmap AI", color: "text-emerald-600 bg-emerald-50" },
                    { href: `/wiki/${recommendations[0].sectorId}`, icon: <BookOpen className="w-4 h-4" />, label: "Wiki Settore", color: "text-indigo-600 bg-indigo-50" },
                    { href: "/coach", icon: <BrainCircuit className="w-4 h-4" />, label: "Coach AI", color: "text-violet-600 bg-violet-50" },
                    { href: `/grafo/${recommendations[0].sectorId}`, icon: <Network className="w-4 h-4" />, label: "Grafo Conoscenza", color: "text-orange-600 bg-orange-50" },
                  ].map((item) => (
                    <Link key={item.href} href={item.href} onClick={finish}>
                      <div className="rounded-xl border p-3 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer flex flex-col items-center gap-2 text-center">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.color}`}>
                          {item.icon}
                        </div>
                        <span className="text-xs font-medium">{item.label}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Link href="/dashboard">
                <Button className="w-full" onClick={finish}>
                  Vai alla Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
