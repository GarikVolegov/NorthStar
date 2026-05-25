import { useAuth } from "@/contexts/AuthContext";
import { easings, useReducedMotion } from "@/lib/motion";
import { SCENARIOS } from "@/lib/test-scenarios";
import { cn } from "@/lib/utils";
import { isMuted, setMuted, speak, startAmbientPad, stopAmbientPad, stopSpeech } from "@/lib/wendy-voice";
import {
  CompletionScreen,
  DesktopWendyPanel,
  DraftResumeBanner,
  KeyboardHints,
  PhaseStepper,
  ProgressBar,
} from "@/features/test/TestFlowChrome";
import {
  ADVANCE_DELAY_MS,
  ALL_CTX_IDS,
  ALL_IDS,
  ALL_RIASEC_IDS,
  ALL_SPIRIT_IDS,
  getCtxIds,
  getRiasecIds,
  JOURNEY_CTX1_DEFAULTS,
  MUTE_STORAGE_KEY,
  SLIDE_EASE_IN,
  SLIDE_EASE_OUT,
  SPIRIT_DISPLAY,
  SPIRIT_META,
  SPIRITS_END,
  SPIRITS_START,
  TEST_ENTER_DURATION,
  WELCOME_EXIT_DURATION,
  assignUserToSession,
  clearDraft,
  loadDraft,
  saveDraft,
} from "@/features/test/testConfig";
import {
  MuteButton,
  PhaseOverlay,
  SectionDivider,
  SpiritBreath,
  WelcomeScreen,
  WendyMobileStrip,
} from "@/features/test/testPresentation";
import { useSubmitTest } from "@workspace/api-client-react";
import type { Variants } from "framer-motion";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import type { TestDraft } from "./test-draft";
export default function Test() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const submitTest = useSubmitTest();
  const { user } = useAuth();
  const prefersReduced = useReducedMotion();
  // ID domande dinamici in base al percorso dell'utente
  const activeRiasecIds = useMemo(() => getRiasecIds(user?.journeyType), [user?.journeyType]);
  const activeCtxIds    = useMemo(() => getCtxIds(user?.journeyType),    [user?.journeyType]);
  const activeAllIds    = useMemo(
    () => [...activeRiasecIds, ...ALL_SPIRIT_IDS, ...activeCtxIds],
    [activeRiasecIds, activeCtxIds]
  );
  const [audioMuted, setAudioMuted] = useState<boolean>(() => {
    try { return localStorage.getItem(MUTE_STORAGE_KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    setMuted(audioMuted);
    try { localStorage.setItem(MUTE_STORAGE_KEY, audioMuted ? "1" : "0"); } catch { /* ignore storage write failures */ }
  }, [audioMuted]);
  useEffect(() => { if (isMuted() !== audioMuted) setMuted(audioMuted); }, []);
  const handleToggleMute = useCallback(() => setAudioMuted((p) => !p), []);
  const [speechText, setSpeechText]           = useState("");
  const [speechCharIndex, setSpeechCharIndex] = useState(-1);
  const speakWithCaption = useCallback((text: string, opts: { interrupt?: boolean } = {}) => {
    setSpeechText(text);
    setSpeechCharIndex(-1);
    speak(text, {
      ...opts,
      onBoundary: (ci) => setSpeechCharIndex(ci),
      onEnd: () => setSpeechCharIndex(-2),
    });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "m" || e.key === "M") handleToggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleToggleMute]);
  const [draft] = useState<TestDraft | null>(() => loadDraft());
  const [resumeBannerVisible, setResumeBannerVisible] = useState(true);
  const [resumed, setResumed] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>(() => {
    const jt = user?.journeyType;
    if (!jt) return {} as Record<string, number>;
    const val = JOURNEY_CTX1_DEFAULTS[jt];
    if (val === undefined) return {} as Record<string, number>;
    return { ctx_1: val } as Record<string, number>;
  });
  const [direction, setDirection] = useState<1 | -1>(1);
  const [justSelected, setJustSelected] = useState<string | null>(null);
  const [tapFlash, setTapFlash] = useState<string | null>(null);
  const [activeDivider, setActiveDivider] = useState<"spirits" | "ctx" | null>(null);
  const [activeOverlay, setActiveOverlay] = useState<"spirits" | "ctx" | null>(null);
  const hasDraft = !!draft && (draft.step > 0 || Object.keys(draft.answers).length > 0);
  const [showWelcome, setShowWelcome] = useState(!hasDraft);
  const [lyraHasEntered, setLyraHasEntered] = useState(false);
  const assignedSessionRef = useRef<number | null>(null);
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      stopSpeech();
      stopAmbientPad(0.5);
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
    };
  }, []);
  useEffect(() => {
    if (showWelcome || prefersReduced) return;
    startAmbientPad();
    return () => stopAmbientPad();
  }, [showWelcome, prefersReduced]);
  useEffect(() => {
    if (showWelcome || prefersReduced || audioMuted) return;
    const id = activeAllIds[currentStep];
    if (!id) return;
    const text = currentStep < SPIRITS_START
      ? t(`test.questions.riasec.${id}`)
      : currentStep < SPIRITS_END
      ? t(`test.questions.spirits.${id}`)
      : t(`test.questions.ctx.${id}`);
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
    speakTimerRef.current = setTimeout(() => speakWithCaption(text, { interrupt: true }), 350);
    return () => { if (speakTimerRef.current) clearTimeout(speakTimerRef.current); };
  }, [currentStep, showWelcome, prefersReduced, audioMuted]);
  useEffect(() => {
    if (resumed || prefersReduced || currentStep !== 0) { setLyraHasEntered(true); return; }
    const id = setTimeout(() => setLyraHasEntered(true), 880);
    return () => clearTimeout(id);
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
  const isComplete   = currentStep >= activeAllIds.length;
  const isCtxQ       = currentStep >= SPIRITS_END;
  const isSpiritQ    = currentStep >= SPIRITS_START && currentStep < SPIRITS_END;
  const ctxOffset    = currentStep - SPIRITS_END + 1;
  const spiritOffset = currentStep - SPIRITS_START;
  const questionInGroup = (spiritOffset % 3) + 1;
  const currentId    = activeAllIds[currentStep] ?? activeAllIds[activeAllIds.length - 1]!;
  const spiritInfo   = isSpiritQ ? SPIRIT_META[currentId] : null;
  const progress     = (currentStep / activeAllIds.length) * 100;
  const currentPhase: 0 | 1 | 2 = isCtxQ ? 2 : isSpiritQ ? 1 : 0;
  const scenario     = SCENARIOS[currentId];
  const isIntroEntry = currentStep === 0 && !resumed && !prefersReduced;
  const stepCounterLabel = isCtxQ
    ? `${ctxOffset} / ${ALL_CTX_IDS.length}`
    : isSpiritQ
    ? `${spiritOffset + 1} / ${ALL_SPIRIT_IDS.length}`
    : `${currentStep + 1} / ${ALL_RIASEC_IDS.length}`;
  const questionText = isCtxQ
    ? t(`test.questions.ctx.${currentId}`, { defaultValue: t(`test.questions.ctx.ctx_1`) })
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
    setTapFlash(id);
    if ("vibrate" in navigator) navigator.vibrate(12);
    setTimeout(() => setTapFlash(null), 300);
    setTimeout(() => {
      setJustSelected(null);
      const next = currentStep + 1;
      if (next === SPIRITS_START) {
        setCurrentStep(next);
        if (!prefersReduced) { setActiveOverlay("spirits"); } else { setActiveDivider("spirits"); }
        return;
      }
      if (next === SPIRITS_END) {
        setCurrentStep(next);
        if (!prefersReduced) { setActiveOverlay("ctx"); } else { setActiveDivider("ctx"); }
        return;
      }
      setCurrentStep((p) => p + 1);
    }, ADVANCE_DELAY_MS);
  }, [justSelected, currentId, currentStep, prefersReduced]);
  const handleBack = useCallback(() => {
    if (justSelected !== null) return;
    setActiveDivider(null); setActiveOverlay(null); setDirection(-1);
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
    stopSpeech();
    stopAmbientPad();
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
  const DIVIDER_CONFIG = {
    spirits: { label: "Dimensioni Motivazionali", emoji: "chart", description: "Analisi psicologica del tuo profilo motivazionale" },
    ctx:     { label: "Contesto e Obiettivi",     emoji: "target", description: "Ultime domande per personalizzare i tuoi risultati" },
  } as const;
  const captionActive = !audioMuted && !prefersReduced && !!speechText && speechCharIndex !== -2;
  // Fix #8: estratto da IIFE inline a variabile leggibile
  const showResumeBanner =
    !!draft &&
    resumeBannerVisible &&
    !resumed &&
    currentStep === 0 &&
    Object.keys(answers).length === 0;
  // Fix #8: badge spirit estratto da IIFE inline
  const spiritBadge = spiritInfo ? (() => {
    const display = SPIRIT_DISPLAY[spiritInfo.transKey] ?? SPIRIT_DISPLAY.shen!;
    return (
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-full px-4 py-1.5">
          <span>{display.emoji}</span>
          <span className="text-sm font-medium text-primary">
            {display.name} - <span className="font-normal text-muted-foreground text-xs">{display.desc}</span>
          </span>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3].map((n) => (
            <span key={n} className={cn("w-2 h-2 rounded-full", n <= questionInGroup ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
        <div className="ml-auto">
          <SpiritBreath reduced={prefersReduced} />
        </div>
      </div>
    );
  })() : null;
  const overlayPhase: 0 | 1 | 2 = activeOverlay === "ctx" ? 2 : 1;
  return (
    <>
      {!prefersReduced && (
        <MuteButton muted={audioMuted} onToggle={handleToggleMute} reduced={prefersReduced} />
      )}
      <AnimatePresence>
        {activeOverlay && !prefersReduced && (
          <PhaseOverlay
            key={activeOverlay}
            phase={overlayPhase}
            label={DIVIDER_CONFIG[activeOverlay].label}
            emoji={DIVIDER_CONFIG[activeOverlay].emoji}
            description={DIVIDER_CONFIG[activeOverlay].description}
            onDone={() => setActiveOverlay(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {showWelcome ? (
          <motion.div key="welcome"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={
              prefersReduced
                ? { opacity: 0, transition: { duration: 0.15 } }
                : { opacity: 0, y: -60, scale: 0.97, transition: { duration: WELCOME_EXIT_DURATION, ease: SLIDE_EASE_IN } }
            }
            transition={{ duration: 0.25 }}
            style={{ willChange: "transform, opacity" }}
          >
            <WelcomeScreen
              {...(user?.name ?? user?.email ? { userName: user?.name ?? user?.email } : {})}
              reduced={prefersReduced}
              muted={audioMuted}
              speechText={speechText}
              speechCharIndex={speechCharIndex}
              onStart={() => { stopSpeech(); setSpeechText(""); setSpeechCharIndex(-1); setShowWelcome(false); }}
            />
          </motion.div>
        ) : (
          <motion.div key="test"
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={prefersReduced ? { duration: 0.15 } : { duration: TEST_ENTER_DURATION, ease: SLIDE_EASE_OUT }}
            style={{ willChange: "transform, opacity" }}
          >
            {isComplete ? (
              <CompletionScreen
                isPending={submitTest.isPending}
                isError={submitTest.isError}
                isSavedToAccount={!!user}
                labels={{
                  title: t("test.complete.title"),
                  subtitle: t("test.complete.subtitle"),
                  savedAccount: t("test.complete.savedAccount"),
                  processing: t("test.complete.processing"),
                  discoverResults: t("test.complete.discoverResults"),
                  submitError: t("test.complete.submitError"),
                }}
                onSubmit={handleSubmit}
              />
            ) : (
              <div className="container max-w-5xl mx-auto px-4 py-10 min-h-[80vh]">
                <AnimatePresence>
                  {showResumeBanner && (
                    <DraftResumeBanner
                      answeredCount={draft?.step ?? 0}
                      totalQuestions={ALL_IDS.length}
                      onDismiss={handleDismissDraft}
                      onResume={handleResume}
                    />
                  )}
                </AnimatePresence>
                <PhaseStepper currentPhase={currentPhase} />
                {/* Fix #7: back button min 44x44px touch area (WCAG 2.5.5) */}
                <div className="flex items-center justify-between mb-2">
                  <motion.button
                    onClick={handleBack}
                    disabled={currentStep === 0 || justSelected !== null}
                    className={cn(
                      "flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground",
                      "disabled:opacity-30 transition-colors",
                      "min-w-[44px] min-h-[44px] px-2 -ml-2",   // area touch garantita
                    )}
                    whileHover={prefersReduced ? {} : { x: -2 }}
                    whileTap={prefersReduced ? {} : { scale: 0.97 }}
                  >
                    <ArrowLeft className="w-4 h-4 shrink-0" />
                    <span>{t("test.back")}</span>
                  </motion.button>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="hidden sm:inline">{headerLabel}</span>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={stepCounterLabel}
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.2 }}
                        className="font-mono tabular-nums font-semibold text-foreground/70 bg-muted/60 rounded-md px-2 py-0.5"
                      >
                        {stepCounterLabel}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
                <ProgressBar
                  currentPhase={currentPhase}
                  currentStep={currentStep}
                  progress={progress}
                  reduced={prefersReduced}
                  transition={{ duration: 0.45, ease: easings.easeOut }}
                />
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
                <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
                  <DesktopWendyPanel
                    avatarState={scenario?.avatarState ?? "focused"}
                    captionActive={captionActive}
                    currentPhase={currentPhase}
                    isIntroEntry={isIntroEntry}
                    lyraHasEntered={lyraHasEntered}
                    prefersReduced={prefersReduced}
                    {...(scenario?.avatarIntro ? { scenarioIntro: scenario.avatarIntro } : {})}
                    speechCharIndex={speechCharIndex}
                    speechText={speechText}
                  />
                  {/* Colonna domande */}
                  <div>
                    <div className="lg:hidden">
                      <WendyMobileStrip
                        phase={currentPhase}
                        avatarState={scenario?.avatarState ?? "focused"}
                        reduced={prefersReduced}
                        avatarIntro={scenario?.avatarIntro}
                        captionActive={captionActive}
                        speechText={speechText}
                        speechCharIndex={speechCharIndex}
                        lyraHasEntered={lyraHasEntered}
                      />
                    </div>
                    <AnimatePresence mode="wait" custom={direction}>
                      <motion.div key={currentStep} custom={direction} variants={questionVariants} initial="enter" animate="center" exit="exit">
                        {/* Fix #8: spiritBadge come variabile, non IIFE inline */}
                        {spiritBadge}
                        {isCtxQ && (
                          <div className="flex items-center gap-3 mb-4">
                            <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-full px-4 py-1.5">
                              <span>ðŸŽ¯</span>
                              <span className="text-sm font-medium text-primary">
                                {t("test.ctxBadge", { current: ctxOffset, total: ALL_CTX_IDS.length })}
                              </span>
                            </div>
                          </div>
                        )}
                        {scenario?.scenario && (
                          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
                            className="mb-5 px-4 py-3 rounded-xl bg-muted/50 border border-border/50 text-sm text-muted-foreground italic leading-relaxed">
                            ðŸ“ {scenario.scenario}
                          </motion.div>
                        )}
                        <h2 className="text-xl sm:text-2xl md:text-[1.6rem] font-serif font-semibold text-foreground mb-7 leading-snug">
                          {questionText}
                        </h2>
                        <div className="space-y-3">
                          {OPTIONS.map((opt, optIdx) => {
                            const selected = answers[currentId] === opt.value;
                            const isJustSelected = justSelected === currentId && selected;
                            const isFlashing = tapFlash === currentId && selected;
                            return (
                              <motion.button
                                key={opt.value}
                                onClick={() => handleAnswer(opt.value)}
                                disabled={justSelected !== null}
                                initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                                animate={{
                                  opacity: 1,
                                  y: 0,
                                  ...(isFlashing && !prefersReduced
                                    ? { backgroundColor: ["var(--primary)", "color-mix(in srgb, var(--primary) 80%, white 20%)", "var(--primary)"] }
                                    : {}),
                                }}
                                transition={prefersReduced ? { duration: 0 } : {
                                  opacity: { delay: optIdx * 0.04, duration: 0.28, ease: easings.easeOut },
                                  backgroundColor: isFlashing ? { duration: 0.28, times: [0, 0.5, 1] } : {},
                                }}
                                {...(prefersReduced || justSelected !== null ? {} : {
                                  whileHover: { scale: 1.01 },
                                  whileTap: { scale: 0.97, transition: { duration: 0.08 } },
                                })}
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
                        <KeyboardHints
                          audioMuted={audioMuted}
                          currentStep={currentStep}
                          hasCurrentAnswer={answers[currentId] !== undefined}
                        />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
