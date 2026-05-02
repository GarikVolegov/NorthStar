import React, { useState } from "react";
import { useLocation } from "wouter";
import { useSubmitTest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// RIASEC questions based on realistic test
const QUESTIONS = [
  { id: "q1", text: "Mi piace costruire, riparare o lavorare con le mani.", type: "R" },
  { id: "q2", text: "Mi piace analizzare dati, risolvere problemi logici o fare ricerca.", type: "I" },
  { id: "q3", text: "Mi piace esprimermi attraverso l'arte, la musica, la scrittura o il design.", type: "A" },
  { id: "q4", text: "Mi piace aiutare, insegnare o prendermi cura degli altri.", type: "S" },
  { id: "q5", text: "Mi piace guidare progetti, prendere decisioni o avviare nuove iniziative.", type: "E" },
  { id: "q6", text: "Mi piace organizzare, pianificare e lavorare con procedure chiare.", type: "C" },
  { id: "q7", text: "Preferisco lavorare all'aperto o con strumenti concreti piuttosto che in ufficio.", type: "R" },
  { id: "q8", text: "Sono incuriosito dal capire come funzionano le cose a livello profondo.", type: "I" },
  { id: "q9", text: "Preferisco un ambiente di lavoro flessibile e non strutturato.", type: "A" },
  { id: "q10", text: "Per me è importante che il mio lavoro abbia un impatto sociale positivo.", type: "S" },
  { id: "q11", text: "Mi trovo a mio agio nel persuadere gli altri o negoziare accordi.", type: "E" },
  { id: "q12", text: "Sono una persona molto attenta ai dettagli e all'accuratezza.", type: "C" },
];

const OPTIONS = [
  { value: 1, label: "Per niente", color: "bg-muted hover:bg-muted/80 border-muted" },
  { value: 2, label: "Poco", color: "bg-muted/80 hover:bg-muted border-muted" },
  { value: 3, label: "Neutro", color: "bg-secondary hover:bg-secondary/80 border-secondary" },
  { value: 4, label: "Abbastanza", color: "bg-primary/20 hover:bg-primary/30 border-primary/30" },
  { value: 5, label: "Moltissimo", color: "bg-primary text-primary-foreground hover:bg-primary/90 border-primary" },
];

export default function Test() {
  const [, setLocation] = useLocation();
  const submitTest = useSubmitTest();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  
  const progress = ((currentStep) / QUESTIONS.length) * 100;
  const currentQuestion = QUESTIONS[currentStep];
  const isComplete = currentStep >= QUESTIONS.length;

  const handleAnswer = (value: number) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }));
    
    // Auto advance after brief delay
    setTimeout(() => {
      setCurrentStep(prev => prev + 1);
    }, 300);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    submitTest.mutate({ data: { answers } }, {
      onSuccess: (session) => {
        setLocation(`/risultati/${session.id}`);
      }
    });
  };

  // If complete but not submitted yet, show completion screen
  if (isComplete) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-24 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="w-24 h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-8 animate-in zoom-in duration-500">
          <Check className="w-12 h-12" />
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">Test Completato!</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Abbiamo analizzato le tue risposte. Siamo pronti a svelarti il tuo profilo RIASEC e i settori più adatti a te.
        </p>
        <Button 
          size="lg" 
          onClick={handleSubmit} 
          disabled={submitTest.isPending}
          className="rounded-full px-8 h-14 text-lg w-full sm:w-auto"
        >
          {submitTest.isPending ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Elaborazione in corso...
            </>
          ) : (
            <>
              Vedi i Risultati <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto px-4 py-12 md:py-24">
      {/* Header & Progress */}
      <div className="mb-12">
        <div className="flex justify-between items-center mb-4 text-sm font-medium text-muted-foreground">
          <button 
            onClick={handleBack}
            disabled={currentStep === 0 || submitTest.isPending}
            className="flex items-center hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Indietro
          </button>
          <span>Domanda {currentStep + 1} di {QUESTIONS.length}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question Card */}
      <div className="animate-in slide-in-from-right-4 fade-in duration-300" key={currentStep}>
        <h2 className="text-3xl md:text-4xl font-serif font-medium leading-tight mb-12 text-center text-foreground">
          {currentQuestion.text}
        </h2>

        <div className="grid gap-3 sm:gap-4 max-w-md mx-auto">
          {OPTIONS.map((option) => {
            const isSelected = answers[currentQuestion.id] === option.value;
            
            return (
              <button
                key={option.value}
                onClick={() => handleAnswer(option.value)}
                className={cn(
                  "w-full text-left px-6 py-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-between group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isSelected 
                    ? "border-primary bg-primary/5 shadow-sm" 
                    : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <span className={cn(
                  "text-lg font-medium",
                  isSelected ? "text-primary" : "text-foreground group-hover:text-primary/80"
                )}>
                  {option.label}
                </span>
                
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                  isSelected 
                    ? "border-primary bg-primary text-primary-foreground" 
                    : "border-muted-foreground/30"
                )}>
                  {isSelected && <div className="w-2.5 h-2.5 bg-current rounded-full" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
