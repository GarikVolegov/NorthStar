import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
import { useSubmitTest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Check, Sparkles, RotateCcw, X, ArrowRight, Clock, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useReducedMotion, easings } from "@/lib/motion";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api-fetch";
import { LyraAvatar } from "@/components/lyra-avatar";
import { SCENARIOS } from "@/lib/test-scenarios";

const BASE = import.meta.env.BASE_URL || "/";
const DRAFT_KEY = "northstar_test_draft";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ADVANCE_DELAY_MS = 320;
const SPIRIT_TIMER_SEC = 12;

const PHASE_LABELS = ["Attitudini", "Profilo Interiore", "Obiettivi"] as const;

const SPIRIT_DISPLAY: Record<string, { emoji: string; name: string; desc: string }> = {
  presence:  { emoji: "✨", name: "Consapevolezza", desc: "Come percepisci te stessa" },
  vision:    { emoji: "🌙", name: "Visione",         desc: "Come proietti il futuro" },
  instinct:  { emoji: "⚡", name: "Energia",         desc: "Come agisci sotto pressione" },
  focus:     { emoji: "🔮", name: "Focus",           desc: "Come gestisci le priorità" },
  tenacity:  { emoji: "🔥", name: "Determinazione", desc: "Come perseveri negli ostacoli" },
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
const ALL_CTX_IDS   = [...CTX_QUESTION_IDS];
const ALL_IDS       = [...ALL_RIASEC_IDS, ...ALL_SPIRIT_IDS, ...ALL_CTX_IDS];
const SPIRITS_START = ALL_RIASEC_IDS.length;
const SPIRITS_END   = ALL_RIASEC_IDS.length + ALL_SPIRIT_IDS.length;

const PHASE_BG = [
  "bg-blue-50 dark:bg-blue-950/40",
  "bg-violet-50 dark:bg-violet-950/40",
  "bg-amber-50 dark:bg-amber-950/40",
] as const;

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
function saveDraft(d: TestDraft) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {} }
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch {} }
async function assignUserToSession(sessionId: number, userId: number): Promise<void> {
  try {
    await apiFetch(`${BASE}api/test-sessions/${sessionId}/assign-user`, {
      method: "POST", body: JSON.stringify({ userId }),
    });
  } catch {}
}

// ── SpiritTimer ────────────────────────────────────────────────────────
const CIRC = 2 * Math.PI * 20;
function SpiritTimer({ totalSec, paused, reduced }: { totalSec: number; paused: boolean; reduced: boolean }) {
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
      <svg width="28" height="28" viewBox="0 0 48 48" className="-rotate-90">
        <circle cx="24" cy="24" r="20" fill="none" strokeWidth="3" className="stroke-muted" />
        <motion.circle cx="24" cy="24" r="20" fill="none" strokeWidth="3" strokeLinecap="round"
          style={{ stroke: strokeColor }} strokeDasharray={CIRC}
          animate={{ strokeDashoffset: offset }} transition={{ duration: 0.9, ease: "linear" }}
        />
      </svg>
      <AnimatePresence mode="wait">
        {remaining > 0
          ? <motion.span key={remaining} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }} className="text-xs font-mono tabular-nums" style={{ color: strokeColor }}>{remaining}s</motion.span>
          : <motion.span key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-xs text-muted-foreground/50">Rispondi quando sei pronto</motion.span>
        }
      </AnimatePresence>
    </div>
  );
}

// ── SectionDivider ──────────────────────────────────────────────────────
const DIVIDER_MS = 1800;
function SectionDivider({ label, emoji, description, onDone, reduced }: {
  label: string; emoji: string; description: string; onDone: () => void; reduced: boolean;
}) {
  useEffect(() => { const id = setTimeout(onDone, reduced ? 0 : DIVIDER_MS); return () => clearTimeout(id); }, [onDone, reduced]);
  if (reduced) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35 }}
      className="mb-8 flex items-center gap-3 bg-primary/8 border border-primary/20 rounded-2xl px-5 py-3.5"
    >
      <span className="text-xl">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <motion.div className="h-0.5 w-12 bg-primary/30 rounded-full origin-left"
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
        transition={{ duration: DIVIDER_MS / 1000, ease: "linear" }}
      />
    </motion.div>
  );
}

// ── TypewriterText ─────────────────────────────────────────────────────
const CHAR_DELAY_MS = 28;
interface TypewriterTextProps { text: string; reduced: boolean; className?: string; }
function TypewriterText({ text, reduced, className }: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState(reduced ? text : "");
  const [done, setDone] = useState(reduced);
  useEffect(() => {
    if (reduced) { setDisplayed(text); setDone(true); return; }
    setDisplayed(""); setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++; setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(id); setDone(true); }
    }, CHAR_DELAY_MS);
    return () => clearInterval(id);
  }, [text, reduced]);
  return (
    <span className={className}>
      {displayed}
      {!done && (
        <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
          className="inline-block w-px h-[1em] bg-current align-middle ml-0.5" />
      )}
    </span>
  );
}

// ── WelcomeScreen ────────────────────────────────────────────────────────
interface WelcomeScreenProps { userName?: string; reduced: boolean; onStart: () => void; }
function WelcomeScreen({ userName, reduced, onStart }: WelcomeScreenProps) {
  const startBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { startBtnRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStart(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart]);

  const greeting = userName ? `Ciao, ${userName.split(" ")[0]}.` : "Ciao.";

  const containerVariants: Variants = reduced
    ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.13, delayChildren: 0.1 } } };
  const itemVariants: Variants = reduced
    ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } };

  return (
    /*
     * Fullscreen su mobile: fixed inset-0 + overflow-y-auto
     * Su sm+ si comporta come prima (centrato, scrollabile con il resto della pagina)
     */
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background sm:static sm:z-auto sm:bg-transparent sm:overflow-visible">
      {/*
       * Su mobile: flex col, justify-between per spingere il CTA in fondo
       * Su sm+: torna centrato come prima (justify-center, py-16)
       */}
      <div className="flex flex-col justify-between min-h-full px-5 pt-12 pb-[env(safe-area-inset-bottom,1.5rem)] sm:justify-center sm:items-center sm:py-16 sm:pb-16 sm:min-h-0">

        {/* Contenuto centrale */}
        <motion.div
          className="flex flex-col items-center text-center gap-5 w-full max-w-lg mx-auto sm:gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* Avatar + halo */}
          <motion.div variants={itemVariants} className="relative">
            {!reduced && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: [0, 0.5, 0], scale: [0.5, 1.4, 1.8] }}
                transition={{ duration: 1.3, ease: "easeOut", delay: 0.2 }}
                className="absolute inset-0 m-auto rounded-full pointer-events-none"
                style={{ background: "var(--primary)", filter: "blur(28px)", width: "100%", height: "100%" }}
              />
            )}
            <LyraAvatar
              state="curious"
              phase={0}
              reduced={reduced}
              size={140}
              className="shadow-lg relative z-10 sm:w-[170px] sm:h-[170px]"
            />
          </motion.div>

          {/* Greeting + titolo */}
          <motion.div variants={itemVariants} className="space-y-1 sm:space-y-2">
            <p className="text-sm sm:text-base text-muted-foreground font-medium">{greeting}</p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-foreground leading-tight">
              Sono Lyra, la tua guida
            </h1>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-primary leading-tight">
              all’orientamento professionale.
            </p>
          </motion.div>

          {/* Sottotitolo */}
          <motion.p
            variants={itemVariants}
            className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed max-w-sm sm:max-w-md"
          >
            Rispondo a qualche domanda su di te — sul modo in cui lavori,
            pensi e vuoi crescere — e costruisco il tuo profilo professionale su misura.
          </motion.p>

          {/* Pillole info */}
          <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center gap-2">
            <div className="flex items-center gap-1.5 bg-muted/60 border border-border/50 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="text-sm">📝</span>
              {ALL_IDS.length} domande
            </div>
            <div className="flex items-center gap-1.5 bg-muted/60 border border-border/50 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              ~8 minuti
            </div>
            <div className="flex items-center gap-1.5 bg-muted/60 border border-border/50 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Layers className="w-3.5 h-3.5" />
              3 fasi
            </div>
          </motion.div>

          {/* CTA inline (visibile solo su sm+) */}
          <motion.div variants={itemVariants} className="hidden sm:flex flex-col items-center gap-3 pt-2 w-full">
            <Button
              ref={startBtnRef}
              size="lg"
              onClick={onStart}
              className="rounded-full px-8 h-14 text-base font-semibold w-full sm:w-auto gap-2"
            >
              Inizia il percorso
              <motion.span
                className="inline-flex"
                animate={reduced ? {} : { x: [0, 4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <ArrowRight className="w-5 h-5" />
              </motion.span>
            </Button>
            <p className="text-xs text-muted-foreground/50">Puoi interrompere e riprendere in qualsiasi momento</p>
          </motion.div>
        </motion.div>

        {/*
         * CTA sticky al fondo — visibile solo su mobile (sm:hidden)
         * backdrop-blur + border-top per separazione visiva
         */}
        <motion.div
          className="sm:hidden mt-6 w-full flex flex-col items-center gap-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { delay: 0.75, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Sfumatura di separazione */}
          <div className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none bg-gradient-to-t from-background to-transparent" />
          <div className="relative w-full flex flex-col items-center gap-2 pt-4 border-t border-border/30">
            <Button
              ref={startBtnRef}
              size="lg"
              onClick={onStart}
              className="rounded-full h-14 text-base font-semibold w-full gap-2"
            >
              Inizia il percorso
              <motion.span
                className="inline-flex"
                animate={reduced ? {} : { x: [0, 4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <ArrowRight className="w-5 h-5" />
              </motion.span>
            </Button>
            <p className="text-xs text-muted-foreground/50">Puoi interrompere e riprendere in qualsiasi momento</p>
          </div>
        </motion.div>

      </div>
    </div>
  );
}

// ── Componente principale ────────────────────────────────────────────────────
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
  const [activeDivider, setActiveDivider] = useState<"spirits" | "ctx" | null>(null);

  const hasDraft = !!draft && (draft.step > 0 || Object.keys(draft.answers).length > 0);
  const [showWelcome, setShowWelcome] = useState(!hasDraft);

  const [lyraHasEntered, setLyraHasEntered] = useState(false);
  const assignedSessionRef = useRef<number | null>(null);

  useEffect(() => {
    if (resumed || prefersReduced || currentStep !== 0) {
      setLyraHasEntered(true); return;
    }
    const id = setTimeout(() => setLyraHasEntered(true), 880);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const isComplete   = currentStep >= ALL_IDS.length;
  const isCtxQ       = currentStep >= SPIRITS_END;
  const isSpiritQ    = currentStep >= SPIRITS_START && currentStep < SPIRITS_END;
  const ctxOffset    = currentStep - SPIRITS_END + 1;
  const spiritOffset = currentStep - SPIRITS_START;
  const questionInGroup = (spiritOffset % 3) + 1;
  const currentId    = ALL_IDS[currentStep];
  const spiritInfo   = isSpiritQ ? SPIRIT_META[currentId] : null;
  const progress     = (currentStep / ALL_IDS.length) * 100;
  const currentPhase: 0 | 1 | 2 = isCtxQ ? 2 : isSpiritQ ? 1 : 0;
  const scenario     = SCENARIOS[currentId];
  const isIntroEntry = currentStep === 0 && !resumed && !prefersReduced;

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

  const handleAnswer = useCallback((value: number) => {
    if (justSelected !== null) return;
    const id = currentId;
    setDirection(1);
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setJustSelected(id);
    setTimeout(() => {
      setJustSelected(null);
      const next = currentStep + 1;
      if (next === SPIRITS_START) { setCurrentStep(next); setActiveDivider("spirits"); return; }
      if (next === SPIRITS_END)   { setCurrentStep(next); setActiveDivider("ctx");     return; }
      setCurrentStep((p) => p + 1);
    }, ADVANCE_DELAY_MS);
  }, [justSelected, currentId, currentStep]);

  const handleBack = useCallback(() => {
    if (justSelected !== null) return;
    setActiveDivider(null); setDirection(-1);
    if (currentStep > 0) setCurrentStep((p) => p - 1);
  }, [justSelected, currentStep]);

  useEffect(() => {
    if (isComplete || showWelcome) return;
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
  }, [isComplete, showWelcome, justSelected, currentId, answers, handleAnswer, handleBack]);

  const handleResume = () => {
    if (!draft) return;
    setCurrentStep(draft.step); setAnswers(draft.answers);
    setResumeBannerVisible(false); setResumed(true); setLyraHasEntered(true);
  };
  const handleDismissDraft = () => { clearDraft(); setResumeBannerVisible(false); };

  const handleSubmit = () => {
    submitTest.mutate({ data: { answers } }, {
      onSuccess: async (session) => {
        saveDraft({ step: currentStep, answers, savedAt: Date.now(), sessionId: session.id });
        if (user && assignedSessionRef.current !== session.id) {
          assignedSessionRef.current = session.id;
          await assignUserToSession(session.id, user.id);
        }
        clearDraft();
        setLocation(`/risultati/${session.id}`);
      },
    });
  };

  const questionVariants: Variants = prefersReduced
    ? { enter: { opacity: 0 }, center: { opacity: 1, transition: { duration: 0.15 } }, exit: { opacity: 0, transition: { duration: 0.1 } } }
    : {
        enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 48 : -48 }),
        center: { opacity: 1, x: 0, transition: { duration: 0.35, ease: easings.easeOut } },
        exit:  (dir: number) => ({ opacity: 0, x: dir > 0 ? -32 : 32, transition: { duration: 0.18, ease: easings.easeIn } }),
      };

  // ── Welcome screen ───────────────────────────────────────────────────────
  if (showWelcome) {
    return (
      <AnimatePresence mode="wait">
        <motion.div key="welcome"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -16, transition: { duration: 0.3, ease: easings.easeIn } }}
          transition={{ duration: 0.25 }}
        >
          <WelcomeScreen
            userName={user?.name ?? user?.email}
            reduced={prefersReduced}
            onStart={() => setShowWelcome(false)}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Completion screen ──────────────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-24 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <LyraAvatar state="celebrating" phase={2} size={140} className="mb-8 shadow-lg" />
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

  // ── Question screen ────────────────────────────────────────────────────────
  const showResumeBanner = !!draft && resumeBannerVisible && !resumed
    && currentStep === 0 && Object.keys(answers).length === 0;

  const DIVIDER_CONFIG = {
    spirits: { label: "Profilo Interiore", emoji: "🧠", description: "Le prossime domande esplorano le tue dimensioni personali" },
    ctx:     { label: "Obiettivi",          emoji: "🎯", description: "Ultime domande: allineiamo il percorso ai tuoi obiettivi" },
  } as const;

  return (
    <div className="container max-w-5xl mx-auto px-4 py-10 min-h-[80vh]">

      {/* Resume banner */}
      <AnimatePresence>
        {showResumeBanner && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}
            className="mb-6 flex items-center gap-3 bg-primary/10 border border-primary/25 rounded-2xl px-4 py-3"
          >
            <RotateCcw className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Hai un test in corso</p>
              <p className="text-xs text-muted-foreground">
                Avevi risposto a {draft?.step ?? 0} domande su {ALL_IDS.length}. Vuoi riprendere?
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="ghost" onClick={handleDismissDraft} className="rounded-full h-7 px-2"><X className="w-3.5 h-3.5" /></Button>
              <Button size="sm" onClick={handleResume} className="rounded-full h-7 px-3 text-xs">Riprendi</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase stepper */}
      <div className="flex items-center justify-center gap-1.5 mb-4">
        {PHASE_LABELS.map((label, i) => {
          const isActive = currentPhase === i;
          const isDone   = currentPhase > i;
          return (
            <React.Fragment key={i}>
              <motion.div layout
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
                  isActive ? "bg-primary text-primary-foreground shadow-sm" :
                  isDone   ? "bg-primary/15 text-primary" : "text-muted-foreground"
                )}
                animate={{ scale: isActive ? 1.05 : 1 }} transition={{ duration: 0.25 }}
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

      {/* Header back + counter */}
      <div className="flex items-center justify-between mb-3">
        <motion.button onClick={handleBack} disabled={currentStep === 0 || justSelected !== null}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          whileHover={prefersReduced ? {} : { x: -2 }} whileTap={prefersReduced ? {} : { scale: 0.97 }}
        >
          <ArrowLeft className="w-4 h-4" /> {t("test.back")}
        </motion.button>
        <span className="text-sm text-muted-foreground">{headerLabel}</span>
      </div>

      {/* Progress bar */}
      <motion.div initial={false} animate={{ scaleX: progress / 100 }}
        transition={prefersReduced ? { duration: 0 } : { duration: 0.4, ease: easings.easeOut }}
        style={{ transformOrigin: "left" }} className="h-1 bg-primary rounded-full mb-8"
      />

      {/* Section divider */}
      <AnimatePresence>
        {activeDivider && (
          <SectionDivider key={activeDivider}
            label={DIVIDER_CONFIG[activeDivider].label}
            emoji={DIVIDER_CONFIG[activeDivider].emoji}
            description={DIVIDER_CONFIG[activeDivider].description}
            reduced={prefersReduced} onDone={() => setActiveDivider(null)}
          />
        )}
      </AnimatePresence>

      {/* Layout due colonne */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">

        {/* Colonna sinistra: Avatar + bubble */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`avatar-col-${currentPhase}`}
            initial={
              prefersReduced ? { opacity: 0 } :
              isIntroEntry   ? { opacity: 0, x: -52, scale: 0.9, filter: "blur(8px)" } :
                               { opacity: 0, scale: 0.96 }
            }
            animate={
              prefersReduced ? { opacity: 1 } :
              isIntroEntry   ? { opacity: 1, x: 0, scale: 1, filter: "blur(0px)" } :
                               { opacity: 1, scale: 1 }
            }
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.25 } }}
            transition={
              isIntroEntry ? { duration: 0.72, ease: [0.16, 1, 0.3, 1] } : { duration: 0.35 }
            }
            className={cn(
              "relative flex flex-col items-center gap-4 rounded-3xl p-6 transition-colors duration-500",
              PHASE_BG[currentPhase]
            )}
          >
            {isIntroEntry && !prefersReduced && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: [0, 0.55, 0], scale: [0.6, 1.3, 1.6] }}
                transition={{ duration: 1.1, ease: "easeOut", delay: 0.15 }}
                className="absolute top-6 left-1/2 -translate-x-1/2 w-36 h-36 rounded-full pointer-events-none"
                style={{ background: "var(--primary)", filter: "blur(28px)" }}
              />
            )}
            <LyraAvatar
              state={scenario?.avatarState ?? "focused"}
              phase={currentPhase}
              reduced={prefersReduced}
              size={140}
              className="shadow-sm relative z-10"
            />
            <div className="text-center">
              <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground/60">Lyra</p>
              <p className="text-xs text-muted-foreground/50">Orientamento AI</p>
            </div>
            <AnimatePresence>
              {lyraHasEntered && scenario?.avatarIntro && (
                <motion.div
                  key={`bubble-${currentStep}`}
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.3, delay: isIntroEntry ? 0.12 : 0.08 }}
                  className="relative w-full bg-white/80 dark:bg-white/5 border border-border/60 rounded-2xl px-4 py-3 text-sm leading-relaxed"
                >
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-white/80 dark:bg-white/5 border-l border-t border-border/60" />
                  <span className="text-muted-foreground/60 italic mr-1">&ldquo;</span>
                  <TypewriterText text={scenario.avatarIntro} reduced={prefersReduced} className="italic text-foreground/80" />
                  <span className="text-muted-foreground/60 italic ml-0.5">&rdquo;</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>

        {/* Colonna destra: scenario + domanda + opzioni */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div key={currentStep} custom={direction} variants={questionVariants} initial="enter" animate="center" exit="exit">

            {spiritInfo && (() => {
              const display = SPIRIT_DISPLAY[spiritInfo.transKey];
              return (
                <div className="flex items-center gap-3 mb-4">
                  <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-full px-4 py-1.5">
                    <span>{display.emoji}</span>
                    <span className="text-sm font-medium text-primary">
                      {display.name} · <span className="font-normal text-muted-foreground text-xs">{display.desc}</span>
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

            {isCtxQ && (
              <div className="flex items-center gap-3 mb-4">
                <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-full px-4 py-1.5">
                  <span>🎯</span>
                  <span className="text-sm font-medium text-primary">
                    {t("test.ctxBadge", { current: ctxOffset, total: ALL_CTX_IDS.length })}
                  </span>
                </div>
              </div>
            )}

            {scenario?.scenario && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
                className="mb-5 px-4 py-3 rounded-xl bg-muted/50 border border-border/50 text-sm text-muted-foreground italic leading-relaxed"
              >
                📍 {scenario.scenario}
              </motion.div>
            )}

            <h2 className="text-xl sm:text-2xl md:text-[1.6rem] font-serif font-semibold text-foreground mb-7 leading-snug">
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
                    transition={prefersReduced ? { duration: 0 } : { delay: optIdx * 0.04, duration: 0.28, ease: easings.easeOut }}
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
                        isJustSelected
                          ? <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.18 }}>
                              <Check className="w-3 h-3 text-primary-foreground" />
                            </motion.div>
                          : <div className="w-2.5 h-2.5 rounded-full bg-primary-foreground" />
                      )}
                    </motion.div>
                  </motion.button>
                );
              })}
            </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.4 }}
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
    </div>
  );
}
