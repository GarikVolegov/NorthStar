import { Button } from "@/components/ui/button";
import { WendyAvatar, type AvatarState } from "@/components/wendy-avatar";
import { cn } from "@/lib/utils";
import { speak, stopSpeech } from "@/lib/wendy-voice";
import type { Variants } from "framer-motion";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Clock, Layers, Volume2, VolumeX } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import {
  ALL_IDS,
  PHASE_BG,
  PHASE_OVERLAY_ACCENT,
  PHASE_OVERLAY_BG,
  PHASE_OVERLAY_MS,
  SLIDE_EASE_OUT,
} from "./testConfig";

interface CaptionToken { word: string; punct: string; start: number; }
function tokenizeCaption(text: string): CaptionToken[] {
  const tokens: CaptionToken[] = [];
  // Cattura: sequenza non-whitespace, poi eventuale punteggiatura terminale
  const regex = /(\S+?)([.,!?;:]*)(?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m[0] && m[1]) tokens.push({ word: m[1], punct: m[2] ?? "", start: m.index });
  }
  return tokens;
}

interface WendySpeechCaptionProps { text: string; charIndex: number; }
export function WendySpeechCaption({ text, charIndex }: WendySpeechCaptionProps) {
  if (!text) return null;
  const tokens = tokenizeCaption(text);
  return (
    <div
      className="w-full px-3 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-[11px] leading-relaxed text-center select-none"
      aria-live="polite"
      aria-label="Wendy sta dicendo"
    >
      {tokens.map((tok, i) => {
        const isPast    = charIndex >= 0 && tok.start < charIndex;
        const isCurrent = charIndex >= 0 && charIndex >= tok.start && charIndex < tok.start + tok.word.length;
        const isDone    = charIndex === -2;
        return (
          <React.Fragment key={i}>
            {/* Animated word coloring */}
            <motion.span
              animate={{
                color: (isPast || isDone || isCurrent) ? "var(--primary)" : "var(--muted-foreground)",
                opacity: (isPast || isDone) ? 0.7 : isCurrent ? 1 : 0.45,
                fontWeight: isCurrent ? 600 : 400,
              }}
              transition={{ duration: 0.15 }}
              style={{ display: "inline" }}
            >
              {tok.word}
            </motion.span>
            {/* Punctuation keeps muted styling. */}
            {tok.punct && (
              <span className="text-muted-foreground/50" style={{ display: "inline" }}>
                {tok.punct}
              </span>
            )}
            {i < tokens.length - 1 && " "}
          </React.Fragment>
        );
      })}
    </div>
  );
}


interface MuteButtonProps { muted: boolean; onToggle: () => void; reduced: boolean; }
export function MuteButton({ muted, onToggle, reduced }: MuteButtonProps) {
  return (
    <motion.button onClick={onToggle}
      aria-label={muted ? "Attiva audio" : "Silenzia audio"}
      title={muted ? "Attiva audio (M)" : "Silenzia audio (M)"}
      className={cn(
        "fixed top-4 right-4 z-50 flex items-center justify-center w-9 h-9 rounded-full",
        "border transition-colors duration-200 shadow-sm backdrop-blur-sm",
        muted
          ? "bg-muted/90 border-border/60 text-muted-foreground hover:bg-muted"
          : "bg-background/80 border-border/40 text-foreground/60 hover:text-foreground hover:border-border/80"
      )}
      whileHover={reduced ? {} : { scale: 1.08 }}
      whileTap={reduced ? {} : { scale: 0.92 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {muted
          ? <motion.span key="muted" initial={{ opacity: 0, scale: 0.7, rotate: -15 }} animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.7, rotate: 15 }} transition={{ duration: 0.18 }}
              className="flex items-center justify-center"><VolumeX className="w-4 h-4" /></motion.span>
          : <motion.span key="unmuted" initial={{ opacity: 0, scale: 0.7, rotate: 15 }} animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.7, rotate: -15 }} transition={{ duration: 0.18 }}
              className="flex items-center justify-center"><Volume2 className="w-4 h-4" /></motion.span>
        }
      </AnimatePresence>
      <span className="sr-only">{muted ? "Audio silenzioso" : "Audio attivo"}</span>
    </motion.button>
  );
}


export function SpiritBreath({ reduced }: { reduced: boolean }) {
  if (reduced) return <span className="text-xs text-muted-foreground/60 italic">Prenditi il tuo tempo</span>;
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="block w-1.5 h-1.5 rounded-full bg-primary/50"
          animate={{ scale: [1, 1.6, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.35 }}
        />
      ))}
      <span className="text-xs text-muted-foreground/50 ml-1">Rifletti con calma</span>
    </div>
  );
}


interface PhaseOverlayProps {
  phase: 0 | 1 | 2;
  label: string;
  emoji: string;
  description: string;
  onDone: () => void;
}
export function PhaseOverlay({ phase, label, emoji, description, onDone }: PhaseOverlayProps) {
  useEffect(() => {
    const id = setTimeout(onDone, PHASE_OVERLAY_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  const inner: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
    exit:  { opacity: 0, transition: { duration: 0.2 } },
  };
  const item: Variants = {
    hidden: { opacity: 0, y: 16, scale: 0.92 },
    show:  { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: SLIDE_EASE_OUT } },
  };

  return (
    <motion.div
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center bg-gradient-to-br",
        PHASE_OVERLAY_BG[phase]
      )}
      initial={{ opacity: 0, scale: 0.88, filter: "blur(14px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 1.05, filter: "blur(6px)" }}
      transition={{ duration: 0.38, ease: SLIDE_EASE_OUT }}
      aria-live="assertive"
      aria-label={`Nuova fase: ${label}`}
    >
      <motion.div
        className="absolute w-64 h-64 rounded-full pointer-events-none"
        style={{ background: "var(--primary)", filter: "blur(60px)", opacity: 0.18 }}
        animate={{ scale: [0.9, 1.1, 0.9] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="relative z-10 flex flex-col items-center gap-5 px-8 text-center"
        variants={inner} initial="hidden" animate="show" exit="exit"
      >
        <motion.div variants={item}
          className="text-7xl sm:text-8xl leading-none select-none"
          style={{ filter: "drop-shadow(0 0 24px hsl(var(--foreground) / 0.25))" }}
        >
          {emoji}
        </motion.div>
        <motion.div variants={item}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest border",
            PHASE_OVERLAY_ACCENT[phase], "text-white/70"
          )}
        >
          Fase {phase + 1} di 3
        </motion.div>
        <motion.h2 variants={item} className="text-3xl sm:text-4xl font-serif font-bold text-white leading-tight">
          {label}
        </motion.h2>
        <motion.p variants={item} className="text-sm sm:text-base text-white/60 max-w-xs leading-relaxed">
          {description}
        </motion.p>
        <motion.div variants={item} className="w-48 h-0.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full bg-white/50 rounded-full origin-left"
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: PHASE_OVERLAY_MS / 1000 - 0.2, ease: "linear", delay: 0.3 }}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}


const DIVIDER_MS = 400;
export function SectionDivider({ onDone, reduced }: {
  label: string; emoji: string; description: string; onDone: () => void; reduced: boolean;
}) {
  useEffect(() => { const id = setTimeout(onDone, reduced ? 0 : DIVIDER_MS); return () => clearTimeout(id); }, [onDone, reduced]);
  return null;
}


const CHAR_DELAY_MS = 28;
interface TypewriterTextProps { text: string; reduced: boolean; className?: string; }
export function TypewriterText({ text, reduced, className }: TypewriterTextProps) {
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


interface WelcomeScreenProps {
  userName?: string;
  reduced: boolean;
  muted: boolean;
  onStart: () => void;
  speechText: string;
  speechCharIndex: number;
}
export function WelcomeScreen({ userName, reduced, muted, onStart, speechText, speechCharIndex }: WelcomeScreenProps) {
  const startBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { startBtnRef.current?.focus(); }, []);

  useEffect(() => {
    if (reduced || muted) return;
    const firstName = userName?.split(" ")[0];
    const greeting = firstName ? `Ciao ${firstName},` : "Ciao,";
    const id = setTimeout(() => {
      speak(
        `${greeting} sono Wendy, la tua guida all'orientamento professionale. E' un piacere conoscerti. Quando sei pronta, inizia il percorso.`,
        { interrupt: true },
      );
    }, 800);
    return () => { clearTimeout(id); stopSpeech(); };
  }, [reduced, muted, userName]);

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
    : { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: SLIDE_EASE_OUT } } };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background sm:static sm:z-auto sm:bg-transparent sm:overflow-visible">
      <div className="flex flex-col justify-between min-h-full px-5 pt-12 pb-[env(safe-area-inset-bottom,1.5rem)] sm:justify-center sm:items-center sm:py-16 sm:pb-16 sm:min-h-0">
        <motion.div
          className="flex flex-col items-center text-center gap-5 w-full max-w-lg mx-auto sm:gap-6"
          variants={containerVariants} initial="hidden" animate="show"
        >
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
            <WendyAvatar state="curious" phase={0} reduced={reduced} size={140}
              className="shadow-lg relative z-10 sm:w-[170px] sm:h-[170px]" />
          </motion.div>

          <AnimatePresence>
            {!muted && speechText && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3 }}
                className="w-full max-w-sm">
                <WendySpeechCaption text={speechText} charIndex={speechCharIndex} />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div variants={itemVariants} className="space-y-1 sm:space-y-2">
            <p className="text-sm sm:text-base text-muted-foreground font-medium">{greeting}</p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-foreground leading-tight">
              Sono Wendy, la tua guida
            </h1>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-primary leading-tight">
              all'orientamento professionale.
            </p>
          </motion.div>

          <motion.p variants={itemVariants}
            className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed max-w-sm sm:max-w-md">
            Rispondo a qualche domanda su di te - sul modo in cui lavori,
            pensi e vuoi crescere - e costruisco il tuo profilo professionale su misura.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center gap-2">
            <div className="flex items-center gap-1.5 bg-muted/60 border border-border/50 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="text-sm">ðŸ“</span>{ALL_IDS.length} domande
            </div>
            <div className="flex items-center gap-1.5 bg-muted/60 border border-border/50 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />~8 minuti
            </div>
            <div className="flex items-center gap-1.5 bg-muted/60 border border-border/50 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Layers className="w-3.5 h-3.5" />3 fasi
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="hidden sm:flex flex-col items-center gap-3 pt-2 w-full">
            <Button ref={startBtnRef} size="lg" onClick={onStart}
              className="rounded-full px-8 h-14 text-base font-semibold w-full sm:w-auto gap-2">
              Inizia il percorso
              <motion.span className="inline-flex"
                animate={reduced ? {} : { x: [0, 4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              ><ArrowRight className="w-5 h-5" /></motion.span>
            </Button>
            <p className="text-xs text-muted-foreground/50">Puoi interrompere e riprendere in qualsiasi momento</p>
          </motion.div>
        </motion.div>

        <motion.div
          className="sm:hidden mt-6 w-full flex flex-col items-center gap-2"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { delay: 0.75, duration: 0.45, ease: SLIDE_EASE_OUT }}
        >
          <div className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none bg-gradient-to-t from-background to-transparent" />
          <div className="relative w-full flex flex-col items-center gap-2 pt-4 border-t border-border/30">
            <Button ref={startBtnRef} size="lg" onClick={onStart}
              className="rounded-full h-14 text-base font-semibold w-full gap-2">
              Inizia il percorso
              <motion.span className="inline-flex"
                animate={reduced ? {} : { x: [0, 4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              ><ArrowRight className="w-5 h-5" /></motion.span>
            </Button>
            <p className="text-xs text-muted-foreground/50">Puoi interrompere e riprendere in qualsiasi momento</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}


interface WendyMobileStripProps {
  phase: 0 | 1 | 2;
  avatarState: AvatarState;
  reduced: boolean;
  avatarIntro: string | undefined;
  captionActive: boolean;
  speechText: string;
  speechCharIndex: number;
  lyraHasEntered: boolean;
}
export function WendyMobileStrip({
  phase, avatarState, reduced, avatarIntro, captionActive, speechText, speechCharIndex, lyraHasEntered
}: WendyMobileStripProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: SLIDE_EASE_OUT }}
      className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5 mb-5 transition-colors duration-500", PHASE_BG[phase])}
    >
      <div className="shrink-0">
        <WendyAvatar state={avatarState} phase={phase} reduced={reduced} size={48} className="shadow-sm" />
      </div>
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          {captionActive && speechText ? (
            <motion.div key="caption" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <WendySpeechCaption text={speechText} charIndex={speechCharIndex} />
            </motion.div>
          ) : lyraHasEntered && avatarIntro ? (
            <motion.p key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className="text-xs text-muted-foreground/70 italic leading-snug line-clamp-2">
              &ldquo;<TypewriterText text={avatarIntro} reduced={reduced} />&rdquo;
            </motion.p>
          ) : (
            <motion.p key="name" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">Wendy</motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}



