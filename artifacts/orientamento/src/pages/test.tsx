import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
import { useSubmitTest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ArrowRight, Check, Sparkles, Target, RotateCcw, X } from "lucide-react";
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
const SPIRITS_END = ALL_RIASEC_IDS.length + ALL_SPIRIT_IDS.length;

// STEP 5: PHASE_LABELS era dentro il componente, ricreato ad ogni render.
// È un array statico che non dipende da nessun stato o prop — va fuori.
// Nota: se in futuro vuoi traduzioni dinamiche, spostalo dentro con useMemo([t]).
const PHASE_LABELS = ["Inclinazioni", "Bussola", "Obiettivi"] as const;

interface TestDraft {
  step: number;
  answers: Record<string, number>;
  transition1Passed: boolean;
  transition2Passed: boolean;
  savedAt: number;
  sessionId?: number;
}

function loadDraft(): TestDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft: TestDraft = JSON.parse(raw);
    if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch { return null; }
}
function saveDraft(draft: TestDraft) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
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

const CIRC = 2 * Math.PI * 20;

interface SpiritTimerProps {
  totalSec: number;
  paused: boolean;
  reduced: boolean;
}

function SpiritTimer({ totalSec, paused, reduced }: SpiritTimerProps) {
  const [remaining, setRemaining] = useState(totalSec);

  useEffect(() => {
    if (reduced || paused || remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(id); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused, reduced, remaining]);

  const fraction = remaining / totalSec;
  const offset = CIRC * (1 - fraction);
  const strokeColor =
    remaining <= 1 ? "var(--destructive)" :
    remaining <= 4 ? "#f59e0b" :
                     "var(--primary)";

  if (reduced) {
    return <span className="text-xs text-muted-foreground/60 italic">Prenditi il tuo tempo</span>;
  }

  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <svg width="32" height="32" viewBox="0 0 48 48" className="-rotate-90">
        <circle cx="24" cy="24" r="20" fill="none" strokeWidth="3" className="stroke-muted" />
        <motion.circle
          cx="24" cy="24" r="20" fill="none" strokeWidth="3" strokeLinecap="round"
          style={{ stroke: strokeColor }}
          strokeDasharray={CIRC}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: "linear" }}
        />
      </svg>
      <AnimatePresence mode="wait">
        {remaining > 0 ? (
          <motion.span
            key={remaining}
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.2 }}
            className="text-xs font-mono tabular-nums"
            style={{ color: strokeColor }}
          >
            {remaining}s
          </motion.span>
        ) : (
          <motion.span
            key="done"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground/50"
          >
            Rispondi quando sei pronto
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Componente principale ─────────────────────────────────────────────────
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
  const [transition1Passed, setTransition1Passed] = useState(false);
  const [transition2Passed, setTransition2Passed] = useState(false);
  const [justSelected, setJustSelected] = useState<string | null>(null);
  const assignedSessionRef = useRef<number | null>(null);

  useEffect(() => {
    if (currentStep === 0 && Object.keys(answers).length === 0) return;
    saveDraft({ step: currentStep, answers, transition1Passed, transition2Passed, savedAt: Date.now() });
  }, [currentStep, answers, transition1Passed, transition2Passed]);

  useEffect(() => {
    if (!user || !draft?.sessionId) return;
    if (assignedSessionRef.current === draft.sessionId) return;
    assignedSessionRef.current = draft.sessionId;
    assignUserToSession(draft.sessionId, user.id);
  }, [user, draft]);

  const showTransition1 = currentStep === ALL_RIASEC_IDS.length && !transition1Passed;
  const showTransition2 = currentStep === SPIRITS_END && !transition2Passed;
  const isComplete = currentStep >= ALL_IDS.length;
  const isCtxQ = currentStep >= SPIRITS_END && !showTransition2;
  const isSpiritQ = currentStep >= ALL_RIASEC_IDS.length && currentStep < SPIRITS_END;
  const ctxOffset = currentStep - SPIRITS_END + 1;
  const spiritOffset = currentStep - ALL_RIASEC_IDS.length;
  const questionInGroup = (spiritOffset % 3) + 1;
  const currentId = ALL_IDS[currentStep];
  const spiritInfo = isSpiritQ ? SPIRIT_META[currentId] : null;
  const progress = (currentStep / ALL_IDS.length) * 100;

  const questionText = isCtxQ
    ? t(`test.questions.ctx.${currentId}`)
    : isSpiritQ
    ? t(`test.questions.spirits.${currentId}`)
    : t(`test.questions.riasec.${currentId}`);

  // STEP 5: OPTIONS memoizzato — ricreato solo se cambia la funzione t()
  // cioè solo al cambio lingua. Prima veniva ricreato ad ogni singolo render
  // del componente (ogni risposta, ogni step, ogni keystroke).
  const OPTIONS = useMemo(() => [
    { value: 1, label: t("test.options.1") },
    { value: 2, label: t("test.options.2") },
    { value: 3, label: t("test.options.3") },
    { value: 4, label: t("test.options.4") },
    { value: 5, label: t("test.options.5") },
  ], [t]);

  const handleAnswer = useCallback((value: number) => {
    if (justSelected !== null) return;
    const id = currentId;
    setDirection(1);
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setJustSelected(id);
    setTimeout(() => {
      setJustSelected(null);
      setCurrentStep((prev) => prev + 1);
    }, ADVANCE_DELAY_MS);
  }, [justSelected, currentId]);

  const handleBack = useCallback(() => {
    if (justSelected !== null) return;
    setDirection(-1);
    if (showTransition1) { setCurrentStep(ALL_RIASEC_IDS.length - 1); return; }
    if (showTransition2) { setCurrentStep(SPIRITS_END - 1); return; }
    if (currentStep === ALL_RIASEC_IDS.length && transition1Passed) { setTransition1Passed(false); return; }
    if (currentStep === SPIRITS_END && transition2Passed) { setTransition2Passed(false); return; }
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  }, [justSelected, showTransition1, showTransition2, currentStep, transition1Passed, transition2Passed]);

  useEffect(() => {
    if (showTransition1 || showTransition2 || isComplete) return;
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
          const current = answers[currentId];
          if (current !== undefined) { e.preventDefault(); handleAnswer(current); }
          break;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showTransition1, showTransition2, isComplete, justSelected, currentId, answers, handleAnswer, handleBack]);

  const handleResume = () => {
    if (!draft) return;
    setCurrentStep(draft.step);
    setAnswers(draft.answers);
    setTransition1Passed(draft.transition1Passed);
    setTransition2Passed(draft.transition2Passed);
    setResumeBannerVisible(false);
    setResumed(true);
  };
  const handleDismissDraft = () => { clearDraft(); setResumeBannerVisible(false); };

  const handleSubmit = () => {
    submitTest.mutate(
      { data: { answers } },
      {
        onSuccess: async (session) => {
          saveDraft({ step: currentStep, answers, transition1Passed, transition2Passed, savedAt: Date.now(), sessionId: session.id });
          if (user) {
            if (assignedSessionRef.current !== session.id) {
              assignedSessionRef.current = session.id;
              await assignUserToSession(session.id, user.id);
            }
          }
          clearDraft();
          setLocation(`/risultati/${session.id}`);
        },
      }
    );
  };

  const questionVariants: Variants = prefersReduced
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : {
        enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
        center: { opacity: 1, x: 0, transition: { duration: 0.38, ease: easings.easeOut } },
        exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -40 : 40, transition: { duration: 0.2, ease: easings.easeIn } }),
      };

  // ── Transition 1 ───────────────────────────────────────────────────
  if (showTransition1) {
    const spiritsTransition = [
      { emoji: "✨", transKey: "presence" },
      { emoji: "🌙", transKey: "vision" },
      { emoji: "⚡", transKey: "instinct" },
      { emoji: "🔮", transKey: "focus" },
      { emoji: "🔥", transKey: "tenacity" },
    ];
    return (
      <div className="container max-w-2xl mx-auto px-4 py-20 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-8 animate-in zoom-in duration-500">
          <Sparkles className="w-10 h-10" />
        </div>
        <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-full px-4 py-1.5 mb-6 text-sm font-medium text-primary">
          <Sparkles className="w-3.5 h-3.5" /> {t("test.transition.badge")}
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">{t("test.transition.title")}</h1>
        <p className="text-lg text-muted-foreground mb-4 leading-relaxed max-w-xl">
          {t("test.transition.intro")}{" "}
          <strong>{t("test.transition.fiveSpirits")}</strong>{" "}
          {t("test.transition.tradition")}
        </p>
        <p className="text-base text-muted-foreground mb-10 leading-relaxed max-w-xl"
          dangerouslySetInnerHTML={{ __html: t("test.transition.details") }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 w-full mb-10">
          {spiritsTransition.map((s) => (
            <div key={s.transKey} className="flex flex-col items-center gap-1.5 bg-card border rounded-2xl px-3 py-4 text-center">
              <span className="text-2xl">{s.emoji}</span>
              <div className="font-semibold text-sm text-foreground">{t(`test.transition.spirits.${s.transKey}.name`)}</div>
              <div className="text-xs text-muted-foreground">{t(`test.transition.spirits.${s.transKey}.desc`)}</div>
              <div className="flex gap-1 mt-1">{[1,2,3].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/30" />)}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button variant="ghost" onClick={handleBack} className="rounded-full px-6 order-2 sm:order-1">
            <ArrowLeft className="mr-2 w-4 h-4" /> {t("test.back")}
          </Button>
          <Button size="lg" onClick={() => setTransition1Passed(true)} className="rounded-full px-10 h-13 order-1 sm:order-2">
            {t("test.transition.startCompass")} <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Transition 2 ───────────────────────────────────────────────────
  if (showTransition2) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-20 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-8 animate-in zoom-in duration-500">
          <Target className="w-10 h-10" />
        </div>
        <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-full px-4 py-1.5 mb-6 text-sm font-medium text-primary">
          <Target className="w-3.5 h-3.5" /> {t("test.transition2.badge")}
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">{t("test.transition2.title")}</h1>
        <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-xl">{t("test.transition2.subtitle")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mb-10 text-left">
          <div className="flex flex-col gap-2 bg-card border rounded-2xl px-5 py-4">
            <span className="text-2xl">💼</span>
            <div className="font-semibold text-sm text-foreground">{t("test.transition2.card1Title")}</div>
            <div className="text-xs text-muted-foreground">{t("test.transition2.card1Desc")}</div>
          </div>
          <div className="flex flex-col gap-2 bg-card border rounded-2xl px-5 py-4">
            <span className="text-2xl">🧭</span>
            <div className="font-semibold text-sm text-foreground">{t("test.transition2.card2Title")}</div>
            <div className="text-xs text-muted-foreground">{t("test.transition2.card2Desc")}</div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button variant="ghost" onClick={handleBack} className="rounded-full px-6 order-2 sm:order-1">
            <ArrowLeft className="mr-2 w-4 h-4" /> {t("test.back")}
          </Button>
          <Button size="lg" onClick={() => setTransition2Passed(true)} className="rounded-full px-10 h-13 order-1 sm:order-2">
            {t("test.transition2.start")} <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

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

  // ── Question screen ──────────────────────────────────────────────────
  const showResumeBanner = !!draft && resumeBannerVisible && !resumed && currentStep === 0 && Object.keys(answers).length === 0;
  const currentPhase = isCtxQ ? 2 : isSpiritQ ? 1 : 0;
  const headerLabel = isCtxQ
    ? t("test.ctxCount", { current: ctxOffset, total: ALL_CTX_IDS.length })
    : isSpiritQ
    ? t("test.innerCompassCount", { current: spiritOffset + 1, total: ALL_SPIRIT_IDS.length })
    : t("test.questionOf", { current: currentStep + 1, total: ALL_RIASEC_IDS.length });

  return (
    <div className="container max-w-2xl mx-auto px-4 py-12 min-h-[70vh]">

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
          const isDone = currentPhase > i;
          return (
            <React.Fragment key={i}>
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300",
                isActive ? "bg-primary text-primary-foreground shadow-sm" :
                isDone   ? "bg-primary/15 text-primary" : "text-muted-foreground"
              )}>
                {isDone
                  ? <Check className="w-3 h-3" />
                  : <span className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0",
                      isActive ? "border-primary-foreground/50" : "border-current opacity-60")}>{i + 1}</span>
                }
                <span>{label}</span>
              </div>
              {i < PHASE_LABELS.length - 1 && (
                <div className={cn("h-px w-3 rounded-full shrink-0", isDone ? "bg-primary/40" : "bg-border")} />
              )}
            </React.Fragment>
          );
        })}
      </div>

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

      <motion.div
        initial={false}
        animate={{ scaleX: progress / 100 }}
        transition={prefersReduced ? { duration: 0 } : { duration: 0.4, ease: easings.easeOut }}
        style={{ transformOrigin: "left" }}
        className="h-1.5 bg-primary rounded-full mb-10"
      />

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentStep}
          custom={direction}
          variants={questionVariants}
          initial="enter"
          animate="center"
          exit="exit"
        >
          {spiritInfo && (
            <div className="flex items-center gap-3 mb-6">
              <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-full px-4 py-1.5">
                <span>{spiritInfo.emoji}</span>
                <span className="text-sm font-medium text-primary">
                  {t(`test.transition.spirits.${spiritInfo.transKey}.name`)} · {t(`test.transition.spirits.${spiritInfo.transKey}.desc`)}
                </span>
              </div>
              <div className="flex gap-1.5">
                {[1,2,3].map((n) => (
                  <span key={n} className={cn("w-2 h-2 rounded-full", n <= questionInGroup ? "bg-primary" : "bg-muted")} />
                ))}
              </div>
              <div className="ml-auto">
                <SpiritTimer
                  key={currentStep}
                  totalSec={SPIRIT_TIMER_SEC}
                  paused={justSelected !== null}
                  reduced={prefersReduced}
                />
              </div>
            </div>
          )}

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
                    selected
                      ? "bg-primary text-primary-foreground border-primary shadow-md"
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
                    )}>
                      {opt.value}
                    </span>
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
