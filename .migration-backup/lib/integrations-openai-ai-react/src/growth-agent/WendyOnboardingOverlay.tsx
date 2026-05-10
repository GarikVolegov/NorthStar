/**
 * WendyOnboardingOverlay — Passo 6.
 *
 * Overlay fullscreen a 3 step per i nuovi utenti.
 * Appare sopra la chat prima del primo messaggio di Wendy.
 *
 * STEP:
 *   0 — Benvenuto: nome + avatar iniziale animato, CTA "Inizia"
 *   1 — Percorso: selezione journeyType (4 card radio)
 *   2 — Primo obiettivo: textarea libera
 *   → onComplete({ journeyType, firstGoal }) — il parent chiama startOnboarding()
 *
 * Ogni step salva i dati via PATCH /api/users/me prima di procedere.
 * Il pulsante "Salta" fa skipOnboarding().
 *
 * Animazioni: CSS transition translate-x, nessuna libreria.
 * Design: sfondo sfumato indigo, card bianca centrata, mobile-first.
 */
import React, { useState, useCallback } from "react";

export interface OnboardingResult {
  journeyType: string;
  firstGoal:   string;
}

export interface WendyOnboardingOverlayProps {
  userName:   string;
  token:      string;
  apiBase?:   string;
  onComplete: (result: OnboardingResult) => void;
  onSkip:     () => void;
}

const JOURNEY_OPTIONS = [
  { value:"indeciso",       emoji:"🧭", label:"Sto esplorando",           sub:"Non ho ancora una direzione chiara" },
  { value:"in_transizione", emoji:"🔄", label:"Sto cambiando strada",      sub:"Cambio settore, ruolo o stile di vita" },
  { value:"in_crescita",    emoji:"🚀", label:"Voglio accelerare",         sub:"Ho una direzione, voglio andare più forte" },
  { value:"autonomo",       emoji:"🏗️", label:"Costruisco qualcosa di mio", sub:"Imprenditore, freelance, creatore" },
];

// ── Step 0 ─────────────────────────────────────────────────────────────────────

function StepWelcome({ userName, onNext, onSkip }: {
  userName: string; onNext: () => void; onSkip: () => void;
}) {
  const firstName = userName.split(" ")[0] || "";
  return (
    <div className="flex flex-col items-center text-center space-y-6 px-2">
      {/* Wendy avatar animato */}
      <div className="relative">
        <div className="h-24 w-24 rounded-full bg-indigo-600 flex items-center justify-center shadow-xl">
          <span className="text-5xl">🧡</span>
        </div>
        {/* Pulse ring */}
        <div className="absolute inset-0 rounded-full border-4 border-indigo-300 animate-ping opacity-30"/>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-black">
          {firstName ? `Ciao ${firstName}! 👋` : "Benvenuto su NorthStar! 👋"}
        </h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Sono <strong>Wendy</strong>, la tua coach personale.
          Prima di iniziare, voglio conoscerti meglio.
        </p>
        <p className="text-xs text-muted-foreground">Ci vorranno solo 30 secondi.</p>
      </div>

      <button onClick={onNext}
        className="w-full max-w-xs rounded-2xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-lg">
        Inizia →
      </button>

      <button onClick={onSkip} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
        Salta — vai direttamente alla chat
      </button>
    </div>
  );
}

// ── Step 1 ─────────────────────────────────────────────────────────────────────

function StepJourney({ value, onChange, onNext, onBack }: {
  value: string; onChange: (v: string) => void; onNext: () => void; onBack: () => void;
}) {
  return (
    <div className="space-y-5 w-full">
      <div className="text-center">
        <p className="text-xs font-medium text-indigo-400 uppercase tracking-wide mb-1">Passo 1 di 2</p>
        <h2 className="text-lg font-bold">Dove ti trovi adesso?</h2>
        <p className="text-xs text-muted-foreground mt-1">Wendy adatterà il suo stile alla tua situazione</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {JOURNEY_OPTIONS.map((opt) => (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            className={`w-full text-left rounded-xl border p-3.5 transition-all ${
              value === opt.value
                ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-300"
                : "border-border hover:border-indigo-200 hover:bg-indigo-50/50"
            }`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{opt.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.sub}</p>
              </div>
              <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${
                value === opt.value ? "border-indigo-500 bg-indigo-500" : "border-muted-foreground/30"
              }`}>
                {value === opt.value && <div className="m-0.5 rounded-full bg-white h-2 w-2"/>}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={onBack} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">
          ← Indietro
        </button>
        <button onClick={onNext} disabled={!value}
          className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-indigo-700 transition-colors">
          Avanti →
        </button>
      </div>
    </div>
  );
}

// ── Step 2 ─────────────────────────────────────────────────────────────────────

function StepGoal({ value, onChange, onComplete, onBack, saving }: {
  value: string; onChange: (v: string) => void;
  onComplete: () => void; onBack: () => void; saving: boolean;
}) {
  return (
    <div className="space-y-5 w-full">
      <div className="text-center">
        <p className="text-xs font-medium text-indigo-400 uppercase tracking-wide mb-1">Passo 2 di 2</p>
        <h2 className="text-lg font-bold">Qual è la tua sfida principale?</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Scrivi liberamente — non c’è risposta giusta o sbagliata.
        </p>
      </div>

      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Es. Non so quale lavoro fa per me... \nVoglio cambiare settore ma ho paura... \nHo un’idea di business ma non so da dove partire..."
        autoFocus
        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />

      <div className="flex gap-3">
        <button onClick={onBack} disabled={saving}
          className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
          ← Indietro
        </button>
        <button onClick={onComplete} disabled={saving}
          className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-indigo-700 transition-colors">
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>
              Preparando Wendy...
            </span>
          ) : "Incontra Wendy →"}
        </button>
      </div>

      {!value.trim() && (
        <p className="text-center text-xs text-muted-foreground">
          Puoi anche saltare e rispondere direttamente a Wendy
        </p>
      )}
    </div>
  );
}

// ── Dots progress ─────────────────────────────────────────────────────────────

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5 justify-center">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
          i <= step ? "w-6 bg-indigo-500" : "w-1.5 bg-indigo-200"
        }`}/>
      ))}
    </div>
  );
}

// ── Main overlay ──────────────────────────────────────────────────────────────

export function WendyOnboardingOverlay({
  userName, token, apiBase = "/api", onComplete, onSkip,
}: WendyOnboardingOverlayProps) {
  const [step,        setStep]        = useState(0);
  const [journeyType, setJourneyType] = useState("indeciso");
  const [firstGoal,   setFirstGoal]   = useState("");
  const [saving,      setSaving]      = useState(false);

  const saveAndComplete = useCallback(async () => {
    setSaving(true);
    try {
      // Salva journeyType + primo obiettivo
      await fetch(`${apiBase}/users/me`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ journeyType }),
      });
      // Salva il primo obiettivo se compilato
      if (firstGoal.trim()) {
        await fetch(`${apiBase}/users/me/objectives`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ text: firstGoal.trim(), category: "generale" }),
        }).catch(() => {}); // non bloccare se l'endpoint non esiste ancora
      }
    } catch { /* silent: l'onboarding procede comunque */ }
    finally {
      setSaving(false);
      onComplete({ journeyType, firstGoal });
    }
  }, [journeyType, firstGoal, token, apiBase, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-4">
      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-7 space-y-6">
        {/* Progress dots */}
        <ProgressDots step={step} total={3}/>

        {/* Steps (no animation lib — conditional render) */}
        {step === 0 && (
          <StepWelcome
            userName={userName}
            onNext={() => setStep(1)}
            onSkip={onSkip}
          />
        )}
        {step === 1 && (
          <StepJourney
            value={journeyType}
            onChange={setJourneyType}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <StepGoal
            value={firstGoal}
            onChange={setFirstGoal}
            onComplete={saveAndComplete}
            onBack={() => setStep(1)}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}
