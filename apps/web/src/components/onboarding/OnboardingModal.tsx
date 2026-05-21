import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-fetch";
import { ArrowRight, BookOpen, BrainCircuit, CheckCircle2, Map, Network, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

interface Recommendation {
  sectorId:   number;
  sectorName: string;
  matchScore: number;
}

interface OnboardingModalProps {
  sessionId:       string;
  recommendations: Recommendation[];
  riasecTypes:     string[];   // usato internamente, non mostrato come codici raw
  dominantSpirit:  string;
}

// ── Journey type ──────────────────────────────────────────────────────────────

const JOURNEY_OPTIONS = [
  { value: "indeciso",    emoji: "🧭", label: "Sto cercando la mia strada",      desc: "Non sai ancora bene cosa vuoi fare" },
  { value: "dipendente",  emoji: "📈", label: "Voglio crescere nel mio lavoro",   desc: "Hai un lavoro e vuoi avanzare" },
  { value: "autonomo",    emoji: "🚀", label: "Lavoro o voglio lavorare in autonomia", desc: "Freelance, consulente o imprenditore" },
  { value: "azienda",     emoji: "🏢", label: "Gestisco o costruisco un'azienda", desc: "Hai un team o vuoi crearne uno" },
  { value: "investitore", emoji: "💰", label: "Investo o voglio capire i mercati",desc: "Finanza, asset e opportunità" },
] as const;

// Mappa i codici RIASEC in caratteristiche leggibili
const RIASEC_TRAITS: Record<string, string> = {
  R: "Pratico e concreto",
  I: "Analitico e curioso",
  A: "Creativo e originale",
  S: "Empatico e collaborativo",
  E: "Intraprendente e persuasivo",
  C: "Preciso e organizzato",
};

const CATEGORY_OPTIONS = [
  { value: "formazione",    label: "Formazione" },
  { value: "certificazione",label: "Certificazione" },
  { value: "networking",    label: "Networking" },
  { value: "esperienza",    label: "Esperienza pratica" },
];

const TOTAL_STEPS = 4;

export function OnboardingModal({ recommendations, riasecTypes }: OnboardingModalProps) {
  const [open,              setOpen]              = useState(false);
  const [step,              setStep]              = useState(1);
  const [selectedJourney,   setSelectedJourney]   = useState<string | null>(null);
  const [savingJourney,     setSavingJourney]     = useState(false);
  const [objectiveText,     setObjectiveText]     = useState("");
  const [objectiveCategory, setObjectiveCategory] = useState("formazione");
  const [objectiveDue,      setObjectiveDue]      = useState("");
  const [objectiveSaved,    setObjectiveSaved]    = useState(false);
  const [saving,            setSaving]            = useState(false);

  useEffect(() => {
    const done = localStorage.getItem("northstar_onboarding_done");
    if (done) return;
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, []);

  function finish() {
    localStorage.setItem("northstar_onboarding_done", "1");
    setOpen(false);
  }

  async function handleJourneySelect(value: string) {
    setSelectedJourney(value);
    setSavingJourney(true);
    try {
      await apiFetch(`${BASE}api/journey-type/me/journey-type`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyType: value }),
      });
    } catch { /* non bloccante */ }
    setSavingJourney(false);
    setStep(2);
  }

  async function saveObjective() {
    if (!objectiveText.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`${BASE}api/objectives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: objectiveText.trim(), category: objectiveCategory, dueDate: objectiveDue || null }),
      });
      setObjectiveSaved(true);
    } catch { /* ignore */ }
    setSaving(false);
  }

  // Caratteristiche leggibili invece dei codici RIASEC
  const traits = riasecTypes.slice(0, 3).map((c) => RIASEC_TRAITS[c]).filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) finish(); }}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
        {/* Barra progresso */}
        <div className="h-1 bg-muted">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>

        <button className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted transition-colors z-10" onClick={finish}>
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="px-6 pt-6 pb-5">
          <div className="text-xs text-muted-foreground mb-4">Passo {step} di {TOTAL_STEPS}</div>

          {/* ── Step 1 — Scegli il tuo percorso ── */}
          {step === 1 && (
            <div>
              <div className="text-3xl mb-3 text-center">🧭</div>
              <h2 className="text-xl font-bold mb-1 text-center">Dove sei adesso?</h2>
              <p className="text-sm text-muted-foreground mb-5 text-center">
                Scegli il percorso che ti descrive meglio. Wendy adatterà i consigli per te.
              </p>
              <div className="space-y-2">
                {JOURNEY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleJourneySelect(opt.value)}
                    disabled={savingJourney}
                    className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all hover:border-primary/50 hover:bg-muted/30 disabled:opacity-60 ${selectedJourney === opt.value ? "border-primary bg-primary/5" : ""}`}
                  >
                    <span className="text-2xl shrink-0">{opt.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{opt.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{opt.desc}</p>
                    </div>
                    {selectedJourney === opt.value && <CheckCircle2 className="w-4 h-4 text-primary ml-auto shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2 — Profilo di orientamento (ex RIASEC) ── */}
          {step === 2 && (
            <div className="text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h2 className="text-xl font-bold mb-2">Il tuo profilo di orientamento</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Ecco le tue caratteristiche principali. Wendy le userà per personalizzare ogni risposta.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {traits.map((trait) => (
                  <span key={trait} className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
                    {trait}
                  </span>
                ))}
                {recommendations[0] && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-semibold">
                    🎯 {recommendations[0].sectorName}
                  </span>
                )}
              </div>
              {/* Settori consigliati */}
              <div className="space-y-2 mb-5 text-left">
                {recommendations.slice(0, 3).map((rec) => (
                  <Link key={rec.sectorId} href={`/settore/${rec.sectorId}`} onClick={finish}>
                    <div className="flex items-center justify-between rounded-xl border p-3 hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer">
                      <p className="font-semibold text-sm">{rec.sectorName}</p>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${rec.matchScore}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{rec.matchScore}%</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <Button className="w-full" size="lg" onClick={() => setStep(3)}>
                Continua <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* ── Step 3 — Primo obiettivo ── */}
          {step === 3 && (
            <div>
              <div className="text-3xl mb-3 text-center">📋</div>
              <h2 className="text-xl font-bold mb-1 text-center">Il tuo primo obiettivo</h2>
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
                      onKeyDown={(e) => e.key === "Enter" && !saving && objectiveText.trim() && saveObjective()}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Categoria</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORY_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => setObjectiveCategory(c.value)}
                          className={`rounded-lg border py-2 text-xs font-medium transition-colors ${objectiveCategory === c.value ? "bg-primary text-primary-foreground border-primary" : "hover:border-primary/40"}`}
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

          {/* ── Step 4 — Cosa fare adesso ── */}
          {step === 4 && (
            <div>
              <div className="text-3xl mb-3 text-center">🚀</div>
              <h2 className="text-xl font-bold mb-1 text-center">Sei pronto!</h2>
              <p className="text-sm text-muted-foreground mb-5 text-center">
                Wendy ti accompagnerà in ogni passo del tuo percorso.
              </p>
              {recommendations[0] && (
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { href: `/roadmap/${recommendations[0].sectorId}`, icon: <Map className="w-4 h-4" />, label: "Roadmap AI", color: "text-emerald-600 bg-emerald-50" },
                    { href: `/wiki/${recommendations[0].sectorId}`, icon: <BookOpen className="w-4 h-4" />, label: "Wiki Settore", color: "text-indigo-600 bg-indigo-50" },
                    { href: "/coach", icon: <BrainCircuit className="w-4 h-4" />, label: "Parla con Wendy", color: "text-violet-600 bg-violet-50" },
                    { href: `/archivio/${recommendations[0].sectorId}`, icon: <Network className="w-4 h-4" />, label: "Mappa Conoscenza", color: "text-orange-600 bg-orange-50" },
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
