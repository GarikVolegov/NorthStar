import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
import { useSubmitTest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ArrowRight, Check, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useReducedMotion, easings } from "@/lib/motion";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL || "/";

const RIASEC_QUESTION_IDS = ["q1","q2","q3","q4","q5","q6","q7","q8","q9","q10","q11","q12"] as const;
const SPIRIT_QUESTION_IDS = [
  "shen_1","shen_2","shen_3",
  "hun_1","hun_2","hun_3",
  "po_1","po_2","po_3",
  "yi_1","yi_2","yi_3",
  "zhi_1","zhi_2","zhi_3",
] as const;
const CTX_QUESTION_IDS = ["ctx_1","ctx_2"] as const;

const RIASEC_TYPES: Record<string, string> = {
  q1:"R",q2:"I",q3:"A",q4:"S",q5:"E",q6:"C",
  q7:"R",q8:"I",q9:"A",q10:"S",q11:"E",q12:"C",
};

type SpiritKey = "shen"|"hun"|"po"|"yi"|"zhi";
const SPIRIT_META: Record<string, { key: SpiritKey; emoji: string; transKey: string }> = {
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

async function assignUserToSession(sessionId: number, userId: number): Promise<void> {
  try {
    await fetch(`${BASE}api/test-sessions/${sessionId}/assign-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
  } catch { /* non-critical */ }
}

export default function Test() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const submitTest = useSubmitTest();
  const { user } = useAuth();
  const prefersReduced = useReducedMotion();

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [direction, setDirection] = useState<1 | -1>(1);
  const [transition1Passed, setTransition1Passed] = useState(false);
  const [transition2Passed, setTransition2Passed] = useState(false);

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

  const OPTIONS = [
    { value: 1, label: t("test.options.1") },
    { value: 2, label: t("test.options.2") },
    { value: 3, label: t("test.options.3") },
    { value: 4, label: t("test.options.4") },
    { value: 5, label: t("test.options.5") },
  ];

  const handleAnswer = (value: number) => {
    setDirection(1);
    setAnswers((prev) => ({ ...prev, [currentId]: value }));
    setTimeout(() => setCurrentStep((prev) => prev + 1), 250);
  };

  const handleBack = () => {
    setDirection(-1);
    if (showTransition1) {
      setCurrentStep(ALL_RIASEC_IDS.length - 1);
      return;
    }
    if (showTransition2) {
      setCurrentStep(SPIRITS_END - 1);
      return;
    }
    if (currentStep === ALL_RIASEC_IDS.length && transition1Passed) {
      setTransition1Passed(false);
      return;
    }
    if (currentStep === SPIRITS_END && transition2Passed) {
      setTransition2Passed(false);
      return;
    }
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = () => {
    submitTest.mutate(
      { data: { answers } },
      {
        onSuccess: async (session) => {
          if (user) await assignUserToSession(session.id, user.id);
          setLocation(`/risultati/${session.id}`);
        },
      }
    );
  };

  // ── Transition 1: RIASEC → Spirits ────────────────────────────────────────
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
        <p
          className="text-base text-muted-foreground mb-10 leading-relaxed max-w-xl"
          dangerouslySetInnerHTML={{ __html: t("test.transition.details") }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 w-full mb-10">
          {spiritsTransition.map((s) => (
            <div key={s.transKey} className="flex flex-col items-center gap-1.5 bg-card border rounded-2xl px-3 py-4 text-center">
              <span className="text-2xl">{s.emoji}</span>
              <div className="font-semibold text-sm text-foreground">{t(`test.transition.spirits.${s.transKey}.name`)}</div>
              <div className="text-xs text-muted-foreground">{t(`test.transition.spirits.${s.transKey}.desc`)}</div>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/30" />)}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button variant="ghost" onClick={handleBack} className="rounded-full px-6">
            <ArrowLeft className="mr-2 w-4 h-4" /> {t("test.back")}
          </Button>
          <Button size="lg" onClick={() => setTransition1Passed(true)} className="rounded-full px-10 h-13">
            {t("test.transition.startCompass")} <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Transition 2: Spirits → Context calibration ────────────────────────────
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
        <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-xl">
          {t("test.transition2.subtitle")}
        </p>

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

        <div className="flex gap-3">
          <Button variant="ghost" onClick={handleBack} className="rounded-full px-6">
            <ArrowLeft className="mr-2 w-4 h-4" /> {t("test.back")}
          </Button>
          <Button size="lg" onClick={() => setTransition2Passed(true)} className="rounded-full px-10 h-13">
            {t("test.transition2.start")} <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Completion screen ──────────────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-24 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="w-24 h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-8 animate-in zoom-in duration-500">
          <Check className="w-12 h-12" />
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">{t("test.complete.title")}</h1>
        <p className="text-lg text-muted-foreground mb-2 leading-relaxed">{t("test.complete.subtitle")}</p>
        {user && (
          <p className="text-sm text-primary font-medium mb-6">{t("test.complete.savedAccount")}</p>
        )}
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={submitTest.isPending}
          className="rounded-full px-8 h-14 text-lg w-full sm:w-auto"
        >
          {submitTest.isPending ? (
            <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> {t("test.complete.processing")}</>
          ) : (
            <><Sparkles className="mr-2 w-5 h-5" /> {t("test.complete.discoverResults")}</>
          )}
        </Button>
        {submitTest.isError && (
          <p className="mt-4 text-sm text-destructive">{t("test.complete.submitError")}</p>
        )}
      </div>
    );
  }

  // ── Question screen ────────────────────────────────────────────────────────
  const headerLabel = isCtxQ
    ? t("test.ctxCount", { current: ctxOffset, total: ALL_CTX_IDS.length })
    : isSpiritQ
    ? t("test.innerCompassCount", { current: spiritOffset + 1, total: ALL_SPIRIT_IDS.length })
    : t("test.questionOf", { current: currentStep + 1, total: ALL_IDS.length });

  return (
    <div className="container max-w-2xl mx-auto px-4 py-12 min-h-[70vh]">
      <div className="flex items-center justify-between mb-4">
        <motion.button
          onClick={handleBack}
          disabled={currentStep === 0}
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
              <div className="flex gap-1.5 ml-auto">
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={cn("w-2 h-2 rounded-full", n <= questionInGroup ? "bg-primary" : "bg-muted")}
                  />
                ))}
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

          <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground mb-10 leading-snug">
            {questionText}
          </h2>

          <div className="space-y-3">
            {OPTIONS.map((opt, optIdx) => {
              const selected = answers[currentId] === opt.value;
              return (
                <motion.button
                  key={opt.value}
                  onClick={() => handleAnswer(opt.value)}
                  initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={prefersReduced ? { duration: 0 } : { delay: optIdx * 0.04, duration: 0.3, ease: easings.easeOut }}
                  whileHover={prefersReduced ? undefined : { scale: 1.01 }}
                  whileTap={prefersReduced ? undefined : { scale: 0.98 }}
                  className={cn(
                    "w-full flex items-center justify-between px-5 py-4 rounded-xl border text-left text-base font-medium transition-colors duration-150",
                    selected
                      ? "bg-primary text-primary-foreground border-primary shadow-md"
                      : "bg-card border-border hover:border-primary/40 hover:bg-primary/5 text-foreground"
                  )}
                >
                  {opt.label}
                  <motion.div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                      selected ? "border-primary-foreground bg-primary-foreground/20" : "border-muted-foreground"
                    )}
                    animate={prefersReduced ? {} : { scale: selected ? [1, 1.2, 1] : 1 }}
                    transition={{ duration: 0.25 }}
                  >
                    {selected && <div className="w-2.5 h-2.5 rounded-full bg-primary-foreground" />}
                  </motion.div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
