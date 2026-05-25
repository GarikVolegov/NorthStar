import { Button } from "@/components/ui/button";
import { WendyAvatar, type AvatarState } from "@/components/wendy-avatar";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import { Check, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import React from "react";
import {
  PHASE_BG,
  PHASE_LABELS,
  PHASE_PROGRESS_COLOR,
} from "./testConfig";
import { TypewriterText, WendySpeechCaption } from "./testPresentation";

interface CompletionScreenProps {
  isPending: boolean;
  isError: boolean;
  isSavedToAccount: boolean;
  labels: {
    title: string;
    subtitle: string;
    savedAccount: string;
    processing: string;
    discoverResults: string;
    submitError: string;
  };
  onSubmit: () => void;
}

export function CompletionScreen({
  isPending,
  isError,
  isSavedToAccount,
  labels,
  onSubmit,
}: CompletionScreenProps) {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-24 flex flex-col items-center justify-center min-h-[70vh] text-center">
      <WendyAvatar state="celebrating" phase={2} size={140} className="mb-8 shadow-lg" />
      <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">{labels.title}</h1>
      <p className="text-lg text-muted-foreground mb-2 leading-relaxed">{labels.subtitle}</p>
      {isSavedToAccount && <p className="text-sm text-primary font-medium mb-6">{labels.savedAccount}</p>}
      <Button size="lg" onClick={onSubmit} disabled={isPending} className="rounded-full px-8 h-14 text-lg w-full sm:w-auto">
        {isPending
          ? <><Loader2 className="mr-2 w-5 h-5 animate-spin" />{labels.processing}</>
          : <><Sparkles className="mr-2 w-5 h-5" />{labels.discoverResults}</>}
      </Button>
      {isError && <p className="mt-4 text-sm text-destructive">{labels.submitError}</p>}
    </div>
  );
}

interface DraftResumeBannerProps {
  answeredCount: number;
  totalQuestions: number;
  onDismiss: () => void;
  onResume: () => void;
}

export function DraftResumeBanner({
  answeredCount,
  totalQuestions,
  onDismiss,
  onResume,
}: DraftResumeBannerProps) {
  return (
    <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}
      className="mb-6 flex items-center gap-3 bg-primary/10 border border-primary/25 rounded-2xl px-4 py-3"
    >
      <RotateCcw className="w-4 h-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Hai un test in corso</p>
        <p className="text-xs text-muted-foreground">
          Avevi risposto a {answeredCount} domande su {totalQuestions}. Vuoi riprendere?
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="ghost" onClick={onDismiss} className="rounded-full h-7 px-2">
          <X className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" onClick={onResume} className="rounded-full h-7 px-3 text-xs">Riprendi</Button>
      </div>
    </motion.div>
  );
}

export function PhaseStepper({ currentPhase }: { currentPhase: 0 | 1 | 2 }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-4">
      {PHASE_LABELS.map((label, i) => {
        const isActive = currentPhase === i;
        const isDone = currentPhase > i;
        return (
          <React.Fragment key={i}>
            <motion.div layout
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
                isActive ? "bg-primary text-primary-foreground shadow-sm" :
                isDone ? "bg-primary/15 text-primary" : "text-muted-foreground"
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
  );
}

interface ProgressBarProps {
  currentPhase: 0 | 1 | 2;
  currentStep: number;
  progress: number;
  reduced: boolean;
  transition: Transition;
}

export function ProgressBar({
  currentPhase,
  currentStep,
  progress,
  reduced,
  transition,
}: ProgressBarProps) {
  return (
    <div className="relative h-1.5 bg-muted rounded-full mb-8 overflow-hidden">
      <motion.div
        className={cn("absolute inset-y-0 left-0 rounded-full", PHASE_PROGRESS_COLOR[currentPhase])}
        initial={false}
        animate={{ width: `${progress}%` }}
        transition={reduced ? { duration: 0 } : transition}
      />
      {!reduced && (
        <motion.div
          className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          animate={{ x: ["-4rem", `${progress + 4}%`] }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          key={currentStep}
        />
      )}
    </div>
  );
}

interface DesktopWendyPanelProps {
  avatarState: AvatarState;
  captionActive: boolean;
  currentPhase: 0 | 1 | 2;
  isIntroEntry: boolean;
  lyraHasEntered: boolean;
  prefersReduced: boolean;
  scenarioIntro?: string;
  speechCharIndex: number;
  speechText: string;
}

export function DesktopWendyPanel({
  avatarState,
  captionActive,
  currentPhase,
  isIntroEntry,
  lyraHasEntered,
  prefersReduced,
  scenarioIntro,
  speechCharIndex,
  speechText,
}: DesktopWendyPanelProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`avatar-col-${currentPhase}`}
        initial={
          prefersReduced ? { opacity: 0 } :
          isIntroEntry ? { opacity: 0, x: -52, scale: 0.9, filter: "blur(8px)" } :
          { opacity: 0, scale: 0.96 }
        }
        animate={
          prefersReduced ? { opacity: 1 } :
          isIntroEntry ? { opacity: 1, x: 0, scale: 1, filter: "blur(0px)" } :
          { opacity: 1, scale: 1 }
        }
        exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.25 } }}
        transition={isIntroEntry ? { duration: 0.72, ease: [0.16, 1, 0.3, 1] } : { duration: 0.35 }}
        className={cn(
          "relative hidden lg:flex flex-col items-center gap-4 rounded-3xl p-6 transition-colors duration-500",
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

        <WendyAvatar state={avatarState} phase={currentPhase}
          reduced={prefersReduced} size={140} className="shadow-sm relative z-10" />

        <div className="text-center">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground/60">Wendy</p>
          <p className="text-xs text-muted-foreground/50">Orientamento AI</p>
        </div>

        <AnimatePresence mode="wait">
          {captionActive && speechText ? (
            <motion.div
              key="caption-zone"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}
              className="w-full"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-px bg-border/40" />
                <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-medium">in ascolto</span>
                <div className="flex-1 h-px bg-border/40" />
              </div>
              <WendySpeechCaption text={speechText} charIndex={speechCharIndex} />
            </motion.div>
          ) : lyraHasEntered && scenarioIntro ? (
            <motion.div
              key="bubble"
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.15 } }}
              transition={{ duration: 0.3, delay: isIntroEntry ? 0.12 : 0.08 }}
              className="relative w-full bg-white/80 dark:bg-white/5 border border-border/60 rounded-2xl px-4 py-3 text-sm leading-relaxed"
            >
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-white/80 dark:bg-white/5 border-l border-t border-border/60" />
              <span className="text-muted-foreground/60 italic mr-1">&ldquo;</span>
              <TypewriterText text={scenarioIntro} reduced={prefersReduced} className="italic text-foreground/80" />
              <span className="text-muted-foreground/60 italic ml-0.5">&rdquo;</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

interface KeyboardHintsProps {
  audioMuted: boolean;
  currentStep: number;
  hasCurrentAnswer: boolean;
}

export function KeyboardHints({
  audioMuted,
  currentStep,
  hasCurrentAnswer,
}: KeyboardHintsProps) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.4 }}
      className="hidden pointer-fine:flex items-center gap-3 mt-8 text-xs text-muted-foreground/50 justify-center flex-wrap"
    >
      <span className="flex items-center gap-1">
        <kbd className="px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/40 font-mono text-[10px]">1</kbd>
        <span>-</span>
        <kbd className="px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/40 font-mono text-[10px]">5</kbd>
        <span className="ml-1">seleziona</span>
      </span>
      {hasCurrentAnswer && (
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/40 font-mono text-[10px]">Enter</kbd>
          <span className="ml-1">conferma</span>
        </span>
      )}
      {currentStep > 0 && (
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/40 font-mono text-[10px]">&lt;-</kbd>
          <span className="ml-1">indietro</span>
        </span>
      )}
      <span className="flex items-center gap-1">
        <kbd className="px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/40 font-mono text-[10px]">M</kbd>
        <span className="ml-1">{audioMuted ? "riattiva audio" : "silenzia"}</span>
      </span>
    </motion.div>
  );
}

export { AnimatePresence };
