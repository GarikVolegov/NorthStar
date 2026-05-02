import React, { useState } from "react";
import { useLocation } from "wouter";
import { useSubmitTest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const BASE = import.meta.env.BASE_URL || "/";

const RIASEC_QUESTIONS = [
  { id: "q1",  text: "Mi piace costruire, riparare o lavorare con le mani.", type: "R", phase: "riasec" },
  { id: "q2",  text: "Mi piace analizzare dati, risolvere problemi logici o fare ricerca.", type: "I", phase: "riasec" },
  { id: "q3",  text: "Mi piace esprimermi attraverso l'arte, la musica, la scrittura o il design.", type: "A", phase: "riasec" },
  { id: "q4",  text: "Mi piace aiutare, insegnare o prendermi cura degli altri.", type: "S", phase: "riasec" },
  { id: "q5",  text: "Mi piace guidare progetti, prendere decisioni o avviare nuove iniziative.", type: "E", phase: "riasec" },
  { id: "q6",  text: "Mi piace organizzare, pianificare e lavorare con procedure chiare.", type: "C", phase: "riasec" },
  { id: "q7",  text: "Preferisco lavorare all'aperto o con strumenti concreti piuttosto che in ufficio.", type: "R", phase: "riasec" },
  { id: "q8",  text: "Sono incuriosito dal capire come funzionano le cose a livello profondo.", type: "I", phase: "riasec" },
  { id: "q9",  text: "Preferisco un ambiente di lavoro flessibile e non strutturato.", type: "A", phase: "riasec" },
  { id: "q10", text: "Per me è importante che il mio lavoro abbia un impatto sociale positivo.", type: "S", phase: "riasec" },
  { id: "q11", text: "Mi trovo a mio agio nel persuadere gli altri o negoziare accordi.", type: "E", phase: "riasec" },
  { id: "q12", text: "Sono una persona molto attenta ai dettagli e all'accuratezza.", type: "C", phase: "riasec" },
];

const SPIRIT_QUESTIONS = [
  {
    id: "shen",
    text: "Mi sento spesso chiaro e centrato nelle mie emozioni, anche nei momenti difficili.",
    spirit: "Shen",
    emoji: "✨",
    description: "Coscienza & Presenza",
    phase: "spirits",
  },
  {
    id: "hun",
    text: "Riesco a immaginare con facilità il mio futuro ideale e a sentirlo possibile.",
    spirit: "Hun",
    emoji: "🌙",
    description: "Visione & Direzione",
    phase: "spirits",
  },
  {
    id: "po",
    text: "Sento forte l'energia nel corpo quando faccio qualcosa che mi appassiona davvero.",
    spirit: "Po",
    emoji: "⚡",
    description: "Istinto & Energia",
    phase: "spirits",
  },
  {
    id: "yi",
    text: "Mi riesce facile concentrare l'attenzione a lungo su studio, analisi o problem solving.",
    spirit: "Yi",
    emoji: "🔮",
    description: "Concentrazione & Analisi",
    phase: "spirits",
  },
  {
    id: "zhi",
    text: "Porto avanti le mie decisioni anche quando diventano difficili o richiedono sacrifici.",
    spirit: "Zhi",
    emoji: "🔥",
    description: "Volontà & Resilienza",
    phase: "spirits",
  },
];

const ALL_QUESTIONS = [...RIASEC_QUESTIONS, ...SPIRIT_QUESTIONS];

const OPTIONS = [
  { value: 1, label: "Per niente" },
  { value: 2, label: "Poco" },
  { value: 3, label: "Neutro" },
  { value: 4, label: "Abbastanza" },
  { value: 5, label: "Moltissimo" },
];

async function assignUserToSession(sessionId: number, userId: number): Promise<void> {
  try {
    await fetch(`${BASE}api/test-sessions/${sessionId}/assign-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
  } catch {
    // non-critical — silently fail
  }
}

export default function Test() {
  const [, setLocation] = useLocation();
  const submitTest = useSubmitTest();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const currentQuestion = ALL_QUESTIONS[currentStep];
  const isRiasecPhase = currentStep < RIASEC_QUESTIONS.length;
  const isTransition = currentStep === RIASEC_QUESTIONS.length && answers["q12"] !== undefined && !answers["shen"];
  const isComplete = currentStep >= ALL_QUESTIONS.length;
  const progress = (currentStep / ALL_QUESTIONS.length) * 100;

  const handleAnswer = (value: number) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }));
    setTimeout(() => setCurrentStep(prev => prev + 1), 300);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = () => {
    submitTest.mutate({ data: { answers } }, {
      onSuccess: async (session) => {
        if (user) {
          await assignUserToSession(session.id, user.id);
        }
        setLocation(`/risultati/${session.id}`);
      },
    });
  };

  // Transition screen between RIASEC and Spirits
  if (currentStep === RIASEC_QUESTIONS.length && !isComplete) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-24 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-8 animate-in zoom-in duration-500">
          <Sparkles className="w-10 h-10" />
        </div>
        <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-full px-4 py-1.5 mb-6 text-sm font-medium text-primary">
          <Sparkles className="w-3.5 h-3.5" /> Bussola Interiore
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">Seconda parte: i Cinque Spiriti</h1>
        <p className="text-lg text-muted-foreground mb-4 leading-relaxed max-w-xl">
          Ottima analisi delle tue inclinazioni esterne. Ora esploriamo la tua energia interiore attraverso i <strong>Cinque Spiriti</strong> della tradizione cinese.
        </p>
        <p className="text-base text-muted-foreground mb-10 leading-relaxed max-w-xl">
          Queste 5 domande rivelano il tuo equilibrio tra volontà, mente, visione, sensibilità ed energia. Non ci sono risposte giuste o sbagliate: segui l'istinto.
        </p>
        <div className="flex gap-3 flex-wrap justify-center mb-10">
          {SPIRIT_QUESTIONS.map(s => (
            <div key={s.id} className="flex items-center gap-2 bg-card border rounded-xl px-4 py-2 text-sm">
              <span>{s.emoji}</span>
              <div className="text-left">
                <div className="font-semibold text-foreground">{s.spirit}</div>
                <div className="text-xs text-muted-foreground">{s.description}</div>
              </div>
            </div>
          ))}
        </div>
        <Button size="lg" onClick={() => setCurrentStep(RIASEC_QUESTIONS.length)} className="rounded-full px-10 h-13">
          Inizia la Bussola Interiore <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </div>
    );
  }

  // Completion screen
  if (isComplete) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-24 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="w-24 h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-8 animate-in zoom-in duration-500">
          <Check className="w-12 h-12" />
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">Analisi completata!</h1>
        <p className="text-lg text-muted-foreground mb-2 leading-relaxed">
          Abbiamo analizzato il tuo profilo RIASEC e la tua Bussola Interiore. Siamo pronti a svelarti i settori più adatti a te.
        </p>
        {user && (
          <p className="text-sm text-primary font-medium mb-6">
            I risultati verranno salvati automaticamente sul tuo account.
          </p>
        )}
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={submitTest.isPending}
          className="rounded-full px-8 h-14 text-lg w-full sm:w-auto"
        >
          {submitTest.isPending
            ? <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> Elaborazione…</>
            : <><Sparkles className="mr-2 w-5 h-5" /> Scopri i tuoi risultati</>
          }
        </Button>
        {submitTest.isError && (
          <p className="mt-4 text-sm text-destructive">Errore nell'invio. Riprova.</p>
        )}
      </div>
    );
  }

  // Spirit question screen (with spirit label above)
  const isSpiritQ = currentQuestion?.phase === "spirits";
  const spiritQ = isSpiritQ ? SPIRIT_QUESTIONS.find(s => s.id === currentQuestion.id) : null;
  const totalDisplay = ALL_QUESTIONS.length;
  const stepDisplay = currentStep + 1;

  return (
    <div className="container max-w-2xl mx-auto px-4 py-12 min-h-[70vh]">
      {/* Progress */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Indietro
        </button>
        <span className="text-sm text-muted-foreground">
          Domanda {stepDisplay} di {totalDisplay}
        </span>
      </div>
      <Progress value={progress} className="mb-10 h-1.5" />

      {/* Spirit label */}
      {spiritQ && (
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-full px-4 py-1.5 mb-6 w-fit">
          <span>{spiritQ.emoji}</span>
          <span className="text-sm font-medium text-primary">{spiritQ.spirit} · {spiritQ.description}</span>
        </div>
      )}

      <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground mb-10 leading-snug">
        {currentQuestion?.text}
      </h2>

      <div className="space-y-3">
        {OPTIONS.map(opt => {
          const selected = answers[currentQuestion?.id] === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => handleAnswer(opt.value)}
              className={cn(
                "w-full flex items-center justify-between px-5 py-4 rounded-xl border text-left text-base font-medium transition-all duration-150",
                selected
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-card border-border hover:border-primary/40 hover:bg-primary/5 text-foreground"
              )}
            >
              {opt.label}
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                selected ? "border-primary-foreground bg-primary-foreground/20" : "border-muted-foreground"
              )}>
                {selected && <div className="w-2.5 h-2.5 rounded-full bg-primary-foreground" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
