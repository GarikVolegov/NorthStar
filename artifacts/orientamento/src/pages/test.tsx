import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
import { useSubmitTest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Check, Sparkles, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useReducedMotion, easings } from "@/lib/motion";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api-fetch";

const BASE = import.meta.env.BASE_URL || "/";
const DRAFT_KEY = "northstar_test_draft";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ADVANCE_DELAY_MS = 320;
const SPIRIT_TIMER_SEC = 12;

// ── Nomi fasi visibili all'utente ─────────────────────────────────────────
const PHASE_LABELS = ["Attitudini", "Profilo Interiore", "Obiettivi"] as const;

// Nomi professionali degli spiriti mostrati nei badge delle domande
const SPIRIT_DISPLAY: Record<string, { emoji: string; name: string; desc: string }> = {
  presence:    { emoji: "✨", name: "Consapevolezza", desc: "Come percepisci te stesso" },
  vision:      { emoji: "🌙", name: "Visione",         desc: "Come proietti il futuro" },
  instinct:    { emoji: "⚡", name: "Energia",         desc: "Come agisci sotto pressione" },
  focus:       { emoji: "🔮", name: "Focus",           desc: "Come gestisci le priorità" },
  tenacity:    { emoji: "🔥", name: "Determinazione", desc: "Come perseveri negli ostacoli" },
};

const JOURNEY_CTX1_DEFAULTS: Record<string, number> = {
  autonomo: 5, azienda: 4, investitore: 4, dipendente: 1, indeciso: 3,
};

const RIASEC_QUESTION_IDS = ["q1","q2","q3","q4","q5","q6","q7","q8","q9","q10","q11","q12"] as const;
const SPIRIT_QUESTION_IDS = [
  "shen_1","shen_2","shen_3",
  "hun_1","hun_2","hun_3",
  "po_1","po_2","po_3",
  "yi_1","yi_2","yi_3",
  "zhi_1","zhi_2","zhi_3",
] as const;
const CTX_QUESTION_IDS = ["ctx_1","ctx_2"] as const;

const SPIRIT_META: Record<string, { key: string; emoji: string; transKey: string }> = {
  shen_1:{ key:"shen", emoji:"✨", transKey:"presence" },
  shen_2:{ key:"shen", emoji:"✨", transKey:"presence" },
  shen_3:{ key:"shen", emoji:"✨", transKey:"presence" },
  hun_1:{ key:"hun", emoji:"🌙", transKey:"vision" },
  hun_2:{ key:"hun", emoji:"🌙", transKey:"vision" },
  hun_3:{ key:"hun", emoji:"🌙", transKey:"vision" },
  po_1:{ key:"po", emoji:"⚡", transKey:"instinct" },
  po_2:{ key:"po", emoji:"⚡", transKey:"instinct" },
  po_3:{ key:"po", emoji:"⚡", transKey:"instinct" },
  yi_1:{ key:"yi", emoji:"🔮", transKey:"focus" },
  yi_2:{ key:"yi", emoji:"🔮", transKey:"focus" },
  yi_3:{ key:"yi", emoji:"🔮", transKey:"focus" },
  zhi_1:{ key:"zhi", emoji:"🔥", transKey:"tenacity" },
  zhi_2:{ key:"zhi", emoji:"🔥", transKey:"tenacity" },
  zhi_3:{ key:"zhi", emoji:"🔥", transKey:"tenacity" },
};

const ALL_RIASEC_IDS = [...RIASEC_QUESTION_IDS];
const ALL_SPIRIT_IDS = [...SPIRIT_QUESTION_IDS];
const ALL_CTX_IDS = [...CTX_QUESTION_IDS];
const ALL_IDS = [...ALL_RIASEC_IDS, ...ALL_SPIRIT_IDS, ...ALL_CTX_IDS];
const SPIRITS_START = ALL_RIASEC_IDS.length;                          // 12
const SPIRITS_END   = ALL_RIASEC_IDS.length + ALL_SPIRIT_IDS.length; // 27

interface TestDraft {
  step: number;
  answers: Record<string, number>;
  savedAt: number;
  sessionId?: number;
}

function loadDraft(): TestDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d: TestDraft = JSON.parse(raw);
    if (Date.now() - d.savedAt > DRAFT_TTL_MS) { localStorage.removeItem(DRAFT_KEY); return null; }
    return d;
  } catch { return null; }
}
function saveDraft(d: TestDraft) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {}
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}
async function assignUserToSession(sessionId: number, userId: number): Promise<void> {
  try {
    await apiFetch(`${BASE}api/test-sessions/${sessionId}/assign-user`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  } catch {}
}

// ── SpiritTimer (invariato dallo step 4) ─────────────────────────────────
const CIRC = 2 * Math.PI * 20;
interface SpiritTimerProps { totalSec: number; paused: boolean; reduced: boolean; }
function SpiritTimer({ totalSec, paused, reduced }: SpiritTimerProps) {
  const [remaining, setRemaining] = useState(totalSec);
  useEffect(() => {
    if (reduced || paused || remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => { if (r <= 1) { clearInterval(id); return 0; } return r - 1; }), 1000);
    return () => clearInterval(id);
  }, [paused, reduced, remaining]);
  const offset = CIRC * (1 - remaining / totalSec);
  const strokeColor = remaining <= 1 ? "var(--destructive)" : remaining <= 4 ? "#f59e0b" : "var(--primary)";
  if (reduced) return <span className="text-xs text-muted-foreground/60 italic">Prenditi il tuo tempo</span>;
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <svg width="32" height="32" viewBox="0 0 48 48" className="-rotate-90">
        <circle cx="24" cy="24" r="20" fill="none" strokeWidth="3" className="stroke-muted" />
        <motion.circle cx="24" cy="24" r="20" fill="none" strokeWidth="3" strokeLinecap="round"
          style={{ stroke: strokeColor }} strokeDasharray={CIRC}
          animate={{ strokeDashoffset: offset }} transition={{ duration: 0.9, ease: "linear" }}
        />
      </svg>
      <AnimatePresence mode="wait">
        {remaining > 0 ? (
          <motion.span key={remaining} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.2 }}
            className="text-xs font-mono tabular-nums" style={{ color: strokeColor }}>{remaining}s
          </motion.span>
        ) : (
          <motion.span key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground/50">Rispondi quando sei pronto
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── SectionDivider: banner sottile che appare al cambio sezione ──────────────
// Non blocca il flusso — è puramente informativo.
// Sparisce da solo dopo DIVIDER_MS ms (o con reduced motion: non appare).
const DIVIDER_MS = 1800;
interface SectionDividerProps {
  label: string;
  emoji: string;
  description: string;
  onDone: () => void;
  reduced: boolean;
}
function SectionDivider({ label, emoji, description, onDone, reduced }: SectionDividerProps) {
  useEffect(() => {
    const id = setTimeout(onDone, reduced ? 0 : DIVIDER_MS);
    return () => clearTimeout(id);
  }, [onDone, reduced]);

  if (reduced) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35 }}
      className="mb-8 flex items-center gap-3 bg-primary/8 border border-primary/20 rounded-2xl px-5 py-3.5"
    >
      <span className="text-xl">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <motion.div
        className="h-0.5 w-12 bg-primary/30 rounded-full origin-left"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: DIVIDER_MS / 1000, ease: "linear" }}
      />
    </motion.div>
  );
}

// ── Componente principale ────────────────────────────────────────────────
export default function Test() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const submitTest = useSubmitTest();
  const { user } = useAuth();
  const prefersReduced = useReducedMotion();

  const [draft] = useState<TestDraft | null>(() => loadDraft());
  const [resumeBannerVisible, setResumeBannerVisible] = useState(true);
  const [resumed, setResumed] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>(() => {
    const jt = user?.journeyType;
    if (!jt || !JOURNEY_CTX1_DEFAULTS[jt]) return {};
    return { ctx_1: JOURNEY_CTX1_DEFAULTS[jt] };
  });
  const [direction, setDirection] = useState<1 | -1>(1);
  const [justSelected, setJustSelected] = useState<string | null>(null);
  const assignedSessionRef = useRef<number | null>(null);

  // SectionDivider state: quale divider mostrare ('spirits' | 'ctx' | null)
  const [activeDivider, setActiveDivider] = useState<"spirits" | "ctx" | null>(null);

  useEffect(() => {
    if (currentStep === 0 && Object.keys(answers).length === 0) return;
    saveDraft({ step: currentStep, answers, savedAt: Date.now() });
  }, [currentStep, answers]);

  useEffect(() => {
    if (!user || !draft?.sessionId) return;
    if (assignedSessionRef.current === draft.sessionId) return;
    assignedSessionRef.current = draft.sessionId;
    assignUserToSession(draft.sessionId, user.id);
  }, [user, draft]);

  // Derivate di fase
  const isComplete  = currentStep >= ALL_IDS.length;
  const isCtxQ      = currentStep >= SPIRITS_END;
  const isSpiritQ   = currentStep >= SPIRITS_START && currentStep < SPIRITS_END;
  const isRiasecQ   = currentStep < SPIRITS_START;

  const ctxOffset     = currentStep - SPIRITS_END + 1;
  const spiritOffset  = currentStep - SPIRITS_START;
  const questionInGroup = (spiritOffset % 3) + 1;

  const currentId  = ALL_IDS[currentStep];
  const spiritInfo = isSpiritQ ? SPIRIT_META[currentId] : null;
  const progress   = (currentStep / ALL_IDS.length) * 100;

  const currentPhase = isCtxQ ? 2 : isSpiritQ ? 1 : 0;

  const questionText = isCtxQ
    ? t(`test.questions.ctx.${currentId}`)
    : isSpiritQ
    ? t(`test.questions.spirits.${currentId}`)
    : t(`test.questions.riasec.${currentId}`);

  const headerLabel = isCtxQ
    ? t("test.ctxCount", { current: ctxOffset, total: ALL_CTX_IDS.length })
    : isSpiritQ
    ? t("test.innerCompassCount", { current: spiritOffset + 1, total: ALL_SPIRIT_IDS.length })
    : t("test.questionOf", { current: currentStep + 1, total: ALL_RIASEC_IDS.length });

  const OPTIONS = useMemo(() => [
    { value: 1, label: t("test.options.1") },
    { value: 2, label: t("test.options.2") },
    { value: 3, label: t("test.options.3") },
    { value: 4, label: t("test.options.4") },
    { value: 5, label: t("test.options.5") },
  ], [t]);

  // ── handleAnswer ──────────────────────────────────────────────────────
  // Flusso lineare: dopo l'ultima domanda RIASEC mostra il divider 'spirits',
  // dopo l'ultima domanda Spirit mostra il divider 'ctx', poi avanza.
  // Il SectionDivider chiama onDone() che triggera il vero advance.
  const handleAnswer = useCallback((value: number) => {
    if (justSelected !== null) return;
    const id = currentId;
    const nextStep = (prev: number) => prev + 1;

    setDirection(1);
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setJustSelected(id);

    setTimeout(() => {
      setJustSelected(null);
      const next = currentStep + 1;

      // Ultima domanda RIASEC -> mostra divider 'spirits' prima di avanzare
      if (next === SPIRITS_START) {
        setCurrentStep(next);
        setActiveDivider("spirits");
        return;
      }
      // Ultima domanda Spirit -> mostra divider 'ctx' prima di avanzare
      if (next === SPIRITS_END) {
        setCurrentStep(next);
        setActiveDivider("ctx");
        return;
      }

      setCurrentStep(nextStep);
    }, ADVANCE_DELAY_MS);
  }, [justSelected, currentId, currentStep]);

  const handleBack = useCallback(() => {
    if (justSelected !== null) return;
    setActiveDivider(null); // chiude eventuale divider aperto
    setDirection(-1);
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  }, [justSelected, currentStep]);

  // Keyboard navigation
  useEffect(() => {
    if (isComplete) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (justSelected !== null) return;
      switch (e.key) {
        case "1": case "2": case "3": case "4": case "5":
          e.preventDefault(); handleAnswer(Number(e.key)); break;
        case "ArrowLeft": case "Backspace":
          e.preventDefault(); handleBack(); break;
        case "Enter": case " ": {
          const cur = answers[currentId];
          if (cur !== undefined) { e.preventDefault(); handleAnswer(cur); }
          break;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isComplete, justSelected, currentId, answers, handleAnswer, handleBack]);

  const handleResume = () => {
    if (!draft) return;
    setCurrentStep(draft.step);
    setAnswers(draft.answers);
    setResumeBannerVisible(false);
    setResumed(true);
  };
  const handleDismissDraft = () => { clearDraft(); setResumeBannerVisible(false); };

  const handleSubmit = () => {
    submitTest.mutate(
      { data: { answers } },
      {
        onSuccess: async (session) => {
          saveDraft({ step: currentStep, answers, savedAt: Date.now(), sessionId: session.id });
          if (user && assignedSessionRef.current !== session.id) {
            assignedSessionRef.current = session.id;
            await assignUserToSession(session.id, user.id);
          }
          clearDraft();
          setLocation(`/risultati/${session.id}`);
        },
      }
    );
  };

  const questionVariants: Variants = prefersReduced
    ? { enter: { opacity: 0 }, center: { opacity: 1, transition: { duration: 0.15 } }, exit: { opacity: 0, transition: { duration: 0.1 } } }
    : {
        enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
        center: { opacity: 1, x: 0, transition: { duration: 0.38, ease: easings.easeOut } },
        exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -40 : 40, transition: { duration: 0.2, ease: easings.easeIn } }),
      };

  // ── Completion screen ───────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-24 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="w-24 h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-8 animate-in zoom-in duration-500">
          <Check className="w-12 h-12" />
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">{t("test.complete.title")}</h1>
        <p className="text-lg text-muted-foreground mb-2 leading-relaxed">{t("test.complete.subtitle")}</p>
        {user && <p className="text-sm text-primary font-medium mb-6">{t("test.complete.savedAccount")}</p>}
        <Button size="lg" onClick={handleSubmit} disabled={submitTest.isPending} className="rounded-full px-8 h-14 text-lg w-full sm:w-auto">
          {submitTest.isPending
            ? <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> {t("test.complete.processing")}</>
            : <><Sparkles className="mr-2 w-5 h-5" /> {t("test.complete.discoverResults")}</>}
        </Button>
        {submitTest.isError && <p className="mt-4 text-sm text-destructive">{t("test.complete.submitError")}</p>}
      </div>
    );
  }

  // ── Question screen ────────────────────────────────────────────────
  const showResumeBanner = !!draft && resumeBannerVisible && !resumed
    && currentStep === 0 && Object.keys(answers).length === 0;

  // Config SectionDivider per ogni cambio sezione
  const DIVIDER_CONFIG = {
    spirits: {
      label: "Profilo Interiore",
      emoji: "🧠",
      description: "Le prossime domande esplorano le tue dimensioni personali",
    },
    ctx: {
      label: "Obiettivi",
      emoji: "🎯",
      description: "Ultime domande: allineiamo il percorso ai tuoi obiettivi",
    },
  } as const;

  return (
    <div className="container max-w-2xl mx-auto px-4 py-12 min-h-[70vh]">

      {/* Resume banner */}
      <AnimatePresence>
        {showResumeBanner && (
          <motion.div
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}
            className="mb-6 flex items-center gap-3 bg-primary/10 border border-primary/25 rounded-2xl px-4 py-3"
          >
            <RotateCcw className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Hai un test in corso</p>
              <p className="text-xs text-muted-foreground">
                Avevi risposto a {draft?.step ?? 0} domande su {ALL_IDS.length}. Vuoi riprendere da dove eri rimasto?
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="ghost" onClick={handleDismissDraft} className="rounded-full h-7 px-2">
                <X className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" onClick={handleResume} className="rounded-full h-7 px-3 text-xs">Riprendi</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase stepper */}
      <div className="flex items-center justify-center gap-1.5 mb-6">
        {PHASE_LABELS.map((label, i) => {
          const isActive = currentPhase === i;
          const isDone   = currentPhase > i;
          return (
            <React.Fragment key={i}>
              <motion.div
                layout
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
                  isActive ? "bg-primary text-primary-foreground shadow-sm" :
                  isDone   ? "bg-primary/15 text-primary" : "text-muted-foreground"
                )}
                animate={{ scale: isActive ? 1.05 : 1 }}
                transition={{ duration: 0.25 }}
              >
                {isDone
                  ? <Check className="w-3 h-3" />
                  : <span className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0",
                      isActive ? "border-primary-foreground/50" : "border-current opacity-60")}>{i + 1}</span>
                }
                <span>{label}</span>
              </motion.div>
              {i < PHASE_LABELS.length - 1 && (
                <div className={cn("h-px w-3 rounded-full shrink-0", isDone ? "bg-primary/40" : "bg-border")} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Header: back + counter */}
      <div className="flex items-center justify-between mb-4">
        <motion.button
          onClick={handleBack}
          disabled={currentStep === 0 || justSelected !== null}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          whileHover={prefersReduced ? {} : { x: -2 }}
          whileTap={prefersReduced ? {} : { scale: 0.97 }}
        >
          <ArrowLeft className="w-4 h-4" /> {t("test.back")}
        </motion.button>
        <span className="text-sm text-muted-foreground">{headerLabel}</span>
      </div>

      {/* Progress bar */}
      <motion.div
        initial={false}
        animate={{ scaleX: progress / 100 }}
        transition={prefersReduced ? { duration: 0 } : { duration: 0.4, ease: easings.easeOut }}
        style={{ transformOrigin: "left" }}
        className="h-1.5 bg-primary rounded-full mb-10"
      />

      {/* Section divider (non-blocking) */}
      <AnimatePresence>
        {activeDivider && (
          <SectionDivider
            key={activeDivider}
            label={DIVIDER_CONFIG[activeDivider].label}
            emoji={DIVIDER_CONFIG[activeDivider].emoji}
            description={DIVIDER_CONFIG[activeDivider].description}
            reduced={prefersReduced}
            onDone={() => setActiveDivider(null)}
          />
        )}
      </AnimatePresence>

      {/* Question */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentStep}
          custom={direction}
          variants={questionVariants}
          initial="enter"
          animate="center"
          exit="exit"
        >
          {/* Badge Profilo Interiore con timer */}
          {spiritInfo && (() => {
            const display = SPIRIT_DISPLAY[spiritInfo.transKey];
            return (
              <div className="flex items-center gap-3 mb-6">
                <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-full px-4 py-1.5">
                  <span>{display.emoji}</span>
                  <span className="text-sm font-medium text-primary">
                    {display.name} · <span className="font-normal text-muted-foreground">{display.desc}</span>
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {[1,2,3].map((n) => (
                    <span key={n} className={cn("w-2 h-2 rounded-full", n <= questionInGroup ? "bg-primary" : "bg-muted")} />
                  ))}
                </div>
                <div className="ml-auto">
                  <SpiritTimer key={currentStep} totalSec={SPIRIT_TIMER_SEC} paused={justSelected !== null} reduced={prefersReduced} />
                </div>
              </div>
            );
          })()}

          {/* Badge Obiettivi */}
          {isCtxQ && (
            <div className="flex items-center gap-3 mb-6">
              <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-full px-4 py-1.5">
                <span>🎯</span>
                <span className="text-sm font-medium text-primary">
                  {t("test.ctxBadge", { current: ctxOffset, total: ALL_CTX_IDS.length })}
                </span>
              </div>
            </div>
          )}

          <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-semibold text-foreground mb-8 md:mb-10 leading-snug">
            {questionText}
          </h2>

          {/* Opzioni */}
          <div className="space-y-3">
            {OPTIONS.map((opt, optIdx) => {
              const selected = answers[currentId] === opt.value;
              const isJustSelected = justSelected === currentId && selected;
              return (
                <motion.button
                  key={opt.value}
                  onClick={() => handleAnswer(opt.value)}
                  disabled={justSelected !== null}
                  initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={prefersReduced ? { duration: 0 } : { delay: optIdx * 0.04, duration: 0.3, ease: easings.easeOut }}
                  whileHover={prefersReduced || justSelected !== null ? undefined : { scale: 1.01 }}
                  whileTap={prefersReduced || justSelected !== null ? undefined : { scale: 0.98 }}
                  className={cn(
                    "w-full flex items-center justify-between px-4 sm:px-5 py-4 min-h-[56px] rounded-xl border text-left text-sm sm:text-base font-medium transition-colors duration-150",
                    selected ? "bg-primary text-primary-foreground border-primary shadow-md"
                             : "bg-card border-border hover:border-primary/40 hover:bg-primary/5 text-foreground",
                    justSelected !== null && !selected && "opacity-50"
                  )}
                >
                  <span className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={cn(
                      "hidden pointer-fine:inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold border shrink-0 transition-opacity duration-150",
                      selected ? "border-primary-foreground/40 text-primary-foreground/70 opacity-70"
                        : justSelected !== null ? "opacity-0"
                        : "border-muted-foreground/30 text-muted-foreground/60 opacity-60"
                    )}>{opt.value}</span>
                    {opt.label}
                  </span>
                  <motion.div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-3",
                      selected ? "border-primary-foreground bg-primary-foreground/20" : "border-muted-foreground"
                    )}
                    animate={
                      prefersReduced ? {} :
                      isJustSelected ? { scale: [1, 1.35, 0.95, 1.1, 1] } :
                      selected       ? { scale: [1, 1.2, 1] } : { scale: 1 }
                    }
                    transition={isJustSelected ? { duration: 0.4, ease: "easeOut" } : { duration: 0.25 }}
                  >
                    {selected && (
                      isJustSelected ? (
                        <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.18, ease: "easeOut" }}>
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </motion.div>
                      ) : (
                        <div className="w-2.5 h-2.5 rounded-full bg-primary-foreground" />
                      )
                    )}
                  </motion.div>
                </motion.button>
              );
            })}
          </div>

          {/* Keyboard hint */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.4 }}
            className="hidden pointer-fine:flex items-center gap-3 mt-8 text-xs text-muted-foreground/50 justify-center flex-wrap"
          >
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/40 font-mono text-[10px]">1</kbd>
              <span>–</span>
              <kbd className="px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/40 font-mono text-[10px]">5</kbd>
              <span className="ml-1">seleziona</span>
            </span>
            {answers[currentId] !== undefined && (
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/40 font-mono text-[10px]">Enter</kbd>
                <span className="ml-1">conferma</span>
              </span>
            )}
            {currentStep > 0 && (
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/40 font-mono text-[10px]">←</kbd>
                <span className="ml-1">indietro</span>
              </span>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
